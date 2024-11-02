import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getHistoricalTransactions } from '$lib/transactions';
import { predictStockLevels } from '$lib/stockPrediction';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const timeframe = parseInt(url.searchParams.get('timeframe') || '14', 10);

		// Validate timeframe
		if (isNaN(timeframe) || timeframe < 1 || timeframe > 30) {
			return json({ error: 'Invalid timeframe. Must be between 1 and 30 days.' }, { status: 400 });
		}

		const transactions = await getHistoricalTransactions();

		if (!transactions || transactions.length === 0) {
			return json({ error: 'No historical transaction data available.' }, { status: 404 });
		}

		const predictions = await predictStockLevels(transactions, timeframe);
		return json(predictions);
	} catch (error) {
		console.error('Error fetching stock predictions:', error);
		return json(
			{ error: 'Failed to generate stock predictions. Please try again later.' },
			{ status: 500 }
		);
	}
};
