import {
	collection,
	addDoc,
	deleteDoc,
	doc,
	getDocs,
	query,
	where,
	updateDoc,
	writeBatch,
	onSnapshot
} from 'firebase/firestore';
import { db } from '../firebase';

/**
 * @typedef {import('../types').Item} Item
 */

/**
 * Updates the count of a specific item.
 * @param {string} id - The ID of the item to update.
 * @param {number} newCount - The new count for the item.
 * @returns {Promise<void>}
 */
export async function updateItemCount(id, newCount) {
	const itemDoc = doc(db, 'items', id);
	await updateDoc(itemDoc, { count: newCount });
}

/**
 * Resets the count of a specific item to 0.
 * @param {string} id - The ID of the item to reset.
 * @returns {Promise<void>}
 */
export async function resetItemCount(id) {
	const itemDoc = doc(db, 'items', id);
	await updateDoc(itemDoc, { count: 0 });
}

/**
 * Resets the count of all items to 0.
 * @returns {Promise<void>}
 */
export async function resetAllCounts() {
	const itemsQuery = collection(db, 'items');
	const snapshot = await getDocs(itemsQuery);
	const batch = writeBatch(db);

	snapshot.forEach((docSnapshot) => {
		batch.update(docSnapshot.ref, { count: 0 });
	});

	await batch.commit();
}

/**
 * Retrieves all items from the database.
 * @returns {Promise<Item[]>} A promise that resolves to an array of Item objects.
 */
export async function getItems() {
	const itemsQuery = collection(db, 'items');
	const snapshot = await getDocs(itemsQuery);
	return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

/**
 * Subscribes to real-time updates for all items in the database.
 * @param {function(Item[]): void} callback - Function called when items change.
 * @returns {function(): void} Unsubscribe function to stop listening.
 */
export function subscribeToItems(callback) {
	const itemsQuery = collection(db, 'items');
	return onSnapshot(itemsQuery, (snapshot) => {
		const items = snapshot.docs.map((doc) => ({
			id: doc.id,
			...doc.data()
		}));
		callback(items);
	}, (error) => {
		console.error('Error in items subscription:', error);
	});
}

/**
 * Adds a new item to the database.
 * @param {Omit<Item, 'id'>} item - The item object to add, excluding the ID.
 * @returns {Promise<Item>} A promise that resolves to the added Item object including its new ID.
 */
export async function addItem(item) {
	const itemCollection = collection(db, 'items');

	// Check for duplicates
	const q = query(itemCollection, where('name', '==', item.name));
	const querySnapshot = await getDocs(q);
	if (!querySnapshot.empty) {
		throw new Error('Item with this name already exists.');
	}

	const docRef = await addDoc(itemCollection, item);
	return {
		id: docRef.id,
		name: item.name,
		barcode: item.barcode,
		count: item.count,
		lowCount: item.lowCount,
		cost: item.cost,
		storageType: item.storageType
	};
}

/**
 * Deletes an item from the database.
 * @param {string} id - The ID of the item to delete.
 * @returns {Promise<void>}
 */
export async function deleteItem(id) {
	const itemDoc = doc(db, 'items', id);
	await deleteDoc(itemDoc);
}

/**
 * Edits the name of an item.
 * @param {string} id - The ID of the item to edit.
 * @param {string} newName - The new name for the item.
 * @returns {Promise<void>}
 */
export async function editItemName(id, newName) {
	const itemDoc = doc(db, 'items', id);
	await updateDoc(itemDoc, { name: newName });
}

/**
 * Edits the low count threshold of an item.
 * @param {string} id - The ID of the item to edit.
 * @param {number} newLowCount - The new low count threshold.
 * @returns {Promise<void>}
 */
export async function editItemLowCount(id, newLowCount) {
	const itemDoc = doc(db, 'items', id);
	await updateDoc(itemDoc, { lowCount: newLowCount });
}

/**
 * Edits the cost of an item.
 * @param {string} id - The ID of the item to edit.
 * @param {number} newCost - The new cost for the item.
 * @returns {Promise<void>}
 */
export async function editItemCost(id, newCost) {
	const itemDoc = doc(db, 'items', id);
	await updateDoc(itemDoc, { cost: newCost });
}

/**
 * Edits the barcode of an item.
 * @param {string} id - The ID of the item to edit.
 * @param {string} newBarcode - The new barcode for the item.
 * @returns {Promise<void>}
 */
export async function editItemBarcode(id, newBarcode) {
	const itemDoc = doc(db, 'items', id);
	await updateDoc(itemDoc, { barcode: newBarcode });
}

/**
 * Edits the storage type of an item.
 * @param {string} id - The ID of the item to edit.
 * @param {string} newStorageType - The new storage type for the item.
 * @returns {Promise<void>}
 */
export async function editItemStorageType(id, newStorageType) {
	const itemDoc = doc(db, 'items', id);
	await updateDoc(itemDoc, { storageType: newStorageType });
}

/**
 * Searches for items by name.
 * @param {string} name - The name to search for.
 * @returns {Promise<Item[]>} A promise that resolves to an array of matching Item objects.
 */
export async function searchItems(name) {
	const itemsQuery = name
		? query(
				collection(db, 'items'),
				where('name', '>=', name),
				where('name', '<=', name + '\uf8ff')
			)
		: collection(db, 'items');
	const snapshot = await getDocs(itemsQuery);
	return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

/**
 * Sorts an array of objects by a specified column.
 * @template T
 * @param {T[]} items - The array of items to sort.
 * @param {keyof T} column - The column to sort by.
 * @param {boolean} ascending - True for ascending order, false for descending.
 * @returns {T[]} The sorted array.
 */
export function sortItems(items, column, ascending) {
    if (!Array.isArray(items)) {
        return [];
    }
	return [...items].sort((a, b) => {
		const valA = a[column];
		const valB = b[column];

		// Primary sort by the selected column
		let primaryComparison = 0;
		if (typeof valA === 'string' && typeof valB === 'string') {
			const lowerA = valA.toLowerCase();
			const lowerB = valB.toLowerCase();
			if (lowerA < lowerB) primaryComparison = ascending ? -1 : 1;
			else if (lowerA > lowerB) primaryComparison = ascending ? 1 : -1;
		} else {
			if (valA < valB) primaryComparison = ascending ? -1 : 1;
			else if (valA > valB) primaryComparison = ascending ? 1 : -1;
		}

		// If primary sort values are equal, sort alphabetically by name as secondary sort
		if (primaryComparison === 0 && column !== 'name' && a.name && b.name) {
			const nameA = a.name.toLowerCase();
			const nameB = b.name.toLowerCase();
			if (nameA < nameB) return -1;
			if (nameA > nameB) return 1;
		}

		return primaryComparison;
	});
}

/**
 * Applies sorting to an array of Item objects.
 * @param {Item[]} items - The array of Item objects to sort.
 * @param {keyof Item} column - The column to sort by.
 * @param {boolean} ascending - True for ascending order, false for descending.
 * @returns {Item[]} The sorted array of Item objects.
 */
export function applySorting(items, column, ascending) {
	return sortItems(items, column, ascending);
}

/**
 * Updates an item with partial data.
 * @param {string} id - The ID of the item to update.
 * @param {Partial<Item>} updatedFields - An object containing the fields to update.
 * @returns {Promise<void>}
 */
export async function updateItem(id, updatedFields) {
	const itemDoc = doc(db, 'items', id);
	await updateDoc(itemDoc, updatedFields);
}

/**
 * Adds a specified number of test items to the database.
 * @param {number} [count=500] - The number of test items to add.
 * @returns {Promise<void>}
 */
export async function addTestItems(count = 500) {
	const storageTypes = ['freezer', 'refrigerator', 'dry storage'];

	for (let i = 0; i < count; i++) {
		/** @type {Omit<Item, 'id'>} */
		const testItem = {
			name: `Test Item ${i + 1}`,
			barcode: `BARCODE${(1000000 + i).toString().padStart(7, '0')}`,
			count: Math.floor(Math.random() * 100),
			lowCount: Math.floor(Math.random() * 10),
			cost: parseFloat((Math.random() * 100).toFixed(2)),
			storageType: storageTypes[Math.floor(Math.random() * storageTypes.length)]
		};

		try {
			await addItem(testItem);
			console.log(`Added test item ${i + 1}`);
		} catch (error) {
			console.error(`Error adding test item ${i + 1}:`, error);
		}
	}

	console.log(`Finished adding ${count} test items`);
}
