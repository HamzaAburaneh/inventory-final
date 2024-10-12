<script lang="ts">
	import type { Item } from '../types';

	export let paginatedItems: Item[] = [];
	export let onEdit: (id: string, field: keyof Item, value: any) => void;
	export let onDelete: (id: string) => void;
	export let sortBy: (column: keyof Item) => void;
	export let currentSortColumn: keyof Item;
	export let sortAscending: boolean;
</script>

<table class="custom-table table-auto w-full border-collapse">
	<thead>
		<tr class="table-header">
			<th class="px-4 py-2 text-left" on:click={() => sortBy('name')}>
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
			<th class="px-4 py-2 text-left" on:click={() => sortBy('barcode')}>
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
			<th class="px-4 py-2 text-left" on:click={() => sortBy('count')}>
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
			<th class="px-4 py-2 text-left" on:click={() => sortBy('lowCount')}>
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
			<th class="px-4 py-2 text-left" on:click={() => sortBy('cost')}>
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
			<th class="px-4 py-2 text-left" on:click={() => sortBy('storageType')}>
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
			<th class="px-4 py-2"></th>
		</tr>
	</thead>
	<tbody>
		{#each paginatedItems as item (item.id)}
			<tr class="table-row">
				<td class="px-4 py-2">
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
				<td class="px-4 py-2">
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
				<td class="px-4 py-2">{item.count}</td>
				<td class="px-4 py-2">
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
				<td class="px-4 py-2">
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
				<td class="px-4 py-2">
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
				<td class="px-4 py-2 text-center">
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

<style>
	.custom-table {
		border-collapse: separate;
		border-spacing: 0;
	}

	.custom-table th,
	.custom-table td {
		padding: 0.75rem;
		text-align: left;
		border-bottom: 1px solid var(--table-border-color);
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
		justify-content: space-between;
		cursor: pointer;
	}

	.header i {
		margin-left: auto;
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
</style>
