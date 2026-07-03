import { db } from '../firebase';
import { collection, getDocs, query, orderBy, where, Timestamp } from 'firebase/firestore';

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
		const transactionsRef = collection(db, 'transactions');
		const startDate = new Date();
		startDate.setDate(startDate.getDate() - days);

		const q = query(
			transactionsRef,
			where('timestamp', '>=', Timestamp.fromDate(startDate)),
			orderBy('timestamp', 'asc')
		);

		const querySnapshot = await getDocs(q);

		return querySnapshot.docs.map((doc) => ({
			id: doc.id,
			...doc.data(),
			// A write queued offline carries a serverTimestamp that reads back as
			// null in the local cache until it syncs; fall back to now so consumers
			// that expect a Date don't crash on `.toDate()`.
			timestamp: doc.data().timestamp ? doc.data().timestamp.toDate() : new Date()
		}));
	} catch (error) {
		console.error('Error fetching historical transactions: ', error);
		throw error;
	}
}
