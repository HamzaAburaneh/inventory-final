// Pure presentation/shaping helpers for the order page. Firestore access for
// order drafts lives in orders.js; everything here is side-effect free so the
// page's search, sorting, currency formatting and draft merging are unit
// testable without a database or a browser.

/**
 * @typedef {import('../types').OrderDraft} OrderDraft
 * @typedef {import('../types').OrderLine} OrderLine
 */

/**
 * Format a dollar amount with thousands separators and exactly two decimals
 * (`51324.8` → `$51,324.80`). Hand-rolled rather than Intl so the output is
 * identical in every environment the tests and the browser run in.
 * @param {number} value - Amount in dollars
 * @returns {string} Formatted currency string
 */
export function formatMoney(value) {
	const n = Number(value);
	const safe = Number.isFinite(n) ? n : 0;
	const [whole, frac] = Math.abs(safe).toFixed(2).split('.');
	const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
	return `${safe < 0 ? '-' : ''}$${grouped}.${frac}`;
}

/**
 * Format a whole-number count with thousands separators (`1234` → `1,234`).
 * @param {number} value - The count
 * @returns {string} Formatted integer string
 */
export function formatCount(value) {
	const n = Math.round(Number(value));
	const safe = Number.isFinite(n) ? n : 0;
	return String(Math.abs(safe)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Coerce a raw Firestore order-draft document into a known shape. Remote data
 * is untrusted here — a hand-edited or partially-written doc must never be
 * able to inject NaN quantities into the totals — so every line is validated
 * and anything unusable is dropped rather than defaulted to a wrong number.
 * @param {any} raw - The document data, or null/undefined when no draft exists
 * @returns {{lines: Object.<string, OrderLine>, coverageDays: number | null,
 *   leadDays: number | null, updatedAt: Date | null, updatedBy: string}}
 */
export function normalizeDraft(raw) {
	/** @type {Object.<string, OrderLine>} */
	const lines = {};
	const rawLines = raw && typeof raw.lines === 'object' && raw.lines !== null ? raw.lines : {};

	for (const [id, value] of Object.entries(rawLines)) {
		if (!value || typeof value !== 'object') continue;
		/** @type {OrderLine} */
		const line = {};
		const qty = Number(/** @type {any} */ (value).qty);
		if (Number.isFinite(qty) && qty >= 0) line.qty = Math.floor(qty);
		if (typeof (/** @type {any} */ (value).included) === 'boolean') {
			line.included = /** @type {any} */ (value).included;
		}
		// A line with neither field carries no user intent — skip it so it can't
		// resurrect as an empty override.
		if (line.qty !== undefined || line.included !== undefined) lines[id] = line;
	}

	return {
		lines,
		coverageDays: positiveIntOrNull(raw?.coverageDays),
		leadDays: nonNegativeIntOrNull(raw?.leadDays),
		updatedAt: toDate(raw?.updatedAt),
		updatedBy: typeof raw?.updatedBy === 'string' ? raw.updatedBy : ''
	};
}

/**
 * @param {any} value - Candidate number
 * @returns {number | null} The value as a positive integer, or null
 */
function positiveIntOrNull(value) {
	const n = Number(value);
	return Number.isFinite(n) && n >= 1 ? Math.floor(n) : null;
}

/**
 * @param {any} value - Candidate number
 * @returns {number | null} The value as a non-negative integer, or null
 */
function nonNegativeIntOrNull(value) {
	const n = Number(value);
	return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

/**
 * Firestore hands back a Timestamp (with .toDate()) online and can hand back a
 * plain Date or null from cache — accept all three.
 * @param {any} value - Timestamp, Date, or nullish
 * @returns {Date | null}
 */
function toDate(value) {
	if (!value) return null;
	if (value instanceof Date) return value;
	if (typeof value.toDate === 'function') {
		const d = value.toDate();
		return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
	}
	return null;
}

/**
 * Build the `lines` map to persist from the page's in-memory overrides,
 * dropping empty entries so a draft that has been reset back to the
 * suggestions doesn't keep accumulating dead keys.
 * @param {Object.<string, OrderLine>} overrides - Per-item edits from the page
 * @returns {Object.<string, OrderLine>} Cleaned lines map
 */
export function draftLines(overrides) {
	/** @type {Object.<string, OrderLine>} */
	const lines = {};
	for (const [id, value] of Object.entries(overrides ?? {})) {
		if (!value) continue;
		/** @type {OrderLine} */
		const line = {};
		if (Number.isFinite(value.qty) && /** @type {number} */ (value.qty) >= 0) {
			line.qty = Math.floor(/** @type {number} */ (value.qty));
		}
		if (typeof value.included === 'boolean') line.included = value.included;
		if (line.qty !== undefined || line.included !== undefined) lines[id] = line;
	}
	return lines;
}

/**
 * True when two line maps carry the same user intent. The page saves on a
 * timer, so this keeps an idle tab from rewriting an unchanged draft (and
 * stomping a teammate's `updatedBy`) on every tick.
 * @param {Object.<string, OrderLine>} a - First lines map
 * @param {Object.<string, OrderLine>} b - Second lines map
 * @returns {boolean}
 */
export function sameLines(a, b) {
	const keysA = Object.keys(a ?? {});
	const keysB = Object.keys(b ?? {});
	if (keysA.length !== keysB.length) return false;
	return keysA.every(
		(k) => b[k] !== undefined && a[k].qty === b[k].qty && a[k].included === b[k].included
	);
}

/**
 * Case-insensitive substring match on item name. No debounce upstream — the
 * list is small enough to filter on every keystroke.
 * @param {Array<{name: string}>} rows - Order rows
 * @param {string} query - Raw search text
 * @returns {Array<any>} Matching rows (the input array when the query is empty)
 */
export function filterRows(rows, query) {
	const q = (query ?? '').trim().toLowerCase();
	if (!q) return rows;
	return rows.filter((r) =>
		String(r.name ?? '')
			.toLowerCase()
			.includes(q)
	);
}

/** Sort keys the order table's column headers expose. */
export const SORT_KEYS = ['urgency', 'name', 'count', 'qty', 'value', 'runOut'];

/**
 * Sort order rows by a column. `urgency` (the default) is the planning order:
 * soonest reorder-by first, then name. Items with no reorder-by or no run-out
 * sort last on those keys regardless of direction, since "never runs out"
 * isn't a position on the timeline.
 * @param {Array<any>} rows - Order rows
 * @param {'urgency' | 'name' | 'count' | 'qty' | 'value' | 'runOut'} key - Sort column
 * @param {'asc' | 'desc'} [dir='asc'] - Sort direction
 * @returns {Array<any>} A new sorted array
 */
export function sortRows(rows, key, dir = 'asc') {
	const sign = dir === 'desc' ? -1 : 1;
	const byName = (a, b) => String(a.name ?? '').localeCompare(String(b.name ?? ''));
	const sorted = [...(rows ?? [])];

	if (key === 'name') return sorted.sort((a, b) => sign * byName(a, b));

	if (key === 'urgency' || key === 'runOut') {
		const at = (r) => {
			const plan = key === 'urgency' ? r.reorderBy : r.runOut;
			return plan ? plan.dayIndex : Infinity;
		};
		return sorted.sort((a, b) => {
			const av = at(a);
			const bv = at(b);
			// Infinity on both sides would make the arithmetic NaN, so compare the
			// "no date" case explicitly and always park it at the bottom.
			if (av === Infinity && bv === Infinity) return byName(a, b);
			if (av === Infinity) return 1;
			if (bv === Infinity) return -1;
			return sign * (av - bv) || byName(a, b);
		});
	}

	const value = (r) => {
		if (key === 'count') return Number(r.count) || 0;
		if (key === 'qty') return Number(r.qty) || 0;
		return (Number(r.qty) || 0) * (Number(r.cost) || 0);
	};
	return sorted.sort((a, b) => sign * (value(a) - value(b)) || byName(a, b));
}

/**
 * True when this is an opening buy rather than a top-up: the fair hasn't
 * started and there is nothing on any shelf yet. In that state every item is
 * trivially "at or below low stock", so the urgent/today/upcoming bands all
 * collapse into one and the page shows a single list instead.
 * @param {Array<{count: number}>} rows - Order rows
 * @param {boolean} planStartsLater - Forecast window opens after today
 * @returns {boolean}
 */
export function isOpeningOrder(rows, planStartsLater) {
	if (!planStartsLater) return false;
	if (!Array.isArray(rows) || rows.length === 0) return false;
	return rows.every((r) => (Number(r.count) || 0) === 0);
}

/**
 * Short "who last touched this" line for the draft status, e.g.
 * `Saved by Hamza · 2:14 PM`. Returns '' when the draft has never been saved.
 * @param {{updatedAt: Date | null, updatedBy: string}} draft - Normalized draft
 * @returns {string}
 */
export function savedByLabel(draft) {
	if (!draft?.updatedAt) return '';
	const time = draft.updatedAt.toLocaleTimeString('en-CA', {
		hour: 'numeric',
		minute: '2-digit'
	});
	return draft.updatedBy ? `Saved by ${draft.updatedBy} · ${time}` : `Saved ${time}`;
}
