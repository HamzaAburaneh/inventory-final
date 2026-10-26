import { it, expect, vi } from 'vitest';
import { get } from 'svelte/store';
const mocks = vi.hoisted(() => ({
	subscribe: vi.fn(() => vi.fn()),
	adjust: vi.fn(async () => ({ status: 'queued' }))
}));
vi.mock('./authStore', async () => ({
	authStore: (await import('svelte/store')).writable({ uid: 'one', email: 'one@example.test' })
}));
vi.mock('./groupStore', async () => ({
	groupStore: (await import('svelte/store')).writable({ groupId: 'group-one' })
}));
vi.mock('../lib/items', () => ({
	subscribeToItems: mocks.subscribe,
	adjustItemCount: mocks.adjust,
	addItemWithTransaction: vi.fn(),
	deleteItemWithTransaction: vi.fn(),
	setItemCount: vi.fn(),
	resetAllItemCounts: vi.fn(),
	updateItemFields: vi.fn(),
	transferItemStock: vi.fn()
}));
import { itemStore } from './itemStore';
import { authStore } from './authStore';
import { groupStore } from './groupStore';

it('preserves confirmed map/total and input state across snapshots without double-applying queued deltas', async () => {
	await itemStore.loadItems();
	const snapshot = mocks.subscribe.mock.calls.at(-1)[0];
	snapshot([
		{ id: 'fries', count: 10, stockByStorage: { Freezer: 10, Refrigerator: 0, 'Dry Storage': 0 } }
	]);
	itemStore.setChangeAmount('fries', 5);
	await itemStore.changeCount('fries', 5, 'Freezer');
	expect(get(itemStore)[0].count).toBe(10);
	snapshot([
		{ id: 'fries', count: 15, stockByStorage: { Freezer: 15, Refrigerator: 0, 'Dry Storage': 0 } }
	]);
	expect(get(itemStore)[0]).toMatchObject({
		count: 15,
		changeAmount: 5,
		stockByStorage: { Freezer: 15 }
	});
});

it('clears data on account/group changes and ignores delayed callbacks from the old scope', async () => {
	await itemStore.loadItems();
	const oldCallback = mocks.subscribe.mock.calls.at(-1)[0];
	oldCallback([{ id: 'private', count: 2 }]);
	authStore.set({ uid: 'two' });
	expect(get(itemStore)).toEqual([]);
	oldCallback([{ id: 'private', count: 3 }]);
	expect(get(itemStore)).toEqual([]);
	groupStore.set({ groupId: 'group-two' });
	expect(get(itemStore)).toEqual([]);
});

it('reuses the running listener instead of clearing the list and reading the catalog again', async () => {
	authStore.set({ uid: 'three' });
	await itemStore.loadItems();
	const subscriptions = mocks.subscribe.mock.calls.length;
	mocks.subscribe.mock.calls.at(-1)[0]([{ id: 'curds', count: 4 }]);
	await itemStore.loadItems();
	expect(mocks.subscribe).toHaveBeenCalledTimes(subscriptions);
	expect(get(itemStore)).toMatchObject([{ id: 'curds', count: 4 }]);
});

it('starts a fresh listener after the running one fails, without reviving stale items', async () => {
	authStore.set({ uid: 'four' });
	await itemStore.loadItems();
	const [onItems, onError] = mocks.subscribe.mock.calls.at(-1);
	onItems([{ id: 'stale', count: 1 }]);
	onError(new Error('unavailable'));
	await itemStore.loadItems();
	const subscriptions = mocks.subscribe.mock.calls.length;
	expect(get(itemStore)).toEqual([]);
	// A late error from the replaced listener must not orphan the new one.
	onError(new Error('unavailable'));
	await itemStore.loadItems();
	expect(mocks.subscribe).toHaveBeenCalledTimes(subscriptions);
});
