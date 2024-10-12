<script lang="ts">
	import { onMount } from 'svelte';
	import Swal from 'sweetalert2';
	import ItemForm from '../../components/ItemForm.svelte';
	import SearchBar from '../../components/SearchBar.svelte';
	import Table from '../../components/Table.svelte';
	import Pagination from '../../components/Pagination.svelte';
	import { paginationStore, paginatedItems } from '../../stores/paginationStore';
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

	$: filteredItems = searchValue.trim()
		? items.filter((item) => item.name.toLowerCase().includes(searchValue.toLowerCase()))
		: items;

	$: {
		paginationStore.setTotalItems(filteredItems.length);
	}

	$: paginatedItemsList = $paginatedItems(filteredItems);

	onMount(async () => {
		items = await getItems();
		if (!items.every((item) => item.id)) {
			console.error('Some items have empty IDs:', items);
		}
		if (new Set(items.map((item) => item.id)).size !== items.length) {
			console.error('Duplicate IDs found:', items);
		}
		items = applySorting(items, currentSortColumn, sortAscending);
		itemsLoaded = true;
	});

	const handleItemAdd = async (event: CustomEvent<{ formData: Omit<Item, 'id'> }>) => {
		const { formData } = event.detail;
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
				...formData,
				cost: formData.cost ? parseFloat(parseFloat(formData.cost).toFixed(2)) : 0
			};
			const addedItem = await addItem(newItem);
			updateItemsAndSort([...items, addedItem]);
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

	const handleSearch = async (value: string) => {
		searchValue = value;
		if (searchValue.trim()) {
			items = await searchItems(searchValue);
		} else {
			items = await getItems();
		}
		paginationStore.setCurrentPage(1);
		updateItemsAndSort(items);
	};

	const handleClearSearch = () => {
		searchValue = '';
		handleSearch('');
		updateItemsAndSort(items);
	};

	const sortBy = (column: keyof Item) => {
		sortAscending = currentSortColumn === column ? !sortAscending : true;
		currentSortColumn = column;
		updateItemsAndSort(items);
	};

	const updateItemsAndSort = (updatedItems: Item[]) => {
		const uniqueItems = Array.from(new Set(updatedItems.map((item) => item.id))).map(
			(id) => updatedItems.find((item) => item.id === id)!
		);
		items = applySorting(uniqueItems, currentSortColumn, sortAscending);
	};

	const handleItemsPerPageChange = (event: Event) => {
		const select = event.target as HTMLSelectElement;
		const newItemsPerPage = select.value === 'all' ? 'all' : parseInt(select.value);
		paginationStore.setItemsPerPage(newItemsPerPage);
	};
</script>

{#if itemsLoaded}
	<div
		class="container mx-auto p-4 rounded-lg shadow-md bg-container mt-4"
		in:fadeAndSlide={{ duration: 300, y: 75 }}
	>
		<ItemForm on:add={handleItemAdd} />

		<SearchBar {searchValue} onSearch={handleSearch} onClear={handleClearSearch} />

		<div
			class="top-controls flex flex-col sm:flex-row justify-between items-center mb-4 space-y-2 sm:space-y-0"
		>
			<div class="filter-legend text-white">
				{filteredItems.length} results of {items.length} total items.
			</div>
			<select
				bind:value={$paginationStore.itemsPerPage}
				on:change={handleItemsPerPageChange}
				class="bg-zinc-700 text-white rounded-lg p-2"
			>
				{#each $paginationStore.itemsPerPageOptions as option}
					<option value={option}>{option === 'all' ? 'All' : option} per page</option>
				{/each}
			</select>
		</div>

		<Table
			paginatedItems={paginatedItemsList}
			onEdit={handleEdit}
			onDelete={handleDelete}
			{sortBy}
			{currentSortColumn}
			{sortAscending}
		/>

		<Pagination />
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

	.top-controls {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}

	.filter-legend {
		font-size: 0.9rem;
		color: #949494;
	}
</style>
