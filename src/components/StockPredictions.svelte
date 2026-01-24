<script>
	import { itemStore } from '../stores/itemStore.js';
	import { notificationStore } from '../stores/notificationStore.js';
	import { getSearchStore } from '../stores/searchStore.js';
	import SearchBar from './SearchBar.svelte';

	let predictions = $state({});
	let loading = $state(true);
	let error = $state('');
	let timeframeValue = $state(14);
	let useAI = $state(false);
	const ANALYSIS_WINDOW = 7;

	// Store values as reactive state
	let items = $state([]);
	let searchTermValue = $state('');

	const searchStore = getSearchStore('stockPredictions');
	const { setSearchTerm, clearSearch } = searchStore;

	$effect(() => {
		const unsubscribeItems = itemStore.subscribe((value) => {
			items = value;
		});
		const unsubscribeSearch = searchStore.subscribe((value) => {
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

	$effect(() => {
		const loadData = async () => {
			await itemStore.loadItems();
			await fetchPredictions();
		};
		loadData();
	});

	let debounceTimer;
	$effect(() => {
		const currentTimeframe = timeframeValue;
		const currentUseAI = useAI;

		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			fetchPredictions();
		}, 300);

		return () => clearTimeout(debounceTimer);
	});

	const itemsWithPredictions = $derived(
		Object.entries(predictions)
			.map(([itemId, predictionData]) => {
				const item = items.find((item) => item.id === itemId);
				if (!item) return null;
				const currentCount = item.count !== undefined ? item.count : 0;
				const prediction = Array.isArray(predictionData) ? predictionData : predictionData.prediction;
				const totalPrediction = Array.isArray(prediction) ? prediction.reduce((sum, daily) => sum + daily, 0) : 0;
				const recommendedOrder = Math.max(0, totalPrediction - currentCount);

				return {
					id: itemId,
					name: item.name,
					currentCount,
					prediction,
					totalPrediction,
					recommendedOrder,
					reasoning: predictionData.reasoning || 'ARIMA time series analysis',
					confidence: predictionData.confidence || 0.7,
					factors: predictionData.factors || ['Historical sales patterns'],
					method: predictionData.method || 'ARIMA'
				};
			})
			.filter((item) => item !== null && item.name.toLowerCase().includes(searchTermValue.toLowerCase()))
	);

	function getStatusClass(currentCount, totalPrediction) {
		if (currentCount < totalPrediction * 0.5) return 'urgent';
		if (currentCount < totalPrediction) return 'warning';
		if (currentCount > totalPrediction * 1.5) return 'overstock';
		return 'optimal';
	}
</script>

<div class="stock-predictions-container">
	<div class="predictions-toolbar">
		<div class="toolbar-group">
			<span class="toolbar-label">TIMEFRAME:</span>
			<div class="ribbon-options">
				{#each [1, 3, 7, 14] as days}
					<button 
						class="ribbon-btn" 
						class:active={timeframeValue === days}
						onclick={() => (timeframeValue = days)}
					>
						{days}{days === 1 ? 'D' : days === 7 ? 'W' : days === 14 ? '2W' : 'D'}
					</button>
				{/each}
			</div>
		</div>

		<div class="toolbar-group">
			<span class="toolbar-label">ENGINE:</span>
			<div class="method-toggle">
				<button class="method-btn" class:active={!useAI} onclick={() => (useAI = false)}>
					<i class="fas fa-chart-line"></i>
					<span>ARIMA</span>
				</button>
				<button class="method-btn" class:active={useAI} onclick={() => (useAI = true)}>
					<i class="fas fa-brain"></i>
					<span>GPT-4o</span>
				</button>
			</div>
		</div>

		<div class="search-wrapper">
			<SearchBar onSearch={setSearchTerm} onClear={clearSearch} searchValue={searchTermValue} placeholder="Filter items..." />
		</div>
	</div>

	<div class="predictions-grid">
		{#if loading}
			{#each Array(6) as _}
				<div class="prediction-card loading-skeleton">
					<div class="skeleton-header"></div>
					<div class="skeleton-body"></div>
					<div class="skeleton-footer"></div>
				</div>
			{/each}
		{:else if error}
			<div class="error-state">
				<i class="fas fa-exclamation-triangle"></i>
				<p>{error}</p>
			</div>
		{:else if itemsWithPredictions.length === 0}
			<div class="null-state">
				<i class="fas fa-search-minus"></i>
				<p>NO PREDICTIONS MATCHED.</p>
			</div>
		{:else}
			{#each itemsWithPredictions as item (item.id)}
				<div class="prediction-card" class:urgent={getStatusClass(item.currentCount, item.totalPrediction) === 'urgent'}>
					<div class="card-header">
						<h3 class="item-name">{item.name}</h3>
						<div class="method-badge" class:ai={item.method.includes('GPT')}>
							{item.method}
						</div>
					</div>

					<div class="card-metrics">
						<div class="metric-row">
							<span class="metric-label">CURRENT STOCK</span>
							<span class="metric-value digital-font">{item.currentCount}</span>
						</div>
						<div class="metric-row">
							<span class="metric-label">PREDICTED NEED</span>
							<span class="metric-value digital-font">{item.totalPrediction.toFixed(1)}</span>
						</div>
						<div class="metric-row highlight">
							<span class="metric-label">RECOMMENDED ORDER</span>
							<span class="metric-value digital-font">{item.recommendedOrder.toFixed(1)}</span>
						</div>
					</div>

					<div class="status-indicator {getStatusClass(item.currentCount, item.totalPrediction)}">
						<div class="status-dot"></div>
						<span class="status-text">
							{#if item.currentCount < item.totalPrediction * 0.5}
								URGENT_RESTOCK
							{:else if item.currentCount < item.totalPrediction}
								RESTOCK_RECOMMENDED
							{:else if item.currentCount > item.totalPrediction * 1.5}
								POTENTIAL_OVERSTOCK
							{:else}
								STOCK_OPTIMAL
							{/if}
						</span>
					</div>

					{#if item.reasoning && item.reasoning !== 'ARIMA time series analysis'}
						<div class="ai-insight">
							<div class="insight-header">
								<i class="fas fa-lightbulb"></i>
								<span>AI_INSIGHT</span>
								<span class="confidence">{Math.round(item.confidence * 100)}% CONF</span>
							</div>
							<p class="insight-text">{item.reasoning}</p>
						</div>
					{/if}

					<details class="breakdown-details">
						<summary>DAILY_BREAKDOWN</summary>
						<div class="breakdown-grid">
							{#each item.prediction as daily, i}
								<div class="breakdown-item">
									<span class="day-label">D{i + 1}</span>
									<span class="day-value">{daily.toFixed(1)}</span>
								</div>
							{/each}
						</div>
					</details>
				</div>
			{/each}
		{/if}
	</div>
</div>

<style>
	.stock-predictions-container {
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	.predictions-toolbar {
		display: flex;
		align-items: center;
		gap: 2rem;
		background: var(--tech-glass-bg);
		padding: 1.25rem 1.5rem;
		border-radius: 12px;
		border: 1px solid var(--tech-glass-border);
		flex-wrap: wrap;
	}

	.toolbar-group {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.toolbar-label {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.65rem;
		font-weight: 800;
		color: var(--tech-label);
		letter-spacing: 0.1em;
	}

	.ribbon-options {
		display: flex;
		gap: 0.4rem;
	}

	.ribbon-btn {
		background: var(--tech-badge-bg);
		border: 1px solid var(--tech-badge-border);
		color: var(--tech-label);
		padding: 0.4rem 0.8rem;
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.65rem;
		font-weight: 700;
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.2s;
	}

	.ribbon-btn:hover {
		border-color: var(--tech-accent);
		color: var(--tech-accent);
	}

	.ribbon-btn.active {
		background: var(--tech-accent-muted);
		border-color: var(--tech-accent);
		color: var(--tech-accent);
	}

	.method-toggle {
		display: flex;
		background: var(--tech-badge-bg);
		padding: 3px;
		border-radius: 6px;
		border: 1px solid var(--tech-badge-border);
	}

	.method-btn {
		background: transparent;
		border: none;
		color: var(--tech-label);
		padding: 0.4rem 0.8rem;
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.65rem;
		font-weight: 700;
		border-radius: 4px;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		transition: all 0.2s;
	}

	.method-btn.active {
		background: var(--tech-accent);
		color: #fff;
	}

	.search-wrapper {
		flex: 1;
		min-width: 250px;
	}

	.predictions-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
		gap: 1.5rem;
	}

	.prediction-card {
		background: var(--tech-glass-bg);
		border: 1px solid var(--tech-glass-border);
		border-radius: 12px;
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		position: relative;
		overflow: hidden;
	}

	.prediction-card:hover {
		transform: translateY(-4px);
		border-color: var(--tech-accent-muted);
		box-shadow: var(--tech-glass-shadow);
	}

	.prediction-card.urgent {
		border-color: rgba(239, 68, 68, 0.3);
	}

	.prediction-card.urgent::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		width: 4px;
		height: 100%;
		background: #ef4444;
	}

	.card-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
	}

	.item-name {
		font-size: 1.1rem;
		font-weight: 800;
		color: var(--tech-title);
		text-transform: uppercase;
		letter-spacing: -0.02em;
		margin: 0;
	}

	.method-badge {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.6rem;
		font-weight: 800;
		padding: 0.2rem 0.5rem;
		background: var(--tech-badge-bg);
		border: 1px solid var(--tech-badge-border);
		border-radius: 4px;
		color: var(--tech-label);
	}

	.method-badge.ai {
		background: var(--tech-accent-muted);
		border-color: var(--tech-accent);
		color: var(--tech-accent);
	}

	.card-metrics {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		background: var(--tech-badge-bg);
		padding: 1rem;
		border-radius: 8px;
		border: 1px solid var(--tech-glass-border);
	}

	.metric-row {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
	}

	.metric-label {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.6rem;
		font-weight: 800;
		color: var(--tech-label);
	}

	.metric-value {
		font-size: 1.1rem;
		font-weight: 800;
		color: var(--tech-value);
	}

	.metric-row.highlight .metric-value {
		color: var(--tech-accent);
		text-shadow: 0 0 10px var(--tech-accent-muted);
	}

	.status-indicator {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.6rem 1rem;
		border-radius: 6px;
		background: var(--tech-badge-bg);
		border: 1px solid var(--tech-glass-border);
	}

	.status-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
	}

	.status-text {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.65rem;
		font-weight: 800;
		letter-spacing: 0.05em;
	}

	.status-indicator.urgent { background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.2); }
	.status-indicator.urgent .status-dot { background: #ef4444; box-shadow: 0 0 10px #ef4444; }
	.status-indicator.urgent .status-text { color: #ef4444; }

	.status-indicator.warning { background: rgba(245, 158, 11, 0.1); border-color: rgba(245, 158, 11, 0.2); }
	.status-indicator.warning .status-dot { background: #f59e0b; }
	.status-indicator.warning .status-text { color: #f59e0b; }

	.status-indicator.optimal { background: rgba(34, 197, 94, 0.1); border-color: rgba(34, 197, 94, 0.2); }
	.status-indicator.optimal .status-dot { background: #22c55e; }
	.status-indicator.optimal .status-text { color: #22c55e; }

	.status-indicator.overstock { background: rgba(59, 130, 246, 0.1); border-color: rgba(59, 130, 246, 0.2); }
	.status-indicator.overstock .status-dot { background: #3b82f6; }
	.status-indicator.overstock .status-text { color: #3b82f6; }

	.ai-insight {
		background: var(--tech-accent-muted);
		border: 1px solid var(--tech-accent);
		border-radius: 8px;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.insight-header {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.6rem;
		font-weight: 800;
		color: var(--tech-accent);
	}

	.confidence {
		margin-left: auto;
		opacity: 0.7;
	}

	.insight-text {
		font-size: 0.8rem;
		line-height: 1.5;
		color: var(--tech-value);
		margin: 0;
	}

	.breakdown-details {
		border-top: 1px solid var(--tech-glass-border);
		padding-top: 1rem;
	}

	.breakdown-details summary {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.6rem;
		font-weight: 800;
		color: var(--tech-label);
		cursor: pointer;
		list-style: none;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.breakdown-details summary::before {
		content: '▶';
		font-size: 0.5rem;
		transition: transform 0.2s;
	}

	.breakdown-details[open] summary::before {
		transform: rotate(90deg);
	}

	.breakdown-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
		gap: 0.5rem;
		margin-top: 1rem;
	}

	.breakdown-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		background: var(--tech-badge-bg);
		padding: 0.4rem;
		border-radius: 4px;
		border: 1px solid var(--tech-glass-border);
	}

	.day-label {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.5rem;
		font-weight: 800;
		color: var(--tech-label);
	}

	.day-value {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.7rem;
		font-weight: 700;
		color: var(--tech-value);
	}

	.digital-font {
		font-family: 'JetBrains Mono', monospace;
	}

	.null-state, .error-state {
		grid-column: 1 / -1;
		height: 300px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1.5rem;
		color: var(--tech-label);
		background: var(--tech-glass-bg);
		border: 1px solid var(--tech-glass-border);
		border-radius: 12px;
	}

	.null-state i, .error-state i { font-size: 3rem; opacity: 0.5; }
	.error-state i { color: #ef4444; }

	@media (max-width: 768px) {
		.predictions-toolbar { flex-direction: column; align-items: stretch; }
		.toolbar-group { justify-content: space-between; }
	}
</style>
