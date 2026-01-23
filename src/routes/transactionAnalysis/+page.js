import {
	getDailyAnalysis,
	getHourlyActivityPattern,
	getTopMovers,
	getSummaryStats
} from '../../lib/transactionAnalysis';

export const ssr = false; // Disable SSR since Firebase requires client-side

export async function load() {
	// Default to last 30 days
	const endDate = new Date();
	const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
	const daysDifference = 30;

	try {
		const [dailyAnalysis, hourlyActivity, topMovers, summaryStats] = await Promise.all([
			getDailyAnalysis(startDate, endDate),
			getHourlyActivityPattern(daysDifference, startDate, endDate),
			getTopMovers(10, daysDifference, startDate, endDate),
			getSummaryStats(startDate, endDate)
		]);

		return {
			dailyAnalysis,
			hourlyActivity,
			topMovers,
			summaryStats,
			dateRange: { start: startDate, end: endDate }
		};
	} catch (error) {
		console.error('Error loading analysis data:', error);
		return {
			dailyAnalysis: [],
			hourlyActivity: [],
			topMovers: [],
			summaryStats: null,
			dateRange: { start: startDate, end: endDate },
			error: 'Failed to load analysis data'
		};
	}
}
