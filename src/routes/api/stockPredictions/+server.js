import { json } from '@sveltejs/kit';
import { predictStockLevels } from '$lib/stockPrediction';
import { predictStockLevelsWithAI } from '$lib/aiStockPrediction';

// This route deliberately does NOT read Firestore. The server has no
// authenticated Firebase user, so once the security rules (firestore.rules,
// `request.auth != null`) are deployed, any server-side read would be denied.
// Instead the signed-in client reads its own data and POSTs it here (see
// src/lib/predictionsClient.js); the server verifies the caller's Firebase ID
// token and runs the prediction models on the posted data.

/**
 * Verifies a Firebase ID token using the Identity Toolkit REST API.
 * Uses the public Firebase web API key — no admin SDK dependency needed.
 * @param {string} idToken - The Firebase ID token from the client.
 * @returns {Promise<boolean>} True if the token belongs to a valid user.
 */
async function verifyIdToken(idToken) {
	const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
	if (!apiKey || !idToken) {
		return false;
	}
	try {
		const response = await fetch(
			`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ idToken })
			}
		);
		if (!response.ok) {
			return false;
		}
		const data = await response.json();
		return Array.isArray(data.users) && data.users.length > 0;
	} catch (error) {
		console.error('Error verifying ID token:', error);
		return false;
	}
}

export const POST = async ({ request }) => {
	try {
		const authHeader = request.headers.get('authorization') || '';
		const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : '';
		if (!(await verifyIdToken(idToken))) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		let body;
		try {
			body = await request.json();
		} catch {
			return json({ error: 'Invalid JSON body' }, { status: 400 });
		}

		const { transactions, items, forecastDays, useAI } = body ?? {};
		if (!Array.isArray(transactions) || !Array.isArray(items)) {
			return json({ error: 'transactions and items must be arrays' }, { status: 400 });
		}
		const timeframe = parseInt(forecastDays, 10) || 14;

		if (useAI === true) {
			// AI-enhanced predictions (falls back to ARIMA internally on failure)
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
			// Traditional ARIMA predictions
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
