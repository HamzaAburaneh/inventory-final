import { db } from '../firebase';
import {
	collection,
	addDoc,
	serverTimestamp,
	getDocs,
	query,
	orderBy,
	limit
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

export async function getHistoricalTransactions(limitCount: number = 1000): Promise<Transaction[]> {
	try {
		const transactionsRef = collection(db, 'transactions');
		const q = query(transactionsRef, orderBy('timestamp', 'desc'), limit(limitCount));
		const querySnapshot = await getDocs(q);

		return querySnapshot.docs.map(
			(doc) =>
				({
					id: doc.id,
					...doc.data()
				}) as Transaction
		);
	} catch (error) {
		console.error('Error fetching historical transactions: ', error);
		throw error;
	}
}
