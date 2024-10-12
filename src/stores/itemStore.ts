import { writable, derived } from 'svelte/store';
import type { Item } from '../types';
import {
	getItems,
	addItem,
	deleteItem,
	updateItemCount,
	resetItemCount,
	resetAllCounts
} from '../lib/items';

function createItemStore() {
	const { subscribe, set, update } = writable<Item[]>([]);

	return {
		subscribe,
		fetchItems: async () => {
			const items = await getItems();
			set(items.map((item) => ({ ...item, changeAmount: 0 })));
		},
		addItem: async (newItem: Omit<Item, 'id'>) => {
			const addedItem = await addItem(newItem);
			update((items) => [...items, { ...addedItem, changeAmount: 0 }]);
		},
		deleteItem: async (id: string) => {
			await deleteItem(id);
			update((items) => items.filter((item) => item.id !== id));
		},
		updateItemCount: async (id: string, newCount: number) => {
			await updateItemCount(id, newCount);
			update((items) =>
				items.map((item) => (item.id === id ? { ...item, count: newCount, changeAmount: 0 } : item))
			);
		},
		resetItemCount: async (id: string) => {
			await resetItemCount(id);
			update((items) =>
				items.map((item) => (item.id === id ? { ...item, count: 0, changeAmount: 0 } : item))
			);
		},
		resetAllCounts: async () => {
			await resetAllCounts();
			update((items) => items.map((item) => ({ ...item, count: 0, changeAmount: 0 })));
		},
		changeCount: async (id: string, amount: number) => {
			update((items) => {
				const item = items.find((i) => i.id === id);
				if (item) {
					const newCount = Math.max(0, item.count + amount);
					updateItemCount(id, newCount); // Fire and forget
					return items.map((i) => (i.id === id ? { ...i, count: newCount, changeAmount: 0 } : i));
				}
				return items;
			});
		},
		setChangeAmount: (id: string, amount: number) => {
			update((items) =>
				items.map((item) =>
					item.id === id ? { ...item, changeAmount: Math.max(0, amount) } : item
				)
			);
		}
	};
}

export const itemStore = createItemStore();

export const filteredItems = derived(
	itemStore,
	($items) => (searchTerm: string) =>
		searchTerm.trim()
			? $items.filter((item) => item.name.toLowerCase().includes(searchTerm.toLowerCase()))
			: $items
);
