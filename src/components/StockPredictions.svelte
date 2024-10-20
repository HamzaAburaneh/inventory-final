<script lang="ts">
	import { onMount } from 'svelte';
	import { itemStore } from '../stores/itemStore';
	import { fade, slide } from 'svelte/transition';
	import { notificationStore } from '../stores/notificationStore';
	import { searchStore } from '../stores/searchStore';
	import SearchBar from './SearchBar.svelte';

	let predictions: { [itemId: string]: number[] } = {};
	let loading = true;
	let updating = false;
	let error = '';
	let predictionTimeframe = 14; // Default to 14 days
	const ANALYSIS_WINDOW = 7; // 7 days moving average

	async function fetchPredictions() {
		try {
			updating = true;
			const response = await fetch(`/api/stockPredictions?timeframe=${predictionTimeframe}`);
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
			updating = false;
		}
	}

	onMount(async () => {
		await Promise.all([fetchPredictions(), itemStore.fetchItems()]);
	});

	function onSearch(value: string) {
		searchStore.setSearchTerm(value);
	}

	function onClear() {
		searchStore.clearSearch();
	}

	let throttleTimer: NodeJS.Timeout | undefined;
	function throttledFetchPredictions() {
		if (!throttleTimer) {
			throttleTimer = setTimeout(() => {
				fetchPredictions();
				throttleTimer = undefined;
			}, 300);
		}
	}

	$: {
		if (predictionTimeframe) {
			throttledFetchPredictions();
		}
	}

	$: itemsWithPredictions = Object.entries(predictions)
		.map(([itemId, prediction]) => {
			const item = $itemStore.find((item) => item.id === itemId);
			const currentCount = item && item.count !== undefined ? item.count : 0;
			const totalPrediction = prediction.reduce((sum, daily) => sum + daily, 0);
			const recommendedOrder = Math.max(0, totalPrediction - currentCount);
			return {
				id: itemId,
				name: item ? item.name : `Unknown Item (ID: ${itemId})`,
				currentCount,
				prediction,
				totalPrediction,
				recommendedOrder
			};
		})
		.filter((item) => item.name.toLowerCase().includes($searchStore.toLowerCase()));

	function getStatusIcon(currentCount: number, totalPrediction: number): string {
		if (currentCount < totalPrediction * 0.5) return '🚨';
		if (currentCount < totalPrediction) return '⚠️';
		if (currentCount > totalPrediction * 1.5) return '📦';
		return '✅';
	}

	function getStatusColor(currentCount: number, totalPrediction: number): string {
		if (currentCount < totalPrediction * 0.5) return 'text-red-500';
		if (currentCount < totalPrediction) return 'text-yellow-500';
		if (currentCount > totalPrediction * 1.5) return 'text-blue-500';
		return 'text-green-500';
	}

	$: totalItems = itemsWithPredictions.length;
	$: itemsNeedingRestock = itemsWithPredictions.filter(
		(item) => item.currentCount < item.totalPrediction
	).length;
	$: potentialOverstock = itemsWithPredictions.filter(
		(item) => item.currentCount > item.totalPrediction * 1.5
	).length;
</script>

<div class="stock-predictions">
	<h2 class="text-2xl font-bold mb-4">Inventory Predictions</h2>
	<div class="summary-section mb-6 p-4 bg-gray-100 rounded-lg">
		<div class="flex items-center mb-2">
			<p class="text-lg mr-2">
				Prediction timeframe: <strong>{predictionTimeframe} days</strong>
			</p>
			{#if updating}
				<div class="loader"></div>
			{/if}
		</div>
		<input type="range" min="1" max="14" bind:value={predictionTimeframe} class="w-full" />
		<p class="text-sm mb-2">Based on a {ANALYSIS_WINDOW}-day moving average of sales data</p>
		<p>
			Total Items: <strong>{totalItems}</strong> | Items Needing Restock:
			<strong class="text-yellow-500">{itemsNeedingRestock}</strong>
			| Potential Overstock: <strong class="text-blue-500">{potentialOverstock}</strong>
		</p>
	</div>

	<SearchBar {onSearch} {onClear} searchValue={$searchStore} />

	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
		{#if loading}
			<p class="col-span-full text-center">Loading predictions...</p>
		{:else if error}
			<p class="error text-center col-span-full">{error}</p>
		{:else if itemsWithPredictions.length === 0}
			<p class="text-center col-span-full">
				No predictions available or no items match your search.
			</p>
		{:else}
			{#each itemsWithPredictions as { id, name, currentCount, prediction, totalPrediction, recommendedOrder } (id)}
				<div class="bg-white p-4 rounded-lg shadow-md" transition:fade={{ duration: 200 }}>
					<h3 class="text-lg font-semibold mb-2">{name}</h3>
					<p class="mb-1">Current Stock: <strong>{currentCount}</strong></p>
					<p class="mb-1">
						Predicted Need ({predictionTimeframe} days):
						<strong>{totalPrediction.toFixed(2)}</strong>
					</p>
					<p class="mb-2">Recommended Order: <strong>{recommendedOrder.toFixed(2)}</strong></p>
					<p class={`text-lg ${getStatusColor(currentCount, totalPrediction)}`}>
						Status: {getStatusIcon(currentCount, totalPrediction)}
						{#if currentCount < totalPrediction * 0.5}
							Urgent restock needed
						{:else if currentCount < totalPrediction}
							Restock recommended
						{:else if currentCount > totalPrediction * 1.5}
							Potential overstock
						{:else}
							Stock level optimal
						{/if}
					</p>
					<details class="mt-2">
						<summary class="cursor-pointer text-sm text-gray-600">Daily Breakdown</summary>
						<ul class="mt-2 text-sm">
							{#each prediction as dailyPrediction, index}
								<li>Day {index + 1}: {dailyPrediction.toFixed(2)}</li>
							{/each}
						</ul>
					</details>
				</div>
			{/each}
		{/if}
	</div>
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

	.loader {
		border: 2px solid #f3f3f3;
		border-top: 2px solid #3498db;
		border-radius: 50%;
		width: 16px;
		height: 16px;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}
</style>
