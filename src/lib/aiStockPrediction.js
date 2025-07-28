/**
 * AI-Enhanced Stock Prediction Service using OpenRouter
 * Combines traditional ARIMA models with AI analysis for better predictions
 */

import { predictStockLevels as arimaPredict } from './stockPrediction.js';

/**
 * @typedef {import('../types').Transaction} Transaction
 */

/**
 * @typedef {object} AIAnalysisRequest
 * @property {string} itemName
 * @property {number} currentStock
 * @property {number[]} historicalSales
 * @property {number[]} arimaPrediction
 * @property {number} forecastDays
 */

/**
 * @typedef {object} AIAnalysisResponse
 * @property {number[]} prediction
 * @property {string} reasoning
 * @property {number} confidence
 * @property {string[]} factors
 */

const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

/**
 * Analyzes historical sales data and provides AI-enhanced predictions using GPT-4o
 * @param {AIAnalysisRequest} analysisData - The data to analyze
 * @returns {Promise<AIAnalysisResponse>} AI analysis results
 */
async function getAIAnalysis(analysisData) {
	if (!OPENROUTER_API_KEY) {
		console.warn('OpenRouter API key not configured, falling back to ARIMA only');
		return {
			prediction: analysisData.arimaPrediction,
			reasoning: 'Using ARIMA model (AI analysis unavailable)',
			confidence: 0.7,
			factors: ['Historical sales patterns']
		};
	}

	const prompt = `
You are an expert inventory analyst specializing in high-volume, multi-booth operations at seasonal events like the Canadian National Exhibition (CNE).

Item: ${analysisData.itemName}
Unit Meaning: One unit represents a CASE or BOX of the item, not an individual unit.
Current Stock: ${analysisData.currentStock}
Forecast Timeframe: ${analysisData.forecastDays} day(s)
Booth Context: 8 booths total — each booth has specific menu items (e.g., desserts, poutines, burgers, hotdogs). Not all booths use every item.

Historical Daily Sales (last ${analysisData.historicalSales.length} days): [${analysisData.historicalSales.join(', ')}]
${analysisData.historicalSales.length > 0 ? `ARIMA Reference (${analysisData.forecastDays} days): [${analysisData.arimaPrediction.join(', ')}]` : 'No historical data available — use domain knowledge of food festivals.'}

CRITICAL CONTEXT:
- This is for a busy summer food event like the CNE
- Weekends are MUCH busier: Friday = 2–3x, Saturday = 4–5x, Sunday = 3–4x weekday traffic
- Not all items are used in every booth — usage depends on item category
- Weather impacts attendance: sunny = packed, rainy = slow
- Perishability matters — avoid overstocking fresh items like produce
- 1 forecast day = predict demand for **just that day**, not cumulative

INSTRUCTIONS:
1. Account for the fact that 1 unit = a **case or box**, not an individual item
2. Consider booth types and which would realistically use this item
3. Predict realistic demand for ${analysisData.forecastDays} day(s) only
4. Use weekend multipliers ONLY if the day falls on Fri/Sat/Sun
5. Avoid extreme predictions unless strongly supported by patterns or trends
6. Favor operational realism — CNE is busy, but space and storage are limited

For items like "${analysisData.itemName}":
- Estimate reasonable daily usage per booth, then scale by number of relevant booths
- Apply weekend traffic multipliers IF APPLICABLE
- Factor in perishability (e.g., fresh produce should not be overstocked)

Format your answer in strict JSON:
{
  "prediction": [array of ${analysisData.forecastDays} daily predictions],
  "reasoning": "Brief explanation grounded in item usage, booth context, and event patterns",
  "confidence": number between 0 and 1,
  "factors": ["list", "of", "key", "influences", "like", "booth_specificity", "case_unit_logic", "weekend_traffic", "perishability"]
}

IMPORTANT:
- Do NOT assume all booths use every item
- Do NOT suggest daily usage that exceeds practical limits for event food service
- Be bold but **realistic**
`;


	try {
		// Check if we're in a browser environment
		const referer = typeof window !== 'undefined' ? window.location.origin : 'https://localhost:5173';
		
		const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
				'Content-Type': 'application/json',
				'HTTP-Referer': referer,
				'X-Title': 'Inventory Management System'
			},
			body: JSON.stringify({
				model: 'openai/gpt-4o',
				messages: [
					{
						role: 'user',
						content: prompt
					}
				],
				temperature: 0.3,
				max_tokens: 1000
			})
		});

		if (!response.ok) {
			throw new Error(`OpenRouter API error: ${response.status}`);
		}

		const data = await response.json();
		let content = data.choices[0].message.content;
		
		// Handle markdown code blocks if present
		if (content.includes('```json')) {
			const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
			if (jsonMatch) {
				content = jsonMatch[1];
			}
		} else if (content.includes('```')) {
			// Handle generic code blocks
			const codeMatch = content.match(/```\s*([\s\S]*?)\s*```/);
			if (codeMatch) {
				content = codeMatch[1];
			}
		}
		
		// Clean up any remaining backticks or extra whitespace
		content = content.trim().replace(/^`+|`+$/g, '');
		
		const aiResponse = JSON.parse(content);
		
		// Validate the response structure
		if (!Array.isArray(aiResponse.prediction) || aiResponse.prediction.length !== analysisData.forecastDays) {
			throw new Error('Invalid AI response format');
		}

		return aiResponse;
	} catch (error) {
		console.error('AI analysis failed, falling back to ARIMA:', error);
		return {
			prediction: analysisData.arimaPrediction,
			reasoning: `ARIMA fallback (AI error: ${error.message})`,
			confidence: 0.6,
			factors: ['Historical sales patterns', 'ARIMA time series analysis']
		};
	}
}

/**
 * Prepares historical sales data for AI analysis
 * @param {Transaction[]} transactions - Historical transactions
 * @param {string} itemId - Item ID to analyze
 * @returns {number[]} Array of daily sales numbers
 */
function prepareHistoricalSales(transactions, itemId) {
	const itemTransactions = transactions
		.filter(t => t.itemId === itemId)
		.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

	if (itemTransactions.length === 0) return [];

	// Group by day and calculate daily sales
	const dailySales = {};
	itemTransactions.forEach(transaction => {
		const date = new Date(transaction.timestamp);
		date.setHours(0, 0, 0, 0);
		const dateKey = date.toISOString().split('T')[0];
		
		const change = transaction.type === 'add' 
			? transaction.newCount - transaction.previousCount
			: transaction.previousCount - transaction.newCount;
		
		dailySales[dateKey] = (dailySales[dateKey] || 0) + change;
	});

	return Object.values(dailySales);
}

/**
 * Enhanced stock prediction using GPT-4o AI analysis combined with ARIMA
 * @param {Transaction[]} transactions - Historical transactions
 * @param {Array} items - Current items array
 * @param {number} [forecastDays=14] - Number of days to forecast
 * @returns {Promise<Object>} Enhanced predictions with AI insights
 */
export async function predictStockLevelsWithAI(transactions, items, forecastDays = 14) {
	// Get baseline ARIMA predictions
	const arimaPredictions = arimaPredict(transactions, forecastDays);
	
	// Enhanced predictions with AI analysis
	const enhancedPredictions = {};
	
	// Process each item that has ARIMA predictions
	for (const [itemId, arimaPrediction] of Object.entries(arimaPredictions)) {
		const item = items.find(i => i.id === itemId);
		if (!item) continue; // Skip items that don't exist
		
		const historicalSales = prepareHistoricalSales(transactions, itemId);
		
		try {
			const aiAnalysis = await getAIAnalysis({
				itemName: item.name,
				currentStock: item.count || 0,
				historicalSales,
				arimaPrediction,
				forecastDays
			});
			
			enhancedPredictions[itemId] = {
				prediction: aiAnalysis.prediction,
				reasoning: aiAnalysis.reasoning,
				confidence: aiAnalysis.confidence,
				factors: aiAnalysis.factors,
				arimaPrediction, // Keep original for comparison
				method: 'GPT-4o Enhanced'
			};
		} catch (error) {
			console.error(`AI analysis failed for item ${itemId}:`, error);
			enhancedPredictions[itemId] = {
				prediction: arimaPrediction,
				reasoning: 'ARIMA model (AI analysis failed)',
				confidence: 0.6,
				factors: ['Historical sales patterns'],
				arimaPrediction,
				method: 'ARIMA Fallback'
			};
		}
	}
	
	return enhancedPredictions;
}

/**
 * Batch AI analysis for better performance
 * @param {Array} analysisRequests - Array of analysis requests
 * @returns {Promise<Array>} Array of AI analysis responses
 */
export async function batchAIAnalysis(analysisRequests) {
	if (!OPENROUTER_API_KEY) {
		return analysisRequests.map(req => ({
			prediction: req.arimaPrediction,
			reasoning: 'ARIMA model (AI unavailable)',
			confidence: 0.7,
			factors: ['Historical sales patterns']
		}));
	}

	// Process in batches of 5 to avoid rate limits
	const batchSize = 5;
	const results = [];
	
	for (let i = 0; i < analysisRequests.length; i += batchSize) {
		const batch = analysisRequests.slice(i, i + batchSize);
		const batchPromises = batch.map(req => getAIAnalysis(req));
		const batchResults = await Promise.allSettled(batchPromises);
		
		results.push(...batchResults.map((result, index) => {
			if (result.status === 'fulfilled') {
				return result.value;
			} else {
				// Fallback for failed requests
				return {
					prediction: batch[index].arimaPrediction,
					reasoning: `ARIMA fallback (${result.reason})`,
					confidence: 0.6,
					factors: ['Historical sales patterns']
				};
			}
		}));
		
		// Small delay between batches to respect rate limits
		if (i + batchSize < analysisRequests.length) {
			await new Promise(resolve => setTimeout(resolve, 1000));
		}
	}
	
	return results;
}