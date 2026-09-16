import { writable, get } from 'svelte/store';
import {
	subscribeToItems,
	addItemWithTransaction,
	deleteItemWithTransaction,
	adjustItemCount,
	setItemCount,
	resetAllItemCounts,
	updateItemFields,
	transferItemStock
} from '../lib/items';
import { authStore } from './authStore';
import { groupStore } from './groupStore';

function createItemStore() {
	const store = writable([]);
	let unsubscribeFromItems = null;
	let listeningUid = null;
	let listeningGroup = null;
	authStore.subscribe((user) => {
		if (user?.uid !== listeningUid) {
			stopListening();
			listeningUid = user?.uid;
		}
	});
	groupStore.subscribe((group) => {
		if (group.groupId !== listeningGroup) {
			stopListening();
			listeningGroup = group.groupId;
		}
	});
	const currentUser = () => get(authStore)?.email || 'Unknown';
	async function loadItems() {
		stopListening();
		const uid = listeningUid;
		const group = listeningGroup;
		unsubscribeFromItems = subscribeToItems((items) => {
			if (uid !== listeningUid || group !== listeningGroup) return;
			store.update((previous) =>
				items.map((item) => ({
					...item,
					changeAmount: previous.find((row) => row.id === item.id)?.changeAmount ?? 0
				}))
			);
		});
	}
	function stopListening() {
		unsubscribeFromItems?.();
		unsubscribeFromItems = null;
		store.set([]);
	}
	return {
		subscribe: store.subscribe,
		loadItems,
		fetchItems: loadItems,
		stopListening,
		addItem: (item) => addItemWithTransaction(item, currentUser()),
		deleteItem: (id) => deleteItemWithTransaction(id, currentUser()),
		changeCount: (id, amount, location) => adjustItemCount(id, amount, currentUser(), location),
		transferStock: (id, from, to, quantity) =>
			transferItemStock(id, from, to, quantity, currentUser()),
		resetItemCount: (id) => setItemCount(id, 0, currentUser()),
		resetAllCounts: () => resetAllItemCounts(currentUser()),
		updateItem: (id, fields) => updateItemFields(id, fields),
		setChangeAmount: (id, amount) =>
			store.update((items) =>
				items.map((item) => (item.id === id ? { ...item, changeAmount: amount } : item))
			)
	};
}
export const itemStore = createItemStore();
