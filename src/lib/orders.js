import { deleteDoc, doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { requireActiveGroupId } from './activeGroup';
import { normalizeDraft } from './orderSheet';

/**
 * @typedef {import('../types').OrderDraft} OrderDraft
 * @typedef {import('../types').OrderLine} OrderLine
 */

// ————————————————————————————————————————————————————————————————————————
// Shared order drafts
//
// One document per order day at `groups/{gid}/orders/{YYYY-MM-DD}`, so the
// order a staff member builds on the floor is the same document the owner
// opens to review it. Only the user's *edits* are stored (see OrderLine) —
// never the computed suggestions — so reopening a draft picks up a refreshed
// forecast instead of freezing the numbers from whenever it was last saved.
//
// Concurrency is last-write-wins, which suits one small team editing one day's
// order; every save stamps updatedBy/updatedAt so a surprising change is at
// least attributable.
// ————————————————————————————————————————————————————————————————————————

/**
 * Guard against a malformed day key reaching a document path (a stray `/`
 * would silently write to a nested collection).
 * @param {string} dayKey - ISO day key (YYYY-MM-DD)
 * @returns {string} The validated key
 */
function assertDayKey(dayKey) {
	if (typeof dayKey !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) {
		throw new Error(`Invalid order day key: ${dayKey}`);
	}
	return dayKey;
}

/**
 * @param {string} dayKey - ISO day key (YYYY-MM-DD)
 * @returns {import('firebase/firestore').DocumentReference} The order doc in the active group.
 */
function orderDoc(dayKey) {
	return doc(db, 'groups', requireActiveGroupId(), 'orders', assertDayKey(dayKey));
}

/**
 * Read one day's saved order draft.
 * @param {string} dayKey - ISO day key (YYYY-MM-DD) of the order day
 * @returns {Promise<ReturnType<typeof normalizeDraft>>} The normalized draft
 *   (empty lines when no draft has been saved for that day).
 */
export async function getOrderDraft(dayKey) {
	const snapshot = await getDoc(orderDoc(dayKey));
	return normalizeDraft(snapshot.exists() ? snapshot.data() : null);
}

/**
 * Write one day's order draft, replacing the stored edits wholesale — the
 * caller owns the full line map, so a merge would resurrect lines the user
 * just reset.
 * @param {string} dayKey - ISO day key (YYYY-MM-DD) of the order day
 * @param {object} draft
 * @param {Object.<string, OrderLine>} draft.lines - Per-item edits
 * @param {number} draft.coverageDays - Coverage the quantities were sized for
 * @param {number} draft.leadDays - Delivery lead the quantities were sized for
 * @param {string} draft.updatedBy - Display name of whoever is saving
 * @returns {Promise<void>}
 */
export async function saveOrderDraft(dayKey, { lines, coverageDays, leadDays, updatedBy }) {
	await setDoc(orderDoc(dayKey), {
		lines: lines ?? {},
		coverageDays,
		leadDays,
		updatedBy: updatedBy || '',
		updatedAt: serverTimestamp()
	});
}

/**
 * Delete a day's draft, returning the page to pure suggestions.
 * @param {string} dayKey - ISO day key (YYYY-MM-DD) of the order day
 * @returns {Promise<void>}
 */
export async function clearOrderDraft(dayKey) {
	await deleteDoc(orderDoc(dayKey));
}

/**
 * Watch one day's draft so a change made on another device shows up live.
 *
 * The callback receives `local: true` for the optimistic echo of this client's
 * own write (Firestore fires the listener before the server round-trip
 * completes). Callers should ignore those — re-applying your own in-flight
 * save on top of newer local typing would fight the user's cursor.
 * @param {string} dayKey - ISO day key (YYYY-MM-DD) of the order day
 * @param {(draft: ReturnType<typeof normalizeDraft>, meta: {local: boolean}) => void} onChange
 * @param {(error: Error) => void} [onError] - Called if the listener detaches
 * @returns {() => void} Unsubscribe function
 */
export function subscribeOrderDraft(dayKey, onChange, onError) {
	return onSnapshot(
		orderDoc(dayKey),
		(snapshot) => {
			onChange(normalizeDraft(snapshot.exists() ? snapshot.data() : null), {
				local: snapshot.metadata.hasPendingWrites
			});
		},
		(error) => {
			console.error('Order draft listener error:', error);
			onError?.(error);
		}
	);
}
