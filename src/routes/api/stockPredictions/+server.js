import { json } from '@sveltejs/kit';
import { getHistoricalTransactions } from '$lib/transactions';
import { predictStockLevels } from '$lib/stockPrediction';
import { predictStockLevelsWithAI } from '$lib/aiStockPrediction';
import { db } from '$lib/../firebase';
import { collection, getDocs } from 'firebase/firestore';

async function getItems() {
	try {
		const querySnapshot = await getDocs(collection(db, 'items'));
		const items = [];
		querySnapshot.forEach((doc) => {
			items.push({
				id: doc.id,
				...doc.data()
			});
		});
		return items;
	} catch (error) {
		console.error('Error loading items:', error);
		return [];
	}
}

export const GET = async ({ url }) => {
	try {
		const timeframe = parseInt(url.searchParams.get('timeframe') || '14', 10);
		const useAI = url.searchParams.get('ai') === 'true';
		
		const transactions = await getHistoricalTransactions();
		
		if (useAI) {
			// Use AI-enhanced predictions
			const items = await getItems();
			const enhancedPredictions = await predictStockLevelsWithAI(transactions, items, timeframe);
			
			// Convert enhanced predictions to the expected format for the frontend
			const predictions = {};
			for (const [itemId, analysis] of Object.entries(enhancedPredictions)) {
				predictions[itemId] = {
					prediction: analysis.prediction,
					reasoning: analysis.reasoning,
					confidence: analysis.confidence,
					factors: analysis.factors,
					method: analysis.method
				};
			}
			
			return json(predictions);
		} else {
			// Use traditional ARIMA predictions
			const predictions = predictStockLevels(transactions, timeframe);
			
			// Convert to enhanced format for consistency
			const enhancedFormat = {};
			for (const [itemId, prediction] of Object.entries(predictions)) {
				enhancedFormat[itemId] = {
					prediction,
					reasoning: 'ARIMA time series analysis',
					confidence: 0.7,
					factors: ['Historical sales patterns'],
					method: 'ARIMA'
				};
			}
			
			return json(enhancedFormat);
		}
	} catch (error) {
		console.error('Error fetching stock predictions:', error);
		return json({ error: 'Failed to fetch stock predictions' }, { status: 500 });
	}
};
