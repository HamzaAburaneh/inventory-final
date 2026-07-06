import { db } from '../firebase';
import {
	collection,
	getDocs,
	onSnapshot,
	query,
	orderBy,
	where,
	Timestamp
} from 'firebase/firestore';
import { requireActiveGroupId } from './activeGroup';

/**
 * @typedef {import('../types').Transaction} Transaction
 */

// NOTE: there is intentionally no standalone addTransaction here. Ledger
// records are only written together with their count change, atomically, by
// the functions in src/lib/items.js — so the two can never drift apart.

/**
 * Retrieves historical transactions from the database.
 * @param {number} [days=90] - The number of days back from today to fetch transactions.
 * @returns {Promise<Transaction[]>} A promise that resolves to an array of Transaction objects.
 */
export async function getHistoricalTransactions(days = 90) {
	try {
		const transactionsRef = collection(db, 'groups', requireActiveGroupId(), 'transactions');
		const startDate = new Date();
		startDate.setDate(startDate.getDate() - days);

		const q = query(
			transactionsRef,
			where('timestamp', '>=', Timestamp.fromDate(startDate)),
			orderBy('timestamp', 'asc')
		);

		const querySnapshot = await getDocs(q);

		return querySnapshot.docs.map((doc) => {
			const data = doc.data();
			return {
				id: doc.id,
				...data,
				// A write queued offline carries a serverTimestamp that reads back as
				// null in the local cache until it syncs; fall back to now so consumers
				// that expect a Date don't crash on `.toDate()`.
				timestamp: data.timestamp ? data.timestamp.toDate() : new Date(),
				// Audit field — null on legacy rows and on offline writes not yet synced.
				syncedAt: data.syncedAt ? data.syncedAt.toDate() : null
			};
		});
	} catch (error) {
		console.error('Error fetching historical transactions: ', error);
		throw error;
	}
}

/**
 * Subscribes to the active group's transaction ledger in real time, newest
 * first. Firestore Timestamps are normalized to JS Dates (an offline write
 * reads back null until it syncs, so fall back to now).
 * @param {function(Transaction[]): void} onData - Called with each snapshot.
 * @param {function(unknown): void} [onError] - Called on subscription error.
 * @returns {function(): void} Unsubscribe function.
 */
export function subscribeToTransactions(onData, onError) {
	const transactionsRef = collection(db, 'groups', requireActiveGroupId(), 'transactions');
	const q = query(transactionsRef, orderBy('timestamp', 'desc'));
	return onSnapshot(
		q,
		(querySnapshot) => {
			onData(
				querySnapshot.docs.map((docSnap) => {
					const data = docSnap.data();
					return {
						id: docSnap.id,
						itemId: data.itemId,
						itemName: data.itemName,
						type: data.type,
						previousCount: data.previousCount,
						newCount: data.newCount,
						timestamp: data.timestamp?.toDate() || new Date(),
						user: data.user
					};
				})
			);
		},
		(error) => {
			console.error('Error in transactions subscription:', error);
			if (onError) onError(error);
		}
	);
}
