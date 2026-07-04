/**
 * CNE fair calendar — pure date and segmentation logic for the prediction
 * pipeline. The app is only used during the Canadian National Exhibition
 * (third Friday of August through Labour Day Monday, 18 days), so the ledger
 * is a series of short fair runs separated by ~11-month gaps. Naively
 * zero-filling across those gaps poisons any time-series model, so everything
 * demand-related must first be segmented into runs and aligned by day-of-fair.
 * Everything here is deterministic and I/O-free; sources for the demand-index
 * constants are in PREDICTIONS_IMPROVEMENT_PLAN.md (§0 and §6).
 */

/**
 * @typedef {import('../types').Transaction} Transaction
 * @typedef {import('../types').FairRun} FairRun
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Gap (in days) between active days that splits two separate fair runs. */
export const MAX_GAP_DAYS = 30;

/** Standard length of a CNE run in days (third Friday of Aug → Labour Day). */
export const FAIR_LENGTH_DAYS = 18;

/**
 * Relative daily demand index by weekday (quiet weekday ≈ 1.0), indexed by
 * Date#getDay (0 = Sunday … 6 = Saturday). Weekends dominate; Kids' Toonie
 * Monday keeps Mondays busy for a weekday.
 */
export const WEEKDAY_INDEX = [2.2, 1.3, 0.9, 0.95, 1.1, 1.5, 2.5];

/** Demand index for the closing Labour Day Monday (final-day peak). */
export const LABOUR_DAY_INDEX = 2.0;

// Crowds build over the run: the final weekend runs ~20% above opening.
const RAMP_START = 0.9;
const RAMP_END = 1.1;

/**
 * Local-time day key (YYYY-MM-DD) for a date-like value.
 * @param {Date | string | number} value - Date, ISO string, or epoch millis
 * @returns {string} Day key in local time
 */
export function toDayKey(value) {
	const d = new Date(value);
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${d.getFullYear()}-${m}-${day}`;
}

/** The event's fixed timezone — the CNE is in Toronto. */
export const EVENT_TIME_ZONE = 'America/Toronto';

const torontoParts = new Intl.DateTimeFormat('en-CA', {
	timeZone: EVENT_TIME_ZONE,
	year: 'numeric',
	month: '2-digit',
	day: '2-digit'
});

/**
 * Calendar-day key for a real instant, read in the event's timezone
 * (America/Toronto, DST-aware). Use this — NOT toDayKey — for actual
 * transaction timestamps: the server runs in UTC, so a Toronto sale after
 * ~8 p.m. would otherwise be bucketed into the next calendar day and smear the
 * evening peak (which is the whole game during the CNE) onto the wrong day.
 * toDayKey stays for dates we CONSTRUCT as local midnight (fair windows,
 * forecast days) so they round-trip; this is only for observed instants.
 * @param {Date | string | number} value - A real timestamp
 * @returns {string} Toronto calendar day (YYYY-MM-DD)
 */
export function torontoDayKey(value) {
	let y = '';
	let m = '';
	let d = '';
	for (const part of torontoParts.formatToParts(new Date(value))) {
		if (part.type === 'year') y = part.value;
		else if (part.type === 'month') m = part.value;
		else if (part.type === 'day') d = part.value;
	}
	return `${y}-${m}-${d}`;
}

/**
 * Parse a YYYY-MM-DD day key back to a local-midnight Date. Never use
 * `new Date('YYYY-MM-DD')` for this — that parses as UTC midnight and shifts
 * the day in any negative-offset timezone.
 * @param {string} key - Day key (YYYY-MM-DD)
 * @returns {Date} Local midnight of that day
 */
export function dayFromKey(key) {
	const [y, m, d] = key.split('-').map(Number);
	return new Date(y, m - 1, d);
}

/**
 * Local midnight of the given date.
 * @param {Date | string | number} value - Date-like value
 * @returns {Date} Local midnight
 */
export function startOfDay(value) {
	const d = new Date(value);
	d.setHours(0, 0, 0, 0);
	return d;
}

/**
 * Add whole days to a date (normalized to local midnight).
 * @param {Date | string | number} value - Date-like value
 * @param {number} n - Days to add (may be negative)
 * @returns {Date} Resulting local midnight
 */
export function addDays(value, n) {
	const d = startOfDay(value);
	d.setDate(d.getDate() + n);
	return d;
}

/**
 * Whole days from `a` to `b` (positive when b is later). Rounded so DST
 * transitions between local midnights cannot skew the count.
 * @param {Date | string | number} a - Earlier date
 * @param {Date | string | number} b - Later date
 * @returns {number} Day difference
 */
export function daysBetween(a, b) {
	return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY_MS);
}

/**
 * Segment transactions into fair runs: consecutive active days at most
 * MAX_GAP_DAYS apart belong to one run, and the off-season gap between runs is
 * discarded entirely (no series may ever span it).
 * @param {Transaction[]} transactions - Ledger rows (any order)
 * @returns {FairRun[]} Runs sorted chronologically
 */
export function segmentIntoFairRuns(transactions) {
	const dayKeys = [...new Set(transactions.map((t) => torontoDayKey(t.timestamp)))].sort();
	/** @type {{start: Date, end: Date}[]} */
	const spans = [];
	let current = null;
	for (const key of dayKeys) {
		const day = dayFromKey(key);
		if (!current || daysBetween(current.end, day) > MAX_GAP_DAYS) {
			current = { start: day, end: day };
			spans.push(current);
		} else {
			current.end = day;
		}
	}
	return spans.map((s) => ({
		start: s.start,
		end: s.end,
		totalDays: daysBetween(s.start, s.end) + 1
	}));
}

/**
 * The third Friday of August — the CNE's opening day.
 * @param {number} year - Full year
 * @returns {Date} Opening day (local midnight)
 */
export function thirdFridayOfAugust(year) {
	const aug1 = new Date(year, 7, 1);
	const offsetToFriday = (5 - aug1.getDay() + 7) % 7;
	return new Date(year, 7, 1 + offsetToFriday + 14);
}

/**
 * The first Monday of September — Labour Day, the CNE's closing day.
 * @param {number} year - Full year
 * @returns {Date} Closing day (local midnight)
 */
export function firstMondayOfSeptember(year) {
	const sep1 = new Date(year, 8, 1);
	const offsetToMonday = (1 - sep1.getDay() + 7) % 7;
	return new Date(year, 8, 1 + offsetToMonday);
}

/**
 * The rule-based CNE window for a year (opening day through Labour Day).
 * @param {number} year - Full year
 * @returns {{start: Date, end: Date, totalDays: number}} Fair window
 */
export function fairWindowForYear(year) {
	const start = thirdFridayOfAugust(year);
	const end = firstMondayOfSeptember(year);
	return { start, end, totalDays: daysBetween(start, end) + 1 };
}

/**
 * The current or next CNE window as of `fromDate`: this year's fair if it has
 * not ended yet, otherwise next year's.
 * @param {Date | string | number} fromDate - Reference date
 * @returns {{start: Date, end: Date, totalDays: number}} Fair window
 */
export function nextFairWindow(fromDate) {
	const d = startOfDay(fromDate);
	const thisYear = fairWindowForYear(d.getFullYear());
	if (d.getTime() <= thisYear.end.getTime()) return thisYear;
	return fairWindowForYear(d.getFullYear() + 1);
}

/**
 * The fair anchor for a data-derived run: the rule window of the run's year
 * when they overlap (pre-fair stocking days may precede opening day), else the
 * run's own span. Day-of-fair alignment is relative to this anchor.
 * @param {FairRun} run - Data-derived run
 * @returns {{start: Date, end: Date, totalDays: number}} Anchor window
 */
export function fairAnchorForRun(run) {
	const rule = fairWindowForYear(run.start.getFullYear());
	const overlaps =
		run.end.getTime() >= rule.start.getTime() && run.start.getTime() <= rule.end.getTime();
	if (overlaps) return rule;
	return { start: run.start, end: run.end, totalDays: daysBetween(run.start, run.end) + 1 };
}

/**
 * 1-based day-of-fair index for a date (day 1 = opening day). Can be ≤ 0 for
 * pre-fair days.
 * @param {Date | string | number} date - Date to index
 * @param {Date} fairStart - Opening day
 * @returns {number} Day-of-fair
 */
export function dayOfFair(date, fairStart) {
	return daysBetween(fairStart, date) + 1;
}

/**
 * Relative demand index for a fair date: weekday base (WEEKDAY_INDEX, with the
 * closing Labour Day Monday overriding the normal Monday value) times a linear
 * day-of-fair ramp from RAMP_START to RAMP_END.
 * @param {Date | string | number} date - Date to score
 * @param {Date} fairStart - Opening day
 * @param {number} [totalDays=FAIR_LENGTH_DAYS] - Length of the fair
 * @returns {number} Demand index (quiet weekday ≈ 1.0), 2 decimal places
 */
export function demandIndex(date, fairStart, totalDays = FAIR_LENGTH_DAYS) {
	const d = startOfDay(date);
	const dof = dayOfFair(d, fairStart);
	let base = WEEKDAY_INDEX[d.getDay()];
	if (d.getDay() === 1 && dof >= totalDays - 1) base = LABOUR_DAY_INDEX;
	const clamped = Math.min(Math.max(dof, 1), totalDays);
	const frac = totalDays > 1 ? (clamped - 1) / (totalDays - 1) : 0;
	const ramp = RAMP_START + (RAMP_END - RAMP_START) * frac;
	return Math.round(base * ramp * 100) / 100;
}

/**
 * Resolve the forecast window: always anchored to the current-or-next CNE.
 * Mid-fair, forecasting starts today and is clamped to Labour Day; off-season,
 * it targets the opening days of the next fair.
 * @param {Date | string | number} today - Reference date
 * @param {number} forecastDays - Requested horizon
 * @returns {{fairStart: Date, fairEnd: Date, totalDays: number, forecastDates: Date[],
 *   horizon: number, isActive: boolean}} Forecast window
 */
export function resolveForecastWindow(today, forecastDays) {
	const t = startOfDay(today);
	const fair = nextFairWindow(t);
	const forecastStart = t.getTime() > fair.start.getTime() ? t : fair.start;
	const daysLeft = daysBetween(forecastStart, fair.end) + 1;
	const horizon = Math.max(1, Math.min(forecastDays, daysLeft));
	const forecastDates = [];
	for (let i = 0; i < horizon; i++) forecastDates.push(addDays(forecastStart, i));
	return {
		fairStart: fair.start,
		fairEnd: fair.end,
		totalDays: fair.totalDays,
		forecastDates,
		horizon,
		isActive: t.getTime() >= fair.start.getTime() && t.getTime() <= fair.end.getTime()
	};
}

/**
 * Index a dated daily series by day-of-fair relative to a fair anchor.
 * @param {{date: string, qty: number}[]} series - Dated daily demand
 * @param {Date} fairStart - Opening day of the series' own fair
 * @returns {Map<number, number>} day-of-fair → quantity
 */
export function alignSeriesByFairDay(series, fairStart) {
	const map = new Map();
	for (const entry of series) {
		map.set(dayOfFair(dayFromKey(entry.date), fairStart), entry.qty);
	}
	return map;
}

/**
 * Average demand at a day-of-fair across prior runs, counting only runs that
 * cover that day. Null when no prior run covers it.
 * @param {Map<number, number>[]} alignedPriorRuns - Per-run day-of-fair maps
 * @param {number} dof - Day-of-fair to look up
 * @returns {number | null} Average quantity or null
 */
export function crossYearDailyProfile(alignedPriorRuns, dof) {
	let sum = 0;
	let n = 0;
	for (const run of alignedPriorRuns) {
		if (run.has(dof)) {
			sum += run.get(dof);
			n++;
		}
	}
	return n > 0 ? sum / n : null;
}
