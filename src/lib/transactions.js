import { db } from '../firebase';
import {
	collection,
	getDocs,
	onSnapshot,
	query,
	orderBy,
	where,
	limit,
	Timestamp
} from 'firebase/firestore';
import { requireActiveGroupId } from './activeGroup';
import { transactionFilterMatches, seasonRange } from './transactionHistory';

/**
 * @typedef {import('../types').Transaction} Transaction
 */

// NOTE: there is intentionally no standalone addTransaction here. Ledger
// records are only written together with their count change, atomically, by
// the functions in src/lib/items.js — so the two can never drift apart.

/**
 * Normalize a transaction document snapshot into a Transaction.
 *
 * A write queued offline carries a serverTimestamp that reads back as null in
 * the local cache until it syncs, so fall back to now rather than handing
 * consumers a null they'd crash on.
 * @param {import('firebase/firestore').QueryDocumentSnapshot} docSnap - The document snapshot.
 * @returns {Transaction} The normalized transaction.
 */
function mapTransactionDoc(docSnap) {
	const data = docSnap.data();
	return {
		id: docSnap.id,
		itemId: data.itemId,
		itemName: data.itemName,
		type: data.type,
		event: data.event,
		previousCount: data.previousCount,
		newCount: data.newCount,
		timestamp: data.timestamp?.toDate() || new Date(),
		user: data.user
	};
}

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
				event: data.event,
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
 * Subscribes to one CNE season of the active group's ledger in real time.
 *
 * A season is the unit the app is actually used in, and it keeps the query
 * bounded without truncating anything the user asked for: the season loads
 * whole, so every count, stat and sort on the page covers it completely. It
 * also stays flat as the ledger grows, since next season's view carries none of
 * this season's rows — and it leaves out the off-season months where stray test
 * rows live (see seasonRange).
 *
 * `filter` and `sortNewest` are applied by Firestore rather than by the caller,
 * so switching either re-queries instead of post-processing a superset. That
 * means the query is only as good as the stored data: rows written before the
 * `event` field existed must be backfilled or they will not match a stock
 * filter (src/scripts/backfill-transaction-events.js).
 *
 * The season range and the ordering both key off `timestamp`, which Firestore
 * indexes automatically. Adding a type filter needs a composite index — see
 * firestore.indexes.json — and fails with `failed-precondition` until one is
 * built, so callers should surface that rather than showing an empty season.
 * @param {function(Transaction[]): void} onData - Called with each snapshot.
 * @param {function(unknown): void} [onError] - Called on subscription error.
 * @param {{ year: number, filter?: string, sortNewest?: boolean }} options - Listener options.
 * @returns {function(): void} Unsubscribe function.
 */
export function subscribeToTransactions(onData, onError, options) {
	const { year, filter = '', sortNewest = true } = options;
	const transactionsRef = collection(db, 'groups', requireActiveGroupId(), 'transactions');
	const { start, end } = seasonRange(year);

	const constraints = transactionFilterMatches(filter).map(([field, value]) =>
		where(field, '==', value)
	);
	constraints.push(
		where('timestamp', '>=', Timestamp.fromDate(start)),
		where('timestamp', '<', Timestamp.fromDate(end)),
		orderBy('timestamp', sortNewest ? 'desc' : 'asc')
	);

	return onSnapshot(
		query(transactionsRef, ...constraints),
		(querySnapshot) => {
			onData(querySnapshot.docs.map(mapTransactionDoc));
		},
		(error) => {
			console.error('Error in transactions subscription:', error);
			if (onError) onError(error);
		}
	);
}

/**
 * The year of the oldest transaction in the group, for building the season picker.
 *
 * One document read: ordering ascending and taking a single row lets Firestore
 * answer from the index it already maintains on `timestamp`.
 * @returns {Promise<number | null>} The earliest year, or null if the ledger is empty.
 */
export async function getEarliestTransactionYear() {
	const transactionsRef = collection(db, 'groups', requireActiveGroupId(), 'transactions');
	const snapshot = await getDocs(query(transactionsRef, orderBy('timestamp', 'asc'), limit(1)));
	if (snapshot.empty) return null;
	return mapTransactionDoc(snapshot.docs[0]).timestamp.getFullYear();
}
