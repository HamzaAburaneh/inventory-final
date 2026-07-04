/**
 * AI-Enhanced Stock Prediction Service using OpenRouter — CNE-aware.
 * The deterministic path (ARIMA on this fair's data, else the cross-year /
 * calendar baseline from predictionCore) always works and is the fallback for
 * every AI failure mode. The AI layer batches multiple items per request,
 * caches responses by input hash, and validates/clamps everything before it
 * can reach the UI. Server-only module.
 */

import { env } from '$env/dynamic/private';
import { predictStockLevels as arimaPredict } from './stockPrediction.js';
import {
	buildForecastContext,
	computeConfidence,
	round2,
	stableStringify,
	stockOutDate,
	reorderByDate,
	validateAIPrediction
} from './predictionCore.js';
import { dayOfFair, demandIndex, toDayKey, torontoDayKey } from './cneCalendar.js';

/**
 * @typedef {import('../types').Transaction} Transaction
 * @typedef {import('../types').Item} Item
 * @typedef {import('../types').PredictionResult} PredictionResult
 */

// Server-only secret ($env/dynamic/private): never use a VITE_ prefix here —
// that would expose the key in the client bundle. Importing this module from
// client code is a build error, which is exactly the guard we want.
const OPENROUTER_API_KEY = env.OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

// Model is env-overridable; bump PROMPT_VERSION on any prompt change so the
// cache can never serve stale-prompt results.
const DEFAULT_MODEL = 'anthropic/claude-sonnet-4.5';
const LEGACY_MODEL = 'openai/gpt-4o';
const PROMPT_VERSION = 2;
const BATCH_SIZE = 8;
const MAX_CONCURRENT_BATCHES = 4;
const REQUEST_TIMEOUT_MS = 45000;
const CACHE_MAX_ENTRIES = 500;

// In-memory response cache keyed by input hash. On serverless this lives per
// warm instance — it bounds cost per instance, not globally, which is fine
// for this app's scale.
const aiCache = new Map();

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
	'Jan',
	'Feb',
	'Mar',
	'Apr',
	'May',
	'Jun',
	'Jul',
	'Aug',
	'Sep',
	'Oct',
	'Nov',
	'Dec'
];

/**
 * Locale-independent short day label, e.g. "Fri Aug 21 2026".
 * @param {Date} d - Date
 * @returns {string} Label
 */
function fmtDay(d) {
	return `${WEEKDAY_NAMES[d.getDay()]} ${MONTH_NAMES[d.getMonth()]} ${d.getDate()} ${d.getFullYear()}`;
}

/**
 * The active OpenRouter model (read per call so tests/env can override).
 * @returns {string} Model slug
 */
function activeModel() {
	return env.OPENROUTER_MODEL || DEFAULT_MODEL;
}

/**
 * Insert into the cache, evicting oldest entries past the cap.
 * @param {string} key - Cache key
 * @param {object} value - Validated AI response
 */
function cachePut(key, value) {
	aiCache.set(key, value);
	if (aiCache.size > CACHE_MAX_ENTRIES) {
		const excess = aiCache.size - CACHE_MAX_ENTRIES;
		let i = 0;
		for (const k of aiCache.keys()) {
			if (i++ >= excess) break;
			aiCache.delete(k);
		}
	}
}

/**
 * Cache key for one item's AI forecast: any change to the prompt, model,
 * window, item state, or demand history produces a new key.
 * @param {Item} item - The item
 * @param {object} itemCtx - Per-item forecast context
 * @param {object} ctx - Full forecast context
 * @param {string} model - Model slug
 * @param {string} [variant='v2'] - Prompt variant tag
 * @returns {string} Stable key
 */
function aiCacheKey(item, itemCtx, ctx, model, variant = 'v2') {
	return stableStringify({
		promptVersion: PROMPT_VERSION,
		variant,
		model,
		forecastDayKeys: ctx.forecastDayKeys,
		item: {
			id: item.id,
			name: item.name,
			count: item.count ?? 0,
			lowCount: item.lowCount ?? null,
			storageType: item.storageType || ''
		},
		series: itemCtx.currentSeries,
		prior: itemCtx.priorAligned.map((m) => [...m.entries()]),
		baseline: itemCtx.baseline.prediction
	});
}

/**
 * POST a chat completion to OpenRouter with a hard timeout. Throws on any
 * non-OK status or network/timeout error.
 * @param {object} body - Chat completion request body
 * @returns {Promise<string>} Raw message content
 */
async function callOpenRouter(body) {
	const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${OPENROUTER_API_KEY}`,
			'Content-Type': 'application/json',
			'HTTP-Referer': 'https://stocksense.app',
			'X-Title': 'StockSense Inventory Predictions'
		},
		body: JSON.stringify(body),
		signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
	});
	if (!response.ok) {
		throw new Error(`OpenRouter API error: ${response.status}`);
	}
	const data = await response.json();
	const content = data?.choices?.[0]?.message?.content;
	if (typeof content !== 'string' || content.length === 0) {
		throw new Error('OpenRouter returned an empty completion');
	}
	return content;
}

/**
 * Extract the JSON object from a completion that may be fenced or padded
 * with commentary.
 * @param {string} content - Raw completion text
 * @returns {object} Parsed JSON
 */
function extractJson(content) {
	let text = content;
	const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
	if (fenced) text = fenced[1];
	const first = text.indexOf('{');
	const last = text.lastIndexOf('}');
	if (first === -1 || last <= first) throw new Error('No JSON object in AI response');
	return JSON.parse(text.slice(first, last + 1));
}

/**
 * Run tasks over a list with bounded concurrency.
 * @param {Array} list - Work items
 * @param {number} limit - Max concurrent tasks
 * @param {(item: *) => Promise<void>} worker - Task runner
 * @returns {Promise<void>} Resolves when all tasks settle
 */
async function runPool(list, limit, worker) {
	let index = 0;
	const runners = Array.from({ length: Math.min(limit, list.length) }, async () => {
		while (index < list.length) {
			const item = list[index++];
			await worker(item);
		}
	});
	await Promise.all(runners);
}

/**
 * Build the multi-item prompt: one shared CNE header (crowd model + dated
 * forecast window) and a compact data block per item. Booths are deliberately
 * absent — the model must only reason from signals it is actually given.
 * @param {object} ctx - Forecast context
 * @param {{item: Item, itemCtx: object}[]} batch - Items in this request
 * @returns {string} Prompt
 */
function buildBatchPrompt(ctx, batch) {
	const { window } = ctx;
	const lines = [];
	lines.push(
		'You forecast daily demand (in cases) for a food vendor at the Canadian National Exhibition (CNE) in Toronto.'
	);
	lines.push(
		`FAIR: ${fmtDay(window.fairStart)} to ${fmtDay(window.fairEnd)} (${window.totalDays} days).`
	);
	lines.push('UNITS: 1 unit = one CASE or BOX, never a single serving.');
	lines.push('');
	lines.push('CROWD MODEL (relative daily demand, quiet weekday = 1.0):');
	lines.push(
		"Tue 0.9 · Wed 0.95 · Thu 1.1 · Fri 1.5 · Sat 2.5 · Sun 2.2 · Mon 1.3 (Kids' Toonie Day) · closing Labour Day Monday 2.0."
	);
	lines.push(
		'Crowds build ~20% from opening weekend to the final Labour Day weekend (Air Show). Opening days can be weather-soft.'
	);
	lines.push('');
	lines.push(
		`FORECAST DAYS (${window.horizon} days — predict each day separately, never cumulative):`
	);
	window.forecastDates.forEach((d, i) => {
		const idx = demandIndex(d, window.fairStart, window.totalDays);
		lines.push(
			`D${i + 1} = ${fmtDay(d)} (fair day ${dayOfFair(d, window.fairStart)}, index ${idx})`
		);
	});
	lines.push('');
	lines.push('ITEMS:');
	for (const { item, itemCtx } of batch) {
		const low = item.lowCount ?? 'none';
		lines.push(`### ${item.id}`);
		lines.push(
			`${item.name} — ${item.storageType || 'unspecified storage'} | stock ${item.count ?? 0} cases | low-stock threshold ${low}`
		);
		const soFar = itemCtx.currentSeries
			.map((e, i) => `d${i + 1} ${e.date.slice(5)}: ${e.qty}`)
			.join(', ');
		lines.push(`This fair so far (fair day, date: cases): ${soFar || 'no days recorded yet'}`);
		if (itemCtx.priorYears > 0) {
			const aligned = window.forecastDates
				.map((d, i) => {
					const dof = dayOfFair(d, window.fairStart);
					let sum = 0;
					let n = 0;
					for (const run of itemCtx.priorAligned) {
						if (run.has(dof)) {
							sum += run.get(dof);
							n++;
						}
					}
					return n > 0 ? `D${i + 1}: ${round2(sum / n)}` : `D${i + 1}: ?`;
				})
				.join(', ');
			lines.push(
				`Last CNE (avg of ${itemCtx.priorYears} prior fair${itemCtx.priorYears === 1 ? '' : 's'}), same fair days as the forecast: ${aligned}`
			);
		} else {
			lines.push('Last CNE: no prior-fair data for this item.');
		}
		lines.push(
			`Reference baseline (cases/day): [${itemCtx.baseline.prediction.map((v) => round2(v)).join(', ')}]`
		);
		lines.push('');
	}
	lines.push('RULES:');
	lines.push(
		"1. Anchor on last CNE's same-fair-day demand where available, scaled by how this fair is tracking against last year; blend with this fair's most recent days."
	);
	lines.push('2. Where no prior-year anchor exists, apply the crowd model to the observed pace.');
	lines.push(
		'3. Perishable items (Refrigerator / fresh) should not be overstocked in the final days of the fair.'
	);
	lines.push(
		'4. Stay realistic for event food service; if an item clearly is not selling this year, predict low.'
	);
	lines.push(
		'5. reasoning: at most 2 short sentences naming the concrete signals used. drivers: 2-4 short factor tags. confidence: 0-1, conservative when data is thin.'
	);
	lines.push('');
	lines.push('Respond with ONLY a JSON object of this exact shape (no markdown, no commentary):');
	lines.push(
		`{"<itemId>": {"prediction": [${window.horizon} numbers], "reasoning": "...", "confidence": 0.0, "drivers": ["...", "..."]}}`
	);
	lines.push('Include every item id listed above.');
	return lines.join('\n');
}

/**
 * One batched AI call with a single retry; returns a map of itemId →
 * validated response (invalid/missing items are null → per-item fallback).
 * @param {object} ctx - Forecast context
 * @param {{item: Item, itemCtx: object}[]} batch - Items in this request
 * @param {string} model - Model slug
 * @returns {Promise<Object<string, object | null> | null>} Validated map or null
 */
async function callBatch(ctx, batch, model) {
	const prompt = buildBatchPrompt(ctx, batch);
	const body = {
		model,
		messages: [
			{
				role: 'system',
				content:
					'You are a precise demand forecaster. You respond with a single JSON object and nothing else.'
			},
			{ role: 'user', content: prompt }
		],
		temperature: 0.2,
		max_tokens: Math.min(4000, 300 + 260 * batch.length)
	};
	for (let attempt = 1; attempt <= 2; attempt++) {
		try {
			const content = await callOpenRouter(body);
			const parsed = extractJson(content);
			const out = {};
			for (const { item, itemCtx } of batch) {
				out[item.id] = validateAIPrediction(parsed[item.id], {
					horizon: ctx.window.horizon,
					maxDaily: itemCtx.maxDaily
				});
			}
			return out;
		} catch (error) {
			console.error(`AI batch attempt ${attempt} failed:`, error.message);
			if (attempt === 2) return null;
		}
	}
	return null;
}

/**
 * Human-readable method label for a deterministic prediction.
 * @param {boolean} usedArima - Whether ARIMA produced the shown numbers
 * @param {string} baselineSource - Baseline source tag
 * @returns {string} Method label
 */
function deterministicMethod(usedArima, baselineSource) {
	if (usedArima) return 'ARIMA';
	return baselineSource === 'none' ? 'No Data' : 'CNE Baseline';
}

/**
 * Assemble the API-facing result object for one item.
 * @param {object} args - Pieces of the result
 * @returns {PredictionResult} Result
 */
function assembleResult({
	item,
	ctx,
	prediction,
	method,
	reasoning,
	factors,
	confidence,
	arima,
	baseline,
	model = null
}) {
	return {
		prediction,
		reasoning,
		confidence,
		factors,
		method,
		model,
		baseline: baseline.prediction,
		baselineSource: baseline.source,
		arima,
		forecastDates: ctx.forecastDayKeys,
		stockOut: stockOutDate(item.count ?? 0, prediction, ctx.forecastDayKeys),
		reorderBy: reorderByDate(item.count ?? 0, item.lowCount, prediction, ctx.forecastDayKeys)
	};
}

/**
 * Deterministic predictions for every item from a prebuilt context: ARIMA on
 * this fair's transactions when there is enough history, otherwise the
 * cross-year / calendar CNE baseline. Never crosses the off-season gap.
 * @param {Transaction[]} transactions - Full fetched ledger
 * @param {Item[]} items - Current items
 * @param {object} ctx - Forecast context from buildForecastContext
 * @returns {Object<string, PredictionResult>} Results keyed by item id
 */
function deterministicFromContext(transactions, items, ctx) {
	// Compare Toronto calendar days as strings (YYYY-MM-DD sorts chronologically)
	// so the window boundary is timezone-correct regardless of the server's TZ.
	const fairStartKey = toDayKey(ctx.window.fairStart);
	const forecastStartKey = ctx.forecastDayKeys[0];
	const currentTx = transactions.filter((t) => {
		const key = torontoDayKey(t.timestamp);
		return key >= fairStartKey && key < forecastStartKey;
	});
	const arimaAll = arimaPredict(currentTx, ctx.window.horizon);

	const results = {};
	for (const item of items) {
		const itemCtx = ctx.perItem.get(item.id);
		const activeDays = itemCtx.currentSeries.filter((e) => e.qty > 0).length;
		const rawArima = arimaAll[item.id];
		const arima = Array.isArray(rawArima)
			? rawArima.slice(0, ctx.window.horizon).map((v) => round2(Math.max(0, Number(v) || 0)))
			: null;
		const eligible =
			arima !== null && activeDays > 0 && itemCtx.historyDays >= ctx.window.horizon * 2;
		const prediction = eligible ? arima : itemCtx.baseline.prediction;
		const baseSum = itemCtx.baseline.prediction.reduce((s, v) => s + v, 0);
		const predSum = prediction.reduce((s, v) => s + v, 0);
		const divergence = eligible ? Math.abs(predSum - baseSum) / Math.max(baseSum, 1) : null;

		let reasoning;
		let factors;
		if (eligible) {
			reasoning = `ARIMA time-series fit on ${itemCtx.historyDays} days of this fair's sales.`;
			factors = ["This fair's daily sales", 'ARIMA time series'];
		} else if (itemCtx.baseline.source.startsWith('cross-year')) {
			const scaleNote =
				itemCtx.baseline.scale !== 1
					? `, scaled ×${itemCtx.baseline.scale} to this year's pace`
					: '';
			reasoning = `Anchored to last CNE's demand on the same fair days${scaleNote}.`;
			factors = ['Last CNE same-day demand', 'CNE crowd model'];
		} else if (itemCtx.baseline.source === 'calendar') {
			reasoning = "This fair's average pace shaped by the CNE day-of-week/day-of-fair crowd model.";
			factors = ["This fair's daily sales", 'CNE crowd model'];
		} else {
			reasoning = 'No sales history for this item yet — no demand predicted.';
			factors = ['No data'];
		}

		results[item.id] = assembleResult({
			item,
			ctx,
			prediction,
			method: deterministicMethod(eligible, itemCtx.baseline.source),
			reasoning,
			factors,
			confidence: computeConfidence({
				historyDays: activeDays,
				priorYears: itemCtx.priorYears,
				divergence
			}),
			arima,
			baseline: itemCtx.baseline
		});
	}
	return results;
}

/**
 * Deterministic (non-AI) stock predictions: CNE-run-aware ARIMA with the
 * cross-year / calendar baseline underneath. This is the "ARIMA model" toggle
 * path and the fallback for every AI failure.
 * @param {Transaction[]} transactions - Full fetched ledger (may span fairs)
 * @param {Item[]} items - Current items
 * @param {number} [forecastDays=14] - Requested horizon
 * @param {{now?: Date | string}} [options] - `now` is injectable for backtests
 * @returns {Object<string, PredictionResult>} Results keyed by item id
 */
export function predictStockLevelsDeterministic(
	transactions,
	items,
	forecastDays = 14,
	options = {}
) {
	const now = options.now ? new Date(options.now) : new Date();
	const ctx = buildForecastContext(transactions, items, forecastDays, now);
	return deterministicFromContext(transactions, items, ctx);
}

/**
 * AI-enhanced stock predictions: the deterministic result plus a batched,
 * cached, validated AI layer on top. Any per-item AI failure falls back to
 * the deterministic prediction, honestly labeled.
 * @param {Transaction[]} transactions - Full fetched ledger (may span fairs)
 * @param {Item[]} items - Current items
 * @param {number} [forecastDays=14] - Requested horizon
 * @param {{now?: Date | string}} [options] - `now` is injectable for backtests
 * @returns {Promise<Object<string, PredictionResult>>} Results keyed by item id
 */
export async function predictStockLevelsWithAI(
	transactions,
	items,
	forecastDays = 14,
	options = {}
) {
	const now = options.now ? new Date(options.now) : new Date();
	const ctx = buildForecastContext(transactions, items, forecastDays, now);
	const deterministic = deterministicFromContext(transactions, items, ctx);

	if (!OPENROUTER_API_KEY) {
		console.warn('OpenRouter API key not configured, falling back to deterministic predictions');
		const out = {};
		for (const [id, r] of Object.entries(deterministic)) {
			out[id] = { ...r, method: `${r.method} (AI unavailable)` };
		}
		return out;
	}

	const model = activeModel();
	const results = {};
	const pending = [];
	for (const item of items) {
		const itemCtx = ctx.perItem.get(item.id);
		const key = aiCacheKey(item, itemCtx, ctx, model);
		const cached = aiCache.get(key);
		if (cached) {
			results[item.id] = assembleAIResult(
				item,
				itemCtx,
				ctx,
				deterministic[item.id],
				cached,
				model
			);
		} else {
			pending.push({ item, itemCtx, key });
		}
	}

	const batches = [];
	for (let i = 0; i < pending.length; i += BATCH_SIZE) {
		batches.push(pending.slice(i, i + BATCH_SIZE));
	}
	await runPool(batches, MAX_CONCURRENT_BATCHES, async (batch) => {
		const parsed = await callBatch(ctx, batch, model);
		for (const { item, itemCtx, key } of batch) {
			const validated = parsed ? parsed[item.id] : null;
			if (validated) {
				cachePut(key, validated);
				results[item.id] = assembleAIResult(
					item,
					itemCtx,
					ctx,
					deterministic[item.id],
					validated,
					model
				);
			} else {
				const det = deterministic[item.id];
				results[item.id] = { ...det, method: `${det.method} (AI fallback)` };
			}
		}
	});
	return results;
}

/**
 * Merge a validated AI response with the deterministic context into the final
 * result: data-grounded confidence (AI self-report tempered, divergence vs the
 * baseline reported) and order-planning dates recomputed from the AI numbers.
 * @param {Item} item - The item
 * @param {object} itemCtx - Per-item context
 * @param {object} ctx - Forecast context
 * @param {PredictionResult} det - Deterministic result (fallback source)
 * @param {object} validated - Validated AI response
 * @param {string} model - Model slug
 * @returns {PredictionResult} Final result
 */
function assembleAIResult(item, itemCtx, ctx, det, validated, model) {
	const baseSum = itemCtx.baseline.prediction.reduce((s, v) => s + v, 0);
	const aiSum = validated.prediction.reduce((s, v) => s + v, 0);
	const divergence = Math.abs(aiSum - baseSum) / Math.max(baseSum, 1);
	const activeDays = itemCtx.currentSeries.filter((e) => e.qty > 0).length;
	return assembleResult({
		item,
		ctx,
		prediction: validated.prediction,
		method: 'AI Enhanced',
		reasoning: validated.reasoning || det.reasoning,
		factors: validated.drivers.length > 0 ? validated.drivers : det.factors,
		confidence: computeConfidence({
			historyDays: activeDays,
			priorYears: itemCtx.priorYears,
			aiConfidence: validated.confidence,
			divergence
		}),
		arima: det.arima,
		baseline: itemCtx.baseline,
		model
	});
}

/**
 * Legacy single-item AI analysis — the pre-rework prompt and (buggy,
 * gap-dropping) history preparation, preserved verbatim so the backtest can
 * score the "before" system against the new one. Not used by any production
 * path. Cached like everything else to protect credits.
 * @param {Transaction[]} transactions - Ledger rows
 * @param {Item} item - The item
 * @param {number[]} arimaPrediction - ARIMA reference for the horizon
 * @param {number} forecastDays - Horizon
 * @returns {Promise<number[] | null>} Legacy AI prediction or null on failure
 */
export async function getLegacyAIAnalysis(transactions, item, arimaPrediction, forecastDays) {
	if (!OPENROUTER_API_KEY) return null;

	// Faithful to the old prepareHistoricalSales: groups removals by day and
	// returns the values WITHOUT zero-filling quiet days (the F1 bug).
	const dailySales = {};
	transactions
		.filter((t) => t.itemId === item.id)
		.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
		.forEach((t) => {
			if (t.type !== 'remove') {
				const key = toDayKey(t.timestamp);
				dailySales[key] = dailySales[key] || 0;
				return;
			}
			const key = toDayKey(t.timestamp);
			const change = Math.max(0, (Number(t.previousCount) || 0) - (Number(t.newCount) || 0));
			dailySales[key] = (dailySales[key] || 0) + change;
		});
	const historicalSales = Object.values(dailySales);

	const prompt = `
You are an expert inventory analyst specializing in high-volume, multi-booth operations at seasonal events like the Canadian National Exhibition (CNE).

Item: ${item.name}
Unit Meaning: One unit represents a CASE or BOX of the item, not an individual unit.
Current Stock: ${item.count ?? 0}
Forecast Timeframe: ${forecastDays} day(s)
Booth Context: 8 booths total — each booth has specific menu items (e.g., desserts, poutines, burgers, hotdogs). Not all booths use every item.

Historical Daily Sales (last ${historicalSales.length} days): [${historicalSales.join(', ')}]
${historicalSales.length > 0 ? `ARIMA Reference (${forecastDays} days): [${arimaPrediction.join(', ')}]` : 'No historical data available — use domain knowledge of food festivals.'}

CRITICAL CONTEXT:
- This is for a busy summer food event like the CNE
- Weekends are MUCH busier: Friday = 2–3x, Saturday = 4–5x, Sunday = 3–4x weekday traffic
- Not all items are used in every booth — usage depends on item category
- Weather impacts attendance: sunny = packed, rainy = slow
- Perishability matters — avoid overstocking fresh items like produce
- 1 forecast day = predict demand for **just that day**, not cumulative

INSTRUCTIONS:
1. Account for the fact that 1 unit = a **case or box**, not an individual item
2. Consider booth types and which would realistically use this item
3. Predict realistic demand for ${forecastDays} day(s) only
4. Use weekend multipliers ONLY if the day falls on Fri/Sat/Sun
5. Avoid extreme predictions unless strongly supported by patterns or trends
6. Favor operational realism — CNE is busy, but space and storage are limited

Format your answer in strict JSON:
{
  "prediction": [array of ${forecastDays} daily predictions],
  "reasoning": "Brief explanation",
  "confidence": number between 0 and 1,
  "factors": ["list", "of", "key", "influences"]
}
`;

	const key = stableStringify({
		legacy: 1,
		model: LEGACY_MODEL,
		item: item.id,
		historicalSales,
		forecastDays
	});
	if (aiCache.has(key)) return aiCache.get(key);
	try {
		const content = await callOpenRouter({
			model: LEGACY_MODEL,
			messages: [{ role: 'user', content: prompt }],
			temperature: 0.3,
			max_tokens: 1000
		});
		const parsed = extractJson(content);
		if (!Array.isArray(parsed.prediction) || parsed.prediction.length < forecastDays) return null;
		const prediction = parsed.prediction.slice(0, forecastDays).map((v) => Number(v) || 0);
		cachePut(key, prediction);
		return prediction;
	} catch (error) {
		console.error('Legacy AI analysis failed:', error.message);
		return null;
	}
}
