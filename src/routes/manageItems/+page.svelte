<script>
	import Swal from 'sweetalert2';
	import ItemForm from '../../components/ItemForm.svelte';
	import SearchBar from '../../components/SearchBar.svelte';
	import Table from '../../components/Table.svelte';
	import Pagination from '../../components/Pagination.svelte';
	import { paginationStore } from '../../stores/paginationStore';
	import { itemStore } from '../../stores/itemStore';
	import { searchTerm, setSearchTerm, clearSearch } from '../../stores/searchStore';
	import { notificationStore } from '../../stores/notificationStore';
	import { fadeAndSlide } from '$lib/transitions';
	import { fade } from 'svelte/transition';
	import { applySorting, addTestItems } from '../../lib/items';
	import { get } from 'svelte/store';

	let formData = $state({
		name: '',
		barcode: '',
		count: '',
		lowCount: '',
		cost: '',
		storageType: ''
	});

	let errors = $state({});
	let currentSortColumn = $state('name');
	let sortAscending = $state(true);
	let itemsLoaded = $state(false);
	
	// Store values as reactive state
	let items = $state([]);
	let searchTermValue = $state('');
	let currentPage = $state(1);
	let itemsPerPage = $state(10);
	let notificationValue = $state(null);
	
	// Subscribe to stores
	$effect(() => {
		const unsubscribeItems = itemStore.subscribe(value => {
			items = value;
		});
		const unsubscribeSearch = searchTerm.subscribe(value => {
			searchTermValue = value;
		});
		const unsubscribePage = paginationStore.currentPage.subscribe(value => {
			currentPage = value;
		});
		const unsubscribeItemsPerPage = paginationStore.itemsPerPage.subscribe(value => {
			itemsPerPage = value;
		});
		const unsubscribeNotification = notificationStore.subscribe(value => {
			notificationValue = value;
		});
		
		return () => {
			unsubscribeItems();
			unsubscribeSearch();
			unsubscribePage();
			unsubscribeItemsPerPage();
			unsubscribeNotification();
		};
	});

	const filteredItemsList = $derived(
		items.filter(item =>
			item.name.toLowerCase().includes(searchTermValue.toLowerCase()) ||
			item.barcode.toLowerCase().includes(searchTermValue.toLowerCase())
		)
	);
	
	$effect(() => {
		paginationStore.setTotalItems(filteredItemsList.length);
	});
	
	const sortedItems = $derived(applySorting(filteredItemsList, currentSortColumn, sortAscending));
	
	const paginatedItemsList = $derived(() => {
		if (itemsPerPage === 'all') {
			return sortedItems;
		}
		const startIndex = (currentPage - 1) * itemsPerPage;
		const endIndex = startIndex + itemsPerPage;
		return sortedItems.slice(startIndex, endIndex);
	});

	$effect(async () => {
		await itemStore.loadItems();
		itemsLoaded = true;
	});

	const handleItemAdd = async ({ formData }) => {
		if (items.some((item) => item.name.toLowerCase() === formData.name.toLowerCase())) {
			notificationStore.showNotification('Item with this name already exists.', 'error');
			return;
		}
		try {
			const newItem = {
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

	const handleDelete = async (id) => {
		await itemStore.deleteItem(id);
		notificationStore.showNotification('Item deleted successfully!', 'success');
	};

	const handleEdit = async (id, field, oldValue) => {
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

	const updateItem = async (id, field, value) => {
		try {
			const item = items.find((item) => item.id === id);
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

	const handleSearch = (value) => {
		setSearchTerm(value);
		paginationStore.setCurrentPage(1);
	};

	const handleClearSearch = () => {
		clearSearch();
	};

	const sortBy = (column) => {
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
		<ItemForm onAdd={handleItemAdd} />

		<SearchBar searchValue={searchTermValue} onSearch={handleSearch} onClear={handleClearSearch} />

		<div class="filter-legend text-white mb-4">
			{filteredItemsList.length} results of {items.length} total items.
		</div>

		<div class="table-container">
			<Table
				paginatedItems={paginatedItemsList()}
				onEdit={handleEdit}
				onDelete={handleDelete}
				{sortBy}
				{currentSortColumn}
				{sortAscending}
			/>
		</div>

		<Pagination />
	</div>
{:else}
	<div class="flex justify-center items-center h-screen">
		<div class="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-gray-900"></div>
	</div>
{/if}
{#if notificationValue}
	<div class="notification {notificationValue.type}" in:fade out:fade>
		{notificationValue.message}
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
		bottom: 20px;
		right: 20px;
		color: white;
		padding: 1rem 2rem;
		border-radius: 0.5rem;
		z-index: 1000;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
	}

	.notification.success {
		background-color: var(--add-item-color); /* Green */
	}

	.notification.error {
		background-color: #dc3545; /* Red */
	}

	.notification.warning {
		background-color: #ffc107; /* Yellow */
		color: #333; /* Dark text for contrast */
	}

	.notification.info {
		background-color: #17a2b8; /* Blue */
	}
</style>
