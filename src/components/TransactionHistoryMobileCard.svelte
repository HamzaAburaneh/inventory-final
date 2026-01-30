<script>
	import { blur } from 'svelte/transition';

	let { transaction } = $props();

	// Calculate the changed amount
	const changedAmount = $derived(transaction.newCount - transaction.previousCount);
	const isPositive = $derived(changedAmount > 0);
	const isNegative = $derived(changedAmount < 0);

	// Format timestamp
	const formatDate = (date) => {
		return new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit',
			hour12: true
		}).format(date);
	};

	// Format combined user and timestamp
	const formatUserTimestamp = (user, date) => {
		const username = user ? user.split('@')[0] : 'Unknown';
		const timestamp = formatDate(date);
		return `Updated by ${username} at ${timestamp}`;
	};

	// Get transaction type styling - prioritize transaction type over change amount
	const getTypeStyle = (type, changedAmount) => {
		// Check transaction type first
		if (type === 'reset') {
			return {
				color: '#fbbf24',
				icon: 'fa-undo',
				label: 'RESET'
			};
		} else if (type === 'add') {
			return {
				color: '#22c55e',
				icon: 'fa-arrow-up',
				label: 'ADD'
			};
		} else if (type === 'subtract') {
			return {
				color: '#ef4444',
				icon: 'fa-arrow-down',
				label: 'REMOVE'
			};
		}
		
		// Fallback to change amount if type is not set
		if (changedAmount > 0) {
			return {
				color: '#22c55e',
				icon: 'fa-arrow-up',
				label: 'ADD'
			};
		} else if (changedAmount < 0) {
			return {
				color: '#ef4444',
				icon: 'fa-arrow-down',
				label: 'REMOVE'
			};
		}
		
		return {
			color: '#94a3b8',
			icon: 'fa-minus',
			label: 'NO CHANGE'
		};
	};

	const typeStyle = $derived(getTypeStyle(transaction.type, changedAmount));
</script>

<article class="transaction-history-card" transition:blur={{ duration: 300, amount: 1 }}>
	<!-- Header: Item Name -->
	<header class="card-header">
		<div class="item-id-container">
			<span class="item-label">ITEM</span>
			<span class="item-id">{transaction.itemName}</span>
		</div>
		<div class="type-badge" style="--badge-color: {typeStyle.color}">
			<i class="fas {typeStyle.icon}"></i>
			<span>{typeStyle.label}</span>
		</div>
	</header>

	<!-- Body: Main Content -->
	<div class="card-body">
		<!-- Combined User & Timestamp -->
		<div class="info-section">
			<div class="info-row">
				<i class="fas fa-user info-icon"></i>
				<span class="highlight-user">{transaction.user ? transaction.user.split('@')[0] : 'Unknown'}</span>
			</div>
			<div class="info-row">
				<i class="fas fa-clock info-icon"></i>
				<span class="highlight-date">{formatDate(transaction.timestamp)}</span>
			</div>
		</div>

		<div class="divider"></div>

		<!-- Count Changes -->
		<div class="counts-section">
			<div class="count-item">
				<span class="section-label">PREVIOUS</span>
				<span class="count-value">{transaction.previousCount.toLocaleString('en-US')}</span>
			</div>
			
			<div class="arrow-container">
				<i class="fas fa-arrow-right arrow-icon"></i>
			</div>
			
			<div class="count-item">
				<span class="section-label">NEW COUNT</span>
				<span class="count-value count-highlight">{transaction.newCount.toLocaleString('en-US')}</span>
			</div>
		</div>

		<div class="divider"></div>

		<!-- Changed Amount -->
		<div class="change-section">
			<span class="section-label">CHANGE</span>
			<span class="change-value" class:positive={isPositive} class:negative={isNegative}>
				{isPositive ? '+' : ''}{changedAmount.toLocaleString('en-US')}
			</span>
		</div>
	</div>
</article>

<style>
	/* Card Container - Dark Tech Theme */
	.transaction-history-card {
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

	.transaction-history-card:hover {
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

	.type-badge {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 12px;
		background: transparent;
		border: 1.5px solid var(--badge-color);
		border-radius: 8px;
		color: var(--badge-color);
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		white-space: nowrap;
		flex-shrink: 0;
		transition: all 0.2s ease;
	}

	.type-badge i {
		font-size: 0.9rem;
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

	/* Info Section */
	.info-section {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 4px 0;
	}

	.info-row {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
	}

	.info-icon {
		font-size: 0.75rem;
		color: var(--tech-label, rgba(148, 163, 184, 0.6));
		flex-shrink: 0;
	}

	.highlight-user {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--tech-value, #e2e8f0);
		font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
	}

	.highlight-date {
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--tech-value, #e2e8f0);
		font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
	}

	/* Counts Section */
	.counts-section {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		gap: 12px;
		align-items: center;
	}

	.count-item {
		display: flex;
		flex-direction: column;
	}

	.count-value {
		font-size: 1.125rem;
		line-height: 1.2;
		font-weight: 600;
		color: var(--tech-value, #e2e8f0);
		font-variant-numeric: tabular-nums;
		font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		text-align: center;
	}

	.count-highlight {
		color: var(--tech-accent, #0ea5e9);
	}

	.arrow-container {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0 8px;
	}

	.arrow-icon {
		font-size: 1.25rem;
		color: var(--tech-label, rgba(148, 163, 184, 0.5));
	}

	/* Change Section */
	.change-section {
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.change-value {
		font-size: 1.375rem;
		line-height: 1.2;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		padding: 8px 16px;
		border-radius: 8px;
		background: rgba(30, 41, 59, 0.6);
		border: 1px solid rgba(255, 255, 255, 0.08);
		text-align: center;
		min-width: 120px;
	}

	.change-value.positive {
		color: #22c55e;
		border-color: rgba(34, 197, 94, 0.3);
		background: rgba(34, 197, 94, 0.1);
	}

	.change-value.negative {
		color: #ef4444;
		border-color: rgba(239, 68, 68, 0.3);
		background: rgba(239, 68, 68, 0.1);
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
			font-size: 1.125rem;
		}

		.count-value {
			font-size: 1.125rem;
		}

		.change-value {
			font-size: 1.25rem;
		}
	}
</style>
