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

	function handleEdit(event, field, currentValue) {
		const button = event.currentTarget;
		const rect = button.getBoundingClientRect();

		const position = {
			x: rect.left + rect.width / 2,
			y: rect.top + rect.height / 2
		};

		onEdit(item.id, field, currentValue, position);
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
				onclick={(e) => handleEdit(e, 'name', item.name)}
				onmouseenter={onTooltipShow}
				onmouseleave={onTooltipHide}
				data-tooltip="Edit"
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
				<div class="metric-value-with-edit">
					<span class="metric-value">{formatCost(item.cost)}</span>
					<button
						class="inline-edit-btn"
						onclick={(e) => handleEdit(e, 'cost', item.cost)}
						aria-label="Edit cost"
					>
						<i class="fas fa-pencil-alt"></i>
					</button>
				</div>
			</div>
			<div class="metric-item metric-item-right">
				<span class="metric-label">TOTAL VALUE</span>
				<span class="metric-value metric-value-success">{totalValue}</span>
			</div>
		</div>

		<!-- Location -->
		<div class="location-section">
			<i class="fas fa-snowflake location-icon"></i>
			<span class="location-text">{item.storageType || 'N/A'}</span>
			<button
				class="inline-edit-btn"
				onclick={(e) => handleEdit(e, 'storageType', item.storageType)}
				aria-label="Edit storage type"
			>
				<i class="fas fa-pencil-alt"></i>
			</button>
		</div>

		<!-- Tags -->
		<div class="tags-section">
			{#each formatBooths(item.booths) as booth}
				<span class="tag" style="--tag-color: {getBoothStyle(booth).backgroundColor}">
					<span class="tag-dot"></span>
					{booth}
				</span>
			{/each}
			<button
				class="inline-edit-btn"
				onclick={(e) => handleEdit(e, 'booths', item.booths)}
				aria-label="Edit locations"
			>
				<i class="fas fa-pencil-alt"></i>
			</button>
		</div>
	</div>
</article>

<style>
	/* Card Container - Clean light design */
	.inventory-card {
		width: 100%;
		max-width: 28rem;
		background: #ffffff;
		border-radius: 16px;
		box-shadow:
			0 1px 3px 0 rgba(0, 0, 0, 0.1),
			0 1px 2px 0 rgba(0, 0, 0, 0.06);
		border: 1px solid #e5e7eb;
		overflow: hidden;
		transition: box-shadow 0.3s ease;
	}

	.inventory-card:hover {
		box-shadow:
			0 4px 6px -1px rgba(0, 0, 0, 0.1),
			0 2px 4px -1px rgba(0, 0, 0, 0.06);
	}

	/* Header */
	.card-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0px 16px;
		border-bottom: 1px solid oklch(.88 0 0);
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
		color: #9ca3af;
	}

	.item-id {
		font-size: 1.5rem;
		line-height: 1;
		font-weight: 700;
		color: #111827;
		font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
	}

	.card-actions {
		display: flex;
		align-items: center;
	}

	/* Action Buttons */
	.action-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: 6px;
		border: none;
		background: transparent;
		color: oklch(0.45 0 0);
		cursor: pointer;
		transition: all 0.15s ease;
		padding: 0;
	}

	.action-btn i {
		font-size: 0.7rem;
	}

	.action-btn:hover {
		background: #f3f4f6;
		color: #111827;
	}

	.action-delete:hover {
		color: #374151;
	}

	/* Body */
	.card-body {
		padding: 24px;
		display: flex;
		flex-direction: column;
		gap: 20px;
		background: #ffffff;
	}

	/* Quantity Section */
	.quantity-section {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
	}

	.section-label {
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: #9ca3af;
	}

	.quantity-value {
		font-size: 2.25rem;
		line-height: 1;
		font-weight: 700;
		color: #111827;
		font-variant-numeric: tabular-nums;
		font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
	}

	/* Low Stock Alert */
	.low-stock-section {
		padding: 0;
		background: transparent;
		border-radius: 0;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.low-stock-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.low-stock-title {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.warning-icon {
		width: 14px;
		height: 14px;
		color: #f59e0b;
	}

	.low-stock-text {
		font-size: 0.875rem;
		font-weight: 500;
		color: #111827;
	}

	/* Switch Component */
	.switch {
		position: relative;
		display: inline-block;
		width: 44px;
		height: 24px;
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
		background-color: #d1d5db;
		transition: 0.3s;
		border-radius: 24px;
	}

	.slider:before {
		position: absolute;
		content: '';
		height: 18px;
		width: 18px;
		left: 3px;
		bottom: 3px;
		background-color: white;
		transition: 0.3s;
		border-radius: 50%;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
	}

	.switch input:checked + .slider {
		background-color: #111827;
	}

	.switch input:checked + .slider:before {
		transform: translateX(20px);
	}

	/* Threshold Input */
	.low-stock-threshold {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0;
		border: none;
	}

	.threshold-label {
		font-size: 0.75rem;
		font-weight: 400;
		color: #6b7280;
	}

	.threshold-input-group {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.threshold-input {
		width: 70px;
		height: 32px;
		padding: 0 12px;
		font-size: 0.875rem;
		font-weight: 500;
		text-align: center;
		background: #ffffff;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		color: #111827;
		font-variant-numeric: tabular-nums;
		font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
	}

	.threshold-input:focus {
		outline: none;
		border-color: #9ca3af;
	}

	.threshold-unit {
		font-size: 0.75rem;
		color: #6b7280;
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
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: #9ca3af;
	}

	.metric-value-with-edit {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.metric-value {
		font-size: 1.25rem;
		line-height: 1;
		font-weight: 700;
		color: #111827;
		font-variant-numeric: tabular-nums;
		font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
	}

	.metric-value-success {
		color: #10b981;
	}

	.inline-edit-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		border-radius: 4px;
		border: none;
		background: transparent;
		color: #9ca3af;
		cursor: pointer;
		transition: all 0.15s ease;
		padding: 0;
		flex-shrink: 0;
	}

	.inline-edit-btn i {
		font-size: 0.6875rem;
	}

	.inline-edit-btn:hover {
		color: #111827;
		background: #f3f4f6;
	}

	/* Location Section */
	.location-section {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 12px;
		background: #f9fafb;
		border-radius: 8px;
	}

	.location-icon {
		width: 14px;
		height: 14px;
		color: #0ea5e9;
		flex-shrink: 0;
	}

	.location-text {
		font-size: 0.875rem;
		font-weight: 500;
		color: #111827;
		flex: 1;
	}

	/* Tags Section */
	.tags-section {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
	}

	.tag {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 10px;
		background: #f3f4f6;
		border-radius: 6px;
		font-size: 0.75rem;
		font-weight: 500;
		color: #374151;
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
