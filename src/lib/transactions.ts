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
import type { Transaction } from '../types';

export async function addTransaction(
	transaction: Omit<Transaction, 'id' | 'timestamp'>
): Promise<string> {
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

export async function getHistoricalTransactions(days: number = 90): Promise<Transaction[]> {
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

		return querySnapshot.docs.map(
			(doc) =>
				({
					id: doc.id,
					...doc.data(),
					timestamp: doc.data().timestamp.toDate()
				}) as Transaction
		);
	} catch (error) {
		console.error('Error fetching historical transactions: ', error);
		throw error;
	}
}
