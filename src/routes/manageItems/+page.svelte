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
	import { fadeAndSlide } from '$lib/transitions';
	import { fly, fade } from 'svelte/transition';
	import { Pagination } from 'flowbite-svelte';

	let items: Item[] = [];
	let formData: Omit<Item, 'id'> = {
		name: '',
		barcode: '',
		count: '',
		lowCount: '',
		cost: '',
		storageType: '' as '' | 'freezer' | 'refrigerator' | 'dry storage'
	};

	let errors: Partial<Record<keyof typeof formData, string>> = {};
	let searchValue = '';
	let currentSortColumn: keyof Item = 'name';
	let sortAscending = true;
	let itemsLoaded = false;
	let currentPage = 1;
	let itemsPerPage = 10;
	let totalItems = 0;
	let paginatedItems: Item[] = [];

	onMount(async () => {
		items = await getItems();
		if (!items.every((item) => item.id)) {
			console.error('Some items have empty IDs:', items);
		}
		if (new Set(items.map((item) => item.id)).size !== items.length) {
			console.error('Duplicate IDs found:', items);
		}
		updatePaginatedItems();
		itemsLoaded = true;
	});

	$: {
		if (items) {
			updatePaginatedItems();
		}
	}

	const updatePaginatedItems = () => {
		const startIndex = (currentPage - 1) * itemsPerPage;
		const endIndex = startIndex + itemsPerPage;
		paginatedItems = items.slice(startIndex, endIndex);
		totalItems = items.length;
	};

	const validateField = (field: keyof typeof formData, value: any) => {
		const validations: Partial<Record<keyof typeof formData, () => string>> = {
			name: () => (value.trim().length < 3 ? 'Name must be at least 3 characters' : ''),
			count: () =>
				isNaN(parseInt(value)) || parseInt(value) < 0 ? 'Must be a positive number' : '',
			lowCount: () =>
				isNaN(parseInt(value)) || parseInt(value) < 0 ? 'Must be a positive number' : '',
			cost: () =>
				isNaN(parseFloat(value)) || parseFloat(value) < 0 ? 'Must be a non-negative number' : ''
		};
		errors[field] = validations[field] ? validations[field]() : '';
	};

	const handleInput = (
		event: Event,
		field: keyof typeof formData,
		allowDecimal: boolean = false
	) => {
		let value = (event.target as HTMLInputElement).value;
		if (allowDecimal) {
			value = value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
			const [integer, decimal] = value.split('.');
			value = decimal ? `${integer}.${decimal.slice(0, 2)}` : value;
		} else {
			value = value.replace(/\D/g, '');
		}
		formData[field] = value;
		validateField(field, value);
	};

	const updateItemsAndSort = (updatedItems: Item[]) => {
		// Ensure no duplicate IDs are present
		const uniqueItems = Array.from(new Set(updatedItems.map((item) => item.id))).map(
			(id) => updatedItems.find((item) => item.id === id)!
		);
		if (!uniqueItems.every((item) => item.id)) {
			console.error('Some unique items have empty IDs:', uniqueItems);
		}
		if (new Set(uniqueItems.map((item) => item.id)).size !== uniqueItems.length) {
			console.error('Duplicate IDs found in uniqueItems:', uniqueItems);
		}
		items = applySorting(uniqueItems, currentSortColumn, sortAscending);
		updatePaginatedItems();
	};

	const handleAdd = async () => {
		if (formData.name.trim() === '') {
			await Swal.fire({
				icon: 'error',
				title: 'Empty Item Name',
				text: 'Item name cannot be empty.'
			});
			return;
		}
		if (items.some((item) => item.name.toLowerCase() === formData.name.toLowerCase())) {
			await Swal.fire({
				icon: 'error',
				title: 'Duplicate Item',
				text: 'Item with this name already exists.'
			});
			return;
		}
		try {
			const newItem: Omit<Item, 'id'> = {
				name: formData.name,
				barcode: formData.barcode,
				count: formData.count,
				lowCount: formData.lowCount,
				cost: formData.cost ? parseFloat(parseFloat(formData.cost).toFixed(2)) : 0,
				storageType: formData.storageType
			};
			const addedItem = await addItem(newItem);
			updateItemsAndSort([...items, addedItem]);
			formData = { name: '', barcode: '', count: '', lowCount: '', cost: '', storageType: '' };
			errors = {};
		} catch (error) {
			if (error instanceof Error) {
				await Swal.fire({
					icon: 'error',
					title: 'Error',
					text: error.message
				});
			}
		}
	};

	const handleDelete = async (id: string) => {
		await deleteItem(id);
		updateItemsAndSort(items.filter((item) => item.id !== id));
	};

	const handleEdit = async (id: string, field: keyof Item, oldValue: any) => {
		const result = await Swal.fire({
			title: `Edit ${String(field).charAt(0).toUpperCase() + String(field).slice(1)}`,
			input: 'text',
			inputValue: oldValue != null ? oldValue.toString() : '',
			showCancelButton: true,
			confirmButtonText: 'Confirm'
		});
		if (result.isConfirmed) {
			await updateItem(id, field, result.value);
		}
	};

	const updateItem = async (id: string, field: keyof Item, value: any) => {
		const updateFunctions: Record<keyof Item, (id: string, newValue: any) => Promise<void>> = {
			cost: editItemCost,
			barcode: editItemBarcode,
			name: editItemName,
			count: async (id, newValue) => {
				/* Implement if necessary */
			},
			lowCount: editItemLowCount,
			storageType: editItemStorageType
		};
		await updateFunctions[field](
			id,
			field === 'cost' || field === 'lowCount' ? Number(value) : value
		);
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

	$: sortIcon = (column: keyof Item) =>
		currentSortColumn === column ? (sortAscending ? '▲' : '▼') : '↕';

	const clearSearch = () => {
		searchValue = '';
		handleSearch();
	};

	const handlePrevious = () => {
		if (currentPage > 1) {
			currentPage--;
			updatePaginatedItems();
		}
	};

	const handleNext = () => {
		if (currentPage < Math.ceil(totalItems / itemsPerPage)) {
			currentPage++;
			updatePaginatedItems();
		}
	};

	const handlePageClick = (event: CustomEvent<number>) => {
		currentPage = event.detail;
		updatePaginatedItems();
	};
</script>

{#if itemsLoaded}
	<div
		class="container mx-auto p-4 rounded-lg shadow-md bg-container mt-4"
		in:fadeAndSlide={{ duration: 300, y: 75 }}
	>
		<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
			<div class="form-group">
				<label for="name" class="form-label"><span>Name</span></label>
				<div class="input-wrapper">
					<input
						id="name"
						class="form-control-input {errors.name ? 'is-invalid' : ''}"
						bind:value={formData.name}
						placeholder="Enter item name"
						on:input={() => validateField('name', formData.name)}
					/>
					{#if errors.name}
						<div
							class="error-message"
							in:fly={{ y: -10, duration: 200 }}
							out:fade={{ duration: 100 }}
						>
							{errors.name}
						</div>
					{/if}
				</div>
			</div>

			<div class="form-group">
				<label for="barcode" class="form-label"><span>Barcode</span></label>
				<div class="input-wrapper">
					<input
						id="barcode"
						class="form-control-input {errors.barcode ? 'is-invalid' : ''}"
						bind:value={formData.barcode}
						placeholder="Enter barcode"
					/>
				</div>
			</div>

			<div class="form-group">
				<label for="count" class="form-label"><span>Item Count</span></label>
				<div class="input-wrapper">
					<input
						id="count"
						class="form-control-input {errors.count ? 'is-invalid' : ''}"
						type="text"
						bind:value={formData.count}
						pattern="^[0-9]*$"
						placeholder="Enter item count"
						on:input={(event) => handleInput(event, 'count')}
					/>
					{#if errors.count}
						<div class="error-message" transition:fly={{ y: -10, duration: 200 }}>
							{errors.count}
						</div>
					{/if}
				</div>
			</div>

			<div class="form-group">
				<label for="lowCount" class="form-label"><span>Low Item</span></label>
				<div class="input-wrapper">
					<input
						id="lowCount"
						class="form-control-input {errors.lowCount ? 'is-invalid' : ''}"
						type="text"
						bind:value={formData.lowCount}
						pattern="^[0-9]*$"
						placeholder="Enter low stock threshold"
						on:input={(event) => handleInput(event, 'lowCount')}
					/>
					{#if errors.lowCount}
						<div class="error-message" transition:fly={{ y: -10, duration: 200 }}>
							{errors.lowCount}
						</div>
					{/if}
				</div>
			</div>

			<div class="form-group">
				<label for="cost" class="form-label"><span>Cost</span></label>
				<div class="input-wrapper">
					<input
						id="cost"
						class="form-control-input {errors.cost ? 'is-invalid' : ''}"
						type="text"
						bind:value={formData.cost}
						placeholder="Enter item cost"
						on:input={(event) => handleInput(event, 'cost', true)}
					/>
					{#if errors.cost}
						<div class="error-message" transition:fly={{ y: -10, duration: 200 }}>
							{errors.cost}
						</div>
					{/if}
				</div>
			</div>

			<div class="form-group">
				<label for="storageType" class="form-label"><span>Storage Type</span></label>
				<div class="input-wrapper">
					<select
						id="storageType"
						class="form-control-input {errors.storageType ? 'is-invalid' : ''}"
						bind:value={formData.storageType}
						class:placeholder-selected={!formData.storageType}
					>
						<option value="" disabled>Select storage type...</option>
						<option value="Freezer">Freezer</option>
						<option value="Refrigerator">Refrigerator</option>
						<option value="Dry">Dry Storage</option>
					</select>
				</div>
			</div>

			<div class="form-group col-span-full">
				<button class="btn btn-primary w-full" id="add-item" on:click={handleAdd}>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="16"
						height="16"
						fill="currentColor"
						class="bi bi-plus"
						viewBox="0 0 16 16"
					>
						<path
							d="M8 7V1a1 1 0 0 1 2 0v6h6a1 1 0 0 1 0 2H10v6a1 1 0 0 1-2 0V9H2a1 1 0 0 1 0-2h6z"
						/>
					</svg>Add Item</button
				>
			</div>
		</div>

		<div class="search-container mb-4 relative">
			<div class="search-wrapper relative flex">
				<input
					id="search"
					class="form-control search-input"
					bind:value={searchValue}
					placeholder="Search Items"
					on:input={handleSearch}
				/>
				{#if searchValue}
					<button class="clear-button flex items-center justify-center" on:click={clearSearch}>
						<svg
							class="h-5 w-5 text-gray-500"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M6 18L18 6M6 6l12 12"
							></path>
						</svg>
					</button>
				{/if}
			</div>
		</div>
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
						<tr class="table-row">
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
	</div>
{/if}

<style>
	/* Base styles */
	.container {
		margin-top: 20px;
		padding: 2.5rem;
		max-width: 90%;
		background-color: var(--container-bg);
		box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
		border-radius: 1rem;
	}

	/* Form styles */
	.form-group {
		position: relative;
		display: flex;
		flex-direction: column;
		margin-bottom: 2rem;
	}
	.placeholder-selected {
		color: #888 !important;
	}
	.form-label {
		margin-bottom: 0.5rem;
		font-weight: 600;
		color: var(--label-color);
		font-size: 0.875rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.form-label span {
		cursor: pointer;
	}

	.input-wrapper {
		position: relative;
		width: 100%;
	}

	.form-control-input,
	.form-control,
	.search-input {
		width: 100%;
		padding: 0.75rem;
		border: 2px solid #333; /* Lightened border color */
		border-radius: 0.5rem;
		background-color: #222; /* Lightened background color */
		color: #fff;
		font-size: 1rem;
		transition:
			border-color 0.3s ease,
			box-shadow 0.3s ease,
			transform 0.2s ease;
	}

	.is-invalid {
		border-color: #ff0019 !important; /* Red error border color */
	}

	.form-control-input,
	.search-input {
		cursor: text;
	}

	.form-control-input::placeholder,
	.form-control::placeholder,
	.search-input::placeholder {
		color: #888; /* Lightened placeholder color */
	}

	/* Hover and focus states */
	.input-wrapper:hover .form-control-input:not(:focus),
	.search-wrapper:hover .search-input:not(:focus) {
		border-color: #555; /* Lightened hover border color */
		box-shadow: 0 0 0 1px #555;
		transform: scale(1.02);
	}

	.form-control-input:focus,
	.form-control:focus,
	search-input:focus {
		transform: scale(1.02);
		outline: none;
		border-color: #007bff; /* Focus border color matching button */
		box-shadow: 0 0 0 1px #007bff;
	}
	.form-control-input.is-invalid:focus {
		border-color: #ff0019 !important; /* Red error border color */
		box-shadow: 0 0 0 1px #ff0019 !important;
	}
	.form-control-input.is-invalid:hover {
		border-color: #ff0019 !important; /* Red error border color */
		box-shadow: 0 0 0 1px #ff0019 !important;
	}
	/* Search styles */
	.search-container {
		display: flex;
		justify-content: center;
		width: 100%;
	}

	.search-wrapper {
		width: 65%;
		display: flex;
		transition: width 0.3s ease;
		position: relative;
	}

	.search-input {
		flex-grow: 1;
		min-width: 200px;
		padding: 0.75rem 1rem;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	}

	/* Clear button styles */
	.clear-button {
		background: none;
		border: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--icon-color);
		transition: color 0.3s ease;
		width: 2rem;
		height: 100%;
		position: absolute;
		right: 0;
		top: 0;
		padding: 0;
	}

	.clear-button svg {
		width: 1rem;
		height: 1rem;
	}

	.clear-button:hover {
		color: var(--icon-hover-color);
	}
	.fixed-height-table {
		height: 35rem; /* Set the desired fixed height */
		overflow-y: auto; /* Add vertical scroll */
		display: block;
	}

	.fixed-height-table table {
		width: 100%;
		border-collapse: collapse;
	}

	.error-message {
		border: 1px solid #ff0019; /* Red error border color */
		padding: 0.75rem;
		position: absolute;
		top: 100%;
		left: 0;
		margin-top: 0.25rem;
		padding: 0.5rem;
		color: #fff;
		background-color: #ff0019;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		width: 100%;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	}

	/* Add item button styles */
	#add-item {
		background-color: #007bff; /* Primary blue color */
		color: #fff;
		font-weight: 700;
		border-radius: 1rem;
		padding: 0.5rem 1rem;
		border: none;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
		cursor: pointer;
		text-align: center;
		font-size: 0.875rem;
		max-width: 25%;
		margin: 2rem auto 0 auto;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		text-transform: uppercase;
		transition:
			all 0.3s ease,
			transform 0.2s ease;
	}

	#add-item svg {
		fill: currentColor;
	}

	#add-item:hover {
		transform: translateY(-4px) scale(1.05);
		box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
		background-color: #0056b3; /* Darker blue on hover */
	}

	#add-item:active {
		transform: translateY(0);
	}

	/* Table styles */
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

	/* Icon and delete button styles */
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

	/* Media query */
	@media (min-width: 640px) {
		#add-item {
			font-size: 1rem;
			padding: 0.75rem 1.5rem;
		}
	}
</style>
