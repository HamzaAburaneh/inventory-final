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

	let errors = {
		name: '',
		barcode: '',
		count: '',
		lowCount: '',
		cost: '',
		storageType: ''
	};
	let items: Item[] = [];
	let name = '';
	let barcode = '';
	let count: string = ''; // Initialize count as an empty string
	let lowCount: string = ''; // Initialize lowCount as an empty string
	let cost: number | null = null;
	let storageType: '' | 'freezer' | 'refrigerator' | 'dry storage' = '';
	let searchValue = '';

	let currentSortColumn: keyof Item;
	let sortAscending = true;

	const validateName = () => {
		errors.name = name.trim().length < 3 ? 'Name must be at least 3 characters' : '';
	};

	function handleInput(event: Event, setValue: (value: string) => void, validate: () => void) {
		const inputValue = (event.target as HTMLInputElement).value;
		const sanitizedValue = inputValue.replace(/\D/g, ''); // Remove non-digit characters
		setValue(sanitizedValue);
		validate();
	}

	const validateCount = () => {
		const countValue = parseInt(count);
		errors.count = isNaN(countValue) || countValue < 0 ? 'Count must be a positive number' : '';
	};

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

<div
	class="container mx-auto p-4 rounded-lg shadow-md"
	style="background-color: var(--container-bg);"
>
	<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
		<div class="form-group">
			<label for="name" class="form-label">Name</label>
			<div class="input-group">
				<input
					id="name"
					class="form-control"
					bind:value={name}
					placeholder="Enter item name"
					on:input={validateName}
					on:blur={validateName}
					class:is-invalid={errors.name}
				/>
				{#if errors.name}
					<div class="error-message">{errors.name}</div>
				{/if}
			</div>
		</div>
		<div class="form-group">
			<label for="barcode" class="form-label">Barcode</label>
			<input id="barcode" class="form-control" bind:value={barcode} placeholder="Enter barcode" />
		</div>
		<div class="form-group">
			<label for="count" class="form-label">Count</label>
			<div class="input-group">
				<input
					id="count"
					class="form-control"
					bind:value={count}
					type="text"
					pattern="^[0-9]*$"
					placeholder="Enter item count"
					on:input={(event) => handleInput(event, (value) => (count = value), validateCount)}
					class:is-invalid={errors.count}
				/>
				{#if errors.count}
					<div class="error-message">{errors.count}</div>
				{/if}
			</div>
		</div>

		<div class="form-group">
			<label for="lowCount" class="form-label">Low Count</label>
			<input
				id="lowCount"
				class="form-control"
				bind:value={lowCount}
				type="text"
				pattern="^[0-9]*$"
				placeholder="Enter low stock threshold"
				on:input={(event) => handleInput(event, (value) => (lowCount = value), validateCount)}
				class:is-invalid={errors.lowCount}
			/>
			{#if errors.lowCount}
				<div class="error-message">{errors.lowCount}</div>
			{/if}
		</div>

		<div class="form-group">
			<label for="cost" class="form-label">Cost</label>
			<input
				id="cost"
				class="form-control"
				bind:value={cost}
				type="number"
				placeholder="Enter item cost"
			/>
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
			<button class="btn btn-primary w-full" id="add-item" on:click={handleAdd}>Add Item</button>
		</div>
	</div>

	<div class="mb-4">
		<label for="search" class="form-label">Search: </label>
		<input
			id="search"
			class="form-control"
			bind:value={searchValue}
			placeholder="Search Items"
			on:input={handleSearch}
		/>
	</div>

	<table class="custom-table table-auto w-full border-collapse">
		<thead>
			<tr style="background-color: var(--table-header-bg);">
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
					>LowCount <span>{sortIcon('lowCount')}</span></th
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
			{#each items as item (item.id)}
				<tr
					class="border-b hover:bg-opacity-20 hover:bg-amber-300"
					style="border-color: var(--border-color);"
				>
					<td class="px-4 py-2">
						<div class="cell-content">
							<span>{item.name}</span>
							<button
								class="icon-button"
								title="Edit Name"
								on:click={() => handleEditName(item.id, item.name)}
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
								on:click={() => handleEditBarcode(item.id, item.barcode)}
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
								on:click={() => handleEditLowCount(item.id, item.lowCount)}
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
								on:click={() => handleEditCost(item.id, item.cost)}
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
								on:click={() => handleEditStorageType(item.id, item.storageType)}
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
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	#add-item {
		background-color: #47fd99;
		color: #000;
		font-weight: 700;
		border-radius: 1rem;
		width: 50%;
		align-self: center;
		padding: 0.75rem 1.5rem;
		border: none;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
		transition:
			background-color 0.3s ease,
			transform 0.3s ease,
			box-shadow 0.3s ease;
		cursor: pointer;
		text-align: center;
		transform-origin: center;
		position: relative;
		overflow: hidden;
	}

	#add-item:hover {
		transform: scale(1.1);
		box-shadow: 0 6px 10px rgba(0, 0, 0, 0.15);
	}

	#add-item:active {
		transform: scale(1.05);
	}

	#add-item::before {
		content: '';
		position: absolute;
		top: 50%;
		left: 50%;
		width: 300%;
		height: 300%;
		background: rgba(255, 255, 255, 0.15);
		transform: translate(-50%, -50%) rotate(45deg);
		transition: all 0.3s ease;
		opacity: 0;
	}

	#add-item:hover::before {
		opacity: 1;
		width: 400%;
		height: 400%;
	}

	.form-group {
		display: flex;
		flex-direction: column;
	}

	.form-label {
		margin-bottom: 0.5rem;
	}

	.form-control {
		padding: 0.5rem;
		border: 1px solid var(--border-color);
		border-radius: 0.375rem;
		background-color: var(--input-bg);
		color: var(--input-text);
	}

	.custom-table th,
	.custom-table td {
		padding: 0.5rem;
		text-align: left;
		font-weight: 700;
	}

	.custom-table th {
		cursor: pointer;
		border-bottom: 2px solid var(--border-color);
	}

	.custom-table td {
		border-bottom: 2px solid var(--border-color);
	}

	.cell-content {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.cell-content span {
		flex-grow: 1;
	}

	.icon-button,
	.delete-button {
		position: relative;
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		display: flex;
		align-items: center;
		color: var(--icon-color);
	}

	.icon-button:hover,
	.delete-button:hover {
		color: var(--icon-hover-color);
	}

	.delete-button {
		color: darkred;
	}

	.delete-button:hover {
		color: red;
	}

	.icon-button[title]::after {
		content: attr(title);
		position: absolute;
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

	.icon-button:hover[title]::after {
		opacity: 1;
	}
	.is-invalid {
		border-color: red;
	}
	.input-group {
		position: relative;
	}

	.error-message {
		position: absolute;
		color: #ff0019;
		font-size: 0.875rem;
	}
</style>
