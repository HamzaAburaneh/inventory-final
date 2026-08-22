<script>
	import { Chart, registerables } from 'chart.js';
		import { fairWindowForYear } from '../../lib/cneCalendar.js';
	import { getAnalyticsForRange } from '../../lib/transactionAnalysis';
	import { notificationStore } from '../../stores/notificationStore';
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';

	// Constants
	const CHART_COLORS = {
		stockIn: '#4CAF50',
		stockOut: '#F44336',
		netChange: '#2196F3',
		activity: '#9C27B0',
		cne: '#FF6B35'
	};

	// Neutral chart chrome — #727272 (matches --text-color-dimmed) is legible on
	// both the light (#fff) and dark (#121212) tile surfaces, so ticks/legend stay
	// readable without rebuilding charts on theme toggle. Gridlines are a faint,
	// theme-agnostic grey.
	const AXIS_TEXT = '#8a8a8a';
	const GRID_COLOR = 'rgba(128, 128, 128, 0.14)';

	const FIRST_CNE_YEAR = 2022;
	const CURRENT_CNE_YEAR = new Date().getFullYear();
	const CNE_YEARS = Array.from(
		{ length: CURRENT_CNE_YEAR - FIRST_CNE_YEAR + 1 },
		(_, index) => FIRST_CNE_YEAR + index
	);
	const CNE_DATES = Object.fromEntries(
		CNE_YEARS.map((year) => {
			const window = fairWindowForYear(year);
			return [
				year,
				{
					start: window.start,
					end: new Date(
						window.end.getFullYear(),
						window.end.getMonth(),
						window.end.getDate(),
						23,
						59,
						59
					)
				}
			];
		})
	);

	// The app is only used during the CNE, so open on the most recent CNE that has
	// already started (the current one while it's running, otherwise last year's).
	// Returns null before any CNE exists so we can fall back to a rolling window.
	function getDefaultCneYear() {
		const now = new Date();
		const started = Object.keys(CNE_DATES)
			.map(Number)
			.filter((year) => CNE_DATES[year].start <= now);
		return started.length ? Math.max(...started) : null;
	}

	const defaultCneYear = getDefaultCneYear();

	// State variables
	let loading = $state(true); // full-page spinner — first load only
	let refreshing = $state(false); // in-place refresh — keeps charts mounted
	let dateRange = $state(
		defaultCneYear
			? {
					start: new Date(CNE_DATES[defaultCneYear].start),
					end: new Date(CNE_DATES[defaultCneYear].end)
				}
			: {
					start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
					end: new Date()
				}
	);
	let dailyAnalysis = $state([]);
	let hourlyActivity = $state([]);
	let topMovers = $state([]);
	let summaryStats = $state(null);
	let activeFilter = $state(defaultCneYear ? `cne${defaultCneYear}` : 30);

	// Chart instances — plain let; never read by template or $derived
	let dailyTrendChart = null;
	let hourlyHeatmapChart = null;
	let transactionTypeChart = null;

	// Computed values
	const startDateStr = $derived(dateRange.start.toISOString().split('T')[0]);
	const endDateStr = $derived(dateRange.end.toISOString().split('T')[0]);
	const daysDifference = $derived(
		Math.ceil((dateRange.end - dateRange.start) / (1000 * 60 * 60 * 24))
	);

	// Utility functions
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
			return null;
		}
		return chart;
	}

	function destroyAllCharts() {
		dailyTrendChart = destroyChart(dailyTrendChart);
		hourlyHeatmapChart = destroyChart(hourlyHeatmapChart);
		transactionTypeChart = destroyChart(transactionTypeChart);
	}

	// TEMP PERF INSTRUMENTATION — remove after read/latency measurement.
	// Logs each analytics load duration plus a running median over the session, so
	// warm re-clicks of the same range accumulate samples. Collect 3–5 cold (one
	// per hard reload, read the first line each time) and 3–5 warm (re-click the
	// same range), then take the medians. Keep the read-count check BEFORE enabling
	// Firestore offline persistence so local caching doesn't pollute it.
	const __perfSamples = [];
	function __logLoadDuration(ms) {
		__perfSamples.push(ms);
		const sorted = [...__perfSamples].sort((a, b) => a - b);
		const mid = Math.floor(sorted.length / 2);
		const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
		console.log(
			`[PERF] analytics load ${ms.toFixed(1)}ms — n=${sorted.length}, median=${median.toFixed(1)}ms`
		);
	}

	// Data loading
	async function loadAnalysisData() {
		const __perfStart = performance.now(); // TEMP PERF — remove with __logLoadDuration
		// Only show the full-page spinner before the first dataset exists.
		// Later filter changes refresh in place so charts never unmount.
		if (summaryStats) {
			refreshing = true;
		} else {
			loading = true;
		}
		try {
			const {
				daily,
				hourly,
				topMovers: movers,
				summary
			} = await getAnalyticsForRange(dateRange.start, dateRange.end, { topMoversLimit: 10 });

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
			refreshing = false;
			__logLoadDuration(performance.now() - __perfStart); // TEMP PERF — remove after measuring
		}
	}

	// Chart creation functions
	function createDailyTrendChart() {
		const ctx = document.getElementById('dailyTrendChart');
		if (!ctx?.getContext) return;

		// Destroy whatever chart Chart.js has registered for THIS canvas, not
		// just the one our variable tracks. Resize/rAF races can leave the
		// variable stale, and a stale canvas registration makes `new Chart`
		// throw "Canvas is already in use" — which froze this page's charts.
		Chart.getChart(ctx)?.destroy();
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
						borderWidth: 2,
						tension: 0,
						pointRadius: 0,
						pointHoverRadius: 5,
						fill: false
					},
					{
						label: 'Stock Out',
						data: dailyAnalysis.map((d) => d.totalRemoved),
						borderColor: CHART_COLORS.stockOut,
						backgroundColor: `${CHART_COLORS.stockOut}1A`,
						borderWidth: 2,
						tension: 0,
						pointRadius: 0,
						pointHoverRadius: 5,
						fill: false
					},
					{
						label: 'Net Change',
						data: dailyAnalysis.map((d) => d.netChange),
						borderColor: CHART_COLORS.netChange,
						backgroundColor: `${CHART_COLORS.netChange}1A`,
						borderWidth: 2,
						tension: 0,
						pointRadius: 0,
						pointHoverRadius: 5,
						fill: false
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				interaction: {
					mode: 'index',
					intersect: false
				},
				plugins: {
					title: {
						display: false
					},
					legend: {
						position: 'top',
						labels: {
							usePointStyle: true,
							pointStyle: 'circle',
							boxWidth: 8,
							boxHeight: 8,
							padding: 16
						}
					}
				},
				scales: {
					x: {
						grid: { display: false },
						border: { display: false }
					},
					y: {
						beginAtZero: true,
						grid: { color: GRID_COLOR },
						border: { display: false }
					}
				}
			}
		});
	}

	function createHourlyActivityChart() {
		const ctx = document.getElementById('hourlyHeatmapChart');
		if (!ctx?.getContext) return;

		Chart.getChart(ctx)?.destroy();

		const maxCount = Math.max(...hourlyActivity.map((h) => h.transactionCount)) || 1;

		hourlyHeatmapChart = new Chart(ctx.getContext('2d'), {
			type: 'bar',
			data: {
				labels: hourlyActivity.map((h) => formatHourLabel(h.hour)),
				datasets: [
					{
						label: 'Transactions',
						data: hourlyActivity.map((h) => h.transactionCount),
						backgroundColor: hourlyActivity.map((h) => {
							const intensity = h.transactionCount / maxCount;
							return `${CHART_COLORS.netChange}${Math.round((0.2 + intensity * 0.8) * 255)
								.toString(16)
								.padStart(2, '0')}`;
						}),
						borderRadius: 4,
						maxBarThickness: 22
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					title: {
						display: false
					},
					legend: {
						display: false
					}
				},
				scales: {
					x: {
						grid: { display: false },
						border: { display: false }
					},
					y: {
						beginAtZero: true,
						grid: { color: GRID_COLOR },
						border: { display: false }
					}
				}
			}
		});
	}

	function createTransactionTypeChart() {
		if (!summaryStats) return;

		const ctx = document.getElementById('transactionTypeChart');
		if (!ctx?.getContext) return;

		Chart.getChart(ctx)?.destroy();

		transactionTypeChart = new Chart(ctx.getContext('2d'), {
			type: 'doughnut',
			data: {
				labels: ['Stock In', 'Stock Out'],
				datasets: [
					{
						data: [summaryStats.totalAdded, summaryStats.totalRemoved],
						backgroundColor: [CHART_COLORS.stockIn, CHART_COLORS.stockOut],
						borderWidth: 0,
						hoverOffset: 6
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				cutout: '68%',
				layout: { padding: 8 },
				plugins: {
					title: {
						display: false
					},
					legend: {
						position: 'bottom',
						labels: {
							usePointStyle: true,
							pointStyle: 'circle',
							boxWidth: 8,
							boxHeight: 8,
							padding: 16
						}
					}
				}
			}
		});
	}

	function updateCharts() {
		requestAnimationFrame(() => {
			createDailyTrendChart();
			createHourlyActivityChart();
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

	// One-time setup: Chart.js registration, initial data load, and resize handling
	onMount(() => {
		Chart.register(...registerables);

		// App-matching chart chrome so charts read like the rest of the UI.
		Chart.defaults.color = AXIS_TEXT;
		Chart.defaults.font.family =
			"system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

		loadAnalysisData();

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
		window.addEventListener('orientationchange', handleResize);

		return () => {
			destroyAllCharts();
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
	<!-- Page header -->
	<header class="page-head">
		<div class="brand-badge"><i class="fas fa-chart-line"></i></div>
		<div class="titles">
			<h1>Transaction Analysis</h1>
			<p class="range-sub">{startDateStr} → {endDateStr} · {daysDifference} day window</p>
		</div>
	</header>

	<!-- Toolbar -->
	<div class="toolbar">
		<div class="date-fields">
			<label class="date-field">
				<span>Start</span>
				<input
					type="date"
					value={startDateStr}
					max={endDateStr}
					onchange={(e) => handleDateChange('start', e.target.value)}
				/>
			</label>
			<label class="date-field">
				<span>End</span>
				<input
					type="date"
					value={endDateStr}
					min={startDateStr}
					max={new Date().toISOString().split('T')[0]}
					onchange={(e) => handleDateChange('end', e.target.value)}
				/>
			</label>
		</div>

		<div class="pill-set">
			<button class="pill" class:on={activeFilter === 0} onclick={() => setQuickRange(0)}
				>Today</button
			>
			<button class="pill" class:on={activeFilter === 1} onclick={() => setQuickRange(1)}
				>Yesterday</button
			>
			<button class="pill" class:on={activeFilter === 3} onclick={() => setQuickRange(3)}
				>3 Days</button
			>
			<button class="pill" class:on={activeFilter === 7} onclick={() => setQuickRange(7)}
				>7 Days</button
			>
			<button class="pill" class:on={activeFilter === 14} onclick={() => setQuickRange(14)}
				>14 Days</button
			>
			<button class="pill" class:on={activeFilter === 21} onclick={() => setQuickRange(21)}
				>21 Days</button
			>
			<button class="pill" class:on={activeFilter === 30} onclick={() => setQuickRange(30)}
				>30 Days</button
			>
		</div>

		<div class="pill-set cne">
			<span class="set-label">CNE</span>
			{#each CNE_YEARS as year (year)}
				<button
					class="pill cne-pill"
					class:on={activeFilter === `cne${year}`}
					onclick={() => setCNERange(year)}>{year}</button
				>
			{/each}
		</div>

		<button class="export" onclick={exportToCSV}>
			<i class="fas fa-download"></i>
			Export CSV
		</button>
	</div>

	<!-- KPI bento -->
	{#if summaryStats}
		<div class="bento-kpis" in:fade={{ duration: 200 }}>
			<div class="tile kpi">
				<div class="t-top">
					<span class="t-lab">Transactions</span>
					<span class="badge accent"><i class="fas fa-exchange-alt"></i></span>
				</div>
				<div class="t-val">{summaryStats.totalTransactions.toLocaleString()}</div>
				<div class="t-note">total recorded</div>
			</div>
			<div class="tile kpi">
				<div class="t-top">
					<span class="t-lab">Stock In</span>
					<span class="badge in"><i class="fas fa-plus-circle"></i></span>
				</div>
				<div class="t-val pos">+{summaryStats.totalAdded.toLocaleString()}</div>
				<div class="t-note">total units added</div>
			</div>
			<div class="tile kpi">
				<div class="t-top">
					<span class="t-lab">Stock Out</span>
					<span class="badge out"><i class="fas fa-minus-circle"></i></span>
				</div>
				<div class="t-val neg">
					{summaryStats.totalRemoved > 0 ? '-' : ''}{summaryStats.totalRemoved.toLocaleString()}
				</div>
				<div class="t-note">total units removed</div>
			</div>
			<div class="tile kpi">
				<div class="t-top">
					<span class="t-lab">Net Change</span>
					<span class="badge {summaryStats.netChange >= 0 ? 'in' : 'out'}">
						<i class="fas fa-balance-scale"></i>
					</span>
				</div>
				<div class="t-val {summaryStats.netChange >= 0 ? 'pos' : 'neg'}">
					{summaryStats.netChange >= 0 ? '+' : ''}{summaryStats.netChange.toLocaleString()}
				</div>
				<div class="t-note">net movement</div>
			</div>

			<div class="tile kpi mini">
				<div class="t-top">
					<span class="t-lab">Active Items</span>
					<span class="badge accent"><i class="fas fa-boxes"></i></span>
				</div>
				<div class="t-val">{summaryStats.uniqueItems.toLocaleString()}</div>
				<div class="t-note">had transactions</div>
			</div>
			<div class="tile kpi mini">
				<div class="t-top">
					<span class="t-lab">Inactive Items</span>
					<span class="badge warn"><i class="fas fa-archive"></i></span>
				</div>
				<div class="t-val">{summaryStats.inactiveItems.toLocaleString()}</div>
				<div class="t-note">no activity</div>
			</div>
			<div class="tile kpi mini">
				<div class="t-top">
					<span class="t-lab">New Items</span>
					<span class="badge net"><i class="fas fa-plus-square"></i></span>
				</div>
				<div class="t-val">{summaryStats.newItemsCreated.toLocaleString()}</div>
				<div class="t-note">added to inventory</div>
			</div>
			<div class="tile kpi mini">
				<div class="t-top">
					<span class="t-lab">Items Deleted</span>
					<span class="badge activity"><i class="fas fa-trash"></i></span>
				</div>
				<div class="t-val">{summaryStats.itemsDeleted.toLocaleString()}</div>
				<div class="t-note">removed</div>
			</div>
		</div>
	{:else}
		<div class="bento-kpis">
			{#each Array(8) as _unused, i (i)}
				<div class="tile kpi skeleton"></div>
			{/each}
		</div>
	{/if}

	<!-- Charts + table bento -->
	{#if loading}
		<div class="bento-charts" aria-busy="true">
			<div class="tile chart-tile col-4 skeleton" style="min-height: 440px"></div>
			<div class="tile chart-tile col-2 skeleton"></div>
			<div class="tile chart-tile col-2 skeleton"></div>
			<div class="tile col-4 skeleton" style="min-height: 240px"></div>
		</div>
	{:else}
		<div class="content-wrap" class:refreshing aria-busy={refreshing} in:fade={{ duration: 200 }}>
			{#if refreshing}
				<div class="refresh-overlay">
					<div
						class="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"
					></div>
				</div>
			{/if}
			<div class="bento-charts">
				<div class="tile chart-tile col-4">
					<h3>Daily Transaction Trends</h3>
					<p class="h-sub">Stock in / out / net across the window</p>
					<div class="canvas-wrap tall"><canvas id="dailyTrendChart"></canvas></div>
				</div>

				<div class="tile chart-tile col-2">
					<h3>Transaction Type</h3>
					<p class="h-sub">Distribution of stock movement</p>
					<div class="canvas-wrap"><canvas id="transactionTypeChart"></canvas></div>
				</div>

				<div class="tile chart-tile col-2">
					<h3>Hourly Activity Pattern</h3>
					<p class="h-sub">Transactions by hour of day</p>
					<div class="canvas-wrap"><canvas id="hourlyHeatmapChart"></canvas></div>
				</div>

				<div class="tile col-4 table-tile">
					<h3>Top Moving Items</h3>
					<p class="h-sub">Ranked by transaction count &amp; volatility</p>
					<div class="table-wrapper">
						<table class="data-table">
							<thead>
								<tr>
									<th>Item</th>
									<th>Txns</th>
									<th>Stock In</th>
									<th>Stock Out</th>
									<th>Net</th>
									<th>Volatility</th>
								</tr>
							</thead>
							<tbody>
								{#each topMovers as mover (mover.itemId)}
									<tr>
										<td class="item-name">{mover.itemName}</td>
										<td><span class="chip-num">{mover.totalTransactions}</span></td>
										<td class="pos">+{mover.totalAdded}</td>
										<td class="neg">-{mover.totalRemoved}</td>
										<td class={mover.netChange >= 0 ? 'pos' : 'neg'}>
											{mover.netChange >= 0 ? '+' : ''}{mover.netChange}
										</td>
										<td>{mover.volatility}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	/* Local semantic tokens — accent uses the app's theme-aware pair
	   (--add-item-color / --add-item-on: blue+white in light, gold+black in dark). */
	.analysis-page {
		--pos: #2e9e57;
		--neg: #e0483b;
		--warn: #ef8a17;
		--net: #2196f3;
		--activity: #9c27b0;
		padding: 2rem;
		max-width: 1440px;
		margin: 0 auto;
		width: 100%;
		overflow-x: hidden;
	}

	:global([data-theme='dark']) .analysis-page {
		--pos: #4caf50;
		--neg: #f44336;
		--warn: #fbbf24;
		--net: #64b5f6;
		--activity: #ce93d8;
	}

	/* ===== Header ===== */
	.page-head {
		display: flex;
		align-items: center;
		gap: 0.9rem;
		margin-bottom: 1.25rem;
	}

	.brand-badge {
		width: 2.75rem;
		height: 2.75rem;
		border-radius: 0.85rem;
		display: grid;
		place-items: center;
		font-size: 1.15rem;
		background: var(--add-item-color);
		color: var(--add-item-on);
		flex-shrink: 0;
	}

	.titles h1 {
		font-size: var(--text-2xl);
		font-weight: var(--font-weight-bold);
		letter-spacing: -0.02em;
		line-height: 1.1;
	}

	.range-sub {
		font-size: 0.82rem;
		color: var(--text-color-dimmed);
		margin-top: 0.15rem;
	}

	/* ===== Toolbar ===== */
	.toolbar {
		background: var(--container-bg);
		border: 1px solid var(--table-border-color);
		border-radius: 1rem;
		padding: 0.85rem 1rem;
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
		align-items: center;
		margin-bottom: 1.25rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
	}

	.date-fields {
		display: flex;
		gap: 0.5rem;
	}

	.date-field {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.date-field span {
		font-size: 0.62rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-color-dimmed);
	}

	.date-field input {
		background: var(--background-color);
		border: 1px solid var(--table-border-color);
		border-radius: 0.5rem;
		color: var(--text-color);
		padding: 0.4rem 0.55rem;
		font-size: 0.8rem;
		font-family: inherit;
	}

	.pill-set {
		display: inline-flex;
		flex-wrap: wrap;
		gap: 0.3rem;
		align-items: center;
		background: var(--background-color);
		border-radius: 0.7rem;
		padding: 0.25rem;
	}

	.set-label {
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-color-dimmed);
		padding: 0 0.35rem;
	}

	.pill {
		border: none;
		background: transparent;
		color: var(--text-color-dimmed);
		padding: 0.4rem 0.7rem;
		font-size: 0.78rem;
		font-weight: 500;
		border-radius: 0.5rem;
		cursor: pointer;
		font-family: inherit;
		transition: all 0.18s ease;
		white-space: nowrap;
	}

	.pill:hover {
		color: var(--text-color);
	}

	.pill.on {
		background: var(--add-item-color);
		color: var(--add-item-on);
		font-weight: 600;
	}

	.cne-pill.on {
		background: #ff6b35;
		color: #fff;
	}

	.export {
		margin-left: auto;
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		background: var(--add-item-color);
		color: var(--add-item-on);
		border: none;
		border-radius: 0.6rem;
		padding: 0.55rem 1rem;
		font-size: 0.82rem;
		font-weight: 600;
		cursor: pointer;
		font-family: inherit;
		transition: transform 0.2s ease;
	}

	.export:hover {
		transform: translateY(-1px);
	}

	/* ===== Bento grids ===== */
	.bento-kpis,
	.bento-charts {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1rem;
	}

	.bento-kpis {
		margin-bottom: 1rem;
	}

	.col-2 {
		grid-column: span 2;
	}

	.col-4 {
		grid-column: span 4;
	}

	/* ===== Tile base ===== */
	.tile {
		background: var(--container-bg);
		border: 1px solid var(--table-border-color);
		border-radius: 1rem;
		padding: 1.25rem 1.35rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
		position: relative;
		overflow: hidden;
	}

	/* ===== KPI tiles ===== */
	.t-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.t-lab {
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--text-color-dimmed);
	}

	.badge {
		width: 2rem;
		height: 2rem;
		border-radius: 0.6rem;
		display: grid;
		place-items: center;
		font-size: 0.9rem;
		flex-shrink: 0;
	}

	.badge.accent {
		background: var(--background-color);
		color: var(--add-item-color);
	}
	.badge.in {
		background: rgba(76, 175, 80, 0.14);
		color: var(--pos);
	}
	.badge.out {
		background: rgba(244, 67, 54, 0.14);
		color: var(--neg);
	}
	.badge.warn {
		background: rgba(239, 138, 23, 0.14);
		color: var(--warn);
	}
	.badge.net {
		background: rgba(33, 150, 243, 0.14);
		color: var(--net);
	}
	.badge.activity {
		background: rgba(156, 39, 176, 0.14);
		color: var(--activity);
	}

	.t-val {
		font-size: 1.9rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		margin-top: 0.75rem;
		line-height: 1;
		word-break: break-word;
	}

	.kpi.mini .t-val {
		font-size: 1.5rem;
	}

	.t-note {
		font-size: 0.72rem;
		color: var(--text-color-dimmed);
		margin-top: 0.4rem;
	}

	.pos {
		color: var(--pos);
	}

	.neg {
		color: var(--neg);
	}

	/* ===== Chart tiles ===== */
	.chart-tile h3,
	.table-tile h3 {
		font-size: 0.95rem;
		font-weight: 600;
	}

	.h-sub {
		font-size: 0.75rem;
		color: var(--text-color-dimmed);
		margin: 0.15rem 0 0.9rem;
	}

	.canvas-wrap {
		position: relative;
		height: 320px;
	}

	.canvas-wrap.tall {
		height: 380px;
	}

	/* ===== Table ===== */
	.table-wrapper {
		overflow-x: auto;
	}

	.data-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.85rem;
	}

	.data-table th {
		text-align: left;
		font-size: 0.68rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-color-dimmed);
		padding: 0.6rem 0.7rem;
		border-bottom: 1px solid var(--table-border-color);
	}

	.data-table th:not(:first-child),
	.data-table td:not(:first-child) {
		text-align: right;
	}

	.data-table td {
		padding: 0.7rem;
		border-bottom: 1px solid var(--table-border-color);
		font-variant-numeric: tabular-nums;
	}

	.data-table tbody tr:last-child td {
		border-bottom: none;
	}

	.data-table tbody tr:hover {
		background: var(--table-row-hover-bg);
	}

	.item-name {
		font-weight: 500;
	}

	.chip-num {
		display: inline-block;
		min-width: 1.4rem;
		text-align: center;
		background: var(--background-color);
		border-radius: 0.4rem;
		padding: 0.15rem 0.4rem;
		font-weight: 600;
		font-size: 0.78rem;
	}

	/* ===== Refresh + skeleton states ===== */
	.content-wrap {
		position: relative;
		transition: opacity 0.2s ease;
	}

	.content-wrap.refreshing {
		opacity: 0.5;
		pointer-events: none;
	}

	.refresh-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding-top: 4rem;
		z-index: 5;
	}

	.skeleton {
		position: relative;
		overflow: hidden;
		background: var(--background-color);
		border-color: transparent;
	}

	.tile.kpi.skeleton {
		min-height: 8.5rem;
	}

	.chart-tile.skeleton {
		min-height: 400px;
	}

	.skeleton::after {
		content: '';
		position: absolute;
		inset: 0;
		transform: translateX(-100%);
		background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.06), transparent);
		animation: shimmer 1.4s ease-in-out infinite;
	}

	@keyframes shimmer {
		100% {
			transform: translateX(100%);
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

	@media (prefers-reduced-motion: reduce) {
		.skeleton::after {
			animation: none;
		}
	}

	/* ===== Responsive ===== */
	@media (max-width: 1080px) {
		.bento-kpis,
		.bento-charts {
			grid-template-columns: repeat(2, 1fr);
		}

		.col-2,
		.col-4 {
			grid-column: span 2;
		}
	}

	@media (max-width: 768px) {
		.analysis-page {
			padding: 0.75rem;
		}

		.toolbar {
			padding: 0.75rem;
		}

		.titles h1 {
			font-size: 1.35rem;
		}

		.canvas-wrap {
			height: 260px;
		}
	}

	@media (max-width: 620px) {
		.bento-kpis,
		.bento-charts {
			grid-template-columns: 1fr;
		}

		.col-2,
		.col-4 {
			grid-column: span 1;
		}

		.export {
			margin-left: 0;
			width: 100%;
			justify-content: center;
		}

		.pill-set {
			width: 100%;
			justify-content: center;
		}

		.data-table th:nth-child(6),
		.data-table td:nth-child(6) {
			display: none;
		}
	}

	@media (max-width: 480px) {
		.bento-kpis {
			grid-template-columns: 1fr 1fr;
		}

		.data-table th:nth-child(3),
		.data-table td:nth-child(3),
		.data-table th:nth-child(4),
		.data-table td:nth-child(4) {
			display: none;
		}
	}
</style>
