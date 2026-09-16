<script>
	import {
		formatCost,
		formatTotalValue,
		formatBooths,
		getBoothStyle,
		isLowStock
	} from '../lib/tableUtils.js';
	import Icon from './Icon.svelte';
	import StockLocationChips from './StockLocationChips.svelte';

	let {
		type,
		value,
		item,
		boothsById = {},
		onEdit,
		onDelete,
		onTooltipShow,
		onTooltipHide
	} = $props();

	const low = $derived(isLowStock(item));
	const totalIsZero = $derived((parseFloat(item.count) || 0) * (parseFloat(item.cost) || 0) === 0);

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
			{#if low}
				<!-- The pill carried a data-tooltip with nothing wired to it, so the
				     only thing that ever showed was the unthemed native `title`. -->
				<span
					class="low-pill"
					role="note"
					data-tooltip="At or below low-stock level"
					onmouseenter={onTooltipShow}
					onmouseleave={onTooltipHide}
				>
					<Icon name="alert" size={11} />
					Low
				</span>
			{/if}
		</div>
	</td>
{:else if type === 'count'}
	<td class="count-col" data-label="Count">
		<div class="cell-content">
			<span class="cell-text" class:is-zero={(parseFloat(value) || 0) === 0}>{value}</span>
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
				<span class:is-zero={!value || (parseFloat(value) || 0) === 0}>
					{value != null ? value : ''}
				</span>
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
				<span class:is-zero={!value || (parseFloat(value) || 0) === 0}>{formatCost(value)}</span>
			</button>
		</div>
	</td>
{:else if type === 'totalValue'}
	<td class="totalvalue-col" data-label="Total Value">
		<div class="cell-content">
			<span class="cell-text" class:is-zero={totalIsZero}
				>{formatTotalValue(item.count, item.cost)}</span
			>
		</div>
	</td>
{:else if type === 'stockByStorage'}
	<td class="storage-col" data-label="Stock Locations"><StockLocationChips {item} /></td>
{:else if type === 'booths'}
	<td class="booths-col" data-label="Booths">
		<div class="cell-content">
			<div class="booths-container">
				{#each value || [] as boothId (boothId)}
					{@const style = getBoothStyle(boothId, boothsById)}
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
							style="background-color: {style.backgroundColor}; color: {style.color};"
						>
							{formatBooths([boothId], boothsById)[0]}
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
			<svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<polyline points="3 6 5 6 21 6"></polyline>
				<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
				></path>
				<line x1="10" y1="11" x2="10" y2="17"></line>
				<line x1="14" y1="11" x2="14" y2="17"></line>
			</svg>
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

	.totalvalue-col .cell-text {
		font-weight: 700;
		color: var(--value-color);
	}

	/* De-emphasize empty / zero values so real numbers stand out. */
	.is-zero {
		color: var(--text-color-dimmed);
		opacity: 0.55;
		font-weight: 400;
	}

	.totalvalue-col .cell-text.is-zero {
		font-weight: 400;
		color: var(--text-color-dimmed);
	}

	/* Low-stock pill shown beside the count. */
	.low-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		flex-shrink: 0;
		padding: 0.08rem 0.4rem;
		border-radius: 9999px;
		font-size: 0.62rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		line-height: 1.4;
		color: #ef4444;
		background: color-mix(in srgb, #ef4444 14%, transparent);
	}

	:global([data-theme='dark']) .low-pill {
		color: #f87171;
		background: color-mix(in srgb, #f87171 14%, transparent);
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
		transition:
			background-color 0.15s ease-out,
			transform 0.12s ease-out;
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

	.cell-value-btn:active {
		transform: scale(0.97);
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
		color: var(--add-item-color);
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
		transition: transform 0.12s ease-out;
	}

	.booth-tag-btn:hover {
		transform: scale(1.08);
	}

	.booth-tag-btn:active {
		transform: scale(0.95);
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
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: none;
		cursor: pointer;
		opacity: 0;
		transition:
			opacity 0.15s ease-out,
			transform 0.12s ease-out,
			color 0.15s ease-out;
		flex-shrink: 0;
		padding: 0.3rem;
		border-radius: 6px;
		background-color: transparent;
		color: #ef4444;
		min-height: 0;
	}

	:global([data-theme='dark']) .delete-button {
		color: #f87171;
	}

	.delete-button svg {
		width: 1.05rem;
		height: 1.05rem;
	}

	:global(.table-row:hover) .delete-button {
		opacity: 1;
	}

	.delete-button:hover {
		color: #ff0000;
		background-color: color-mix(in srgb, #ef4444 15%, transparent);
		transform: scale(1.12);
	}

	:global([data-theme='dark']) .delete-button:hover {
		color: #ff6b6b;
		background-color: color-mix(in srgb, #f87171 15%, transparent);
	}

	.delete-button:active {
		transform: scale(0.94);
	}

	.action-col {
		position: static;
		background-color: transparent;
		overflow: hidden;
		text-align: center;
	}

	/* Disable the tactile press/hover scaling for reduced-motion users. */
	@media (prefers-reduced-motion: reduce) {
		.cell-value-btn:active,
		.booth-tag-btn:hover,
		.booth-tag-btn:active,
		.delete-button:hover,
		.delete-button:active {
			transform: none;
		}
	}
</style>
