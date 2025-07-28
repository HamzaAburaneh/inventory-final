<script>
	import { itemStore } from '../stores/itemStore.js';
	import { fade, slide, scale } from 'svelte/transition';
	import { notificationStore } from '../stores/notificationStore.js';
	import { searchTerm as searchStore, setSearchTerm, clearSearch } from '../stores/searchStore.js';
	import SearchBar from './SearchBar.svelte';

	let predictions = $state({});
	let loading = $state(true);
	let error = $state('');
	let timeframeValue = $state(14);
	let useAI = $state(false);
	const ANALYSIS_WINDOW = 7; // 7 days moving average
	
	// Store values as reactive state
	let items = $state([]);
	let searchTermValue = $state('');
	
	// Subscribe to stores using $effect
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
			loading = true;
			const response = await fetch(`/api/stockPredictions?timeframe=${timeframeValue}&ai=${useAI}`);
			if (!response.ok) {
				throw new Error('Failed to fetch stock predictions');
			}
			predictions = await response.json();
			error = '';
		} catch (err) {
			console.error('Error fetching stock predictions:', err);
			error = 'Failed to load stock predictions. Please try again later.';
			notificationStore.showNotification('Failed to load stock predictions.', 'error');
		} finally {
			loading = false;
		}
	}

	// Initial data loading effect
	$effect(() => {
		const loadData = async () => {
			await itemStore.fetchItems();
			await fetchPredictions();
		};
		loadData();
	});

	function onSearch(value) {
		setSearchTerm(value);
	}

	function onClear() {
		clearSearch();
	}

	let debounceTimer;
	
	// Effect to watch for timeframe and AI method changes
	$effect(() => {
		// Dependencies: timeframeValue and useAI
		const currentTimeframe = timeframeValue;
		const currentUseAI = useAI;
		
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			fetchPredictions();
		}, 300);
		
		return () => clearTimeout(debounceTimer);
	});

	// Derived state for items with predictions
	const itemsWithPredictions = $derived(
		Object.entries(predictions)
			.map(([itemId, predictionData]) => {
				const item = items.find((item) => item.id === itemId);
				if (!item) {
					return null; // Skip items that don't exist in the current items collection
				}
				const currentCount = item.count !== undefined ? item.count : 0;
				
				// Handle both old format (array) and new format (object with prediction array)
				const prediction = Array.isArray(predictionData) ? predictionData : predictionData.prediction;
				// Ensure prediction is an array before calling reduce
				const totalPrediction = Array.isArray(prediction) ? prediction.reduce((sum, daily) => sum + daily, 0) : 0;
				const recommendedOrder = Math.max(0, totalPrediction - currentCount);
				
				return {
					id: itemId,
					name: item.name,
					currentCount,
					prediction,
					totalPrediction,
					recommendedOrder,
					// Enhanced data from AI analysis
					reasoning: predictionData.reasoning || 'ARIMA time series analysis',
					confidence: predictionData.confidence || 0.7,
					factors: predictionData.factors || ['Historical sales patterns'],
					method: predictionData.method || 'ARIMA'
				};
			})
			.filter((item) => item !== null && item.name.toLowerCase().includes(searchTermValue.toLowerCase()))
	);

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

	// Derived statistics
	const totalItems = $derived(itemsWithPredictions.length);
	const itemsNeedingRestock = $derived(
		itemsWithPredictions.filter(item => item.currentCount < item.totalPrediction).length
	);
	const potentialOverstock = $derived(
		itemsWithPredictions.filter(item => item.currentCount > item.totalPrediction * 1.5).length
	);
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
		<div class="controls-section">
			<div class="control-group">
				<label class="control-label" for="timeframe-selector">Prediction Timeframe</label>
				<div class="timeframe-selector" id="timeframe-selector" role="group" aria-labelledby="timeframe-label">
					<button
						class="timeframe-btn {timeframeValue === 1 ? 'active' : ''}"
						onclick={() => timeframeValue = 1}
					>
						1 Day
					</button>
					<button
						class="timeframe-btn {timeframeValue === 3 ? 'active' : ''}"
						onclick={() => timeframeValue = 3}
					>
						3 Days
					</button>
					<button
						class="timeframe-btn {timeframeValue === 7 ? 'active' : ''}"
						onclick={() => timeframeValue = 7}
					>
						1 Week
					</button>
					<button
						class="timeframe-btn {timeframeValue === 14 ? 'active' : ''}"
						onclick={() => timeframeValue = 14}
					>
						2 Weeks
					</button>
				</div>
			</div>
			
			<div class="control-group">
				<label class="control-label" id="method-label">Analysis Method</label>
				<div class="method-toggle" role="group" aria-labelledby="method-label">
					<button
						class="method-btn {!useAI ? 'active' : ''}"
						onclick={() => useAI = false}
					>
						<i class="fas fa-chart-line mr-2"></i>
						ARIMA Model
					</button>
					<button
						class="method-btn {useAI ? 'active' : ''}"
						onclick={() => useAI = true}
					>
						<i class="fas fa-brain mr-2"></i>
						GPT-4o Enhanced
					</button>
				</div>
			</div>
		</div>
		<p class="text-sm mb-2">
			{#if useAI}
				GPT-4o enhanced predictions combining AI analysis with traditional time series modeling
			{:else}
				Based on a {ANALYSIS_WINDOW}-day moving average of sales data using ARIMA model
			{/if}
		</p>
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
			{#each itemsWithPredictions as { id, name, currentCount, prediction, totalPrediction, recommendedOrder, reasoning, confidence, factors, method } (id)}
				<div
					class="bg-white p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300"
					in:scale={{ duration: 300, delay: 150 }}
				>
					<div class="flex justify-between items-start mb-2">
						<h3 class="text-lg font-semibold">{name}</h3>
						<div class="flex items-center space-x-2">
							<span class="px-2 py-1 text-xs rounded-full {method.includes('GPT-4o') ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}">
								{method}
							</span>
							{#if confidence}
								<span class="px-2 py-1 text-xs rounded-full {confidence > 0.8 ? 'bg-green-100 text-green-800' : confidence > 0.6 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}">
									{Math.round(confidence * 100)}% confidence
								</span>
							{/if}
						</div>
					</div>
					
					<p class="mb-1">
						<i class="fas fa-box inline-block mr-1"></i>
						Current Stock: <strong>{currentCount}</strong>
					</p>
					<p class="mb-1">
						<i class="fas fa-chart-line inline-block mr-1"></i>
						Predicted Need ({timeframeValue} days):
						<strong>{typeof totalPrediction === 'number' ? totalPrediction.toFixed(2) : '0.00'}</strong>
					</p>
					<p class="mb-2">
						<i class="fas fa-cart-plus inline-block mr-1"></i>
						Recommended Order: <strong>{typeof recommendedOrder === 'number' ? recommendedOrder.toFixed(2) : '0.00'}</strong>
					</p>
					
					<p class={`text-lg ${getStatusColor(currentCount, totalPrediction)} flex items-center mb-2`}>
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

					{#if reasoning && reasoning !== 'ARIMA time series analysis'}
						<div class="mb-2 p-3 bg-blue-50 rounded-lg text-sm border border-blue-200">
							<i class="fas fa-lightbulb inline-block mr-2 text-blue-600"></i>
							<strong class="text-blue-800">AI Insight:</strong>
							<span class="text-gray-800 ml-1">{reasoning}</span>
						</div>
					{/if}

					{#if factors && factors.length > 1}
						<div class="mb-2">
							<p class="text-xs text-gray-600 mb-1">Key factors considered:</p>
							<div class="flex flex-wrap gap-1">
								{#each factors as factor}
									<span class="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">{factor}</span>
								{/each}
							</div>
						</div>
					{/if}

					<details class="mt-2">
						<summary class="cursor-pointer text-sm text-gray-600 hover:text-gray-800"
							>Daily Breakdown</summary
						>
						<ul class="mt-2 text-sm">
							{#each Array.isArray(prediction) ? prediction : [] as dailyPrediction, index}
								<li>Day {index + 1}: {typeof dailyPrediction === 'number' ? dailyPrediction.toFixed(2) : '0.00'}</li>
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

	.controls-section {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		margin-bottom: 1rem;
	}

	.control-group {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.control-label {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text-color);
		opacity: 0.8;
	}

	.timeframe-selector {
		display: flex;
		background: rgba(0, 0, 0, 0.05);
		border-radius: 12px;
		padding: 4px;
		gap: 2px;
		border: 1px solid rgba(0, 0, 0, 0.1);
	}

	:global(.dark) .timeframe-selector {
		background: rgba(255, 255, 255, 0.05);
		border-color: rgba(255, 255, 255, 0.1);
	}

	.timeframe-btn {
		flex: 1;
		padding: 0.75rem 1rem;
		border: none;
		border-radius: 8px;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
		background: transparent;
		color: var(--text-color);
		opacity: 0.7;
	}

	.timeframe-btn:hover {
		opacity: 1;
		background: rgba(59, 130, 246, 0.1);
	}

	.timeframe-btn.active {
		background: #3b82f6;
		color: white;
		opacity: 1;
		box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
	}

	.method-toggle {
		display: flex;
		background: rgba(0, 0, 0, 0.05);
		border-radius: 12px;
		padding: 4px;
		gap: 2px;
		border: 1px solid rgba(0, 0, 0, 0.1);
	}

	:global(.dark) .method-toggle {
		background: rgba(255, 255, 255, 0.05);
		border-color: rgba(255, 255, 255, 0.1);
	}

	.method-btn {
		flex: 1;
		padding: 0.875rem 1.25rem;
		border: none;
		border-radius: 8px;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
		background: transparent;
		color: var(--text-color);
		opacity: 0.7;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.method-btn:hover {
		opacity: 1;
		background: rgba(59, 130, 246, 0.1);
	}

	.method-btn.active {
		background: #3b82f6;
		color: white;
		opacity: 1;
		box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
	}

	@media (min-width: 768px) {
		.controls-section {
			flex-direction: row;
			align-items: flex-end;
			justify-content: space-between;
		}

		.control-group {
			flex: 1;
			max-width: 300px;
		}
	}

	.stat-item {
		flex: 1 1 auto;
		margin: 0.5rem;
		padding: 0.5rem;
		background-color: rgba(255, 255, 255, 0.1);
		border-radius: 0.25rem;
	}

	/* Dark mode adjustments for AI insights */
	:global(.dark) .bg-blue-50 {
		background-color: rgba(59, 130, 246, 0.1);
		border-color: rgba(59, 130, 246, 0.2);
	}

	:global(.dark) .text-blue-800 {
		color: #60a5fa;
	}

	:global(.dark) .text-gray-800 {
		color: #e5e7eb;
	}

	:global(.dark) .border-blue-200 {
		border-color: rgba(59, 130, 246, 0.3);
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
