import { db } from '../firebase';
import { collection, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';

/**
 * @typedef {import('../types').Transaction} Transaction
 * @typedef {import('../types').DailyAnalysis} DailyAnalysis
 * @typedef {import('../types').ItemDailyStats} ItemDailyStats
 * @typedef {import('../types').HourlyActivity} HourlyActivity
 * @typedef {import('../types').TopMover} TopMover
 */

// ---------------------------------------------------------------------------
// Data fetching — keep the Firestore reads in one place so the analytics page
// reads each window once and feeds the pure transforms below.
// ---------------------------------------------------------------------------

/**
 * Fetch all transactions within [startDate, endDate], sorted ascending, with
 * Firestore Timestamps normalized to JS Dates.
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Promise<Transaction[]>}
 */
export async function fetchTransactionsInRange(startDate, endDate) {
	const transactionsRef = collection(db, 'transactions');
	const q = query(
		transactionsRef,
		where('timestamp', '>=', Timestamp.fromDate(startDate)),
		where('timestamp', '<=', Timestamp.fromDate(endDate)),
		orderBy('timestamp', 'asc')
	);

	const querySnapshot = await getDocs(q);
	return querySnapshot.docs.map((doc) => ({
		id: doc.id,
		...doc.data(),
		timestamp: doc.data().timestamp.toDate()
	}));
}

// Catalog data changes rarely, so cache the item count for the session. Guarded
// browser-only: on the server `window` is undefined, so this module-level cache
// is never populated and one request's catalog can't bleed into another's.
//
// KNOWN LIMITATION: clearItemCountCache() is intentionally NOT called from the
// item create/delete paths. Wiring it from items.js would invert the layering
// (items.js -> transactionAnalysis.js). So the cached count only refreshes on a
// full reload. The single user-visible effect is summaryStats.inactiveItems
// going stale mid-session after items are added/deleted (see computeSummaryStats);
// nothing inventory- or transaction-related is affected. If this ever needs
// wiring, extract the cache into its own tiny module that both items.js and this
// module import — do NOT add a cross-import here.
const isBrowser = typeof window !== 'undefined';
let itemCountCache = null;

/** Clear the cached item count. Currently unwired by design — see note above. */
export function clearItemCountCache() {
	itemCountCache = null;
}

/**
 * Total number of items in the catalog. Cached per session in the browser.
 * @returns {Promise<number>}
 */
export async function getTotalItemCount() {
	if (isBrowser && itemCountCache !== null) {
		return itemCountCache;
	}
	const snapshot = await getDocs(collection(db, 'items'));
	const count = snapshot.size;
	if (isBrowser) {
		itemCountCache = count;
	}
	return count;
}

/**
 * Resolve an explicit date range, falling back to the trailing `days` window.
 * @param {number} days
 * @param {Date | null} startDate
 * @param {Date | null} endDate
 * @returns {{ startDate: Date, endDate: Date }}
 */
function resolveRange(days, startDate, endDate) {
	if (!startDate || !endDate) {
		endDate = new Date();
		startDate = new Date();
		startDate.setDate(startDate.getDate() - days);
	}
	return { startDate, endDate };
}

// ---------------------------------------------------------------------------
// Pure transforms — no I/O. Each takes an already-fetched transaction array so
// a single window read can feed all of them (see getAnalyticsForRange).
// ---------------------------------------------------------------------------

/**
 * Group transactions into per-day totals, filling gaps in the range with zeros.
 * @param {Transaction[]} transactions
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {DailyAnalysis[]}
 */
export function computeDailyAnalysis(transactions, startDate, endDate) {
	const dailyMap = new Map();

	transactions.forEach((transaction) => {
		const dateKey = transaction.timestamp.toISOString().split('T')[0];

		if (!dailyMap.has(dateKey)) {
			dailyMap.set(dateKey, {
				date: dateKey,
				totalAdded: 0,
				totalRemoved: 0,
				netChange: 0,
				transactionCount: 0,
				itemStats: {}
			});
		}

		const daily = dailyMap.get(dateKey);
		// Ensure we have valid numbers
		const previousCount = parseInt(transaction.previousCount) || 0;
		const newCount = parseInt(transaction.newCount) || 0;
		const changeAmount = newCount - previousCount;

		daily.transactionCount++;

		if (changeAmount > 0) {
			daily.totalAdded += changeAmount;
		} else {
			daily.totalRemoved += Math.abs(changeAmount);
		}

		daily.netChange += changeAmount;

		// Update item-specific stats
		if (!daily.itemStats[transaction.itemId]) {
			daily.itemStats[transaction.itemId] = {
				itemId: transaction.itemId,
				itemName: transaction.itemName,
				added: 0,
				removed: 0,
				netChange: 0,
				transactionCount: 0
			};
		}

		const itemStats = daily.itemStats[transaction.itemId];
		itemStats.transactionCount++;

		if (changeAmount > 0) {
			itemStats.added += changeAmount;
		} else {
			itemStats.removed += Math.abs(changeAmount);
		}

		itemStats.netChange += changeAmount;
	});

	// Fill in missing days with zero values
	const allDays = [];
	const currentDate = new Date(startDate);
	const endDateCopy = new Date(endDate);

	while (currentDate <= endDateCopy) {
		const dateKey = currentDate.toISOString().split('T')[0];
		if (dailyMap.has(dateKey)) {
			allDays.push(dailyMap.get(dateKey));
		} else {
			// Add empty day
			allDays.push({
				date: dateKey,
				totalAdded: 0,
				totalRemoved: 0,
				netChange: 0,
				transactionCount: 0,
				itemStats: {}
			});
		}
		currentDate.setDate(currentDate.getDate() + 1);
	}

	return allDays;
}

/**
 * Bucket transactions by hour of day (0–23), always returning all 24 buckets.
 * @param {Transaction[]} transactions
 * @returns {HourlyActivity[]}
 */
export function computeHourlyActivityPattern(transactions) {
	const hourlyMap = new Map();

	// Initialize all hours
	for (let hour = 0; hour < 24; hour++) {
		hourlyMap.set(hour, {
			hour,
			transactionCount: 0,
			totalChange: 0
		});
	}

	transactions.forEach((transaction) => {
		const hour = transaction.timestamp.getHours();
		const previousCount = parseInt(transaction.previousCount) || 0;
		const newCount = parseInt(transaction.newCount) || 0;
		const changeAmount = newCount - previousCount;

		const hourData = hourlyMap.get(hour);
		hourData.transactionCount++;
		hourData.totalChange += Math.abs(changeAmount);
	});

	return Array.from(hourlyMap.values());
}

/**
 * Rank items by transaction count and compute per-item volatility.
 * @param {Transaction[]} transactions
 * @param {number} [limit=10]
 * @returns {TopMover[]}
 */
export function computeTopMovers(transactions, limit = 10) {
	const itemMap = new Map();

	transactions.forEach((transaction) => {
		const previousCount = parseInt(transaction.previousCount) || 0;
		const newCount = parseInt(transaction.newCount) || 0;
		const changeAmount = newCount - previousCount;

		if (!itemMap.has(transaction.itemId)) {
			itemMap.set(transaction.itemId, {
				itemId: transaction.itemId,
				itemName: transaction.itemName,
				totalTransactions: 0,
				totalAdded: 0,
				totalRemoved: 0,
				netChange: 0,
				dailyChanges: []
			});
		}

		const item = itemMap.get(transaction.itemId);
		item.totalTransactions++;

		if (changeAmount > 0) {
			item.totalAdded += changeAmount;
		} else {
			item.totalRemoved += Math.abs(changeAmount);
		}

		item.netChange += changeAmount;
		item.dailyChanges.push(changeAmount);
	});

	// Calculate volatility (standard deviation). An item only lands in the map
	// via a transaction, so totalTransactions >= 1; guard anyway for safety.
	const topMovers = Array.from(itemMap.values()).map((item) => {
		const mean = item.totalTransactions ? item.netChange / item.totalTransactions : 0;
		const variance = item.totalTransactions
			? item.dailyChanges.reduce((sum, change) => sum + Math.pow(change - mean, 2), 0) /
				item.totalTransactions
			: 0;
		const volatility = Math.sqrt(variance);

		return {
			itemId: item.itemId,
			itemName: item.itemName,
			totalTransactions: item.totalTransactions,
			totalAdded: item.totalAdded,
			totalRemoved: item.totalRemoved,
			netChange: item.netChange,
			volatility: Math.round(volatility * 100) / 100
		};
	});

	// Sort by transaction count and return top N
	return topMovers.sort((a, b) => b.totalTransactions - a.totalTransactions).slice(0, limit);
}

/**
 * Summary statistics for a window. `totalItems` is the catalog size, used to
 * derive inactive items.
 * @param {Transaction[]} transactions
 * @param {number} totalItems
 * @returns {{totalTransactions: number, totalAdded: number, totalRemoved: number, netChange: number, uniqueItems: number, totalItems: number, inactiveItems: number, newItemsCreated: number, itemsDeleted: number}}
 */
export function computeSummaryStats(transactions, totalItems) {
	const uniqueItems = new Set();
	let totalTransactions = 0;
	let totalAdded = 0;
	let totalRemoved = 0;
	let netChange = 0;
	let newItemsCreated = 0;
	let itemsDeleted = 0;

	transactions.forEach((transaction) => {
		// Ensure we have valid numbers
		const previousCount = parseInt(transaction.previousCount) || 0;
		const newCount = parseInt(transaction.newCount) || 0;
		const changeAmount = newCount - previousCount;

		totalTransactions++;
		uniqueItems.add(transaction.itemId);

		// Check for new item creation (type: 'add' with previousCount: 0)
		if (transaction.type === 'add' && previousCount === 0) {
			newItemsCreated++;
		}

		// Check for item deletion (type: 'remove' with newCount: 0)
		if (transaction.type === 'remove' && newCount === 0) {
			itemsDeleted++;
		}

		if (changeAmount > 0) {
			totalAdded += changeAmount;
		} else {
			totalRemoved += Math.abs(changeAmount);
		}

		netChange += changeAmount;
	});

	const activeItems = uniqueItems.size || 0;
	const safeTotalItems = totalItems || 0;

	return {
		totalTransactions: totalTransactions || 0,
		totalAdded: totalAdded || 0,
		totalRemoved: totalRemoved || 0,
		netChange: netChange || 0,
		uniqueItems: activeItems,
		totalItems: safeTotalItems,
		// NOTE: totalItems comes from a session-long cache (see getTotalItemCount /
		// clearItemCountCache). After items are added/deleted mid-session this count
		// — and therefore inactiveItems — can be stale until a full reload.
		inactiveItems: safeTotalItems - activeItems,
		newItemsCreated: newItemsCreated || 0,
		itemsDeleted: itemsDeleted || 0
	};
}

// ---------------------------------------------------------------------------
// Orchestrator — single window read fanning out to every transform. Use this
// from pages that need more than one analysis for the same range.
// ---------------------------------------------------------------------------

/**
 * Fetch a date-range window once and run every analysis transform over it.
 * @param {Date} startDate
 * @param {Date} endDate
 * @param {{ topMoversLimit?: number }} [options]
 * @returns {Promise<{daily: DailyAnalysis[], hourly: HourlyActivity[], topMovers: TopMover[], summary: ReturnType<typeof computeSummaryStats>}>}
 */
export async function getAnalyticsForRange(startDate, endDate, { topMoversLimit = 10 } = {}) {
	const [transactions, totalItems] = await Promise.all([
		fetchTransactionsInRange(startDate, endDate),
		getTotalItemCount()
	]);

	return {
		daily: computeDailyAnalysis(transactions, startDate, endDate),
		hourly: computeHourlyActivityPattern(transactions),
		topMovers: computeTopMovers(transactions, topMoversLimit),
		summary: computeSummaryStats(transactions, totalItems)
	};
}

// ---------------------------------------------------------------------------
// Thin wrappers — fetch-then-transform. Preserve the original API so existing
// individual callers keep working; prefer getAnalyticsForRange for combined use.
// ---------------------------------------------------------------------------

/**
 * Get daily analysis for a date range
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Promise<DailyAnalysis[]>}
 */
export async function getDailyAnalysis(startDate, endDate) {
	try {
		const transactions = await fetchTransactionsInRange(startDate, endDate);
		return computeDailyAnalysis(transactions, startDate, endDate);
	} catch (error) {
		console.error('Error getting daily analysis:', error);
		throw error;
	}
}

/**
 * Get hourly activity pattern for a date range
 * @param {number} days - Fallback trailing window when no dates are provided
 * @param {Date | null} startDate
 * @param {Date | null} endDate
 * @returns {Promise<HourlyActivity[]>}
 */
export async function getHourlyActivityPattern(days = 30, startDate = null, endDate = null) {
	try {
		({ startDate, endDate } = resolveRange(days, startDate, endDate));
		const transactions = await fetchTransactionsInRange(startDate, endDate);
		return computeHourlyActivityPattern(transactions);
	} catch (error) {
		console.error('Error getting hourly activity pattern:', error);
		throw error;
	}
}

/**
 * Get top moving items by transaction count
 * @param {number} limit
 * @param {number} days - Fallback trailing window when no dates are provided
 * @param {Date | null} startDate
 * @param {Date | null} endDate
 * @returns {Promise<TopMover[]>}
 */
export async function getTopMovers(limit = 10, days = 30, startDate = null, endDate = null) {
	try {
		({ startDate, endDate } = resolveRange(days, startDate, endDate));
		const transactions = await fetchTransactionsInRange(startDate, endDate);
		return computeTopMovers(transactions, limit);
	} catch (error) {
		console.error('Error getting top movers:', error);
		throw error;
	}
}

/**
 * Get summary statistics for a date range
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Promise<ReturnType<typeof computeSummaryStats>>}
 */
export async function getSummaryStats(startDate, endDate) {
	try {
		const [transactions, totalItems] = await Promise.all([
			fetchTransactionsInRange(startDate, endDate),
			getTotalItemCount()
		]);
		return computeSummaryStats(transactions, totalItems);
	} catch (error) {
		console.error('Error getting summary stats:', error);
		// Return default values on error
		return {
			totalTransactions: 0,
			totalAdded: 0,
			totalRemoved: 0,
			netChange: 0,
			uniqueItems: 0,
			totalItems: 0,
			inactiveItems: 0,
			newItemsCreated: 0,
			itemsDeleted: 0
		};
	}
}

/**
 * Get item-specific daily statistics
 * @param {string} itemId
 * @param {number} days
 * @returns {Promise<DailyAnalysis[]>}
 */
export async function getItemDailyStats(itemId, days = 30) {
	try {
		const startDate = new Date();
		startDate.setDate(startDate.getDate() - days);

		const transactionsRef = collection(db, 'transactions');
		const q = query(
			transactionsRef,
			where('itemId', '==', itemId),
			where('timestamp', '>=', Timestamp.fromDate(startDate)),
			orderBy('timestamp', 'asc')
		);

		const querySnapshot = await getDocs(q);
		const dailyMap = new Map();

		querySnapshot.docs.forEach((doc) => {
			const data = doc.data();
			const timestamp = data.timestamp.toDate();
			const dateKey = timestamp.toISOString().split('T')[0];
			const changeAmount = data.newCount - data.previousCount;

			if (!dailyMap.has(dateKey)) {
				dailyMap.set(dateKey, {
					date: dateKey,
					totalAdded: 0,
					totalRemoved: 0,
					netChange: 0,
					transactionCount: 0,
					itemStats: {}
				});
			}

			const daily = dailyMap.get(dateKey);
			daily.transactionCount++;

			if (changeAmount > 0) {
				daily.totalAdded += changeAmount;
			} else {
				daily.totalRemoved += Math.abs(changeAmount);
			}

			daily.netChange += changeAmount;

			// Add item stats for consistency
			daily.itemStats[itemId] = {
				itemId: data.itemId,
				itemName: data.itemName,
				added: daily.totalAdded,
				removed: daily.totalRemoved,
				netChange: daily.netChange,
				transactionCount: daily.transactionCount
			};
		});

		return Array.from(dailyMap.values()).sort(
			(a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
		);
	} catch (error) {
		console.error('Error getting item daily stats:', error);
		throw error;
	}
}
