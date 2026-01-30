<script>
	import {
		Chart,
		LineController,
		BarController,
		DoughnutController,
		LineElement,
		BarElement,
		ArcElement,
		PointElement,
		CategoryScale,
		LinearScale,
		Title,
		Tooltip,
		Legend
	} from 'chart.js';
	import { browser } from '$app/environment';
	import {
		getDailyAnalysis,
		getHourlyActivityPattern,
		getTopMovers,
		getSummaryStats
	} from '../../lib/transactionAnalysis';
	import { notificationStore } from '../../stores/notificationStore';
	import TransactionAnalysisMobileCard from '../../components/TransactionAnalysisMobileCard.svelte';
	import { onMount } from 'svelte';

	// Get pre-loaded data from +page.js
	let { data } = $props();

	// Register Chart.js components
	Chart.register(
		LineController,
		BarController,
		DoughnutController,
		LineElement,
		BarElement,
		ArcElement,
		PointElement,
		CategoryScale,
		LinearScale,
		Title,
		Tooltip,
		Legend
	);

	// Constants
	const CHART_COLORS = {
		stockIn: '#22c55e',
		stockOut: '#ef4444',
		netChange: '#3b82f6',
		activity: '#a855f7',
		cne: '#f59e0b'
	};

	const CNE_DATES = {
		2022: { start: new Date(2022, 7, 19), end: new Date(2022, 8, 5, 23, 59, 59) },
		2023: { start: new Date(2023, 7, 18), end: new Date(2023, 8, 4, 23, 59, 59) },
		2024: { start: new Date(2024, 7, 16), end: new Date(2024, 8, 2, 23, 59, 59) },
		2025: { start: new Date(2025, 7, 13), end: new Date(2025, 8, 1, 23, 59, 59) },
		2026: { start: new Date(2026, 7, 21), end: new Date(2026, 8, 7, 23, 59, 59) }
	};

	// State variables
	let loading = $state(false);
	let dateRange = $state(
		data.dateRange || {
			start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
			end: new Date()
		}
	);
	let dailyAnalysis = $state(data.dailyAnalysis || []);
	let hourlyActivity = $state(data.hourlyActivity || []);
	let topMovers = $state(data.topMovers || []);
	let summaryStats = $state(data.summaryStats || null);
	let activeFilter = $state(30);
	let isMobile = $state(false);

	// Detect mobile viewport
	$effect(() => {
		const checkMobile = () => {
			isMobile = window.innerWidth <= 768;
		};
		checkMobile();
		window.addEventListener('resize', checkMobile);
		return () => window.removeEventListener('resize', checkMobile);
	});

	// Chart instances
	let dailyTrendChart = null;
	let hourlyHeatmapChart = null;
	let topMoversChart = null;
	let transactionTypeChart = null;

	// Computed values
	const startDateStr = $derived(dateRange.start.toISOString().split('T')[0]);
	const endDateStr = $derived(dateRange.end.toISOString().split('T')[0]);
	const daysDifference = $derived(
		Math.ceil((dateRange.end - dateRange.start) / (1000 * 60 * 60 * 24))
	);

	// Utility functions
	function formatDateRange() {
		const start = dateRange.start;
		const end = dateRange.end;
		const today = new Date();
		const yesterday = new Date(today);
		yesterday.setDate(yesterday.getDate() - 1);

		if (
			start.toDateString() === today.toDateString() &&
			end.toDateString() === today.toDateString()
		) {
			return 'Today';
		} else if (
			start.toDateString() === yesterday.toDateString() &&
			end.toDateString() === yesterday.toDateString()
		) {
			return 'Yesterday';
		} else if (daysDifference === 1) {
			return start.toLocaleDateString();
		} else {
			return `Last ${daysDifference} Days`;
		}
	}

	function formatHourLabel(hour) {
		if (hour === 0) return '12 AM';
		if (hour === 12) return '12 PM';
		if (hour < 12) return `${hour} AM`;
		return `${hour - 12} PM`;
	}

	function formatDateLabel(dateStr) {
		const date = new Date(dateStr);
		const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
		const monthDay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
		return `${dayName} ${monthDay}`;
	}

	function destroyChart(chart) {
		if (chart) {
			chart.destroy();
		}
		return null;
	}

	function destroyAllCharts() {
		dailyTrendChart = destroyChart(dailyTrendChart);
		hourlyHeatmapChart = destroyChart(hourlyHeatmapChart);
		topMoversChart = destroyChart(topMoversChart);
		transactionTypeChart = destroyChart(transactionTypeChart);
	}

	// Data loading
	async function loadAnalysisData() {
		loading = true;
		try {
			const [daily, hourly, movers, summary] = await Promise.all([
				getDailyAnalysis(dateRange.start, dateRange.end),
				getHourlyActivityPattern(daysDifference, dateRange.start, dateRange.end),
				getTopMovers(10, daysDifference, dateRange.start, dateRange.end),
				getSummaryStats(dateRange.start, dateRange.end)
			]);

			dailyAnalysis = daily;
			hourlyActivity = hourly;
			topMovers = movers;
			summaryStats = summary;

			updateCharts();
		} catch (error) {
			console.error('Error loading analysis data:', error);
			notificationStore.showNotification('Failed to load analysis data', 'error');
		} finally {
			loading = false;
		}
	}

	// Chart creation functions
	function createDailyTrendChart() {
		const ctx = document.getElementById('dailyTrendChart');
		if (!ctx?.getContext) return;

		dailyTrendChart = destroyChart(dailyTrendChart);

		dailyTrendChart = new Chart(ctx.getContext('2d'), {
			type: 'line',
			data: {
				labels: dailyAnalysis.map((d) => formatDateLabel(d.date)),
				datasets: [
					{
						label: 'Stock In',
						data: dailyAnalysis.map((d) => d.totalAdded),
						borderColor: CHART_COLORS.stockIn,
						backgroundColor: `${CHART_COLORS.stockIn}1A`,
						tension: 0.3,
						fill: true
					},
					{
						label: 'Stock Out',
						data: dailyAnalysis.map((d) => d.totalRemoved),
						borderColor: CHART_COLORS.stockOut,
						backgroundColor: `${CHART_COLORS.stockOut}1A`,
						tension: 0.3,
						fill: true
					},
					{
						label: 'Net Change',
						data: dailyAnalysis.map((d) => d.netChange),
						borderColor: CHART_COLORS.netChange,
						backgroundColor: `${CHART_COLORS.netChange}1A`,
						tension: 0.3,
						fill: true
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					title: { display: false },
					legend: {
						position: 'top',
						labels: { color: '#8b949e', font: { family: 'Geist' } }
					}
				},
				scales: {
					y: {
						beginAtZero: true,
						grid: { color: 'rgba(139, 148, 158, 0.1)' },
						ticks: { color: '#8b949e' }
					},
					x: {
						grid: { display: false },
						ticks: { color: '#8b949e' }
					}
				}
			}
		});
	}

	function createHourlyActivityChart() {
		const ctx = document.getElementById('hourlyHeatmapChart');
		if (!ctx?.getContext) return;

		hourlyHeatmapChart = destroyChart(hourlyHeatmapChart);

		hourlyHeatmapChart = new Chart(ctx.getContext('2d'), {
			type: 'bar',
			data: {
				labels: hourlyActivity.map((h) => formatHourLabel(h.hour)),
				datasets: [
					{
						label: 'Transactions',
						data: hourlyActivity.map((h) => h.transactionCount),
						backgroundColor: CHART_COLORS.netChange,
						borderRadius: 4
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					title: { display: false },
					legend: { display: false }
				},
				scales: {
					y: {
						beginAtZero: true,
						grid: { color: 'rgba(139, 148, 158, 0.1)' },
						ticks: { color: '#8b949e' }
					},
					x: {
						grid: { display: false },
						ticks: { color: '#8b949e' }
					}
				}
			}
		});
	}

	function createTopMoversChart() {
		const ctx = document.getElementById('topMoversChart');
		if (!ctx?.getContext) return;

		topMoversChart = destroyChart(topMoversChart);

		topMoversChart = new Chart(ctx.getContext('2d'), {
			type: 'bar',
			data: {
				labels: topMovers.map((m) => m.itemName),
				datasets: [
					{
						label: 'Total Transactions',
						data: topMovers.map((m) => m.totalTransactions),
						backgroundColor: CHART_COLORS.activity,
						borderRadius: 4
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				indexAxis: 'y',
				plugins: {
					title: { display: false },
					legend: { display: false }
				},
				scales: {
					x: {
						beginAtZero: true,
						grid: { color: 'rgba(139, 148, 158, 0.1)' },
						ticks: { color: '#8b949e' }
					},
					y: {
						grid: { display: false },
						ticks: { color: '#8b949e' }
					}
				}
			}
		});
	}

	function createTransactionTypeChart() {
		if (!summaryStats) return;

		const ctx = document.getElementById('transactionTypeChart');
		if (!ctx?.getContext) return;

		transactionTypeChart = destroyChart(transactionTypeChart);

		transactionTypeChart = new Chart(ctx.getContext('2d'), {
			type: 'doughnut',
			data: {
				labels: ['Stock In', 'Stock Out'],
				datasets: [
					{
						data: [summaryStats.totalAdded, summaryStats.totalRemoved],
						backgroundColor: [CHART_COLORS.stockIn, CHART_COLORS.stockOut],
						borderWidth: 0
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				cutout: '70%',
				plugins: {
					title: { display: false },
					legend: {
						position: 'bottom',
						labels: { color: '#8b949e', font: { family: 'Geist' } }
					}
				}
			}
		});
	}

	function updateCharts() {
		requestAnimationFrame(() => {
			createDailyTrendChart();
			createHourlyActivityChart();
			createTopMoversChart();
			createTransactionTypeChart();
		});
	}

	// Event handlers
	function handleDateChange(type, value) {
		const newDate = new Date(value);
		if (type === 'start') {
			dateRange.start = newDate;
		} else {
			dateRange.end = newDate;
		}
		activeFilter = null;
		loadAnalysisData();
	}

	function setQuickRange(days) {
		const now = new Date();
		dateRange.end = new Date();
		activeFilter = days;

		if (days === 0) {
			dateRange.start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		} else if (days === 1) {
			const yesterday = new Date(now);
			yesterday.setDate(yesterday.getDate() - 1);
			dateRange.start = new Date(
				yesterday.getFullYear(),
				yesterday.getMonth(),
				yesterday.getDate()
			);
			dateRange.end = new Date(
				yesterday.getFullYear(),
				yesterday.getMonth(),
				yesterday.getDate(),
				23,
				59,
				59
			);
		} else {
			dateRange.start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
		}

		loadAnalysisData();
	}

	function setCNERange(year) {
		activeFilter = `cne${year}`;
		const cneDate = CNE_DATES[year];
		if (cneDate) {
			dateRange.start = new Date(cneDate.start);
			dateRange.end = new Date(cneDate.end);
			loadAnalysisData();
		}
	}

	function exportToCSV() {
		if (!dailyAnalysis.length) {
			notificationStore.showNotification('No data to export', 'warning');
			return;
		}

		const headers = ['Date', 'Total Added', 'Total Removed', 'Net Change', 'Transaction Count'];
		const rows = dailyAnalysis.map((d) => [
			d.date,
			d.totalAdded,
			d.totalRemoved,
			d.netChange,
			d.transactionCount
		]);

		const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
		const blob = new Blob([csv], { type: 'text/csv' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `transaction-analysis-${startDateStr}-to-${endDateStr}.csv`;
		a.click();
		URL.revokeObjectURL(url);

		notificationStore.showNotification('Analysis exported successfully', 'success');
	}

	// Effects
	$effect(() => {
		const timer = setTimeout(() => {
			if (dailyAnalysis.length > 0 || summaryStats) {
				updateCharts();
			}
		}, 100);

		return () => {
			clearTimeout(timer);
			destroyAllCharts();
		};
	});

	$effect(() => {
		if (!browser) return;

		let resizeTimer;
		let previousWidth = window.innerWidth;

		function handleResize() {
			clearTimeout(resizeTimer);
			resizeTimer = setTimeout(() => {
				const currentWidth = window.innerWidth;
				const widthDiff = Math.abs(currentWidth - previousWidth);

				if (widthDiff > 50) {
					previousWidth = currentWidth;
					destroyAllCharts();
					updateCharts();
				}
			}, 250);
		}

		window.addEventListener('resize', handleResize);
		return () => {
			window.removeEventListener('resize', handleResize);
			clearTimeout(resizeTimer);
		};
	});
</script>

<svelte:head>
	<title>Transaction Analysis</title>
</svelte:head>

<div class="page-viewport-wrapper">
	<div class="glow-layer"></div>
	<div class="content-container">
		<header class="page-header">
			<div class="title-group">
				<h1 class="main-title">Transaction Analysis</h1>
				<div class="system-status">
					<span class="status-dot"></span>
					<span class="status-text">SYSTEM SECURE</span>
				</div>
			</div>
			<div class="header-actions">
				<button onclick={exportToCSV} class="export-btn">
					<i class="fas fa-download"></i>
					<span>EXPORT DATA</span>
				</button>
			</div>
		</header>

		<div class="ledger-actions">
			<div class="filter-ribbon">
				<div class="ribbon-group">
					<span class="ribbon-label">QUICK RANGE:</span>
					<div class="ribbon-options">
						<button onclick={() => setQuickRange(0)} class="ribbon-btn" class:active={activeFilter === 0}>TODAY</button>
						<button onclick={() => setQuickRange(1)} class="ribbon-btn" class:active={activeFilter === 1}>YESTERDAY</button>
						<button onclick={() => setQuickRange(3)} class="ribbon-btn" class:active={activeFilter === 3}>3D</button>
						<button onclick={() => setQuickRange(7)} class="ribbon-btn" class:active={activeFilter === 7}>7D</button>
						<button onclick={() => setQuickRange(14)} class="ribbon-btn" class:active={activeFilter === 14}>14D</button>
						<button onclick={() => setQuickRange(21)} class="ribbon-btn" class:active={activeFilter === 21}>21D</button>
						<button onclick={() => setQuickRange(30)} class="ribbon-btn" class:active={activeFilter === 30}>30D</button>
					</div>
				</div>
				<div class="ribbon-group">
					<span class="ribbon-label">CNE PERIODS:</span>
					<div class="ribbon-options">
						<button onclick={() => setCNERange(2022)} class="ribbon-btn" class:active={activeFilter === 'cne2022'}>2022</button>
						<button onclick={() => setCNERange(2023)} class="ribbon-btn" class:active={activeFilter === 'cne2023'}>2023</button>
						<button onclick={() => setCNERange(2024)} class="ribbon-btn" class:active={activeFilter === 'cne2024'}>2024</button>
						<button onclick={() => setCNERange(2025)} class="ribbon-btn" class:active={activeFilter === 'cne2025'}>2025</button>
						<button onclick={() => setCNERange(2026)} class="ribbon-btn" class:active={activeFilter === 'cne2026'}>2026</button>
					</div>
				</div>
			</div>

			<div class="date-picker-primary">
				<div class="date-input-group">
					<input type="date" value={startDateStr} onchange={(e) => handleDateChange('start', e.target.value)} class="tech-date-input" />
					<span class="date-separator">TO</span>
					<input type="date" value={endDateStr} onchange={(e) => handleDateChange('end', e.target.value)} class="tech-date-input" />
				</div>
			</div>
		</div>

		{#if summaryStats}
			<div class="summary-grid">
				<div class="summary-card">
					<span class="card-label">TOTAL TRANSACTIONS</span>
					<span class="card-value digital-font">{summaryStats.totalTransactions.toLocaleString()}</span>
					<div class="card-footer">
						<i class="fas fa-exchange-alt"></i>
						<span>SYSTEM_LOGS</span>
					</div>
				</div>
				<div class="summary-card positive">
					<span class="card-label">STOCK IN</span>
					<span class="card-value digital-font">+{summaryStats.totalAdded.toLocaleString()}</span>
					<div class="card-footer">
						<i class="fas fa-plus-circle"></i>
						<span>UNITS_ADDED</span>
					</div>
				</div>
				<div class="summary-card negative">
					<span class="card-label">STOCK OUT</span>
					<span class="card-value digital-font">-{summaryStats.totalRemoved.toLocaleString()}</span>
					<div class="card-footer">
						<i class="fas fa-minus-circle"></i>
						<span>UNITS_REMOVED</span>
					</div>
				</div>
				<div class="summary-card" class:positive={summaryStats.netChange >= 0} class:negative={summaryStats.netChange < 0}>
					<span class="card-label">NET CHANGE</span>
					<span class="card-value digital-font">{summaryStats.netChange >= 0 ? '+' : ''}{summaryStats.netChange.toLocaleString()}</span>
					<div class="card-footer">
						<i class="fas fa-balance-scale"></i>
						<span>PERIOD_DELTA</span>
					</div>
				</div>
			</div>
		{/if}

		<div class="charts-layout">
			<div class="chart-frame full-width">
				<div class="frame-header">
					<span class="frame-title">DAILY TRANSACTION TRENDS</span>
					<div class="frame-status"><span class="dot"></span> LIVE_FEED</div>
				</div>
				<div class="chart-wrapper">
					<canvas id="dailyTrendChart"></canvas>
				</div>
			</div>

			<div class="chart-frame">
				<div class="frame-header">
					<span class="frame-title">HOURLY ACTIVITY PATTERN</span>
				</div>
				<div class="chart-wrapper">
					<canvas id="hourlyHeatmapChart"></canvas>
				</div>
			</div>

			<div class="chart-frame">
				<div class="frame-header">
					<span class="frame-title">TYPE DISTRIBUTION</span>
				</div>
				<div class="chart-wrapper">
					<canvas id="transactionTypeChart"></canvas>
				</div>
			</div>

			<div class="chart-frame full-width">
				<div class="frame-header">
					<span class="frame-title">TOP 10 MOST ACTIVE ITEMS</span>
				</div>
				<div class="chart-wrapper">
					<canvas id="topMoversChart"></canvas>
				</div>
			</div>
		</div>

		{#if isMobile}
			<!-- Mobile Card View -->
			<div class="mobile-cards-container">
				<div class="cards-header">
					<span class="frame-title">TOP MOVING ITEMS</span>
				</div>
				{#each topMovers as mover (mover.itemName)}
					<TransactionAnalysisMobileCard {mover} />
				{/each}
			</div>
		{:else}
			<!-- Desktop Table View -->
			<div class="table-frame">
				<div class="frame-header">
					<span class="frame-title">TOP MOVING ITEMS DETAILS</span>
				</div>
				<div class="table-scroll">
					<table class="tech-table">
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
							{#each topMovers as mover (mover.itemName)}
								<tr class="table-row">
									<td class="name-text">{mover.itemName}</td>
									<td class="digital-font">
										<span class="count-badge">{mover.totalTransactions}</span>
									</td>
									<td class="digital-font">
										<span class="trend-tag positive">+{mover.totalAdded}</span>
									</td>
									<td class="digital-font">
										<span class="trend-tag negative">-{mover.totalRemoved}</span>
									</td>
									<td class="digital-font">
										<span class="trend-tag" class:positive={mover.netChange >= 0} class:negative={mover.netChange < 0}>
											{mover.netChange >= 0 ? '+' : ''}{mover.netChange}
										</span>
									</td>
									<td class="digital-font">
										<span class="volatility-tag">{mover.volatility}</span>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	/* Remove default mobile tap highlights */
	* {
		-webkit-tap-highlight-color: transparent;
		-webkit-touch-callout: none;
	}

	button, input, select, textarea {
		outline: none;
		-webkit-tap-highlight-color: transparent;
	}

	button:focus-visible, input:focus-visible {
		outline: 2px solid var(--tech-accent);
		outline-offset: 2px;
	}

	:global(body) {
		background-color: var(--tech-bg-end) !important;
		background-image: radial-gradient(circle at 50% -10%, var(--tech-bg-start) 0%, var(--tech-bg-end) 100%) !important;
		background-attachment: fixed !important;
		margin: 0;
		padding: 0;
		overflow-x: hidden;
	}

	.page-viewport-wrapper {
		position: relative;
		min-height: 100vh;
		width: 100%;
		display: flex;
		flex-direction: column;
		box-sizing: border-box;
	}

	.glow-layer {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100vh;
		background: radial-gradient(circle at 50% 0%, var(--tech-accent-muted) 0%, transparent 50%);
		pointer-events: none;
		z-index: 0;
	}

	.content-container {
		position: relative;
		z-index: 2;
		max-width: 1400px;
		margin: 0 auto;
		width: 100%;
		padding: 3rem 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		flex-wrap: wrap;
		gap: 2rem;
	}

	.main-title {
		font-size: 2.5rem;
		font-weight: 800;
		color: var(--tech-title);
		margin: 0;
		letter-spacing: -0.05em;
		text-transform: uppercase;
		line-height: 1;
	}

	.system-status {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-top: 0.8rem;
		opacity: 0.8;
	}

	.status-dot {
		width: 6px;
		height: 6px;
		background: var(--tech-accent);
		border-radius: 50%;
		box-shadow: 0 0 10px var(--tech-accent-muted);
		animation: pulse-soft 3s ease-in-out infinite;
	}

	@keyframes pulse-soft {
		0%, 100% { opacity: 0.4; transform: scale(0.9); }
		50% { opacity: 1; transform: scale(1.1); }
	}

	.status-text {
		font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		font-size: 0.6rem;
		color: var(--tech-status-text);
		letter-spacing: 0.2em;
		font-weight: 800;
	}

	.export-btn {
		background: var(--tech-badge-bg);
		border: 1px solid var(--tech-badge-border);
		color: var(--tech-accent);
		padding: 0.75rem 1.5rem;
		font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		font-weight: 800;
		font-size: 0.7rem;
		letter-spacing: 0.1em;
		border-radius: 4px;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		cursor: pointer;
		transition: all 0.3s;
		-webkit-tap-highlight-color: transparent;
		outline: none;
	}

	.export-btn:focus-visible {
		outline: 2px solid var(--tech-accent);
		outline-offset: 2px;
	}

	.export-btn:hover {
		background: var(--tech-accent);
		color: white;
		transform: translateY(-2px);
		box-shadow: 0 5px 15px var(--tech-accent-muted);
	}

	.ledger-actions {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 2rem;
		background: var(--tech-glass-bg);
		padding: 1.5rem;
		border-radius: 12px;
		border: 1px solid var(--tech-glass-border);
	}

	.filter-ribbon {
		display: flex;
		gap: 2.5rem;
		flex-wrap: wrap;
	}

	.ribbon-group {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.ribbon-label {
		font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		font-size: 0.65rem;
		font-weight: 800;
		color: var(--tech-label);
		letter-spacing: 0.05em;
	}

	.ribbon-options {
		display: flex;
		gap: 0.4rem;
	}

	.ribbon-btn {
		background: var(--tech-badge-bg);
		border: 1px solid var(--tech-badge-border);
		color: var(--tech-label);
		padding: 0.35rem 0.75rem;
		font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		font-size: 0.65rem;
		font-weight: 700;
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.2s;
		-webkit-tap-highlight-color: transparent;
		outline: none;
	}

	.ribbon-btn:focus-visible {
		outline: 2px solid var(--tech-accent);
		outline-offset: 2px;
	}

	.ribbon-btn:hover {
		border-color: var(--tech-accent);
		color: var(--tech-accent);
	}

	.ribbon-btn.active {
		background: var(--tech-accent-muted);
		border-color: var(--tech-accent);
		color: var(--tech-accent);
		box-shadow: 0 0 10px var(--tech-accent-muted);
	}

	.date-input-group {
		display: flex;
		align-items: center;
		gap: 1rem;
		background: var(--tech-badge-bg);
		padding: 0.5rem 1rem;
		border-radius: 6px;
		border: 1px solid var(--tech-badge-border);
	}

	.tech-date-input {
		background: transparent;
		border: none;
		color: var(--tech-value);
		font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		font-size: 0.75rem;
		font-weight: 700;
		outline: none;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}

	.tech-date-input:focus-visible {
		outline: 2px solid var(--tech-accent);
		outline-offset: 2px;
	}

	.date-separator {
		font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		font-size: 0.6rem;
		font-weight: 800;
		color: var(--tech-label);
		opacity: 0.5;
	}

	.summary-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: 1.5rem;
	}

	.summary-card {
		background: var(--tech-glass-bg);
		border: 1px solid var(--tech-glass-border);
		border-radius: 12px;
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.summary-card:hover {
		transform: translateY(-4px);
		border-color: var(--tech-accent-muted);
		box-shadow: var(--tech-glass-shadow);
	}

	.card-label {
		font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		font-size: 0.65rem;
		font-weight: 800;
		color: var(--tech-label);
		letter-spacing: 0.1em;
	}

	.card-value {
		font-size: 2rem;
		font-weight: 800;
		color: var(--tech-value);
	}

	.card-footer {
		margin-top: 0.5rem;
		display: flex;
		align-items: center;
		gap: 0.6rem;
		font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		font-size: 0.6rem;
		font-weight: 800;
		color: var(--tech-label);
		opacity: 0.6;
	}

	.summary-card.positive .card-value { color: #22c55e; }
	.summary-card.negative .card-value { color: #ef4444; }

	.digital-font {
		font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
	}

	.charts-layout {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1.5rem;
	}

	.chart-frame {
		background: var(--tech-glass-bg);
		border: 1px solid var(--tech-glass-border);
		border-radius: 12px;
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.chart-frame.full-width {
		grid-column: span 2;
	}

	.frame-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.25rem 1.5rem;
		border-bottom: 1px solid var(--tech-cell-border);
		background: var(--tech-header-bg);
	}

	.frame-title {
		font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		font-size: 0.7rem;
		font-weight: 800;
		color: var(--tech-header-text);
		letter-spacing: 0.15em;
		text-transform: uppercase;
	}

	.frame-status {
		font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		font-size: 0.6rem;
		font-weight: 800;
		color: #22c55e;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.frame-status .dot {
		width: 6px;
		height: 6px;
		background: #22c55e;
		border-radius: 50%;
		animation: pulse-soft 2s infinite;
	}

	.chart-wrapper {
		height: 300px;
		position: relative;
	}

	.table-frame {
		background: var(--tech-glass-bg);
		border: 1px solid var(--tech-glass-border);
		border-radius: 12px;
		overflow: hidden;
	}

	.table-scroll {
		overflow-x: auto;
	}

	.tech-table {
		width: 100%;
		border-collapse: collapse;
	}

	.tech-table th {
		background: var(--tech-header-bg);
		padding: 1.1rem 1.5rem;
		text-align: left;
		font-family: 'Geist', sans-serif;
		font-size: 0.7rem;
		font-weight: 700;
		color: var(--tech-header-text);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		border-bottom: 1px solid var(--tech-cell-border);
	}

	.tech-table td {
		padding: 1rem 1.5rem;
		border-bottom: 1px solid var(--tech-cell-border);
		color: var(--tech-cell-text);
		font-size: 0.85rem;
	}

	.table-row:hover {
		background: var(--tech-row-hover);
	}

	.name-text {
		font-weight: 700;
		color: var(--tech-value);
	}

	.count-badge {
		background: var(--tech-badge-bg);
		border: 1px solid var(--tech-badge-border);
		padding: 0.2rem 0.6rem;
		border-radius: 4px;
		color: var(--tech-value);
	}

	.trend-tag {
		display: inline-flex;
		align-items: center;
		padding: 0.25rem 0.75rem;
		border-radius: 6px;
		font-weight: 800;
		font-size: 0.8rem;
	}

	.trend-tag.positive {
		background: rgba(34, 197, 94, 0.1);
		color: #22c55e;
		border: 1px solid rgba(34, 197, 94, 0.2);
	}

	.trend-tag.negative {
		background: rgba(239, 68, 68, 0.1);
		color: #ef4444;
		border: 1px solid rgba(239, 68, 68, 0.2);
	}

	.volatility-tag {
		color: var(--tech-accent);
		font-weight: 700;
	}

	.positive { color: #22c55e; }
	.negative { color: #ef4444; }

	/* Mobile Cards Container */
	.mobile-cards-container {
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 0;
	}

	.cards-header {
		background: var(--tech-glass-bg);
		border: 1px solid var(--tech-glass-border);
		border-radius: 12px;
		padding: 1rem 1.5rem;
		margin-bottom: 0.5rem;
	}

	.cards-header .frame-title {
		font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		font-size: 0.7rem;
		font-weight: 800;
		color: var(--tech-header-text);
		letter-spacing: 0.15em;
		text-transform: uppercase;
	}

	@media (max-width: 1024px) {
		.charts-layout { grid-template-columns: 1fr; }
		.chart-frame.full-width { grid-column: span 1; }
	}

	@media (max-width: 768px) {
		.content-container {
			padding: 1.25rem;
			gap: 1rem;
		}

		.main-title {
			font-size: 1.5rem;
			letter-spacing: -0.02em;
		}

		.system-status {
			display: none;
		}

		.page-header {
			gap: 1rem;
			margin-bottom: 0;
		}

		.header-actions {
			width: 100%;
		}

		.export-btn {
			width: 100%;
			justify-content: center;
			padding: 0.65rem 1rem;
			font-size: 0.65rem;
		}

		.ledger-actions {
			flex-direction: column;
			align-items: stretch;
			padding: 0;
			gap: 1rem;
			background: transparent;
			border: none;
			border-radius: 0;
		}

		.filter-ribbon {
			flex-direction: column;
			gap: 0.75rem;
			background: var(--tech-glass-bg);
			padding: 0.875rem 1rem;
			border-radius: 8px;
			border: 1px solid var(--tech-glass-border);
		}

		.ribbon-group {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.5rem;
		}

		.ribbon-label {
			font-size: 0.55rem;
			color: var(--tech-label);
			opacity: 0.8;
		}

		.ribbon-options {
			flex-wrap: wrap;
			gap: 0.35rem;
			width: 100%;
		}

		.ribbon-btn {
			padding: 0.3rem 0.6rem;
			font-size: 0.6rem;
			flex: 1 1 auto;
			min-width: max-content;
		}

		.date-picker-primary {
			width: 100%;
		}

		.date-input-group {
			padding: 0.5rem 0.75rem;
			gap: 0.75rem;
			width: 100%;
			justify-content: center;
		}

		.tech-date-input {
			font-size: 0.7rem;
			flex: 1;
		}

		.summary-grid {
			grid-template-columns: repeat(2, 1fr);
			gap: 0.75rem;
		}

		.summary-card {
			padding: 0.875rem;
			border-radius: 8px;
			gap: 0.35rem;
		}

		.summary-card:hover {
			transform: none;
		}

		.card-label {
			font-size: 0.55rem;
		}

		.card-value {
			font-size: 1.35rem;
		}

		.card-footer {
			margin-top: 0.25rem;
			font-size: 0.55rem;
			gap: 0.4rem;
		}

		.chart-frame {
			padding: 1rem;
			border-radius: 8px;
			gap: 1rem;
		}

		.frame-header {
			padding: 0.875rem 1rem;
		}

		.frame-title {
			font-size: 0.6rem;
		}

		.chart-wrapper {
			height: 220px;
		}

		.mobile-cards-container {
			gap: 12px;
		}

		.cards-header {
			padding: 0.875rem 1rem;
			margin-bottom: 0.25rem;
		}

		.cards-header .frame-title {
			font-size: 0.65rem;
		}
	}
</style>
