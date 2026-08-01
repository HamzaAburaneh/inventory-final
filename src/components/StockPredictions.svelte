<script>
	import { itemStore } from '../stores/itemStore.js';
	import { fade, slide, fly } from 'svelte/transition';
	import { notificationStore } from '../stores/notificationStore.js';
	import { createSearchState } from '../lib/runes/search.svelte.js';
	import { fetchStockPredictions } from '../lib/predictionsClient.js';
	import SearchBar from './SearchBar.svelte';
	import { onMount } from 'svelte';

	let predictions = $state.raw({});
	let loading = $state(true);
	let error = $state('');
	let timeframeValue = $state(14);
	let useAI = $state(false);

	const search = createSearchState();

	// Reactive store views ($store auto-subscription)
	const items = $derived($itemStore);
	const searchTermValue = $derived(search.term);

	async function fetchPredictions(timeframe, ai) {
		try {
			loading = true;
			predictions = await fetchStockPredictions({ forecastDays: timeframe, useAI: ai });
			error = '';
		} catch (err) {
			console.error('Error fetching stock predictions:', err);
			error = 'Failed to load stock predictions. Please try again later.';
			notificationStore.showNotification('Failed to load stock predictions.', 'error');
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		itemStore.fetchItems();
	});

	function onSearch(value) {
		search.setTerm(value);
	}

	function onClear() {
		search.clear();
	}

	// Debounced (re)fetch whenever the timeframe or analysis method changes;
	// also performs the initial fetch on mount.
	$effect(() => {
		const timeframe = timeframeValue;
		const ai = useAI;

		const debounceTimer = setTimeout(() => {
			fetchPredictions(timeframe, ai);
		}, 300);

		return () => clearTimeout(debounceTimer);
	});

	const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const MONTHS = [
		'Jan',
		'Feb',
		'Mar',
		'Apr',
		'May',
		'Jun',
		'Jul',
		'Aug',
		'Sep',
		'Oct',
		'Nov',
		'Dec'
	];

	// Parse a YYYY-MM-DD key as a LOCAL date (never `new Date(key)`, which is UTC
	// and shifts the weekday in Toronto's negative offset).
	function dayFromKey(key) {
		if (typeof key !== 'string') return null;
		const [y, m, d] = key.split('-').map(Number);
		if (!y || !m || !d) return null;
		return new Date(y, m - 1, d);
	}

	// e.g. "Fri Aug 21" — the label operators actually reason about.
	function formatDayKey(key) {
		const d = dayFromKey(key);
		if (!d) return key ?? '';
		return `${WEEKDAYS[d.getDay()]} ${MONTHS[d.getMonth()]} ${d.getDate()}`;
	}

	// Confidence now arrives as { score, level, basis }; tolerate a bare legacy
	// number just in case an old response is cached.
	function normalizeConfidence(raw) {
		if (raw && typeof raw === 'object' && raw.level) return raw;
		if (typeof raw === 'number') {
			const level = raw >= 0.65 ? 'high' : raw >= 0.4 ? 'medium' : 'low';
			return { score: raw, level, basis: '' };
		}
		return { score: 0, level: 'low', basis: '' };
	}

	const CONFIDENCE_META = {
		high: { label: 'High confidence', cls: 'conf-high' },
		medium: { label: 'Medium confidence', cls: 'conf-medium' },
		low: { label: 'Low confidence', cls: 'conf-low' }
	};

	// Derived state for items with predictions
	const itemsWithPredictions = $derived(
		Object.entries(predictions)
			.map(([itemId, predictionData]) => {
				const item = items.find((item) => item.id === itemId);
				if (!item) {
					return null; // Skip items that don't exist in the current items collection
				}
				const currentCount = item.count !== undefined ? item.count : 0;

				// Handle both old format (bare array) and the enriched object.
				const prediction = Array.isArray(predictionData)
					? predictionData
					: predictionData.prediction;
				const dailies = Array.isArray(prediction) ? prediction : [];
				const totalPrediction = dailies.reduce((sum, daily) => sum + (Number(daily) || 0), 0);
				const recommendedOrder = Math.max(0, totalPrediction - currentCount);

				const baseline = Array.isArray(predictionData.baseline) ? predictionData.baseline : null;
				const baselineTotal = baseline ? baseline.reduce((s, v) => s + (Number(v) || 0), 0) : 0;
				const method = predictionData.method || 'ARIMA';
				const isAI = method.startsWith('AI');
				// Divergence between the shown AI numbers and the deterministic
				// baseline — an honesty signal, only meaningful for the AI path.
				const divergence =
					isAI && baseline
						? Math.abs(totalPrediction - baselineTotal) / Math.max(baselineTotal, 1)
						: null;

				const forecastDates = Array.isArray(predictionData.forecastDates)
					? predictionData.forecastDates
					: [];

				return {
					id: itemId,
					name: item.name,
					currentCount,
					prediction: dailies,
					forecastDates,
					totalPrediction,
					recommendedOrder,
					reasoning: predictionData.reasoning || '',
					confidence: normalizeConfidence(predictionData.confidence),
					factors: predictionData.factors || [],
					method,
					isAI,
					model: predictionData.model || null,
					baselineTotal,
					divergence,
					stockOut: predictionData.stockOut || null,
					reorderBy: predictionData.reorderBy || null
				};
			})
			.filter(
				(item) => item !== null && item.name.toLowerCase().includes(searchTermValue.toLowerCase())
			)
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
		itemsWithPredictions.filter((item) => item.currentCount < item.totalPrediction).length
	);
	const potentialOverstock = $derived(
		itemsWithPredictions.filter((item) => item.currentCount > item.totalPrediction * 1.5).length
	);
</script>

<div class="stock-predictions">
	<h2 class="section-title mb-4" in:slide={{ duration: 300, delay: 150 }}>
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
				<div
					class="timeframe-selector"
					id="timeframe-selector"
					role="group"
					aria-labelledby="timeframe-label"
				>
					<button
						class="timeframe-btn {timeframeValue === 1 ? 'active' : ''}"
						onclick={() => (timeframeValue = 1)}
					>
						1 Day
					</button>
					<button
						class="timeframe-btn {timeframeValue === 3 ? 'active' : ''}"
						onclick={() => (timeframeValue = 3)}
					>
						3 Days
					</button>
					<button
						class="timeframe-btn {timeframeValue === 7 ? 'active' : ''}"
						onclick={() => (timeframeValue = 7)}
					>
						1 Week
					</button>
					<button
						class="timeframe-btn {timeframeValue === 14 ? 'active' : ''}"
						onclick={() => (timeframeValue = 14)}
					>
						2 Weeks
					</button>
				</div>
			</div>

			<div class="control-group">
				<span class="control-label" id="method-label">Analysis Method</span>
				<div class="method-toggle" role="group" aria-labelledby="method-label">
					<button class="method-btn {!useAI ? 'active' : ''}" onclick={() => (useAI = false)}>
						<i class="fas fa-chart-line mr-2"></i>
						CNE Baseline
					</button>
					<button class="method-btn {useAI ? 'active' : ''}" onclick={() => (useAI = true)}>
						<i class="fas fa-brain mr-2"></i>
						AI Enhanced
					</button>
				</div>
			</div>
		</div>
		<p class="body-text mb-2">
			{#if useAI}
				AI-enhanced daily forecasts anchored on last CNE's demand and this fair's crowd pattern,
				with an ARIMA/baseline fallback.
			{:else}
				CNE-aware forecasts: last year's same-fair-day demand and the fair's weekday/day-of-fair
				crowd pattern, with ARIMA once enough of this fair's data exists.
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
			{#each Array(6) as _, i (i)}
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
			{#each itemsWithPredictions as item (item.id)}
				<div
					class="bg-white p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300"
					in:fly={{ y: 12, duration: 300, delay: 150 }}
				>
					<div class="flex justify-between items-start mb-2">
						<h3 class="item-name">{item.name}</h3>
						<div class="flex items-center gap-2 flex-wrap justify-end">
							<span class="method-badge {item.isAI ? 'method-ai' : 'method-model'}"
								>{item.method}</span
							>
							<span
								class="conf-badge {CONFIDENCE_META[item.confidence.level].cls}"
								title={item.confidence.basis}
							>
								{CONFIDENCE_META[item.confidence.level].label}
							</span>
						</div>
					</div>

					<p class="mb-1">
						<i class="fas fa-box inline-block mr-1"></i>
						Current Stock: <strong>{item.currentCount}</strong>
					</p>
					<p class="mb-1">
						<i class="fas fa-chart-line inline-block mr-1"></i>
						Predicted Need ({item.prediction.length}
						{item.prediction.length === 1 ? 'day' : 'days'}):
						<strong>{item.totalPrediction.toFixed(1)}</strong> cases
					</p>
					<p class="mb-2">
						<i class="fas fa-cart-plus inline-block mr-1"></i>
						Recommended Order: <strong>{item.recommendedOrder.toFixed(1)}</strong> cases
					</p>

					<p
						class={`text-lg ${getStatusColor(item.currentCount, item.totalPrediction)} flex items-center mb-2`}
					>
						<i
							class="fas {getStatusIcon(item.currentCount, item.totalPrediction)} inline-block mr-2"
						></i>
						Status:
						{#if item.currentCount < item.totalPrediction * 0.5}
							Urgent restock needed
						{:else if item.currentCount < item.totalPrediction}
							Restock recommended
						{:else if item.currentCount > item.totalPrediction * 1.5}
							Potential overstock
						{:else}
							Stock level optimal
						{/if}
					</p>

					<!-- The two questions operators actually ask: when do I run out, and
					     by when must I reorder. -->
					<div class="order-plan mb-2">
						<div class="order-plan-row">
							<span><i class="fas fa-hourglass-half mr-1"></i>Runs out</span>
							<strong>
								{#if item.stockOut}
									{formatDayKey(item.stockOut.date)}
								{:else}
									Not within {item.prediction.length}
									{item.prediction.length === 1 ? 'day' : 'days'}
								{/if}
							</strong>
						</div>
						<div class="order-plan-row">
							<span><i class="fas fa-truck mr-1"></i>Reorder by</span>
							<strong>
								{#if item.reorderBy && item.reorderBy.immediate}
									Now — at/below low stock
								{:else if item.reorderBy}
									{formatDayKey(item.reorderBy.date)}
								{:else}
									No reorder needed
								{/if}
							</strong>
						</div>
					</div>

					{#if item.reasoning}
						<div class="insight mb-2">
							<i class="fas fa-lightbulb mr-2"></i>
							<strong>{item.isAI ? 'AI insight' : 'Why'}:</strong>
							<span class="ml-1">{item.reasoning}</span>
						</div>
					{/if}

					{#if item.isAI && item.divergence !== null}
						<p class="divergence mb-2">
							{#if item.divergence <= 0.15}
								AI agrees with the CNE baseline (within {Math.round(item.divergence * 100)}%).
							{:else}
								AI differs from the CNE baseline by {Math.round(item.divergence * 100)}% ({item.baselineTotal.toFixed(
									1
								)} cases baseline).
							{/if}
						</p>
					{/if}

					{#if item.factors && item.factors.length > 0}
						<div class="mb-2">
							<div class="flex flex-wrap gap-1">
								{#each item.factors as factor (factor)}
									<span class="factor-chip">{factor}</span>
								{/each}
							</div>
						</div>
					{/if}

					<details class="mt-2">
						<summary class="day-summary">Per-day order plan</summary>
						<table class="day-table mt-2">
							<tbody>
								{#each item.prediction as dailyPrediction, index (index)}
									<tr>
										<td class="day-label">
											{item.forecastDates[index]
												? formatDayKey(item.forecastDates[index])
												: `Day ${index + 1}`}
										</td>
										<td class="day-qty">{(Number(dailyPrediction) || 0).toFixed(1)}</td>
									</tr>
								{/each}
							</tbody>
						</table>
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

	.section-title {
		font-size: var(--text-xl);
		font-weight: var(--font-weight-bold);
	}

	.body-text {
		font-size: var(--text-sm);
	}

	.item-name {
		font-size: var(--text-lg);
		font-weight: var(--font-weight-semibold);
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

	:global([data-theme='dark']) .timeframe-selector {
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

	:global([data-theme='dark']) .timeframe-btn.active {
		background: #60a5fa;
		color: #0f172a;
		box-shadow: 0 2px 8px rgba(96, 165, 250, 0.35);
	}

	.method-toggle {
		display: flex;
		background: rgba(0, 0, 0, 0.05);
		border-radius: 12px;
		padding: 4px;
		gap: 2px;
		border: 1px solid rgba(0, 0, 0, 0.1);
	}

	:global([data-theme='dark']) .method-toggle {
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

	:global([data-theme='dark']) .method-btn.active {
		background: #60a5fa;
		color: #0f172a;
		box-shadow: 0 2px 8px rgba(96, 165, 250, 0.35);
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
		/* Subtle tint that adapts: faint dark wash in light mode, faint light wash
		   in dark mode (the old fixed white tint vanished on light surfaces). */
		background-color: color-mix(in srgb, var(--text-color) 7%, transparent);
		border-radius: 0.25rem;
	}

	/* --- Prediction card: badges, order plan, insight, per-day table ---
	   All theme-driven (var(--text-color) tints + color-mix) so a single rule
	   set works in light and dark; no hardcoded surface colors. */
	.method-badge,
	.conf-badge {
		padding: 0.15rem 0.5rem;
		font-size: 0.7rem;
		font-weight: 600;
		border-radius: 9999px;
		white-space: nowrap;
	}

	.method-ai {
		background: rgba(59, 130, 246, 0.15);
		color: #1d4ed8;
	}

	.method-model {
		background: color-mix(in srgb, var(--text-color) 12%, transparent);
		color: var(--text-color);
	}

	:global([data-theme='dark']) .method-ai {
		color: #93c5fd;
	}

	/* Confidence levels read the same way in both themes: green/amber/red tints
	   over the card surface, text lightened in dark mode. */
	.conf-high {
		background: rgba(34, 197, 94, 0.16);
		color: #15803d;
	}

	.conf-medium {
		background: rgba(234, 179, 8, 0.18);
		color: #a16207;
	}

	.conf-low {
		background: rgba(239, 68, 68, 0.16);
		color: #b91c1c;
	}

	:global([data-theme='dark']) .conf-high {
		color: #4ade80;
	}

	:global([data-theme='dark']) .conf-medium {
		color: #facc15;
	}

	:global([data-theme='dark']) .conf-low {
		color: #f87171;
	}

	.conf-badge {
		cursor: help;
	}

	.order-plan {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.5rem 0.75rem;
		border-radius: 0.5rem;
		background-color: color-mix(in srgb, var(--text-color) 6%, transparent);
		border: 1px solid color-mix(in srgb, var(--text-color) 12%, transparent);
	}

	.order-plan-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.875rem;
	}

	.order-plan-row span {
		opacity: 0.8;
	}

	.insight {
		display: block;
		padding: 0.75rem;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		background: rgba(59, 130, 246, 0.1);
		border: 1px solid rgba(59, 130, 246, 0.2);
		color: var(--text-color);
	}

	.insight strong {
		color: #1d4ed8;
	}

	:global([data-theme='dark']) .insight strong {
		color: #60a5fa;
	}

	.insight i {
		color: #2563eb;
	}

	:global([data-theme='dark']) .insight i {
		color: #60a5fa;
	}

	.divergence {
		font-size: var(--text-xs);
		opacity: 0.75;
	}

	.factor-chip {
		padding: 0.15rem 0.5rem;
		font-size: 0.7rem;
		border-radius: 0.25rem;
		background-color: color-mix(in srgb, var(--text-color) 9%, transparent);
		color: var(--text-color);
	}

	.day-summary {
		cursor: pointer;
		font-size: 0.875rem;
		opacity: 0.75;
	}

	.day-summary:hover {
		opacity: 1;
	}

	.day-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.85rem;
	}

	.day-table td {
		padding: 0.2rem 0;
		border-bottom: 1px solid color-mix(in srgb, var(--text-color) 8%, transparent);
	}

	.day-qty {
		text-align: right;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	/* Dark mode adjustments for AI insights */
	:global([data-theme='dark']) .bg-blue-50 {
		background-color: rgba(59, 130, 246, 0.1);
		border-color: rgba(59, 130, 246, 0.2);
	}

	:global([data-theme='dark']) .text-blue-800 {
		color: #60a5fa;
	}

	:global([data-theme='dark']) .text-gray-800 {
		color: #e5e7eb;
	}

	:global([data-theme='dark']) .border-blue-200 {
		border-color: rgba(59, 130, 246, 0.3);
	}

	/* Light-only grays that sit on the (now dark) cards need lighter text in dark
	   mode; skeleton bars need a darker fill. */
	:global([data-theme='dark']) .text-gray-600 {
		color: #9ca3af;
	}

	:global([data-theme='dark']) .text-blue-600 {
		color: #60a5fa;
	}

	:global([data-theme='dark']) .bg-gray-200 {
		background-color: #2c2c2c;
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
