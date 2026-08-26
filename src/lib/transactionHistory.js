/**
 * Pure helpers behind the bounded transaction-history view.
 *
 * The history page listens to only the newest `RECENT_WINDOW_SIZE` transactions
 * so first paint doesn't scale with ledger size, then loads the rest on demand.
 * The window/full-ledger bookkeeping that makes that safe lives here so it can
 * be tested without a component or a Firestore connection.
 */

/**
 * @typedef {import('../types').Transaction} Transaction
 */

/**
 * Merge the live (bounded) listener window over a previously fetched full
 * ledger, keyed by id, with the live copy winning.
 *
 * The full ledger is a one-shot read taken at escalation time, so anything
 * written afterwards exists only in the live window — merging is what keeps
 * realtime updates working once the view has escalated. The ledger is
 * append-only (deleting an item writes an `itemDeleted` row rather than
 * removing history), so a merge can never strand a row that should be gone.
 * @param {Transaction[] | null} fullTransactions - The full ledger, or null if not loaded.
 * @param {Transaction[]} recentTransactions - The live listener window.
 * @returns {Transaction[]} Every known transaction, deduplicated by id.
 */
export function mergeTransactionWindows(fullTransactions, recentTransactions) {
	if (!fullTransactions) return recentTransactions;

	const byId = new Map();
	for (const transaction of fullTransactions) byId.set(transaction.id, transaction);
	for (const transaction of recentTransactions) byId.set(transaction.id, transaction);
	return [...byId.values()];
}

/**
 * Whether the live window already holds the entire ledger.
 *
 * Firestore returning fewer documents than the limit means it ran out, so the
 * window is the whole ledger and escalating would be a redundant read. Only
 * meaningful once the first snapshot has arrived — an empty window before then
 * says nothing about the ledger's size.
 * @param {boolean} received - Whether the first snapshot has landed.
 * @param {number} windowSize - How many records the live window holds.
 * @param {number} windowCap - The limit the listener was created with.
 * @returns {boolean} True when the window is known to cover everything.
 */
export function windowCoversLedger(received, windowSize, windowCap) {
	return received && windowSize < windowCap;
}

/**
 * Whether a pagination state needs records the live window can't supply.
 *
 * The "all" page size counts as needing everything — otherwise it would quietly
 * mean "all of the newest 250".
 * @param {object} params - Pagination state.
 * @param {boolean} params.received - Whether the first snapshot has landed.
 * @param {number} params.windowSize - How many records the live window holds.
 * @param {number} params.page - The 1-based current page.
 * @param {number | 'all'} params.perPage - The page size, or 'all'.
 * @returns {boolean} True when the full ledger should be loaded.
 */
export function paginationNeedsFullHistory({ received, windowSize, page, perPage }) {
	// Before the first snapshot the window is empty, and escalating off an empty
	// window would pull the whole ledger on every page load — precisely what the
	// bounded listener exists to prevent.
	if (!received) return false;
	if (perPage === 'all') return true;
	return page * perPage > windowSize;
}

/**
 * Calendar-day bucket key for a transaction timestamp.
 *
 * Local-time based, so a day boundary matches what the user sees on their own
 * clock. Shared between the timeline (which groups rows) and the page (which
 * counts them) so the two can never disagree about which day a row falls in.
 * @param {Date | string | number} date - The transaction timestamp.
 * @returns {string} A key identifying that calendar day.
 */
export function transactionDayKey(date) {
	const d = new Date(date);
	return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/**
 * Count transactions per calendar day.
 *
 * The timeline renders one page at a time, so counting the rows it was handed
 * would report "however many of that day's changes landed on this page" — which
 * is why a day showing 65 changes read as "10 changes" on a 10-per-page view.
 * Counting over the whole filtered set instead gives the day its real total.
 * @param {Transaction[]} transactions - The filtered set, not the current page.
 * @returns {Map<string, number>} Day key to number of transactions that day.
 */
export function countTransactionsByDay(transactions) {
	const counts = new Map();
	for (const transaction of transactions) {
		const key = transactionDayKey(transaction.timestamp);
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}
	return counts;
}
