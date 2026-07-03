/**
 * @typedef {import('../types').Transaction} Transaction
 */

/**
 * @typedef {object} ClockAnomaly
 * @property {Transaction} transaction - The flagged transaction.
 * @property {'future' | 'stale'} kind - Which rule tripped.
 * @property {number} gapMs - syncedAt − timestamp, in ms. Negative means the
 *   device timestamp is ahead of the server (the impossible "future" case).
 */

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

/**
 * Flags transactions whose device `timestamp` is implausible relative to the
 * server `syncedAt` time — the only trustworthy clock, since the device can't
 * fake when a write actually reaches Firestore.
 *
 * Two rules:
 * - `future`: timestamp is meaningfully *after* syncedAt. A change can't sync
 *   before it happened, so this is a definitive wrong-clock (clock set ahead).
 * - `stale`: syncedAt is far *after* timestamp. Either a behind clock or a
 *   genuinely long offline stretch — the server can't tell which, so these are
 *   surfaced for a human to judge, not auto-condemned.
 *
 * Records missing either timestamp (legacy rows, or offline writes not yet
 * synced) can't be audited and are skipped.
 * @param {Transaction[]} transactions - Transactions with Date timestamp/syncedAt.
 * @param {object} [options]
 * @param {number} [options.futureToleranceMs] - Allowed timestamp-ahead-of-sync
 *   skew before flagging `future` (default 5 min, covers normal clock drift).
 * @param {number} [options.staleThresholdMs] - Gap beyond which to flag `stale`
 *   for review (default 2 days).
 * @returns {ClockAnomaly[]} The flagged transactions, most extreme gap first.
 */
export function findClockAnomalies(transactions, options = {}) {
	const futureToleranceMs = options.futureToleranceMs ?? 5 * MINUTE;
	const staleThresholdMs = options.staleThresholdMs ?? 2 * DAY;

	/** @type {ClockAnomaly[]} */
	const anomalies = [];

	for (const transaction of transactions) {
		const ts = toMillis(transaction.timestamp);
		const sy = toMillis(transaction.syncedAt);
		if (ts === null || sy === null) continue; // can't audit without both clocks

		const gapMs = sy - ts;
		if (gapMs < -futureToleranceMs) {
			anomalies.push({ transaction, kind: 'future', gapMs });
		} else if (gapMs > staleThresholdMs) {
			anomalies.push({ transaction, kind: 'stale', gapMs });
		}
	}

	// Rank by how far off the clock looks: future cases (negative gap) by
	// magnitude, then the largest stale gaps.
	return anomalies.sort((a, b) => Math.abs(b.gapMs) - Math.abs(a.gapMs));
}

/**
 * Coerces a Date, millisecond number, or ISO string to milliseconds, or null
 * if the value is missing/unparseable.
 * @param {Date | number | string | null | undefined} value - The time value.
 * @returns {number | null} Milliseconds since epoch, or null.
 */
function toMillis(value) {
	if (value == null) return null;
	const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
	return Number.isNaN(ms) ? null : ms;
}
