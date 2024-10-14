import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
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
