<script>
	import { Chart, registerables } from 'chart.js';
	import { fade, fly } from 'svelte/transition';
	import { fadeAndSlide } from '$lib/transitions';
	import { browser } from '$app/environment';
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
	
	// Track if charts need redrawing
	let chartsNeedRedraw = $state(false);

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
					labels: dailyAnalysis.map(d => {
						const date = new Date(d.date);
						const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
						const monthDay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
						return `${dayName} ${monthDay}`;
					}),
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
					labels: hourlyActivity.map(h => {
						const hour = h.hour;
						if (hour === 0) return '12 AM';
						if (hour === 12) return '12 PM';
						if (hour < 12) return `${hour} AM`;
						return `${hour - 12} PM`;
					}),
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

	// CNE date range presets
	function setCNERange(year) {
		activeFilter = `cne${year}`; // Set active filter for CNE
		
		switch(year) {
			case 2022:
				// CNE 2022: August 19 to September 5, 2022
				dateRange.start = new Date(2022, 7, 19); // Month is 0-indexed, so 7 = August
				dateRange.end = new Date(2022, 8, 5, 23, 59, 59); // 8 = September
				break;
			case 2023:
				// CNE 2023: August 18 to September 4, 2023
				dateRange.start = new Date(2023, 7, 18);
				dateRange.end = new Date(2023, 8, 4, 23, 59, 59);
				break;
			case 2024:
				// CNE 2024: August 16 to September 2, 2024
				dateRange.start = new Date(2024, 7, 16);
				dateRange.end = new Date(2024, 8, 2, 23, 59, 59);
				break;
			case 2025:
				// CNE 2025: August 15 to September 1, 2025
				dateRange.start = new Date(2025, 7, 13);
				dateRange.end = new Date(2025, 8, 1, 23, 59, 59);
				break;
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
	
	// Handle viewport changes
	$effect(() => {
		if (!browser) return;
		
		let resizeTimer;
		let previousWidth = window.innerWidth;
		
		function handleResize() {
			clearTimeout(resizeTimer);
			resizeTimer = setTimeout(() => {
				const currentWidth = window.innerWidth;
				const widthDiff = Math.abs(currentWidth - previousWidth);
				
				// Only redraw if width changed significantly (more than 50px)
				if (widthDiff > 50) {
					console.log(`Viewport width changed significantly: ${previousWidth}px -> ${currentWidth}px`);
					previousWidth = currentWidth;
					
					// Destroy and recreate charts to ensure proper sizing
					if (dailyTrendChart) {
						dailyTrendChart.destroy();
						dailyTrendChart = null;
					}
					if (hourlyHeatmapChart) {
						hourlyHeatmapChart.destroy();
						hourlyHeatmapChart = null;
					}
					if (topMoversChart) {
						topMoversChart.destroy();
						topMoversChart = null;
					}
					if (transactionTypeChart) {
						transactionTypeChart.destroy();
						transactionTypeChart = null;
					}
					
					// Redraw charts
					updateCharts();
				}
			}, 250);
		}
		
		window.addEventListener('resize', handleResize);
		window.addEventListener('orientationchange', handleResize);
		
		return () => {
			window.removeEventListener('resize', handleResize);
			window.removeEventListener('orientationchange', handleResize);
			clearTimeout(resizeTimer);
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
			<div class="cne-ranges">
				<span class="filter-label">CNE Periods:</span>
				<button onclick={() => setCNERange(2022)} class="quick-btn cne-btn" class:active={activeFilter === 'cne2022'}>CNE 2022</button>
				<button onclick={() => setCNERange(2023)} class="quick-btn cne-btn" class:active={activeFilter === 'cne2023'}>CNE 2023</button>
				<button onclick={() => setCNERange(2024)} class="quick-btn cne-btn" class:active={activeFilter === 'cne2024'}>CNE 2024</button>
				<button onclick={() => setCNERange(2025)} class="quick-btn cne-btn" class:active={activeFilter === 'cne2025'}>CNE 2025</button>
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
		width: 100%;
		overflow-x: hidden;
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
		grid-template-columns: repeat(auto-fit, minmax(min(150px, 45%), 1fr));
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

	.cne-ranges {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
		margin-top: 0.75rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--table-border-color);
	}

	.filter-label {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text-color-dimmed);
		margin-right: 0.5rem;
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

	.cne-btn {
		background-color: #FF6B35;
		border-color: #FF6B35;
		color: white;
	}

	.cne-btn:hover {
		background-color: #E55A2B;
		border-color: #E55A2B;
	}

	.cne-btn.active {
		background-color: #D14A1F;
		border-color: #D14A1F;
		box-shadow: 0 2px 4px rgba(255, 107, 53, 0.4);
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
		grid-template-columns: repeat(auto-fit, minmax(min(500px, 100%), 1fr));
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
			padding: 0.5rem;
		}

		.summary-section {
			padding: 1rem;
			margin-bottom: 1rem;
		}

		.summary-section h1 {
			font-size: 1.5rem;
			margin-bottom: 1rem;
		}

		.summary-grid {
			grid-template-columns: repeat(2, 1fr);
			gap: 0.5rem;
			margin-top: 1rem;
		}

		.summary-card {
			padding: 0.5rem;
			border-radius: 0.375rem;
			min-width: 0;
			overflow: hidden;
		}

		.summary-card i {
			font-size: 1rem;
			margin-bottom: 0.25rem;
		}

		.summary-card h3 {
			font-size: 0.65rem;
			margin-bottom: 0.25rem;
			line-height: 1.1;
		}

		.summary-card p {
			font-size: 0.9rem;
			margin-bottom: 0.125rem;
			word-break: break-all;
		}

		.summary-card small {
			font-size: 0.55rem;
			line-height: 1.1;
			display: block;
			word-wrap: break-word;
		}

		.controls-section {
			padding: 1rem;
			margin-bottom: 1rem;
		}

		.charts-grid {
			grid-template-columns: 1fr;
			gap: 1rem;
			margin-bottom: 1rem;
		}

		.chart-container {
			padding: 1rem;
			height: 300px;
		}

		.date-controls {
			flex-direction: column;
			align-items: stretch;
			gap: 0.75rem;
		}

		.date-inputs {
			flex-direction: column;
			gap: 0.5rem;
		}

		.quick-ranges {
			justify-content: center;
			gap: 0.25rem;
		}

		.cne-ranges {
			margin-top: 0.5rem;
			padding-top: 0.5rem;
			justify-content: center;
			gap: 0.25rem;
		}

		.filter-label {
			width: 100%;
			text-align: center;
			margin-bottom: 0.25rem;
			margin-right: 0;
		}

		.quick-btn {
			padding: 0.375rem 0.5rem;
			font-size: 0.75rem;
		}

		.export-btn {
			width: 100%;
			justify-content: center;
			padding: 0.75rem;
		}

		.table-section {
			padding: 1rem;
		}

		.table-section h2 {
			font-size: 1.25rem;
			margin-bottom: 1rem;
		}

		/* Make table responsive */
		.data-table {
			font-size: 0.75rem;
		}

		.data-table th,
		.data-table td {
			padding: 0.5rem 0.25rem;
		}

		.data-table th {
			font-size: 0.7rem;
		}

		/* Hide less important columns on very small screens */
		.data-table th:nth-child(6),
		.data-table td:nth-child(6) {
			display: none;
		}
	}

	@media (max-width: 480px) {
		.analysis-page {
			padding: 0.25rem;
		}

		.summary-section {
			padding: 0.75rem;
		}

		.summary-grid {
			grid-template-columns: 1fr 1fr;
			gap: 0.25rem;
		}

		.summary-card {
			padding: 0.375rem;
		}

		.summary-card h3 {
			font-size: 0.6rem;
		}

		.summary-card p {
			font-size: 0.8rem;
		}

		.summary-card small {
			font-size: 0.5rem;
		}

		.quick-ranges {
			flex-direction: column;
		}

		.cne-ranges {
			flex-direction: column;
			margin-top: 0.5rem;
			padding-top: 0.5rem;
		}

		.quick-btn {
			width: 100%;
		}

		/* Hide even more columns on very small screens */
		.data-table th:nth-child(3),
		.data-table td:nth-child(3),
		.data-table th:nth-child(4),
		.data-table td:nth-child(4) {
			display: none;
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