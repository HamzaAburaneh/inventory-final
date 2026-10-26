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
	/** Starts the catalog listener unless one is already running for this account and group. */
	async function loadItems() {
		// Account and group changes stop the listener, so a running one is already
		// for this scope and its items are current. Keep them, rather than blanking
		// the list and re-reading the catalog for every page that asks for items.
		if (unsubscribeFromItems) return;
		const uid = listeningUid;
		const group = listeningGroup;
		const stop = subscribeToItems(
			(items) => {
				if (uid !== listeningUid || group !== listeningGroup) return;
				store.update((previous) =>
					items.map((item) => ({
						...item,
						changeAmount: previous.find((row) => row.id === item.id)?.changeAmount ?? 0
					}))
				);
			},
			() => {
				// A failed listener delivers nothing more. Stop it, so the next page that
				// asks for items starts a fresh one instead of reusing a dead one.
				if (unsubscribeFromItems === stop) stopListening();
			}
		);
		unsubscribeFromItems = stop;
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
