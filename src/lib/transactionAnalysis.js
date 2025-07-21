import { db } from '../firebase';
import {
	collection,
	getDocs,
	query,
	where,
	orderBy,
	Timestamp
} from 'firebase/firestore';

/**
 * @typedef {import('../types').Transaction} Transaction
 * @typedef {import('../types').DailyAnalysis} DailyAnalysis
 * @typedef {import('../types').ItemDailyStats} ItemDailyStats
 * @typedef {import('../types').HourlyActivity} HourlyActivity
 * @typedef {import('../types').TopMover} TopMover
 */

/**
 * Get daily analysis for a date range
 * @param {Date} startDate 
 * @param {Date} endDate 
 * @returns {Promise<DailyAnalysis[]>}
 */
export async function getDailyAnalysis(startDate, endDate) {
	try {
		const transactionsRef = collection(db, 'transactions');
		const q = query(
			transactionsRef,
			where('timestamp', '>=', Timestamp.fromDate(startDate)),
			where('timestamp', '<=', Timestamp.fromDate(endDate)),
			orderBy('timestamp', 'asc')
		);

		const querySnapshot = await getDocs(q);
		const transactions = querySnapshot.docs.map(doc => ({
			id: doc.id,
			...doc.data(),
			timestamp: doc.data().timestamp.toDate()
		}));

		// Group transactions by date
		const dailyMap = new Map();

		transactions.forEach(transaction => {
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
	} catch (error) {
		console.error('Error getting daily analysis:', error);
		throw error;
	}
}

/**
 * Get hourly activity pattern for a date range
 * @param {number} days - Not used anymore, kept for compatibility
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Promise<HourlyActivity[]>}
 */
export async function getHourlyActivityPattern(days = 30, startDate = null, endDate = null) {
	try {
		// Use provided dates or fall back to days calculation
		if (!startDate || !endDate) {
			endDate = new Date();
			startDate = new Date();
			startDate.setDate(startDate.getDate() - days);
		}
		
		const transactionsRef = collection(db, 'transactions');
		const q = query(
			transactionsRef,
			where('timestamp', '>=', Timestamp.fromDate(startDate)),
			where('timestamp', '<=', Timestamp.fromDate(endDate)),
			orderBy('timestamp', 'asc')
		);

		const querySnapshot = await getDocs(q);
		const hourlyMap = new Map();

		// Initialize all hours
		for (let hour = 0; hour < 24; hour++) {
			hourlyMap.set(hour, {
				hour,
				transactionCount: 0,
				totalChange: 0
			});
		}

		querySnapshot.docs.forEach(doc => {
			const data = doc.data();
			const timestamp = data.timestamp.toDate();
			const hour = timestamp.getHours();
			const previousCount = parseInt(data.previousCount) || 0;
			const newCount = parseInt(data.newCount) || 0;
			const changeAmount = newCount - previousCount;

			const hourData = hourlyMap.get(hour);
			hourData.transactionCount++;
			hourData.totalChange += Math.abs(changeAmount);
		});

		return Array.from(hourlyMap.values());
	} catch (error) {
		console.error('Error getting hourly activity pattern:', error);
		throw error;
	}
}

/**
 * Get top moving items by transaction count
 * @param {number} limit
 * @param {number} days - Not used anymore, kept for compatibility
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Promise<TopMover[]>}
 */
export async function getTopMovers(limit = 10, days = 30, startDate = null, endDate = null) {
	try {
		// Use provided dates or fall back to days calculation
		if (!startDate || !endDate) {
			endDate = new Date();
			startDate = new Date();
			startDate.setDate(startDate.getDate() - days);
		}
		
		const transactionsRef = collection(db, 'transactions');
		const q = query(
			transactionsRef,
			where('timestamp', '>=', Timestamp.fromDate(startDate)),
			where('timestamp', '<=', Timestamp.fromDate(endDate)),
			orderBy('timestamp', 'asc')
		);

		const querySnapshot = await getDocs(q);
		const itemMap = new Map();

		querySnapshot.docs.forEach(doc => {
			const data = doc.data();
			const previousCount = parseInt(data.previousCount) || 0;
			const newCount = parseInt(data.newCount) || 0;
			const changeAmount = newCount - previousCount;

			if (!itemMap.has(data.itemId)) {
				itemMap.set(data.itemId, {
					itemId: data.itemId,
					itemName: data.itemName,
					totalTransactions: 0,
					totalAdded: 0,
					totalRemoved: 0,
					netChange: 0,
					dailyChanges: []
				});
			}

			const item = itemMap.get(data.itemId);
			item.totalTransactions++;
			
			if (changeAmount > 0) {
				item.totalAdded += changeAmount;
			} else {
				item.totalRemoved += Math.abs(changeAmount);
			}
			
			item.netChange += changeAmount;
			item.dailyChanges.push(changeAmount);
		});

		// Calculate volatility (standard deviation)
		const topMovers = Array.from(itemMap.values()).map(item => {
			const mean = item.netChange / item.totalTransactions;
			const variance = item.dailyChanges.reduce((sum, change) => 
				sum + Math.pow(change - mean, 2), 0) / item.totalTransactions;
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
		return topMovers
			.sort((a, b) => b.totalTransactions - a.totalTransactions)
			.slice(0, limit);
	} catch (error) {
		console.error('Error getting top movers:', error);
		throw error;
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

		querySnapshot.docs.forEach(doc => {
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

		return Array.from(dailyMap.values()).sort((a, b) => 
			new Date(a.date).getTime() - new Date(b.date).getTime()
		);
	} catch (error) {
		console.error('Error getting item daily stats:', error);
		throw error;
	}
}

/**
 * Get summary statistics for a date range
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Promise<{totalTransactions: number, totalAdded: number, totalRemoved: number, netChange: number, uniqueItems: number, totalItems: number, inactiveItems: number, newItemsCreated: number, itemsDeleted: number}>}
 */
export async function getSummaryStats(startDate, endDate) {
	try {
		const transactionsRef = collection(db, 'transactions');
		const q = query(
			transactionsRef,
			where('timestamp', '>=', Timestamp.fromDate(startDate)),
			where('timestamp', '<=', Timestamp.fromDate(endDate)),
			orderBy('timestamp', 'asc')
		);

		const querySnapshot = await getDocs(q);
		const uniqueItems = new Set();
		let totalTransactions = 0;
		let totalAdded = 0;
		let totalRemoved = 0;
		let netChange = 0;
		let newItemsCreated = 0;
		let itemsDeleted = 0;

		querySnapshot.docs.forEach(doc => {
			const data = doc.data();
			// Ensure we have valid numbers
			const previousCount = parseInt(data.previousCount) || 0;
			const newCount = parseInt(data.newCount) || 0;
			const changeAmount = newCount - previousCount;
			
			totalTransactions++;
			uniqueItems.add(data.itemId);
			
			// Check for new item creation (type: 'add' with previousCount: 0)
			if (data.type === 'add' && previousCount === 0) {
				newItemsCreated++;
			}
			
			// Check for item deletion (type: 'remove' with newCount: 0)
			// Remove the previousCount > 0 check to count all deletions
			if (data.type === 'remove' && newCount === 0) {
				itemsDeleted++;
			}
			
			if (changeAmount > 0) {
				totalAdded += changeAmount;
			} else {
				totalRemoved += Math.abs(changeAmount);
			}
			
			netChange += changeAmount;
		});

		// Get total item count
		const itemsSnapshot = await getDocs(collection(db, 'items'));
		const totalItems = itemsSnapshot.size;
		const activeItems = uniqueItems.size || 0;
		const inactiveItems = totalItems - activeItems;

		return {
			totalTransactions: totalTransactions || 0,
			totalAdded: totalAdded || 0,
			totalRemoved: totalRemoved || 0,
			netChange: netChange || 0,
			uniqueItems: activeItems,
			totalItems: totalItems,
			inactiveItems: inactiveItems,
			newItemsCreated: newItemsCreated || 0,
			itemsDeleted: itemsDeleted || 0
		};
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