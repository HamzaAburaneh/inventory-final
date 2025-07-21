<script>
	import { Chart, registerables } from 'chart.js';
	import { fade, fly } from 'svelte/transition';
	import { fadeAndSlide } from '$lib/transitions';
	import {
		getDailyAnalysis,
		getHourlyActivityPattern,
		getTopMovers,
		getSummaryStats
	} from '../../lib/transactionAnalysis';
	import { notificationStore } from '../../stores/notificationStore';

	// State variables
	let loading = $state(true);
	let dateRange = $state({
		start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
		end: new Date()
	});
	let dailyAnalysis = $state([]);
	let hourlyActivity = $state([]);
	let topMovers = $state([]);
	let summaryStats = $state(null);
	
	// Chart instances
	let dailyTrendChart = $state(null);
	let hourlyHeatmapChart = $state(null);
	let topMoversChart = $state(null);
	let transactionTypeChart = $state(null);

	// Formatted date strings for inputs
	const startDateStr = $derived(dateRange.start.toISOString().split('T')[0]);
	const endDateStr = $derived(dateRange.end.toISOString().split('T')[0]);

	// Format date range for display
	function formatDateRange() {
		const start = dateRange.start;
		const end = dateRange.end;
		const today = new Date();
		const yesterday = new Date(today);
		yesterday.setDate(yesterday.getDate() - 1);
		
		// Check for special cases
		if (start.toDateString() === today.toDateString() && end.toDateString() === today.toDateString()) {
			return 'Today';
		} else if (start.toDateString() === yesterday.toDateString() && end.toDateString() === yesterday.toDateString()) {
			return 'Yesterday';
		} else {
			// Calculate days difference
			const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
			if (daysDiff === 1) {
				return start.toLocaleDateString();
			} else {
				return `Last ${daysDiff} Days`;
			}
		}
	}

	// Load all data
	async function loadAnalysisData() {
		loading = true;
		try {
			// Calculate days difference for the selected range
			const daysDiff = Math.ceil((dateRange.end - dateRange.start) / (1000 * 60 * 60 * 24));
			
			const [daily, hourly, movers, summary] = await Promise.all([
				getDailyAnalysis(dateRange.start, dateRange.end),
				getHourlyActivityPattern(daysDiff, dateRange.start, dateRange.end),
				getTopMovers(10, daysDiff, dateRange.start, dateRange.end),
				getSummaryStats(dateRange.start, dateRange.end)
			]);

			dailyAnalysis = daily;
			hourlyActivity = hourly;
			topMovers = movers;
			summaryStats = summary;

			// Update charts after data is loaded
			updateCharts();
		} catch (error) {
			console.error('Error loading analysis data:', error);
			notificationStore.showNotification('Failed to load analysis data', 'error');
		} finally {
			loading = false;
		}
	}

	// Initialize and update charts
	function updateCharts() {
		// Use requestAnimationFrame to ensure DOM is ready
		requestAnimationFrame(() => {
			// Daily Trend Chart
			const dailyCtx = document.getElementById('dailyTrendChart');
			if (dailyCtx && dailyCtx.getContext) {
				if (dailyTrendChart) {
					dailyTrendChart.destroy();
					dailyTrendChart = null;
				}
				
				dailyTrendChart = new Chart(dailyCtx.getContext('2d'), {
				type: 'line',
				data: {
					labels: dailyAnalysis.map(d => d.date),
					datasets: [
						{
							label: 'Stock In',
							data: dailyAnalysis.map(d => d.totalAdded),
							borderColor: '#4CAF50',
							backgroundColor: 'rgba(76, 175, 80, 0.1)',
							tension: 0.1
						},
						{
							label: 'Stock Out',
							data: dailyAnalysis.map(d => d.totalRemoved),
							borderColor: '#F44336',
							backgroundColor: 'rgba(244, 67, 54, 0.1)',
							tension: 0.1
						},
						{
							label: 'Net Change',
							data: dailyAnalysis.map(d => d.netChange),
							borderColor: '#2196F3',
							backgroundColor: 'rgba(33, 150, 243, 0.1)',
							tension: 0.1
						}
					]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						title: {
							display: true,
							text: 'Daily Transaction Trends'
						},
						legend: {
							position: 'top'
						}
					},
					scales: {
						y: {
							beginAtZero: true,
							title: {
								display: true,
								text: 'Quantity'
							}
						}
					}
				}
			});
			}

			// Hourly Activity Heatmap
			const hourlyCtx = document.getElementById('hourlyHeatmapChart');
			if (hourlyCtx && hourlyCtx.getContext) {
				if (hourlyHeatmapChart) {
					hourlyHeatmapChart.destroy();
					hourlyHeatmapChart = null;
				}
				
				hourlyHeatmapChart = new Chart(hourlyCtx.getContext('2d'), {
				type: 'bar',
				data: {
					labels: hourlyActivity.map(h => `${h.hour}:00`),
					datasets: [{
						label: 'Transactions',
						data: hourlyActivity.map(h => h.transactionCount),
						backgroundColor: hourlyActivity.map(h => {
							const intensity = h.transactionCount / Math.max(...hourlyActivity.map(a => a.transactionCount));
							return `rgba(33, 150, 243, ${0.2 + intensity * 0.8})`;
						})
					}]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						title: {
							display: true,
							text: `Hourly Activity Pattern (${formatDateRange()})`
						},
						legend: {
							display: false
						}
					},
					scales: {
						y: {
							beginAtZero: true,
							title: {
								display: true,
								text: 'Number of Transactions'
							}
						}
					}
				}
			});
			}

			// Top Movers Chart
			const moversCtx = document.getElementById('topMoversChart');
			if (moversCtx && moversCtx.getContext) {
				if (topMoversChart) {
					topMoversChart.destroy();
					topMoversChart = null;
				}
				
				topMoversChart = new Chart(moversCtx.getContext('2d'), {
				type: 'bar',
				data: {
					labels: topMovers.map(m => m.itemName),
					datasets: [
						{
							label: 'Total Transactions',
							data: topMovers.map(m => m.totalTransactions),
							backgroundColor: '#9C27B0'
						}
					]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					indexAxis: 'y',
					plugins: {
						title: {
							display: true,
							text: `Top 10 Most Active Items (${formatDateRange()})`
						}
					},
					scales: {
						x: {
							beginAtZero: true,
							title: {
								display: true,
								text: 'Number of Transactions'
							}
						}
					}
				}
			});
			}

			// Transaction Type Distribution
			if (summaryStats) {
				const typeCtx = document.getElementById('transactionTypeChart');
				if (typeCtx && typeCtx.getContext) {
					if (transactionTypeChart) {
						transactionTypeChart.destroy();
						transactionTypeChart = null;
					}
					
					transactionTypeChart = new Chart(typeCtx.getContext('2d'), {
					type: 'doughnut',
					data: {
						labels: ['Stock In', 'Stock Out'],
						datasets: [{
							data: [summaryStats.totalAdded, summaryStats.totalRemoved],
							backgroundColor: ['#4CAF50', '#F44336']
						}]
					},
					options: {
						responsive: true,
						maintainAspectRatio: false,
						plugins: {
							title: {
								display: true,
								text: 'Transaction Type Distribution'
							}
						}
					}
				});
				}
			}
		});
	}

	// Handle date range changes
	function handleDateChange(type, value) {
		const newDate = new Date(value);
		if (type === 'start') {
			dateRange.start = newDate;
		} else {
			dateRange.end = newDate;
		}
		activeFilter = null; // Clear active filter when using custom dates
		loadAnalysisData();
	}

	// Track active filter (default to 30 days which was the initial range)
	let activeFilter = $state(30);

	// Quick date range presets
	function setQuickRange(days) {
		const now = new Date();
		dateRange.end = new Date();
		activeFilter = days; // Set active filter
		
		if (days === 0) {
			// Today - set start to beginning of today
			dateRange.start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		} else if (days === 1) {
			// Yesterday - set both start and end to yesterday
			const yesterday = new Date(now);
			yesterday.setDate(yesterday.getDate() - 1);
			dateRange.start = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
			dateRange.end = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59);
		} else {
			// Other ranges - go back N days from now
			dateRange.start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
		}
		
		loadAnalysisData();
	}

	// Export data as CSV
	function exportToCSV() {
		if (!dailyAnalysis.length) return;

		const headers = ['Date', 'Total Added', 'Total Removed', 'Net Change', 'Transaction Count'];
		const rows = dailyAnalysis.map(d => [
			d.date,
			d.totalAdded,
			d.totalRemoved,
			d.netChange,
			d.transactionCount
		]);

		const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
		const blob = new Blob([csv], { type: 'text/csv' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `transaction-analysis-${startDateStr}-to-${endDateStr}.csv`;
		a.click();
		URL.revokeObjectURL(url);

		notificationStore.showNotification('Analysis exported successfully', 'success');
	}

	// Load data on mount and cleanup on unmount
	$effect(() => {
		// Register Chart.js components
		Chart.register(...registerables);
		
		// Set initial active filter to 30 days since that's the default range
		activeFilter = 30;
		
		// Load data after a short delay to ensure DOM is ready
		const timer = setTimeout(() => {
			loadAnalysisData();
		}, 100);

		// Cleanup function
		return () => {
			clearTimeout(timer);
			// Destroy all charts on unmount
			if (dailyTrendChart) dailyTrendChart.destroy();
			if (hourlyHeatmapChart) hourlyHeatmapChart.destroy();
			if (topMoversChart) topMoversChart.destroy();
			if (transactionTypeChart) transactionTypeChart.destroy();
		};
	});
</script>

<svelte:head>
	<title>Transaction Analysis - StockSense</title>
</svelte:head>

<div class="analysis-page">
	<!-- Summary Cards -->
	<div class="summary-section" in:fly={{ y: 50, duration: 300, delay: 100 }}>
		<h1 class="text-3xl font-bold mb-6">
			<i class="fas fa-chart-line mr-2"></i>
			Transaction Analysis
		</h1>
		
		{#if summaryStats}
			<div class="summary-grid">
				<div class="summary-card">
					<i class="fas fa-exchange-alt"></i>
					<h3>Total Transactions</h3>
					<p>{summaryStats.totalTransactions.toLocaleString()}</p>
				</div>
				<div class="summary-card positive">
					<i class="fas fa-plus-circle"></i>
					<h3>Stock In</h3>
					<p>+{summaryStats.totalAdded.toLocaleString()}</p>
					<small>Total units added</small>
				</div>
				<div class="summary-card negative">
					<i class="fas fa-minus-circle"></i>
					<h3>Stock Out</h3>
					<p>-{summaryStats.totalRemoved.toLocaleString()}</p>
					<small>Total units removed</small>
				</div>
				<div class="summary-card {summaryStats.netChange >= 0 ? 'positive' : 'negative'}">
					<i class="fas fa-balance-scale"></i>
					<h3>Net Change</h3>
					<p>{summaryStats.netChange >= 0 ? '+' : ''}{summaryStats.netChange.toLocaleString()}</p>
				</div>
				<div class="summary-card">
					<i class="fas fa-boxes"></i>
					<h3>Active Items</h3>
					<p>{summaryStats.uniqueItems.toLocaleString()}</p>
					<small>Items with transactions in period</small>
				</div>
				<div class="summary-card inactive">
					<i class="fas fa-archive"></i>
					<h3>Inactive Items</h3>
					<p>{summaryStats.inactiveItems.toLocaleString()}</p>
					<small>Items with no transactions in period</small>
				</div>
				<div class="summary-card new-items">
					<i class="fas fa-plus-square"></i>
					<h3>New Items Created</h3>
					<p>{summaryStats.newItemsCreated.toLocaleString()}</p>
					<small>Items added to inventory</small>
				</div>
				<div class="summary-card deleted-items">
					<i class="fas fa-trash"></i>
					<h3>Items Deleted</h3>
					<p>{summaryStats.itemsDeleted.toLocaleString()}</p>
					<small>Items removed from inventory</small>
				</div>
			</div>
		{/if}
	</div>

	<!-- Date Range Controls -->
	<div class="controls-section" in:fly={{ y: 50, duration: 300, delay: 200 }}>
		<div class="date-controls">
			<div class="date-inputs">
				<label>
					Start Date:
					<input 
						type="date" 
						value={startDateStr}
						max={endDateStr}
						onchange={(e) => handleDateChange('start', e.target.value)}
					/>
				</label>
				<label>
					End Date:
					<input 
						type="date" 
						value={endDateStr}
						min={startDateStr}
						max={new Date().toISOString().split('T')[0]}
						onchange={(e) => handleDateChange('end', e.target.value)}
					/>
				</label>
			</div>
			<div class="quick-ranges">
				<button onclick={() => setQuickRange(0)} class="quick-btn" class:active={activeFilter === 0}>Today</button>
				<button onclick={() => setQuickRange(1)} class="quick-btn" class:active={activeFilter === 1}>Yesterday</button>
				<button onclick={() => setQuickRange(3)} class="quick-btn" class:active={activeFilter === 3}>Last 3 Days</button>
				<button onclick={() => setQuickRange(7)} class="quick-btn" class:active={activeFilter === 7}>Last 7 Days</button>
				<button onclick={() => setQuickRange(14)} class="quick-btn" class:active={activeFilter === 14}>Last 14 Days</button>
				<button onclick={() => setQuickRange(21)} class="quick-btn" class:active={activeFilter === 21}>Last 21 Days</button>
				<button onclick={() => setQuickRange(30)} class="quick-btn" class:active={activeFilter === 30}>Last 30 Days</button>
			</div>
			<button onclick={exportToCSV} class="export-btn">
				<i class="fas fa-download mr-2"></i>
				Export CSV
			</button>
		</div>
	</div>

	<!-- Charts Section -->
	{#if loading}
		<div class="loading-container">
			<div class="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
			<p class="mt-4">Loading analysis data...</p>
		</div>
	{:else}
		<div class="charts-grid" in:fadeAndSlide={{ duration: 300, y: 50 }}>
			<!-- Daily Trend Chart -->
			<div class="chart-container full-width">
				<canvas id="dailyTrendChart"></canvas>
			</div>

			<!-- Hourly Activity Pattern -->
			<div class="chart-container">
				<canvas id="hourlyHeatmapChart"></canvas>
			</div>

			<!-- Transaction Type Distribution -->
			<div class="chart-container">
				<canvas id="transactionTypeChart"></canvas>
			</div>

			<!-- Top Movers -->
			<div class="chart-container full-width">
				<canvas id="topMoversChart"></canvas>
			</div>
		</div>

		<!-- Top Movers Table -->
		<div class="table-section" in:fadeAndSlide={{ duration: 300, y: 50, delay: 100 }}>
			<h2 class="text-2xl font-bold mb-4">Top Moving Items Details</h2>
			<div class="table-wrapper">
				<table class="data-table">
					<thead>
						<tr>
							<th>Item Name</th>
							<th>Total Transactions</th>
							<th>Stock In</th>
							<th>Stock Out</th>
							<th>Net Change</th>
							<th>Volatility</th>
						</tr>
					</thead>
					<tbody>
						{#each topMovers as mover}
							<tr>
								<td>{mover.itemName}</td>
								<td>{mover.totalTransactions}</td>
								<td class="positive">+{mover.totalAdded}</td>
								<td class="negative">-{mover.totalRemoved}</td>
								<td class={mover.netChange >= 0 ? 'positive' : 'negative'}>
									{mover.netChange >= 0 ? '+' : ''}{mover.netChange}
								</td>
								<td>{mover.volatility}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}
</div>

<style>
	.analysis-page {
		padding: 2rem;
		max-width: 1400px;
		margin: 0 auto;
	}

	.summary-section {
		background-color: var(--container-bg);
		border-radius: 1rem;
		padding: 2rem;
		margin-bottom: 2rem;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	}

	.summary-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1.5rem;
		margin-top: 1.5rem;
	}

	.summary-card {
		background-color: var(--background-color);
		border-radius: 0.5rem;
		padding: 1.5rem;
		text-align: center;
		transition: transform 0.3s ease;
	}

	.summary-card:hover {
		transform: translateY(-5px);
	}

	.summary-card i {
		font-size: 2rem;
		margin-bottom: 0.5rem;
		display: block;
	}

	.summary-card h3 {
		font-size: 0.9rem;
		font-weight: 500;
		margin-bottom: 0.5rem;
		color: var(--text-color-dimmed);
	}

	.summary-card p {
		font-size: 1.5rem;
		font-weight: 700;
		margin-bottom: 0.25rem;
	}

	.summary-card small {
		font-size: 0.75rem;
		color: var(--text-color-dimmed);
		font-weight: 400;
	}

	.summary-card.positive {
		color: #4CAF50;
	}

	.summary-card.negative {
		color: #F44336;
	}

	.summary-card.inactive {
		color: #FF9800;
	}

	.summary-card.new-items {
		color: #2196F3;
	}

	.summary-card.deleted-items {
		color: #9C27B0;
	}

	.controls-section {
		background-color: var(--container-bg);
		border-radius: 1rem;
		padding: 1.5rem;
		margin-bottom: 2rem;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	}

	.date-controls {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		align-items: center;
		justify-content: space-between;
	}

	.date-inputs {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.date-inputs label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.9rem;
	}

	.date-inputs input {
		padding: 0.5rem;
		border: 1px solid var(--table-border-color);
		border-radius: 0.25rem;
		background-color: var(--background-color);
		color: var(--text-color);
	}

	.quick-ranges {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.quick-btn {
		padding: 0.4rem 0.8rem;
		border: 1px solid var(--table-border-color);
		border-radius: 0.25rem;
		background-color: var(--background-color);
		color: var(--text-color);
		cursor: pointer;
		transition: all 0.3s ease;
		font-size: 0.875rem;
		white-space: nowrap;
	}

	.quick-btn:hover {
		background-color: var(--primary-color);
		color: white;
		border-color: var(--primary-color);
	}

	.quick-btn.active {
		background-color: var(--primary-color);
		color: white;
		border-color: var(--primary-color);
		font-weight: 600;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
		transform: translateY(-1px);
	}

	.export-btn {
		padding: 0.5rem 1.5rem;
		background-color: var(--primary-color);
		color: white;
		border: none;
		border-radius: 0.25rem;
		cursor: pointer;
		transition: all 0.3s ease;
		display: flex;
		align-items: center;
	}

	.export-btn:hover {
		background-color: var(--primary-hover-color);
		transform: translateY(-2px);
	}

	.loading-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 400px;
		color: var(--text-color-dimmed);
	}

	.charts-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
		gap: 2rem;
		margin-bottom: 2rem;
	}

	.chart-container {
		background-color: var(--container-bg);
		border-radius: 1rem;
		padding: 1.5rem;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
		height: 400px;
		position: relative;
	}

	.chart-container.full-width {
		grid-column: 1 / -1;
	}

	.table-section {
		background-color: var(--container-bg);
		border-radius: 1rem;
		padding: 2rem;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	}

	.table-wrapper {
		overflow-x: auto;
	}

	.data-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.95rem;
	}

	.data-table th,
	.data-table td {
		padding: 0.75rem;
		text-align: left;
		border-bottom: 1px solid var(--table-border-color);
	}

	.data-table th {
		font-weight: 600;
		text-transform: uppercase;
		font-size: 0.85rem;
		color: var(--text-color-dimmed);
	}

	.data-table tbody tr:hover {
		background-color: var(--table-row-hover-bg);
	}

	.positive {
		color: #4CAF50;
		font-weight: 500;
	}

	.negative {
		color: #F44336;
		font-weight: 500;
	}

	@media (max-width: 768px) {
		.analysis-page {
			padding: 1rem;
		}

		.charts-grid {
			grid-template-columns: 1fr;
		}

		.date-controls {
			flex-direction: column;
			align-items: stretch;
		}

		.quick-ranges {
			justify-content: center;
		}

		.export-btn {
			width: 100%;
			justify-content: center;
		}
	}

	.animate-spin {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}
</style>