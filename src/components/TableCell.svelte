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

	function handleEdit(field, currentValue) {
		onEdit(item.id, field, currentValue);
	}

	function handleDelete() {
		onDelete(item.id, item.name);
	}
</script>

{#if type === 'name'}
	<td class="name-col" data-label="Name">
		<div class="cell-content">
			<span>{value}</span>
			<button
				class="icon-button"
				data-tooltip="Edit Name"
				aria-label="Edit Name"
				onclick={(e) => {
					e.preventDefault();
					e.stopPropagation();
					handleEdit('name', value);
				}}
				onmouseenter={onTooltipShow}
				onmouseleave={onTooltipHide}
			>
				<i class="fas fa-edit"></i>
			</button>
		</div>
	</td>
{:else if type === 'count'}
	<td class="count-col" data-label="Count">
		<div class="cell-content">
			<span>{value}</span>
			<button class="icon-button" style="opacity: 0; pointer-events: none;" aria-hidden="true">
				<i class="fas fa-edit"></i>
			</button>
		</div>
	</td>
{:else if type === 'lowCount'}
	<td class="lowcount-col" data-label="Low Count">
		<div class="cell-content">
			<span>{value != null ? value : ''}</span>
			<button
				class="icon-button"
				data-tooltip="Edit Low Count"
				aria-label="Edit Low Count"
				onclick={(e) => {
					e.preventDefault();
					e.stopPropagation();
					handleEdit('lowCount', value);
				}}
				onmouseenter={onTooltipShow}
				onmouseleave={onTooltipHide}
			>
				<i class="fas fa-edit"></i>
			</button>
		</div>
	</td>
{:else if type === 'cost'}
	<td class="cost-col" data-label="Cost">
		<div class="cell-content">
			<span>{formatCost(value)}</span>
			<button
				class="icon-button"
				data-tooltip="Edit Cost"
				aria-label="Edit Cost"
				onclick={(e) => {
					e.preventDefault();
					e.stopPropagation();
					handleEdit('cost', value);
				}}
				onmouseenter={onTooltipShow}
				onmouseleave={onTooltipHide}
			>
				<i class="fas fa-edit"></i>
			</button>
		</div>
	</td>
{:else if type === 'totalValue'}
	<td class="totalvalue-col" data-label="Total Value">
		<div class="cell-content">
			<span>{formatTotalValue(item.count, item.cost)}</span>
			<button class="icon-button" style="opacity: 0; pointer-events: none;" aria-hidden="true">
				<i class="fas fa-edit"></i>
			</button>
		</div>
	</td>
{:else if type === 'storageType'}
	<td class="storage-col" data-label="Type">
		<div class="cell-content">
			<span
				class="storage-type"
				style="background-color: {getStorageTypeStyle(value).backgroundColor}; color: {getStorageTypeStyle(value).color};"
			>
				{capitalizeWords(value)}
			</span>
			<button
				class="icon-button"
				data-tooltip="Edit Storage Type"
				aria-label="Edit Storage Type"
				onclick={(e) => {
					e.preventDefault();
					e.stopPropagation();
					handleEdit('storageType', value);
				}}
				onmouseenter={onTooltipShow}
				onmouseleave={onTooltipHide}
			>
				<i class="fas fa-edit"></i>
			</button>
		</div>
	</td>
{:else if type === 'booths'}
	<td class="booths-col" data-label="Booths">
		<div class="cell-content">
			<div class="booths-container">
				{#each formatBooths(value) as booth}
					<span
						class="booth-tag"
						style="background-color: {getBoothStyle(booth).backgroundColor}; color: {getBoothStyle(booth).color};"
					>
						{booth}
					</span>
				{/each}
			</div>
			<button
				class="icon-button"
				style="margin-left: auto;"
				data-tooltip="Edit Booths"
				aria-label="Edit Booths"
				onclick={(e) => {
					e.preventDefault();
					e.stopPropagation();
					handleEdit('booths', value);
				}}
				onmouseenter={onTooltipShow}
				onmouseleave={onTooltipHide}
			>
				<i class="fas fa-edit"></i>
			</button>
		</div>
	</td>
{:else if type === 'action'}
	<td class="action-col" data-label="">
		<button
			class="delete-button"
			data-tooltip="Delete Item"
			aria-label="Delete Item"
			onclick={handleDelete}
			onmouseenter={onTooltipShow}
			onmouseleave={onTooltipHide}
		>
			<i class="fas fa-trash-alt"></i>
		</button>
	</td>
{/if}

<style>
	td {
		padding: 0.5rem;
		text-align: left;
		border-bottom: 0.063rem solid var(--table-border-color);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* Prevent truncation for numeric columns */
	.count-col,
	.lowcount-col,
	.cost-col,
	.totalvalue-col {
		overflow: visible !important;
		text-overflow: unset !important;
		white-space: nowrap !important;
		min-width: max-content !important;
	}

	.count-col .cell-content span,
	.lowcount-col .cell-content span,
	.cost-col .cell-content span,
	.totalvalue-col .cell-content span {
		overflow: visible !important;
		text-overflow: unset !important;
		white-space: nowrap !important;
		flex-shrink: 0 !important;
	}

	/* Allow booths column to wrap */
	.booths-col {
		white-space: normal !important;
		overflow: visible;
		text-overflow: unset;
		vertical-align: top;
		min-width: 0;
	}

	.booths-col .cell-content {
		white-space: normal;
		overflow: visible;
		min-width: 0;
		width: 100%;
	}

	.cell-content {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-grow: 1;
		min-width: 0;
	}

	.cell-content span {
		flex-grow: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}

	/* Special layout for booths column */
	.booths-col .cell-content {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.icon-button,
	.delete-button {
		background: none;
		border: none;
		cursor: pointer;
		opacity: 0;
		transition: opacity 0.15s ease, transform 0.1s ease;
		will-change: opacity, transform;
		flex-shrink: 0;
		padding: 0.25rem;
		font-size: 0.8rem;
	}

	.delete-button {
		padding: 0.25rem;
		font-size: 0.8rem;
	}

	:global(.table-row:hover) .icon-button,
	:global(.table-row:hover) .delete-button {
		opacity: 1;
	}

	.icon-button:hover {
		color: var(--icon-hover-color);
		transform: scale(1.2);
	}

	.delete-button {
		color: darkred;
	}

	.delete-button:hover {
		color: #ff0000;
		transform: scale(1.2);
	}

	.action-col {
		position: static;
		background-color: transparent;
		overflow: hidden;
		text-align: center;
	}

	.storage-type {
		padding: 0.375rem 0.75rem;
		border-radius: 1.25rem;
		font-size: 0.875rem;
		font-weight: 600;
		background-color: #f8f9fa;
		color: #333;
		box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.1);
		border: 0.063rem solid rgba(0, 0, 0, 0.1);
		transition: transform 0.1s ease;
		white-space: nowrap;
		display: inline-block;
		width: fit-content;
		text-align: center;
		will-change: transform;
		transform: translateZ(0);
	}

	.booths-container {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		align-items: baseline;
		flex: 1;
		min-width: 0;
	}

	.booth-tag {
		padding: 0.25rem 0.5rem;
		border-radius: 0.75rem;
		font-size: 0.75rem;
		font-weight: 600;
		white-space: nowrap;
		display: inline-block;
		box-shadow: 0 0.063rem 0.125rem rgba(0, 0, 0, 0.1);
		border: 0.063rem solid rgba(0, 0, 0, 0.1);
		transition: transform 0.1s ease;
		text-align: center;
		line-height: 1.2;
		width: fit-content;
		flex-shrink: 0;
		flex-grow: 0;
		flex-basis: auto;
	}

	.booth-tag:hover {
		transform: scale(1.05);
	}

	/* Mobile responsiveness */
	@media (max-width: 48rem) {
		.booths-container {
			gap: 0.3rem;
		}

		.booth-tag {
			font-size: 0.7rem;
			padding: 0.3rem 0.5rem;
			border-radius: 0.5rem;
		}

		.booths-col .cell-content {
			align-items: flex-start;
			gap: 0.5rem;
		}

		td:not(.action-col) {
			display: grid;
			grid-template-columns: 5rem 1fr 2.5rem;
			align-items: center;
			gap: 0.5rem;
			padding: 0.25rem 0;
			border: none;
			border-bottom: 0.063rem solid rgba(255, 255, 255, 0.1);
			font-size: 0.9rem;
		}

		.booths-col .cell-content {
			grid-column: 2 / 4;
			display: flex;
			align-items: center;
			gap: 0.5rem;
			flex-wrap: wrap;
		}

		.booths-col .booths-container {
			display: flex;
			flex-wrap: wrap;
			gap: 0.25rem;
			flex: 1;
			align-items: center;
		}

		.booths-col .icon-button {
			margin: 0;
			margin-left: auto;
			align-self: center;
		}

		.booths-col .booth-tag {
			flex: 0 0 auto;
			min-width: auto;
		}

		td::before {
			content: attr(data-label) ": ";
			font-weight: bold;
			color: var(--text-color);
			grid-column: 1;
		}

		.cell-content {
			grid-column: 2 / 4;
			display: flex;
			justify-content: space-between;
			align-items: center;
			gap: 0.5rem;
			padding-right: 0;
			flex-wrap: wrap;
		}

		.cell-content span {
			text-align: center;
			flex: 1;
		}

		.action-col {
			display: flex;
			justify-content: center;
			align-items: center;
			padding: 0.75rem 0;
			width: 100%;
		}

		.action-col::before {
			display: none;
		}

		.action-col .delete-button {
			font-size: 1.2rem;
			padding: 0.75rem 1.5rem;
			color: #ff4444;
			background-color: rgba(255, 68, 68, 0.1);
			border-radius: 0.5rem;
			transition: all 0.2s ease;
			width: auto;
			max-width: 150px;
			display: flex;
			justify-content: center;
			align-items: center;
		}

		.action-col .delete-button:hover {
			color: #ff0000;
			background-color: rgba(255, 68, 68, 0.2);
			transform: none;
		}

		.icon-button,
		.delete-button {
			opacity: 1;
			font-size: 0.9rem;
			padding: 0.3rem;
			margin-left: 0.5rem;
			flex-shrink: 0;
		}

		.storage-type {
			font-size: clamp(0.7rem, 3vw, 0.8rem);
			padding: 0.25rem 0.5rem;
			border-radius: 1rem;
		}
	}

	@media (max-width: 30rem) {
		.booths-container {
			gap: 0.25rem;
		}

		.booth-tag {
			font-size: 0.65rem;
			padding: 0.25rem 0.4rem;
			border-radius: 0.375rem;
		}
	}
</style>
