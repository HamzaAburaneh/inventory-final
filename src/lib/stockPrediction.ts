import type { Transaction } from '../types';
import arimaPackage from 'arima';
const { ARIMA } = arimaPackage;

interface ItemSales {
	[itemId: string]: { date: Date; sales: number }[];
}

/**
 * Groups transactions by item and calculates daily sales.
 * @param transactions - Array of transactions
 * @returns Object with itemId as key and array of daily sales as value
 */
function groupTransactionsByItem(transactions: Transaction[]): ItemSales {
	const itemSales: ItemSales = {};

	transactions.forEach((transaction) => {
		const itemId = transaction.itemId;
		const date = new Date(transaction.timestamp);
		date.setHours(0, 0, 0, 0); // Normalize to start of day

		if (!itemSales[itemId]) {
			itemSales[itemId] = [];
		}

		const existingEntry = itemSales[itemId].find(
			(entry) => entry.date.getTime() === date.getTime()
		);
		const change =
			transaction.type === 'add'
				? transaction.newCount - transaction.previousCount
				: transaction.previousCount - transaction.newCount;

		if (existingEntry) {
			existingEntry.sales += change;
		} else {
			itemSales[itemId].push({ date, sales: change });
		}
	});

	// Sort sales by date for each item
	Object.values(itemSales).forEach((sales) =>
		sales.sort((a, b) => a.date.getTime() - b.date.getTime())
	);

	return itemSales;
}

/**
 * Prepares daily sales data for ARIMA model.
 * @param sales - Array of daily sales data
 * @returns Array of daily sales numbers
 */
function prepareDataForARIMA(sales: { date: Date; sales: number }[]): number[] {
	const dailySales: number[] = [];
	let currentDate = new Date(sales[0].date);
	let salesIndex = 0;

	while (currentDate <= sales[sales.length - 1].date) {
		if (salesIndex < sales.length && sales[salesIndex].date.getTime() === currentDate.getTime()) {
			dailySales.push(sales[salesIndex].sales);
			salesIndex++;
		} else {
			dailySales.push(0); // No sales on this day
		}
		currentDate.setDate(currentDate.getDate() + 1);
	}

	return dailySales;
}

/**
 * Predicts future sales using ARIMA model.
 * @param data - Array of historical daily sales
 * @param forecastDays - Number of days to forecast
 * @returns Array of predicted daily sales
 */
function predictWithARIMA(data: number[], forecastDays: number): number[] {
	try {
		const arima = new ARIMA({
			p: 1,
			d: 1,
			q: 1,
			verbose: false
		});

		arima.train(data);
		const [pred, errors] = arima.predict(forecastDays);
		return pred;
	} catch (error) {
		console.error('ARIMA prediction failed:', error);
		return fallbackPrediction(data, forecastDays);
	}
}

/**
 * Fallback prediction method using simple moving average.
 * @param data - Array of historical daily sales
 * @param forecastDays - Number of days to forecast
 * @returns Array of predicted daily sales
 */
function fallbackPrediction(data: number[], forecastDays: number): number[] {
	const windowSize = Math.min(7, data.length);
	const sum = data.slice(-windowSize).reduce((a, b) => a + b, 0);
	const average = sum / windowSize;
	return Array(forecastDays).fill(average);
}

/**
 * Predicts stock levels for all items based on historical transactions.
 * Uses ARIMA model for prediction, with a fallback to simple moving average if ARIMA fails.
 * @param transactions - Array of historical transactions
 * @param forecastDays - Number of days to forecast (default: 14)
 * @returns Object with itemId as key and array of daily predictions as value
 */
export function predictStockLevels(
	transactions: Transaction[],
	forecastDays: number = 14
): { [itemId: string]: number[] } {
	const itemSales = groupTransactionsByItem(transactions);
	const predictions: { [itemId: string]: number[] } = {};

	for (const [itemId, sales] of Object.entries(itemSales)) {
		const dailySales = prepareDataForARIMA(sales);
		if (dailySales.length < forecastDays * 2) {
			console.warn(`Not enough historical data for item ${itemId}. Using fallback prediction.`);
			predictions[itemId] = fallbackPrediction(dailySales, forecastDays);
		} else {
			predictions[itemId] = predictWithARIMA(dailySales, forecastDays);
		}
	}

	return predictions;
}
