import {
	doc,
	runTransaction,
	serverTimestamp,
	Timestamp,
	getDocFromServer,
	getDocFromCache
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { requireActiveGroupId } from './activeGroup';
import { planStockAction } from './stockOperations.js';

/** @param {object} action Scoped action. @returns {void} Reject a changed session. */
export function assertStockScope(action) {
	if (auth.currentUser?.uid !== action.uid || requireActiveGroupId() !== action.groupId)
		throw new Error('Sign in to the original workspace to synchronize this action.');
}

/** @param {object} scope User/group/item identifiers. @param {boolean} [server] Require authoritative data. @returns {Promise<object|null>} Item snapshot. */
export async function readStockItem(scope, server = false) {
	assertStockScope(scope);
	const ref = doc(db, 'groups', scope.groupId, 'items', scope.itemId);
	let snapshot;
	if (server) snapshot = await getDocFromServer(ref);
	else {
		try {
			snapshot = await getDocFromCache(ref);
		} catch {
			snapshot = await getDocFromServer(ref);
		}
	}
	assertStockScope(scope);
	return snapshot.exists() ? { ...snapshot.data(), id: snapshot.id } : null;
}

/** @param {object} action Durable operation. @returns {Promise<object>} Applied or canceled receipt. */
export async function applyStockAction(action) {
	assertStockScope(action);
	const base = ['groups', action.groupId];
	const itemRef = doc(db, ...base, 'items', action.itemId);
	const receiptRef = doc(db, ...base, 'stockOperations', action.id);
	return runTransaction(db, async (transaction) => {
		assertStockScope(action);
		// Each transaction read is its own server round trip, so issue the receipt,
		// predecessor and item reads together instead of one after another. All reads
		// still complete before any write, as Firestore transactions require.
		const [receipt, previous, snapshot] = await Promise.all([
			transaction.get(receiptRef),
			action.predecessorId
				? transaction.get(doc(db, ...base, 'stockOperations', action.predecessorId))
				: null,
			transaction.get(itemRef)
		]);
		if (receipt.exists()) {
			if (receipt.data().uid !== action.uid || receipt.data().itemId !== action.itemId)
				throw new Error('Operation identity mismatch.');
			return receipt.data();
		}
		if (previous && !previous.exists())
			throw new Error('An earlier action on this item must finish first.');
		const result = action.cancelRequested
			? null
			: planStockAction(snapshot.exists() ? snapshot.data() : null, action);
		assertStockScope(action);
		const outcome = {
			status: action.cancelRequested ? 'canceled' : 'applied',
			uid: action.uid,
			itemId: action.itemId,
			operationId: action.id,
			appliedAt: serverTimestamp()
		};
		if (result?.ledger) {
			if (result.item) {
				const { id: _ignored, ...stored } = result.item;
				if (action.kind === 'create') transaction.set(itemRef, stored);
				else
					transaction.update(itemRef, {
						count: stored.count,
						stockByStorage: stored.stockByStorage,
						stockRevision: stored.stockRevision
					});
			} else transaction.delete(itemRef);
			transaction.set(doc(db, ...base, 'transactions', action.id), {
				...result.ledger,
				timestamp: Timestamp.fromMillis(action.createdAt),
				syncedAt: serverTimestamp()
			});
		}
		transaction.set(receiptRef, outcome);
		return outcome;
	});
}
