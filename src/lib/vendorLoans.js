import {
	collection,
	doc,
	getDocs,
	onSnapshot,
	orderBy,
	query,
	runTransaction,
	serverTimestamp,
	Timestamp
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { requireActiveGroupId } from './activeGroup';
import { planVendorAction } from './vendorBalances.js';

/**
 * @typedef {import('../types').VendorLoan} VendorLoan
 * @typedef {import('../types').VendorLoanEntry} VendorLoanEntry
 */

// Vendor actions are online-only in v1. Each one is a single Firestore
// transaction that needs the server, and they deliberately never go through
// Firestore's offline write cache, which would replay absolute item balances.
// The entry ID is the operation ID: a retry after a lost acknowledgment finds
// the entry already written and changes nothing.

const toDate = (value) => (value?.toDate ? value.toDate() : (value ?? null));

function loansCol(groupId) {
	return collection(db, 'groups', groupId, 'vendorLoans');
}

function mapLoan(snapshot) {
	const data = snapshot.data();
	return {
		...data,
		id: snapshot.id,
		createdAt: toDate(data.createdAt),
		updatedAt: toDate(data.updatedAt)
	};
}

/**
 * Subscribe to every loan in the active workspace.
 * @param {function(VendorLoan[]): void} onData - Called with each snapshot.
 * @param {function(unknown): void} [onError] - Called on subscription error.
 * @returns {function(): void} Unsubscribe.
 */
export function subscribeToVendorLoans(onData, onError) {
	return onSnapshot(
		loansCol(requireActiveGroupId()),
		(snapshot) => onData(snapshot.docs.map(mapLoan)),
		(error) => {
			console.error('Error in vendor loans subscription:', error);
			onError?.(error);
		}
	);
}

/**
 * One loan's audit trail, oldest first.
 * @param {string} loanId - Loan ID.
 * @returns {Promise<VendorLoanEntry[]>} Entries.
 */
export async function getVendorLoanEntries(loanId) {
	const entries = collection(
		db,
		'groups',
		requireActiveGroupId(),
		'vendorLoans',
		loanId,
		'entries'
	);
	const snapshot = await getDocs(query(entries, orderBy('timestamp', 'asc')));
	return snapshot.docs.map((row) => ({
		...row.data(),
		id: row.id,
		timestamp: toDate(row.data().timestamp)
	}));
}

/**
 * Record one vendor action atomically: the loan, its entry, and for inventory
 * products the item balance and matching ledger row all land together or not
 * at all.
 * @param {object} details - Action fields for planVendorAction, without `id`, `user`
 *   or (for existing loans) `loanId` conventions: pass `loanId` for every kind except 'loan'.
 * @param {string} [operationId] - Reuse to retry the same action safely.
 * @returns {Promise<{ status: 'applied' | 'duplicate', loanId: string, operationId: string }>}
 */
export async function recordVendorAction(details, operationId) {
	if (typeof navigator !== 'undefined' && navigator.onLine === false)
		throw new Error('Vendor balances need a connection. Try again when you are back online.');
	const user = auth.currentUser;
	if (!user) throw new Error('Sign in again to record this.');
	const groupId = requireActiveGroupId();
	const loans = loansCol(groupId);
	const loanId = details.kind === 'loan' ? (details.loanId ?? doc(loans).id) : details.loanId;
	if (!loanId) throw new Error('Choose a loan.');
	const loanRef = doc(loans, loanId);
	const id = operationId ?? doc(collection(loanRef, 'entries')).id;
	const entryRef = doc(loanRef, 'entries', id);
	const action = { ...details, id, loanId, user: user.email || user.uid };
	const createdAt = Date.now();

	return runTransaction(db, applyAction).catch((error) => {
		if (error?.code === 'permission-denied')
			throw new Error(
				'The database refused this change. If vendor balances are new, their Firestore rules may not be deployed yet.'
			);
		throw error;
	});

	async function applyAction(transaction) {
		const [entry, loanSnap] = await Promise.all([
			transaction.get(entryRef),
			transaction.get(loanRef)
		]);
		if (entry.exists()) return { status: 'duplicate', loanId, operationId: id };
		if (requireActiveGroupId() !== groupId)
			throw new Error('Workspace changed. Nothing was saved.');
		const loan = loanSnap.exists() ? loanSnap.data() : null;
		const itemId = details.kind === 'loan' ? details.itemId : loan?.itemId;
		const itemRef = itemId ? doc(db, 'groups', groupId, 'items', itemId) : null;
		const itemSnap = itemRef ? await transaction.get(itemRef) : null;
		const item = itemSnap?.exists() ? { ...itemSnap.data(), id: itemSnap.id } : null;

		const plan = planVendorAction(action, loan, item);
		const now = serverTimestamp();
		transaction.set(loanRef, {
			...plan.loan,
			...(loan ? {} : { createdAt: now }),
			updatedAt: now
		});
		transaction.set(entryRef, { ...plan.entry, timestamp: now });
		if (plan.stock) {
			transaction.update(itemRef, {
				count: plan.stock.item.count,
				stockByStorage: plan.stock.item.stockByStorage,
				stockRevision: plan.stock.item.stockRevision
			});
			transaction.set(doc(db, 'groups', groupId, 'transactions', id), {
				...plan.stock.ledger,
				timestamp: Timestamp.fromMillis(createdAt),
				syncedAt: now
			});
		}
		return { status: 'applied', loanId, operationId: id };
	}
}
