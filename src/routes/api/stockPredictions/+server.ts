import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getHistoricalTransactions } from '$lib/transactions';
import { predictStockLevels } from '$lib/stockPrediction';

export const GET: RequestHandler = async () => {
	try {
		const transactions = await getHistoricalTransactions();
		const predictions = predictStockLevels(transactions);
		return json(predictions);
	} catch (error) {
		console.error('Error fetching stock predictions:', error);
		return json({ error: 'Failed to fetch stock predictions' }, { status: 500 });
	}
};
