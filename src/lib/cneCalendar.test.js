import { describe, expect, it } from 'vitest';
import {
	alignSeriesByFairDay,
	crossYearDailyProfile,
	dayFromKey,
	dayOfFair,
	daysBetween,
	demandIndex,
	fairAnchorForRun,
	fairWindowForYear,
	firstMondayOfSeptember,
	nextFairWindow,
	resolveForecastWindow,
	segmentIntoFairRuns,
	thirdFridayOfAugust,
	toDayKey,
	torontoDayKey
} from './cneCalendar.js';

// 16:00 UTC = noon EDT / 11am EST — always the same calendar day in Toronto,
// and independent of the machine running the tests.
function at(dayKey) {
	return new Date(`${dayKey}T16:00:00Z`);
}

/** Build a minimal removal transaction on a given Toronto day. */
function tx(dayKey, itemId = 'a') {
	return { itemId, type: 'remove', previousCount: 5, newCount: 4, timestamp: at(dayKey) };
}

describe('day helpers', () => {
	it('toDayKey/dayFromKey round-trip in local time', () => {
		const d = dayFromKey('2025-08-15');
		expect(d.getFullYear()).toBe(2025);
		expect(d.getMonth()).toBe(7);
		expect(d.getDate()).toBe(15);
		expect(d.getHours()).toBe(0);
		expect(toDayKey(d)).toBe('2025-08-15');
	});

	it('daysBetween counts whole local days', () => {
		expect(daysBetween(dayFromKey('2025-08-15'), dayFromKey('2025-09-01'))).toBe(17);
		expect(daysBetween(dayFromKey('2025-09-01'), dayFromKey('2025-08-15'))).toBe(-17);
	});
});

describe('torontoDayKey (event-timezone bucketing)', () => {
	it('keeps a late-evening Toronto sale on its own day, not the next UTC day', () => {
		// 9:30pm EDT on Aug 30 2025 = 01:30 UTC Aug 31 — must stay Aug 30
		expect(torontoDayKey('2025-08-31T01:30:00Z')).toBe('2025-08-30');
	});

	it('an afternoon sale maps to that day', () => {
		expect(torontoDayKey('2025-08-16T16:00:00Z')).toBe('2025-08-16');
	});

	it('is DST-aware (EST in winter)', () => {
		// 11:30pm EST Dec 31 2024 = 04:30 UTC Jan 1 2025 — must stay Dec 31 2024
		expect(torontoDayKey('2025-01-01T04:30:00Z')).toBe('2024-12-31');
	});

	it('accepts Date, string, and epoch inputs', () => {
		const iso = '2025-08-16T16:00:00Z';
		expect(torontoDayKey(new Date(iso))).toBe('2025-08-16');
		expect(torontoDayKey(Date.parse(iso))).toBe('2025-08-16');
	});
});

describe('CNE rule dates (verified against real fairs)', () => {
	it('third Friday of August', () => {
		expect(toDayKey(thirdFridayOfAugust(2024))).toBe('2024-08-16');
		expect(toDayKey(thirdFridayOfAugust(2025))).toBe('2025-08-15');
		expect(toDayKey(thirdFridayOfAugust(2026))).toBe('2026-08-21');
	});

	it('Labour Day (first Monday of September)', () => {
		expect(toDayKey(firstMondayOfSeptember(2024))).toBe('2024-09-02');
		expect(toDayKey(firstMondayOfSeptember(2025))).toBe('2025-09-01');
		expect(toDayKey(firstMondayOfSeptember(2026))).toBe('2026-09-07');
	});

	it('fair windows are 18 days', () => {
		expect(fairWindowForYear(2024).totalDays).toBe(18);
		expect(fairWindowForYear(2025).totalDays).toBe(18);
		expect(fairWindowForYear(2026).totalDays).toBe(18);
	});

	it('nextFairWindow rolls to next year only after Labour Day', () => {
		expect(toDayKey(nextFairWindow(dayFromKey('2026-07-03')).start)).toBe('2026-08-21');
		expect(toDayKey(nextFairWindow(dayFromKey('2026-08-25')).start)).toBe('2026-08-21');
		expect(toDayKey(nextFairWindow(dayFromKey('2026-09-08')).start)).toBe('2027-08-20');
	});
});

describe('segmentIntoFairRuns', () => {
	it('splits two fairs across the off-season gap', () => {
		const rows = [
			tx('2025-08-15'),
			tx('2025-08-20'),
			tx('2025-09-01'),
			tx('2026-08-21'),
			tx('2026-08-22')
		];
		const runs = segmentIntoFairRuns(rows);
		expect(runs).toHaveLength(2);
		expect(toDayKey(runs[0].start)).toBe('2025-08-15');
		expect(toDayKey(runs[0].end)).toBe('2025-09-01');
		expect(runs[0].totalDays).toBe(18);
		expect(toDayKey(runs[1].start)).toBe('2026-08-21');
	});

	it('quiet stretches within a fair (≤ 30 days) do not split a run', () => {
		const rows = [tx('2025-08-15'), tx('2025-08-25'), tx('2025-09-01')];
		expect(segmentIntoFairRuns(rows)).toHaveLength(1);
	});

	it('handles an empty ledger', () => {
		expect(segmentIntoFairRuns([])).toEqual([]);
	});
});

describe('demandIndex', () => {
	const fair2025 = fairWindowForYear(2025); // Fri Aug 15 → Mon Sep 1

	it('opening Saturday gets the weekend spike, dampened by the opening ramp', () => {
		// Sat Aug 16 2025, day 2 of 18: 2.5 × (0.9 + 0.2 × 1/17)
		expect(demandIndex(dayFromKey('2025-08-16'), fair2025.start, 18)).toBeCloseTo(2.28, 2);
	});

	it('closing Labour Day Monday uses the Labour Day index at full ramp', () => {
		// Mon Sep 1 2025, day 18 of 18: 2.0 × 1.1
		expect(demandIndex(dayFromKey('2025-09-01'), fair2025.start, 18)).toBeCloseTo(2.2, 2);
	});

	it('mid-fair Kids’ Toonie Monday stays a normal busy Monday', () => {
		// Mon Aug 18 2025, day 4 of 18
		const value = demandIndex(dayFromKey('2025-08-18'), fair2025.start, 18);
		expect(value).toBeGreaterThan(1.1);
		expect(value).toBeLessThan(1.4);
	});

	it('weekdays sit near 1.0', () => {
		// Tue Aug 19 2025
		expect(demandIndex(dayFromKey('2025-08-19'), fair2025.start, 18)).toBeLessThan(1);
	});
});

describe('resolveForecastWindow', () => {
	it('pre-fair: targets the opening days of the next fair', () => {
		const w = resolveForecastWindow(dayFromKey('2026-07-03'), 7);
		expect(toDayKey(w.forecastDates[0])).toBe('2026-08-21');
		expect(w.horizon).toBe(7);
		expect(w.isActive).toBe(false);
	});

	it('mid-fair: starts today and clamps to Labour Day', () => {
		const w = resolveForecastWindow(dayFromKey('2026-09-04'), 14);
		expect(toDayKey(w.forecastDates[0])).toBe('2026-09-04');
		expect(w.horizon).toBe(4); // Sep 4..7
		expect(toDayKey(w.forecastDates[3])).toBe('2026-09-07');
		expect(w.isActive).toBe(true);
	});

	it('post-fair: rolls to next year', () => {
		const w = resolveForecastWindow(dayFromKey('2026-09-20'), 7);
		expect(toDayKey(w.forecastDates[0])).toBe('2027-08-20');
	});
});

describe('fair alignment', () => {
	it('anchors a data run overlapping the rule window to the rule window', () => {
		// Pre-fair stocking two days before opening day 2025
		const run = { start: dayFromKey('2025-08-13'), end: dayFromKey('2025-09-01'), totalDays: 20 };
		const anchor = fairAnchorForRun(run);
		expect(toDayKey(anchor.start)).toBe('2025-08-15');
		expect(anchor.totalDays).toBe(18);
	});

	it('aligns series by day-of-fair and averages across prior runs', () => {
		const fairStart = dayFromKey('2025-08-15');
		const aligned = alignSeriesByFairDay(
			[
				{ date: '2025-08-15', qty: 4 },
				{ date: '2025-08-16', qty: 10 }
			],
			fairStart
		);
		expect(aligned.get(1)).toBe(4);
		expect(aligned.get(2)).toBe(10);
		expect(dayOfFair(dayFromKey('2025-09-01'), fairStart)).toBe(18);

		const other = new Map([[2, 6]]);
		expect(crossYearDailyProfile([aligned, other], 2)).toBe(8);
		expect(crossYearDailyProfile([aligned, other], 1)).toBe(4);
		expect(crossYearDailyProfile([aligned, other], 9)).toBeNull();
	});
});
