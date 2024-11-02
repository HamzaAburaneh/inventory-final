<script lang="ts">
	import { onMount } from 'svelte';
	import { itemStore } from '../stores/itemStore';
	import { fade, slide } from 'svelte/transition';
	import { tweened } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { notificationStore } from '../stores/notificationStore';
	import { searchStore } from '../stores/searchStore';
	import SearchBar from './SearchBar.svelte';
	import Icon from '@iconify/svelte';

	let predictions: { [itemId: string]: number[] } = {};
	let loading = true;
	let error = '';
	const RESTOCK_CYCLE = 3; // Maximum days between restocks
	let isCriticalExpanded = false;

	function toggleCriticalItems() {
		isCriticalExpanded = !isCriticalExpanded;
	}
	// Timeframe control
	let predictionTimeframe = tweened(14, {
		duration: 300,
		easing: cubicOut
	});
	let isEventMode = false;
	const CNE_DURATION = 19;

	$: if (isEventMode) {
		predictionTimeframe.set(CNE_DURATION);
	}

	async function fetchPredictions() {
		try {
			const response = await fetch(`/api/stockPredictions?timeframe=${$predictionTimeframe}`);
			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || 'Failed to fetch stock predictions');
			}

			if (data.error) {
				throw new Error(data.error);
			}

			predictions = data;
			error = '';
		} catch (err: unknown) {
			console.error('Error fetching stock predictions:', err);
			error =
				err instanceof Error
					? err.message
					: 'Failed to load stock predictions. Please try again later.';
			notificationStore.showNotification(error, 'error');
		} finally {
			loading = false;
		}
	}

	let debounceTimer: NodeJS.Timeout;
	function debouncedFetchPredictions() {
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			fetchPredictions();
		}, 300);
	}

	$: {
		if ($predictionTimeframe) {
			debouncedFetchPredictions();
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

	function isWeekend(dayOffset: number): boolean {
		const date = new Date();
		date.setDate(date.getDate() + dayOffset);
		return date.getDay() === 0 || date.getDay() === 6;
	}

	function getRequiredStock(prediction: number, dayIndex: number): number {
		const isWeekendDay = isWeekend(dayIndex);
		return prediction * (isWeekendDay ? 2 : 1); // Double stock for weekends
	}

	$: itemsWithPredictions = Object.entries(predictions)
		.map(([itemId, prediction]) => {
			const item = $itemStore.find((item) => item.id === itemId);
			const currentCount = item?.count ?? 0;

			const nextCyclePredictions = prediction.slice(0, RESTOCK_CYCLE);
			const requiredStockLevels = nextCyclePredictions.map((pred, i) => getRequiredStock(pred, i));

			const maxRequiredStock = Math.max(...requiredStockLevels);
			const recommendedOrder = Math.max(0, maxRequiredStock - currentCount);

			const weekendPredictions = prediction.filter((_, i) => isWeekend(i));
			const weekdayPredictions = prediction.filter((_, i) => !isWeekend(i));

			const avgWeekendSales =
				weekendPredictions.reduce((a, b) => a + b, 0) / weekendPredictions.length;
			const avgWeekdaySales =
				weekdayPredictions.reduce((a, b) => a + b, 0) / weekdayPredictions.length;

			const totalPredicted = prediction.reduce((sum, daily) => sum + daily, 0);

			return {
				id: itemId,
				name: item ? item.name : `Unknown Item (ID: ${itemId})`,
				currentCount,
				prediction,
				recommendedOrder,
				avgWeekendSales,
				avgWeekdaySales,
				maxRequiredStock,
				totalPredicted,
				nextRestock: {
					date: new Date(Date.now() + RESTOCK_CYCLE * 24 * 60 * 60 * 1000),
					amount: recommendedOrder
				}
			};
		})
		.filter((item) => item.name.toLowerCase().includes($searchStore.toLowerCase()));

	function getStatusIcon(currentCount: number, maxRequired: number): string {
		if (currentCount < maxRequired * 0.5) return 'mdi:alert-circle';
		if (currentCount < maxRequired) return 'mdi:alert';
		if (currentCount > maxRequired * 2) return 'mdi:package-variant';
		return 'mdi:check-circle';
	}

	function getStatusColor(currentCount: number, maxRequired: number): string {
		if (currentCount < maxRequired * 0.5) return 'text-red-500';
		if (currentCount < maxRequired) return 'text-yellow-500';
		if (currentCount > maxRequired * 2) return 'text-blue-500';
		return 'text-green-500';
	}

	$: criticalItems = itemsWithPredictions.filter(
		(item) => item.currentCount < item.maxRequiredStock * 0.5
	);
</script>

<div class="stock-predictions">
	<div class="prediction-controls mb-6 p-4 rounded-lg shadow-md" in:slide={{ duration: 300 }}>
		<div class="flex flex-wrap items-center justify-between mb-4">
			<div class="flex items-center space-x-4">
				<h2 class="text-2xl font-bold">Stock Predictions</h2>
				<label class="flex items-center space-x-2">
					<input type="checkbox" bind:checked={isEventMode} class="form-checkbox" />
					<span>CNE Event Mode ({CNE_DURATION} days)</span>
				</label>
			</div>
			{#if !isEventMode}
				<div class="timeframe-control">
					<p class="text-lg mb-2">
						Prediction timeframe: <strong>{$predictionTimeframe.toFixed(0)} days</strong>
					</p>
					<div class="slider-container">
						<input
							type="range"
							min="1"
							max="30"
							bind:value={$predictionTimeframe}
							class="slider"
							disabled={isEventMode}
						/>
						<div class="slider-labels">
							<span>1</span>
							<span>15</span>
							<span>30</span>
						</div>
					</div>
				</div>
			{/if}
		</div>
		<p class="text-sm">
			<Icon icon="mdi:information" class="inline-block mr-1" />
			{isEventMode
				? 'Event mode: Weekend stock requirements are doubled'
				: 'Showing predictions for custom timeframe'}
		</p>
	</div>

	{#if criticalItems.length > 0}
		<div class="critical-items mb-6 p-4 rounded-lg" in:fade={{ duration: 300 }}>
			<button
				type="button"
				class="w-full flex justify-between items-center focus:outline-none"
				on:click={toggleCriticalItems}
				on:keydown={(e) => e.key === 'Enter' && toggleCriticalItems()}
				aria-expanded={isCriticalExpanded}
				aria-controls="critical-items-list"
			>
				<h3 class="text-lg font-semibold">
					<Icon icon="mdi:alert-circle" class="inline-block mr-2" />
					Critical Items ({criticalItems.length})
				</h3>
				<Icon icon={isCriticalExpanded ? 'mdi:chevron-up' : 'mdi:chevron-down'} />
			</button>

			{#if isCriticalExpanded}
				<ul id="critical-items-list" class="list-disc list-inside mt-4" transition:slide>
					{#each criticalItems as item}
						<li>
							{item.name} - Current: {item.currentCount}, Required: {item.maxRequiredStock.toFixed(
								0
							)}
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}

	<SearchBar {onSearch} {onClear} searchValue={$searchStore} />

	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
		{#if loading}
			{#each Array(6) as _}
				<div class="prediction-card animate-pulse">
					<div class="h-6 loading-placeholder rounded w-3/4 mb-2"></div>
					<div class="h-4 loading-placeholder rounded w-1/2 mb-1"></div>
					<div class="h-4 loading-placeholder rounded w-2/3 mb-1"></div>
					<div class="h-4 loading-placeholder rounded w-1/2"></div>
				</div>
			{/each}
		{:else if error}
			<p class="error text-center col-span-full">{error}</p>
		{:else if itemsWithPredictions.length === 0}
			<p class="text-center col-span-full">
				No predictions available or no items match your search.
			</p>
		{:else}
			{#each itemsWithPredictions as item (item.id)}
				<div class="prediction-card" in:fade={{ duration: 300 }}>
					<h3 class="text-lg font-semibold mb-2">{item.name}</h3>
					<div class="grid grid-cols-2 gap-2 mb-4">
						<div class="stat-box">
							<p class="text-sm">Current Stock</p>
							<p class="text-lg font-bold">{item.currentCount}</p>
						</div>
						<div class="stat-box">
							<p class="text-sm">Total Needed</p>
							<p class="text-lg font-bold">{item.totalPredicted.toFixed(0)}</p>
						</div>
					</div>

					<div class="mb-4">
						<h4 class="text-sm font-semibold mb-2">Average Daily Sales</h4>
						<div class="flex justify-between text-sm">
							<div>
								<Icon icon="mdi:calendar-weekday" class="inline-block mr-1" />
								Weekdays: {item.avgWeekdaySales.toFixed(1)}
							</div>
							<div>
								<Icon icon="mdi:calendar-weekend" class="inline-block mr-1" />
								Weekends: {item.avgWeekendSales.toFixed(1)}
							</div>
						</div>
					</div>

					<div class="next-restock mb-4">
						<h4 class="text-sm font-semibold">Next Restock</h4>
						<p class="text-sm">
							<Icon icon="mdi:calendar-clock" class="inline-block mr-1" />
							{item.nextRestock.date.toLocaleDateString()}
						</p>
						<p class="text-sm">
							<Icon icon="mdi:cart-plus" class="inline-block mr-1" />
							Order: {item.recommendedOrder.toFixed(0)} units
						</p>
					</div>

					<p
						class={`text-lg ${getStatusColor(item.currentCount, item.maxRequiredStock)} flex items-center`}
					>
						<Icon
							icon={getStatusIcon(item.currentCount, item.maxRequiredStock)}
							class="inline-block mr-2"
						/>
						{#if item.currentCount < item.maxRequiredStock * 0.5}
							Urgent restock needed
						{:else if item.currentCount < item.maxRequiredStock}
							Restock recommended
						{:else if item.currentCount > item.maxRequiredStock * 2}
							Potential overstock
						{:else}
							Stock level optimal
						{/if}
					</p>

					<details class="mt-2">
						<summary class="cursor-pointer text-sm hover:text-hover">Daily Breakdown</summary>
						<div class="mt-2 text-sm">
							<table class="w-full">
								<thead>
									<tr>
										<th class="text-left">Day</th>
										<th class="text-right">Predicted</th>
										<th class="text-right">Required</th>
									</tr>
								</thead>
								<tbody>
									{#each item.prediction as dailyPred, i}
										<tr class={isWeekend(i) ? 'weekend-row' : ''}>
											<td>{isWeekend(i) ? 'Weekend' : 'Weekday'} {i + 1}</td>
											<td class="text-right">{dailyPred.toFixed(1)}</td>
											<td class="text-right">{getRequiredStock(dailyPred, i).toFixed(1)}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
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

	.prediction-controls {
		background-color: var(--container-bg);
		color: var(--text-color);
		border: 1px solid var(--border-color);
	}

	.timeframe-control {
		min-width: 300px;
	}

	.slider-container {
		position: relative;
		width: 100%;
	}

	.slider {
		-webkit-appearance: none;
		width: 100%;
		height: 10px;
		border-radius: 5px;
		background: var(--table-header-bg);
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
		background: var(--icon-color);
		cursor: pointer;
	}

	.slider::-moz-range-thumb {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: var(--icon-color);
		cursor: pointer;
	}

	.slider-labels {
		display: flex;
		justify-content: space-between;
		margin-top: 5px;
		font-size: 12px;
		color: var(--text-color);
	}

	.critical-items {
		background-color: rgba(239, 68, 68, 0.1);
		border: 1px solid rgba(239, 68, 68, 0.2);
		color: var(--text-color);
	}

	.prediction-card {
		background-color: var(--container-bg);
		color: var(--text-color);
		padding: 1rem;
		border-radius: var(--border-radius);
		border: 1px solid var(--border-color);
		transition: all 0.3s ease;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.prediction-card:hover {
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
		transform: translateY(-2px);
	}

	.stat-box {
		background-color: var(--table-header-bg);
		color: var(--text-color);
		padding: 0.5rem;
		border-radius: var(--border-radius);
		border: 1px solid var(--border-color);
	}

	.next-restock {
		background-color: var(--table-header-bg);
		color: var(--text-color);
		padding: 0.5rem;
		border-radius: var(--border-radius);
		border: 1px solid var(--border-color);
	}

	table {
		border-collapse: separate;
		border-spacing: 0;
		width: 100%;
	}

	th,
	td {
		padding: 0.5rem;
		border: 1px solid var(--table-border-color);
		background-color: var(--table-cell-bg);
		color: var(--table-cell-text);
	}

	th {
		background-color: var(--table-header-bg);
		color: var(--table-header-text);
		font-weight: 600;
	}

	.weekend-row td {
		background-color: var(--table-header-bg);
	}

	.loading-placeholder {
		background-color: var(--table-header-bg);
	}

	details summary {
		color: var(--text-color);
	}

	details summary:hover {
		color: var(--icon-hover-color);
	}

	.form-checkbox {
		background-color: var(--input-bg);
		border-color: var(--border-color);
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
		.grid {
			grid-template-columns: 1fr;
		}

		.timeframe-control {
			min-width: 100%;
			margin-top: 1rem;
		}
	}
</style>
