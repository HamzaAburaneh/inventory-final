vi.mock('./stockReviews', () => ({
	getStockHistoryReviews: vi.fn(async () => []),
	subscribeStockHistoryReviews: vi.fn((_group, callback) => {
		callback([]);
		return () => {};
	})
}));
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Firestore so we can assert the SHAPE of the queries this module builds.
// The history page is only fast because the query is scoped — to one CNE
// season, and to the selected type filter — rather than fetching a superset and
// narrowing it in the browser. That contract is invisible at runtime until the
// ledger is large, so it is pinned here.
const mocks = vi.hoisted(() => ({
	onSnapshot: vi.fn(),
	getDocs: vi.fn(),
	groupId: 'group-1'
}));

vi.mock('../firebase', () => ({ db: {} }));
vi.mock('./activeGroup', () => ({ requireActiveGroupId: () => mocks.groupId }));

vi.mock('firebase/firestore', () => ({
	collection: vi.fn((_db, ...segments) => ({ kind: 'collection', path: segments.join('/') })),
	// Constraints are captured as tagged objects so a test can inspect them.
	orderBy: vi.fn((field, direction) => ({ kind: 'orderBy', field, direction })),
	limit: vi.fn((count) => ({ kind: 'limit', count })),
	where: vi.fn((field, op, value) => ({ kind: 'where', field, op, value })),
	query: vi.fn((ref, ...constraints) => ({ kind: 'query', ref, constraints })),
	onSnapshot: mocks.onSnapshot,
	getDocs: mocks.getDocs,
	Timestamp: { fromDate: vi.fn((date) => ({ kind: 'timestamp', date })) }
}));

import { createSeasonHistoryFeed, getEarliestTransactionYear } from './transactions';
import { subscribeStockHistoryReviews } from './stockReviews';

/** Point a new feed at a season, as the history page does when it opens. */
const showSeason = (options, onData = () => {}, onError = undefined) => {
	const feed = createSeasonHistoryFeed(onData, onError);
	feed.show(options);
	return feed;
};

/** Build a fake QueryDocumentSnapshot. */
const docSnap = (id, data) => ({ id, data: () => data });

const rawTxn = (overrides = {}) => ({
	itemId: 'item-1',
	itemName: 'Funnel Cake Mix',
	type: 'add',
	event: 'countChange',
	previousCount: 4,
	newCount: 9,
	timestamp: { toDate: () => new Date('2026-03-04T10:00:00Z') },
	user: 'tester',
	...overrides
});

/** Pull the constraints off the query passed to a mocked Firestore call. */
const constraintsOf = (call) => call[0].constraints;

/** The `where` constraints on a query, in the order they were added. */
const wheresOf = (call) => constraintsOf(call).filter((c) => c.kind === 'where');

beforeEach(() => {
	vi.clearAllMocks();
	mocks.groupId = 'group-1';
});

describe('createSeasonHistoryFeed', () => {
	it('bounds the listener to the requested season, not the calendar year', () => {
		// A calendar year would sweep in the off-season months where test rows live
		// — including a 500,000 count typed into an item named "#1".
		showSeason({ year: 2026 });

		const bounds = wheresOf(mocks.onSnapshot.mock.calls[0]).filter((c) => c.field === 'timestamp');
		expect(bounds).toEqual([
			{
				kind: 'where',
				field: 'timestamp',
				op: '>=',
				value: { kind: 'timestamp', date: new Date(2026, 7, 15) }
			},
			{
				kind: 'where',
				field: 'timestamp',
				op: '<',
				value: { kind: 'timestamp', date: new Date(2026, 8, 16) }
			}
		]);
	});

	it('uses a half-open range, so a boundary instant belongs to one season only', () => {
		showSeason({ year: 2025 });

		const ops = wheresOf(mocks.onSnapshot.mock.calls[0])
			.filter((c) => c.field === 'timestamp')
			.map((c) => c.op);
		// '>=' paired with '<' — never '<=', which would double-count midnight.
		expect(ops).toEqual(['>=', '<']);
	});

	it('never adds a row limit, so the season is delivered whole', () => {
		// The page's stats, day counts and sort all describe the full season; a limit
		// would silently make every one of those figures a partial answer.
		showSeason({ year: 2026 });

		expect(constraintsOf(mocks.onSnapshot.mock.calls[0]).some((c) => c.kind === 'limit')).toBe(
			false
		);
	});

	it('needs no composite index when unfiltered, keying only off timestamp', () => {
		showSeason({ year: 2026 });

		const fields = new Set(constraintsOf(mocks.onSnapshot.mock.calls[0]).map((c) => c.field));
		expect([...fields]).toEqual(['timestamp']);
	});

	it('applies a stock filter in the query rather than leaving it to the caller', () => {
		showSeason({ year: 2026, filter: 'add' });

		const wheres = wheresOf(mocks.onSnapshot.mock.calls[0]);
		expect(wheres).toContainEqual({
			kind: 'where',
			field: 'event',
			op: '==',
			value: 'countChange'
		});
		expect(wheres).toContainEqual({ kind: 'where', field: 'type', op: '==', value: 'add' });
	});

	it('filters lifecycle events on event alone', () => {
		showSeason({ year: 2026, filter: 'itemDeleted' });

		const equality = wheresOf(mocks.onSnapshot.mock.calls[0]).filter((c) => c.op === '==');
		expect(equality).toEqual([{ kind: 'where', field: 'event', op: '==', value: 'itemDeleted' }]);
	});

	it('never filters on type without also pinning event', () => {
		// itemCreated rows carry type 'add', so a bare type match would show item
		// creations under "Stock added".
		showSeason({ year: 2026, filter: 'add' });

		expect(wheresOf(mocks.onSnapshot.mock.calls[0]).some((c) => c.field === 'event')).toBe(true);
	});

	it('orders equality filters before the range, matching the deployed index', () => {
		// Firestore composite indexes are field-ordered: (event, type, timestamp).
		// Emitting the range first would not match firestore.indexes.json.
		showSeason({ year: 2026, filter: 'remove' });

		expect(wheresOf(mocks.onSnapshot.mock.calls[0]).map((c) => c.field)).toEqual([
			'event',
			'type',
			'timestamp',
			'timestamp'
		]);
	});

	it('always queries newest-first, leaving "oldest" to a local reverse', () => {
		// The season arrives whole, so reversing it is exactly the ascending query,
		// and switching order costs no new read.
		const feed = showSeason({ year: 2026 });
		feed.show({ year: 2026, filter: 'add' });

		for (const call of mocks.onSnapshot.mock.calls) {
			expect(constraintsOf(call).filter((c) => c.kind === 'orderBy')).toEqual([
				{ kind: 'orderBy', field: 'timestamp', direction: 'desc' }
			]);
		}
	});

	it('normalizes snapshots into Transaction objects', () => {
		const received = [];
		showSeason({ year: 2026 }, (rows) => received.push(rows));

		const onNext = mocks.onSnapshot.mock.calls[0][1];
		onNext({ docs: [docSnap('txn-1', rawTxn())] });

		expect(received[0][0]).toEqual({
			id: 'txn-1',
			syncedAt: null,
			historicalTransfer: false,
			historicalTransferReviewId: null,
			itemId: 'item-1',
			itemName: 'Funnel Cake Mix',
			type: 'add',
			event: 'countChange',
			previousCount: 4,
			newCount: 9,
			timestamp: new Date('2026-03-04T10:00:00Z'),
			user: 'tester'
		});
	});

	it('falls back to now for an offline write whose serverTimestamp is still null', () => {
		const received = [];
		showSeason({ year: 2026 }, (rows) => received.push(rows));

		const onNext = mocks.onSnapshot.mock.calls[0][1];
		onNext({ docs: [docSnap('txn-1', rawTxn({ timestamp: null }))] });

		expect(received[0][0].timestamp).toBeInstanceOf(Date);
	});

	it('reports subscription errors to the caller', () => {
		// The page tells a still-building index apart from a real failure, so the
		// error object has to reach it rather than being swallowed here.
		const onError = vi.fn();
		showSeason({ year: 2026 }, () => {}, onError);

		const failure = { code: 'failed-precondition' };
		mocks.onSnapshot.mock.calls[0][2](failure);

		expect(onError).toHaveBeenCalledWith(failure);
	});

	it('keeps the review listener when the season or filter changes', () => {
		const stopRows = vi.fn();
		mocks.onSnapshot.mockReturnValueOnce(stopRows);
		const feed = showSeason({ year: 2026 });
		feed.show({ year: 2025, filter: 'add' });

		expect(subscribeStockHistoryReviews).toHaveBeenCalledTimes(1);
		expect(mocks.onSnapshot).toHaveBeenCalledTimes(2);
		expect(stopRows).toHaveBeenCalledTimes(1);
	});

	it('ignores a late snapshot from a replaced query', () => {
		const received = [];
		const feed = showSeason({ year: 2026 }, (rows) => received.push(rows));
		const replaced = mocks.onSnapshot.mock.calls[0][1];
		feed.show({ year: 2025 });

		replaced({ docs: [docSnap('old', rawTxn())] });
		expect(received).toEqual([]);
		mocks.onSnapshot.mock.calls[1][1]({ docs: [docSnap('new', rawTxn())] });
		expect(received.map((rows) => rows.map((row) => row.id))).toEqual([['new']]);
	});

	it('holds rows while reviews are missing and restarts a failed review listener on the next show', () => {
		// Rows without their reviews would show confirmed transfers as ordinary
		// movements, so a review failure is surfaced, never treated as no reviews.
		let failReviews;
		subscribeStockHistoryReviews.mockImplementationOnce((_group, _onData, onReviewError) => {
			failReviews = onReviewError;
			return () => {};
		});
		const onError = vi.fn();
		const received = [];
		const feed = showSeason({ year: 2026 }, (rows) => received.push(rows), onError);
		failReviews({ code: 'unavailable' });
		mocks.onSnapshot.mock.calls[0][1]({ docs: [docSnap('txn-1', rawTxn())] });

		expect(onError).toHaveBeenCalledWith({ code: 'unavailable' });
		expect(received).toEqual([]);

		feed.show({ year: 2026 });
		mocks.onSnapshot.mock.calls[1][1]({ docs: [docSnap('txn-1', rawTxn())] });
		expect(subscribeStockHistoryReviews).toHaveBeenCalledTimes(2);
		expect(received).toHaveLength(1);
	});

	it('reads the active group on every show, so another workspace gets its own reviews', () => {
		const stopOldReviews = vi.fn();
		subscribeStockHistoryReviews.mockImplementationOnce((_group, onData) => {
			onData([]);
			return stopOldReviews;
		});
		const feed = showSeason({ year: 2026 });
		mocks.groupId = 'group-2';
		feed.show({ year: 2026 });

		expect(stopOldReviews).toHaveBeenCalledTimes(1);
		expect(subscribeStockHistoryReviews.mock.calls.map(([group]) => group)).toEqual([
			'group-1',
			'group-2'
		]);
		expect(mocks.onSnapshot.mock.calls[1][0].ref.path).toBe('groups/group-2/transactions');
	});

	it('closes both listeners on stop', () => {
		const stopRows = vi.fn();
		const stopReviews = vi.fn();
		mocks.onSnapshot.mockReturnValueOnce(stopRows);
		subscribeStockHistoryReviews.mockImplementationOnce((_group, onData) => {
			onData([]);
			return stopReviews;
		});
		showSeason({ year: 2026 }).stop();

		expect(stopRows).toHaveBeenCalledTimes(1);
		expect(stopReviews).toHaveBeenCalledTimes(1);
	});
});

describe('getEarliestTransactionYear', () => {
	it('reads a single oldest row rather than scanning the ledger', async () => {
		mocks.getDocs.mockResolvedValue({
			empty: false,
			docs: [docSnap('txn-1', rawTxn({ timestamp: { toDate: () => new Date(2022, 7, 5) } }))]
		});

		await expect(getEarliestTransactionYear()).resolves.toBe(2022);

		const constraints = constraintsOf(mocks.getDocs.mock.calls[0]);
		expect(constraints).toContainEqual({ kind: 'orderBy', field: 'timestamp', direction: 'asc' });
		expect(constraints).toContainEqual({ kind: 'limit', count: 1 });
	});

	it('returns null for an empty ledger, so the picker falls back to this year', async () => {
		mocks.getDocs.mockResolvedValue({ empty: true, docs: [] });

		await expect(getEarliestTransactionYear()).resolves.toBeNull();
	});

	it('propagates failure so the caller can fall back', async () => {
		mocks.getDocs.mockRejectedValue(new Error('offline'));

		await expect(getEarliestTransactionYear()).rejects.toThrow('offline');
	});
});

describe('createSeasonHistoryFeed transfer filter', () => {
	it('includes reviewed historical transfers and drops unrelated rows', () => {
		subscribeStockHistoryReviews.mockImplementationOnce((_group, callback) => {
			callback([{ id: 'review', confirmed: true, transactionIds: ['r', 'a'] }]);
			return () => {};
		});
		const received = [];
		showSeason(
			{
				year: 2026,
				filter: 'stockTransfer'
			},
			(rows) => received.push(rows)
		);
		expect(wheresOf(mocks.onSnapshot.mock.calls[0]).filter((c) => c.op === '==')).toEqual([]);
		mocks.onSnapshot.mock.calls[0][1]({
			docs: [
				docSnap('r', rawTxn({ type: 'remove' })),
				docSnap('a', rawTxn()),
				docSnap('other', rawTxn()),
				docSnap('moved', rawTxn({ event: 'stockTransfer', type: 'transfer' }))
			]
		});
		expect(received[0].map((row) => row.id)).toEqual(['r', 'a', 'moved']);
	});
});
