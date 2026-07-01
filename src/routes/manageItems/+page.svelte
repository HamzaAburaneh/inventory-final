<script>
	import ItemForm from '../../components/ItemForm.svelte';
	import SearchBar from '../../components/SearchBar.svelte';
	import Table from '../../components/Table.svelte';
	import TableSkeleton from '../../components/TableSkeleton.svelte';
	import Pagination from '../../components/Pagination.svelte';
	import StorageSelect from '../../components/StorageSelect.svelte';
	import { getPaginationStore } from '../../stores/paginationStore';
	import { itemStore } from '../../stores/itemStore';
	import { createSearchState } from '../../lib/runes/search.svelte.js';
	import { notificationStore } from '../../stores/notificationStore';
	import { fade, fly } from 'svelte/transition';
	import { cubicIn } from 'svelte/easing';
	import { prefersReducedMotion } from 'svelte/motion';
	import { applySorting } from '../../lib/items';
	import { onMount } from 'svelte';

	let currentSortColumn = $state('name');
	let sortAscending = $state(true);
	let itemsLoaded = $state(false);
	let isEditingInProgress = $state(false);
	let showEditModal = $state(false);
	let editData = $state({ id: null, field: '', value: '', title: '' });

	// Field label shown above the input in the edit modal.
	const fieldLabels = {
		name: 'Item Name',
		count: 'Count',
		lowCount: 'Low Alert',
		cost: 'Unit Cost ($)',
		storageType: 'Storage Type',
		booths: 'Booths'
	};

	const paginationStore = getPaginationStore('manageItems');
	const { currentPage, itemsPerPage, setTotalItems } = paginationStore;

	// Reactive store views ($store auto-subscription)
	const search = createSearchState();

	const items = $derived($itemStore);
	const searchTermValue = $derived(search.term);
	const notification = $derived($notificationStore.at(-1) ?? null);
	const reduceMotion = $derived(prefersReducedMotion.current);

	// Global scroll preservation
	let lastScrollPosition = 0;
	let scrollPreservationActive = false;

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

	const filteredItemsList = $derived(
		items.filter((item) => item.name.toLowerCase().includes(searchTermValue.toLowerCase()))
	);

	const totalInventoryValue = $derived(
		filteredItemsList.reduce((total, item) => {
			const count = parseFloat(item.count) || 0;
			const cost = parseFloat(item.cost) || 0;
			return total + count * cost;
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
		setTotalItems(filteredItemsList.length);
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

	onMount(async () => {
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
		preserveScroll();
		search.setTerm(value);
		paginationStore.setCurrentPage(1);
		setTimeout(restoreScroll, 50);
	};

	const handleClearSearch = () => {
		preserveScroll();
		search.clear();
		setTimeout(restoreScroll, 50);
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
	<div class="page-container">
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
					<span class="stats-text total-value"
						>Total Value: {formatCurrency(totalInventoryValue)}</span
					>
				</div>
			</div>

			<div class="search-section">
				<SearchBar
					searchValue={searchTermValue}
					onSearch={handleSearch}
					onClear={handleClearSearch}
				/>
			</div>

			<div class="table-section">
				<Table
					paginatedItems={paginatedItemsList}
					onEdit={handleEdit}
					onDelete={handleDelete}
					{sortBy}
					{currentSortColumn}
					{sortAscending}
					searchKey={searchTermValue}
				/>
			</div>

			<div class="pagination-section">
				<Pagination store={paginationStore} />
			</div>
		</div>
	</div>
{:else}
	<TableSkeleton />
{/if}
{#if notification}
	<div
		class="notification {notification.type}"
		in:fly={{ y: 10, duration: reduceMotion ? 0 : 240 }}
		out:fly={{ y: 10, duration: reduceMotion ? 0 : 160, easing: cubicIn }}
	>
		{notification.message}
	</div>
{/if}

{#snippet fieldIcon(field)}
	{#if field === 'name'}
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"
			></path>
			<line x1="7" y1="7" x2="7.01" y2="7"></line>
		</svg>
	{:else if field === 'count'}
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
			<polyline points="2 17 12 22 22 17"></polyline>
			<polyline points="2 12 12 17 22 12"></polyline>
		</svg>
	{:else if field === 'lowCount'}
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<path
				d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
			></path>
			<line x1="12" y1="9" x2="12" y2="13"></line>
			<line x1="12" y1="17" x2="12.01" y2="17"></line>
		</svg>
	{:else if field === 'cost'}
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<line x1="12" y1="1" x2="12" y2="23"></line>
			<path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
		</svg>
	{:else if field === 'storageType'}
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<path
				d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
			></path>
			<polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
			<line x1="12" y1="22.08" x2="12" y2="12"></line>
		</svg>
	{:else}
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
			<circle cx="12" cy="10" r="3"></circle>
		</svg>
	{/if}
{/snippet}

{#if showEditModal}
	<div
		class="modal-backdrop"
		role="presentation"
		onclick={closeEditModal}
		onkeydown={(e) => e.key === 'Escape' && closeEditModal()}
		in:fade={{ duration: reduceMotion ? 0 : 240 }}
		out:fade={{ duration: reduceMotion ? 0 : 160 }}
	></div>
	<div
		class="modal-overlay"
		in:fly={{ y: 14, duration: reduceMotion ? 0 : 240 }}
		out:fly={{ y: 14, duration: reduceMotion ? 0 : 160, easing: cubicIn }}
	>
		<form class="edit-modal" onsubmit={confirmEdit}>
			<div class="modal-head">
				<span class="modal-icon" aria-hidden="true">{@render fieldIcon(editData.field)}</span>
				<h3>{editData.title}</h3>
			</div>
			<div class="modal-body">
				<span class="modal-label">{fieldLabels[editData.field] ?? 'Value'}</span>
				{#if editData.field === 'storageType'}
					<StorageSelect bind:value={editData.value} />
				{:else if editData.field === 'booths'}
					<div class="booths-container">
						{#each [{ value: 'freshly', label: 'Freshly', color: '#10B981' }, { value: 'b1', label: 'B1', color: '#3B82F6' }, { value: 'b2', label: 'B2', color: '#8B5CF6' }, { value: 'jakes', label: 'Jakes', color: '#F59E0B' }, { value: 'epic', label: 'Epic', color: '#EF4444' }, { value: 'pulled', label: 'Pulled', color: '#6B7280' }] as booth (booth.value)}
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
										<svg
											width="16"
											height="16"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="3"
										>
											<polyline points="20,6 9,17 4,12"></polyline>
										</svg>
									</div>
								</div>
							</label>
						{/each}
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
			</div>
			<div class="modal-buttons">
				<button type="button" class="cancel-btn" onclick={closeEditModal}> Cancel </button>
				<button type="submit" class="confirm-btn"> Confirm </button>
			</div>
		</form>
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
		margin-bottom: 1rem;
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
		padding: 0.6rem 1.25rem;
		border-bottom: 1px solid var(--table-border-color);
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.5rem 1rem;
	}

	.inventory-title {
		margin: 0;
		font-size: 1.05rem;
		font-weight: 700;
		color: var(--text-color);
		letter-spacing: -0.025em;
	}

	.inventory-stats {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.stats-text {
		font-size: 0.8rem;
		color: var(--text-color-dimmed);
		font-weight: 500;
		padding: 0.3rem 0.75rem;
		background: var(--hover-bg-color);
		border-radius: var(--border-radius);
		border: 1px solid var(--table-border-color);
		white-space: nowrap;
	}

	@media (max-width: 640px) {
		.inventory-header {
			flex-direction: column;
			align-items: stretch;
		}

		.inventory-stats {
			width: 100%;
		}

		.stats-text {
			flex: 1;
			text-align: center;
			padding: 0.5rem 0.75rem;
			font-size: 0.8rem;
		}
	}

	.stats-text.total-value {
		background: var(--add-item-color);
		color: var(--add-item-on);
		font-weight: 600;
		border-color: var(--add-item-color);
	}

	.booths-container {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		gap: 0.5rem;
	}

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
		transition: all 0.15s ease-out;
		min-height: 50px;
		overflow: hidden;
		width: 100%;
		box-sizing: border-box;
	}

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
		transition: all 0.15s ease-out;
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
		transition: all 0.15s ease-out;
		transform: scale(0.8);
		flex-shrink: 0;
		margin-left: 0.25rem;
	}

	.checkmark svg {
		width: 14px;
		height: 14px;
	}

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
		padding: 0.75rem 1.25rem;
		border-bottom: 1px solid var(--table-border-color);
	}

	.table-section {
		padding: 0;
	}

	.pagination-section {
		padding: 0.6rem 1.25rem;
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

	/* Edit modal */
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background-color: rgba(0, 0, 0, 0.55);
		z-index: 9999;
	}

	.modal-overlay {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 10000;
	}

	.edit-modal {
		display: flex;
		flex-direction: column;
		background-color: var(--container-bg);
		border-radius: 0.75rem;
		padding: 1.5rem;
		max-width: min(24rem, calc(100vw - 2rem));
		width: 320px;
		box-shadow: 0 0.625rem 1.875rem rgba(0, 0, 0, 0.4);
		border: 1px solid var(--table-border-color);
		position: relative;
		z-index: 10001;
	}

	/* Icon header (field-specific glyph + title). */
	.modal-head {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		margin-bottom: 1.1rem;
	}

	.modal-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 2rem;
		height: 2rem;
		border-radius: 0.5rem;
		background: color-mix(in srgb, var(--add-item-color) 18%, transparent);
		color: var(--add-item-color);
	}

	.modal-icon svg {
		width: 1.1rem;
		height: 1.1rem;
	}

	.edit-modal h3 {
		margin: 0;
		color: var(--text-color);
		font-size: 1.15rem;
		font-weight: 700;
	}

	.modal-body {
		margin-bottom: 1.25rem;
	}

	.modal-label {
		display: block;
		margin-bottom: 0.45rem;
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--text-color);
	}

	.edit-input {
		width: 100%;
		padding: 0.6rem 0.85rem;
		border: 1.5px solid var(--input-border-color);
		border-radius: var(--border-radius);
		background-color: var(--input-bg);
		color: var(--input-text);
		font-size: 0.95rem;
	}

	.edit-input:focus {
		outline: none;
		border-color: var(--add-item-color);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--add-item-color) 30%, transparent);
	}

	.modal-buttons {
		display: flex;
		gap: 0.75rem;
	}

	.modal-buttons button {
		flex: 1;
		padding: 0.6rem 1rem;
		border: none;
		border-radius: 8px;
		font-size: 0.9rem;
		font-weight: 600;
		cursor: pointer;
		transition:
			background-color 0.15s ease-out,
			color 0.15s ease-out,
			transform 0.12s ease-out;
	}

	.modal-buttons button:active {
		transform: scale(0.97);
	}

	@media (prefers-reduced-motion: reduce) {
		.modal-buttons button:active {
			transform: none;
		}
	}

	.modal-buttons button:focus {
		outline: none;
	}

	.modal-buttons button:focus-visible {
		outline: 2px solid var(--add-item-color);
		outline-offset: 2px;
	}

	/* Outline cancel + soft-tint confirm that fills solid on hover (matches the Add
	   button and ConfirmModal conventions). */
	.cancel-btn {
		background: var(--table-border-color);
		color: var(--text-color);
	}

	.cancel-btn:hover {
		background: color-mix(in srgb, var(--table-border-color) 80%, var(--text-color));
	}

	.confirm-btn {
		background: color-mix(in srgb, var(--add-item-color) 18%, transparent);
		color: var(--add-item-color);
	}

	.confirm-btn:hover {
		background: var(--add-item-color);
		color: var(--add-item-on);
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
			padding: 0.7rem 2rem;
		}

		.search-section {
			padding: 0.85rem 2rem;
		}

		.pagination-section {
			padding: 0.7rem 2rem;
		}

		.inventory-title {
			font-size: 1.1rem;
		}
	}

	@media (min-width: 1024px) {
		.page-container {
			max-width: 94%;
			padding: 2.5rem;
		}

		.form-section {
			margin-bottom: 2.5rem;
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
