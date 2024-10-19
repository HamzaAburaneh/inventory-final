import type { Transaction } from '../types';

interface ItemSales {
	[itemId: string]: number[];
}

function groupTransactionsByItem(transactions: Transaction[]): ItemSales {
	const itemSales: ItemSales = {};

	transactions.forEach((transaction) => {
		if (!itemSales[transaction.itemId]) {
			itemSales[transaction.itemId] = [];
		}
		const change = transaction.newCount - transaction.previousCount;
		itemSales[transaction.itemId].push(transaction.type === 'add' ? change : -change);
	});

	return itemSales;
}

function calculateMovingAverage(sales: number[], windowSize: number): number {
	if (sales.length < windowSize) {
		return sales.reduce((sum, sale) => sum + sale, 0) / sales.length;
	}

	const recentSales = sales.slice(-windowSize);
	return recentSales.reduce((sum, sale) => sum + sale, 0) / windowSize;
}

export function predictStockLevels(
	transactions: Transaction[],
	windowSize: number = 7
): { [itemId: string]: number } {
	const itemSales = groupTransactionsByItem(transactions);
	const predictions: { [itemId: string]: number } = {};

	for (const [itemId, sales] of Object.entries(itemSales)) {
		const averageSales = calculateMovingAverage(sales, windowSize);
		predictions[itemId] = Math.ceil(averageSales * 2); // Predict stock for 2 periods
	}

	return predictions;
}
