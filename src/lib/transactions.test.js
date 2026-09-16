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
	getDocs: vi.fn()
}));

vi.mock('../firebase', () => ({ db: {} }));
vi.mock('./activeGroup', () => ({ requireActiveGroupId: () => 'group-1' }));

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

import { subscribeToTransactions, getEarliestTransactionYear } from './transactions';

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
});

describe('subscribeToTransactions', () => {
	it('bounds the listener to the requested season, not the calendar year', () => {
		// A calendar year would sweep in the off-season months where test rows live
		// — including a 500,000 count typed into an item named "#1".
		subscribeToTransactions(() => {}, undefined, { year: 2026 });

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
		subscribeToTransactions(() => {}, undefined, { year: 2025 });

		const ops = wheresOf(mocks.onSnapshot.mock.calls[0])
			.filter((c) => c.field === 'timestamp')
			.map((c) => c.op);
		// '>=' paired with '<' — never '<=', which would double-count midnight.
		expect(ops).toEqual(['>=', '<']);
	});

	it('never adds a row limit, so the season is delivered whole', () => {
		// The page's stats, day counts and sort all describe the full season; a limit
		// would silently make every one of those figures a partial answer.
		subscribeToTransactions(() => {}, undefined, { year: 2026 });

		expect(constraintsOf(mocks.onSnapshot.mock.calls[0]).some((c) => c.kind === 'limit')).toBe(
			false
		);
	});

	it('needs no composite index when unfiltered, keying only off timestamp', () => {
		subscribeToTransactions(() => {}, undefined, { year: 2026 });

		const fields = new Set(constraintsOf(mocks.onSnapshot.mock.calls[0]).map((c) => c.field));
		expect([...fields]).toEqual(['timestamp']);
	});

	it('applies a stock filter in the query rather than leaving it to the caller', () => {
		subscribeToTransactions(() => {}, undefined, { year: 2026, filter: 'add' });

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
		subscribeToTransactions(() => {}, undefined, { year: 2026, filter: 'itemDeleted' });

		const equality = wheresOf(mocks.onSnapshot.mock.calls[0]).filter((c) => c.op === '==');
		expect(equality).toEqual([{ kind: 'where', field: 'event', op: '==', value: 'itemDeleted' }]);
	});

	it('never filters on type without also pinning event', () => {
		// itemCreated rows carry type 'add', so a bare type match would show item
		// creations under "Stock added".
		subscribeToTransactions(() => {}, undefined, { year: 2026, filter: 'add' });

		expect(wheresOf(mocks.onSnapshot.mock.calls[0]).some((c) => c.field === 'event')).toBe(true);
	});

	it('orders equality filters before the range, matching the deployed index', () => {
		// Firestore composite indexes are field-ordered: (event, type, timestamp).
		// Emitting the range first would not match firestore.indexes.json.
		subscribeToTransactions(() => {}, undefined, { year: 2026, filter: 'remove' });

		expect(wheresOf(mocks.onSnapshot.mock.calls[0]).map((c) => c.field)).toEqual([
			'event',
			'type',
			'timestamp',
			'timestamp'
		]);
	});

	it('defaults to newest-first', () => {
		subscribeToTransactions(() => {}, undefined, { year: 2026 });

		expect(constraintsOf(mocks.onSnapshot.mock.calls[0])).toContainEqual({
			kind: 'orderBy',
			field: 'timestamp',
			direction: 'desc'
		});
	});

	it('reverses the order in the query, so "oldest" means oldest in the season', () => {
		subscribeToTransactions(() => {}, undefined, { year: 2026, sortNewest: false });

		expect(constraintsOf(mocks.onSnapshot.mock.calls[0])).toContainEqual({
			kind: 'orderBy',
			field: 'timestamp',
			direction: 'asc'
		});
	});

	it('normalizes snapshots into Transaction objects', () => {
		const received = [];
		subscribeToTransactions((rows) => received.push(rows), undefined, { year: 2026 });

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
		subscribeToTransactions((rows) => received.push(rows), undefined, { year: 2026 });

		const onNext = mocks.onSnapshot.mock.calls[0][1];
		onNext({ docs: [docSnap('txn-1', rawTxn({ timestamp: null }))] });

		expect(received[0][0].timestamp).toBeInstanceOf(Date);
	});

	it('reports subscription errors to the caller', () => {
		// The page tells a still-building index apart from a real failure, so the
		// error object has to reach it rather than being swallowed here.
		const onError = vi.fn();
		subscribeToTransactions(() => {}, onError, { year: 2026 });

		const failure = { code: 'failed-precondition' };
		mocks.onSnapshot.mock.calls[0][2](failure);

		expect(onError).toHaveBeenCalledWith(failure);
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
