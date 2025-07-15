<script>
	import { itemStore } from '../stores/itemStore.js';
	import { fade, slide, scale } from 'svelte/transition';
	import { tweened } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { notificationStore } from '../stores/notificationStore.js';
	import { searchTerm as searchStore, setSearchTerm, clearSearch } from '../stores/searchStore.js';
	import SearchBar from './SearchBar.svelte';

	let predictions = $state({});
	let loading = $state(true);
	let error = $state('');
	let timeframeValue = $state(14);
	const ANALYSIS_WINDOW = 7; // 7 days moving average
	
	// Store values as reactive state
	let items = $state([]);
	let searchTermValue = $state('');
	
	// Subscribe to stores
	$effect(() => {
		const unsubscribeItems = itemStore.subscribe(value => {
			items = value;
		});
		const unsubscribeSearch = searchStore.subscribe(value => {
			searchTermValue = value;
		});
		
		return () => {
			unsubscribeItems();
			unsubscribeSearch();
		};
	});

	async function fetchPredictions() {
		try {
			const response = await fetch(`/api/stockPredictions?timeframe=${timeframeValue}`);
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

	$effect(async () => {
		await Promise.all([fetchPredictions(), itemStore.fetchItems()]);
	});

	function onSearch(value) {
		setSearchTerm(value);
	}

	function onClear() {
		clearSearch();
	}

	let debounceTimer;
	
	$effect(() => {
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			fetchPredictions();
		}, 300);
		
		return () => clearTimeout(debounceTimer);
	});

	const itemsWithPredictions = $derived(Object.entries(predictions)
		.map(([itemId, prediction]) => {
			const item = items.find((item) => item.id === itemId);
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
		.filter((item) => item.name.toLowerCase().includes(searchTermValue.toLowerCase())));

	function getStatusIcon(currentCount, totalPrediction) {
		if (currentCount < totalPrediction * 0.5) return 'fa-exclamation-circle';
		if (currentCount < totalPrediction) return 'fa-exclamation-triangle';
		if (currentCount > totalPrediction * 1.5) return 'fa-boxes';
		return 'fa-check-circle';
	}

	function getStatusColor(currentCount, totalPrediction) {
		if (currentCount < totalPrediction * 0.5) return 'text-red-500';
		if (currentCount < totalPrediction) return 'text-yellow-500';
		if (currentCount > totalPrediction * 1.5) return 'text-blue-500';
		return 'text-green-500';
	}

	const totalItems = $derived(itemsWithPredictions.length);
	const itemsNeedingRestock = $derived(itemsWithPredictions.filter(
		(item) => item.currentCount < item.totalPrediction
	).length);
	const potentialOverstock = $derived(itemsWithPredictions.filter(
		(item) => item.currentCount > item.totalPrediction * 1.5
	).length);
</script>

<div class="stock-predictions">
	<h2 class="text-2xl font-bold mb-4" in:slide={{ duration: 300, delay: 150 }}>
		<i class="fas fa-chart-bar inline-block mr-2"></i>
		Inventory Predictions
	</h2>
	<div
		class="summary-section mb-6 p-4 bg-gray-100 rounded-lg shadow-md"
		in:fade={{ duration: 300 }}
	>
		<div class="flex flex-wrap items-center justify-between mb-4">
			<p class="text-lg mr-2">
				Prediction timeframe: <strong>{timeframeValue} days</strong>
			</p>
			<div class="slider-container">
				<input type="range" min="1" max="14" bind:value={timeframeValue} class="slider" />
				<div class="slider-labels">
					<span>1</span>
					<span>7</span>
					<span>14</span>
				</div>
			</div>
		</div>
		<p class="text-sm mb-2">Based on a {ANALYSIS_WINDOW}-day moving average of sales data</p>
		<div class="flex flex-wrap justify-between mt-4">
			<div class="stat-item">
				<i class="fas fa-box inline-block mr-1"></i>
				Total Items: <strong>{totalItems}</strong>
			</div>
			<div class="stat-item text-yellow-500">
				<i class="fas fa-exclamation-triangle inline-block mr-1"></i>
				Items Needing Restock: <strong>{itemsNeedingRestock}</strong>
			</div>
			<div class="stat-item text-blue-500">
				<i class="fas fa-boxes inline-block mr-1"></i>
				Potential Overstock: <strong>{potentialOverstock}</strong>
			</div>
		</div>
	</div>

	<SearchBar {onSearch} {onClear} searchValue={searchTermValue} />

	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
		{#if loading}
			{#each Array(6) as _}
				<div class="bg-white p-4 rounded-lg shadow-md animate-pulse">
					<div class="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
					<div class="h-4 bg-gray-200 rounded w-1/2 mb-1"></div>
					<div class="h-4 bg-gray-200 rounded w-2/3 mb-1"></div>
					<div class="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
					<div class="h-6 bg-gray-200 rounded w-1/3"></div>
				</div>
			{/each}
		{:else if error}
			<p class="error text-center col-span-full">{error}</p>
		{:else if itemsWithPredictions.length === 0}
			<p class="text-center col-span-full">
				No predictions available or no items match your search.
			</p>
		{:else}
			{#each itemsWithPredictions as { id, name, currentCount, prediction, totalPrediction, recommendedOrder } (id)}
				<div
					class="bg-white p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300"
					in:scale={{ duration: 300, delay: 150 }}
				>
					<h3 class="text-lg font-semibold mb-2">{name}</h3>
					<p class="mb-1">
						<i class="fas fa-box inline-block mr-1"></i>
						Current Stock: <strong>{currentCount}</strong>
					</p>
					<p class="mb-1">
						<i class="fas fa-chart-line inline-block mr-1"></i>
						Predicted Need ({timeframeValue} days):
						<strong>{totalPrediction.toFixed(2)}</strong>
					</p>
					<p class="mb-2">
						<i class="fas fa-cart-plus inline-block mr-1"></i>
						Recommended Order: <strong>{recommendedOrder.toFixed(2)}</strong>
					</p>
					<p class={`text-lg ${getStatusColor(currentCount, totalPrediction)} flex items-center`}>
						<i class="fas {getStatusIcon(currentCount, totalPrediction)} inline-block mr-2"></i>
						Status:
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
						<summary class="cursor-pointer text-sm text-gray-600 hover:text-gray-800"
							>Daily Breakdown</summary
						>
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

	.summary-section {
		background-color: var(--container-bg);
		color: var(--text-color);
		border: 1px solid var(--border-color);
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

	.slider-container {
		position: relative;
		width: 100%;
		max-width: 300px;
		margin: 0 auto;
	}

	.slider {
		-webkit-appearance: none;
		width: 100%;
		height: 10px;
		border-radius: 5px;
		background: #d3d3d3;
		outline: none;
		opacity: 0.7;
		transition: opacity 0.2s;
	}

	.slider:hover {
		opacity: 1;
	}

	.slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: var(--primary-color);
		cursor: pointer;
	}

	.slider::-moz-range-thumb {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: var(--primary-color);
		cursor: pointer;
	}

	.slider-labels {
		display: flex;
		justify-content: space-between;
		margin-top: 5px;
		font-size: 12px;
		color: var(--text-color);
	}

	.stat-item {
		flex: 1 1 auto;
		margin: 0.5rem;
		padding: 0.5rem;
		background-color: rgba(255, 255, 255, 0.1);
		border-radius: 0.25rem;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}

	.animate-pulse {
		animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
	}

	@media (max-width: 768px) {
		.summary-section {
			padding: 1rem;
		}

		.slider-container {
			margin-top: 1rem;
		}

		.stat-item {
			flex-basis: 100%;
			margin: 0.25rem 0;
		}
	}
</style>
