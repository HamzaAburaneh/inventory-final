<script>
	import StockPredictions from '../../components/StockPredictions.svelte';
	import { notificationStore } from '../../stores/notificationStore.js';
	import {
		Chart,
		BarController,
		BarElement,
		CategoryScale,
		LinearScale,
		Title,
		Tooltip,
		Legend
	} from 'chart.js';
	import { itemStore } from '../../stores/itemStore.js';
	import { onMount } from 'svelte';

	// Get pre-loaded data from +page.js
	let { data } = $props();

	// Register Chart.js components
	Chart.register(BarController, BarElement, CategoryScale, LinearScale, Title, Tooltip, Legend);

	// Chart instance
	let overviewChart = null;
	let predictions = $state(data.predictions || {});

	// Use Svelte's $ prefix for auto-subscription
	const items = $derived($itemStore.length > 0 ? $itemStore : data.items || []);
	const notifications = $derived($notificationStore);
	const latestNotification = $derived(notifications?.[notifications.length - 1] || null);

	const totalItems = $derived(items.length);
	const itemsNeedingRestock = $derived(
		items.filter((item) => {
			const predictionData = predictions[item.id];
			if (!predictionData) return false;
			const prediction = Array.isArray(predictionData) ? predictionData : predictionData.prediction;
			if (!Array.isArray(prediction)) return false;
			const totalPrediction = prediction.reduce((sum, daily) => sum + daily, 0);
			return item.count < totalPrediction;
		}).length
	);
	const potentialOverstock = $derived(
		items.filter((item) => {
			const predictionData = predictions[item.id];
			if (!predictionData) return false;
			const prediction = Array.isArray(predictionData) ? predictionData : predictionData.prediction;
			if (!Array.isArray(prediction)) return false;
			const totalPrediction = prediction.reduce((sum, daily) => sum + daily, 0);
			return item.count > totalPrediction * 1.5;
		}).length
	);

	// Initialize chart
	$effect(() => {
		const timer = setTimeout(() => {
			const ctx = document.getElementById('overviewChart');
			if (ctx && !overviewChart) {
				overviewChart = new Chart(ctx, {
					type: 'bar',
					data: {
						labels: ['Total Items', 'Needs Restock', 'Potential Overstock'],
						datasets: [
							{
								label: 'Inventory Overview',
								data: [totalItems, itemsNeedingRestock, potentialOverstock],
								backgroundColor: ['#3b82f6', '#f59e0b', '#ef4444'],
								borderRadius: 6
							}
						]
					},
					options: {
						responsive: true,
						maintainAspectRatio: false,
						plugins: {
							legend: { display: false },
							title: { display: false }
						},
						scales: {
							y: {
								beginAtZero: true,
								grid: { color: 'rgba(139, 148, 158, 0.1)' },
								ticks: { color: '#8b949e', font: { family: 'JetBrains Mono' } }
							},
							x: {
								grid: { display: false },
								ticks: { color: '#8b949e', font: { family: 'JetBrains Mono' } }
							}
						}
					}
				});
			}
		}, 100);

		return () => {
			clearTimeout(timer);
			if (overviewChart) {
				overviewChart.destroy();
				overviewChart = null;
			}
		};
	});

	$effect(() => {
		if (overviewChart) {
			overviewChart.data.datasets[0].data = [totalItems, itemsNeedingRestock, potentialOverstock];
			overviewChart.update();
		}
	});
</script>

<svelte:head>
	<title>Inventory Predictions</title>
</svelte:head>

<div class="page-viewport-wrapper">
	<div class="glow-layer"></div>
	<div class="content-container">
		<header class="page-header">
			<div class="title-group">
				<h1 class="main-title">Inventory Predictions</h1>
				<div class="system-status">
					<span class="status-dot"></span>
					<span class="status-text">AI_ENGINE_ACTIVE</span>
				</div>
			</div>
		</header>

		<div class="dashboard-layout">
			<div class="summary-grid">
				<div class="summary-card">
					<span class="card-label">TOTAL ITEMS</span>
					<span class="card-value digital-font">{totalItems}</span>
					<div class="card-footer">
						<i class="fas fa-box"></i>
						<span>DATABASE_SYNC</span>
					</div>
				</div>
				<div class="summary-card warning">
					<span class="card-label">NEEDS RESTOCK</span>
					<span class="card-value digital-font">{itemsNeedingRestock}</span>
					<div class="card-footer">
						<i class="fas fa-exclamation-triangle"></i>
						<span>LOW_STOCK_ALERT</span>
					</div>
				</div>
				<div class="summary-card danger">
					<span class="card-label">POTENTIAL OVERSTOCK</span>
					<span class="card-value digital-font">{potentialOverstock}</span>
					<div class="card-footer">
						<i class="fas fa-boxes"></i>
						<span>EXCESS_INVENTORY</span>
					</div>
				</div>
			</div>

			<div class="chart-frame">
				<div class="frame-header">
					<span class="frame-title">INVENTORY STATUS OVERVIEW</span>
				</div>
				<div class="chart-wrapper">
					<canvas id="overviewChart"></canvas>
				</div>
			</div>
		</div>

		<div class="predictions-section">
			<div class="section-header">
				<h2 class="section-title">
					<i class="fas fa-brain"></i>
					<span>AI-POWERED INSIGHTS</span>
				</h2>
				<p class="section-description">
					Historical sales data analysis combined with ARIMA time-series modeling and GPT-4o enhanced predictions.
				</p>
			</div>
			
			<div class="predictions-container">
				<StockPredictions />
			</div>
		</div>
	</div>
</div>

{#if latestNotification}
	<div class="notification {latestNotification.type}">
		<div class="notification-content">
			<i class="fas {latestNotification.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
			<span>{latestNotification.message}</span>
		</div>
	</div>
{/if}

<style>
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
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.6rem;
		color: var(--tech-status-text);
		letter-spacing: 0.2em;
		font-weight: 800;
	}

	.dashboard-layout {
		display: grid;
		grid-template-columns: 1fr 1.5fr;
		gap: 1.5rem;
	}

	.summary-grid {
		display: flex;
		flex-direction: column;
		gap: 1rem;
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
		transform: translateX(5px);
		border-color: var(--tech-accent-muted);
		box-shadow: var(--tech-glass-shadow);
	}

	.card-label {
		font-family: 'JetBrains Mono', monospace;
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
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.6rem;
		font-weight: 800;
		color: var(--tech-label);
		opacity: 0.6;
	}

	.summary-card.warning .card-value { color: #f59e0b; }
	.summary-card.danger .card-value { color: #ef4444; }

	.digital-font {
		font-family: 'JetBrains Mono', monospace;
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

	.frame-header {
		padding-bottom: 1rem;
		border-bottom: 1px solid var(--tech-cell-border);
	}

	.frame-title {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.75rem;
		font-weight: 800;
		color: var(--tech-label);
		letter-spacing: 0.1em;
	}

	.chart-wrapper {
		flex: 1;
		min-height: 300px;
		position: relative;
	}

	.predictions-section {
		margin-top: 2rem;
	}

	.section-header {
		margin-bottom: 2rem;
		padding-left: 1rem;
		border-left: 4px solid var(--tech-accent);
	}

	.section-title {
		display: flex;
		align-items: center;
		gap: 1rem;
		font-size: 1.5rem;
		font-weight: 800;
		color: var(--tech-title);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 0.5rem;
	}

	.section-title i {
		color: var(--tech-accent);
		font-size: 1.2rem;
	}

	.section-description {
		color: var(--tech-label);
		font-size: 0.9rem;
		max-width: 800px;
		line-height: 1.6;
	}

	/* Notifications */
	.notification {
		position: fixed;
		bottom: 2rem;
		right: 2rem;
		z-index: 1000;
		background: var(--tech-glass-bg);
		border: 1px solid var(--tech-glass-border);
		border-radius: 8px;
		padding: 1rem 1.5rem;
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
		animation: slide-in 0.4s cubic-bezier(0.16, 1, 0.3, 1);
	}

	@keyframes slide-in {
		from { transform: translateX(100%); opacity: 0; }
		to { transform: translateX(0); opacity: 1; }
	}

	.notification-content {
		display: flex;
		align-items: center;
		gap: 1rem;
		color: var(--tech-value);
		font-weight: 700;
		font-size: 0.9rem;
	}

	.notification.success i { color: #22c55e; }
	.notification.error i { color: #ef4444; }

	@media (max-width: 1024px) {
		.dashboard-layout { grid-template-columns: 1fr; }
		.summary-grid { flex-direction: row; flex-wrap: wrap; }
		.summary-card { flex: 1; min-width: 200px; }
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

		.summary-grid { 
			display: grid;
			grid-template-columns: repeat(2, 1fr);
			gap: 0.75rem;
			flex-direction: row;
		}

		.summary-card { 
			min-width: 0;
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

		.chart-wrapper {
			min-height: 220px;
		}

		.frame-header {
			padding-bottom: 0.75rem;
		}

		.frame-title {
			font-size: 0.6rem;
		}

		.predictions-section {
			margin-top: 1rem;
		}

		.section-header {
			margin-bottom: 1rem;
			padding-left: 0.75rem;
		}

		.section-title {
			font-size: 1.1rem;
			gap: 0.75rem;
			margin-bottom: 0.35rem;
		}

		.section-title i {
			font-size: 1rem;
		}

		.section-description {
			font-size: 0.8rem;
			line-height: 1.5;
		}

		.notification {
			bottom: 1rem;
			right: 1rem;
			left: 1rem;
			max-width: calc(100vw - 2rem);
		}
	}
</style>
