import { describe, it, expect } from 'vitest';
import {
	mergeTransactionWindows,
	windowCoversLedger,
	paginationNeedsFullHistory,
	countTransactionsByDay,
	transactionDayKey
} from './transactionHistory';

/**
 * The history page listens to only the newest N transactions so first paint
 * doesn't scale with ledger size (an unbounded listener measured ~3.8 MB and
 * ~730 ms of IndexedDB writes at ~6k records). These cover the bookkeeping that
 * keeps that bounded view honest: realtime updates must survive escalation, and
 * escalation must not fire on an empty window.
 */

const txn = (id, itemName, overrides = {}) => ({
	id,
	itemId: 'item-' + id,
	itemName,
	type: 'add',
	event: 'countChange',
	previousCount: 1,
	newCount: 2,
	timestamp: new Date('2026-01-01T00:00:00Z'),
	user: 'tester',
	...overrides
});

describe('mergeTransactionWindows', () => {
	it('returns the live window untouched before the full ledger is loaded', () => {
		const recent = [txn('a', 'Bun'), txn('b', 'Ketchup')];
		expect(mergeTransactionWindows(null, recent)).toBe(recent);
	});

	it('unions the full ledger with the live window', () => {
		const full = [txn('a', 'Bun'), txn('b', 'Ketchup')];
		const recent = [txn('b', 'Ketchup'), txn('c', 'Mustard')];

		const merged = mergeTransactionWindows(full, recent);

		expect(merged.map((t) => t.id).sort()).toEqual(['a', 'b', 'c']);
	});

	it('keeps transactions that arrive in realtime AFTER the full ledger was fetched', () => {
		// The full ledger is a one-shot read; anything written afterwards exists only
		// in the live window. Losing it here would mean realtime silently stops
		// working once the user searches.
		const full = [txn('old-1', 'Bun'), txn('old-2', 'Ketchup')];
		const recent = [txn('brand-new', 'Funnel Cake Mix'), txn('old-1', 'Bun')];

		const merged = mergeTransactionWindows(full, recent);

		expect(merged.map((t) => t.id)).toContain('brand-new');
		expect(merged).toHaveLength(3);
	});

	it('lets the live copy win, so an updated row is never served stale', () => {
		const full = [txn('a', 'Old Name', { newCount: 2 })];
		const recent = [txn('a', 'Corrected Name', { newCount: 99 })];

		const merged = mergeTransactionWindows(full, recent);

		expect(merged).toHaveLength(1);
		expect(merged[0].itemName).toBe('Corrected Name');
		expect(merged[0].newCount).toBe(99);
	});

	it('deduplicates by id rather than by object identity', () => {
		const full = [txn('a', 'Bun')];
		const recent = [txn('a', 'Bun')]; // structurally equal, different object
		expect(mergeTransactionWindows(full, recent)).toHaveLength(1);
	});

	it('handles an empty live window without dropping the ledger', () => {
		const full = [txn('a', 'Bun'), txn('b', 'Ketchup')];
		expect(mergeTransactionWindows(full, [])).toHaveLength(2);
	});
});

describe('windowCoversLedger', () => {
	it('is false before the first snapshot, however small the window looks', () => {
		// An empty window pre-snapshot says nothing about the ledger's size; treating
		// it as "covers everything" would show an empty page as if it were complete.
		expect(windowCoversLedger(false, 0, 250)).toBe(false);
	});

	it('is true when Firestore returned fewer rows than the cap', () => {
		// Fewer results than the limit means the collection was exhausted.
		expect(windowCoversLedger(true, 180, 250)).toBe(true);
	});

	it('is false when the window is exactly full, since more may exist', () => {
		expect(windowCoversLedger(true, 250, 250)).toBe(false);
	});
});

describe('paginationNeedsFullHistory', () => {
	const base = { received: true, windowSize: 250, page: 1, perPage: 10 };

	it('does not escalate before the first snapshot', () => {
		// Regression guard: with windowSize 0, `page * perPage > windowSize` is true
		// for every page, so without the `received` check this would pull the whole
		// ledger on every single page load and undo the optimisation entirely.
		expect(paginationNeedsFullHistory({ ...base, received: false, windowSize: 0 })).toBe(false);
	});

	it('does not escalate for pages the live window can fill', () => {
		expect(paginationNeedsFullHistory({ ...base, page: 1 })).toBe(false);
		expect(paginationNeedsFullHistory({ ...base, page: 25 })).toBe(false);
	});

	it('escalates once the user pages past the window', () => {
		expect(paginationNeedsFullHistory({ ...base, page: 26 })).toBe(true);
	});

	it('escalates for the "all" page size, so "all" never means "all of 250"', () => {
		expect(paginationNeedsFullHistory({ ...base, perPage: 'all' })).toBe(true);
	});

	it('escalates on a large page size that overruns the window', () => {
		expect(paginationNeedsFullHistory({ ...base, page: 3, perPage: 100 })).toBe(true);
	});
});

describe('countTransactionsByDay', () => {
	const at = (iso) => txn(iso, 'Bun', { timestamp: new Date(iso) });

	it('counts every transaction in its own calendar day', () => {
		const counts = countTransactionsByDay([
			at('2026-03-04T09:00:00'),
			at('2026-03-04T17:30:00'),
			at('2026-03-03T11:00:00')
		]);

		expect(counts.get(transactionDayKey(new Date('2026-03-04T00:00:00')))).toBe(2);
		expect(counts.get(transactionDayKey(new Date('2026-03-03T00:00:00')))).toBe(1);
	});

	it('reports a day total independent of how the set is paginated', () => {
		// The bug this fixes: the timeline was counting the rows it was handed, so a
		// day with 65 changes read "10 changes" on a 10-per-page view and "50" on 50.
		const day = Array.from({ length: 65 }, (_, i) =>
			txn('t' + i, 'Bun', { timestamp: new Date('2026-03-04T09:00:00') })
		);
		const counts = countTransactionsByDay(day);
		const key = transactionDayKey(new Date('2026-03-04T00:00:00'));

		expect(counts.get(key)).toBe(65);
		// Same answer whether the caller is about to show 10 of them or all of them.
		expect(countTransactionsByDay(day).get(key)).toBe(65);
	});

	it('separates timestamps that share a day-of-month across different months', () => {
		const counts = countTransactionsByDay([
			at('2026-03-04T09:00:00'),
			at('2026-04-04T09:00:00'),
			at('2025-03-04T09:00:00')
		]);

		expect(counts.size).toBe(3);
	});

	it('returns an empty map for an empty set', () => {
		expect(countTransactionsByDay([]).size).toBe(0);
	});
});

describe('transactionDayKey', () => {
	it('buckets two times on the same local day together', () => {
		expect(transactionDayKey(new Date('2026-03-04T00:30:00'))).toBe(
			transactionDayKey(new Date('2026-03-04T23:30:00'))
		);
	});

	it('separates adjacent local days', () => {
		expect(transactionDayKey(new Date('2026-03-04T23:59:00'))).not.toBe(
			transactionDayKey(new Date('2026-03-05T00:01:00'))
		);
	});
});
