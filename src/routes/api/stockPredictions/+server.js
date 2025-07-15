import { json } from '@sveltejs/kit';
import { getHistoricalTransactions } from '$lib/transactions';
import { predictStockLevels } from '$lib/stockPrediction';

export const GET = async ({ url }) => {
	try {
		const timeframe = parseInt(url.searchParams.get('timeframe') || '14', 10);
		const transactions = await getHistoricalTransactions();
		const predictions = predictStockLevels(transactions, timeframe);
		return json(predictions);
	} catch (error) {
		console.error('Error fetching stock predictions:', error);
		return json({ error: 'Failed to fetch stock predictions' }, { status: 500 });
	}
};
