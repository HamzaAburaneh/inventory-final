import { db } from '../firebase';
import {
	collection,
	addDoc,
	serverTimestamp,
	getDocs,
	query,
	orderBy,
	where,
	Timestamp
} from 'firebase/firestore';

/**
 * @typedef {import('../types').Transaction} Transaction
 */

/**
 * Adds a new transaction to the database.
 * @param {Omit<Transaction, 'id' | 'timestamp'>} transaction - The transaction object to add, excluding ID and timestamp.
 * @returns {Promise<string>} A promise that resolves to the ID of the new transaction.
 */
export async function addTransaction(transaction) {
	try {
		const docRef = await addDoc(collection(db, 'transactions'), {
			...transaction,
			timestamp: serverTimestamp()
		});
		return docRef.id;
	} catch (error) {
		console.error('Error adding transaction: ', error);
		throw error;
	}
}

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
			timestamp: doc.data().timestamp.toDate()
		}));
	} catch (error) {
		console.error('Error fetching historical transactions: ', error);
		throw error;
	}
}
