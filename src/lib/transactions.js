import { annotateStockHistory } from './stockHistory';
import { getStockHistoryReviews, subscribeStockHistoryReviews } from './stockReviews';
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
import { transactionFilterMatches, matchesHistoryFilter, seasonRange } from './transactionHistory';

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
		...data,
		id: docSnap.id,
		syncedAt: data.syncedAt?.toDate() ?? null,
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
		const groupId = requireActiveGroupId();
		const transactionsRef = collection(db, 'groups', groupId, 'transactions');
		const startDate = new Date();
		startDate.setDate(startDate.getDate() - days);

		const q = query(
			transactionsRef,
			where('timestamp', '>=', Timestamp.fromDate(startDate)),
			orderBy('timestamp', 'asc')
		);

		const querySnapshot = await getDocs(q);

		return annotateStockHistory(
			querySnapshot.docs.map(mapTransactionDoc),
			await getStockHistoryReviews(groupId)
		);
	} catch (error) {
		console.error('Error fetching historical transactions: ', error);
		throw error;
	}
}

/**
 * The group's history reviews, kept open for as long as the group stays the same.
 * `onChange` fires with each new snapshot; `value` is null until the first one
 * arrives and again after a failure, which `ensure` restarts.
 * @param {function(): void} onChange - Called after `value` changes.
 * @param {function(unknown): void} [onError] - Called when the listener fails.
 */
function createReviewsWatch(onChange, onError) {
	let groupId = null;
	let value = null;
	let stop = null;
	// Identifies the current listener, so a callback from a replaced one is
	// ignored even if it arrives late.
	let token = null;

	const close = () => {
		stop?.();
		stop = null;
		token = null;
		value = null;
		groupId = null;
	};

	return {
		get value() {
			return value;
		},
		/** Watch this group's reviews, starting over after a failure or a workspace change. */
		ensure(nextGroupId) {
			if (nextGroupId !== groupId) close();
			if (token) return;
			groupId = nextGroupId;
			const current = {};
			token = current;
			const unsubscribe = subscribeStockHistoryReviews(
				nextGroupId,
				(reviews) => {
					if (token !== current) return;
					value = reviews;
					onChange();
				},
				(error) => {
					if (token !== current) return;
					// A failed listener delivers nothing more; the next ensure starts a fresh one.
					stop?.();
					stop = null;
					token = null;
					value = null;
					onError?.(error);
				}
			);
			if (token === current) stop = unsubscribe;
			else unsubscribe();
		},
		close
	};
}

/**
 * A live view of one CNE season of the active group's ledger, which the caller
 * points at a season and filter with `show` and closes with `stop`.
 *
 * A season is the unit the app is actually used in, and it keeps the query
 * bounded without truncating anything the user asked for: the season loads
 * whole, so every count, stat and sort on the page covers it completely. It
 * also stays flat as the ledger grows, since next season's view carries none of
 * this season's rows — and it leaves out the off-season months where stray test
 * rows live (see seasonRange).
 *
 * Rows always arrive newest first. Because the season is complete, oldest first
 * is the same rows reversed, so the caller flips the order locally rather than
 * asking Firestore again.
 *
 * `filter` is applied by Firestore rather than by the caller, so switching it
 * re-queries instead of post-processing a superset. That means the query is only
 * as good as the stored data: rows written before the `event` field existed must
 * be backfilled or they will not match a stock filter
 * (src/scripts/backfill-transaction-events.js).
 *
 * Rows are only delivered once the history reviews have loaded, since those
 * decide which rows are historical transfers. The review listener is kept open
 * across `show` calls, so changing season or filter replaces only the ledger
 * query. A failed review listener is restarted by the next `show`.
 *
 * The season range and the ordering both key off `timestamp`, which Firestore
 * indexes automatically. Adding a type filter needs a composite index — see
 * firestore.indexes.json — and fails with `failed-precondition` until one is
 * built, so callers should surface that rather than showing an empty season.
 * @param {function(Transaction[]): void} onData - Called with each complete set of rows.
 * @param {function(unknown): void} [onError] - Called when either listener fails.
 * @returns {{ show: function({ year: number, filter?: string }): void, stop: function(): void }} The feed.
 */
export function createSeasonHistoryFeed(onData, onError) {
	let filter = '';
	let rows = null;
	let stopRows = null;
	let rowsToken = null;

	const emit = () => {
		const reviews = reviewsWatch.value;
		if (!rows || !reviews) return;
		try {
			onData(
				annotateStockHistory(rows, reviews).filter((row) => matchesHistoryFilter(row, filter))
			);
		} catch (error) {
			onError?.(error);
		}
	};
	const reviewsWatch = createReviewsWatch(emit, onError);

	const closeRows = () => {
		stopRows?.();
		stopRows = null;
		rowsToken = null;
		rows = null;
	};

	return {
		show({ year, filter: nextFilter = '' }) {
			closeRows();
			filter = nextFilter;
			// Read the group on every show, so a workspace change can never mix
			// another group's reviews into these rows.
			const groupId = requireActiveGroupId();
			reviewsWatch.ensure(groupId);

			const { start, end } = seasonRange(year);
			const constraints = transactionFilterMatches(filter).map(([field, value]) =>
				where(field, '==', value)
			);
			constraints.push(
				where('timestamp', '>=', Timestamp.fromDate(start)),
				where('timestamp', '<', Timestamp.fromDate(end)),
				orderBy('timestamp', 'desc')
			);
			const token = {};
			rowsToken = token;
			stopRows = onSnapshot(
				query(collection(db, 'groups', groupId, 'transactions'), ...constraints),
				(querySnapshot) => {
					if (rowsToken !== token) return;
					rows = querySnapshot.docs.map(mapTransactionDoc);
					emit();
				},
				(error) => {
					if (rowsToken !== token) return;
					console.error('Error in transactions subscription:', error);
					onError?.(error);
				}
			);
		},
		stop() {
			closeRows();
			reviewsWatch.close();
		}
	};
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
