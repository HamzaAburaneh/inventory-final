import { describe, it, expect, vi, beforeEach } from 'vitest';
const mocks = vi.hoisted(() => ({
	enqueue: vi.fn(async (action) => ({ status: 'queued', ...action })),
	getDocs: vi.fn(),
	updateDoc: vi.fn()
}));
vi.mock('../firebase', () => ({ db: {} }));
vi.mock('./stockActionQueue', () => ({
	enqueueStockAction: mocks.enqueue,
	getPendingStockActions: async () => []
}));
vi.mock('firebase/firestore', () => ({
	collection: (_db, ...path) => ({ path: path.join('/') }),
	doc: (...args) => ({ id: 'new-id', path: args.filter((x) => typeof x === 'string').join('/') }),
	getDocs: mocks.getDocs,
	updateDoc: mocks.updateDoc,
	onSnapshot: vi.fn()
}));
import {
	adjustItemCount,
	setItemCount,
	transferItemStock,
	addItemWithTransaction,
	deleteItemWithTransaction,
	resetAllItemCounts,
	updateItemFields
} from './items';
import { setActiveGroupId } from './activeGroup';
beforeEach(() => {
	vi.clearAllMocks();
	setActiveGroupId('test-group');
	mocks.getDocs.mockResolvedValue({ docs: [] });
});
describe('stock mutation entry points', () => {
	it('passes deltas and explicit location to durable queue without an absolute stock write', async () => {
		await adjustItemCount('fries', 5, 'user', 'Freezer');
		expect(mocks.enqueue).toHaveBeenCalledWith({
			itemId: 'fries',
			kind: 'adjust',
			delta: 5,
			user: 'user',
			location: 'Freezer'
		});
		expect(mocks.updateDoc).not.toHaveBeenCalled();
	});
	it('does not truncate malformed quantities', async () => {
		await expect(adjustItemCount('fries', '5x', 'user', 'Freezer')).rejects.toThrow();
		expect(mocks.enqueue).not.toHaveBeenCalled();
	});
	it('distinguishes location set from whole-item reset', async () => {
		await setItemCount('fries', 3, 'user', 'Refrigerator');
		expect(mocks.enqueue.mock.calls[0][0]).toMatchObject({
			kind: 'set',
			quantity: 3,
			location: 'Refrigerator'
		});
		await setItemCount('fries', 0, 'user');
		expect(mocks.enqueue.mock.calls[1][0]).toMatchObject({ kind: 'reset', quantity: 0 });
		await expect(setItemCount('fries', 4, 'user')).rejects.toThrow('Choose a location');
	});
	it('uses the durable path for transfers and deletion too', async () => {
		await transferItemStock('fries', 'Freezer', 'Refrigerator', 2, 'user');
		await deleteItemWithTransaction('fries', 'user');
		expect(mocks.enqueue.mock.calls.map(([a]) => a.kind)).toEqual(['transfer', 'delete']);
	});
	it('creates opening split stock with a derived matching total', async () => {
		await addItemWithTransaction(
			{
				name: 'Fries',
				count: 5,
				storageType: 'Freezer',
				stockByStorage: { Freezer: 3, Refrigerator: 2 }
			},
			'user'
		);
		expect(mocks.enqueue.mock.calls[0][0]).toMatchObject({
			kind: 'create',
			item: { count: 5, stockByStorage: { Freezer: 3, Refrigerator: 2, 'Dry Storage': 0 } }
		});
	});
	it('refuses duplicate names and invalid opening stock', async () => {
		mocks.getDocs.mockResolvedValue({ docs: [{ id: 'old', data: () => ({ name: 'Fries' }) }] });
		await expect(
			addItemWithTransaction({ name: 'fries', count: 0, storageType: 'Freezer' }, 'user')
		).rejects.toThrow('already exists');
		await expect(
			addItemWithTransaction({ name: 'New', count: 5, stockByStorage: { Freezer: 2 } }, 'user')
		).rejects.toThrow('disagree');
		expect(mocks.enqueue).not.toHaveBeenCalled();
	});
	it('reports per-item reset failures and leaves zero items alone', async () => {
		mocks.getDocs.mockResolvedValue({
			docs: [
				{ id: 'one', data: () => ({ name: 'One', count: 2 }) },
				{ id: 'empty', data: () => ({ name: 'Empty', count: 0 }) },
				{ id: 'invalid', data: () => ({ name: 'Invalid', count: -1 }) }
			]
		});
		const outcome = await resetAllItemCounts('user');
		expect(outcome.status).toBe('attention');
		expect(outcome.results).toHaveLength(2);
		expect(mocks.enqueue).toHaveBeenCalledTimes(1);
	});
	it.each(['count', 'stockByStorage', 'storageType', 'stockRevision', 'legacyItemIds', 'unknown'])(
		'blocks direct %s edits',
		async (field) => {
			await expect(updateItemFields('fries', { [field]: 1 })).rejects.toThrow(
				'dedicated inventory'
			);
			expect(mocks.updateDoc).not.toHaveBeenCalled();
		}
	);
	it('keeps ordinary metadata editing', async () => {
		await updateItemFields('fries', { name: 'New fries' });
		expect(mocks.updateDoc).toHaveBeenCalledWith(
			expect.objectContaining({ path: 'groups/test-group/items/fries' }),
			{ name: 'New fries' }
		);
	});
});
