<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import type { Item } from '../types';

	export let paginatedItems: Item[] = [];
	export let onEdit: (id: string, field: string, value: any) => void;
	export let onDelete: (id: string) => Promise<void>;
	export let sortBy: (column: string) => void;
	export let currentSortColumn: string;
	export let sortAscending: boolean;

	let hoveredButton: HTMLElement | null = null;
	let deletingItemId: string | null = null;

	function showTooltip(event: MouseEvent): void {
		hoveredButton = event.target as HTMLElement;
	}

	function hideTooltip(): void {
		hoveredButton = null;
	}

	async function handleDelete(id: string): Promise<void> {
		deletingItemId = id;
		await onDelete(id);
		deletingItemId = null;
	}

	function capitalizeWords(str: string): string {
		return str
			.split(' ')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');
	}

	function getStorageTypeStyle(storageType: string): { backgroundColor: string; color: string } {
		switch (storageType.toLowerCase()) {
			case 'freezer':
				return { backgroundColor: '#1E3A8A', color: '#BFDBFE' }; // Dark blue background, light blue text
			case 'dry storage':
				return { backgroundColor: '#92400E', color: '#FDE68A' }; // Brown background, light yellow text
			case 'refrigerator':
				return { backgroundColor: '#065F46', color: '#A7F3D0' }; // Dark green background, light green text
			default:
				return { backgroundColor: '#374151', color: '#E5E7EB' }; // Dark gray background, light gray text
		}
	}

	function formatCost(cost: number | null): string {
		return cost != null ? `$ ${cost.toFixed(2)}` : '';
	}
</script>

<div class="table-wrapper">
	<div class="table-scroll">
		<table class="custom-table">
			<thead>
				<tr class="table-header">
					{#each ['name', 'barcode', 'count', 'lowCount', 'cost', 'storageType', ''] as column, i}
						<th class="{column}-col" on:click={() => column && sortBy(column)}>
							<div class="header">
								{#if column}
									{column.charAt(0).toUpperCase() + column.slice(1)}
									<i
										class="fas fa-sort{currentSortColumn === column
											? sortAscending
												? '-up'
												: '-down'
											: ''}"
									></i>
								{/if}
							</div>
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each paginatedItems as item (item.id)}
					{#if item.id !== deletingItemId}
						<tr class="table-row" in:fly={{ y: 20, duration: 300 }} out:fade={{ duration: 300 }}>
							<td class="name-col">
								<div class="cell-content">
									<span>{item.name}</span>
									<button
										class="icon-button"
										data-tooltip="Edit Name"
										on:click={() => onEdit(item.id, 'name', item.name)}
										on:mouseenter={showTooltip}
										on:mouseleave={hideTooltip}
									>
										<i class="fas fa-edit"></i>
									</button>
								</div>
							</td>
							<td class="barcode-col">
								<div class="cell-content">
									<span>{item.barcode}</span>
									<button
										class="icon-button"
										data-tooltip="Edit Barcode"
										on:click={() => onEdit(item.id, 'barcode', item.barcode)}
										on:mouseenter={showTooltip}
										on:mouseleave={hideTooltip}
									>
										<i class="fas fa-edit"></i>
									</button>
								</div>
							</td>
							<td class="count-col">{item.count}</td>
							<td class="lowcount-col">
								<div class="cell-content">
									<span>{item.lowCount != null ? item.lowCount : ''}</span>
									<button
										class="icon-button"
										data-tooltip="Edit Low Count"
										on:click={() => onEdit(item.id, 'lowCount', item.lowCount)}
										on:mouseenter={showTooltip}
										on:mouseleave={hideTooltip}
									>
										<i class="fas fa-edit"></i>
									</button>
								</div>
							</td>
							<td class="cost-col">
								<div class="cell-content">
									<span>{formatCost(item.cost)}</span>
									<button
										class="icon-button"
										data-tooltip="Edit Cost"
										on:click={() => onEdit(item.id, 'cost', item.cost)}
										on:mouseenter={showTooltip}
										on:mouseleave={hideTooltip}
									>
										<i class="fas fa-edit"></i>
									</button>
								</div>
							</td>
							<td class="storage-col">
								<div class="cell-content">
									<span
										class="storage-type"
										style="background-color: {getStorageTypeStyle(item.storageType)
											.backgroundColor}; color: {getStorageTypeStyle(item.storageType).color};"
									>
										{capitalizeWords(item.storageType)}
									</span>
									<button
										class="icon-button"
										data-tooltip="Edit Storage Type"
										on:click={() => onEdit(item.id, 'storageType', item.storageType)}
										on:mouseenter={showTooltip}
										on:mouseleave={hideTooltip}
									>
										<i class="fas fa-edit"></i>
									</button>
								</div>
							</td>
							<td class="action-col">
								<button
									class="delete-button"
									data-tooltip="Delete Item"
									on:click={() => handleDelete(item.id)}
									on:mouseenter={showTooltip}
									on:mouseleave={hideTooltip}
								>
									<i class="fas fa-trash-alt"></i>
								</button>
							</td>
						</tr>
					{/if}
				{/each}
			</tbody>
		</table>
	</div>
</div>

{#if hoveredButton}
	<div
		class="tooltip"
		style="left: {hoveredButton.getBoundingClientRect()
			.left}px; top: {hoveredButton.getBoundingClientRect().top - 30}px"
		in:fly={{ y: 10, duration: 200 }}
		out:fade={{ duration: 200 }}
	>
		{hoveredButton.dataset.tooltip}
	</div>
{/if}

<style>
	.table-wrapper {
		position: relative;
		width: 100%;
		overflow: hidden;
	}

	.table-scroll {
		width: 100%;
		overflow-x: auto;
		overflow-y: scroll;
		max-height: 650px;
		min-height: 650px;
	}

	.custom-table {
		border-collapse: separate;
		border-spacing: 0;
		width: 100%;
		table-layout: fixed;
	}

	.custom-table th,
	.custom-table td {
		padding: 0.75rem;
		text-align: left;
		border-bottom: 1px solid var(--table-border-color);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.custom-table th {
		position: sticky;
		top: 0;
		background-color: var(--container-bg);
		z-index: 10;
		box-shadow: 0 2px 2px -1px rgba(0, 0, 0, 0.4);
	}

	.custom-table tbody tr {
		background-color: var(--container-bg);
		transition: background-color 0.3s ease;
	}

	.custom-table tbody tr:hover {
		background-color: var(--zinc-800);
	}

	.header {
		display: flex;
		align-items: center;
		cursor: pointer;
		transition: color 0.3s ease;
	}

	.header i {
		margin-left: 0.5rem;
		font-size: 0.8em;
		transition: transform 0.3s ease;
	}

	.header:hover {
		color: var(--icon-hover-color);
	}

	.header:hover i {
		transform: scale(1.2);
	}

	.cell-content {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.icon-button,
	.delete-button {
		background: none;
		border: none;
		cursor: pointer;
		opacity: 0;
		transition:
			opacity 0.2s ease-in-out,
			color 0.2s ease-in-out,
			transform 0.2s ease;
	}

	.table-row:hover .icon-button,
	.table-row:hover .delete-button {
		opacity: 1;
	}

	.icon-button:hover,
	.delete-button:hover {
		color: var(--icon-hover-color);
		transform: scale(1.2);
	}

	.delete-button {
		color: darkred;
	}

	.delete-button:hover {
		color: red;
	}

	/* Fixed column widths */
	.name-col {
		width: 25%;
	}
	.barcode-col {
		width: 20%;
	}
	.count-col {
		width: 10%;
	}
	.lowcount-col {
		width: 10%;
	}
	.cost-col {
		width: 10%;
	}
	.storage-col {
		width: 15%;
	}
	.action-col {
		width: 10%;
	}

	.tooltip {
		position: fixed;
		background-color: #333;
		color: white;
		padding: 5px 10px;
		border-radius: 4px;
		font-size: 14px;
		z-index: 1000;
		pointer-events: none;
	}

	.storage-type {
		padding: 6px 14px;
		border-radius: 20px;
		font-size: 0.9rem;
		font-weight: 600;
		background-color: #f8f9fa; /* Light background for contrast */
		color: #333; /* Darker text for readability */
		box-shadow:
			0 4px 8px rgba(0, 0, 0, 0.15),
			0 1px 3px rgba(0, 0, 0, 0.1); /* Softer, layered shadow */
		border: 1px solid rgba(0, 0, 0, 0.1); /* Optional subtle border */
		transition: all 0.2s ease-in-out; /* Smooth hover effect */
	}
</style>
