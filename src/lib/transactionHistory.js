/**
 * Pure helpers behind the season-scoped transaction-history view.
 *
 * The ledger is append-only and grows forever, so the page cannot load all of
 * it. It is also, in practice, a stack of annual CNE runs: real activity is
 * concentrated in a few weeks each August, with only scattered off-season rows
 * between them. So the page scopes to one season at a time and loads it whole —
 * bounded (the largest season on record is ~2,250 rows), complete (every figure
 * covers the season entirely, with no "latest N" caveat), and flat as the ledger
 * grows, since next season's view carries none of this season's rows.
 *
 * Scoping to the season rather than the calendar year also keeps off-season
 * testing out of the figures. Rows written between fairs have included counts
 * like 500,000 typed into an item named "#1"; summed over a calendar year those
 * six rows swamped every real movement in the stats.
 */

/**
 * @typedef {import('../types').Transaction} Transaction
 */

// The season window, as month (0-indexed) and day. Wide enough to cover setup
// and teardown around the 18-day fair, narrow enough to exclude the off-season
// months where test data lives.
//
// NOTE: an August 15th start also excludes real pre-fair stocking — 246 rows in
// 2024 (ground beef, cheese curds, red onions...) and 344 in 2025. Setting
// SEASON_START.day to 1 keeps all of that and still excludes every known junk
// row, since those are all in January and July.
const SEASON_START = { month: 7, day: 15 };
const SEASON_END = { month: 8, day: 15 };

/**
 * Half-open date range covering one CNE season, `start` inclusive to `end`
 * exclusive. The end day itself is fully included.
 *
 * Local midnight on both edges, which is what the user means by a date.
 * @param {number} year - Four-digit year of the season.
 * @returns {{ start: Date, end: Date }} The range to query.
 */
export function seasonRange(year) {
	return {
		start: new Date(year, SEASON_START.month, SEASON_START.day),
		end: new Date(year, SEASON_END.month, SEASON_END.day + 1)
	};
}

/**
 * Which season to show by default.
 *
 * Between fairs there is no current season, and defaulting to one that hasn't
 * opened would show an empty page for most of the year. Fall back to the most
 * recent season that actually happened.
 * @param {Date} [today] - Overridable for tests.
 * @returns {number} The season year to open on.
 */
export function currentSeasonYear(today = new Date()) {
	const year = today.getFullYear();
	return today < seasonRange(year).start ? year - 1 : year;
}

/**
 * The years a user can choose between, newest first.
 *
 * Derived from the oldest row in the ledger rather than hardcoded, so a group
 * that started last season doesn't get offered empty seasons, and next season
 * appears without a code change.
 * @param {number | null} earliestYear - Year of the oldest transaction, or null if unknown.
 * @param {number} latestYear - The season to count back from, normally the current one.
 * @returns {number[]} Selectable seasons, newest first; always at least `latestYear`.
 */
export function availableYears(earliestYear, latestYear) {
	if (!earliestYear || earliestYear > latestYear) return [latestYear];
	const years = [];
	for (let year = latestYear; year >= earliestYear; year--) years.push(year);
	return years;
}

/**
 * Express a type filter as field equality matches a Firestore query can apply.
 *
 * These filters used to be answered by downloading the whole ledger and
 * filtering in JS, which cost one read per record in the group. Firestore can
 * apply them itself for the price of the rows you actually show — but only
 * over fields that are written down, which is why `event` had to be backfilled
 * onto legacy rows (see src/scripts/backfill-transaction-events.js).
 *
 * Stock filters have to pin `event` as well as `type`: an itemCreated row is
 * written with type 'add' and an itemDeleted row with type 'remove'
 * (src/lib/items.js), so matching on `type` alone would file every item
 * creation under "Stock added".
 * @param {string} filter - '' | 'add' | 'remove' | 'itemCreated' | 'itemDeleted'.
 * @returns {Array<[string, string]>} `[field, value]` pairs; empty for no filter.
 */
export function transactionFilterMatches(filter) {
	if (!filter) return [];
	if (['itemCreated', 'itemDeleted', 'stockTransfer', 'itemMerged'].includes(filter))
		return [['event', filter]];
	return [
		['event', 'countChange'],
		['type', filter]
	];
}

/**
 * Whether a Firestore error means the query needs an index that isn't ready.
 *
 * Filtering by type within a season needs a composite index. Those are deployed
 * (firestore.indexes.json), but Firestore builds indexes asynchronously, so a
 * fresh deploy can fail this way for a few minutes — worth telling the user
 * apart from a real failure, since it fixes itself.
 * @param {unknown} error - The error from a Firestore listener or read.
 * @returns {boolean} True when the failure is a missing or still-building index.
 */
export function isMissingIndexError(error) {
	return Boolean(error) && /** @type {{ code?: string }} */ (error).code === 'failed-precondition';
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
