import { db } from '../../firebase';
import { collection, query, orderBy, getDocs, limit, getCountFromServer } from 'firebase/firestore';

export const ssr = false; // Disable SSR since Firebase requires client-side

export async function load() {
	try {
		const transactionsRef = collection(db, 'transactions');

		// Fetch initial transactions and count in parallel
		const [snapshot, countSnapshot] = await Promise.all([
			getDocs(query(transactionsRef, orderBy('timestamp', 'desc'), limit(10))),
			getCountFromServer(query(transactionsRef))
		]);

		const transactions = snapshot.docs.map((doc) => {
			const data = doc.data();
			return {
				id: doc.id,
				itemId: data.itemId,
				itemName: data.itemName,
				type: data.type,
				previousCount: data.previousCount,
				newCount: data.newCount,
				timestamp: data.timestamp?.toDate?.() || new Date(),
				user: data.user
			};
		});

		return {
			transactions,
			totalItems: countSnapshot.data().count,
			firstDoc: snapshot.docs[0] || null,
			lastDoc: snapshot.docs[snapshot.docs.length - 1] || null
		};
	} catch (error) {
		console.error('Error loading transactions:', error);
		return {
			transactions: [],
			totalItems: 0,
			firstDoc: null,
			lastDoc: null,
			error: 'Failed to load transactions'
		};
	}
}
