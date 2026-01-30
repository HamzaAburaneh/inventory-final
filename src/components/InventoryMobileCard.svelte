<script>
	import { blur } from 'svelte/transition';
	import {
		formatCost,
		formatTotalValue,
		formatBooths,
		getStorageTypeStyle,
		getBoothStyle
	} from '../lib/tableUtils.js';

	let { item, onEdit, onDelete, onTooltipShow, onTooltipHide } = $props();

	// Get storage type icon and color
	const getStorageIcon = (storageType) => {
		const type = storageType?.toLowerCase() || '';
		if (type.includes('freezer')) return 'fa-snowflake';
		if (type.includes('refrigerator')) return 'fa-temperature-low';
		if (type.includes('dry')) return 'fa-box';
		return 'fa-box';
	};

	const getStorageColor = (storageType) => {
		const type = storageType?.toLowerCase() || '';
		if (type.includes('freezer')) return '#3B82F6';
		if (type.includes('refrigerator')) return '#10B981';
		if (type.includes('dry')) return '#F59E0B';
		return '#0ea5e9';
	};

	function handleEdit(event) {
		const button = event.currentTarget;
		const rect = button.getBoundingClientRect();

		const position = {
			x: rect.left + rect.width / 2,
			y: rect.top + rect.height / 2
		};

		// Pass entire item for comprehensive editing
		onEdit(item.id, 'all', item, position);
	}

	function handleDelete(event) {
		const button = event.currentTarget;
		const rect = button.getBoundingClientRect();

		const position = {
			x: rect.left + rect.width / 2,
			y: rect.top + rect.height / 2
		};

		onDelete(item.id, item.name, position);
	}

	const totalValue = $derived(formatTotalValue(item.count, item.cost));
</script>

<article class="inventory-card" transition:blur={{ duration: 300, amount: 1 }}>
	<!-- Header: Item Label + ID + Actions -->
	<header class="card-header">
		<div class="item-id-container">
			<span class="item-label">ITEM</span>
			<span class="item-id">{item.name}</span>
		</div>
		<div class="card-actions">
			<button
				class="action-btn action-edit"
				onclick={handleEdit}
				onmouseenter={onTooltipShow}
				onmouseleave={onTooltipHide}
				data-tooltip="Edit Item"
				aria-label="Edit item"
			>
				<i class="fas fa-pencil-alt"></i>
			</button>
			<button
				class="action-btn action-delete"
				onclick={handleDelete}
				onmouseenter={onTooltipShow}
				onmouseleave={onTooltipHide}
				data-tooltip="Delete"
				aria-label="Delete item"
			>
				<i class="fas fa-trash-alt"></i>
			</button>
		</div>
	</header>

	<!-- Body: Main Content -->
	<div class="card-body">
		<!-- Quantity -->
		<div class="quantity-section">
			<span class="section-label">QUANTITY</span>
			<span class="quantity-value">{item.count.toLocaleString('en-US')}</span>
		</div>

		<!-- Low Stock Alert -->
		<div class="low-stock-section">
			<div class="low-stock-header">
				<div class="low-stock-title">
					<i class="fas fa-exclamation-triangle warning-icon"></i>
					<span class="low-stock-text">Low Stock Alert</span>
				</div>
				<label class="switch">
					<input type="checkbox" checked={item.lowCount !== null && item.lowCount !== undefined} />
					<span class="slider"></span>
				</label>
			</div>
			<div class="low-stock-threshold">
				<span class="threshold-label">Notify when below</span>
				<div class="threshold-input-group">
					<input
						type="number"
						value={item.lowCount ?? 0}
						onchange={(e) => handleEdit(e, 'lowCount', item.lowCount)}
						class="threshold-input"
					/>
					<span class="threshold-unit">units</span>
				</div>
			</div>
		</div>

		<!-- Cost & Value Grid -->
		<div class="cost-value-grid">
			<div class="metric-item">
				<span class="metric-label">UNIT COST</span>
				<span class="metric-value">{formatCost(item.cost)}</span>
			</div>
			<div class="metric-item metric-item-right">
				<span class="metric-label">TOTAL VALUE</span>
				<span class="metric-value metric-value-success">{totalValue}</span>
			</div>
		</div>

		<!-- Location -->
		<div class="location-section">
			<i class="fas {getStorageIcon(item.storageType)} location-icon" style="color: {getStorageColor(item.storageType)}"></i>
			<span class="location-text">{item.storageType || 'N/A'}</span>
		</div>

		<!-- Tags -->
		<div class="tags-section">
			{#each formatBooths(item.booths) as booth}
				<span class="tag" style="--tag-color: {getBoothStyle(booth).backgroundColor}">
					<span class="tag-dot"></span>
					{booth}
				</span>
			{/each}
		</div>
	</div>
</article>

<style>
	/* Card Container - Dark Tech Theme */
	.inventory-card {
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

	.inventory-card:hover {
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
		align-items: center;
		gap: 8px;
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
		margin-bottom: 0.1em;
		line-height: 1;
		font-weight: 700;
		color: var(--tech-title, #f1f5f9);
		font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
	}

	.card-actions {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	/* Action Buttons */
	.action-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: 4px;
		border: none;
		background: transparent;
		color: var(--tech-label, rgba(148, 163, 184, 0.8));
		cursor: pointer;
		transition: all 0.15s ease;
		padding: 0;
	}

	.action-btn i {
		font-size: 0.875rem;
	}

	.action-btn:hover {
		background: var(--tech-badge-bg, rgba(30, 41, 59, 0.6));
		color: var(--tech-value, #e2e8f0);
	}

	.action-delete:hover {
		color: #ef4444;
	}

	/* Body */
	.card-body {
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 16px;
		background: var(--tech-glass-bg, rgba(15, 23, 42, 0.6));
	}

	/* Quantity Section */
	.quantity-section {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
	}

	.section-label {
		font-size: 0.6rem;
		font-weight: 600;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--tech-label, rgba(148, 163, 184, 0.8));
	}

	.quantity-value {
		font-size: 1.5em;
		line-height: 1;
		font-weight: 700;
		color: var(--tech-title, #f1f5f9);
		font-variant-numeric: tabular-nums;
		font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
	}

	/* Low Stock Alert */
	.low-stock-section {
		padding: 10px 12px;
		background: var(--tech-badge-bg, rgba(30, 41, 59, 0.6));
		border: 1px solid var(--tech-glass-border, rgba(255, 255, 255, 0.08));
		border-radius: 8px;
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	.low-stock-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-bottom: 8px;
		border-bottom: 1px solid var(--tech-glass-border, rgba(255, 255, 255, 0.08));
	}

	.low-stock-title {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.warning-icon {
		width: 1em;
		height: 1em;
		color: #fbbf24;
		font-size: 1em;
	}

	.low-stock-text {
		margin-top: 1px;
		font-size: 0.75em;
		font-weight: 600;
		color: var(--tech-value, #e2e8f0);
	}

	/* Switch Component */
	.switch {
		position: relative;
		display: inline-block;
		width: 40px;
		height: 20px;
		flex-shrink: 0;
	}

	.switch input {
		opacity: 0;
		width: 0;
		height: 0;
	}

	.slider {
		position: absolute;
		cursor: pointer;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-color: rgba(71, 85, 105, 0.5);
		transition: 0.3s;
		border-radius: 22px;
	}

	.slider:before {
		position: absolute;
		content: '';
		height: 14px;
		width: 14px;
		left: 3px;
		bottom: 3px;
		background-color: #f1f5f9;
		transition: 0.3s;
		border-radius: 50%;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
	}

	.switch input:checked + .slider {
		background-color: var(--tech-accent-toggle, #0ea5e9);
	}

	.switch input:checked + .slider:before {
		transform: translateX(20px);
	}

	/* Threshold Input */
	.low-stock-threshold {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 0 0 0;
		border: none;
	}

	.threshold-label {
		font-size: 0.75em;
		font-weight: 400;
		color: var(--tech-label, rgba(148, 163, 184, 0.8));
	}

	.threshold-input-group {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.threshold-input {
		width: 4rem;
		min-height: 1.75rem;
		max-height: 1.75rem;
		padding: 0 0.75rem;
		font-size: 0.875rem;
		font-weight: 600;
		text-align: center;
		background: var(--tech-header-bg, rgba(15, 23, 42, 0.4));
		border: 1px solid var(--tech-glass-border, rgba(255, 255, 255, 0.08));
		border-radius: 6px;
		color: var(--tech-value, #e2e8f0);
		font-variant-numeric: tabular-nums;
		font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		box-sizing: border-box;
		line-height: normal;
		transition: all 0.2s ease;
	}

	.threshold-input:focus {
		outline: none;
		border-color: var(--tech-accent, #0ea5e9);
		box-shadow: 0 0 0 2px rgba(14, 165, 233, 0.2);
	}

	.threshold-unit {
		font-size: 0.75em;
		color: var(--tech-label, rgba(148, 163, 184, 0.8));
	}

	/* Cost & Value Grid */
	.cost-value-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px;
	}

	.metric-item {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.metric-item-right {
		text-align: right;
		align-items: flex-end;
	}

	.metric-label {
		font-size: 0.7em;
		font-weight: 600;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--tech-label, rgba(148, 163, 184, 0.8));
	}

	.metric-value {
		font-size: 1.125rem;
		line-height: 1;
		font-weight: 700;
		color: var(--tech-value, #e2e8f0);
		font-variant-numeric: tabular-nums;
		font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
	}

	.metric-value-success {
		color: #34d399;
	}

	/* Location Section */
	.location-section {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 12px;
		background: var(--tech-badge-bg, rgba(30, 41, 59, 0.6));
		border: 1px solid var(--tech-glass-border, rgba(255, 255, 255, 0.08));
		border-radius: 8px;
	}

	.location-icon {
		width: 16px;
		height: 16px;
		flex-shrink: 0;
	}

	.location-text {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--tech-value, #e2e8f0);
		flex: 1;
	}

	/* Tags Section */
	.tags-section {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		align-items: center;
	}

	.tag {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 10px;
		background: var(--tech-badge-bg, rgba(30, 41, 59, 0.6));
		border: 1px solid var(--tech-glass-border, rgba(255, 255, 255, 0.08));
		border-radius: 6px;
		font-size: 0.7rem;
		font-weight: 700;
		color: var(--tech-value, #e2e8f0);
		text-transform: uppercase;
		letter-spacing: 0.025em;
	}

	.tag-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background-color: var(--tag-color);
		flex-shrink: 0;
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
			font-size: 1.25rem;
		}

		.quantity-value {
			font-size: 1.875rem;
		}

		.metric-value {
			font-size: 1.125rem;
		}
	}
</style>
