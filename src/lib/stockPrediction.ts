import type { Transaction } from '../types';
// @ts-ignore
const ARIMA = require('arima');

interface ItemSales {
	[itemId: string]: {
		date: Date;
		sales: number;
		isWeekend: boolean;
	}[];
}

interface ItemData {
	sales: {
		date: Date;
		sales: number;
		isWeekend: boolean;
	}[];
	itemName: string;
}

// Maximum reasonable daily usage/stock for different item types
const ITEM_LIMITS: { [key: string]: number } = {
	// Cleaning supplies (per day)
	Bleach: 2,
	'Dish Soap': 2,
	Gloves: 4,
	'Grill Brick': 1,
	'Pan Liner': 5,
	Napkins: 10,

	// Condiments (per day)
	Ketchup: 5,
	Mustard: 3,
	Mayo: 3,
	Siracha: 2,
	'Hoisin Sauce': 2,
	'Pad Thai Sauce': 2,
	'Teriyaki Sauce': 2,
	Gravy: 20,
	Salsa: 5,

	// Fresh ingredients (per day)
	Tomato: 10,
	Cabbage: 8,
	Jalapeno: 5,
	Avacodo: 10,
	Pineapple: 5,
	Banana: 5,
	Cilantro: 4,
	Parsley: 4,
	Chives: 3,
	Dill: 3,

	// Proteins (per day)
	Pork: 30,
	Bacon: 25,
	Shrimp: 20,
	'Snow Crab': 15,
	Lobster: 15,
	Ribeye: 20,
	'Hot Dog': 40,

	// Staples (per day)
	Fries: 50,
	Corn: 40,
	Tortilla: 30,
	Ciabatta: 20,
	'Pretzel bun': 20,

	// Default limit for uncategorized items
	default: 30
};

function getItemLimit(itemName: string): number {
	return ITEM_LIMITS[itemName] || ITEM_LIMITS['default'];
}

function applyReasonableLimit(prediction: number, itemName: string): number {
	const dailyLimit = getItemLimit(itemName);
	return Math.min(prediction, dailyLimit);
}

function groupTransactionsByItem(transactions: Transaction[]): { [itemId: string]: ItemData } {
	const itemSales: { [itemId: string]: ItemData } = {};

	transactions.forEach((transaction) => {
		const itemId = transaction.itemId;
		const date = new Date(transaction.timestamp);
		date.setHours(0, 0, 0, 0); // Normalize to start of day
		const isWeekend = date.getDay() === 0 || date.getDay() === 6;

		if (!itemSales[itemId]) {
			itemSales[itemId] = {
				sales: [],
				itemName: transaction.itemName || 'default'
			};
		}

		const existingEntry = itemSales[itemId].sales.find(
			(entry) => entry.date.getTime() === date.getTime()
		);
		const change =
			transaction.type === 'add'
				? transaction.newCount - transaction.previousCount
				: transaction.previousCount - transaction.newCount;

		if (existingEntry) {
			existingEntry.sales += change;
		} else {
			itemSales[itemId].sales.push({ date, sales: change, isWeekend });
		}
	});

	// Sort sales by date for each item
	Object.values(itemSales).forEach((item) =>
		item.sales.sort((a, b) => a.date.getTime() - b.date.getTime())
	);

	return itemSales;
}

function prepareDataForARIMA(sales: { date: Date; sales: number; isWeekend: boolean }[]): {
	dailySales: number[];
	isWeekend: boolean[];
} {
	const dailySales: number[] = [];
	const isWeekend: boolean[] = [];
	let currentDate = new Date(sales[0].date);

	while (currentDate <= sales[sales.length - 1].date) {
		const dayData = sales.find((s) => s.date.getTime() === currentDate.getTime());
		const currentIsWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;

		dailySales.push(dayData ? Math.max(0, dayData.sales) : 0); // Ensure non-negative sales
		isWeekend.push(currentIsWeekend);

		currentDate.setDate(currentDate.getDate() + 1);
	}

	return { dailySales, isWeekend };
}

function calculateWeekendFactor(sales: number[], isWeekend: boolean[]): number {
	const weekdaySales = sales.filter((_, i) => !isWeekend[i]);
	const weekendSales = sales.filter((_, i) => isWeekend[i]);

	const avgWeekday = weekdaySales.reduce((a, b) => a + b, 0) / weekdaySales.length || 1;
	const avgWeekend = weekendSales.reduce((a, b) => a + b, 0) / weekendSales.length || 1;

	// Cap the weekend factor to a reasonable range
	const factor = avgWeekend / avgWeekday;
	return Math.min(Math.max(factor, 1), 2); // Weekend factor between 1x and 2x
}

async function predictWithARIMA(
	data: number[],
	isWeekend: boolean[],
	forecastDays: number,
	itemName: string
): Promise<number[]> {
	try {
		const weekendFactor = calculateWeekendFactor(data, isWeekend);

		// Normalize data for ARIMA
		const normalizedData = data.map((value, i) => (isWeekend[i] ? value / weekendFactor : value));

		// Create and train ARIMA model
		const model = new ARIMA({
			p: 1,
			d: 1,
			q: 1,
			verbose: false
		});

		model.train(normalizedData);
		const [predictions] = model.predict(forecastDays);

		// Apply weekend adjustments and reasonable limits
		return predictions.map((pred: number, i: number) => {
			const date = new Date();
			date.setDate(date.getDate() + i);
			const isWeekendDay = date.getDay() === 0 || date.getDay() === 6;
			const adjustedPred = isWeekendDay ? pred * weekendFactor : pred;
			return applyReasonableLimit(Math.max(0, adjustedPred), itemName);
		});
	} catch (error) {
		console.error('ARIMA prediction failed:', error);
		return fallbackPrediction(data, isWeekend, forecastDays, itemName);
	}
}

function fallbackPrediction(
	data: number[],
	isWeekend: boolean[],
	forecastDays: number,
	itemName: string
): number[] {
	const weekendFactor = calculateWeekendFactor(data, isWeekend);
	const windowSize = Math.min(7, data.length);

	// Calculate weighted average giving more weight to recent data
	const weights = Array.from({ length: windowSize }, (_, i) => windowSize - i);
	const weightSum = weights.reduce((a, b) => a + b, 0);

	const recentData = data.slice(-windowSize);
	const weightedAvg = recentData.reduce((sum, value, i) => sum + value * weights[i], 0) / weightSum;

	// Generate predictions with weekend adjustments and limits
	return Array.from({ length: forecastDays }, (_, i) => {
		const date = new Date();
		date.setDate(date.getDate() + i);
		const isWeekendDay = date.getDay() === 0 || date.getDay() === 6;
		const prediction = isWeekendDay ? weightedAvg * weekendFactor : weightedAvg;
		return applyReasonableLimit(Math.max(0, prediction), itemName);
	});
}

export async function predictStockLevels(
	transactions: Transaction[],
	forecastDays: number = 14
): Promise<{ [itemId: string]: number[] }> {
	const itemSales = groupTransactionsByItem(transactions);
	const predictions: { [itemId: string]: number[] } = {};

	for (const [itemId, item] of Object.entries(itemSales)) {
		const { dailySales, isWeekend } = prepareDataForARIMA(item.sales);

		if (dailySales.length < 7) {
			console.warn(`Not enough historical data for item ${itemId}. Using fallback prediction.`);
			predictions[itemId] = fallbackPrediction(dailySales, isWeekend, forecastDays, item.itemName);
		} else {
			predictions[itemId] = await predictWithARIMA(
				dailySales,
				isWeekend,
				forecastDays,
				item.itemName
			);
		}
	}

	return predictions;
}
