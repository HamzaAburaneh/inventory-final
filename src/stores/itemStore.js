import { writable, get } from 'svelte/store';
import { db } from '../firebase';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where } from 'firebase/firestore';
import { addTransaction } from '../lib/transactions';
import { authStore } from './authStore';

function createItemStore() {
	const { subscribe, set, update } = writable([]);

	async function loadItems() {
		try {
			const querySnapshot = await getDocs(collection(db, 'items'));
			const items = [];
			querySnapshot.forEach((doc) => {
				const data = doc.data();
				items.push({
					id: doc.id,
					...data,
					count: parseInt(data.count, 10) || 0, // Ensure count is always a number
					changeAmount: 0 // Initialize changeAmount for each item
				});
			});
			set(items);
		} catch (error) {
			console.error('Error loading items:', error);
			throw error;
		}
	}

	// Alias for loadItems to maintain compatibility
	async function fetchItems() {
		return loadItems();
	}

	async function addItem(item) {
		try {
			const docRef = await addDoc(collection(db, 'items'), item);
			const newItem = { id: docRef.id, ...item, changeAmount: 0 };
			update(items => [...items, newItem]);
			
			// Create a transaction for the new item
			const authUser = get(authStore);
			const currentUser = authUser?.email || 'Unknown';
			
			await addTransaction({
				itemId: docRef.id,
				itemName: item.name,
				type: 'add',
				previousCount: 0,
				newCount: parseInt(item.count) || 0,
				user: currentUser
			});
			
			return newItem;
		} catch (error) {
			console.error('Error adding item:', error);
			throw error;
		}
	}

	async function updateItem(id, updatedItem) {
		try {
			// Ensure count is always stored as a number in the database
			if (updatedItem.count !== undefined) {
				updatedItem.count = parseInt(updatedItem.count, 10) || 0;
			}
			
			const itemRef = doc(db, 'items', id);
			await updateDoc(itemRef, updatedItem);
			update(items => items.map(item =>
				item.id === id ? { ...item, ...updatedItem } : item
			));
		} catch (error) {
			console.error('Error updating item:', error);
			throw error;
		}
	}

	async function deleteItem(id) {
		try {
			// Get the item details before deleting
			const items = get({ subscribe });
			const item = items.find(item => item.id === id);
			
			if (item) {
				// Create a transaction record for the deletion
				const authUser = get(authStore);
				const currentUser = authUser?.email || 'Unknown';
				
				await addTransaction({
					itemId: id,
					itemName: item.name,
					type: 'remove',
					previousCount: item.count || 0,
					newCount: 0,
					user: currentUser
				});
			}
			
			await deleteDoc(doc(db, 'items', id));
			update(items => items.filter(item => item.id !== id));
		} catch (error) {
			console.error('Error deleting item:', error);
			throw error;
		}
	}

	async function searchItems(searchTerm) {
		try {
			const q = query(
				collection(db, 'items'),
				where('name', '>=', searchTerm),
				where('name', '<=', searchTerm + '\uf8ff')
			);
			const querySnapshot = await getDocs(q);
			const items = [];
			querySnapshot.forEach((doc) => {
				items.push({ id: doc.id, ...doc.data(), changeAmount: 0 });
			});
			return items;
		} catch (error) {
			console.error('Error searching items:', error);
			throw error;
		}
	}

	async function changeCount(id, amount) {
		try {
			const items = get({ subscribe });
			const item = items.find(item => item.id === id);
			if (!item) {
				throw new Error('Item not found');
			}
			
			// Ensure both values are numbers to prevent string concatenation
			const currentCount = parseInt(item.count, 10) || 0;
			const changeAmount = parseInt(amount, 10) || 0;
			const newCount = Math.max(0, currentCount + changeAmount);
			
			await updateItem(id, { count: newCount });
		} catch (error) {
			console.error('Error changing count:', error);
			throw error;
		}
	}

	async function resetItemCount(id) {
		try {
			await updateItem(id, { count: 0 });
		} catch (error) {
			console.error('Error resetting item count:', error);
			throw error;
		}
	}

	async function resetAllCounts() {
		try {
			const items = get({ subscribe });
			const updatePromises = items.map(item => 
				updateDoc(doc(db, 'items', item.id), { count: 0 })
			);
			await Promise.all(updatePromises);
			
			update(items => items.map(item => ({ ...item, count: 0 })));
		} catch (error) {
			console.error('Error resetting all counts:', error);
			throw error;
		}
	}

	function setChangeAmount(id, amount) {
		// Ensure changeAmount is always a number
		const numericAmount = parseInt(amount, 10) || 0;
		update(items => items.map(item =>
			item.id === id ? { ...item, changeAmount: numericAmount } : item
		));
	}

	return {
		subscribe,
		loadItems,
		fetchItems,
		addItem,
		updateItem,
		deleteItem,
		searchItems,
		changeCount,
		resetItemCount,
		resetAllCounts,
		setChangeAmount
	};
}

export const itemStore = createItemStore();
