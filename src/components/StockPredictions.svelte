<script lang="ts">
	import { onMount } from 'svelte';
	import { itemStore } from '../stores/itemStore';
	import { fade } from 'svelte/transition';
	import { notificationStore } from '../stores/notificationStore';

	let predictions: { [itemId: string]: number } = {};
	let loading = true;
	let error = '';
	let searchTerm = '';
	const PREDICTION_TIMEFRAME = 2; // 2 days prediction
	const ANALYSIS_WINDOW = 7; // 7 days moving average

	async function fetchPredictions() {
		try {
			const response = await fetch('/api/stockPredictions');
			if (!response.ok) {
				throw new Error('Failed to fetch stock predictions');
			}
			predictions = await response.json();
		} catch (err) {
			console.error('Error fetching stock predictions:', err);
			error = 'Failed to load stock predictions. Please try again later.';
			notificationStore.showNotification('Failed to load stock predictions.', 'error');
		} finally {
			loading = false;
		}
	}

	onMount(async () => {
		await Promise.all([fetchPredictions(), itemStore.fetchItems()]);
	});

	$: itemsWithPredictions = Object.entries(predictions)
		.map(([itemId, prediction]) => {
			const item = $itemStore.find((item) => item.id === itemId);
			const currentCount = item && item.count !== undefined ? item.count : 0;
			const recommendedOrder = Math.max(0, prediction - currentCount);
			return {
				id: itemId,
				name: item ? item.name : `Unknown Item (ID: ${itemId})`,
				currentCount,
				prediction,
				recommendedOrder
			};
		})
		.filter((item) => item.name.toLowerCase().includes(searchTerm.toLowerCase()));

	function getStatusIcon(currentCount: number, prediction: number): string {
		if (currentCount < prediction * 0.5) return '🚨';
		if (currentCount < prediction) return '⚠️';
		if (currentCount > prediction * 1.5) return '📦';
		return '✅';
	}

	function getStatusColor(currentCount: number, prediction: number): string {
		if (currentCount < prediction * 0.5) return 'text-red-500';
		if (currentCount < prediction) return 'text-yellow-500';
		if (currentCount > prediction * 1.5) return 'text-blue-500';
		return 'text-green-500';
	}

	$: totalItems = itemsWithPredictions.length;
	$: itemsNeedingRestock = itemsWithPredictions.filter(
		(item) => item.currentCount < item.prediction
	).length;
	$: potentialOverstock = itemsWithPredictions.filter(
		(item) => item.currentCount > item.prediction * 1.5
	).length;
</script>

<div class="stock-predictions">
	<h2 class="text-2xl font-bold mb-4">Inventory Insights</h2>
	<div class="summary-section mb-6 p-4 bg-gray-100 rounded-lg">
		<p class="text-lg mb-2">Prediction timeframe: <strong>{PREDICTION_TIMEFRAME} days</strong></p>
		<p class="text-sm mb-2">Based on a {ANALYSIS_WINDOW}-day moving average of sales data</p>
		<p>
			Total Items: <strong>{totalItems}</strong> | Items Needing Restock:
			<strong class="text-yellow-500">{itemsNeedingRestock}</strong>
			| Potential Overstock: <strong class="text-blue-500">{potentialOverstock}</strong>
		</p>
	</div>

	<input
		type="text"
		placeholder="Search items..."
		bind:value={searchTerm}
		class="w-full p-2 mb-4 rounded-lg"
	/>

	{#if loading}
		<p class="text-center">Loading predictions...</p>
	{:else if error}
		<p class="error text-center">{error}</p>
	{:else if itemsWithPredictions.length === 0}
		<p class="text-center">No predictions available or no items match your search.</p>
	{:else}
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
			{#each itemsWithPredictions as { name, currentCount, prediction, recommendedOrder }}
				<div class="bg-white p-4 rounded-lg shadow-md">
					<h3 class="text-lg font-semibold mb-2">{name}</h3>
					<p class="mb-1">Current Stock: <strong>{currentCount}</strong></p>
					<p class="mb-1">Predicted Need (2 days): <strong>{prediction}</strong></p>
					<p class="mb-2">Recommended Order: <strong>{recommendedOrder}</strong></p>
					<p class={`text-lg ${getStatusColor(currentCount, prediction)}`}>
						Status: {getStatusIcon(currentCount, prediction)}
						{#if currentCount < prediction * 0.5}
							Urgent restock needed
						{:else if currentCount < prediction}
							Restock recommended
						{:else if currentCount > prediction * 1.5}
							Potential overstock
						{:else}
							Stock level optimal
						{/if}
					</p>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.stock-predictions {
		margin-top: 2rem;
	}

	:global(body) {
		background-color: var(--background-color);
		color: var(--text-color);
	}

	input {
		background-color: var(--input-bg);
		color: var(--input-text);
		border: 1px solid var(--input-border);
	}

	input:focus {
		border-color: var(--input-focus-border);
	}

	.summary-section {
		background-color: var(--table-header-bg);
		color: var(--table-header-text);
	}

	.grid > div {
		background-color: var(--container-bg);
		border: 1px solid var(--border-color);
	}

	.error {
		color: var(--text-color);
		background-color: rgba(255, 0, 0, 0.1);
		padding: 1rem;
		border-radius: var(--border-radius);
	}
</style>
