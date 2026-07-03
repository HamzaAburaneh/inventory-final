import { auth } from '../firebase';
import { getHistoricalTransactions } from './transactions';
import { getItems } from './items';

/**
 * Fetches stock predictions from the server API.
 *
 * The signed-in client reads the inventory data itself (it has Firestore
 * access under the security rules) and POSTs it to the API together with the
 * user's Firebase ID token. The server only verifies the token and runs the
 * prediction models — it never reads Firestore — so deploying auth-required
 * security rules does not break predictions.
 * @param {object} options
 * @param {number} [options.forecastDays=14] - Number of days to forecast.
 * @param {boolean} [options.useAI=false] - Whether to use the AI-enhanced layer.
 * @returns {Promise<object>} Predictions keyed by item ID.
 */
export async function fetchStockPredictions({ forecastDays = 14, useAI = false } = {}) {
	const user = auth.currentUser;
	if (!user) {
		throw new Error('You must be signed in to load predictions.');
	}
	const idToken = await user.getIdToken();

	const [transactions, items] = await Promise.all([getHistoricalTransactions(), getItems()]);

	const response = await fetch('/api/stockPredictions', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${idToken}`
		},
		body: JSON.stringify({ transactions, items, forecastDays, useAI })
	});
	if (!response.ok) {
		throw new Error('Failed to fetch stock predictions');
	}
	return response.json();
}
