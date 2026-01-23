<script>
	import StockPredictions from '../../components/StockPredictions.svelte';
	import { fade } from 'svelte/transition';
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

	// Register Chart.js components at module level
	Chart.register(BarController, BarElement, CategoryScale, LinearScale, Title, Tooltip, Legend);

	// Chart instance - not reactive (mutable object)
	let overviewChart = null;
	let predictions = $state({});

	// Use Svelte's $ prefix for auto-subscription
	const items = $derived($itemStore);
	const notifications = $derived($notificationStore);
	const latestNotification = $derived(notifications?.[notifications.length - 1] || null);

	const totalItems = $derived(items.length);
	const itemsNeedingRestock = $derived(
		items.filter((item) => {
			const predictionData = predictions[item.id];
			if (!predictionData) return false;

			// Handle both old format (array) and new format (object with prediction array)
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

			// Handle both old format (array) and new format (object with prediction array)
			const prediction = Array.isArray(predictionData) ? predictionData : predictionData.prediction;
			if (!Array.isArray(prediction)) return false;

			const totalPrediction = prediction.reduce((sum, daily) => sum + daily, 0);
			return item.count > totalPrediction * 1.5;
		}).length
	);

	async function fetchPredictions() {
		try {
			const response = await fetch('/api/stockPredictions?timeframe=14&ai=false');
			if (!response.ok) {
				throw new Error('Failed to fetch stock predictions');
			}
			predictions = await response.json();
		} catch (err) {
			console.error('Error fetching stock predictions:', err);
			notificationStore.showNotification('Failed to load stock predictions.', 'error');
		}
	}

	// Initialize data and chart on mount
	$effect(() => {
		Promise.all([itemStore.fetchItems(), fetchPredictions()]).then(() => {
			// Initialize dashboard chart after data is loaded
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
								backgroundColor: ['#4CAF50', '#FFC107', '#F44336']
							}
						]
					},
					options: {
						responsive: true,
						plugins: {
							legend: { display: false },
							title: {
								display: true,
								text: 'Inventory Status Overview'
							}
						},
						scales: {
							y: {
								beginAtZero: true,
								title: {
									display: true,
									text: 'Number of Items'
								}
							},
							x: {
								title: {
									display: true,
									text: 'Inventory Categories'
								}
							}
						}
					}
				});
			}
		});

		// Cleanup on unmount
		return () => {
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
	<title>Inventory Predictions - StockSense</title>
	<link
		href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div class="inventory-predictions-page">
	<div class="dashboard-overview">
		<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
			<div class="metric-card">
				<i class="fas fa-box" style="font-size: 24px;"></i>
				<h3>Total Items</h3>
				<p>{totalItems}</p>
			</div>
			<div class="metric-card">
				<i class="fas fa-exclamation-circle" style="font-size: 24px;"></i>
				<h3>Needs Restock</h3>
				<p>{itemsNeedingRestock}</p>
			</div>
			<div class="metric-card">
				<i class="fas fa-boxes" style="font-size: 24px;"></i>
				<h3>Potential Overstock</h3>
				<p>{potentialOverstock}</p>
			</div>
		</div>
		<canvas id="overviewChart" class="mt-4"></canvas>
	</div>

	<div class="container mx-auto p-6 rounded-lg shadow-lg bg-container mt-8">
		<h1 class="text-4xl font-bold mb-6">
			<i class="fas fa-chart-line" style="font-size: 32px;"></i>
			Inventory Predictions
		</h1>
		<p class="mb-8 text-lg font-light">
			Welcome to the Inventory Predictions page. Here you can view AI-powered stock level
			predictions based on historical sales data. Use these insights to optimize your inventory
			management and avoid stockouts.
		</p>
		<StockPredictions />
	</div>

	{#if latestNotification}
		<div class="notification {latestNotification.type}">
			{latestNotification.message}
		</div>
	{/if}
</div>

<style>
	:global(body) {
		font-family: 'Roboto', sans-serif;
	}

	.inventory-predictions-page {
		background-color: var(--background-color);
		min-height: 100vh;
		padding: 2rem;
	}

	.container {
		max-width: 1200px;
		width: 100%;
		background-color: var(--container-bg);
		box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
		border-radius: 1rem;
		transition: all 0.3s ease;
	}

	.container:hover {
		transform: translateY(-5px);
		box-shadow: 0 15px 30px rgba(0, 0, 0, 0.15);
	}

	.notification {
		position: fixed;
		bottom: 20px;
		right: 20px;
		color: white;
		padding: 1rem 2rem;
		border-radius: 0.5rem;
		z-index: 1000;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		font-weight: bold;
	}

	.notification.success {
		background-color: var(--add-item-color); /* Green */
	}

	.notification.error {
		background-color: #dc3545; /* Red */
	}

	.notification.warning {
		background-color: #ffc107; /* Yellow */
		color: #333; /* Dark text for contrast */
	}

	.notification.info {
		background-color: #17a2b8; /* Blue */
	}

	h1 {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.dashboard-overview {
		background-color: var(--container-bg);
		border-radius: 1rem;
		padding: 1.5rem;
		margin-bottom: 2rem;
		box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
	}

	.metric-card {
		background-color: var(--background-color);
		border-radius: 0.5rem;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		transition: all 0.3s ease;
	}

	.metric-card:hover {
		transform: translateY(-5px);
		box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
	}

	.metric-card h3 {
		font-size: 1rem;
		font-weight: 500;
		margin: 0.5rem 0;
	}

	.metric-card p {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--primary-color);
	}

	@media (max-width: 768px) {
		.container {
			padding: 1.5rem;
		}

		h1 {
			font-size: 2rem;
		}

		p {
			font-size: 1rem;
		}
	}
</style>
