/**
 * Pure prediction math for the CNE-aware forecasting pipeline: dated
 * zero-filled demand series, the deterministic cross-year/calendar baseline,
 * order-planning walks (run-out and reorder-by dates), data-grounded
 * confidence, backtest metrics, and AI-response validation. No I/O and no
 * model libraries here — ARIMA stays in stockPrediction.js and network calls
 * in aiStockPrediction.js, so this module is safe to unit-test and import
 * anywhere.
 */

import {
	addDays,
	alignSeriesByFairDay,
	crossYearDailyProfile,
	dayFromKey,
	dayOfFair,
	daysBetween,
	demandIndex,
	fairAnchorForRun,
	resolveForecastWindow,
	segmentIntoFairRuns,
	startOfDay,
	toDayKey,
	torontoDayKey
} from './cneCalendar.js';

/**
 * @typedef {import('../types').Transaction} Transaction
 * @typedef {import('../types').Item} Item
 */

// Scale bounds for the cross-year ratio — early-run ratios are noisy, so a
// single wild day must not double or halve the whole prior-year anchor.
const SCALE_MIN = 0.5;
const SCALE_MAX = 2;
const SCALE_MIN_DAYS = 3;

/**
 * Round to 2 decimal places.
 * @param {number} n - Value
 * @returns {number} Rounded value
 */
export function round2(n) {
	return Math.round(n * 100) / 100;
}

/**
 * Build a dated, zero-filled daily demand series for one item. Demand counts
 * removals only ('add' rows are restocks — same semantics as
 * stockPrediction.js). Every day in [start, end] gets an entry, including
 * no-sale days — this is the fix for the old AI path silently dropping quiet
 * days and inflating apparent demand.
 * @param {Transaction[]} transactions - Ledger rows (timestamps may be ISO strings)
 * @param {string} itemId - Item to build the series for
 * @param {Date} start - First day of the series (inclusive)
 * @param {Date} end - Last day of the series (inclusive)
 * @returns {{date: string, qty: number}[]} Zero-filled dated series; empty when end < start
 */
export function buildDailySeries(transactions, itemId, start, end) {
	if (startOfDay(end).getTime() < startOfDay(start).getTime()) return [];
	const byDay = new Map();
	for (const t of transactions) {
		if (t.itemId !== itemId || t.type !== 'remove') continue;
		const qty = Math.max(0, (Number(t.previousCount) || 0) - (Number(t.newCount) || 0));
		// Bucket the observed instant in Toronto time; the zero-fill loop below
		// keys constructed local-midnight days with toDayKey — both yield the
		// same YYYY-MM-DD for a given calendar day, so they line up.
		const key = torontoDayKey(t.timestamp);
		byDay.set(key, (byDay.get(key) || 0) + qty);
	}
	const series = [];
	const total = daysBetween(start, end) + 1;
	for (let i = 0; i < total; i++) {
		const key = toDayKey(addDays(start, i));
		series.push({ date: key, qty: byDay.get(key) || 0 });
	}
	return series;
}

/**
 * Scale factor mapping last CNE's pace to this one: ratio of this fair's
 * observed demand to the prior-year profile over the same fair days. Needs at
 * least SCALE_MIN_DAYS overlapping days and nonzero prior demand; clamped to
 * [SCALE_MIN, SCALE_MAX]; defaults to 1.
 * @param {{date: string, qty: number}[]} currentSeries - This fair's series so far
 * @param {Map<number, number>[]} priorAligned - Prior runs aligned by day-of-fair
 * @param {Date} fairStart - This fair's opening day
 * @returns {number} Scale factor
 */
export function crossYearScale(currentSeries, priorAligned, fairStart) {
	if (priorAligned.length === 0) return 1;
	let curSum = 0;
	let priorSum = 0;
	let days = 0;
	for (const entry of currentSeries) {
		const dof = dayOfFair(dayFromKey(entry.date), fairStart);
		const prior = crossYearDailyProfile(priorAligned, dof);
		if (prior === null) continue;
		curSum += entry.qty;
		priorSum += prior;
		days++;
	}
	if (days < SCALE_MIN_DAYS || priorSum <= 0) return 1;
	return Math.min(SCALE_MAX, Math.max(SCALE_MIN, curSum / priorSum));
}

/**
 * Demand per unit of demand-index observed this fair — the item's base rate
 * with the day-of-week/day-of-fair shape divided out, so re-multiplying by a
 * day's index predicts that day. Null with no observed days.
 * @param {{date: string, qty: number}[]} currentSeries - This fair's series so far
 * @param {Date} fairStart - Opening day
 * @param {number} totalDays - Fair length
 * @returns {number | null} Base rate or null
 */
export function indexNormalizedBaseRate(currentSeries, fairStart, totalDays) {
	if (currentSeries.length === 0) return null;
	let qtySum = 0;
	let indexSum = 0;
	for (const entry of currentSeries) {
		qtySum += entry.qty;
		indexSum += demandIndex(dayFromKey(entry.date), fairStart, totalDays);
	}
	return indexSum > 0 ? qtySum / indexSum : null;
}

/**
 * The deterministic CNE baseline for one item: prior-year same-day-of-fair
 * demand (averaged across prior fairs, scaled to this year's pace) where
 * available, else this fair's index-normalized base rate times the day's
 * demand index, else 0. Also returns the pure variants for the backtest.
 * @param {object} args
 * @param {{date: string, qty: number}[]} args.currentSeries - This fair's series so far
 * @param {Map<number, number>[]} args.priorAligned - Prior runs aligned by day-of-fair
 * @param {Date[]} args.forecastDates - Days to predict
 * @param {Date} args.fairStart - Opening day
 * @param {number} args.totalDays - Fair length
 * @returns {{prediction: number[], source: string, scale: number,
 *   variants: {calendar: number[] | null, crossYear: number[] | null}}} Baseline
 */
export function buildCneBaseline({
	currentSeries,
	priorAligned,
	forecastDates,
	fairStart,
	totalDays
}) {
	const scale = crossYearScale(currentSeries, priorAligned, fairStart);
	const baseRate = indexNormalizedBaseRate(currentSeries, fairStart, totalDays);
	const calendar =
		baseRate === null
			? null
			: forecastDates.map((d) => round2(baseRate * demandIndex(d, fairStart, totalDays)));
	let priorCovers = 0;
	const crossYear =
		priorAligned.length === 0
			? null
			: forecastDates.map((d) => {
					const prior = crossYearDailyProfile(priorAligned, dayOfFair(d, fairStart));
					if (prior === null) return null;
					priorCovers++;
					return round2(prior * scale);
				});
	const prediction = forecastDates.map((d, i) => {
		const cy = crossYear ? crossYear[i] : null;
		if (cy !== null && cy !== undefined) return cy;
		if (calendar) return calendar[i];
		return 0;
	});
	const usedPrior = priorCovers > 0;
	const source = usedPrior
		? calendar
			? 'cross-year+calendar'
			: 'cross-year'
		: calendar
			? 'calendar'
			: 'none';
	return {
		prediction,
		source,
		scale: round2(scale),
		variants: {
			calendar,
			crossYear: usedPrior
				? crossYear.map((v, i) => (v === null ? (calendar ? calendar[i] : 0) : v))
				: null
		}
	};
}

/**
 * Build the full forecast context shared by the deterministic and AI paths:
 * the CNE-anchored forecast window plus, per item, this fair's zero-filled
 * series, prior fairs aligned by day-of-fair, the deterministic baseline, and
 * a sanity ceiling for AI outputs.
 * @param {Transaction[]} transactions - Full fetched ledger (may span fairs)
 * @param {Item[]} items - Current items
 * @param {number} forecastDays - Requested horizon
 * @param {Date} [now=new Date()] - Reference date (injectable for backtests)
 * @returns {{window: ReturnType<typeof resolveForecastWindow>, forecastDayKeys: string[],
 *   priorYears: number, perItem: Map<string, object>}} Context
 */
export function buildForecastContext(transactions, items, forecastDays, now = new Date()) {
	const window = resolveForecastWindow(now, forecastDays);
	const runs = segmentIntoFairRuns(transactions);
	const priorRuns = runs.filter((r) => r.end.getTime() < window.fairStart.getTime());
	const historyEnd = addDays(window.forecastDates[0], -1);
	const forecastDayKeys = window.forecastDates.map(toDayKey);

	const perItem = new Map();
	for (const item of items) {
		const currentSeries = buildDailySeries(transactions, item.id, window.fairStart, historyEnd);
		const priorAligned = [];
		let priorYears = 0;
		for (const run of priorRuns) {
			const anchor = fairAnchorForRun(run);
			const series = buildDailySeries(transactions, item.id, anchor.start, anchor.end);
			if (series.some((e) => e.qty > 0)) {
				priorAligned.push(alignSeriesByFairDay(series, anchor.start));
				priorYears++;
			}
		}
		const baseline = buildCneBaseline({
			currentSeries,
			priorAligned,
			forecastDates: window.forecastDates,
			fairStart: window.fairStart,
			totalDays: window.totalDays
		});
		const histMax = currentSeries.reduce((m, e) => Math.max(m, e.qty), 0);
		const priorMax = priorAligned.reduce(
			(m, run) => [...run.values()].reduce((mm, v) => Math.max(mm, v), m),
			0
		);
		const baseMax = baseline.prediction.reduce((m, v) => Math.max(m, v), 0);
		perItem.set(item.id, {
			item,
			currentSeries,
			historyDays: currentSeries.length,
			priorAligned,
			priorYears,
			baseline,
			maxDaily: Math.max(20, 3 * histMax, 3 * priorMax, 3 * baseMax)
		});
	}
	return { window, forecastDayKeys, priorYears: priorRuns.length, perItem };
}

/**
 * Walk cumulative predicted demand against current stock: the first forecast
 * day on which stock is exhausted.
 * @param {number} currentCount - Cases on hand
 * @param {number[]} prediction - Daily predicted demand
 * @param {string[]} forecastDayKeys - Matching day keys
 * @returns {{date: string, dayIndex: number} | null} Run-out day or null within horizon
 */
export function stockOutDate(currentCount, prediction, forecastDayKeys) {
	let remaining = Math.max(0, Number(currentCount) || 0);
	for (let i = 0; i < prediction.length; i++) {
		remaining -= prediction[i];
		if (remaining <= 0) return { date: forecastDayKeys[i], dayIndex: i };
	}
	return null;
}

/**
 * The day by which the next order should be placed: the first forecast day on
 * which projected stock falls to or below the low-stock threshold.
 * @param {number} currentCount - Cases on hand
 * @param {number | null} lowCount - Low-stock threshold (null → 0)
 * @param {number[]} prediction - Daily predicted demand
 * @param {string[]} forecastDayKeys - Matching day keys
 * @returns {{date: string, dayIndex: number, immediate: boolean} | null} Reorder day,
 *   with `immediate` set when stock is already at/below the threshold
 */
export function reorderByDate(currentCount, lowCount, prediction, forecastDayKeys) {
	const threshold = Math.max(0, Number(lowCount) || 0);
	let projected = Math.max(0, Number(currentCount) || 0);
	if (projected <= threshold && forecastDayKeys.length > 0) {
		return { date: forecastDayKeys[0], dayIndex: 0, immediate: true };
	}
	for (let i = 0; i < prediction.length; i++) {
		projected -= prediction[i];
		if (projected <= threshold) return { date: forecastDayKeys[i], dayIndex: i, immediate: false };
	}
	return null;
}

/**
 * Cases to put on today's order for one item: enough to cover `coverageDays`
 * of predicted demand after the truck lands (plus the low-stock buffer), net
 * of what will still be on hand at delivery. Delivery is `leadDays` out, so
 * demand during the lead time is consumed first. Days beyond the prediction
 * horizon count as zero demand.
 * @param {number} count - Cases on hand now
 * @param {number | null} lowCount - Low-stock threshold (null → 0)
 * @param {number[]} prediction - Daily predicted demand, day 0 = today
 * @param {object} [options]
 * @param {number} [options.coverageDays=2] - Days of demand to cover after delivery
 * @param {number} [options.leadDays=1] - Days until the order arrives
 * @returns {number} Whole cases to order (>= 0)
 */
export function suggestedOrderQty(count, lowCount, prediction, options = {}) {
	const lead = Math.max(0, Math.floor(Number(options.leadDays ?? 1) || 0));
	const cover = Math.max(0, Math.floor(Number(options.coverageDays ?? 2) || 0));
	const onHand = Math.max(0, Number(count) || 0);
	const threshold = Math.max(0, Number(lowCount) || 0);
	const daily = Array.isArray(prediction) ? prediction : [];
	const demandOver = (from, days) => {
		let sum = 0;
		for (let i = from; i < from + days; i++) sum += Math.max(0, Number(daily[i]) || 0);
		return sum;
	};
	// Clamp at zero: an item that stocks out before delivery loses those sales,
	// it does not "owe" them — without the clamp we would over-order.
	const stockAtDelivery = Math.max(0, onHand - demandOver(0, lead));
	return Math.max(0, Math.ceil(demandOver(lead, cover) + threshold - stockAtDelivery));
}

/**
 * Bucket an item's reorder-by result for the order page, given the order lead
 * time. `dayIndex <= leadDays` must go on today's order: with a 1-day lead an
 * item breaching its threshold on day 1 is saved only by an order placed
 * today (arriving the morning of day 1) — waiting a day means a shortage.
 * `leadDays + 1` is the first index where ordering tomorrow still delivers in
 * time, so those fall into the look-ahead bucket.
 * @param {{dayIndex: number, immediate: boolean} | null} reorderBy - From reorderByDate
 * @param {object} options
 * @param {number} options.leadDays - Order lead time in days
 * @param {number} [options.lookaheadDays=3] - "Coming up" window after the order cutoff
 * @returns {'urgent' | 'today' | 'upcoming' | 'ok'} Urgency bucket
 */
export function classifyOrderUrgency(reorderBy, { leadDays, lookaheadDays = 3 }) {
	if (!reorderBy) return 'ok';
	if (reorderBy.immediate) return 'urgent';
	const lead = Math.max(0, Math.floor(Number(leadDays) || 0));
	const lookahead = Math.max(0, Math.floor(Number(lookaheadDays) || 0));
	if (reorderBy.dayIndex <= lead) return 'today';
	if (reorderBy.dayIndex <= lead + lookahead) return 'upcoming';
	return 'ok';
}

/**
 * Data-grounded confidence: what the forecast is actually standing on — days
 * of this fair's history, prior-CNE coverage, and agreement between the shown
 * prediction and the deterministic baseline — blended with (and tempered by)
 * the model's self-report when present. Returned as a level plus a plain-
 * English basis instead of fake percent precision.
 * @param {object} args
 * @param {number} args.historyDays - Days of this fair's history
 * @param {number} args.priorYears - Prior fairs with data for this item
 * @param {number | null} [args.aiConfidence] - Model self-report 0..1, if any
 * @param {number | null} [args.divergence] - |Σshown − Σbaseline| / max(Σbaseline, 1)
 * @returns {{score: number, level: 'high' | 'medium' | 'low', basis: string}} Confidence
 */
export function computeConfidence({
	historyDays,
	priorYears,
	aiConfidence = null,
	divergence = null
}) {
	const historyFactor = Math.min(1, historyDays / 10);
	const priorFactor = priorYears > 0 ? 1 : 0;
	const agreement = divergence === null ? null : Math.max(0, 1 - Math.min(1, divergence));
	let score =
		0.4 * historyFactor + 0.25 * priorFactor + 0.35 * (agreement === null ? 0.5 : agreement);
	if (aiConfidence !== null && Number.isFinite(aiConfidence)) {
		score = 0.7 * score + 0.3 * Math.min(1, Math.max(0, aiConfidence));
	}
	score = round2(score);
	const level = score >= 0.65 ? 'high' : score >= 0.4 ? 'medium' : 'low';

	const parts = [];
	parts.push(
		historyDays > 0
			? `${historyDays} day${historyDays === 1 ? '' : 's'} of this fair's sales`
			: 'no sales history this fair yet'
	);
	if (priorYears > 0) parts.push(`${priorYears} prior CNE${priorYears === 1 ? '' : 's'} of data`);
	if (agreement !== null) {
		const pct = Math.round(Math.min(1, divergence) * 100);
		parts.push(
			pct <= 15 ? `AI and baseline agree within ${pct}%` : `AI and baseline differ by ${pct}%`
		);
	}
	return { score, level, basis: `Based on ${parts.join('; ')}.` };
}

/**
 * Mean absolute error.
 * @param {number[]} actual - Actual values
 * @param {number[]} predicted - Predicted values (same length)
 * @returns {number | null} MAE, or null on empty/mismatched input
 */
export function mae(actual, predicted) {
	if (!actual.length || actual.length !== predicted.length) return null;
	const sum = actual.reduce((s, a, i) => s + Math.abs(a - predicted[i]), 0);
	return round2(sum / actual.length);
}

/**
 * Weighted absolute percentage error: Σ|err| / Σactual. The honest MAPE-like
 * metric for demand series with zero days. Null when total actual demand is 0.
 * @param {number[]} actual - Actual values
 * @param {number[]} predicted - Predicted values (same length)
 * @returns {number | null} WAPE as a fraction, or null
 */
export function wape(actual, predicted) {
	if (!actual.length || actual.length !== predicted.length) return null;
	const errSum = actual.reduce((s, a, i) => s + Math.abs(a - predicted[i]), 0);
	const actSum = actual.reduce((s, a) => s + a, 0);
	return actSum > 0 ? round2(errSum / actSum) : null;
}

/**
 * Classic MAPE computed only over nonzero-actual days (it is undefined on
 * zero days). Null when every actual is zero.
 * @param {number[]} actual - Actual values
 * @param {number[]} predicted - Predicted values (same length)
 * @returns {number | null} MAPE as a fraction over nonzero days, or null
 */
export function mapeNonZero(actual, predicted) {
	if (!actual.length || actual.length !== predicted.length) return null;
	let sum = 0;
	let n = 0;
	for (let i = 0; i < actual.length; i++) {
		if (actual[i] > 0) {
			sum += Math.abs(actual[i] - predicted[i]) / actual[i];
			n++;
		}
	}
	return n > 0 ? round2(sum / n) : null;
}

/**
 * Deterministic JSON stringify with recursively sorted object keys, so
 * identical inputs always produce identical cache keys.
 * @param {*} value - Any JSON-serializable value
 * @returns {string} Canonical JSON
 */
export function stableStringify(value) {
	if (value === null || typeof value !== 'object') return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
	const keys = Object.keys(value).sort();
	const body = keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',');
	return `{${body}}`;
}

/**
 * Validate and clamp one item's AI response. Rejects (returns null) anything
 * unusable; otherwise returns a sanitized copy with every daily value finite,
 * non-negative, and at most `maxDaily` (a history-derived sanity ceiling —
 * hallucinated absurdities must never reach the UI).
 * @param {*} raw - Parsed per-item AI output
 * @param {{horizon: number, maxDaily: number}} bounds - Expected length and ceiling
 * @returns {{prediction: number[], reasoning: string, confidence: number | null,
 *   drivers: string[]} | null} Sanitized response or null
 */
export function validateAIPrediction(raw, { horizon, maxDaily }) {
	if (!raw || typeof raw !== 'object' || !Array.isArray(raw.prediction)) return null;
	if (raw.prediction.length < horizon) return null;
	const prediction = raw.prediction.slice(0, horizon).map((v) => {
		const n = Number(v);
		if (!Number.isFinite(n)) return NaN;
		return round2(Math.min(maxDaily, Math.max(0, n)));
	});
	if (prediction.some((v) => Number.isNaN(v))) return null;
	const confidence =
		typeof raw.confidence === 'number' && Number.isFinite(raw.confidence)
			? Math.min(1, Math.max(0, raw.confidence))
			: null;
	const reasoning = typeof raw.reasoning === 'string' ? raw.reasoning.trim().slice(0, 400) : '';
	const drivers = Array.isArray(raw.drivers)
		? raw.drivers
				.filter((d) => typeof d === 'string' && d.trim().length > 0)
				.slice(0, 6)
				.map((d) => d.trim().slice(0, 40))
		: [];
	return { prediction, reasoning, confidence, drivers };
}
