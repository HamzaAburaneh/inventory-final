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
	let editButtonPosition = $state({ x: 0, y: 300 });
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
	
	const totalInventoryValue = $derived(
		filteredItemsList.reduce((total, item) => {
			const count = parseFloat(item.count) || 0;
			const cost = parseFloat(item.cost) || 0;
			return total + (count * cost);
		}, 0)
	);
	
	const formatCurrency = (value) => {
		return new Intl.NumberFormat('en-CA', {
			style: 'currency',
			currency: 'CAD',
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		}).format(value);
	};
	
	$effect(() => {
		preserveScroll();
		setTotalItems(filteredItemsList.length);
		setTimeout(restoreScroll, 0);
	});
	
	const sortedItems = $derived.by(() => {
		if (currentSortColumn === 'totalValue') {
			// Custom sorting for total value (count * cost)
			return [...filteredItemsList].sort((a, b) => {
				const aTotal = (a.count || 0) * (a.cost || 0);
				const bTotal = (b.count || 0) * (b.cost || 0);
				return sortAscending ? aTotal - bTotal : bTotal - aTotal;
			});
		}
		return applySorting(filteredItemsList, currentSortColumn, sortAscending);
	});
	
	const paginatedItemsList = $derived.by(() => {
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
				count: formData.count ? parseInt(formData.count, 10) : 0,
				lowCount: formData.lowCount ? parseInt(formData.lowCount, 10) : 0,
				cost: formData.cost ? parseFloat(parseFloat(formData.cost).toFixed(2)) : 0,
				booths: formData.booths || []
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

	const handleEdit = async (id, field, oldValue, position) => {
		// Prevent multiple simultaneous edit dialogs
		if (isEditingInProgress) {
			return;
		}
		
		isEditingInProgress = true;
		if (position) {
			editButtonPosition = position;
		}
		
		editData = {
			id,
			field,
			value: oldValue != null ? oldValue.toString() : '',
			title: `Edit ${String(field).charAt(0).toUpperCase() + String(field).slice(1)}`
		};
		
		// Normalize storage type values for proper dropdown selection
		if (field === 'storageType' && editData.value) {
			const normalizedValue = editData.value.toLowerCase();
			if (normalizedValue === 'dry storage') editData.value = 'Dry Storage';
			else if (normalizedValue === 'refrigerator') editData.value = 'Refrigerator';
			else if (normalizedValue === 'freezer') editData.value = 'Freezer';
		}
		
		// Handle booths field - keep as array for checkbox editing
		if (field === 'booths') {
			if (Array.isArray(oldValue)) {
				editData.value = [...oldValue];
			} else if (oldValue) {
				editData.value = [oldValue];
			} else {
				editData.value = [];
			}
			editData.title = 'Edit Booths';
		}
		
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
			
			// Convert value to appropriate type based on field
			let processedValue = value;
			if (field === 'count' || field === 'lowCount') {
				processedValue = parseInt(value, 10) || 0;
			} else if (field === 'cost') {
				processedValue = parseFloat(value) || 0;
			} else if (field === 'booths') {
				// Value is already an array from checkbox binding
				processedValue = Array.isArray(value) ? value : [];
			}
			
			// Only update the specific field, not the entire item
			const updateData = { [field]: processedValue };
			await itemStore.updateItem(id, updateData);
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
					<span class="stats-text total-value">Total Value: {formatCurrency(totalInventoryValue)}</span>
				</div>
			</div>

			<div class="search-section">
				<SearchBar searchValue={searchTermValue} onSearch={handleSearch} onClear={handleClearSearch} />
			</div>

			<div class="table-section">
				<Table
					paginatedItems={paginatedItemsList}
					onEdit={handleEdit}
					onDelete={handleDelete}
					{sortBy}
					{currentSortColumn}
					{sortAscending}
				/>
				<!-- Debug info -->
				<div style="display: none;">
					Filtered: {filteredItemsList.length}, Sorted: {sortedItems.length}, Paginated: {paginatedItemsList.length}
				</div>
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
	<div class="modal-backdrop" onclick={closeEditModal}></div>
	<div class="modal-overlay" style="left: 50%; top: {editButtonPosition?.y || 300}px;">
		<form class="edit-modal" onclick={(e) => e.stopPropagation()} onsubmit={confirmEdit}>
			<h3>{editData.title}</h3>
			{#if editData.field === 'storageType'}
				<select
					bind:value={editData.value}
					class="edit-input"
					required
				>
					<option value="Dry Storage">Dry Storage</option>
					<option value="Refrigerator">Refrigerator</option>
					<option value="Freezer">Freezer</option>
				</select>
			{:else if editData.field === 'booths'}
				<div class="booths-edit-container">
					<div class="booths-container">
						{#each [
							{ value: 'freshly', label: 'Freshly', color: '#10B981' },
							{ value: 'b1', label: 'B1', color: '#3B82F6' },
							{ value: 'b2', label: 'B2', color: '#8B5CF6' },
							{ value: 'jakes', label: 'Jakes', color: '#F59E0B' },
							{ value: 'epic', label: 'Epic', color: '#EF4444' },
							{ value: 'pulled', label: 'Pulled', color: '#6B7280' }
						] as booth}
							<label class="booth-option">
								<input
									type="checkbox"
									value={booth.value}
									bind:group={editData.value}
									class="booth-checkbox"
								/>
								<div class="booth-card" style="--booth-color: {booth.color}">
									<div class="booth-indicator"></div>
									<span class="booth-name">{booth.label}</span>
									<div class="checkmark">
										<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
											<polyline points="20,6 9,17 4,12"></polyline>
										</svg>
									</div>
								</div>
							</label>
						{/each}
					</div>
				</div>
			{:else}
				<input
					type="text"
					bind:value={editData.value}
					class="edit-input"
					placeholder="Enter value..."
					required
				/>
			{/if}
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
	
	.stats-text.total-value {
		background: var(--add-item-color);
		color: #000;
		font-weight: 600;
		border-color: var(--add-item-color);
	}

	.booths-edit-container {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.booths-container {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		gap: 0.75rem;
		margin-top: 0.75rem;
	}

	/* Mobile responsiveness */
	@media (max-width: 640px) {
		.booths-container {
			grid-template-columns: repeat(2, 1fr);
			gap: 0.5rem;
		}
	}

	@media (max-width: 480px) {
		.booths-container {
			grid-template-columns: 1fr;
			gap: 0.5rem;
		}
	}

	.booth-option {
		position: relative;
		cursor: pointer;
	}

	.booth-checkbox {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}

	.booth-card {
		position: relative;
		display: flex;
		align-items: center;
		padding: 0.75rem;
		background: var(--input-bg);
		border: 2px solid var(--input-border-color);
		border-radius: var(--border-radius);
		transition: all 0.2s ease;
		min-height: 50px;
		overflow: hidden;
		width: 100%;
		box-sizing: border-box;
	}

	/* Mobile adjustments */
	@media (max-width: 640px) {
		.booth-card {
			padding: 0.5rem;
			min-height: 45px;
		}
	}

	.booth-card:hover {
		border-color: var(--input-hover-border-color);
		background: var(--input-hover-bg);
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
	}

	.booth-indicator {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 4px;
		background: var(--booth-color);
		opacity: 0.7;
		transition: all 0.2s ease;
	}

	.booth-name {
		flex: 1;
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--text-color);
		margin-left: 0.5rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
	}

	/* Mobile font adjustments */
	@media (max-width: 640px) {
		.booth-name {
			font-size: 0.8rem;
			margin-left: 0.4rem;
		}
	}

	@media (max-width: 480px) {
		.booth-name {
			font-size: 0.85rem;
			margin-left: 0.5rem;
		}
	}

	.checkmark {
		opacity: 0;
		color: var(--booth-color);
		transition: all 0.2s ease;
		transform: scale(0.8);
		flex-shrink: 0;
		margin-left: 0.25rem;
	}

	.checkmark svg {
		width: 14px;
		height: 14px;
	}

	/* Mobile checkmark adjustments */
	@media (max-width: 640px) {
		.checkmark svg {
			width: 12px;
			height: 12px;
		}
	}

	.booth-checkbox:checked + .booth-card {
		border-color: var(--booth-color);
		background: color-mix(in srgb, var(--booth-color) 10%, var(--input-bg));
	}

	.booth-checkbox:checked + .booth-card .booth-indicator {
		opacity: 1;
		width: 6px;
	}

	.booth-checkbox:checked + .booth-card .checkmark {
		opacity: 1;
		transform: scale(1);
	}

	.booth-checkbox:checked + .booth-card .booth-name {
		color: var(--booth-color);
	}

	/* Dark mode improvements */
	@media (prefers-color-scheme: dark) {
		.booth-card {
			background: var(--container-bg);
			border-color: var(--table-border-color);
		}

		.booth-card:hover {
			background: var(--hover-bg-color);
			border-color: var(--input-hover-border-color);
		}

		.booth-checkbox:checked + .booth-card {
			background: color-mix(in srgb, var(--booth-color) 15%, var(--container-bg));
			border-color: var(--booth-color);
		}
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
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background-color: rgba(0, 0, 0, 0.4);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		z-index: 9999;
	}

	.modal-overlay {
		position: fixed;
		transform: translate(-50%, -50%);
		z-index: 10000;
	}

	.edit-modal {
		background-color: var(--container-bg); 
		border-radius: var(--border-radius);
		padding: 2rem;
		max-width: 25rem;
		width: 300px;
		box-shadow: 0 0.625rem 1.875rem rgba(0, 0, 0, 0.4);
		border: none;
		position: relative;
		z-index: 10001;
		backdrop-filter: none;
		-webkit-backdrop-filter: none;
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
		margin-top: 1.5rem;
		margin-bottom: 1rem;
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
