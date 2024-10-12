<script lang="ts">
	import { fade, fly, crossfade } from 'svelte/transition';
	import type { Item } from '../types';

	export let paginatedItems: Item[] = [];
	export let onEdit: (id: string, field: keyof Item, value: any) => void;
	export let onDelete: (id: string) => void;
	export let sortBy: (column: keyof Item) => void;
	export let currentSortColumn: keyof Item;
	export let sortAscending: boolean;

	const [send, receive] = crossfade({
		duration: 200,
		fallback(node, params) {
			const style = getComputedStyle(node);
			const transform = style.transform === 'none' ? '' : style.transform;

			return {
				duration: 200,
				easing: (t) => t,
				css: (t) => `
					transform: ${transform} scale(${t});
					opacity: ${t}
				`
			};
		}
	});

	$: sortKey = `${currentSortColumn}-${sortAscending}`;
</script>

<div class="table-wrapper">
	<div class="table-scroll">
		<table class="custom-table">
			<thead>
				<tr class="table-header">
					<th class="name-col" on:click={() => sortBy('name')}>
						<div class="header">
							Name
							<i
								class="fas fa-sort{currentSortColumn === 'name'
									? sortAscending
										? '-up'
										: '-down'
									: ''}"
							></i>
						</div>
					</th>
					<th class="barcode-col" on:click={() => sortBy('barcode')}>
						<div class="header">
							Barcode
							<i
								class="fas fa-sort{currentSortColumn === 'barcode'
									? sortAscending
										? '-up'
										: '-down'
									: ''}"
							></i>
						</div>
					</th>
					<th class="count-col" on:click={() => sortBy('count')}>
						<div class="header">
							Count
							<i
								class="fas fa-sort{currentSortColumn === 'count'
									? sortAscending
										? '-up'
										: '-down'
									: ''}"
							></i>
						</div>
					</th>
					<th class="lowcount-col" on:click={() => sortBy('lowCount')}>
						<div class="header">
							Low Count
							<i
								class="fas fa-sort{currentSortColumn === 'lowCount'
									? sortAscending
										? '-up'
										: '-down'
									: ''}"
							></i>
						</div>
					</th>
					<th class="cost-col" on:click={() => sortBy('cost')}>
						<div class="header">
							Cost
							<i
								class="fas fa-sort{currentSortColumn === 'cost'
									? sortAscending
										? '-up'
										: '-down'
									: ''}"
							></i>
						</div>
					</th>
					<th class="storage-col" on:click={() => sortBy('storageType')}>
						<div class="header">
							Storage Type
							<i
								class="fas fa-sort{currentSortColumn === 'storageType'
									? sortAscending
										? '-up'
										: '-down'
									: ''}"
							></i>
						</div>
					</th>
					<th class="action-col"></th>
				</tr>
			</thead>
			<tbody>
				{#each paginatedItems as item (item.id + sortKey)}
					<tr class="table-row">
						<td class="name-col">
							<div class="cell-content">
								<span>{item.name}</span>
								<button
									class="icon-button"
									title="Edit Name"
									on:click={() => onEdit(item.id, 'name', item.name)}
									aria-label="Edit Name"
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
									title="Edit Barcode"
									on:click={() => onEdit(item.id, 'barcode', item.barcode)}
									aria-label="Edit Barcode"
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
									title="Edit Low Count"
									on:click={() => onEdit(item.id, 'lowCount', item.lowCount)}
									aria-label="Edit Low Count"
								>
									<i class="fas fa-edit"></i>
								</button>
							</div>
						</td>
						<td class="cost-col">
							<div class="cell-content">
								<span>{item.cost != null ? item.cost : ''}</span>
								<button
									class="icon-button"
									title="Edit Cost"
									on:click={() => onEdit(item.id, 'cost', item.cost)}
									aria-label="Edit Cost"
								>
									<i class="fas fa-edit"></i>
								</button>
							</div>
						</td>
						<td class="storage-col">
							<div class="cell-content">
								<span>{item.storageType}</span>
								<button
									class="icon-button"
									title="Edit Storage Type"
									on:click={() => onEdit(item.id, 'storageType', item.storageType)}
									aria-label="Edit Storage Type"
								>
									<i class="fas fa-edit"></i>
								</button>
							</div>
						</td>
						<td class="action-col">
							<button
								class="delete-button"
								title="Delete Item"
								on:click={() => onDelete(item.id)}
								aria-label="Delete Item"
							>
								<i class="fas fa-trash-alt"></i>
							</button>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>

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
		max-height: 550px;
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
	}

	.custom-table tbody tr:hover {
		background-color: var(--zinc-800);
	}

	.header {
		display: flex;
		align-items: center;
		cursor: pointer;
	}

	.header i {
		margin-left: 0.5rem;
		font-size: 0.8em;
	}

	.header:hover {
		color: var(--icon-hover-color);
		transition: color 0.3s ease;
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
		transition: opacity 0.2s ease-in-out;
	}

	.table-row:hover .icon-button,
	.table-row:hover .delete-button {
		opacity: 1;
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
</style>
