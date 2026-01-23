import { itemStore } from '../../stores/itemStore.js';
import { get } from 'svelte/store';

export const ssr = false; // Disable SSR since Firebase requires client-side

export async function load({ fetch }) {
	try {
		// Fetch items and predictions in parallel
		const [_, predictionsResponse] = await Promise.all([
			itemStore.fetchItems(),
			fetch('/api/stockPredictions?timeframe=14&ai=false')
		]);

		let predictions = {};
		if (predictionsResponse.ok) {
			predictions = await predictionsResponse.json();
		}

		// Get items from store after fetch
		const items = get(itemStore);

		return {
			items,
			predictions
		};
	} catch (error) {
		console.error('Error loading predictions:', error);
		return {
			items: [],
			predictions: {},
			error: 'Failed to load predictions'
		};
	}
}
