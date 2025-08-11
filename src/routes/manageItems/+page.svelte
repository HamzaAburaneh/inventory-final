<script>
	import ItemForm from '../../components/ItemForm.svelte';
	import SearchBar from '../../components/SearchBar.svelte';
	import Table from '../../components/Table.svelte';
	import Pagination from '../../components/Pagination.svelte';
	import { getPaginationStore } from '../../stores/paginationStore';
	import { itemStore } from '../../stores/itemStore';
	import { searchTerm, setSearchTerm, clearSearch } from '../../stores/searchStore';
	import { notificationStore } from '../../stores/notificationStore';
	import { fadeAndSlide } from '$lib/transitions';
	import { fade } from 'svelte/transition';
	import { applySorting, addTestItems } from '../../lib/items';
	import { get } from 'svelte/store';

	let formData = $state({
		name: '',
		count: '',
		lowCount: '',
		cost: '',
		storageType: ''
	});

	let errors = $state({});
	let currentSortColumn = $state('name');
	let sortAscending = $state(true);
	let itemsLoaded = $state(false);
	let isEditingInProgress = $state(false);
	let showEditModal = $state(false);
	let editData = $state({ id: null, field: '', value: '', title: '' });
	let scrollPreservationActive = $state(false);
	
	const paginationStore = getPaginationStore('manageItems');
	const { currentPage, itemsPerPage, setTotalItems } = paginationStore;

	// Store values as reactive state
	let items = $state([]);
	let searchTermValue = $state('');
	let notificationValue = $state(null);
	
	// Global scroll preservation
	let lastScrollPosition = 0;
	
	function preserveScroll() {
		lastScrollPosition = window.pageYOffset || document.documentElement.scrollTop;
		scrollPreservationActive = true;
	}
	
	function restoreScroll() {
		if (scrollPreservationActive && lastScrollPosition > 0) {
			requestAnimationFrame(() => {
				window.scrollTo(0, lastScrollPosition);
				scrollPreservationActive = false;
			});
		}
	}

	// Subscribe to stores
	$effect(() => {
		const unsubscribeItems = itemStore.subscribe(value => {
			preserveScroll();
			items = value;
			setTimeout(restoreScroll, 0);
		});
		const unsubscribeSearch = searchTerm.subscribe(value => {
			preserveScroll();
			searchTermValue = value;
			setTimeout(restoreScroll, 0);
		});
		const unsubscribeNotification = notificationStore.subscribe(value => {
			notificationValue = value;
		});
		
		return () => {
			unsubscribeItems();
			unsubscribeSearch();
			unsubscribeNotification();
		};
	});

	const filteredItemsList = $derived(
		items.filter(item =>
			item.name.toLowerCase().includes(searchTermValue.toLowerCase())
		)
	);
	
	$effect(() => {
		preserveScroll();
		setTotalItems(filteredItemsList.length);
		setTimeout(restoreScroll, 0);
	});
	
	const sortedItems = $derived(applySorting(filteredItemsList, currentSortColumn, sortAscending));
	
	const paginatedItemsList = $derived(() => {
		if ($itemsPerPage === 'all') {
			return sortedItems;
		}
		const startIndex = ($currentPage - 1) * $itemsPerPage;
		const endIndex = startIndex + $itemsPerPage;
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
		// Prevent multiple simultaneous edit dialogs
		if (isEditingInProgress) {
			return;
		}
		
		isEditingInProgress = true;
		
		editData = {
			id,
			field,
			value: oldValue != null ? oldValue.toString() : '',
			title: `Edit ${String(field).charAt(0).toUpperCase() + String(field).slice(1)}`
		};
		
		showEditModal = true;
	};

	const confirmEdit = async () => {
		try {
			await updateItem(editData.id, editData.field, editData.value);
		} finally {
			closeEditModal();
		}
	};

	const closeEditModal = () => {
		showEditModal = false;
		editData = { id: null, field: '', value: '', title: '' };
		isEditingInProgress = false;
	};

	const updateItem = async (id, field, value) => {
		preserveScroll();
		
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
		
		// Restore scroll after all updates complete
		setTimeout(restoreScroll, 100);
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

		<Pagination store={paginationStore} />
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

{#if showEditModal}
	<div class="modal-overlay">
		<form class="edit-modal" on:submit|preventDefault={confirmEdit}>
			<h3>{editData.title}</h3>
			<input
				type="text"
				bind:value={editData.value}
				class="edit-input"
				placeholder="Enter value..."
				required
			/>
			<div class="modal-buttons">
				<button type="button" class="cancel-btn" on:click={closeEditModal}>
					Cancel
				</button>
				<button type="submit" class="confirm-btn">
					Confirm
				</button>
			</div>
		</form>
		<div class="modal-backdrop" on:click={closeEditModal}></div>
	</div>
{/if}

<style>
	.filter-legend {
		font-size: 0.9rem;
		color: #949494;
	}

	.container {
		margin-top: 20px;
		padding: 1rem;
		max-width: 90%;
		background-color: var(--container-bg);
		box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
		border-radius: 1rem;
	}

	.table-container {
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
	@media (min-width: 768px) {
		.container {
			padding: 2.5rem;
			max-width: 90%;
		}
	}

	/* Custom edit modal */
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		z-index: 10000;
		display: flex;
		justify-content: center;
		align-items: center;
	}

	.modal-backdrop {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background-color: rgba(0, 0, 0, 0.5);
		z-index: 1;
	}

	.edit-modal {
		background-color: var(--container-bg);
		border-radius: 12px;
		padding: 2rem;
		margin: 1rem;
		max-width: 400px;
		width: 90%;
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
		border: 1px solid var(--table-border-color);
		position: relative;
		z-index: 2;
	}

	.edit-modal h3 {
		margin: 0 0 1rem 0;
		color: var(--text-color);
		font-size: 1.25rem;
	}

	.edit-input {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid var(--table-border-color);
		border-radius: 8px;
		background-color: var(--input-bg);
		color: var(--text-color);
		font-size: 1rem;
		margin-bottom: 1.5rem;
	}

	.edit-input:focus {
		outline: none;
		border-color: #3085d6;
		box-shadow: 0 0 0 2px rgba(48, 133, 214, 0.2);
	}

	.modal-buttons {
		display: flex;
		gap: 1rem;
	}

	.modal-buttons button {
		flex: 1;
		padding: 0.75rem 1rem;
		border: none;
		border-radius: 8px;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
		touch-action: manipulation;
		-webkit-tap-highlight-color: transparent;
		user-select: none;
		-webkit-user-select: none;
		-moz-user-select: none;
		-ms-user-select: none;
	}

	.cancel-btn {
		background-color: var(--table-border-color);
		color: var(--text-color);
	}

	.cancel-btn:hover {
		background-color: var(--hover-bg-color);
	}

	.confirm-btn {
		background-color: #3085d6;
		color: white;
	}

	.confirm-btn:hover {
		background-color: #2574c7;
		transform: translateY(-1px);
	}
</style>
