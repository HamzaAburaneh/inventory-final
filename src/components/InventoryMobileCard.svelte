<script>
	import { blur } from 'svelte/transition';
	import {
		formatCost,
		formatTotalValue,
		formatBooths,
		getStorageTypeStyle,
		getBoothStyle
	} from '../lib/tableUtils.js';

	let {
		item,
		onEdit,
		onDelete,
		onTooltipShow,
		onTooltipHide
	} = $props();

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
	<!-- Header: Item Name + Actions -->
	<header class="card-header">
		<div class="item-name-container">
			<h3 class="item-name">{item.name}</h3>
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
				<i class="fas fa-edit"></i>
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

	<!-- Body: 2-Column Grid for Metrics -->
	<div class="card-body">
		<!-- Quantity -->
		<div class="metric-cell">
			<span class="metric-label">Quantity</span>
			<div class="metric-value-row">
				<span class="metric-value">{item.count}</span>
			</div>
		</div>

		<!-- Total Value -->
		<div class="metric-cell">
			<span class="metric-label">Total Value</span>
			<div class="metric-value-row">
				<span class="metric-value">{totalValue}</span>
			</div>
		</div>

		<!-- Unit Cost -->
		<div class="metric-cell">
			<span class="metric-label">Unit Cost</span>
			<div class="metric-value-row">
				<span class="metric-value">{formatCost(item.cost)}</span>
				<button
					class="metric-edit-btn"
					onclick={(e) => handleEdit(e, 'cost', item.cost)}
					aria-label="Edit cost"
				>
					<i class="fas fa-edit"></i>
				</button>
			</div>
		</div>

		<!-- Low Count Threshold -->
		<div class="metric-cell">
			<span class="metric-label">Min Threshold</span>
			<div class="metric-value-row">
				<span class="metric-value">{item.lowCount ?? 0}</span>
				<button
					class="metric-edit-btn"
					onclick={(e) => handleEdit(e, 'lowCount', item.lowCount)}
					aria-label="Edit threshold"
				>
					<i class="fas fa-edit"></i>
				</button>
			</div>
		</div>
	</div>

	<!-- Footer: Tags (Storage Type + Locations) -->
	<footer class="card-footer">
		<div class="footer-section">
			<div class="storage-tag" style="--storage-color: {getStorageTypeStyle(item.storageType).backgroundColor}">
				<span class="storage-indicator"></span>
				<span class="storage-text">{item.storageType || 'N/A'}</span>
			</div>
			<button
				class="footer-edit-btn"
				onclick={(e) => handleEdit(e, 'storageType', item.storageType)}
				aria-label="Edit storage type"
			>
				<i class="fas fa-edit"></i>
			</button>
		</div>

		<div class="footer-section">
			<div class="location-tags">
				{#each formatBooths(item.booths) as booth}
					<span class="location-tag" style="--location-color: {getBoothStyle(booth).backgroundColor}">
						{booth}
					</span>
				{/each}
			</div>
			<button
				class="footer-edit-btn"
				onclick={(e) => handleEdit(e, 'booths', item.booths)}
				aria-label="Edit locations"
			>
				<i class="fas fa-edit"></i>
			</button>
		</div>
	</footer>
</article>

<style>
	/* CSS Variables for Consistency */
	.inventory-card {
		--card-spacing: 12px;
		--card-radius: 12px;
		--grid-gap: 8px;
		--label-size: 0.65rem;
		--value-size: 1.25rem;
		--meta-size: 0.7rem;
	}

	/* Card Container */
	.inventory-card {
		display: flex;
		flex-direction: column;
		gap: var(--card-spacing);
		padding: var(--card-spacing);
		background: rgba(0, 0, 0, 0.3);
		border: 1px solid rgba(255, 255, 255, 0.05);
		border-radius: var(--card-radius);
		box-shadow:
			0 4px 20px rgba(0, 0, 0, 0.4),
			inset 0 1px 0 rgba(255, 255, 255, 0.02);
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		position: relative;
		overflow: hidden;
	}


	.inventory-card:active {
		transform: scale(0.99);
	}

	/* Header: Item Name + Actions */
	.card-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
		padding-bottom: 12px;
		border-bottom: 1px solid rgba(255, 255, 255, 0.04);
	}

	.item-name-container {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 10px 16px;
		background: rgba(255, 226, 96, 0.08);
		border: 1px solid rgba(255, 226, 96, 0.2);
		border-radius: 8px;
		min-height: 44px;
	}

	.item-name {
		margin: 0;
		font-family: 'JetBrains Mono', monospace;
		font-size: 1.1rem;
		font-weight: 700;
		color: var(--tech-accent);
		letter-spacing: 0.02em;
		line-height: 1.3;
		text-align: center;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.card-actions {
		display: flex;
		gap: 4px;
		flex-shrink: 0;
	}

	.action-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		border-radius: 8px;
		border: none;
		background: rgba(255, 255, 255, 0.05);
		color: var(--tech-value);
		cursor: pointer;
		transition: all 0.2s ease;
		padding: 0;
	}

	.action-btn i {
		font-size: 0.9rem;
	}

	.action-btn:hover {
		background: rgba(255, 255, 255, 0.1);
	}

	.action-btn:active {
		background: rgba(255, 255, 255, 0.15);
		transform: scale(0.95);
	}

	.action-delete {
		background: rgba(239, 68, 68, 0.15);
		color: #ef4444;
	}

	.action-delete:hover {
		background: rgba(239, 68, 68, 0.25);
	}

	.action-delete:active {
		background: rgba(239, 68, 68, 0.35);
		transform: scale(0.95);
	}

	/* Body: 2-Column Grid */
	.card-body {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--grid-gap);
	}

	.metric-cell {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 12px;
		background: rgba(0, 0, 0, 0.2);
		border: 1px solid rgba(255, 255, 255, 0.03);
		border-radius: 8px;
		transition: background 0.2s ease;
	}

	.metric-cell:active {
		background: rgba(0, 0, 0, 0.3);
	}

	.metric-label {
		font-size: var(--label-size);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--tech-label);
		opacity: 0.6;
	}

	.metric-value-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}

	.metric-value {
		font-family: 'JetBrains Mono', monospace;
		font-size: var(--value-size);
		font-weight: 700;
		color: var(--tech-value);
		line-height: 1;
	}


	.metric-edit-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: 6px;
		border: none;
		background: transparent;
		color: var(--tech-label);
		opacity: 0.5;
		cursor: pointer;
		transition: all 0.2s ease;
		padding: 0;
		flex-shrink: 0;
	}

	.metric-edit-btn i {
		font-size: 0.75rem;
	}

	.metric-edit-btn:hover {
		opacity: 0.8;
		background: rgba(255, 255, 255, 0.05);
		color: var(--tech-value);
	}

	.metric-edit-btn:active {
		opacity: 1;
		background: rgba(255, 255, 255, 0.1);
		color: var(--tech-value);
		transform: scale(0.92);
	}

	/* Footer: Tags */
	.card-footer {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding-top: 0;
	}

	.footer-section {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}

	.storage-tag {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 10px;
		background: rgba(0, 0, 0, 0.2);
		border: 1px solid rgba(255, 255, 255, 0.04);
		border-radius: 6px;
		flex: 1;
		min-width: 0;
	}

	.storage-indicator {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--storage-color);
		flex-shrink: 0;
	}

	.storage-text {
		font-size: var(--meta-size);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--tech-label);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.location-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		flex: 1;
		min-width: 0;
	}

	.location-tag {
		padding: 4px 8px;
		border-radius: 4px;
		font-size: 0.65rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		background: rgba(0, 0, 0, 0.3);
		border-left: 3px solid var(--location-color);
		color: var(--tech-label);
		white-space: nowrap;
	}

	.footer-edit-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: 6px;
		border: none;
		background: transparent;
		color: var(--tech-label);
		opacity: 0.5;
		cursor: pointer;
		transition: all 0.2s ease;
		padding: 0;
		flex-shrink: 0;
	}

	.footer-edit-btn i {
		font-size: 0.7rem;
	}

	.footer-edit-btn:hover {
		opacity: 0.8;
		background: rgba(255, 255, 255, 0.05);
		color: var(--tech-value);
	}

	.footer-edit-btn:active {
		opacity: 1;
		background: rgba(255, 255, 255, 0.1);
		color: var(--tech-value);
		transform: scale(0.92);
	}

	/* Responsive Adjustments */
	@media (max-width: 360px) {
		.inventory-card {
			--value-size: 1.1rem;
			--label-size: 0.6rem;
		}

		.item-name {
			font-size: 1rem;
		}

		.item-name-container {
			padding: 8px 12px;
			min-height: 40px;
		}

		.action-btn {
			width: 40px;
			height: 40px;
		}

		.action-btn {
			width: 40px;
			height: 40px;
		}
	}

	@media (min-width: 480px) {
		.inventory-card {
			--card-spacing: 16px;
		}

		.card-body {
			gap: 12px;
		}

		.metric-cell {
			padding: 16px;
		}
	}
</style>
