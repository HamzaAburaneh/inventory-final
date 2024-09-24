<script lang="ts">
	import { onMount } from 'svelte';
	import Swal from 'sweetalert2';
	import ItemForm from '../../components/ItemForm.svelte';
	import SearchBar from '../../components/SearchBar.svelte';
	import Table from '../../components/Table.svelte';
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
		items = applySorting(items, currentSortColumn, sortAscending);
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
	const handleItemAdd = async (event) => {
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
		// Apply sorting before paginating
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

	const handleSearch = async (value: string) => {
		searchValue = value;
		if (searchValue.trim()) {
			// Filter items directly within handleSearch
			items = await searchItems(searchValue);
		} else {
			// If search is cleared, get all items again
			items = await getItems();
		}
		totalItems = items.length; // Update total items after filtering
		updateItemsAndSort(items); // Apply sorting after fetching items
	};

	const handleClearSearch = () => {
		searchValue = '';
		handleSearch(''); // Call handleSearch to reset the items
		updateItemsAndSort(items); // Reapply the sorting after clearing the search
	};

	const sortBy = (column: keyof Item) => {
		sortAscending = currentSortColumn === column ? !sortAscending : true;
		currentSortColumn = column;
		updateItemsAndSort(items);
	};

	$: sortIcon = (column: keyof Item) =>
		currentSortColumn === column ? (sortAscending ? '▲' : '▼') : '↕';

	const handlePrevious = () => {
		if (currentPage > 1) {
			currentPage--;
			updatePaginatedItems();
		}
	};

	const handleNext = () => {
		const maxPage = Math.ceil(totalItems / itemsPerPage);
		if (currentPage < maxPage) {
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
		<ItemForm on:add={handleItemAdd} />

		<SearchBar {searchValue} onSearch={handleSearch} onClear={handleClearSearch} />
		<!-- Update this line to use paginatedItems instead of items -->
		<Table
			{paginatedItems}
			onEdit={handleEdit}
			onDelete={handleDelete}
			{sortBy}
			{currentSortColumn}
			{sortAscending}
		/>
		<div class="flex justify-center mt-4">
			<div class="flex items-center space-x-2">
				<span>Page {currentPage} of {Math.ceil(totalItems / itemsPerPage)}</span>
				<!-- Show current page and total pages -->
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
</style>
