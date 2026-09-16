import { collection, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { requireActiveGroupId } from './activeGroup';

/** @param {string} [groupId] Captured group. @returns {Promise<object[]>} Persisted decisions; failures are surfaced, never silently treated as no exclusions. */
export async function getStockHistoryReviews(groupId = requireActiveGroupId()) {
	const snapshot = await getDocs(collection(db, 'groups', groupId, 'stockHistoryReviews'));
	return snapshot.docs.map((row) => ({ ...row.data(), id: row.id }));
}

/** @param {string} groupId Captured group. @param {function(object[]):void} onData Decisions. @param {function(unknown):void} onError Read failure. @returns {function():void} Unsubscribe. */
export function subscribeStockHistoryReviews(groupId, onData, onError) {
	return onSnapshot(
		collection(db, 'groups', groupId, 'stockHistoryReviews'),
		(snapshot) => onData(snapshot.docs.map((row) => ({ ...row.data(), id: row.id }))),
		onError
	);
}
