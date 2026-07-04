import { json } from '@sveltejs/kit';
import { predictStockLevelsDeterministic, predictStockLevelsWithAI } from '$lib/aiStockPrediction';
import { runPredictionBacktest } from '$lib/predictionBacktest';

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

		const {
			transactions,
			items,
			forecastDays,
			useAI,
			mode,
			holdoutDays,
			sampleItemIds,
			includeLegacyAI
		} = body ?? {};
		if (!Array.isArray(transactions) || !Array.isArray(items)) {
			return json({ error: 'transactions and items must be arrays' }, { status: 400 });
		}
		const timeframe = parseInt(forecastDays, 10) || 14;

		// Backtest mode: hold out the tail of the most recent fair run and score
		// every prediction method against what actually happened. AI contestants
		// only run when explicitly requested (they cost OpenRouter credits).
		if (mode === 'backtest') {
			const report = await runPredictionBacktest(transactions, items, {
				holdoutDays,
				sampleItemIds,
				useAI: useAI === true,
				includeLegacyAI: includeLegacyAI === true
			});
			return json(report);
		}

		// Both paths return the same enriched shape: prediction, reasoning,
		// confidence {score, level, basis}, factors, method, baseline, arima,
		// forecastDates, stockOut, reorderBy. Every AI failure falls back to the
		// deterministic result inside predictStockLevelsWithAI.
		const predictions =
			useAI === true
				? await predictStockLevelsWithAI(transactions, items, timeframe)
				: predictStockLevelsDeterministic(transactions, items, timeframe);
		return json(predictions);
	} catch (error) {
		console.error('Error fetching stock predictions:', error);
		return json({ error: 'Failed to fetch stock predictions' }, { status: 500 });
	}
};
