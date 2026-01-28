<script>
	import { blur } from 'svelte/transition';
	import {
		capitalizeWords,
		formatCost,
		formatTotalValue,
		formatBooths,
		getStorageTypeStyle,
		getBoothStyle
	} from '../lib/tableUtils.js';

	let {
		type,
		value,
		item,
		onEdit,
		onDelete,
		onTooltipShow,
		onTooltipHide
	} = $props();

	function handleEdit(event, field, currentValue) {
		const button = event.currentTarget;
		const rect = button.getBoundingClientRect();
		
		// Use viewport coordinates for fixed positioning
		const position = {
			x: rect.left + rect.width / 2,
			y: rect.top + rect.height / 2
		};
		
		onEdit(item.id, field, currentValue, position);
	}

	function handleDelete(event) {
		const button = event.currentTarget;
		const rect = button.getBoundingClientRect();
		
		// Use viewport coordinates for fixed positioning
		const position = {
			x: rect.left + rect.width / 2,
			y: rect.top + rect.height / 2
		};
		
		onDelete(item.id, item.name, position);
	}
</script>

{#if type === 'name'}
	<td class="name-col" data-label="Name">
		<div class="cell-content">
			{#key value}
				<span class="name-text no-wrap" in:blur={{ duration: 400, amount: 2 }}>{value}</span>
			{/key}
			<button
				class="action-btn edit-tiny"
				onclick={(e) => {
					e.preventDefault();
					e.stopPropagation();
					handleEdit(e, 'name', value);
				}}
				onmouseenter={onTooltipShow}
				onmouseleave={onTooltipHide}
				data-tooltip="Edit Name"
			>
				<i class="fas fa-edit"></i>
			</button>
		</div>
	</td>
{:else if type === 'count'}
	<td class="count-col" data-label="Count">
		<span class="mobile-label">QTY</span>
		<div class="cell-content justify-center">
			{#key value}
				<span class="count-badge result" in:blur={{ duration: 400, amount: 2 }}>{value}</span>
			{/key}
		</div>
	</td>
{:else if type === 'lowCount'}
	<td class="lowcount-col" data-label="Low Count">
		<span class="mobile-label">MIN</span>
		<div class="cell-content justify-center">
			{#key value}
				<span class="count-badge low-count-text" in:blur={{ duration: 400, amount: 2 }}>{value != null ? value : ''}</span>
			{/key}
			<button
				class="action-btn edit-tiny"
				onclick={(e) => {
					e.preventDefault();
					e.stopPropagation();
					handleEdit(e, 'lowCount', value);
				}}
				onmouseenter={onTooltipShow}
				onmouseleave={onTooltipHide}
				data-tooltip="Edit Threshold"
			>
				<i class="fas fa-edit"></i>
			</button>
		</div>
	</td>
{:else if type === 'cost'}
	<td class="cost-col" data-label="Cost">
		<span class="mobile-label">UNIT</span>
		<div class="cell-content justify-center">
			{#key value}
				<span class="value-text no-wrap" in:blur={{ duration: 400, amount: 2 }}>{formatCost(value)}</span>
			{/key}
			<button
				class="action-btn edit-tiny"
				onclick={(e) => {
					e.preventDefault();
					e.stopPropagation();
					handleEdit(e, 'cost', value);
				}}
				onmouseenter={onTooltipShow}
				onmouseleave={onTooltipHide}
				data-tooltip="Edit Cost"
			>
				<i class="fas fa-edit"></i>
			</button>
		</div>
	</td>
{:else if type === 'totalValue'}
	<td class="totalvalue-col" data-label="Total Value">
		<span class="mobile-label">TOTAL</span>
		<div class="cell-content justify-center">
			{#key formatTotalValue(item.count, item.cost)}
				<span class="value-text accent no-wrap" in:blur={{ duration: 400, amount: 2 }}>
					{formatTotalValue(item.count, item.cost)}
				</span>
			{/key}
		</div>
	</td>
{:else if type === 'storageType'}
	<td class="storage-col" data-label="Type">
		<span class="mobile-label">TYPE</span>
		<div class="cell-content">
			<span
				class="storage-mini-tag"
				style="--type-color: {getStorageTypeStyle(value).backgroundColor}"
			>
				{capitalizeWords(value)}
			</span>
			<button
				class="action-btn edit-tiny"
				onclick={(e) => {
					e.preventDefault();
					e.stopPropagation();
					handleEdit(e, 'storageType', value);
				}}
				onmouseenter={onTooltipShow}
				onmouseleave={onTooltipHide}
				data-tooltip="Edit Storage"
			>
				<i class="fas fa-edit"></i>
			</button>
		</div>
	</td>
{:else if type === 'booths'}
	<td class="booths-col" data-label="Booths">
		<span class="mobile-label">LOCATIONS</span>
		<div class="cell-content">
			<div class="booth-tags-wrapper">
				{#each formatBooths(value) as booth}
					<span
						class="booth-node-tag"
						style="--node-color: {getBoothStyle(booth).backgroundColor}"
					>
						{booth}
					</span>
				{/each}
			</div>
			<button
				class="action-btn edit-tiny"
				onclick={(e) => {
					e.preventDefault();
					e.stopPropagation();
					handleEdit(e, 'booths', value);
				}}
				onmouseenter={onTooltipShow}
				onmouseleave={onTooltipHide}
				data-tooltip="Edit Booths"
			>
				<i class="fas fa-edit"></i>
			</button>
		</div>
	</td>
{:else if type === 'action'}
	<td class="action-col" data-label="">
		<div class="cell-content justify-center">
			<button
				class="action-btn delete-tiny"
				onclick={handleDelete}
				onmouseenter={onTooltipShow}
				onmouseleave={onTooltipHide}
				data-tooltip="Delete"
			>
				<i class="fas fa-trash-alt"></i>
			</button>
		</div>
	</td>
{/if}

<style>
	td {
		padding: 0.75rem 1rem;
		vertical-align: middle;
		border-bottom: 1px solid var(--tech-cell-border);
		color: var(--tech-cell-text);
		font-size: 0.85rem;
	}

	.mobile-label {
		display: none;
	}

	.cell-content {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
	}

	.justify-center {
		justify-content: center;
	}

	.no-wrap {
		white-space: nowrap;
	}

	.name-text {
		font-weight: 700;
		color: var(--tech-value);
		font-size: 0.9rem;
	}

	.count-badge {
		font-family: 'JetBrains Mono', monospace;
		display: inline-block;
		min-width: 32px;
		text-align: center;
		font-weight: 700;
	}

	.count-badge.result {
		color: var(--tech-accent);
		text-shadow: 0 0 8px var(--tech-accent-muted);
		font-weight: 800;
		font-size: 0.95rem;
	}

	.low-count-text {
		color: var(--tech-label);
		opacity: 0.8;
	}

	.value-text {
		font-family: 'JetBrains Mono', monospace;
		font-weight: 700;
		color: var(--tech-value);
		font-size: 0.85rem;
	}

	.value-text.accent {
		color: var(--tech-accent);
	}

	.storage-mini-tag {
		padding: 0.15rem 0.6rem;
		border-radius: 3px;
		font-size: 0.65rem;
		font-weight: 800;
		text-transform: uppercase;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid var(--tech-glass-border);
		color: var(--tech-label);
		display: flex;
		align-items: center;
		gap: 0.5rem;
		white-space: nowrap;
	}

	.storage-mini-tag::before {
		content: '';
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--type-color);
	}

	.booth-tags-wrapper {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
		flex: 1;
	}

	.booth-node-tag {
		padding: 0.15rem 0.5rem;
		border-radius: 2px;
		font-size: 0.6rem;
		font-weight: 900;
		text-transform: uppercase;
		background: var(--tech-badge-bg);
		border-left: 2px solid var(--node-color);
		color: var(--tech-label);
		white-space: nowrap;
		letter-spacing: 0.02em;
	}

	/* Compact Buttons */
	.action-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		border: 1px solid transparent;
		transition: all 0.2s;
		cursor: pointer;
		background: transparent;
		color: var(--tech-label);
		opacity: 0;
		padding: 0;
		flex-shrink: 0;
		min-width: 0;
		min-height: 0;
	}
	
	.action-btn i {
		line-height: 1;
		display: block;
	}

	.edit-tiny {
		width: 24px;
		height: 24px;
		font-size: 0.65rem;
	}

	.delete-tiny {
		width: 28px;
		height: 28px;
		font-size: 0.75rem;
	}

	:global(.table-row:hover) .action-btn {
		opacity: 0.6;
	}

	.action-btn:hover {
		opacity: 1 !important;
		background: var(--tech-badge-bg);
		color: var(--tech-value);
	}

	.edit-tiny:hover {
		color: var(--tech-accent);
		border-color: var(--tech-accent-muted);
	}

	.delete-tiny:hover {
		color: #ef4444;
		border-color: rgba(239, 68, 68, 0.2);
	}

	/* Responsive - Mobile Grid Layout */
	@media (max-width: 768px) {
		td {
			display: flex;
			flex-direction: column;
			align-items: flex-start;
			width: 100%;
			padding: 0;
			border: none;
			gap: 0.1rem;
		}

		.mobile-label {
			display: block;
			font-size: 0.65rem;
			color: var(--tech-label);
			opacity: 0.5;
			font-weight: 700;
			letter-spacing: 0.05em;
			text-transform: uppercase;
			margin-bottom: 0.2rem;
		}

		.cell-content {
			display: flex;
			flex-direction: row;
			align-items: center;
			justify-content: flex-start;
			width: 100%;
			gap: 0.5rem;
		}

		.cell-content.justify-center {
			justify-content: flex-start;
		}

		/* Name section - prominent header */
		td.name-col {
			flex-direction: row;
			justify-content: flex-start;
			align-items: center;
			gap: 0.5rem;
		}

		.name-text {
			font-size: 1.2rem;
			color: var(--tech-value);
			font-weight: 800;
			letter-spacing: -0.02em;
		}

		/* Count styling */
		.count-badge.result {
			font-size: 1.2rem;
			color: var(--tech-accent);
			font-weight: 800;
		}

		.low-count-text {
			font-size: 1.1rem;
			color: var(--tech-value);
			font-weight: 600;
		}

		/* Value styling */
		.value-text {
			font-size: 1.1rem;
			font-weight: 700;
		}

		.value-text.accent {
			color: var(--tech-accent);
		}

		/* Storage type */
		.storage-mini-tag {
			font-size: 0.7rem;
			padding: 0.25rem 0.6rem;
			background: rgba(255, 255, 255, 0.06);
		}

		/* Booths */
		.booth-tags-wrapper {
			justify-content: flex-end;
			gap: 0.3rem;
		}

		.booth-node-tag {
			font-size: 0.65rem;
			padding: 0.2rem 0.5rem;
		}

		/* Action column - top right delete button */
		td.action-col {
			align-items: flex-end;
		}

		td.action-col .cell-content {
			justify-content: flex-end;
			width: auto;
		}

		.action-btn {
			opacity: 1;
			width: 32px;
			height: 32px;
			font-size: 0.9rem;
			background: transparent;
			border: none;
			color: var(--tech-label);
		}

		.edit-tiny {
			opacity: 0.3;
			width: 24px;
			height: 24px;
			font-size: 0.8rem;
		}
		
		.edit-tiny:active {
			opacity: 1;
			color: var(--tech-accent);
		}

		.delete-tiny {
			color: #ef4444;
			border: 1px solid rgba(239, 68, 68, 0.2);
			background: rgba(239, 68, 68, 0.1);
			width: 32px;
			height: 32px;
			border-radius: 6px;
			transition: all 0.2s ease;
		}

		.delete-tiny:active {
			background: rgba(239, 68, 68, 0.3);
			transform: scale(0.95);
		}
	}
</style>
