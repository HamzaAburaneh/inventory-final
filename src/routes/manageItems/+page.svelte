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
	import ItemForm from '../../components/ItemForm.svelte';
	import ItemTable from '../../components/ItemTable.svelte';
	import SearchBar from '../../components/SearchBar.svelte';

	let items: Item[] = [];
	let currentSortColumn: keyof Item = 'name';
	let sortAscending = true;
	let itemsLoaded = false;
	let currentPage = 1;
	let itemsPerPage = 10;

	onMount(async () => {
		items = await getItems();
		itemsLoaded = true;
	});

	const handleAddItem = async (event: CustomEvent<Omit<Item, 'id'>>) => {
		const newItem = event.detail;
		if (items.some((item) => item.name.toLowerCase() === newItem.name.toLowerCase())) {
			await Swal.fire({
				icon: 'error',
				title: 'Duplicate Item',
				text: 'Item with this name already exists.'
			});
			return;
		}
		try {
			const addedItem = await addItem(newItem);
			items = applySorting([...items, addedItem], currentSortColumn, sortAscending);
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

	const handleDeleteItem = async (event: CustomEvent<string>) => {
		const id = event.detail;
		await deleteItem(id);
		items = applySorting(
			items.filter((item) => item.id !== id),
			currentSortColumn,
			sortAscending
		);
	};

	const handleEditItem = async (
		event: CustomEvent<{ id: string; field: keyof Item; oldValue: any }>
	) => {
		const { id, field, oldValue } = event.detail;
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
		items = applySorting(
			items.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
			currentSortColumn,
			sortAscending
		);
	};

	const handleSearch = async (event: CustomEvent<string>) => {
		const searchValue = event.detail;
		items = await searchItems(searchValue);
	};

	const handleSort = (event: CustomEvent<keyof Item>) => {
		const column = event.detail;
		sortAscending = currentSortColumn === column ? !sortAscending : true;
		currentSortColumn = column;
		items = applySorting(items, currentSortColumn, sortAscending);
	};
</script>

{#if itemsLoaded}
	<div
		class="container mx-auto p-4 rounded-lg shadow-md bg-container mt-4"
		in:fadeAndSlide={{ duration: 300, y: 75 }}
	>
		<ItemForm on:addItem={handleAddItem} />
		<SearchBar on:search={handleSearch} />
		<ItemTable
			{items}
			{currentSortColumn}
			{sortAscending}
			{currentPage}
			{itemsPerPage}
			on:edit={handleEditItem}
			on:delete={handleDeleteItem}
			on:sort={handleSort}
		/>
	</div>
{/if}

<style>
	:global(:root) {
		--container-bg: #121212;
		--label-color: #cccccc;
		--table-border-color: #333333;
		--icon-color: #888888;
		--icon-hover-color: #ffffff;
	}

	.container {
		margin-top: 20px;
		padding: 2.5rem;
		max-width: 90%;
		background-color: var(--container-bg);
		box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
		border-radius: 1rem;
	}

	@media (min-width: 640px) {
		:global(#add-item) {
			font-size: 1rem;
			padding: 0.75rem 1.5rem;
		}
	}
</style>
