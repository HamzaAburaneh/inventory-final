<script lang="ts">
	import { onMount } from 'svelte';
	import Swal from 'sweetalert2';
	import ItemForm from '../../components/ItemForm.svelte';
	import SearchBar from '../../components/SearchBar.svelte';
	import Table from '../../components/Table.svelte';
	import Pagination from '../../components/Pagination.svelte';
	import { paginationStore, paginatedItems } from '../../stores/paginationStore';
	import { itemStore, filteredItems } from '../../stores/itemStore';
	import { searchStore } from '../../stores/searchStore';
	import { notificationStore } from '../../stores/notificationStore';
	import type { Item } from '../../types';
	import { fadeAndSlide } from '$lib/transitions';
	import { fade } from 'svelte/transition';
	import { applySorting, addTestItems } from '../../lib/items';

	let formData: Omit<Item, 'id'> = {
		name: '',
		barcode: '',
		count: '',
		lowCount: '',
		cost: '',
		storageType: '' as '' | 'freezer' | 'refrigerator' | 'dry storage'
	};

	let errors: Partial<Record<keyof typeof formData, string>> = {};
	let currentSortColumn: string = 'name';
	let sortAscending = true;
	let itemsLoaded = false;

	$: filteredItemsList = $filteredItems($searchStore);
	$: {
		paginationStore.setTotalItems(filteredItemsList.length);
	}
	$: sortedItems = applySorting(filteredItemsList, currentSortColumn as keyof Item, sortAscending);
	$: paginatedItemsList = $paginatedItems(sortedItems);

	onMount(async () => {
		await itemStore.fetchItems();
		if ($itemStore.length === 0) {
			console.log('Adding test items...');
			await addTestItems();
			await itemStore.fetchItems();
			console.log('Test items added successfully.');
		}
		itemsLoaded = true;
	});

	const handleItemAdd = async (event: CustomEvent<{ formData: Omit<Item, 'id'> }>) => {
		const { formData } = event.detail;
		if ($itemStore.some((item) => item.name.toLowerCase() === formData.name.toLowerCase())) {
			notificationStore.showNotification('Item with this name already exists.', 'error');
			return;
		}
		try {
			const newItem: Omit<Item, 'id'> = {
				...formData,
				cost: formData.cost ? parseFloat(parseFloat(formData.cost).toFixed(2)) : 0
			};
			await itemStore.addItem(newItem);
			notificationStore.showNotification('Item added successfully!', 'success');
		} catch (error) {
			if (error instanceof Error) {
				notificationStore.showNotification(error.message, 'error');
			}
		}
	};

	const handleDelete = async (id: string) => {
		await itemStore.deleteItem(id);
		notificationStore.showNotification('Item deleted successfully!', 'success');
	};

	const handleEdit = async (id: string, field: keyof Item, oldValue: any) => {
		const result = await Swal.fire({
			title: `Edit ${String(field).charAt(0).toUpperCase() + String(field).slice(1)}`,
			input: 'text',
			inputValue: oldValue != null ? oldValue.toString() : '',
			showCancelButton: true,
			confirmButtonText: 'Confirm',
			cancelButtonText: 'Cancel',
			confirmButtonColor: '#3085d6',
			cancelButtonColor: '#d33',
			background: '#1a1a1a',
			color: '#FFFFFF'
		});
		if (result.isConfirmed) {
			await updateItem(id, field, result.value);
		}
	};

	const updateItem = async (id: string, field: keyof Item, value: any) => {
		try {
			const item = $itemStore.find((item) => item.id === id);
			if (!item) {
				throw new Error('Item not found');
			}
			const updatedItem = { ...item, [field]: value };
			await itemStore.updateItem(id, updatedItem);
			notificationStore.showNotification('Item updated successfully!', 'success');
		} catch (error) {
			if (error instanceof Error) {
				notificationStore.showNotification(error.message, 'error');
			}
		}
	};

	const handleSearch = (value: string) => {
		searchStore.setSearchTerm(value);
		paginationStore.setCurrentPage(1);
	};

	const handleClearSearch = () => {
		searchStore.clearSearch();
	};

	const sortBy = (column: string) => {
		if (currentSortColumn === column) {
			sortAscending = !sortAscending;
		} else {
			currentSortColumn = column;
			sortAscending = true;
		}
	};
</script>

{#if itemsLoaded}
	<div
		class="container mx-auto p-4 rounded-lg shadow-md bg-container mt-4"
		in:fadeAndSlide={{ duration: 300, y: 75 }}
	>
		<ItemForm on:add={handleItemAdd} />

		<SearchBar searchValue={$searchStore} onSearch={handleSearch} onClear={handleClearSearch} />

		<div class="filter-legend text-white mb-4">
			{filteredItemsList.length} results of {$itemStore.length} total items.
		</div>

		<div class="table-container">
			<Table
				paginatedItems={paginatedItemsList}
				onEdit={handleEdit}
				onDelete={handleDelete}
				{sortBy}
				{currentSortColumn}
				{sortAscending}
			/>
		</div>

		<Pagination />
	</div>
{/if}

{#if $notificationStore}
	<div class="notification" in:fade out:fade>
		{$notificationStore.message}
	</div>
{/if}

<style>
	.filter-legend {
		font-size: 0.9rem;
		color: #949494;
	}

	.container {
		margin-top: 20px;
		padding: 2.5rem;
		max-width: 90%;
		background-color: var(--container-bg);
		box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
		border-radius: 1rem;
	}

	.table-container {
		height: 670px;
		overflow: auto;
		margin-bottom: 1rem;
	}

	.notification {
		position: fixed;
		top: 20px;
		left: 50%;
		transform: translateX(-50%);
		background-color: #38a169;
		color: white;
		padding: 1rem 2rem;
		border-radius: 0.5rem;
		z-index: 1000;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
	}
</style>
