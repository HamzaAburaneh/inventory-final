import { describe, expect, it } from 'vitest';
import { dayFromKey, fairWindowForYear, toDayKey } from './cneCalendar.js';
import {
	buildCneBaseline,
	buildDailySeries,
	buildForecastContext,
	computeConfidence,
	crossYearScale,
	indexNormalizedBaseRate,
	mae,
	mapeNonZero,
	reorderByDate,
	stableStringify,
	stockOutDate,
	validateAIPrediction,
	wape
} from './predictionCore.js';

// 16:00 UTC = noon EDT / 11am EST — unambiguously the same calendar day in
// Toronto regardless of the machine running the tests.
function at(dayKey) {
	return new Date(`${dayKey}T16:00:00Z`).toISOString();
}

/** Removal transaction helper. */
function removal(dayKey, qty, itemId = 'a') {
	return { itemId, type: 'remove', previousCount: qty, newCount: 0, timestamp: at(dayKey) };
}

/** Restock transaction helper. */
function restock(dayKey, qty, itemId = 'a') {
	return { itemId, type: 'add', previousCount: 0, newCount: qty, timestamp: at(dayKey) };
}

describe('buildDailySeries', () => {
	it('zero-fills quiet days (the old AI path dropped them)', () => {
		const series = buildDailySeries(
			[removal('2025-08-15', 20), removal('2025-08-18', 18)],
			'a',
			dayFromKey('2025-08-15'),
			dayFromKey('2025-08-18')
		);
		expect(series.map((e) => e.qty)).toEqual([20, 0, 0, 18]);
		expect(series[1].date).toBe('2025-08-16');
	});

	it('counts removals only and sums same-day rows', () => {
		const series = buildDailySeries(
			[removal('2025-08-15', 3), removal('2025-08-15', 4), restock('2025-08-15', 50)],
			'a',
			dayFromKey('2025-08-15'),
			dayFromKey('2025-08-15')
		);
		expect(series).toEqual([{ date: '2025-08-15', qty: 7 }]);
	});

	it('ignores other items and returns [] for an inverted range', () => {
		const series = buildDailySeries(
			[removal('2025-08-15', 3, 'other')],
			'a',
			dayFromKey('2025-08-15'),
			dayFromKey('2025-08-14')
		);
		expect(series).toEqual([]);
	});
});

describe('cross-year baseline', () => {
	const fair = fairWindowForYear(2026); // Aug 21 → Sep 7
	const forecastDates = [0, 1, 2].map((i) => {
		const d = new Date(fair.start);
		d.setDate(d.getDate() + i);
		return d;
	});

	it('uses prior-year same-day-of-fair demand scaled to this year', () => {
		// Prior year: day 1 = 10, day 2 = 20, day 3 = 16
		const prior = new Map([
			[1, 10],
			[2, 20],
			[3, 16]
		]);
		// This year tracking at half pace over 3 observed days → scale 0.5
		const currentSeries = [
			{ date: toDayKey(forecastDates[0]), qty: 5 },
			{ date: toDayKey(forecastDates[1]), qty: 10 },
			{ date: toDayKey(forecastDates[2]), qty: 8 }
		];
		const scale = crossYearScale(currentSeries, [prior], fair.start);
		expect(scale).toBe(0.5);
		const baseline = buildCneBaseline({
			currentSeries,
			priorAligned: [prior],
			forecastDates,
			fairStart: fair.start,
			totalDays: 18
		});
		expect(baseline.prediction).toEqual([5, 10, 8]);
		expect(baseline.source).toBe('cross-year+calendar');
	});

	it('clamps the scale and requires 3 overlapping days', () => {
		const prior = new Map([[1, 1]]);
		const oneDay = [{ date: toDayKey(forecastDates[0]), qty: 50 }];
		expect(crossYearScale(oneDay, [prior], fair.start)).toBe(1);
		const threeDays = [
			{ date: toDayKey(forecastDates[0]), qty: 50 },
			{ date: toDayKey(forecastDates[1]), qty: 50 },
			{ date: toDayKey(forecastDates[2]), qty: 50 }
		];
		const bigPrior = new Map([
			[1, 1],
			[2, 1],
			[3, 1]
		]);
		expect(crossYearScale(threeDays, [bigPrior], fair.start)).toBe(2); // clamped
	});

	it('falls back to the calendar shape without prior data', () => {
		// Fri opening day observed at 10 cases; index-normalized base spread to Sat
		const currentSeries = [{ date: toDayKey(forecastDates[0]), qty: 10 }];
		const baseline = buildCneBaseline({
			currentSeries,
			priorAligned: [],
			forecastDates,
			fairStart: fair.start,
			totalDays: 18
		});
		expect(baseline.source).toBe('calendar');
		// Saturday (day 2) must be predicted above Friday (day 1)
		expect(baseline.prediction[1]).toBeGreaterThan(baseline.prediction[0]);
		expect(baseline.prediction[0]).toBeCloseTo(10, 1);
	});

	it('returns zeros with no data at all', () => {
		const baseline = buildCneBaseline({
			currentSeries: [],
			priorAligned: [],
			forecastDates,
			fairStart: fair.start,
			totalDays: 18
		});
		expect(baseline.prediction).toEqual([0, 0, 0]);
		expect(baseline.source).toBe('none');
	});

	it('indexNormalizedBaseRate divides out the day shape', () => {
		expect(indexNormalizedBaseRate([], fair.start, 18)).toBeNull();
		const rate = indexNormalizedBaseRate(
			[{ date: toDayKey(forecastDates[0]), qty: 13.5 }],
			fair.start,
			18
		);
		// Fri Aug 21 2026 index = 1.5 × 0.9 = 1.35 → base 10
		expect(rate).toBeCloseTo(10, 1);
	});
});

describe('buildForecastContext', () => {
	it('segments prior fairs, aligns them, and never spans the off-season gap', () => {
		const transactions = [
			removal('2025-08-15', 10),
			removal('2025-08-16', 25),
			removal('2025-09-01', 30),
			removal('2026-08-21', 6)
		];
		const items = [{ id: 'a', name: 'Fries', count: 40, lowCount: 10, storageType: 'Freezer' }];
		const ctx = buildForecastContext(transactions, items, 7, dayFromKey('2026-08-22'));
		const itemCtx = ctx.perItem.get('a');
		expect(ctx.priorYears).toBe(1);
		expect(itemCtx.priorYears).toBe(1);
		// Current-fair history = Aug 21 only (forecast starts Aug 22)
		expect(itemCtx.currentSeries).toEqual([{ date: '2026-08-21', qty: 6 }]);
		// Prior year aligned: day 1 = 10, day 2 = 25, day 18 = 30
		expect(itemCtx.priorAligned[0].get(1)).toBe(10);
		expect(itemCtx.priorAligned[0].get(18)).toBe(30);
		// Baseline anchors to last year's day 2 (25), scale 1 (only 1 overlap day)
		expect(itemCtx.baseline.prediction[0]).toBe(25);
	});

	it('items with no history anywhere still get a context', () => {
		const items = [{ id: 'new', name: 'New Item', count: 5, lowCount: 2, storageType: '' }];
		const ctx = buildForecastContext([], items, 7, dayFromKey('2026-07-03'));
		expect(ctx.perItem.get('new').baseline.source).toBe('none');
	});
});

describe('order planning', () => {
	const keys = ['2026-08-21', '2026-08-22', '2026-08-23', '2026-08-24'];

	it('stockOutDate walks cumulative demand', () => {
		expect(stockOutDate(10, [4, 4, 4, 4], keys)).toEqual({ date: '2026-08-23', dayIndex: 2 });
		expect(stockOutDate(100, [4, 4, 4, 4], keys)).toBeNull();
		expect(stockOutDate(0, [4, 4, 4, 4], keys)).toEqual({ date: '2026-08-21', dayIndex: 0 });
	});

	it('reorderByDate triggers at the low-stock threshold', () => {
		expect(reorderByDate(10, 3, [4, 4, 4, 4], keys)).toEqual({
			date: '2026-08-22',
			dayIndex: 1,
			immediate: false
		});
		expect(reorderByDate(2, 3, [4, 4, 4, 4], keys)).toEqual({
			date: '2026-08-21',
			dayIndex: 0,
			immediate: true
		});
		expect(reorderByDate(100, null, [4, 4, 4, 4], keys)).toBeNull();
	});
});

describe('computeConfidence', () => {
	it('rich history + prior year + agreement → high, with an honest basis', () => {
		const c = computeConfidence({ historyDays: 12, priorYears: 1, divergence: 0.05 });
		expect(c.level).toBe('high');
		expect(c.basis).toContain("12 days of this fair's sales");
		expect(c.basis).toContain('1 prior CNE');
		expect(c.basis).toContain('agree within 5%');
	});

	it('no data → low', () => {
		const c = computeConfidence({ historyDays: 0, priorYears: 0 });
		expect(c.level).toBe('low');
		expect(c.basis).toContain('no sales history this fair yet');
	});

	it('large divergence is reported, not hidden', () => {
		const c = computeConfidence({ historyDays: 5, priorYears: 1, divergence: 0.4 });
		expect(c.basis).toContain('differ by 40%');
	});

	it('the AI self-report tempers but cannot dominate', () => {
		const grounded = computeConfidence({ historyDays: 0, priorYears: 0, aiConfidence: 1 });
		expect(grounded.level).not.toBe('high');
	});
});

describe('metrics', () => {
	it('mae / wape / mapeNonZero', () => {
		expect(mae([10, 0, 20], [8, 2, 26])).toBe(3.33); // (2 + 2 + 6) / 3
		expect(wape([10, 0, 20], [8, 2, 26])).toBeCloseTo(10 / 30, 2);
		expect(mapeNonZero([10, 0, 20], [8, 2, 26])).toBeCloseTo((0.2 + 0.3) / 2, 2);
	});

	it('guards zero-demand windows and bad input', () => {
		expect(wape([0, 0], [1, 1])).toBeNull();
		expect(mapeNonZero([0, 0], [1, 1])).toBeNull();
		expect(mae([], [])).toBeNull();
		expect(mae([1], [1, 2])).toBeNull();
	});
});

describe('stableStringify', () => {
	it('is key-order independent', () => {
		expect(stableStringify({ b: 1, a: [{ y: 2, x: 1 }] })).toBe(
			stableStringify({ a: [{ x: 1, y: 2 }], b: 1 })
		);
	});
});

describe('validateAIPrediction', () => {
	const bounds = { horizon: 3, maxDaily: 30 };

	it('clamps negatives and absurd spikes, keeps good values', () => {
		const out = validateAIPrediction(
			{ prediction: [-2, 5000, 12], reasoning: 'ok', confidence: 0.8, drivers: ['weekend'] },
			bounds
		);
		expect(out.prediction).toEqual([0, 30, 12]);
		expect(out.confidence).toBe(0.8);
		expect(out.drivers).toEqual(['weekend']);
	});

	it('rejects wrong shapes', () => {
		expect(validateAIPrediction(null, bounds)).toBeNull();
		expect(validateAIPrediction({ prediction: [1, 2] }, bounds)).toBeNull();
		expect(validateAIPrediction({ prediction: [1, 'x', 3] }, bounds)).toBeNull();
	});

	it('truncates overlong arrays and sanitizes junk fields', () => {
		const out = validateAIPrediction(
			{ prediction: [1, 2, 3, 4, 5], confidence: 'high', drivers: ['a', 7, '  b  '] },
			bounds
		);
		expect(out.prediction).toEqual([1, 2, 3]);
		expect(out.confidence).toBeNull();
		expect(out.drivers).toEqual(['a', 'b']);
	});
});
