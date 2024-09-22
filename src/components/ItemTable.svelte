<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { Item } from '../types';
	import { Pagination } from 'flowbite-svelte';
	import { fade, fly } from 'svelte/transition';

	export let items: Item[] = [];
	export let currentSortColumn: keyof Item = 'name';
	export let sortAscending = true;
	export let currentPage = 1;
	export let itemsPerPage = 10;

	const dispatch = createEventDispatcher();

	$: totalItems = items.length;
	$: paginatedItems = items.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
	const handleEdit = (id: string, field: keyof Item, oldValue: any) => {
		dispatch('edit', { id, field, oldValue });
	};

	const handleDelete = (id: string) => {
		dispatch('delete', id);
	};

	const sortBy = (column: keyof Item) => {
		dispatch('sort', column);
	};

	const handlePrevious = () => {
		if (currentPage > 1) {
			currentPage--;
		}
	};

	const handleNext = () => {
		if (currentPage < Math.ceil(totalItems / itemsPerPage)) {
			currentPage++;
		}
	};

	const handlePageClick = (event: CustomEvent<number>) => {
		currentPage = event.detail;
	};

	$: sortIcon = (column: keyof Item) =>
		currentSortColumn === column ? (sortAscending ? '▲' : '▼') : '↕';
</script>

<div class="table-container">
	<table class="custom-table table-auto w-full border-collapse">
		<thead>
			<tr class="table-header">
				<th class="px-4 py-2 text-left" on:click={() => sortBy('name')}
					>Name <span>{sortIcon('name')}</span></th
				>
				<th class="px-4 py-2 text-left" on:click={() => sortBy('barcode')}
					>Barcode <span>{sortIcon('barcode')}</span></th
				>
				<th class="px-4 py-2 text-left" on:click={() => sortBy('count')}
					>Count <span>{sortIcon('count')}</span></th
				>
				<th class="px-4 py-2 text-left" on:click={() => sortBy('lowCount')}
					>Low Count <span>{sortIcon('lowCount')}</span></th
				>
				<th class="px-4 py-2 text-left" on:click={() => sortBy('cost')}
					>Cost <span>{sortIcon('cost')}</span></th
				>
				<th class="px-4 py-2 text-left" on:click={() => sortBy('storageType')}
					>Storage Type <span>{sortIcon('storageType')}</span></th
				>
				<th class="px-4 py-2"></th>
			</tr>
		</thead>
		<tbody>
			{#each paginatedItems as item (item.id)}
				<tr class="table-row" in:fly={{ y: 20, duration: 300 }} out:fade={{ duration: 300 }}>
					<td class="px-4 py-2">
						<div class="cell-content">
							<span>{item.name}</span>
							<button
								class="icon-button"
								title="Edit Name"
								on:click={() => handleEdit(item.id, 'name', item.name)}
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
								on:click={() => handleEdit(item.id, 'barcode', item.barcode)}
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
								on:click={() => handleEdit(item.id, 'lowCount', item.lowCount)}
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
								on:click={() => handleEdit(item.id, 'cost', item.cost)}
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
								on:click={() => handleEdit(item.id, 'storageType', item.storageType)}
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
							on:click={() => handleDelete(item.id)}
							aria-label="Delete Item"
						>
							<i class="fas fa-trash-alt"></i>
						</button>
					</td>
					<!-- Repeat for other table cells -->
				</tr>
			{/each}
		</tbody>
	</table>
</div>
<div class="flex justify-center mt-4">
	<Pagination
		{totalItems}
		{itemsPerPage}
		{currentPage}
		showPreviousNext={true}
		on:previous={handlePrevious}
		on:next={handleNext}
		on:pageClick={handlePageClick}
	/>
</div>

<style>
	.table-row {
		transition: background-color 0.3s ease;
	}

	.table-row:hover {
		background-color: var(--row-hover-color, #f0f0f0);
	}
	.custom-table {
		width: 100%;
		border-collapse: collapse;
	}
	.custom-table th,
	.custom-table td {
		padding: 0.75rem;
		text-align: left;
	}
	.custom-table th {
		border-bottom: 2px solid var(--table-border-color);
	}
	.custom-table td {
		border-bottom: 1px solid var(--table-border-color);
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
		padding: 0;
		cursor: pointer;
		display: flex;
		align-items: center;
		color: var(--icon-color);
		transition: transform 0.2s ease-in-out;
	}
	.icon-button:hover,
	.delete-button:hover {
		color: var(--icon-hover-color);
		transform: scale(1.1);
	}
	.delete-button {
		color: darkred;
	}
	.delete-button:hover {
		color: red;
	}
	.icon-button[title]::after,
	.delete-button[title]::after {
		content: attr(title);
		position: absolute;
		font-size: 0.75rem;
		left: 50%;
		bottom: 100%;
		transform: translateX(-50%);
		background: rgba(0, 0, 0, 0.75);
		color: #fff;
		padding: 0.5rem;
		border-radius: 0.25rem;
		white-space: nowrap;
		opacity: 0;
		transition: opacity 0.2s ease-in-out;
		pointer-events: none;
	}
	.icon-button:hover[title]::after,
	.delete-button:hover[title]::after {
		opacity: 1;
	}
</style>
