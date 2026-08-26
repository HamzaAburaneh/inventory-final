import { db } from '../firebase';
import {
	collection,
	getCountFromServer,
	getDocs,
	onSnapshot,
	query,
	orderBy,
	where,
	limit,
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
 * How many of the newest transactions the history page listens to on load.
 *
 * The ledger is append-only and unbounded, so an unfiltered listener streams
 * every record the group has ever written on every page load. At ~6k records
 * that measured ~3.8 MB (452 KB gzipped) plus ~730 ms of IndexedDB writes to
 * fill the persistent cache — and it grows forever. Bounding the live listener
 * keeps first paint flat regardless of ledger size; anything that needs the
 * whole ledger escalates via `getAllTransactions()`.
 */
export const RECENT_WINDOW_SIZE = 250;

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
 * Subscribes to the active group's transaction ledger in real time, newest
 * first. Firestore Timestamps are normalized to JS Dates (an offline write
 * reads back null until it syncs, so fall back to now).
 *
 * The listener is bounded to the newest `limit` records by default so first
 * paint does not scale with ledger size. Ordering and the limit both key off
 * `timestamp` alone, which Firestore indexes automatically — no composite
 * index is required. Pass `{ limit: null }` for an unbounded listener.
 * @param {function(Transaction[]): void} onData - Called with each snapshot.
 * @param {function(unknown): void} [onError] - Called on subscription error.
 * @param {{ limit?: number | null }} [options] - Listener options.
 * @returns {function(): void} Unsubscribe function.
 */
export function subscribeToTransactions(onData, onError, options = {}) {
	const { limit: windowSize = RECENT_WINDOW_SIZE } = options;
	const transactionsRef = collection(db, 'groups', requireActiveGroupId(), 'transactions');

	const constraints = [orderBy('timestamp', 'desc')];
	if (windowSize !== null && windowSize !== undefined) {
		constraints.push(limit(windowSize));
	}

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
 * Fetches the group's entire transaction ledger once, newest first.
 *
 * This is the escalation path behind the bounded listener in
 * `subscribeToTransactions`: search, type filters, oldest-first sorting, deep
 * pagination and CSV export all need to span the whole ledger, so they pull it
 * on demand instead of every page load paying for it. Deliberately a one-shot
 * read rather than a second listener — the bounded listener already delivers
 * realtime updates, and a second unbounded one would reintroduce the cost this
 * exists to avoid.
 * @returns {Promise<Transaction[]>} Every transaction in the group, newest first.
 */
export async function getAllTransactions() {
	const transactionsRef = collection(db, 'groups', requireActiveGroupId(), 'transactions');
	const querySnapshot = await getDocs(query(transactionsRef, orderBy('timestamp', 'desc')));
	return querySnapshot.docs.map(mapTransactionDoc);
}

/**
 * Counts the group's transactions without reading any of them.
 *
 * A server-side aggregation: the response is a single number, not documents, so
 * the bounded view can honestly say "250 of 6,314" without giving up the reason
 * it's bounded. Billed as one document read per 1,000 counted (7 for a ~6.3k
 * ledger) rather than one per document.
 *
 * Server-only — aggregations cannot be served from the persistent local cache,
 * so this rejects when offline. Callers should treat the count as a nicety and
 * fall back to what they have loaded.
 * @returns {Promise<number>} The number of transactions in the group.
 */
export async function getTransactionCount() {
	const transactionsRef = collection(db, 'groups', requireActiveGroupId(), 'transactions');
	const snapshot = await getCountFromServer(transactionsRef);
	return snapshot.data().count;
}
