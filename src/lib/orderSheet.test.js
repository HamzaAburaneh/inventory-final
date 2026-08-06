import { describe, expect, it } from 'vitest';
import {
	adjustOrderQuantity,
	coverageWindow,
	draftLines,
	editSummary,
	filterRows,
	formatCount,
	formatMoney,
	isEditedRow,
	isOpeningOrder,
	normalizeDraft,
	sameLines,
	savedByLabel,
	sortRows
} from './orderSheet.js';

describe('adjustOrderQuantity', () => {
	it('adds and subtracts the entered adjustment amount', () => {
		expect(adjustOrderQuantity(6, 5, 1)).toBe(11);
		expect(adjustOrderQuantity(6, 5, -1)).toBe(1);
	});

	it('never produces a negative order quantity', () => {
		expect(adjustOrderQuantity(3, 5, -1)).toBe(0);
	});
});

describe('formatMoney', () => {
	it('groups thousands and always shows two decimals', () => {
		expect(formatMoney(51324.82)).toBe('$51,324.82');
		expect(formatMoney(51324.8)).toBe('$51,324.80');
		expect(formatMoney(1000000)).toBe('$1,000,000.00');
	});

	it('leaves sub-thousand amounts ungrouped', () => {
		expect(formatMoney(0)).toBe('$0.00');
		expect(formatMoney(999.5)).toBe('$999.50');
	});

	it('puts the sign outside the dollar symbol', () => {
		expect(formatMoney(-1234.5)).toBe('-$1,234.50');
	});

	it('falls back to zero for non-numeric input', () => {
		expect(formatMoney(NaN)).toBe('$0.00');
		expect(formatMoney(undefined)).toBe('$0.00');
	});
});

describe('formatCount', () => {
	it('groups thousands', () => {
		expect(formatCount(639)).toBe('639');
		expect(formatCount(1234)).toBe('1,234');
	});

	it('rounds and tolerates garbage', () => {
		expect(formatCount(12.6)).toBe('13');
		expect(formatCount(undefined)).toBe('0');
	});
});

describe('normalizeDraft', () => {
	it('returns an empty draft for missing data', () => {
		const d = normalizeDraft(null);
		expect(d.lines).toEqual({});
		expect(d.coverageDays).toBeNull();
		expect(d.leadDays).toBeNull();
		expect(d.updatedAt).toBeNull();
		expect(d.updatedBy).toBe('');
	});

	it('keeps valid qty and included fields', () => {
		const d = normalizeDraft({
			lines: { a: { qty: 12, included: true }, b: { included: false } },
			coverageDays: 3,
			leadDays: 0,
			updatedBy: 'Hamza'
		});
		expect(d.lines).toEqual({ a: { qty: 12, included: true }, b: { included: false } });
		expect(d.coverageDays).toBe(3);
		expect(d.leadDays).toBe(0);
		expect(d.updatedBy).toBe('Hamza');
	});

	it('drops NaN and negative quantities instead of poisoning the totals', () => {
		const d = normalizeDraft({ lines: { a: { qty: 'abc' }, b: { qty: -5 }, c: { qty: 4 } } });
		expect(d.lines).toEqual({ c: { qty: 4 } });
	});

	it('floors fractional quantities', () => {
		expect(normalizeDraft({ lines: { a: { qty: 7.9 } } }).lines.a.qty).toBe(7);
	});

	it('drops lines carrying no user intent', () => {
		const d = normalizeDraft({ lines: { a: {}, b: { included: 'yes' }, c: null } });
		expect(d.lines).toEqual({});
	});

	it('rejects a zero or negative coverage but accepts a zero lead', () => {
		expect(normalizeDraft({ coverageDays: 0 }).coverageDays).toBeNull();
		expect(normalizeDraft({ leadDays: 0 }).leadDays).toBe(0);
		expect(normalizeDraft({ leadDays: -1 }).leadDays).toBeNull();
	});

	it('accepts a Firestore Timestamp, a Date, or neither', () => {
		const when = new Date('2026-08-21T14:00:00Z');
		expect(normalizeDraft({ updatedAt: { toDate: () => when } }).updatedAt).toEqual(when);
		expect(normalizeDraft({ updatedAt: when }).updatedAt).toEqual(when);
		expect(normalizeDraft({ updatedAt: 'nope' }).updatedAt).toBeNull();
	});
});

describe('draftLines', () => {
	it('keeps only meaningful edits', () => {
		expect(draftLines({ a: { qty: 5 }, b: { included: false }, c: {}, d: null })).toEqual({
			a: { qty: 5 },
			b: { included: false }
		});
	});

	it('drops invalid quantities but keeps a valid included flag on the same line', () => {
		expect(draftLines({ a: { qty: NaN, included: true } })).toEqual({ a: { included: true } });
	});

	it('returns an empty map for empty input', () => {
		expect(draftLines({})).toEqual({});
		expect(draftLines(undefined)).toEqual({});
	});
});

describe('sameLines', () => {
	it('detects equal and unequal maps', () => {
		expect(sameLines({ a: { qty: 1 } }, { a: { qty: 1 } })).toBe(true);
		expect(sameLines({ a: { qty: 1 } }, { a: { qty: 2 } })).toBe(false);
		expect(sameLines({ a: { qty: 1 } }, {})).toBe(false);
		expect(sameLines({}, {})).toBe(true);
	});

	it('distinguishes a differing included flag at equal qty', () => {
		expect(sameLines({ a: { qty: 1, included: true } }, { a: { qty: 1, included: false } })).toBe(
			false
		);
	});

	it('does not treat a same-sized map with different keys as equal', () => {
		expect(sameLines({ a: { qty: 1 } }, { b: { qty: 1 } })).toBe(false);
	});
});

describe('filterRows', () => {
	const rows = [{ name: 'Fries' }, { name: 'Krispy Kreme' }, { name: 'lobster' }];

	it('matches case-insensitively on a substring', () => {
		expect(filterRows(rows, 'kreme')).toEqual([{ name: 'Krispy Kreme' }]);
		expect(filterRows(rows, 'LOB')).toEqual([{ name: 'lobster' }]);
	});

	it('returns everything for an empty or whitespace query', () => {
		expect(filterRows(rows, '')).toBe(rows);
		expect(filterRows(rows, '   ')).toBe(rows);
	});

	it('returns nothing when there is no match', () => {
		expect(filterRows(rows, 'zzz')).toEqual([]);
	});
});

describe('sortRows', () => {
	const rows = [
		{ name: 'corn', count: 5, qty: 10, cost: 2, reorderBy: { dayIndex: 3 }, runOut: null },
		{
			name: 'apple',
			count: 1,
			qty: 4,
			cost: 50,
			reorderBy: { dayIndex: 1 },
			runOut: { dayIndex: 2 }
		},
		{ name: 'beef', count: 9, qty: 0, cost: 5, reorderBy: null, runOut: { dayIndex: 0 } }
	];

	it('defaults to soonest reorder-by first, no-reorder last', () => {
		expect(sortRows(rows, 'urgency').map((r) => r.name)).toEqual(['apple', 'corn', 'beef']);
	});

	it('keeps the no-date rows last even when descending', () => {
		expect(sortRows(rows, 'urgency', 'desc').map((r) => r.name)).toEqual(['corn', 'apple', 'beef']);
	});

	it('sorts by name in both directions', () => {
		expect(sortRows(rows, 'name').map((r) => r.name)).toEqual(['apple', 'beef', 'corn']);
		expect(sortRows(rows, 'name', 'desc').map((r) => r.name)).toEqual(['corn', 'beef', 'apple']);
	});

	it('sorts numerically by count and qty', () => {
		expect(sortRows(rows, 'count').map((r) => r.name)).toEqual(['apple', 'corn', 'beef']);
		expect(sortRows(rows, 'qty', 'desc').map((r) => r.name)).toEqual(['corn', 'apple', 'beef']);
	});

	it('sorts by per-case cost independently of quantity', () => {
		// cost apple 50, beef 5, corn 2 — a different order than line value.
		expect(sortRows(rows, 'cost', 'desc').map((r) => r.name)).toEqual(['apple', 'beef', 'corn']);
		expect(sortRows(rows, 'cost').map((r) => r.name)).toEqual(['corn', 'beef', 'apple']);
	});

	it('sorts by line value (qty x cost)', () => {
		// apple 200, corn 20, beef 0
		expect(sortRows(rows, 'value', 'desc').map((r) => r.name)).toEqual(['apple', 'corn', 'beef']);
	});

	it('sorts by run-out with missing run-outs last', () => {
		expect(sortRows(rows, 'runOut').map((r) => r.name)).toEqual(['beef', 'apple', 'corn']);
	});

	it('does not mutate the input array', () => {
		const before = rows.map((r) => r.name);
		sortRows(rows, 'name', 'desc');
		expect(rows.map((r) => r.name)).toEqual(before);
	});

	it('breaks ties by name', () => {
		const tied = [
			{ name: 'b', qty: 1, cost: 1 },
			{ name: 'a', qty: 1, cost: 1 }
		];
		expect(sortRows(tied, 'qty').map((r) => r.name)).toEqual(['a', 'b']);
	});
});

describe('isOpeningOrder', () => {
	it('is true pre-fair when every shelf is empty', () => {
		expect(isOpeningOrder([{ count: 0 }, { count: 0 }], true)).toBe(true);
	});

	it('stays true pre-fair when a stray item still has stock', () => {
		// A single leftover count must not drop the page back into urgency mode,
		// where all 50 items band as "urgent" and the alarm colouring is noise.
		expect(isOpeningOrder([{ count: 0 }, { count: 3 }], true)).toBe(true);
	});

	it('is false once the fair has started, even at zero stock', () => {
		expect(isOpeningOrder([{ count: 0 }], false)).toBe(false);
	});

	it('is false with no rows', () => {
		expect(isOpeningOrder([], true)).toBe(false);
	});
});

describe('coverageWindow', () => {
	const days = ['2026-08-21', '2026-08-22', '2026-08-23', '2026-08-24', '2026-08-25'];

	it('lands on the lead day and covers the coverage span after it', () => {
		// Lead 2 → arrives Aug 23; coverage 2 → covers Aug 23 and Aug 24.
		expect(coverageWindow(days, 2, 2)).toEqual({ arrives: '2026-08-23', through: '2026-08-24' });
	});

	it('covers only the arrival day at a coverage of 1', () => {
		expect(coverageWindow(days, 1, 1)).toEqual({ arrives: '2026-08-22', through: '2026-08-22' });
	});

	it('arrives the same day at a zero lead', () => {
		expect(coverageWindow(days, 0, 3)).toEqual({ arrives: '2026-08-21', through: '2026-08-23' });
	});

	it('clamps to the end of the horizon', () => {
		expect(coverageWindow(days, 3, 7)).toEqual({ arrives: '2026-08-24', through: '2026-08-25' });
	});

	it('matches the window suggestedOrderQty actually sums', () => {
		// Lead 1, coverage 2 sums prediction indices 1 and 2 — days Aug 22..23.
		const win = coverageWindow(days, 1, 2);
		expect(win).toEqual({ arrives: days[1], through: days[2] });
	});

	it('returns null without a forecast', () => {
		expect(coverageWindow([], 1, 2)).toBeNull();
		expect(coverageWindow(undefined, 1, 2)).toBeNull();
	});

	it('coerces garbage to a sane window', () => {
		expect(coverageWindow(days, undefined, undefined)).toEqual({
			arrives: '2026-08-21',
			through: '2026-08-21'
		});
	});
});

describe('savedByLabel', () => {
	it('is empty when never saved', () => {
		expect(savedByLabel({ updatedAt: null, updatedBy: 'Hamza' })).toBe('');
		expect(savedByLabel(null)).toBe('');
	});

	it('names the editor when known', () => {
		const label = savedByLabel({ updatedAt: new Date(2026, 7, 21, 14, 5), updatedBy: 'Hamza' });
		expect(label).toMatch(/^Saved by Hamza · /);
		expect(label).toMatch(/2:05/);
	});

	it('omits the name when unknown', () => {
		const label = savedByLabel({ updatedAt: new Date(2026, 7, 21, 14, 5), updatedBy: '' });
		expect(label).toMatch(/^Saved /);
		expect(label).not.toMatch(/by/);
	});
});

/**
 * @param {Partial<{cost: number, suggested: number, qty: number, included: boolean,
 *   defaultIncluded: boolean, edited: boolean}>} [over] - Fields to override
 */
function row(over = {}) {
	return {
		cost: 10,
		suggested: 2,
		qty: 2,
		included: true,
		defaultIncluded: true,
		edited: false,
		...over
	};
}

describe('isEditedRow', () => {
	it('is false for an untouched row', () => {
		expect(isEditedRow(row())).toBe(false);
		expect(isEditedRow(null)).toBe(false);
	});

	it('is true for a retyped quantity', () => {
		expect(isEditedRow(row({ edited: true, qty: 5 }))).toBe(true);
	});

	it('is true when the include choice differs from the default', () => {
		expect(isEditedRow(row({ included: false }))).toBe(true);
		expect(isEditedRow(row({ included: true, defaultIncluded: false }))).toBe(true);
	});
});

describe('editSummary', () => {
	it('reports no delta when nothing has been touched', () => {
		const summary = editSummary([row(), row({ cost: 5, suggested: 4, qty: 4 })]);
		expect(summary).toEqual({ suggested: 40, current: 40, delta: 0, editedCount: 0 });
	});

	it('measures the cost impact of a raised quantity', () => {
		const summary = editSummary([row({ qty: 5, edited: true }), row()]);
		expect(summary.suggested).toBe(40);
		expect(summary.current).toBe(70);
		expect(summary.delta).toBe(30);
		expect(summary.editedCount).toBe(1);
	});

	it('counts an excluded row as an edit and drops it from the current total', () => {
		const summary = editSummary([row({ included: false }), row()]);
		expect(summary.suggested).toBe(40);
		expect(summary.current).toBe(20);
		expect(summary.delta).toBe(-20);
		expect(summary.editedCount).toBe(1);
	});

	it('counts a row that was both retyped and unchecked once', () => {
		const summary = editSummary([row({ qty: 9, edited: true, included: false })]);
		expect(summary.editedCount).toBe(1);
		expect(summary.current).toBe(0);
	});

	it('adds rows the page would not have included on its own', () => {
		const summary = editSummary([row({ defaultIncluded: false, included: true, qty: 3 })]);
		expect(summary.suggested).toBe(0);
		expect(summary.current).toBe(30);
		expect(summary.delta).toBe(30);
	});

	it('skips zero-quantity rows on both sides of the comparison', () => {
		const summary = editSummary([row({ suggested: 0, qty: 0 }), row()]);
		expect(summary).toEqual({ suggested: 20, current: 20, delta: 0, editedCount: 0 });
	});

	it('tolerates missing numbers and an empty list', () => {
		expect(editSummary([])).toEqual({ suggested: 0, current: 0, delta: 0, editedCount: 0 });
		expect(editSummary(undefined).delta).toBe(0);
		const summary = editSummary([row({ cost: NaN, qty: undefined, suggested: undefined })]);
		expect(summary.current).toBe(0);
		expect(summary.suggested).toBe(0);
	});
});
