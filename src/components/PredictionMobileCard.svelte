<script>
	import { blur } from 'svelte/transition';

	let { item, getStatusClass } = $props();
</script>

<article class="prediction-card" class:urgent={getStatusClass(item.currentCount, item.totalPrediction) === 'urgent'} transition:blur={{ duration: 300, amount: 1 }}>
	<!-- Header: Item Name & Method Badge -->
	<header class="card-header">
		<div class="item-id-container">
			<span class="item-label">ITEM</span>
			<span class="item-id">{item.name}</span>
		</div>
		<div class="method-badge" class:ai={item.method.includes('GPT')}>
			{item.method}
		</div>
	</header>

	<!-- Body: Main Content -->
	<div class="card-body">
		<!-- Stock Metrics -->
		<div class="metrics-section">
			<div class="metric-item">
				<span class="section-label">CURRENT STOCK</span>
				<span class="metric-value">{item.currentCount.toLocaleString('en-US')}</span>
			</div>
			<div class="metric-item">
				<span class="section-label">PREDICTED NEED</span>
				<span class="metric-value">{item.totalPrediction.toFixed(1)}</span>
			</div>
			<div class="metric-item highlight">
				<span class="section-label">RECOMMENDED ORDER</span>
				<span class="metric-value primary">{item.recommendedOrder.toFixed(1)}</span>
			</div>
		</div>

		<div class="divider"></div>

		<!-- Status Indicator -->
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

		<!-- AI Insight (if available) -->
		{#if item.reasoning && item.reasoning !== 'ARIMA time series analysis'}
			<div class="divider"></div>
			<div class="ai-insight">
				<div class="insight-header">
					<i class="fas fa-lightbulb"></i>
					<span>AI_INSIGHT</span>
					<span class="confidence">{Math.round(item.confidence * 100)}% CONF</span>
				</div>
				<p class="insight-text">{item.reasoning}</p>
			</div>
		{/if}

		<!-- Daily Breakdown -->
		<div class="divider"></div>
		<details class="breakdown-details">
			<summary class="breakdown-summary">
				<span>DAILY_BREAKDOWN</span>
				<i class="fas fa-chevron-down"></i>
			</summary>
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
</article>

<style>
	/* Card Container - Dark Tech Theme */
	.prediction-card {
		width: 100%;
		max-width: 28rem;
		background: var(--tech-glass-bg, rgba(15, 23, 42, 0.6));
		border-radius: 12px;
		box-shadow:
			0 4px 6px -1px rgba(0, 0, 0, 0.3),
			0 2px 4px -1px rgba(0, 0, 0, 0.2),
			inset 0 0 0 1px rgba(255, 255, 255, 0.02);
		border: 1px solid var(--tech-glass-border, rgba(255, 255, 255, 0.08));
		overflow: hidden;
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		position: relative;
	}

	.prediction-card:hover {
		box-shadow:
			0 10px 20px -5px rgba(0, 0, 0, 0.4),
			0 6px 10px -5px rgba(0, 0, 0, 0.3);
		border-color: rgba(255, 255, 255, 0.1);
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

	/* Header */
	.card-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 16px;
		border-bottom: 1px solid var(--tech-glass-border, rgba(255, 255, 255, 0.08));
		background: var(--tech-header-bg, rgba(15, 23, 42, 0.4));
		gap: 12px;
	}

	.item-id-container {
		display: flex;
		flex-direction: column;
		gap: 8px;
		flex: 1;
		min-width: 0;
	}

	.item-label {
		font-size: 0.75rem;
		font-weight: 500;
		letter-spacing: 0.025em;
		text-transform: uppercase;
		color: var(--tech-label, rgba(148, 163, 184, 0.8));
	}

	.item-id {
		font-size: 1.125rem;
		line-height: 1.2;
		font-weight: 600;
		color: var(--tech-title, #f1f5f9);
		font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.method-badge {
		display: flex;
		align-items: center;
		padding: 6px 10px;
		background: rgba(0, 0, 0, 0.3);
		border: 1px solid rgba(148, 163, 184, 0.3);
		border-radius: 6px;
		color: rgba(148, 163, 184, 0.9);
		font-size: 0.6rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		white-space: nowrap;
		flex-shrink: 0;
		font-family: 'JetBrains Mono', monospace;
	}

	.method-badge.ai {
		background: rgba(168, 85, 247, 0.1);
		border-color: rgba(168, 85, 247, 0.4);
		color: #a855f7;
	}

	/* Body */
	.card-body {
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 0;
		background: var(--tech-glass-bg, rgba(15, 23, 42, 0.6));
	}

	/* Divider */
	.divider {
		height: 1px;
		background: var(--tech-cell-border, rgba(255, 255, 255, 0.08));
		margin: 12px 0;
	}

	/* Section Label */
	.section-label {
		font-size: 0.6rem;
		font-weight: 600;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--tech-label, rgba(148, 163, 184, 0.8));
		display: block;
		margin-bottom: 6px;
		text-align: center;
	}

	/* Metrics Section */
	.metrics-section {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.metric-item {
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.metric-value {
		font-size: 1.25rem;
		line-height: 1.2;
		font-weight: 600;
		color: var(--tech-value, #e2e8f0);
		font-variant-numeric: tabular-nums;
		font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		text-align: center;
	}

	.metric-item.highlight .metric-value {
		font-size: 1.375rem;
	}

	.metric-value.primary {
		color: var(--tech-accent, #0ea5e9);
	}

	/* Status Indicator */
	.status-indicator {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		padding: 10px 16px;
		border-radius: 8px;
		background: rgba(30, 41, 59, 0.6);
		border: 1px solid rgba(255, 255, 255, 0.08);
	}

	.status-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.status-text {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.65rem;
		font-weight: 700;
		letter-spacing: 0.05em;
	}

	.status-indicator.urgent {
		background: rgba(239, 68, 68, 0.1);
		border-color: rgba(239, 68, 68, 0.3);
	}
	.status-indicator.urgent .status-dot {
		background: #ef4444;
		box-shadow: 0 0 10px #ef4444;
	}
	.status-indicator.urgent .status-text {
		color: #ef4444;
	}

	.status-indicator.warning {
		background: rgba(245, 158, 11, 0.1);
		border-color: rgba(245, 158, 11, 0.3);
	}
	.status-indicator.warning .status-dot {
		background: #f59e0b;
	}
	.status-indicator.warning .status-text {
		color: #f59e0b;
	}

	.status-indicator.optimal {
		background: rgba(34, 197, 94, 0.1);
		border-color: rgba(34, 197, 94, 0.3);
	}
	.status-indicator.optimal .status-dot {
		background: #22c55e;
	}
	.status-indicator.optimal .status-text {
		color: #22c55e;
	}

	.status-indicator.overstock {
		background: rgba(59, 130, 246, 0.1);
		border-color: rgba(59, 130, 246, 0.3);
	}
	.status-indicator.overstock .status-dot {
		background: #3b82f6;
	}
	.status-indicator.overstock .status-text {
		color: #3b82f6;
	}

	/* AI Insight */
	.ai-insight {
		background: rgba(168, 85, 247, 0.1);
		border: 1px solid rgba(168, 85, 247, 0.3);
		border-radius: 8px;
		padding: 12px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.insight-header {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.6rem;
		font-weight: 700;
		color: #a855f7;
	}

	.confidence {
		margin-left: auto;
		opacity: 0.8;
	}

	.insight-text {
		font-size: 0.8rem;
		line-height: 1.5;
		color: var(--tech-value, #e2e8f0);
		margin: 0;
		font-weight: 400;
	}

	/* Breakdown Details */
	.breakdown-details {
		padding: 0;
	}

	.breakdown-summary {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.6rem;
		font-weight: 700;
		color: var(--tech-label, rgba(148, 163, 184, 0.8));
		cursor: pointer;
		list-style: none;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 0;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.breakdown-summary::-webkit-details-marker {
		display: none;
	}

	.breakdown-summary i {
		font-size: 0.7rem;
		transition: transform 0.3s;
		color: var(--tech-accent, #0ea5e9);
	}

	.breakdown-details[open] .breakdown-summary i {
		transform: rotate(180deg);
	}

	.breakdown-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 8px;
		margin-top: 8px;
	}

	.breakdown-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		background: rgba(30, 41, 59, 0.6);
		padding: 8px 4px;
		border-radius: 6px;
		border: 1px solid rgba(255, 255, 255, 0.05);
	}

	.day-label {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.5rem;
		font-weight: 700;
		color: var(--tech-label, rgba(148, 163, 184, 0.8));
		margin-bottom: 4px;
	}

	.day-value {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.7rem;
		font-weight: 600;
		color: var(--tech-value, #e2e8f0);
	}

	/* Responsive */
	@media (max-width: 360px) {
		.card-header {
			padding: 12px 16px;
		}

		.card-body {
			padding: 16px;
		}

		.item-id {
			font-size: 1rem;
		}

		.metric-value {
			font-size: 1.125rem;
		}

		.breakdown-grid {
			grid-template-columns: repeat(3, 1fr);
		}
	}
</style>
