import { createSeasonHistoryFeed } from '../transactions';
import { isMissingIndexError } from '../transactionHistory';

/**
 * @typedef {import('../../types').Transaction} Transaction
 */

/**
 * Reactive state for the history page's live season feed: the rows on screen and
 * whether the latest query has answered, failed, or is waiting on an index.
 *
 * `received` flips once the current query's first snapshot lands, so an empty
 * state only shows after real data has come back, not during the wait.
 * @returns {{
 *   readonly transactions: Transaction[],
 *   readonly received: boolean,
 *   readonly indexPending: boolean,
 *   readonly loadFailed: boolean,
 *   show: function({ year: number, filter?: string }): void,
 *   stop: function(): void
 * }} The feed state and its controls.
 */
export function createSeasonHistory() {
	// $state.raw because the rows are only ever reassigned wholesale from a
	// snapshot, never mutated — deep proxying would cost per-property access traps
	// on every filter, stats pass and sort comparison, and buy nothing.
	let transactions = $state.raw([]);
	let received = $state(false);
	// Set when a query fails because its composite index is still building. Index
	// builds are asynchronous, so a fresh deploy can fail this way for a few
	// minutes and then start working on its own — worth saying, since retrying is
	// genuinely the right response.
	let indexPending = $state(false);
	let loadFailed = $state(false);
	/** @type {ReturnType<typeof createSeasonHistoryFeed> | null} */
	let feed = null;

	const fail = (/** @type {boolean} */ missingIndex) => {
		indexPending = missingIndex;
		loadFailed = !missingIndex;
		transactions = [];
		received = true;
	};

	return {
		get transactions() {
			return transactions;
		},
		get received() {
			return received;
		},
		get indexPending() {
			return indexPending;
		},
		get loadFailed() {
			return loadFailed;
		},
		/**
		 * Point the feed at a season and filter. Both are query parameters, so changing
		 * either re-queries rather than re-processing a superset fetched for a different
		 * question; the feed keeps its history-review listener across these switches.
		 * @param {{ year: number, filter?: string }} options - The season and view filter.
		 */
		show(options) {
			// The rows on screen answer the previous query. Leave them visible so the
			// list doesn't blank out mid-switch, but don't let `received` claim the new
			// snapshot has landed.
			received = false;
			indexPending = false;
			loadFailed = false;
			try {
				feed ??= createSeasonHistoryFeed(
					(rows) => {
						transactions = rows;
						received = true;
						indexPending = false;
						loadFailed = false;
					},
					// "The index is still building, try again shortly" fixes itself; a real
					// failure doesn't.
					(error) => fail(isMissingIndexError(error))
				);
				feed.show(options);
			} catch (error) {
				console.error('Error setting up transactions subscription:', error);
				fail(false);
			}
		},
		stop() {
			feed?.stop();
		}
	};
}
