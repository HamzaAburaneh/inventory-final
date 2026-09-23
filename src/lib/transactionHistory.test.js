import { describe, it, expect } from 'vitest';
import {
	seasonRange,
	currentSeasonYear,
	availableYears,
	countTransactionsByDay,
	transactionDayKey,
	transactionFilterMatches,
	matchesHistoryFilter,
	combineHistoricalTransfers,
	isMissingIndexError
} from './transactionHistory';

/**
 * The history page scopes to one CNE season and loads it whole, which keeps the
 * query bounded (the largest season on record is ~2,250 rows) without truncating
 * anything the user asked for. These cover the range arithmetic that scoping
 * depends on — including keeping off-season test rows out of the figures — plus
 * the filter translation that lets Firestore, rather than the browser, filter.
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

describe('transactionFilterMatches', () => {
	it('matches nothing for the "All" filter, so the query stays unconstrained', () => {
		expect(transactionFilterMatches('')).toEqual([]);
	});

	it('pins event as well as type for stock filters', () => {
		// itemCreated rows are written with type 'add' and itemDeleted with type
		// 'remove' (src/lib/items.js), so matching on type alone would file every
		// item creation under "Stock added".
		expect(transactionFilterMatches('add')).toEqual([
			['event', 'countChange'],
			['type', 'add']
		]);
		expect(transactionFilterMatches('remove')).toEqual([
			['event', 'countChange'],
			['type', 'remove']
		]);
	});

	it('matches lifecycle filters on event alone', () => {
		expect(transactionFilterMatches('itemCreated')).toEqual([['event', 'itemCreated']]);
		expect(transactionFilterMatches('itemDeleted')).toEqual([['event', 'itemDeleted']]);
	});

	it('never matches on type alone, which would conflate lifecycle rows', () => {
		for (const filter of ['add', 'remove', 'itemCreated', 'itemDeleted']) {
			const fields = transactionFilterMatches(filter).map(([field]) => field);
			expect(fields).toContain('event');
		}
	});
});

describe('matchesHistoryFilter', () => {
	const reviewed = { event: 'countChange', type: 'remove', historicalTransfer: true };
	const plain = { event: 'countChange', type: 'remove', historicalTransfer: false };

	it('loads the whole season for Transfers, since reviews are not ledger fields', () => {
		expect(transactionFilterMatches('stockTransfer')).toEqual([]);
	});

	it('lists new and confirmed historical transfers under Transfers only', () => {
		expect(matchesHistoryFilter({ event: 'stockTransfer' }, 'stockTransfer')).toBe(true);
		expect(matchesHistoryFilter(reviewed, 'stockTransfer')).toBe(true);
		expect(matchesHistoryFilter(plain, 'stockTransfer')).toBe(false);
		expect(matchesHistoryFilter(reviewed, 'remove')).toBe(false);
		expect(matchesHistoryFilter(plain, 'remove')).toBe(true);
		expect(matchesHistoryFilter(reviewed, '')).toBe(true);
	});
});

describe('isMissingIndexError', () => {
	it('recognises the failed-precondition Firestore raises for a missing index', () => {
		expect(isMissingIndexError({ code: 'failed-precondition' })).toBe(true);
	});

	it('does not treat other failures as a missing index', () => {
		// Permission and offline errors must not send the page down the
		// load-everything fallback path.
		expect(isMissingIndexError({ code: 'permission-denied' })).toBe(false);
		expect(isMissingIndexError({ code: 'unavailable' })).toBe(false);
		expect(isMissingIndexError(new Error('boom'))).toBe(false);
		expect(isMissingIndexError(null)).toBe(false);
		expect(isMissingIndexError(undefined)).toBe(false);
	});
});

describe('seasonRange', () => {
	it('runs from Aug 15 to the end of Sep 15', () => {
		const { start, end } = seasonRange(2026);

		expect(start).toEqual(new Date(2026, 7, 15));
		// Exclusive end is Sep 16 midnight, so all of Sep 15 is inside.
		expect(end).toEqual(new Date(2026, 8, 16));
	});

	it('includes a transaction late on the closing day', () => {
		const closingNight = new Date(2026, 8, 15, 23, 30);
		const { start, end } = seasonRange(2026);

		expect(closingNight >= start && closingNight < end).toBe(true);
	});

	it('includes the opening instant', () => {
		const { start, end } = seasonRange(2026);

		expect(start >= start && start < end).toBe(true);
	});

	it('excludes off-season rows, which is where the junk data lives', () => {
		// A count of 500,000 was typed into an item named "#1" on 2026-07-03, and
		// 44,444 on 2026-01-28. Summed over a calendar year those swamped every real
		// movement in the stat cards.
		const { start, end } = seasonRange(2026);
		for (const offSeason of [
			new Date(2026, 0, 28),
			new Date(2026, 6, 3),
			new Date(2026, 5, 25),
			new Date(2026, 9, 19)
		]) {
			expect(offSeason >= start && offSeason < end).toBe(false);
		}
	});

	it('keeps consecutive seasons disjoint', () => {
		expect(seasonRange(2025).end.getTime()).toBeLessThan(seasonRange(2026).start.getTime());
	});
});

describe('currentSeasonYear', () => {
	it('is this year once the season has opened', () => {
		expect(currentSeasonYear(new Date(2026, 7, 26))).toBe(2026);
	});

	it('is this year during the closing days', () => {
		expect(currentSeasonYear(new Date(2026, 8, 15))).toBe(2026);
	});

	it('falls back to last season between fairs', () => {
		// Opening the page in February must not show an empty current season.
		expect(currentSeasonYear(new Date(2026, 1, 10))).toBe(2025);
		expect(currentSeasonYear(new Date(2026, 7, 14))).toBe(2025);
	});

	it('stays on this season after it closes, until the next one opens', () => {
		expect(currentSeasonYear(new Date(2026, 10, 1))).toBe(2026);
	});
});

describe('availableYears', () => {
	it('lists every season from the oldest row to the latest, newest first', () => {
		expect(availableYears(2022, 2026)).toEqual([2026, 2025, 2024, 2023, 2022]);
	});

	it('offers the latest season alone before the oldest row is known', () => {
		// The picker renders immediately; the lookup that widens it is not awaited.
		expect(availableYears(null, 2026)).toEqual([2026]);
	});

	it('offers a single year for a group that started this season', () => {
		expect(availableYears(2026, 2026)).toEqual([2026]);
	});

	it('never offers a season with no data behind it', () => {
		// A clock-skewed row dated in the future must not produce an inverted range.
		expect(availableYears(2030, 2026)).toEqual([2026]);
	});
});

describe('combineHistoricalTransfers', () => {
	const product = {
		id: 'freezer-burger',
		name: 'beef burger',
		storageType: 'Freezer',
		count: 0,
		legacyItemIds: ['fridge-burger']
	};
	const side = (id, itemId, itemName, type, previousCount, newCount, time) => ({
		id,
		itemId,
		itemName,
		type,
		event: 'countChange',
		previousCount,
		newCount,
		timestamp: new Date(`2026-08-26T${time}Z`),
		user: 'staff',
		historicalTransfer: true,
		historicalTransferReviewId: 'review-1'
	});
	const removal = side('r', 'freezer-burger', 'beef burger', 'remove', 20, 10, '15:44:04');
	const addition = side('a', 'fridge-burger', 'Beef burger in fridge', 'add', 0, 10, '15:44:00');
	const plain = {
		...removal,
		id: 'p',
		historicalTransfer: false,
		historicalTransferReviewId: null
	};

	it('folds a pair into one transfer under the current product, at its earlier side', () => {
		const rows = combineHistoricalTransfers([plain, addition, removal], [product]);
		expect(rows.map((row) => row.id)).toEqual(['p', 'historical-transfer-review-1']);
		expect(rows[1]).toMatchObject({
			itemName: 'beef burger',
			event: 'stockTransfer',
			quantity: 10,
			fromLocation: 'Freezer',
			toLocation: 'Refrigerator',
			previousCount: null,
			timestamp: addition.timestamp,
			sourceTransactions: [removal, addition]
		});
		expect(removal.itemName).toBe('beef burger');
		expect(addition.itemName).toBe('Beef burger in fridge');
	});

	it('reads the direction from which side the survivor was logged on', () => {
		const back = [
			side('r2', 'fridge-burger', 'Beef burger in fridge', 'remove', 10, 6, '20:00:00'),
			side('a2', 'freezer-burger', 'beef burger', 'add', 0, 4, '20:00:03')
		];
		expect(combineHistoricalTransfers(back, [product])[0]).toMatchObject({
			fromLocation: 'Refrigerator',
			toLocation: 'Freezer'
		});
	});

	it('keeps an incomplete pair as its original row and omits unknown locations', () => {
		expect(combineHistoricalTransfers([removal], [product])).toEqual([removal]);
		expect(combineHistoricalTransfers([removal, addition])[0]).toMatchObject({
			itemName: 'beef burger',
			fromLocation: null,
			toLocation: null
		});
	});
});
