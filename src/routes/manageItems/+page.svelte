<script lang="ts">
	import { onMount } from 'svelte';
	import {
		getItems,
		addItem,
		deleteItem,
		searchItems,
		editItemCost,
		editItemLowCount,
		editItemName,
		editItemBarcode,
		editItemStorageType,
		applySorting
	} from '../../lib/items';
	import type { Item } from '../../types';
	import Swal from 'sweetalert2';

	let items: Item[] = [];
	let name = '';
	let barcode = '';
	let count: number = 0;
	let lowCount: number | null = null;
	let cost: number | null = null;
	let storageType: '' | 'freezer' | 'refrigerator' | 'dry storage' = '';
	let searchValue = '';

	let currentSortColumn: keyof Item;
	let sortAscending = true;

	onMount(async () => {
		items = await getItems();
	});

	$: sortIcon = (column) => {
		if (currentSortColumn === column) {
			return sortAscending ? '▲' : '▼';
		}
		return '↕';
	};

	async function handleAdd() {
		const itemWithoutId = {
			name,
			barcode,
			count,
			lowCount,
			cost,
			storageType
		};

		const id = await addItem(itemWithoutId);
		const item: Item = {
			id,
			...itemWithoutId
		};

		let updatedItems = [...items, item];
		updatedItems = applySorting(updatedItems, currentSortColumn, sortAscending);
		updateItemsAndSort(updatedItems);

		name = '';
		barcode = '';
		count = 0;
		lowCount = null;
		cost = null;
		storageType = '';
	}

	async function handleDelete(id: string) {
		await deleteItem(id);
		const updatedItems = items.filter((item) => item.id !== id);
		updateItemsAndSort(updatedItems);
	}

	async function handleEditCost(id: string, oldCost: number | null) {
		if (oldCost == null) {
			oldCost = 0;
		}
		await Swal.fire({
			title: 'Edit Cost',
			input: 'number',
			inputValue: oldCost.toString(),
			inputAttributes: {
				autocapitalize: 'off'
			},
			showCancelButton: true,
			confirmButtonText: 'Confirm',
			showLoaderOnConfirm: true,
			preConfirm: async (newCost) => {
				if (newCost) {
					await editItemCost(id, Number(newCost));
					const updatedItems = items.map((item) => {
						if (item.id === id) {
							return { ...item, cost: Number(newCost) };
						}
						return item;
					});
					updateItemsAndSort(updatedItems);
				}
			},
			allowOutsideClick: () => !Swal.isLoading()
		});
	}

	async function handleEditBarcode(id: string, oldBarcode: string) {
		await Swal.fire({
			title: 'Edit Barcode',
			input: 'text',
			inputValue: oldBarcode,
			inputAttributes: {
				autocapitalize: 'off'
			},
			showCancelButton: true,
			confirmButtonText: 'Confirm',
			showLoaderOnConfirm: true,
			preConfirm: async (newBarcode) => {
				if (newBarcode) {
					await editItemBarcode(id, newBarcode);
					const updatedItems = items.map((item) => {
						if (item.id === id) {
							return { ...item, barcode: newBarcode };
						}
						return item;
					});
					updateItemsAndSort(updatedItems);
				}
			},
			allowOutsideClick: () => !Swal.isLoading()
		});
	}

	async function handleEditName(id: string, oldName: string) {
		await Swal.fire({
			title: 'Edit Name',
			input: 'text',
			inputValue: oldName,
			inputAttributes: {
				autocapitalize: 'off'
			},
			showCancelButton: true,
			confirmButtonText: 'Confirm',
			showLoaderOnConfirm: true,
			preConfirm: async (newName) => {
				if (newName) {
					await editItemName(id, newName);
					const updatedItems = items.map((item) => {
						if (item.id === id) {
							return { ...item, name: newName };
						}
						return item;
					});
					updateItemsAndSort(updatedItems);
				}
			},
			allowOutsideClick: () => !Swal.isLoading()
		});
	}

	async function handleEditStorageType(id: string, oldStorageType: string) {
		await Swal.fire({
			title: 'Edit Storage Type',
			input: 'select',
			inputOptions: {
				'': 'Select Storage Type',
				Dry: 'Dry Storage',
				Refrigerator: 'Refrigerator',
				Freezer: 'Freezer'
			},
			inputAttributes: {
				autocapitalize: 'off'
			},
			showCancelButton: true,
			confirmButtonText: 'Confirm',
			showLoaderOnConfirm: true,
			preConfirm: async (newStorageType) => {
				if (newStorageType) {
					await editItemStorageType(id, newStorageType);
					const updatedItems = items.map((item) => {
						if (item.id === id) {
							return { ...item, storageType: newStorageType };
						}
						return item;
					});
					updateItemsAndSort(updatedItems);
				}
			},
			allowOutsideClick: () => !Swal.isLoading()
		});
	}

	async function handleEditLowCount(id: string, oldLowCount: number | null) {
		if (oldLowCount == null) {
			oldLowCount = 0;
		}
		await Swal.fire({
			title: 'Edit Low Count',
			input: 'number',
			inputValue: oldLowCount.toString(),
			inputAttributes: {
				autocapitalize: 'off'
			},
			showCancelButton: true,
			confirmButtonText: 'Confirm',
			showLoaderOnConfirm: true,
			preConfirm: async (newLowCount) => {
				if (newLowCount) {
					await editItemLowCount(id, Number(newLowCount));
					const updatedItems = items.map((item) => {
						if (item.id === id) {
							return { ...item, lowCount: Number(newLowCount) };
						}
						return item;
					});
					updateItemsAndSort(updatedItems);
				}
			},
			allowOutsideClick: () => !Swal.isLoading()
		});
	}

	async function handleSearch() {
		const searchedItems = await searchItems(searchValue);
		updateItemsAndSort(searchedItems);
	}

	async function sortBy(column: keyof Item) {
		if (currentSortColumn === column) {
			sortAscending = !sortAscending;
		} else {
			currentSortColumn = column;
			sortAscending = true;
		}
		updateItemsAndSort(items);
	}

	function updateItemsAndSort(updatedItems: Item[]) {
		items = applySorting(updatedItems, currentSortColumn, sortAscending);
	}
</script>

<div class="container mx-auto p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md">
	<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
		<div class="form-group">
			<label for="name" class="form-label">Name</label>
			<input id="name" class="form-control" bind:value={name} placeholder="Name" />
		</div>
		<div class="form-group">
			<label for="barcode" class="form-label">Barcode</label>
			<input id="barcode" class="form-control" bind:value={barcode} placeholder="Barcode" />
		</div>
		<div class="form-group">
			<label for="count" class="form-label">Count</label>
			<input id="count" class="form-control" bind:value={count} type="number" placeholder="Count" />
		</div>
		<div class="form-group">
			<label for="lowCount" class="form-label">Low Count</label>
			<input
				id="lowCount"
				class="form-control"
				bind:value={lowCount}
				type="number"
				placeholder="Low Count"
			/>
		</div>
		<div class="form-group">
			<label for="cost" class="form-label">Cost</label>
			<input id="cost" class="form-control" bind:value={cost} type="number" placeholder="Cost" />
		</div>
		<div class="form-group">
			<label for="storageType" class="form-label">Storage type</label>
			<select id="storageType" bind:value={storageType} class="form-control">
				<option value="">Select storage type...</option>
				<option value="Freezer">Freezer</option>
				<option value="Refrigerator">Refrigerator</option>
				<option value="Dry">Dry Storage</option>
			</select>
		</div>
		<div class="form-group col-span-full">
			<button class="btn btn-primary w-full" on:click={handleAdd}>Add Item</button>
		</div>
	</div>

	<div class="mb-4">
		<label for="search" class="form-label">Search</label>
		<input
			id="search"
			class="form-control"
			bind:value={searchValue}
			placeholder="Search"
			on:input={handleSearch}
		/>
	</div>

	<table class="table-auto w-full border-collapse">
		<thead>
			<tr class="bg-gray-100 dark:bg-gray-700">
				<th class="px-4 py-2" on:click={() => sortBy('name')}
					>Name <span>{sortIcon('name')}</span></th
				>
				<th class="px-4 py-2" on:click={() => sortBy('barcode')}
					>Barcode <span>{sortIcon('barcode')}</span></th
				>
				<th class="px-4 py-2" on:click={() => sortBy('count')}
					>Count <span>{sortIcon('count')}</span></th
				>
				<th class="px-4 py-2" on:click={() => sortBy('lowCount')}
					>LowCount <span>{sortIcon('lowCount')}</span></th
				>
				<th class="px-4 py-2" on:click={() => sortBy('cost')}
					>Cost <span>{sortIcon('cost')}</span></th
				>
				<th class="px-4 py-2" on:click={() => sortBy('storageType')}
					>Storage Type <span>{sortIcon('storageType')}</span></th
				>
				<th class="px-4 py-2"></th>
			</tr>
			<tr class="bg-gray-50 dark:bg-gray-600">
				<th class="px-4 py-2 text-sm">Click to edit</th>
				<th class="px-4 py-2 text-sm">Click to edit</th>
				<th class="px-4 py-2 text-sm">Not editable</th>
				<th class="px-4 py-2 text-sm">Click to edit</th>
				<th class="px-4 py-2 text-sm">Click to edit</th>
				<th class="px-4 py-2 text-sm">Click to edit</th>
				<th class="px-4 py-2"></th>
			</tr>
		</thead>
		<tbody>
			{#each items as item (item.id)}
				<tr class="border-b dark:border-gray-700">
					<td class="px-4 py-2 cursor-pointer" on:click={() => handleEditName(item.id, item.name)}
						>{item.name}</td
					>
					<td
						class="px-4 py-2 cursor-pointer"
						on:click={() => handleEditBarcode(item.id, item.barcode)}>{item.barcode}</td
					>
					<td class="px-4 py-2">{item.count}</td>
					<td
						class="px-4 py-2 cursor-pointer"
						on:click={() => handleEditLowCount(item.id, item.lowCount)}
						>{item.lowCount != null ? item.lowCount : ''}</td
					>
					<td class="px-4 py-2 cursor-pointer" on:click={() => handleEditCost(item.id, item.cost)}
						>{item.cost != null ? item.cost : ''}</td
					>
					<td
						class="px-4 py-2 cursor-pointer"
						on:click={() => handleEditStorageType(item.id, item.storageType)}>{item.storageType}</td
					>
					<td class="px-4 py-2">
						<button class="btn btn-danger" on:click={() => handleDelete(item.id)}>Delete</button>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	/* Add your custom styles here */
	.form-group {
		display: flex;
		flex-direction: column;
	}
	.form-label {
		margin-bottom: 0.5rem;
		color: var(--text-color);
	}
	.form-control {
		padding: 0.5rem;
		border: 1px solid var(--border-color);
		border-radius: 0.375rem;
		background-color: var(--input-bg);
		color: var(--input-text);
	}
	.table th,
	.table td {
		border: 1px solid var(--table-border);
	}
	.table th {
		background-color: var(--table-header-bg);
		color: var(--table-header-text);
	}
	.table td {
		background-color: var(--table-cell-bg);
		color: var(--table-cell-text);
	}
</style>
