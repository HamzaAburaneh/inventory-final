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
import { markQueued, markSynced } from './syncQueue';
import { requireActiveGroupId } from './activeGroup';

/**
 * @typedef {import('../types').Item} Item
 */

// ————————————————————————————————————————————————————————————————————————
// Group-scoped path helpers
//
// All inventory data lives under `groups/{gid}/…`, where gid is the signed-in
// user's active group (one group per user; see AGENTS.md). These read the
// active group at call time and throw if none is set — the route guard sends a
// group-less user to onboarding before any mutation is reachable.
// ————————————————————————————————————————————————————————————————————————

/** @returns {import('firebase/firestore').CollectionReference} The active group's items collection. */
function itemsCol() {
	return collection(db, 'groups', requireActiveGroupId(), 'items');
}

/**
 * @param {string} id - Item id.
 * @returns {import('firebase/firestore').DocumentReference} The item doc in the active group.
 */
function itemDoc(id) {
	return doc(db, 'groups', requireActiveGroupId(), 'items', id);
}

/** @returns {import('firebase/firestore').CollectionReference} The active group's transactions collection. */
function txCol() {
	return collection(db, 'groups', requireActiveGroupId(), 'transactions');
}

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
 * undefined and we must take the online code path. Note: this is a hint, not
 * a guarantee — an installed PWA on iOS can report `true` in airplane mode,
 * which is why the write functions below also fall back to the queued path
 * when an online attempt fails with an "unavailable" (offline) error.
 * @returns {boolean} Whether the client is known to be offline.
 */
function isOffline() {
	return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/**
 * Whether a Firestore error means "no connection" — either the SDK's
 * `unavailable` code or its offline-get message. These are the errors a write
 * attempt throws when the device is actually offline despite `navigator.onLine`.
 * @param {unknown} error - The caught error.
 * @returns {boolean} True if the failure is a connectivity failure.
 */
function isUnavailable(error) {
	if (!error) return false;
	const code = /** @type {{code?: string, message?: string}} */ (error).code;
	const message = /** @type {{code?: string, message?: string}} */ (error).message || '';
	return code === 'unavailable' || message.toLowerCase().includes('offline');
}

/**
 * Builds a `transactions` ledger document for a count change. The caller
 * passes the timestamp: a server timestamp when the write is going out online,
 * or a device `Timestamp.now()` for a queued offline write (a server timestamp
 * reads back as null in the local cache until it syncs, which would break
 * consumers that call `.toDate()` on it).
 * @param {string} itemId - The ID of the item whose count changed.
 * @param {string} itemName - The item's name at the time of the change.
 * @param {'add' | 'remove'} type - The direction of the change.
 * @param {'countChange' | 'itemCreated' | 'itemDeleted'} event - Explicit lifecycle event.
 * @param {number} previousCount - The count before the change.
 * @param {number} newCount - The count after the change.
 * @param {string} user - The user who made the change.
 * @param {*} timestamp - serverTimestamp() (online) or Timestamp.now() (queued).
 * @returns {object} The ledger document data.
 */
function ledgerRecord(itemId, itemName, type, event, previousCount, newCount, user, timestamp) {
	return {
		itemId,
		itemName,
		type,
		event,
		previousCount,
		newCount,
		user,
		timestamp,
		// Audit field: the server clock when this write actually lands. For an
		// online write it matches `timestamp`; for a queued offline write it's
		// the reconnect time, so a device with a wrong clock is detectable
		// (its `timestamp` will be far from `syncedAt`). Always a serverTimestamp.
		syncedAt: serverTimestamp()
	};
}

/**
 * Commits a batch and awaits the server ack. Used for online-first writes
 * (add item, reset all) where we want to surface a write failure to the caller.
 * @param {import('firebase/firestore').WriteBatch} batch - The batch to commit.
 * @returns {Promise<void>}
 */
function commitBatch(batch) {
	return batch.commit();
}

/**
 * Commits a batch without awaiting the server ack. Firestore applies the batch
 * to the local cache immediately (so the UI updates at once) and syncs it on
 * reconnect; awaiting would block until the network returns. The write is
 * tracked as queued now and synced when its commit promise resolves, driving
 * the offline indicator's count. Used for every offline / queued write.
 * @param {import('firebase/firestore').WriteBatch} batch - The batch to commit.
 * @returns {void}
 */
function commitDetached(batch) {
	markQueued();
	batch
		.commit()
		.then(() => markSynced())
		.catch((error) => {
			markSynced();
			console.error('Error syncing queued write:', error);
		});
}

/**
 * Reads an item, preferring the server but falling back to the local cache
 * when offline. `getDoc` already does this, but we surface a clearer error if
 * the item isn't cached and there's no network.
 * @param {import('firebase/firestore').DocumentReference} itemRef - The item ref.
 * @returns {Promise<import('firebase/firestore').DocumentSnapshot>} The snapshot.
 */
async function readItem(itemRef) {
	try {
		return await getDocFromCache(itemRef);
	} catch {
		throw new Error('Item not available on this device yet — open it once while online.');
	}
}

/**
 * Queues a count change offline: reads the item from the device cache and
 * writes the count update + its ledger record in one batch (Firestore syncs
 * the batch as an atomic unit on reconnect). The previousCount comes from this
 * device's cache, so if two devices change the same item while offline, the
 * last one to sync wins — the documented offline trade-off.
 * @param {string} id - The ID of the item to change.
 * @param {function(number): number} computeNewCount - Maps current → target count.
 * @param {string} user - The user making the change.
 * @returns {Promise<{previousCount: number, newCount: number}>} The counts around the change.
 */
async function queueCountChange(id, computeNewCount, user) {
	const itemRef = itemDoc(id);
	const snapshot = await readItem(itemRef);
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
		doc(txCol()),
		ledgerRecord(
			id,
			item.name,
			newCount > previousCount ? 'add' : 'remove',
			'countChange',
			previousCount,
			newCount,
			user,
			Timestamp.now()
		)
	);
	commitDetached(batch);
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
	const compute = (current) => current + (parseInt(delta, 10) || 0);
	if (isOffline()) {
		return queueCountChange(id, compute, user);
	}
	const itemRef = itemDoc(id);
	try {
		return await runTransaction(db, async (txn) => {
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
				doc(txCol()),
				ledgerRecord(
					id,
					item.name,
					delta > 0 ? 'add' : 'remove',
					'countChange',
					previousCount,
					newCount,
					user,
					serverTimestamp()
				)
			);
			return { previousCount, newCount };
		});
	} catch (error) {
		// navigator.onLine can lie (iOS PWA in airplane mode). If the online
		// transaction failed only because we're actually offline, queue it.
		if (isUnavailable(error)) {
			return queueCountChange(id, compute, user);
		}
		throw error;
	}
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
	const compute = () => parseInt(count, 10) || 0;
	if (isOffline()) {
		return queueCountChange(id, compute, user);
	}
	const itemRef = itemDoc(id);
	try {
		return await runTransaction(db, async (txn) => {
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
				doc(txCol()),
				ledgerRecord(
					id,
					item.name,
					newCount > previousCount ? 'add' : 'remove',
					'countChange',
					previousCount,
					newCount,
					user,
					serverTimestamp()
				)
			);
			return { previousCount, newCount };
		});
	} catch (error) {
		if (isUnavailable(error)) {
			return queueCountChange(id, compute, user);
		}
		throw error;
	}
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
	const snapshot = await getDocs(itemsCol());
	const toReset = snapshot.docs.filter((docSnapshot) => {
		const count = parseInt(docSnapshot.data().count, 10) || 0;
		return count !== 0;
	});

	const offline = isOffline();
	const timestamp = offline ? Timestamp.now() : serverTimestamp();

	// 2 ops per item (count update + ledger record) → 200 items per batch.
	const chunkSize = 200;
	for (let i = 0; i < toReset.length; i += chunkSize) {
		const batch = writeBatch(db);
		for (const docSnapshot of toReset.slice(i, i + chunkSize)) {
			const item = docSnapshot.data();
			const previousCount = parseInt(item.count, 10) || 0;
			batch.update(docSnapshot.ref, { count: 0 });
			batch.set(
				doc(txCol()),
				ledgerRecord(
					docSnapshot.id,
					item.name,
					'remove',
					'countChange',
					previousCount,
					0,
					user,
					timestamp
				)
			);
		}
		if (offline) {
			commitDetached(batch);
		} else {
			await commitBatch(batch);
		}
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
	const itemCollection = itemsCol();

	const duplicates = await getDocs(query(itemCollection, where('name', '==', item.name)));
	if (!duplicates.empty) {
		throw new Error('Item with this name already exists.');
	}

	const offline = isOffline();
	const itemRef = doc(itemCollection);
	const batch = writeBatch(db);
	batch.set(itemRef, item);
	batch.set(
		doc(txCol()),
		ledgerRecord(
			itemRef.id,
			item.name,
			'add',
			'itemCreated',
			0,
			parseInt(item.count, 10) || 0,
			user,
			offline ? Timestamp.now() : serverTimestamp()
		)
	);
	if (offline) {
		commitDetached(batch);
	} else {
		await commitBatch(batch);
	}

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
	const itemRef = itemDoc(id);
	if (isOffline()) {
		return queueDelete(itemRef, id, user);
	}
	try {
		await runTransaction(db, async (txn) => {
			const snapshot = await txn.get(itemRef);
			if (!snapshot.exists()) {
				return;
			}
			const item = snapshot.data();
			const previousCount = parseInt(item.count, 10) || 0;
			txn.set(
				doc(txCol()),
				ledgerRecord(
					id,
					item.name,
					'remove',
					'itemDeleted',
					previousCount,
					0,
					user,
					serverTimestamp()
				)
			);
			txn.delete(itemRef);
		});
	} catch (error) {
		if (isUnavailable(error)) {
			return queueDelete(itemRef, id, user);
		}
		throw error;
	}
}

/**
 * Queues an item deletion offline: writes the final 'remove' ledger record and
 * the delete in one batch, read from the device cache.
 * @param {import('firebase/firestore').DocumentReference} itemRef - The item ref.
 * @param {string} id - The item ID.
 * @param {string} user - The user deleting the item.
 * @returns {Promise<void>}
 */
async function queueDelete(itemRef, id, user) {
	const snapshot = await readItem(itemRef);
	if (!snapshot.exists()) {
		return;
	}
	const item = snapshot.data();
	const previousCount = parseInt(item.count, 10) || 0;
	const batch = writeBatch(db);
	batch.set(
		doc(txCol()),
		ledgerRecord(
			id,
			item.name,
			'remove',
			'itemDeleted',
			previousCount,
			0,
			user,
			Timestamp.now()
		)
	);
	batch.delete(itemRef);
	commitDetached(batch);
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
	const itemRef = itemDoc(id);
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
	const snapshot = await getDocs(itemsCol());
	return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

/**
 * Subscribes to real-time updates for all items in the database.
 * @param {function(Item[]): void} callback - Function called when items change.
 * @returns {function(): void} Unsubscribe function to stop listening.
 */
export function subscribeToItems(callback) {
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
