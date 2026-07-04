/**
 * Prediction backtest harness: hold out the last days of the most recent
 * complete fair run, forecast them from prior data only, and score every
 * contestant (production ARIMA, flat moving average, the calendar and
 * cross-year baselines, the new AI path, and optionally the legacy AI prompt)
 * against what actually happened. MAE + WAPE per item and pooled. Server-only
 * (invoked via the stockPredictions API in backtest mode); AI responses are
 * cached by input hash so re-runs cost nothing.
 */

import { predictStockLevels as arimaPredict } from './stockPrediction.js';
import { getLegacyAIAnalysis, predictStockLevelsWithAI } from './aiStockPrediction.js';
import {
	buildDailySeries,
	buildForecastContext,
	mae,
	mapeNonZero,
	round2,
	wape
} from './predictionCore.js';
import {
	addDays,
	daysBetween,
	fairAnchorForRun,
	segmentIntoFairRuns,
	toDayKey,
	torontoDayKey
} from './cneCalendar.js';

/**
 * @typedef {import('../types').Transaction} Transaction
 * @typedef {import('../types').Item} Item
 */

const SAMPLE_SIZE = 8;
const MIN_TRAIN_DAYS = 5;

/**
 * Pick a deterministic ~8-item sample spread across the demand distribution:
 * items ranked by training-window demand, sampled evenly from top to bottom.
 * @param {Map<string, number>} demandByItem - itemId → training demand
 * @param {Item[]} items - Catalog
 * @returns {Item[]} Sample items
 */
function pickSample(demandByItem, items) {
	const ranked = items
		.filter((i) => (demandByItem.get(i.id) || 0) > 0)
		.sort((a, b) => (demandByItem.get(b.id) || 0) - (demandByItem.get(a.id) || 0));
	if (ranked.length <= SAMPLE_SIZE) return ranked;
	const sample = [];
	for (let k = 0; k < SAMPLE_SIZE; k++) {
		const idx = Math.round((k * (ranked.length - 1)) / (SAMPLE_SIZE - 1));
		if (!sample.includes(ranked[idx])) sample.push(ranked[idx]);
	}
	return sample;
}

/**
 * Score one contestant against actuals.
 * @param {number[]} actual - Actual daily demand
 * @param {number[] | null} predicted - Contestant prediction (null → not run)
 * @returns {object | null} Metrics or null
 */
function score(actual, predicted) {
	if (!predicted) return null;
	const p = predicted.slice(0, actual.length).map((v) => round2(Math.max(0, Number(v) || 0)));
	while (p.length < actual.length) p.push(0);
	return {
		prediction: p,
		mae: mae(actual, p),
		wape: wape(actual, p),
		mapeNonZero: mapeNonZero(actual, p),
		predictedTotal: round2(p.reduce((s, v) => s + v, 0)),
		absTotalError: round2(
			Math.abs(p.reduce((s, v) => s + v, 0) - actual.reduce((s, v) => s + v, 0))
		)
	};
}

/**
 * Run the backtest.
 * @param {Transaction[]} transactions - Full fetched ledger (must include the
 *   fair run under evaluation and, ideally, at least one earlier fair)
 * @param {Item[]} items - Current items
 * @param {object} [options]
 * @param {number} [options.holdoutDays=7] - Days held out at the end of the run
 * @param {string[]} [options.sampleItemIds] - Explicit sample (else auto-picked)
 * @param {boolean} [options.useAI=false] - Include the new AI contestant (costs credits)
 * @param {boolean} [options.includeLegacyAI=false] - Include the old prompt/model (costs credits)
 * @returns {Promise<object>} Backtest report
 */
export async function runPredictionBacktest(transactions, items, options = {}) {
	const { sampleItemIds, useAI = false, includeLegacyAI = false } = options;
	let holdoutDays = Math.max(2, Math.min(14, Number(options.holdoutDays) || 7));

	const runs = segmentIntoFairRuns(transactions);
	const evalRun = [...runs].reverse().find((r) => r.totalDays >= holdoutDays + MIN_TRAIN_DAYS);
	if (!evalRun) {
		return { error: 'No fair run long enough to hold out ' + holdoutDays + ' days.' };
	}
	const anchor = fairAnchorForRun(evalRun);

	// Shrink the holdout if the run is short, so at least MIN_TRAIN_DAYS remain.
	let cutoff = addDays(evalRun.end, -(holdoutDays - 1));
	while (daysBetween(anchor.start, cutoff) < MIN_TRAIN_DAYS && holdoutDays > 2) {
		holdoutDays--;
		cutoff = addDays(evalRun.end, -(holdoutDays - 1));
	}

	// Filter on Toronto calendar days (string compare of YYYY-MM-DD) so the
	// cutoff and run boundaries are timezone-correct regardless of server TZ.
	const cutoffKey = toDayKey(cutoff);
	const anchorStartKey = toDayKey(anchor.start);
	const trainTx = transactions.filter((t) => torontoDayKey(t.timestamp) < cutoffKey);
	const runTrainTx = trainTx.filter((t) => torontoDayKey(t.timestamp) >= anchorStartKey);

	// Sample selection from training-window demand within the evaluated run.
	const demandByItem = new Map();
	for (const t of runTrainTx) {
		if (t.type !== 'remove') continue;
		const qty = Math.max(0, (Number(t.previousCount) || 0) - (Number(t.newCount) || 0));
		demandByItem.set(t.itemId, (demandByItem.get(t.itemId) || 0) + qty);
	}
	const sample = sampleItemIds
		? items.filter((i) => sampleItemIds.includes(i.id))
		: pickSample(demandByItem, items);
	if (sample.length === 0) {
		return { error: 'No sample items with training demand in the evaluated run.' };
	}

	// Context "as of the cutoff": prior fairs + the run's training days.
	const ctx = buildForecastContext(trainTx, sample, holdoutDays, cutoff);
	const dayKeys = ctx.forecastDayKeys;
	const horizon = dayKeys.length;
	const lastDay = addDays(ctx.window.forecastDates[0], horizon - 1);

	// Production-shaped ARIMA: within-run transactions only (what the live
	// system effectively trains on mid-fair), internal MA fallback included.
	const arimaAll = arimaPredict(runTrainTx, horizon);

	// AI contestants (batched + cached; only when explicitly requested).
	const aiResults = useAI
		? await predictStockLevelsWithAI(trainTx, sample, holdoutDays, { now: cutoff })
		: null;

	const perItem = [];
	for (const item of sample) {
		const itemCtx = ctx.perItem.get(item.id);
		const actualSeries = buildDailySeries(
			transactions,
			item.id,
			ctx.window.forecastDates[0],
			lastDay
		);
		const actual = actualSeries.map((e) => e.qty);

		const last7 = itemCtx.currentSeries.slice(-7);
		const movingAvg =
			last7.length > 0
				? Array(horizon).fill(round2(last7.reduce((s, e) => s + e.qty, 0) / last7.length))
				: null;

		let legacy = null;
		if (includeLegacyAI) {
			legacy = await getLegacyAIAnalysis(
				runTrainTx,
				item,
				arimaAll[item.id] || Array(horizon).fill(0),
				horizon
			);
		}

		const aiResult = aiResults ? aiResults[item.id] : null;
		perItem.push({
			itemId: item.id,
			name: item.name,
			actual,
			actualTotal: round2(actual.reduce((s, v) => s + v, 0)),
			contestants: {
				'arima-production': score(actual, arimaAll[item.id] || null),
				'moving-average': score(actual, movingAvg),
				'cne-calendar': score(actual, itemCtx.baseline.variants.calendar),
				'cross-year': score(actual, itemCtx.baseline.variants.crossYear),
				'cne-baseline': score(actual, itemCtx.baseline.prediction),
				'ai-v2': aiResult
					? { ...score(actual, aiResult.prediction), method: aiResult.method }
					: null,
				'ai-legacy': score(actual, legacy)
			}
		});
	}

	// Pooled aggregates: Σ|err| / Σactual across the whole sample per contestant.
	const names = [
		'arima-production',
		'moving-average',
		'cne-calendar',
		'cross-year',
		'cne-baseline',
		'ai-v2',
		'ai-legacy'
	];
	const aggregate = {};
	for (const name of names) {
		let errSum = 0;
		let actSum = 0;
		let maeSum = 0;
		let n = 0;
		for (const row of perItem) {
			const c = row.contestants[name];
			if (!c) continue;
			for (let i = 0; i < row.actual.length; i++) {
				errSum += Math.abs(row.actual[i] - c.prediction[i]);
				actSum += row.actual[i];
			}
			maeSum += c.mae ?? 0;
			n++;
		}
		aggregate[name] =
			n === 0
				? null
				: {
						items: n,
						meanMae: round2(maeSum / n),
						pooledWape: actSum > 0 ? round2(errSum / actSum) : null
					};
	}

	return {
		evalRun: { start: toDayKey(anchor.start), end: toDayKey(evalRun.end) },
		cutoff: toDayKey(cutoff),
		holdoutDates: dayKeys,
		trainDays: daysBetween(anchor.start, cutoff),
		priorFairs: ctx.priorYears,
		sample: sample.map((i) => ({ id: i.id, name: i.name })),
		perItem,
		aggregate
	};
}
