<script>
	import { 
		formatCost, 
		formatTotalValue, 
		formatBooths, 
		capitalizeWords,
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
		const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
		const scrollY = window.pageYOffset || document.documentElement.scrollTop;
		
		const position = {
			x: rect.left + scrollX + rect.width / 2,
			y: rect.top + scrollY + rect.height / 2
		};
		
		onEdit(item.id, field, currentValue, position);
	}

	function handleDelete(event) {
		const button = event.currentTarget;
		const rect = button.getBoundingClientRect();
		const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
		const scrollY = window.pageYOffset || document.documentElement.scrollTop;
		
		const position = {
			x: rect.left + scrollX + rect.width / 2,
			y: rect.top + scrollY + rect.height / 2
		};
		
		onDelete(item.id, item.name, position);
	}
</script>

{#if type === 'name'}
	<td class="name-col" data-label="Name">
		<div class="cell-content">
			<span class="name-text no-wrap">{value}</span>
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
		<div class="cell-content justify-center">
			<span class="count-badge result">{value}</span>
		</div>
	</td>
{:else if type === 'lowCount'}
	<td class="lowcount-col" data-label="Low Count">
		<div class="cell-content justify-center">
			<span class="count-badge low-count-text">{value != null ? value : ''}</span>
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
		<div class="cell-content justify-center">
			<span class="value-text no-wrap">{formatCost(value)}</span>
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
		<div class="cell-content justify-center">
			<span class="value-text accent no-wrap">{formatTotalValue(item.count, item.cost)}</span>
		</div>
	</td>
{:else if type === 'storageType'}
	<td class="storage-col" data-label="Type">
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
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		border: 1px solid transparent;
		transition: all 0.2s;
		cursor: pointer;
		background: transparent;
		color: var(--tech-label);
		opacity: 0;
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

	/* Responsive */
	@media (max-width: 768px) {
		td {
			display: flex;
			justify-content: space-between;
			padding: 0.75rem 1rem;
		}

		td::before {
			content: attr(data-label);
			font-family: 'JetBrains Mono', monospace;
			font-size: 0.65rem;
			font-weight: 800;
			color: var(--tech-label);
			text-transform: uppercase;
		}

		.action-btn { opacity: 1; }
	}
</style>
