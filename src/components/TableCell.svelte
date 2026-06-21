<script>
	import {
		formatCost,
		formatTotalValue,
		formatBooths,
		capitalizeWords,
		getStorageTypeStyle,
		getStorageTypeIcon,
		getBoothStyle
	} from '../lib/tableUtils.js';
	import Icon from './Icon.svelte';

	let { type, value, item, onEdit, onDelete, onTooltipShow, onTooltipHide } = $props();

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
			<button
				class="cell-value-btn"
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
				<span>{value}</span>
			</button>
		</div>
	</td>
{:else if type === 'count'}
	<td class="count-col" data-label="Count">
		<div class="cell-content">
			<span class="cell-text">{value}</span>
		</div>
	</td>
{:else if type === 'lowCount'}
	<td class="lowcount-col" data-label="Low Count">
		<div class="cell-content">
			<button
				class="cell-value-btn"
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
				<span>{value != null ? value : ''}</span>
			</button>
		</div>
	</td>
{:else if type === 'cost'}
	<td class="cost-col" data-label="Cost">
		<div class="cell-content">
			<button
				class="cell-value-btn"
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
				<span>{formatCost(value)}</span>
			</button>
		</div>
	</td>
{:else if type === 'totalValue'}
	<td class="totalvalue-col" data-label="Total Value">
		<div class="cell-content">
			<span class="cell-text">{formatTotalValue(item.count, item.cost)}</span>
		</div>
	</td>
{:else if type === 'storageType'}
	<td class="storage-col" data-label="Type">
		<div class="cell-content">
			<button
				class="storage-type-btn"
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
				<span
					class="storage-type inline-flex items-center gap-1.5"
					style="background-color: {getStorageTypeStyle(value)
						.backgroundColor}; color: {getStorageTypeStyle(value).color};"
				>
					{#if value}
						<Icon name={getStorageTypeIcon(value)} size={13} class="shrink-0" />
					{/if}
					{capitalizeWords(value)}
				</span>
			</button>
		</div>
	</td>
{:else if type === 'booths'}
	<td class="booths-col" data-label="Booths">
		<div class="cell-content">
			<div class="booths-container">
				{#each formatBooths(value) as booth (booth)}
					<button
						class="booth-tag-btn"
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
						<span
							class="booth-tag"
							style="background-color: {getBoothStyle(booth)
								.backgroundColor}; color: {getBoothStyle(booth).color};"
						>
							{booth}
						</span>
					</button>
				{/each}
			</div>
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
		padding: 0.3rem 0.5rem;
		text-align: left;
		border-bottom: 0.063rem solid var(--table-border-color);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.85rem;
	}

	.count-col,
	.lowcount-col,
	.cost-col,
	.totalvalue-col {
		overflow: visible !important;
		text-overflow: unset !important;
		white-space: nowrap !important;
		min-width: max-content !important;
	}

	.count-col .cell-text,
	.lowcount-col .cell-content span,
	.cost-col .cell-content span,
	.totalvalue-col .cell-text {
		overflow: visible !important;
		text-overflow: unset !important;
		white-space: nowrap !important;
		flex-shrink: 0 !important;
	}

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

	.booths-col .cell-content {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	/* Cell value button — clickable cell text for inline edit */
	.cell-value-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		background: none;
		border: none;
		padding: 0.125rem 0.25rem;
		margin: -0.125rem -0.25rem;
		border-radius: 0.25rem;
		cursor: pointer;
		color: inherit;
		font: inherit;
		font-size: inherit;
		line-height: inherit;
		min-height: 0;
		transition: background-color 0.15s ease-out;
		flex-shrink: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		width: 100%;
		text-align: left;
	}

	.cell-value-btn:hover {
		background-color: var(--hover-bg-color);
	}

	.cell-value-btn::after {
		content: '\f044';
		font-family: 'Font Awesome 6 Free';
		font-weight: 900;
		font-size: 0.65rem;
		opacity: 0;
		transition: opacity 0.15s ease-out;
		flex-shrink: 0;
		color: var(--icon-color);
	}

	:global(.table-row:hover) .cell-value-btn::after {
		opacity: 0.5;
	}

	:global(.table-row:hover) .cell-value-btn:hover::after {
		opacity: 1;
		color: var(--icon-hover-color);
	}

	/* Storage type — clickable badge */
	.storage-type-btn {
		background: none;
		border: none;
		padding: 0;
		margin: 0;
		cursor: pointer;
		min-height: 0;
		display: inline-block;
	}

	.storage-type {
		padding: 0.2rem 0.6rem;
		border-radius: 9999px;
		font-size: 0.75rem;
		font-weight: 600;
		box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.1);
		border: 0.063rem solid rgba(0, 0, 0, 0.1);
		transition:
			transform 0.1s ease-out,
			filter 0.15s ease-out;
		white-space: nowrap;
		width: fit-content;
		text-align: center;
		will-change: transform;
		transform: translateZ(0);
	}

	.storage-type-btn:hover .storage-type {
		filter: brightness(1.15);
		transform: scale(1.05);
	}

	/* Booth tags — clickable pills */
	.booths-container {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		align-items: baseline;
		flex: 1;
		min-width: 0;
	}

	.booth-tag-btn {
		background: none;
		border: none;
		padding: 0;
		margin: 0;
		cursor: pointer;
		min-height: 0;
		display: inline-block;
		transition: transform 0.1s ease-out;
	}

	.booth-tag-btn:hover {
		transform: scale(1.08);
	}

	.booth-tag {
		padding: 0.15rem 0.45rem;
		border-radius: 9999px;
		font-size: 0.7rem;
		font-weight: 600;
		white-space: nowrap;
		display: inline-block;
		box-shadow: 0 0.063rem 0.125rem rgba(0, 0, 0, 0.1);
		border: 0.063rem solid rgba(0, 0, 0, 0.1);
		text-align: center;
		line-height: 1.2;
		width: fit-content;
		flex-shrink: 0;
		flex-grow: 0;
		flex-basis: auto;
		transition: filter 0.15s ease-out;
	}

	.booth-tag-btn:hover .booth-tag {
		filter: brightness(1.15);
	}

	/* Delete button */
	.delete-button {
		background: none;
		border: none;
		cursor: pointer;
		opacity: 0;
		transition:
			opacity 0.15s ease-out,
			transform 0.1s ease-out;
		will-change: opacity, transform;
		flex-shrink: 0;
		padding: 0.25rem;
		font-size: 0.8rem;
		background-color: transparent;
		color: darkred;
		min-height: 0;
	}

	:global(.table-row:hover) .delete-button {
		opacity: 1;
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

		.booths-col .booth-tag-btn {
			flex: 0 0 auto;
		}

		.booths-col .booth-tag {
			flex: 0 0 auto;
			min-width: auto;
		}

		td::before {
			content: attr(data-label) ': ';
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
			opacity: 1;
			min-height: 0;
		}

		.action-col .delete-button:hover {
			color: #ff0000;
			background-color: rgba(255, 68, 68, 0.2);
			transform: none;
		}

		.cell-value-btn,
		.delete-button {
			opacity: 1;
			font-size: 0.9rem;
			padding: 0.3rem;
			flex-shrink: 0;
		}

		.cell-value-btn::after {
			opacity: 0.5;
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
