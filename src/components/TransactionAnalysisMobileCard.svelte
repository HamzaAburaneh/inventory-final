<script>
	import { blur } from 'svelte/transition';

	let { mover } = $props();
</script>

<article class="analysis-card" transition:blur={{ duration: 300, amount: 1 }}>
	<!-- Header: Item Name -->
	<header class="card-header">
		<div class="item-id-container">
			<span class="item-label">ITEM</span>
			<span class="item-id">{mover.itemName}</span>
		</div>
	</header>

	<!-- Body: Main Content -->
	<div class="card-body">
		<!-- Transactions Count -->
		<div class="stat-section">
			<span class="section-label">TOTAL TRANSACTIONS</span>
			<span class="stat-value primary">{mover.totalTransactions.toLocaleString('en-US')}</span>
		</div>

		<div class="divider"></div>

		<!-- Stock Movement Grid -->
		<div class="movement-grid">
			<div class="movement-item">
				<span class="section-label">STOCK IN</span>
				<span class="stat-value positive">+{mover.totalAdded.toLocaleString('en-US')}</span>
			</div>
			
			<div class="movement-item">
				<span class="section-label">STOCK OUT</span>
				<span class="stat-value negative">-{mover.totalRemoved.toLocaleString('en-US')}</span>
			</div>
		</div>

		<div class="divider"></div>

		<!-- Net Change & Volatility -->
		<div class="summary-grid">
			<div class="summary-item">
				<span class="section-label">NET CHANGE</span>
				<span class="stat-value" class:positive={mover.netChange >= 0} class:negative={mover.netChange < 0}>
					{mover.netChange >= 0 ? '+' : ''}{mover.netChange.toLocaleString('en-US')}
				</span>
			</div>
			
			<div class="summary-item">
				<span class="section-label">VOLATILITY</span>
				<span class="stat-value volatility">{mover.volatility}</span>
			</div>
		</div>
	</div>
</article>

<style>
	/* Card Container - Dark Tech Theme */
	.analysis-card {
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
	}

	.analysis-card:hover {
		box-shadow:
			0 10px 20px -5px rgba(0, 0, 0, 0.4),
			0 6px 10px -5px rgba(0, 0, 0, 0.3);
		border-color: rgba(255, 255, 255, 0.1);
	}

	/* Header */
	.card-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 16px;
		border-bottom: 1px solid var(--tech-glass-border, rgba(255, 255, 255, 0.08));
		background: var(--tech-header-bg, rgba(15, 23, 42, 0.4));
	}

	.item-id-container {
		display: flex;
		flex-direction: column;
		gap: 8px;
		width: 100%;
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

	/* Stat Section */
	.stat-section {
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.stat-value {
		font-size: 1.375rem;
		line-height: 1.2;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		text-align: center;
	}

	.stat-value.primary {
		color: var(--tech-accent, #0ea5e9);
		font-size: 1.5rem;
	}

	.stat-value.positive {
		color: #22c55e;
	}

	.stat-value.negative {
		color: #ef4444;
	}

	.stat-value.volatility {
		color: #a855f7;
		font-weight: 700;
	}

	/* Movement Grid */
	.movement-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}

	.movement-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 12px;
		background: rgba(30, 41, 59, 0.4);
		border-radius: 8px;
		border: 1px solid rgba(255, 255, 255, 0.05);
	}

	/* Summary Grid */
	.summary-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}

	.summary-item {
		display: flex;
		flex-direction: column;
		align-items: center;
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

		.stat-value {
			font-size: 1.25rem;
		}

		.stat-value.primary {
			font-size: 1.375rem;
		}
	}
</style>
