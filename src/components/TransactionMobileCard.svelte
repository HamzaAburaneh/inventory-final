<script>
	import { blur } from 'svelte/transition';

	let { item, onChangeCount, onResetCount } = $props();

	const handleAdd = () => {
		if (item.changeAmount > 0) {
			onChangeCount(item, +item.changeAmount);
		}
	};

	const handleSubtract = () => {
		if (item.changeAmount > 0) {
			onChangeCount(item, -item.changeAmount);
		}
	};

	const handleReset = () => {
		onResetCount(item);
	};
</script>

<article class="transaction-card" transition:blur={{ duration: 300, amount: 1 }}>
	<!-- Header: Item Name -->
	<header class="card-header">
		<div class="item-id-container">
			<span class="item-label">ITEM</span>
			<span class="item-id">{item.name}</span>
		</div>
	</header>

	<!-- Body: Main Content -->
	<div class="card-body">
		<!-- Current Count -->
		<div class="count-section">
			<span class="section-label">CURRENT COUNT</span>
			{#key item.count}
				<span class="count-value" in:blur={{ duration: 400, amount: 2 }}>
					{item.count.toLocaleString('en-US')}
				</span>
			{/key}
		</div>

		<div class="divider"></div>

		<!-- Change Amount Input -->
		<div class="change-section">
			<span class="section-label">CHANGE AMOUNT</span>
			<input
				type="number"
				inputmode="numeric"
				pattern="[0-9]*"
				placeholder="0"
				value={item.changeAmount === 0 ? '' : item.changeAmount}
				oninput={(e) => {
					const input = e.target;
					const value = input.value.replace(/[^0-9]/g, '');
					if (value === '') {
						item.changeAmount = 0;
						input.value = '';
					} else {
						const numValue = parseInt(value, 10);
						item.changeAmount = numValue;
						input.value = numValue.toString();
					}
				}}
				class="change-input"
			/>
		</div>

		<div class="divider"></div>

		<!-- Action Buttons -->
		<div class="actions-section">
			<span class="section-label">ACTIONS</span>
			<div class="actions-grid">
				<button
					class="action-btn add"
					onclick={handleAdd}
					disabled={item.changeAmount === 0}
					aria-label="Add amount"
				>
					<i class="fas fa-plus"></i>
					<span class="btn-text">Add</span>
				</button>
				<button
					class="action-btn subtract"
					onclick={handleSubtract}
					disabled={item.changeAmount === 0}
					aria-label="Subtract amount"
				>
					<i class="fas fa-minus"></i>
					<span class="btn-text">Remove</span>
				</button>
				<button
					class="action-btn reset"
					onclick={handleReset}
					disabled={item.count === 0}
					aria-label="Reset to zero"
				>
					<i class="fas fa-undo"></i>
					<span class="btn-text">Reset</span>
				</button>
			</div>
		</div>
	</div>
</article>

<style>
	/* Card Container - Dark Tech Theme */
	.transaction-card {
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

	.transaction-card:hover {
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
		font-size: 1.2em;
		line-height: 1;
		font-weight: 700;
		color: var(--tech-title, #f1f5f9);
		font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
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

	/* Count Section */
	.count-section {
		display: flex;
		flex-direction: column;
		padding-bottom: 0;
	}

	.count-value {
		font-size: 1.5em;
		line-height: 1;
		font-weight: 700;
		color: var(--tech-title, #f1f5f9);
		font-variant-numeric: tabular-nums;
		font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		padding: 8px 12px;
		border-radius: 8px;
		text-align: center;
	}

	/* Change Amount Section */
	.change-section {
		display: flex;
		flex-direction: column;
		padding-bottom: 0;
	}

	.change-input {
		width: 100%;
		min-height: 40px;
		padding: 0 16px;
		font-size: 1rem;
		font-weight: 600;
		text-align: center;
		background: var(--tech-badge-bg, rgba(30, 41, 59, 0.6));
		border: 1px solid var(--tech-glass-border, rgba(255, 255, 255, 0.08));
		border-radius: 8px;
		color: var(--tech-value, #e2e8f0);
		font-variant-numeric: tabular-nums;
		font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		box-sizing: border-box;
		transition: all 0.2s ease;
		-moz-appearance: textfield;
	}

	.change-input::-webkit-outer-spin-button,
	.change-input::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}

	.change-input:focus {
		outline: none;
		border-color: rgba(251, 191, 36, 0.5);
		box-shadow: 0 0 0 2px rgba(251, 191, 36, 0.15);
	}

	.change-input::placeholder {
		color: var(--tech-label, rgba(148, 163, 184, 0.4));
	}

	/* Actions Section */
	.actions-section {
		display: flex;
		flex-direction: column;
		padding-bottom: 0;
	}

	.actions-grid {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		gap: 8px;
	}

	.action-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 4px;
		min-height: 56px;
		padding: 8px;
		border-radius: 8px;
		border: 1px solid transparent;
		transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
		cursor: pointer;
		position: relative;
		overflow: hidden;
		background: var(--tech-badge-bg, rgba(30, 41, 59, 0.6));
		font-family: 'Geist', sans-serif;
	}

	.action-btn i {
		font-size: 1.125rem;
		line-height: 1;
	}

	.btn-text {
		font-size: 0.65rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.025em;
	}

	.action-btn:disabled {
		opacity: 0.3;
		cursor: not-allowed;
		filter: grayscale(1);
		border-color: transparent !important;
	}

	.action-btn.add {
		color: #22c55e;
		border-color: rgba(34, 197, 94, 0.2);
		background: rgba(34, 197, 94, 0.05);
	}

	.action-btn.add:not(:disabled):hover {
		background: #22c55e;
		color: white;
		box-shadow: 0 0 15px rgba(34, 197, 94, 0.4);
		transform: translateY(-2px);
	}

	.action-btn.subtract {
		color: #ef4444;
		border-color: rgba(239, 68, 68, 0.2);
		background: rgba(239, 68, 68, 0.05);
	}

	.action-btn.subtract:not(:disabled):hover {
		background: #ef4444;
		color: white;
		box-shadow: 0 0 15px rgba(239, 68, 68, 0.4);
		transform: translateY(-2px);
	}

	.action-btn.reset {
		color: #fbbf24;
		border-color: rgba(251, 191, 36, 0.3);
		background: rgba(251, 191, 36, 0.08);
	}

	.action-btn.reset:not(:disabled):hover {
		background: rgba(251, 191, 36, 0.15);
		color: #fbbf24;
		border-color: rgba(251, 191, 36, 0.5);
		box-shadow: 0 0 20px rgba(251, 191, 36, 0.3);
		transform: translateY(-2px);
	}

	.action-btn:not(:disabled):active {
		transform: translateY(0) scale(0.95);
	}

	/* Responsive */
	@media (max-width: 360px) {
		.card-header {
			padding: 12px 16px;
		}

		.card-body {
			padding: 16px;
			gap: 16px;
		}

		.item-id {
			font-size: 1.125rem;
		}

		.count-value {
			font-size: 1.375rem;
		}

		.btn-text {
			font-size: 0.6rem;
		}
	}
</style>

