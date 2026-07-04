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
// Predictions need last year's CNE run as a prior (the models align fairs by
// day-of-fair), so this path fetches further back than the 90-day default used
// elsewhere. 400 days always spans the previous fair.
const PREDICTION_HISTORY_DAYS = 400;

/**
 * Read the inventory data and POST it to a stockPredictions API mode.
 * @param {object} payload - Extra body fields (forecastDays, useAI, mode…)
 * @returns {Promise<object>} API response
 */
async function postToPredictionsApi(payload) {
	const user = auth.currentUser;
	if (!user) {
		throw new Error('You must be signed in to load predictions.');
	}
	const idToken = await user.getIdToken();

	const [transactions, items] = await Promise.all([
		getHistoricalTransactions(PREDICTION_HISTORY_DAYS),
		getItems()
	]);

	const response = await fetch('/api/stockPredictions', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${idToken}`
		},
		body: JSON.stringify({ transactions, items, ...payload })
	});
	if (!response.ok) {
		throw new Error('Failed to fetch stock predictions');
	}
	return response.json();
}

export async function fetchStockPredictions({ forecastDays = 14, useAI = false } = {}) {
	return postToPredictionsApi({ forecastDays, useAI });
}

/**
 * Run the prediction backtest (holds out the tail of the most recent fair run
 * and scores every method against actuals). AI contestants cost OpenRouter
 * credits and only run when explicitly enabled.
 * @param {object} options
 * @param {number} [options.holdoutDays=7] - Days held out
 * @param {boolean} [options.useAI=false] - Score the new AI path
 * @param {boolean} [options.includeLegacyAI=false] - Score the old prompt/model
 * @param {string[]} [options.sampleItemIds] - Explicit sample (else auto-picked)
 * @returns {Promise<object>} Backtest report
 */
export async function runPredictionBacktest({
	holdoutDays = 7,
	useAI = false,
	includeLegacyAI = false,
	sampleItemIds
} = {}) {
	return postToPredictionsApi({
		mode: 'backtest',
		holdoutDays,
		useAI,
		includeLegacyAI,
		sampleItemIds
	});
}
