import { writable, get } from 'svelte/store';
import {
	subscribeToItems,
	addItemWithTransaction,
	deleteItemWithTransaction,
	adjustItemCount,
	setItemCount,
	resetAllItemCounts,
	updateItemFields
} from '../lib/items';
import { authStore } from './authStore';

function createItemStore() {
	const { subscribe, set, update } = writable([]);
	let unsubscribeFromItems = null;

	function currentUser() {
		const authUser = get(authStore);
		return authUser?.email || 'Unknown';
	}

	async function loadItems() {
		try {
			// If already subscribed, unsubscribe first
			if (unsubscribeFromItems) {
				unsubscribeFromItems();
			}

			// Set up real-time subscription
			unsubscribeFromItems = subscribeToItems((items) => {
				const processedItems = items.map((item) => ({
					id: item.id,
					...item,
					count: parseInt(item.count, 10) || 0, // Ensure count is always a number
					changeAmount: 0 // Initialize changeAmount for each item
				}));
				set(processedItems);
			});
		} catch (error) {
			console.error('Error loading items:', error);
			throw error;
		}
	}

	function stopListening() {
		if (unsubscribeFromItems) {
			unsubscribeFromItems();
			unsubscribeFromItems = null;
		}
	}

	// Alias for loadItems to maintain compatibility
	async function fetchItems() {
		return loadItems();
	}

	async function addItem(item) {
		try {
			// The item doc and its initial 'add' ledger record are written in one
			// atomic batch by addItemWithTransaction.
			// NOTE: do not optimistically append here. The active subscribeToItems
			// listener (set up in loadItems) re-emits the full collection on every
			// write, so appending locally races that snapshot and can briefly leave
			// two rows with the same id in the store — crashing the keyed
			// {#each item (item.id)} in the items table (each_key_duplicate).
			return await addItemWithTransaction(item, currentUser());
		} catch (error) {
			console.error('Error adding item:', error);
			throw error;
		}
	}

	async function updateItem(id, updatedFields) {
		try {
			// Count changes are rejected by updateItemFields — they must go through
			// changeCount/resetItemCount so the ledger record is written atomically.
			await updateItemFields(id, updatedFields);
			update((items) =>
				items.map((item) => (item.id === id ? { ...item, ...updatedFields } : item))
			);
		} catch (error) {
			console.error('Error updating item:', error);
			throw error;
		}
	}

	async function deleteItem(id) {
		try {
			// The item delete and its final 'remove' ledger record are committed in
			// one atomic Firestore transaction.
			await deleteItemWithTransaction(id, currentUser());
			update((items) => items.filter((item) => item.id !== id));
		} catch (error) {
			console.error('Error deleting item:', error);
			throw error;
		}
	}

	async function changeCount(id, amount) {
		try {
			const delta = parseInt(amount, 10) || 0;
			if (delta === 0) {
				return;
			}
			const { newCount } = await adjustItemCount(id, delta, currentUser());
			update((items) =>
				items.map((item) => (item.id === id ? { ...item, count: newCount } : item))
			);
		} catch (error) {
			console.error('Error changing count:', error);
			throw error;
		}
	}

	async function resetItemCount(id) {
		try {
			const { newCount } = await setItemCount(id, 0, currentUser());
			update((items) =>
				items.map((item) => (item.id === id ? { ...item, count: newCount } : item))
			);
		} catch (error) {
			console.error('Error resetting item count:', error);
			throw error;
		}
	}

	async function resetAllCounts() {
		try {
			await resetAllItemCounts(currentUser());
			update((items) => items.map((item) => ({ ...item, count: 0 })));
		} catch (error) {
			console.error('Error resetting all counts:', error);
			throw error;
		}
	}

	function setChangeAmount(id, amount) {
		// Ensure changeAmount is always a number
		const numericAmount = parseInt(amount, 10) || 0;
		update((items) =>
			items.map((item) => (item.id === id ? { ...item, changeAmount: numericAmount } : item))
		);
	}

	return {
		subscribe,
		loadItems,
		fetchItems,
		addItem,
		updateItem,
		deleteItem,
		changeCount,
		resetItemCount,
		resetAllCounts,
		setChangeAmount,
		stopListening
	};
}

export const itemStore = createItemStore();
