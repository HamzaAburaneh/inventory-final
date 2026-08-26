import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Firestore so we can assert the SHAPE of the queries this module builds —
// specifically that the realtime listener is bounded (an unbounded one streams
// the group's entire ledger on every page load) while the escalation path is not.
const mocks = vi.hoisted(() => ({
	onSnapshot: vi.fn(),
	getDocs: vi.fn(),
	getCountFromServer: vi.fn()
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
	getCountFromServer: mocks.getCountFromServer,
	Timestamp: { fromDate: vi.fn((date) => ({ kind: 'timestamp', date })) }
}));

import {
	subscribeToTransactions,
	getAllTransactions,
	getTransactionCount,
	RECENT_WINDOW_SIZE
} from './transactions';

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

beforeEach(() => {
	vi.clearAllMocks();
});

describe('subscribeToTransactions', () => {
	it('bounds the listener to the newest RECENT_WINDOW_SIZE records by default', () => {
		subscribeToTransactions(() => {});

		const constraints = constraintsOf(mocks.onSnapshot.mock.calls[0]);
		expect(constraints).toContainEqual({ kind: 'orderBy', field: 'timestamp', direction: 'desc' });
		expect(constraints).toContainEqual({ kind: 'limit', count: RECENT_WINDOW_SIZE });
	});

	it('honours an explicit limit', () => {
		subscribeToTransactions(() => {}, undefined, { limit: 25 });

		expect(constraintsOf(mocks.onSnapshot.mock.calls[0])).toContainEqual({
			kind: 'limit',
			count: 25
		});
	});

	it('supports an unbounded listener via limit: null', () => {
		subscribeToTransactions(() => {}, undefined, { limit: null });

		const constraints = constraintsOf(mocks.onSnapshot.mock.calls[0]);
		expect(constraints.some((c) => c.kind === 'limit')).toBe(false);
	});

	it('orders by timestamp only, so no composite index is required', () => {
		// A `where` on another field alongside this orderBy would need a composite
		// index deployed before the query could run at all.
		subscribeToTransactions(() => {});

		const constraints = constraintsOf(mocks.onSnapshot.mock.calls[0]);
		expect(constraints.some((c) => c.kind === 'where')).toBe(false);
		expect(constraints.filter((c) => c.kind === 'orderBy')).toEqual([
			{ kind: 'orderBy', field: 'timestamp', direction: 'desc' }
		]);
	});

	it('normalizes snapshots into Transaction objects', () => {
		const received = [];
		subscribeToTransactions((transactions) => received.push(transactions));

		const handler = mocks.onSnapshot.mock.calls[0][1];
		handler({ docs: [docSnap('t1', rawTxn())] });

		expect(received[0]).toEqual([
			{
				id: 't1',
				itemId: 'item-1',
				itemName: 'Funnel Cake Mix',
				type: 'add',
				event: 'countChange',
				previousCount: 4,
				newCount: 9,
				timestamp: new Date('2026-03-04T10:00:00Z'),
				user: 'tester'
			}
		]);
	});

	it('falls back to now for an offline write whose serverTimestamp is still null', () => {
		const received = [];
		subscribeToTransactions((transactions) => received.push(transactions));

		const handler = mocks.onSnapshot.mock.calls[0][1];
		handler({ docs: [docSnap('t1', rawTxn({ timestamp: null }))] });

		expect(received[0][0].timestamp).toBeInstanceOf(Date);
	});

	it('reports subscription errors to the caller', () => {
		const onError = vi.fn();
		subscribeToTransactions(() => {}, onError);

		mocks.onSnapshot.mock.calls[0][2](new Error('permission denied'));

		expect(onError).toHaveBeenCalled();
	});
});

describe('getAllTransactions', () => {
	it('reads the whole ledger with no limit', async () => {
		mocks.getDocs.mockResolvedValue({ docs: [] });

		await getAllTransactions();

		const constraints = constraintsOf(mocks.getDocs.mock.calls[0]);
		expect(constraints).toContainEqual({ kind: 'orderBy', field: 'timestamp', direction: 'desc' });
		expect(constraints.some((c) => c.kind === 'limit')).toBe(false);
	});

	it('returns transactions in the same shape as the listener, so they can be merged', async () => {
		mocks.getDocs.mockResolvedValue({ docs: [docSnap('t9', rawTxn())] });

		const [transaction] = await getAllTransactions();

		expect(transaction).toEqual({
			id: 't9',
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
});

describe('getTransactionCount', () => {
	it('counts server-side without reading any documents', async () => {
		mocks.getCountFromServer.mockResolvedValue({ data: () => ({ count: 6314 }) });

		await expect(getTransactionCount()).resolves.toBe(6314);

		// The whole point: the bounded header can say "250 of 6,314" for the price of
		// an aggregation instead of 6,314 document reads.
		expect(mocks.getDocs).not.toHaveBeenCalled();
		expect(mocks.getCountFromServer).toHaveBeenCalledTimes(1);
	});

	it('counts the collection itself, unfiltered and unordered', async () => {
		mocks.getCountFromServer.mockResolvedValue({ data: () => ({ count: 0 }) });

		await getTransactionCount();

		// Passed the raw collection ref, not a query — no constraints to index.
		expect(mocks.getCountFromServer.mock.calls[0][0]).toEqual({
			kind: 'collection',
			path: 'groups/group-1/transactions'
		});
	});

	it('propagates failure so the caller can fall back (aggregations need a server)', async () => {
		mocks.getCountFromServer.mockRejectedValue(new Error('offline'));

		await expect(getTransactionCount()).rejects.toThrow('offline');
	});
});
