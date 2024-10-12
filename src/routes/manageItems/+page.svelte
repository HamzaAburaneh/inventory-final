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

	$: totalPages = Math.ceil(totalItems / itemsPerPage);
	$: visiblePageNumbers = getVisiblePageNumbers(currentPage, totalPages);

	function getVisiblePageNumbers(current: number, total: number) {
		if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

		if (current <= 4) return [1, 2, 3, 4, 5, '...', total];
		if (current >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total];

		return [1, '...', current - 1, current, current + 1, '...', total];
	}

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

		totalItems = items.length;
		currentPage = 1;
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
		updatePaginatedItems();
	};

	const goToPage = (page: number) => {
		if (page >= 1 && page <= totalPages) {
			currentPage = page;
			updatePaginatedItems();
		}
	};
</script>

{#if itemsLoaded}
	<div
		class="container mx-auto p-4 rounded-lg shadow-md bg-container mt-4"
		in:fadeAndSlide={{ duration: 300, y: 75 }}
	>
		<ItemForm on:add={handleItemAdd} />

		<SearchBar {searchValue} onSearch={handleSearch} onClear={handleClearSearch} />
		<Table
			{paginatedItems}
			onEdit={handleEdit}
			onDelete={handleDelete}
			{sortBy}
			{currentSortColumn}
			{sortAscending}
		/>

		<!-- Enhanced Pagination Controls -->
		<div class="pagination-controls mt-6 flex flex-col sm:flex-row justify-between items-center">
			<div class="flex items-center space-x-2 mb-4 sm:mb-0">
				<button
					class="pagination-button"
					on:click={() => goToPage(currentPage - 1)}
					disabled={currentPage === 1}
				>
					Previous
				</button>
				{#each visiblePageNumbers as pageNum}
					{#if typeof pageNum === 'number'}
						<button
							class="pagination-button"
							class:active={pageNum === currentPage}
							on:click={() => goToPage(pageNum)}
						>
							{pageNum}
						</button>
					{:else}
						<span class="pagination-ellipsis">...</span>
					{/if}
				{/each}
				<button
					class="pagination-button"
					on:click={() => goToPage(currentPage + 1)}
					disabled={currentPage === totalPages}
				>
					Next
				</button>
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

	/* Pagination styles */
	.pagination-controls {
		flex-wrap: wrap;
	}

	.pagination-button {
		color: white;
		font-weight: bold;
		padding: 0.5rem 0.75rem;
		border-radius: 0.375rem;
		transition: background-color 0.3s ease;
	}

	.pagination-button:hover:not(:disabled) {
		background-color: #1d4ed8;
	}

	.pagination-button.active {
		background-color: #1d4ed8;
	}

	.pagination-ellipsis {
		color: white;
		padding: 0.5rem 0.25rem;
	}

	@media (max-width: 640px) {
		.pagination-controls {
			flex-direction: column;
			align-items: stretch;
		}

		.pagination-controls > * {
			margin-bottom: 1rem;
		}
	}
</style>
