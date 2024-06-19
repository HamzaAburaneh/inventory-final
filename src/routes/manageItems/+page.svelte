<script lang="ts">
	import { onMount } from 'svelte';
	import Swal from 'sweetalert2';
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
	let count: string = '';
	let lowCount: string = '';
	let cost: number | null = null;
	let storageType: '' | 'freezer' | 'refrigerator' | 'dry storage' = '';
	let searchValue = '';
	let currentSortColumn: keyof Item;
	let sortAscending = true;

	onMount(async () => {
		items = await getItems();
	});

	const validateField = (field: string, value: any) => {
		switch (field) {
			case 'name':
				errors.name = value.trim().length < 3 ? 'Name must be at least 3 characters' : '';
				break;
			case 'count':
			case 'lowCount':
				const intValue = parseInt(value);
				errors[field] = isNaN(intValue) || intValue < 0 ? 'Must be a positive number' : '';
				break;
			default:
				break;
		}
	};

	const handleInput = (
		event: Event,
		setValue: (value: string) => void,
		validate: (value: string) => void
	) => {
		const inputValue = (event.target as HTMLInputElement).value;
		const sanitizedValue = inputValue.replace(/\D/g, '');
		setValue(sanitizedValue);
		validate(sanitizedValue);
	};

	const updateItemsAndSort = (updatedItems: Item[]) => {
		items = applySorting(updatedItems, currentSortColumn, sortAscending);
	};

	const handleAdd = async () => {
		const newItem = { name, barcode, count, lowCount, cost, storageType };
		const id = await addItem(newItem);
		const item: Item = { id, ...newItem };

		updateItemsAndSort([...items, item]);
		resetForm();
	};

	const resetForm = () => {
		name = '';
		barcode = '';
		count = '';
		lowCount = '';
		cost = null;
		storageType = '';
	};

	const handleDelete = async (id: string) => {
		await deleteItem(id);
		updateItemsAndSort(items.filter((item) => item.id !== id));
	};

	const handleEdit = async (
		id: string,
		field: keyof Item,
		oldValue: any,
		inputType: string = 'text'
	) => {
		const result = await Swal.fire({
			title: `Edit ${field.charAt(0).toUpperCase() + field.slice(1)}`,
			input: inputType,
			inputValue: oldValue != null ? oldValue.toString() : '',
			showCancelButton: true,
			confirmButtonText: 'Confirm'
		});
		if (result.isConfirmed) {
			const newValue = result.value;
			await updateItem(id, field, newValue);
		}
	};

	const updateItem = async (id: string, field: keyof Item, value: any) => {
		switch (field) {
			case 'cost':
				await editItemCost(id, Number(value));
				break;
			case 'barcode':
				await editItemBarcode(id, value);
				break;
			case 'name':
				await editItemName(id, value);
				break;
			case 'lowCount':
				await editItemLowCount(id, Number(value));
				break;
			case 'storageType':
				await editItemStorageType(id, value);
				break;
			default:
				break;
		}
		updateItemsAndSort(items.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
	};

	const handleSearch = async () => {
		updateItemsAndSort(await searchItems(searchValue));
	};

	const sortBy = (column: keyof Item) => {
		sortAscending = currentSortColumn === column ? !sortAscending : true;
		currentSortColumn = column;
		updateItemsAndSort(items);
	};

	$: sortIcon = (column) => {
		if (currentSortColumn === column) {
			return sortAscending ? '▲' : '▼';
		}
		return '↕';
	};
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
					on:input={() => validateField('name', name)}
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
					type="text"
					bind:value={count}
					pattern="^[0-9]*$"
					placeholder="Enter item count"
					on:input={(event) =>
						handleInput(
							event,
							(value) => (count = value),
							(value) => validateField('count', value)
						)}
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
				type="text"
				bind:value={lowCount}
				pattern="^[0-9]*$"
				placeholder="Enter low stock threshold"
				on:input={(event) =>
					handleInput(
						event,
						(value) => (lowCount = value),
						(value) => validateField('lowCount', value)
					)}
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
				type="number"
				bind:value={cost}
				placeholder="Enter item cost"
			/>
		</div>
		<div class="form-group">
			<label for="storageType" class="form-label">Storage Type</label>
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
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.form-group {
		display: flex;
		flex-direction: column;
		margin-bottom: 1.5rem;
		position: relative;
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
		font-weight: normal; /* Ensure font weight is normal */
	}

	.form-control:focus {
		outline: none;
		border-color: var(--focus-border-color); /* Add your desired focus border color */
		box-shadow: 0 0 0 2px var(--focus-border-color); /* Optional: Add a custom focus shadow */
		color: var(--input-text); /* Ensure text color remains clear */
		font-weight: normal; /* Ensure font weight remains normal */
	}

	.input-group {
		position: relative;
	}

	.error-message {
		position: absolute;
		top: 100%;
		left: 0;
		color: #ff0019;
		font-size: 0.875rem;
		margin-top: 0.25rem;
	}

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

	.is-invalid:focus {
		border-color: red;
		box-shadow: none; /* Optional: Remove any shadow if present */
	}
</style>
