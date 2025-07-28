import arimaPackage from 'arima';

// Handle different possible export formats
let ARIMA;
try {
	// Try destructuring first
	ARIMA = arimaPackage.ARIMA || arimaPackage.default?.ARIMA || arimaPackage.default || arimaPackage;
} catch (error) {
	console.warn('ARIMA import issue, using fallback predictions');
	ARIMA = null;
}

/**
 * @typedef {import('../types').Transaction} Transaction
 */

/**
 * @typedef {object} ItemSales
 * @property {Date} date
 * @property {number} sales
 */

/**
 * Groups transactions by item and calculates daily sales.
 * @param {Transaction[]} transactions - Array of transactions
 * @returns {Object.<string, ItemSales[]>} Object with itemId as key and array of daily sales as value
 */
function groupTransactionsByItem(transactions) {
	/** @type {Object.<string, ItemSales[]>} */
	const itemSales = {};

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
 * @param {ItemSales[]} sales - Array of daily sales data
 * @returns {number[]} Array of daily sales numbers
 */
function prepareDataForARIMA(sales) {
	const dailySales = [];
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
 * @param {number[]} data - Array of historical daily sales
 * @param {number} forecastDays - Number of days to forecast
 * @returns {number[]} Array of predicted daily sales
 */
function predictWithARIMA(data, forecastDays) {
	try {
		// Check if ARIMA is available
		if (!ARIMA) {
			console.warn('ARIMA not available, using fallback prediction');
			return fallbackPrediction(data, forecastDays);
		}

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
 * @param {number[]} data - Array of historical daily sales
 * @param {number} forecastDays - Number of days to forecast
 * @returns {number[]} Array of predicted daily sales
 */
function fallbackPrediction(data, forecastDays) {
	const windowSize = Math.min(7, data.length);
	const sum = data.slice(-windowSize).reduce((a, b) => a + b, 0);
	const average = sum / windowSize;
	return Array(forecastDays).fill(average);
}

/**
 * Predicts stock levels for all items based on historical transactions.
 * Uses ARIMA model for prediction, with a fallback to simple moving average if ARIMA fails.
 * @param {Transaction[]} transactions - Array of historical transactions
 * @param {number} [forecastDays=14] - Number of days to forecast
 * @returns {Object.<string, number[]>} Object with itemId as key and array of daily predictions as value
 */
export function predictStockLevels(transactions, forecastDays = 14) {
	const itemSales = groupTransactionsByItem(transactions);
	/** @type {Object.<string, number[]>} */
	const predictions = {};

	for (const [itemId, sales] of Object.entries(itemSales)) {
		const dailySales = prepareDataForARIMA(sales);
		if (dailySales.length < forecastDays * 2) {
			predictions[itemId] = fallbackPrediction(dailySales, forecastDays);
		} else {
			predictions[itemId] = predictWithARIMA(dailySales, forecastDays);
		}
	}

	return predictions;
}
