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

	const confirmEdit = async (event) => {
		event.preventDefault();
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
	<div class="page-container" in:fadeAndSlide={{ duration: 300, y: 75 }}>
		<!-- Form Section -->
		<div class="form-section">
			<ItemForm onAdd={handleItemAdd} />
		</div>

		<!-- Inventory Section -->
		<div class="inventory-section">
			<div class="inventory-header">
				<h2 class="inventory-title">Inventory Items</h2>
				<div class="inventory-stats">
					<span class="stats-text">{filteredItemsList.length} of {items.length} items</span>
				</div>
			</div>

			<div class="search-section">
				<SearchBar searchValue={searchTermValue} onSearch={handleSearch} onClear={handleClearSearch} />
			</div>

			<div class="table-section">
				<Table
					paginatedItems={paginatedItemsList()}
					onEdit={handleEdit}
					onDelete={handleDelete}
					{sortBy}
					{currentSortColumn}
					{sortAscending}
				/>
			</div>

			<div class="pagination-section">
				<Pagination store={paginationStore} />
			</div>
		</div>
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
		<form class="edit-modal" onsubmit={confirmEdit}>
			<h3>{editData.title}</h3>
			<input
				type="text"
				bind:value={editData.value}
				class="edit-input"
				placeholder="Enter value..."
				required
			/>
			<div class="modal-buttons">
				<button type="button" class="cancel-btn" onclick={closeEditModal}>
					Cancel
				</button>
				<button type="submit" class="confirm-btn">
					Confirm
				</button>
			</div>
		</form>
		<button type="button" class="modal-backdrop" onclick={closeEditModal} aria-label="Close modal"></button>
	</div>
{/if}

<style>
	.page-container {
		max-width: 95%;
		margin: 0 auto;
		padding: 1rem;
		min-height: 100vh;
		width: 100%;
	}

	.form-section {
		margin-bottom: 3rem;
	}

	.inventory-section {
		background: var(--container-bg);
		border-radius: var(--border-radius);
		padding: 0;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
		border: 1px solid var(--table-border-color);
		overflow: hidden;
	}

	.inventory-header {
		background: var(--table-header-bg);
		padding: 1.5rem 2rem;
		border-bottom: 1px solid var(--table-border-color);
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.inventory-title {
		margin: 0;
		font-size: 1.375rem;
		font-weight: 700;
		color: var(--table-header-text);
		letter-spacing: -0.025em;
	}

	.inventory-stats {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.stats-text {
		font-size: 0.875rem;
		color: var(--text-color-dimmed);
		font-weight: 500;
		padding: 0.5rem 1rem;
		background: var(--hover-bg-color);
		border-radius: var(--border-radius);
		border: 1px solid var(--table-border-color);
	}

	.search-section {
		padding: 1.5rem 2rem;
		border-bottom: 1px solid var(--table-border-color);
	}

	.table-section {
		padding: 0;
	}

	.pagination-section {
		padding: 1.5rem 2rem;
		border-top: 1px solid var(--table-border-color);
		background: var(--hover-bg-color);
	}

	.notification {
		position: fixed;
		bottom: 20px;
		right: 20px;
		color: white;
		padding: 1rem 2rem;
		border-radius: var(--border-radius);
		z-index: 1000;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
		font-weight: 500;
	}

	.notification.success {
		background: var(--add-item-color);
	}

	.notification.error {
		background: #dc3545;
	}

	.notification.warning {
		background: #ffc107;
		color: #333;
	}

	.notification.info {
		background: var(--nav-logo-color);
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
		backdrop-filter: blur(4px);
	}

	.modal-backdrop {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background-color: rgba(0, 0, 0, 0.6);
		z-index: 1;
	}

	.edit-modal {
		background-color: var(--container-bg);
		border-radius: var(--border-radius);
		padding: 2rem;
		margin: 1rem;
		max-width: 400px;
		width: 90%;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
		border: 1px solid var(--table-border-color);
		position: relative;
		z-index: 2;
	}

	.edit-modal h3 {
		margin: 0 0 1rem 0;
		color: var(--text-color);
		font-size: 1.25rem;
		font-weight: 700;
	}

	.edit-input {
		width: 100%;
		padding: 0.875rem 1rem;
		border: 2px solid var(--input-border-color);
		border-radius: var(--border-radius);
		background-color: var(--input-bg);
		color: var(--input-text);
		font-size: 1rem;
		margin-bottom: 1.5rem;
		transition: all 0.2s ease;
	}

	.edit-input:focus {
		outline: none;
		border-color: var(--focus-border-color);
		box-shadow: 0 0 0 2px rgba(74, 144, 226, 0.2);
	}

	.modal-buttons {
		display: flex;
		gap: 1rem;
	}

	.modal-buttons button {
		flex: 1;
		padding: 0.875rem 1rem;
		border: none;
		border-radius: var(--border-radius);
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.cancel-btn {
		background-color: var(--hover-bg-color);
		color: var(--text-color);
		border: 1px solid var(--table-border-color);
	}

	.cancel-btn:hover {
		background-color: var(--table-row-hover-bg);
	}

	.confirm-btn {
		background: var(--nav-logo-color);
		color: white;
	}

	.confirm-btn:hover {
		background: var(--nav-logo-hover-color);
		transform: translateY(-1px);
	}

	/* Responsive Design */
	@media (min-width: 640px) {
		.page-container {
			max-width: 98%;
			padding: 1.5rem;
		}
	}

	@media (min-width: 768px) {
		.page-container {
			max-width: 96%;
			padding: 2rem;
		}
		
		.inventory-header {
			padding: 2rem 2.5rem;
		}
		
		.search-section {
			padding: 2rem 2.5rem;
		}
		
		.pagination-section {
			padding: 2rem 2.5rem;
		}
		
		.inventory-title {
			font-size: 1.5rem;
		}
	}

	@media (min-width: 1024px) {
		.page-container {
			max-width: 94%;
			padding: 2.5rem;
		}
		
		.form-section {
			margin-bottom: 4rem;
		}
	}

	@media (min-width: 1280px) {
		.page-container {
			max-width: 92%;
			padding: 3rem;
		}
	}

	@media (min-width: 1536px) {
		.page-container {
			max-width: 90%;
			padding: 3.5rem;
		}
	}
</style>
