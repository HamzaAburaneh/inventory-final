import { collection, doc, getDocs, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { requireActiveGroupId } from './activeGroup';
import { enqueueStockAction, getPendingStockActions } from './stockActionQueue';
import { normalizeItemStock, stockInteger, stockLocationSortKey } from './stockLocations';
/** @typedef {import('../types').Item} Item */

function itemsCol() {
	return collection(db, 'groups', requireActiveGroupId(), 'items');
}

/** @param {string} id Item ID. @param {number} delta Signed whole quantity. @param {string} user Actor label. @param {string} location Explicit location. @returns {Promise<object>} Durable action outcome. */
export async function adjustItemCount(id, delta, user, location) {
	return enqueueStockAction({
		itemId: id,
		kind: 'adjust',
		delta: stockInteger(delta, true),
		user,
		location
	});
}

/** @param {string} id Item ID. @param {number} count Absolute balance. @param {string} user Actor label. @param {string} [location] Omit only for reset-all-locations to zero. @returns {Promise<object>} Durable action outcome. */
export async function setItemCount(id, count, user, location) {
	const quantity = stockInteger(count);
	if (!location && quantity !== 0) throw new Error('Choose a location when setting a balance.');
	return enqueueStockAction({
		itemId: id,
		kind: location ? 'set' : 'reset',
		quantity,
		user,
		...(location ? { location } : {})
	});
}

/** @param {string} id Item ID. @param {string} fromLocation Source. @param {string} toLocation Destination. @param {number} quantity Whole units. @param {string} user Actor label. @returns {Promise<object>} Durable action outcome. */
export async function transferItemStock(id, fromLocation, toLocation, quantity, user) {
	return enqueueStockAction({
		itemId: id,
		kind: 'transfer',
		fromLocation,
		toLocation,
		quantity: stockInteger(quantity),
		user
	});
}

/** @param {string} user Actor label. @returns {Promise<object>} Per-item outcomes; reset-all is not globally atomic. */
export async function resetAllItemCounts(user) {
	const items = await getItems();
	const pending = await getPendingStockActions();
	for (const action of pending) {
		if (action.kind === 'create' && !items.some((item) => item.id === action.itemId))
			items.push({ ...action.item, id: action.itemId });
	}
	const results = [];
	const groupId = requireActiveGroupId();
	for (const item of items) {
		if (requireActiveGroupId() !== groupId)
			throw new Error('Workspace changed. Remaining items were not reset.');
		try {
			if (normalizeItemStock(item).total || pending.some((action) => action.itemId === item.id))
				results.push(await setItemCount(item.id, 0, user));
		} catch (error) {
			results.push({ id: item.id, status: 'attention', error: error.message });
		}
	}
	return {
		status: results.some((r) => r.status === 'attention')
			? 'attention'
			: results.some((r) => r.status === 'queued')
				? 'queued'
				: 'applied',
		results
	};
}

/** @param {Item} item Opening item and balances. @param {string} user Actor label. @returns {Promise<object>} Durable creation outcome. */
export async function addItemWithTransaction(item, user) {
	const state = normalizeItemStock(item);
	const name = String(item.name ?? '').trim();
	if (!name) throw new Error('Enter an item name.');
	const existing = await getItems();
	if (existing.some((row) => row.name.toLowerCase() === name.toLowerCase()))
		throw new Error('An item with this name already exists.');
	const id = doc(itemsCol()).id;
	const data = {
		name,
		barcode: item.barcode ?? '',
		lowCount: stockInteger(item.lowCount ?? 0),
		cost: Number(item.cost ?? 0),
		booths: item.booths ?? [],
		storageType: state.storageType,
		stockByStorage: state.stockByStorage,
		count: state.total
	};
	if (!Number.isFinite(data.cost) || data.cost < 0)
		throw new Error('Enter a valid nonnegative cost.');
	return enqueueStockAction({ itemId: id, kind: 'create', item: data, user });
}

/** @param {string} id Item ID. @param {string} user Actor label. @returns {Promise<object>} Conflict-protected deletion outcome. */
export async function deleteItemWithTransaction(id, user) {
	return enqueueStockAction({ itemId: id, kind: 'delete', user });
}

/** @param {string} id Item ID. @param {Partial<Item>} updatedFields Metadata only. @returns {Promise<void>} Saved metadata. */
export async function updateItemFields(id, updatedFields) {
	const allowed = ['name', 'barcode', 'cost', 'lowCount', 'booths'];
	if (Object.keys(updatedFields).some((key) => !allowed.includes(key)))
		throw new Error(
			'Stock, storage family and merge fields require a dedicated inventory operation.'
		);
	await updateDoc(doc(db, 'groups', requireActiveGroupId(), 'items', id), updatedFields);
}
/**
 * Retrieves all items from the database (one-shot read).
 * @returns {Promise<Item[]>} A promise that resolves to an array of Item objects.
 */
export async function getItems() {
	const snapshot = await getDocs(itemsCol());
	return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

/**
 * Subscribes to real-time updates for all items in the database.
 * @param {function(Item[]): void} callback - Function called when items change.
 * @param {function(unknown): void} [onError] - Called if the listener fails; it delivers nothing more after that.
 * @returns {function(): void} Unsubscribe function to stop listening.
 */
export function subscribeToItems(callback, onError) {
	const itemsQuery = itemsCol();
	return onSnapshot(
		itemsQuery,
		(snapshot) => {
			const items = snapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data()
			}));
			callback(items);
		},
		(error) => {
			console.error('Error in items subscription:', error);
			onError?.(error);
		}
	);
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
		const valA = column === 'stockByStorage' ? stockLocationSortKey(a) : a[column];
		const valB = column === 'stockByStorage' ? stockLocationSortKey(b) : b[column];

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
