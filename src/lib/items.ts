import {
	collection,
	addDoc,
	deleteDoc,
	doc,
	getDocs,
	query,
	where,
	updateDoc,
	writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Item } from '../types';

export async function updateItemCount(id: string, newCount: number): Promise<void> {
	const itemDoc = doc(db, 'items', id);
	await updateDoc(itemDoc, { count: newCount });
}

export async function resetItemCount(id: string): Promise<void> {
	const itemDoc = doc(db, 'items', id);
	await updateDoc(itemDoc, { count: 0 });
}

export async function resetAllCounts(): Promise<void> {
	const itemsQuery = collection(db, 'items');
	const snapshot = await getDocs(itemsQuery);
	const batch = writeBatch(db);

	snapshot.forEach((docSnapshot) => {
		batch.update(docSnapshot.ref, { count: 0 });
	});

	await batch.commit();
}

export async function getItems(): Promise<Item[]> {
	const itemsQuery = collection(db, 'items');
	const snapshot = await getDocs(itemsQuery);
	return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Item);
}

export async function addItem(item: Omit<Item, 'id'>): Promise<Item> {
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

export async function deleteItem(id: string): Promise<void> {
	const itemDoc = doc(db, 'items', id);
	await deleteDoc(itemDoc);
}

export async function editItemName(id: string, newName: string): Promise<void> {
	const itemDoc = doc(db, 'items', id);
	await updateDoc(itemDoc, { name: newName });
}

export async function editItemLowCount(id: string, newLowCount: number): Promise<void> {
	const itemDoc = doc(db, 'items', id);
	await updateDoc(itemDoc, { lowCount: newLowCount });
}

export async function editItemCost(id: string, newCost: number): Promise<void> {
	const itemDoc = doc(db, 'items', id);
	await updateDoc(itemDoc, { cost: newCost });
}

export async function editItemBarcode(id: string, newBarcode: string): Promise<void> {
	const itemDoc = doc(db, 'items', id);
	await updateDoc(itemDoc, { barcode: newBarcode });
}

export async function editItemStorageType(id: string, newStorageType: string): Promise<void> {
	const itemDoc = doc(db, 'items', id);
	await updateDoc(itemDoc, { storageType: newStorageType });
}

export async function searchItems(name: string): Promise<Item[]> {
	const itemsQuery = name
		? query(
				collection(db, 'items'),
				where('name', '>=', name),
				where('name', '<=', name + '\uf8ff')
			)
		: collection(db, 'items');
	const snapshot = await getDocs(itemsQuery);
	return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Item);
}

export function sortItems<T>(items: T[], column: keyof T, ascending: boolean): T[] {
	return items.sort((a, b) => {
		if (a[column] < b[column]) return ascending ? -1 : 1;
		if (a[column] > b[column]) return ascending ? 1 : -1;
		return 0;
	});
}

export function applySorting(items: Item[], column: keyof Item, ascending: boolean): Item[] {
	return sortItems(items, column, ascending);
}

// Add the new updateItem function
export async function updateItem(id: string, updatedFields: Partial<Item>): Promise<void> {
	const itemDoc = doc(db, 'items', id);
	await updateDoc(itemDoc, updatedFields);
}

export async function addTestItems(count: number = 500): Promise<void> {
	const storageTypes = ['freezer', 'refrigerator', 'dry storage'];

	for (let i = 0; i < count; i++) {
		const testItem: Omit<Item, 'id'> = {
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
