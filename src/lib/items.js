import {
	collection,
	doc,
	getDocFromCache,
	getDocs,
	onSnapshot,
	query,
	runTransaction,
	serverTimestamp,
	Timestamp,
	updateDoc,
	where,
	writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';

/**
 * @typedef {import('../types').Item} Item
 */

// ————————————————————————————————————————————————————————————————————————
// Ledgered mutations
//
// Every count change in StockSense must produce a matching `transactions`
// record with consistent previousCount/newCount (AGENTS.md goal #1). The
// functions below are the only way the app mutates item counts: each writes
// the count change and its ledger record in a single atomic Firestore
// transaction/batch, so one can never be committed without the other.
// ————————————————————————————————————————————————————————————————————————

/**
 * True when the browser reports no network connection. Only an explicit
 * `false` counts — on the server (and in tests) `navigator.onLine` is
 * undefined and we must take the online code path.
 * @returns {boolean} Whether the client is known to be offline.
 */
function isOffline() {
	return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/**
 * Builds a `transactions` ledger document for a count change.
 * Online, the timestamp is a server timestamp; offline we stamp the device
 * clock instead — a queued write may sync hours later, and the ledger should
 * record when the count actually happened, not when the signal came back.
 * @param {string} itemId - The ID of the item whose count changed.
 * @param {string} itemName - The item's name at the time of the change.
 * @param {'add' | 'remove'} type - The direction of the change.
 * @param {number} previousCount - The count before the change.
 * @param {number} newCount - The count after the change.
 * @param {string} user - The user who made the change.
 * @returns {object} The ledger document data.
 */
function ledgerRecord(itemId, itemName, type, previousCount, newCount, user) {
	return {
		itemId,
		itemName,
		type,
		previousCount,
		newCount,
		user,
		timestamp: isOffline() ? Timestamp.now() : serverTimestamp()
	};
}

/**
 * Commits a batch, awaiting the server ack only when online. Offline,
 * Firestore applies the batch to the local cache immediately and syncs it on
 * reconnect — awaiting commit() would block until then, so we let it settle
 * in the background and resolve right away (the UI reads the local cache).
 * @param {import('firebase/firestore').WriteBatch} batch - The batch to commit.
 * @returns {Promise<void>}
 */
function commitBatch(batch) {
	if (isOffline()) {
		batch.commit().catch((error) => console.error('Error syncing queued write:', error));
		return Promise.resolve();
	}
	return batch.commit();
}

/**
 * Offline path for count changes: reads the item from the device's local
 * cache and queues the count write + its ledger record in one batch (still
 * atomic — Firestore syncs the batch as a unit). The previousCount comes
 * from this device's cache, so if two devices change the same item while
 * offline, the last one to sync wins — the documented offline trade-off.
 * @param {string} id - The ID of the item to change.
 * @param {function(number): number} computeNewCount - Maps current → target count.
 * @param {string} user - The user making the change.
 * @returns {Promise<{previousCount: number, newCount: number}>} The counts around the change.
 */
async function queueCountChange(id, computeNewCount, user) {
	const itemRef = doc(db, 'items', id);
	let snapshot;
	try {
		snapshot = await getDocFromCache(itemRef);
	} catch {
		throw new Error('Item not available in the offline cache');
	}
	if (!snapshot.exists()) {
		throw new Error('Item not found');
	}
	const item = snapshot.data();
	const previousCount = parseInt(item.count, 10) || 0;
	const newCount = Math.max(0, computeNewCount(previousCount));
	if (newCount === previousCount) {
		return { previousCount, newCount };
	}
	const batch = writeBatch(db);
	batch.update(itemRef, { count: newCount });
	batch.set(
		doc(collection(db, 'transactions')),
		ledgerRecord(
			id,
			item.name,
			newCount > previousCount ? 'add' : 'remove',
			previousCount,
			newCount,
			user
		)
	);
	await commitBatch(batch);
	return { previousCount, newCount };
}

/**
 * Atomically adjusts an item's count by a delta (clamped at 0) and appends
 * the matching ledger record in the same Firestore transaction. No-op deltas
 * (0, or a decrement already clamped away) write nothing — no phantom records.
 * @param {string} id - The ID of the item to adjust.
 * @param {number} delta - The signed change amount.
 * @param {string} user - The user making the change.
 * @returns {Promise<{previousCount: number, newCount: number}>} The counts around the change.
 */
export async function adjustItemCount(id, delta, user) {
	if (isOffline()) {
		return queueCountChange(id, (current) => current + (parseInt(delta, 10) || 0), user);
	}
	const itemRef = doc(db, 'items', id);
	return runTransaction(db, async (txn) => {
		const snapshot = await txn.get(itemRef);
		if (!snapshot.exists()) {
			throw new Error('Item not found');
		}
		const item = snapshot.data();
		const previousCount = parseInt(item.count, 10) || 0;
		const newCount = Math.max(0, previousCount + (parseInt(delta, 10) || 0));
		if (newCount === previousCount) {
			return { previousCount, newCount };
		}
		txn.update(itemRef, { count: newCount });
		txn.set(
			doc(collection(db, 'transactions')),
			ledgerRecord(id, item.name, delta > 0 ? 'add' : 'remove', previousCount, newCount, user)
		);
		return { previousCount, newCount };
	});
}

/**
 * Atomically sets an item's count to an absolute value (clamped at 0) and
 * appends the matching ledger record in the same Firestore transaction.
 * Writes nothing when the count is already at the target value.
 * @param {string} id - The ID of the item to set.
 * @param {number} count - The absolute target count.
 * @param {string} user - The user making the change.
 * @returns {Promise<{previousCount: number, newCount: number}>} The counts around the change.
 */
export async function setItemCount(id, count, user) {
	if (isOffline()) {
		return queueCountChange(id, () => parseInt(count, 10) || 0, user);
	}
	const itemRef = doc(db, 'items', id);
	return runTransaction(db, async (txn) => {
		const snapshot = await txn.get(itemRef);
		if (!snapshot.exists()) {
			throw new Error('Item not found');
		}
		const item = snapshot.data();
		const previousCount = parseInt(item.count, 10) || 0;
		const newCount = Math.max(0, parseInt(count, 10) || 0);
		if (newCount === previousCount) {
			return { previousCount, newCount };
		}
		txn.update(itemRef, { count: newCount });
		txn.set(
			doc(collection(db, 'transactions')),
			ledgerRecord(
				id,
				item.name,
				newCount > previousCount ? 'add' : 'remove',
				previousCount,
				newCount,
				user
			)
		);
		return { previousCount, newCount };
	});
}

/**
 * Resets every non-zero item count to 0, pairing each count write with its
 * ledger record in the same batch. Batches are chunked to stay under
 * Firestore's 500-op limit; each item's count+record pair always lands in the
 * same batch, so the per-item invariant holds even if a later chunk fails.
 * @param {string} user - The user making the change.
 * @returns {Promise<number>} The number of items that were reset.
 */
export async function resetAllItemCounts(user) {
	const snapshot = await getDocs(collection(db, 'items'));
	const toReset = snapshot.docs.filter((docSnapshot) => {
		const count = parseInt(docSnapshot.data().count, 10) || 0;
		return count !== 0;
	});

	// 2 ops per item (count update + ledger record) → 200 items per batch.
	const chunkSize = 200;
	for (let i = 0; i < toReset.length; i += chunkSize) {
		const batch = writeBatch(db);
		for (const docSnapshot of toReset.slice(i, i + chunkSize)) {
			const item = docSnapshot.data();
			const previousCount = parseInt(item.count, 10) || 0;
			batch.update(docSnapshot.ref, { count: 0 });
			batch.set(
				doc(collection(db, 'transactions')),
				ledgerRecord(docSnapshot.id, item.name, 'remove', previousCount, 0, user)
			);
		}
		await commitBatch(batch);
	}

	return toReset.length;
}

/**
 * Adds a new item and its initial 'add' ledger record (0 → starting count)
 * in a single atomic batch. Rejects duplicate names.
 * @param {Omit<Item, 'id'>} item - The item to add, excluding the ID.
 * @param {string} user - The user adding the item.
 * @returns {Promise<Item>} The added item including its new ID.
 */
export async function addItemWithTransaction(item, user) {
	const itemCollection = collection(db, 'items');

	const duplicates = await getDocs(query(itemCollection, where('name', '==', item.name)));
	if (!duplicates.empty) {
		throw new Error('Item with this name already exists.');
	}

	const itemRef = doc(itemCollection);
	const batch = writeBatch(db);
	batch.set(itemRef, item);
	batch.set(
		doc(collection(db, 'transactions')),
		ledgerRecord(itemRef.id, item.name, 'add', 0, parseInt(item.count, 10) || 0, user)
	);
	await commitBatch(batch);

	return { id: itemRef.id, ...item };
}

/**
 * Deletes an item and appends its final 'remove' ledger record (count → 0)
 * in the same Firestore transaction.
 * @param {string} id - The ID of the item to delete.
 * @param {string} user - The user deleting the item.
 * @returns {Promise<void>}
 */
export async function deleteItemWithTransaction(id, user) {
	const itemRef = doc(db, 'items', id);
	if (isOffline()) {
		let snapshot;
		try {
			snapshot = await getDocFromCache(itemRef);
		} catch {
			throw new Error('Item not available in the offline cache');
		}
		if (!snapshot.exists()) {
			return;
		}
		const item = snapshot.data();
		const previousCount = parseInt(item.count, 10) || 0;
		const batch = writeBatch(db);
		batch.set(
			doc(collection(db, 'transactions')),
			ledgerRecord(id, item.name, 'remove', previousCount, 0, user)
		);
		batch.delete(itemRef);
		await commitBatch(batch);
		return;
	}
	await runTransaction(db, async (txn) => {
		const snapshot = await txn.get(itemRef);
		if (!snapshot.exists()) {
			return;
		}
		const item = snapshot.data();
		const previousCount = parseInt(item.count, 10) || 0;
		txn.set(
			doc(collection(db, 'transactions')),
			ledgerRecord(id, item.name, 'remove', previousCount, 0, user)
		);
		txn.delete(itemRef);
	});
}

/**
 * Updates non-count fields of an item (name, cost, lowCount, storageType,
 * booths, barcode…). Refuses count changes: those must go through
 * adjustItemCount/setItemCount so a ledger record is always written.
 * @param {string} id - The ID of the item to update.
 * @param {Partial<Item>} updatedFields - The fields to update.
 * @returns {Promise<void>}
 */
export async function updateItemFields(id, updatedFields) {
	if (Object.prototype.hasOwnProperty.call(updatedFields, 'count')) {
		throw new Error(
			'Item counts must be changed through adjustItemCount/setItemCount so a transaction record is written.'
		);
	}
	const itemRef = doc(db, 'items', id);
	await updateDoc(itemRef, updatedFields);
}

// ————————————————————————————————————————————————————————————————————————
// Reads and pure helpers
// ————————————————————————————————————————————————————————————————————————

/**
 * Retrieves all items from the database (one-shot read).
 * @returns {Promise<Item[]>} A promise that resolves to an array of Item objects.
 */
export async function getItems() {
	const snapshot = await getDocs(collection(db, 'items'));
	return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

/**
 * Subscribes to real-time updates for all items in the database.
 * @param {function(Item[]): void} callback - Function called when items change.
 * @returns {function(): void} Unsubscribe function to stop listening.
 */
export function subscribeToItems(callback) {
	const itemsQuery = collection(db, 'items');
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
