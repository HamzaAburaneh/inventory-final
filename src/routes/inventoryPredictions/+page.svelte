<script>
	import StockPredictions from '../../components/StockPredictions.svelte';
	import { notificationStore } from '../../stores/notificationStore.js';
	import { Chart, registerables } from 'chart.js';
	import { itemStore } from '../../stores/itemStore.js';
	import { fetchStockPredictions } from '../../lib/predictionsClient.js';
	import { onMount } from 'svelte';

	let overviewChart = $state();
	let chartCanvas = $state();
	let predictions = $state.raw({});

	// Reactive store views ($store auto-subscription)
	const items = $derived($itemStore);

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
			predictions = await fetchStockPredictions({ forecastDays: 14, useAI: false });
		} catch (err) {
			console.error('Error fetching stock predictions:', err);
			notificationStore.showNotification('Failed to load stock predictions.', 'error');
		}
	}

	onMount(async () => {
		Chart.register(...registerables);

		try {
			await itemStore.fetchItems();
		} catch {
			// No active group yet — the layout guard will redirect; nothing to do.
			return;
		}
		await fetchPredictions();

		// Initialize dashboard chart
		overviewChart = new Chart(chartCanvas, {
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

		return () => {
			overviewChart?.destroy();
			overviewChart = undefined;
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
</svelte:head>

<div class="inventory-predictions-page">
	<div class="dashboard-overview">
		<h2 class="section-title mb-4">Overview</h2>
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
		<canvas bind:this={chartCanvas} class="mt-4"></canvas>
	</div>

	<div class="container mx-auto p-6 rounded-lg shadow-lg bg-container mt-8">
		<h1 class="page-title mb-6">
			<i class="fas fa-chart-line" style="font-size: 32px;"></i>
			Inventory Predictions
		</h1>
		<p class="page-lede mb-8">
			Welcome to the Inventory Predictions page. Here you can view AI-powered stock level
			predictions based on historical sales data. Use these insights to optimize your inventory
			management and avoid stockouts.
		</p>
		<StockPredictions />
	</div>
</div>

<style>
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

	h1 {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.page-title {
		font-size: var(--text-2xl);
		font-weight: var(--font-weight-bold);
	}

	.page-lede {
		font-size: var(--text-lg);
		font-weight: var(--font-weight-light);
	}

	.section-title {
		font-size: var(--text-xl);
		font-weight: var(--font-weight-bold);
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
		color: var(--value-color);
	}

	@media (max-width: 768px) {
		.container {
			padding: 1.5rem;
		}

		.page-lede {
			font-size: var(--text-base);
		}
	}
</style>
