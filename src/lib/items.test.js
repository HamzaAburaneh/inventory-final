import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Firestore so we can assert that every count mutation pairs the count
// write with its ledger record inside the SAME transaction/batch (goal #1:
// a count change must never commit without its matching Transaction record).
const mocks = vi.hoisted(() => ({
	runTransaction: vi.fn(),
	writeBatch: vi.fn(),
	getDocs: vi.fn(),
	getDocFromCache: vi.fn(),
	updateDoc: vi.fn()
}));

vi.mock('../firebase', () => ({ db: {} }));

vi.mock('firebase/firestore', () => ({
	collection: vi.fn((_db, name) => ({ kind: 'collection', name })),
	doc: vi.fn((first, name, id) =>
		first && first.kind === 'collection'
			? { kind: 'doc', collection: first.name, id: 'auto-id' }
			: { kind: 'doc', collection: name, id }
	),
	getDocFromCache: mocks.getDocFromCache,
	getDocs: mocks.getDocs,
	onSnapshot: vi.fn(),
	query: vi.fn((...args) => args),
	runTransaction: mocks.runTransaction,
	serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
	Timestamp: { now: vi.fn(() => 'CLIENT_TIMESTAMP') },
	updateDoc: mocks.updateDoc,
	where: vi.fn(),
	writeBatch: mocks.writeBatch
}));

import {
	adjustItemCount,
	setItemCount,
	resetAllItemCounts,
	addItemWithTransaction,
	deleteItemWithTransaction,
	updateItemFields
} from './items';

function fakeTxn(itemData) {
	return {
		get: vi.fn(async () => ({
			exists: () => itemData != null,
			data: () => itemData
		})),
		update: vi.fn(),
		set: vi.fn(),
		delete: vi.fn()
	};
}

function fakeBatch() {
	return { set: vi.fn(), update: vi.fn(), delete: vi.fn(), commit: vi.fn(async () => {}) };
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe('adjustItemCount', () => {
	it('writes the count change and its ledger record in one transaction', async () => {
		const txn = fakeTxn({ name: 'Fries', count: 10 });
		mocks.runTransaction.mockImplementation(async (_db, fn) => fn(txn));

		const result = await adjustItemCount('item1', -4, 'hamza@example.com');

		expect(result).toEqual({ previousCount: 10, newCount: 6 });
		expect(txn.update).toHaveBeenCalledWith(
			expect.objectContaining({ collection: 'items', id: 'item1' }),
			{ count: 6 }
		);
		expect(txn.set).toHaveBeenCalledTimes(1);
		expect(txn.set.mock.calls[0][1]).toMatchObject({
			itemId: 'item1',
			itemName: 'Fries',
			type: 'remove',
			previousCount: 10,
			newCount: 6,
			user: 'hamza@example.com',
			timestamp: 'SERVER_TIMESTAMP',
			// Audit field present on every record; online it equals the timestamp.
			syncedAt: 'SERVER_TIMESTAMP'
		});
	});

	it('clamps the new count at zero and records the clamped value', async () => {
		const txn = fakeTxn({ name: 'Fries', count: 10 });
		mocks.runTransaction.mockImplementation(async (_db, fn) => fn(txn));

		const result = await adjustItemCount('item1', -50, 'user');

		expect(result).toEqual({ previousCount: 10, newCount: 0 });
		expect(txn.set.mock.calls[0][1]).toMatchObject({
			type: 'remove',
			previousCount: 10,
			newCount: 0
		});
	});

	it('writes nothing for a no-op change (no phantom ledger records)', async () => {
		const txn = fakeTxn({ name: 'Fries', count: 0 });
		mocks.runTransaction.mockImplementation(async (_db, fn) => fn(txn));

		const result = await adjustItemCount('item1', -5, 'user');

		expect(result).toEqual({ previousCount: 0, newCount: 0 });
		expect(txn.update).not.toHaveBeenCalled();
		expect(txn.set).not.toHaveBeenCalled();
	});

	it('throws when the item does not exist', async () => {
		const txn = fakeTxn(null);
		mocks.runTransaction.mockImplementation(async (_db, fn) => fn(txn));

		await expect(adjustItemCount('missing', 3, 'user')).rejects.toThrow('Item not found');
	});
});

describe('setItemCount', () => {
	it('resets to zero with a matching remove record', async () => {
		const txn = fakeTxn({ name: 'Buns', count: 7 });
		mocks.runTransaction.mockImplementation(async (_db, fn) => fn(txn));

		const result = await setItemCount('item2', 0, 'user');

		expect(result).toEqual({ previousCount: 7, newCount: 0 });
		expect(txn.update).toHaveBeenCalledWith(expect.objectContaining({ id: 'item2' }), {
			count: 0
		});
		expect(txn.set.mock.calls[0][1]).toMatchObject({
			type: 'remove',
			previousCount: 7,
			newCount: 0
		});
	});

	it('writes nothing when the count is already at the target', async () => {
		const txn = fakeTxn({ name: 'Buns', count: 0 });
		mocks.runTransaction.mockImplementation(async (_db, fn) => fn(txn));

		await setItemCount('item2', 0, 'user');

		expect(txn.update).not.toHaveBeenCalled();
		expect(txn.set).not.toHaveBeenCalled();
	});
});

describe('resetAllItemCounts', () => {
	it('pairs each count reset with its ledger record and skips zero-count items', async () => {
		mocks.getDocs.mockResolvedValue({
			docs: [
				{ id: 'a', ref: 'refA', data: () => ({ name: 'A', count: 5 }) },
				{ id: 'b', ref: 'refB', data: () => ({ name: 'B', count: 0 }) }
			]
		});
		const batch = fakeBatch();
		mocks.writeBatch.mockReturnValue(batch);

		const resetCount = await resetAllItemCounts('user');

		expect(resetCount).toBe(1);
		expect(batch.update).toHaveBeenCalledTimes(1);
		expect(batch.update).toHaveBeenCalledWith('refA', { count: 0 });
		expect(batch.set).toHaveBeenCalledTimes(1);
		expect(batch.set.mock.calls[0][1]).toMatchObject({
			itemId: 'a',
			itemName: 'A',
			type: 'remove',
			previousCount: 5,
			newCount: 0
		});
		expect(batch.commit).toHaveBeenCalledTimes(1);
	});

	it('commits no batch when every count is already zero', async () => {
		mocks.getDocs.mockResolvedValue({
			docs: [{ id: 'a', ref: 'refA', data: () => ({ name: 'A', count: 0 }) }]
		});

		const resetCount = await resetAllItemCounts('user');

		expect(resetCount).toBe(0);
		expect(mocks.writeBatch).not.toHaveBeenCalled();
	});
});

describe('addItemWithTransaction', () => {
	it('rejects duplicate names before writing anything', async () => {
		mocks.getDocs.mockResolvedValue({ empty: false });

		await expect(addItemWithTransaction({ name: 'Fries', count: 3 }, 'user')).rejects.toThrow(
			'Item with this name already exists.'
		);
		expect(mocks.writeBatch).not.toHaveBeenCalled();
	});

	it('writes the item and its initial add record in one batch', async () => {
		mocks.getDocs.mockResolvedValue({ empty: true });
		const batch = fakeBatch();
		mocks.writeBatch.mockReturnValue(batch);

		const item = { name: 'Fries', count: 3, lowCount: 1, cost: 2.5 };
		const added = await addItemWithTransaction(item, 'user');

		expect(added).toEqual({ id: 'auto-id', ...item });
		expect(batch.set).toHaveBeenCalledTimes(2);
		expect(batch.set.mock.calls[0][1]).toEqual(item);
		expect(batch.set.mock.calls[1][1]).toMatchObject({
			itemId: 'auto-id',
			itemName: 'Fries',
			type: 'add',
			previousCount: 0,
			newCount: 3,
			user: 'user'
		});
		expect(batch.commit).toHaveBeenCalledTimes(1);
	});
});

describe('deleteItemWithTransaction', () => {
	it('writes the final remove record and the delete in one transaction', async () => {
		const txn = fakeTxn({ name: 'Fries', count: 7 });
		mocks.runTransaction.mockImplementation(async (_db, fn) => fn(txn));

		await deleteItemWithTransaction('item1', 'user');

		expect(txn.set.mock.calls[0][1]).toMatchObject({
			itemId: 'item1',
			type: 'remove',
			previousCount: 7,
			newCount: 0
		});
		expect(txn.delete).toHaveBeenCalledWith(
			expect.objectContaining({ collection: 'items', id: 'item1' })
		);
	});

	it('does nothing when the item is already gone', async () => {
		const txn = fakeTxn(null);
		mocks.runTransaction.mockImplementation(async (_db, fn) => fn(txn));

		await deleteItemWithTransaction('missing', 'user');

		expect(txn.set).not.toHaveBeenCalled();
		expect(txn.delete).not.toHaveBeenCalled();
	});
});

describe('offline mode', () => {
	function goOffline() {
		vi.stubGlobal('navigator', { onLine: false });
	}

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('queues the count change and its ledger record in one batch from the cached count', async () => {
		goOffline();
		mocks.getDocFromCache.mockResolvedValue({
			exists: () => true,
			data: () => ({ name: 'Fries', count: 10 })
		});
		const batch = fakeBatch();
		// Simulate a queued commit that will not resolve until reconnect —
		// the adjust call must still resolve immediately.
		batch.commit = vi.fn(() => new Promise(() => {}));
		mocks.writeBatch.mockReturnValue(batch);

		const result = await adjustItemCount('item1', -4, 'user');

		expect(result).toEqual({ previousCount: 10, newCount: 6 });
		expect(mocks.runTransaction).not.toHaveBeenCalled();
		expect(batch.update).toHaveBeenCalledWith(
			expect.objectContaining({ collection: 'items', id: 'item1' }),
			{ count: 6 }
		);
		expect(batch.set).toHaveBeenCalledTimes(1);
		expect(batch.set.mock.calls[0][1]).toMatchObject({
			itemId: 'item1',
			type: 'remove',
			previousCount: 10,
			newCount: 6,
			// Offline records carry the device time on `timestamp`, but `syncedAt`
			// is still a server timestamp — so a wrong device clock is auditable
			// (its timestamp lands far from syncedAt).
			timestamp: 'CLIENT_TIMESTAMP',
			syncedAt: 'SERVER_TIMESTAMP'
		});
	});

	it('setItemCount also uses the queued path offline', async () => {
		goOffline();
		mocks.getDocFromCache.mockResolvedValue({
			exists: () => true,
			data: () => ({ name: 'Buns', count: 7 })
		});
		const batch = fakeBatch();
		batch.commit = vi.fn(() => new Promise(() => {}));
		mocks.writeBatch.mockReturnValue(batch);

		const result = await setItemCount('item2', 0, 'user');

		expect(result).toEqual({ previousCount: 7, newCount: 0 });
		expect(mocks.runTransaction).not.toHaveBeenCalled();
		expect(batch.update).toHaveBeenCalledWith(expect.objectContaining({ id: 'item2' }), {
			count: 0
		});
		expect(batch.set).toHaveBeenCalledTimes(1);
	});

	it('throws a friendly error when the item is not in the offline cache', async () => {
		goOffline();
		mocks.getDocFromCache.mockRejectedValue(new Error('unavailable'));

		await expect(adjustItemCount('item1', 1, 'user')).rejects.toThrow('open it once while online');
	});

	it('deletes via a queued batch pairing the final remove record', async () => {
		goOffline();
		mocks.getDocFromCache.mockResolvedValue({
			exists: () => true,
			data: () => ({ name: 'Fries', count: 7 })
		});
		const batch = fakeBatch();
		batch.commit = vi.fn(() => new Promise(() => {}));
		mocks.writeBatch.mockReturnValue(batch);

		await deleteItemWithTransaction('item1', 'user');

		expect(mocks.runTransaction).not.toHaveBeenCalled();
		expect(batch.set.mock.calls[0][1]).toMatchObject({
			type: 'remove',
			previousCount: 7,
			newCount: 0
		});
		expect(batch.delete).toHaveBeenCalledWith(
			expect.objectContaining({ collection: 'items', id: 'item1' })
		);
	});
});

describe('offline fallback when navigator.onLine lies (iOS PWA in airplane mode)', () => {
	// navigator.onLine is undefined in the test env → the online path runs; we
	// make runTransaction fail as "unavailable" to simulate a device that claims
	// to be online but has no connection.
	function unavailable() {
		return Object.assign(new Error('Failed to get document because the client is offline.'), {
			code: 'unavailable'
		});
	}

	it('adjustItemCount falls back to a queued batch', async () => {
		mocks.runTransaction.mockRejectedValue(unavailable());
		mocks.getDocFromCache.mockResolvedValue({
			exists: () => true,
			data: () => ({ name: 'Fries', count: 10 })
		});
		const batch = fakeBatch();
		batch.commit = vi.fn(() => new Promise(() => {}));
		mocks.writeBatch.mockReturnValue(batch);

		const result = await adjustItemCount('item1', 5, 'user');

		expect(result).toEqual({ previousCount: 10, newCount: 15 });
		expect(batch.update).toHaveBeenCalledWith(expect.objectContaining({ id: 'item1' }), {
			count: 15
		});
		expect(batch.set.mock.calls[0][1]).toMatchObject({
			type: 'add',
			previousCount: 10,
			newCount: 15,
			timestamp: 'CLIENT_TIMESTAMP'
		});
	});

	it('deleteItemWithTransaction falls back to a queued batch', async () => {
		mocks.runTransaction.mockRejectedValue(unavailable());
		mocks.getDocFromCache.mockResolvedValue({
			exists: () => true,
			data: () => ({ name: 'Fries', count: 7 })
		});
		const batch = fakeBatch();
		batch.commit = vi.fn(() => new Promise(() => {}));
		mocks.writeBatch.mockReturnValue(batch);

		await deleteItemWithTransaction('item1', 'user');

		expect(batch.delete).toHaveBeenCalledWith(expect.objectContaining({ id: 'item1' }));
		expect(batch.set.mock.calls[0][1]).toMatchObject({ type: 'remove', previousCount: 7 });
	});

	it('re-throws non-connectivity errors instead of queuing', async () => {
		mocks.runTransaction.mockRejectedValue(new Error('permission-denied'));

		await expect(adjustItemCount('item1', 5, 'user')).rejects.toThrow('permission-denied');
		expect(mocks.writeBatch).not.toHaveBeenCalled();
	});
});

describe('updateItemFields', () => {
	it('refuses direct count edits (they would bypass the ledger)', async () => {
		await expect(updateItemFields('item1', { count: 12 })).rejects.toThrow(/transaction record/);
		expect(mocks.updateDoc).not.toHaveBeenCalled();
	});

	it('updates non-count fields normally', async () => {
		await updateItemFields('item1', { cost: 4.2, name: 'Fries XL' });

		expect(mocks.updateDoc).toHaveBeenCalledWith(
			expect.objectContaining({ collection: 'items', id: 'item1' }),
			{ cost: 4.2, name: 'Fries XL' }
		);
	});
});
