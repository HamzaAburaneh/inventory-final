<script>
	import ItemForm from '../../components/ItemForm.svelte';
	import SearchBar from '../../components/SearchBar.svelte';
	import Table from '../../components/Table.svelte';
	import Pagination from '../../components/Pagination.svelte';
	import { getPaginationStore } from '../../stores/paginationStore';
	import { getSearchStore } from '../../stores/searchStore';
	import { itemStore } from '../../stores/itemStore';
	import { notificationStore } from '../../stores/notificationStore';
	import { applySorting } from '../../lib/items';
	import { onMount } from 'svelte';
	import { blur } from 'svelte/transition';

	// UI state
	let currentSortColumn = $state('name');
	let sortAscending = $state(true);
	let itemsLoaded = $state(false);
	let tableLoading = $state(false);
	let isEditingInProgress = $state(false);
	let showEditModal = $state(false);
	let editData = $state({ id: null, field: '', value: '', title: '' });
	let editButtonPosition = $state(null);

	// Pagination store
	const paginationStore = getPaginationStore('manageItems');
	const { currentPage, itemsPerPage, setTotalItems } = paginationStore;

	// Search store
	const searchStore = getSearchStore('manageItems');
	const { setSearchTerm, clearSearch } = searchStore;

	// Store values as reactive state
	let items = $state([]);
	let searchTermValue = $state('');
	let latestNotification = $state(null);

	// Subscribe to stores
	$effect(() => {
		const unsubscribeItems = itemStore.subscribe((value) => {
			items = value;
		});
		const unsubscribeSearch = searchStore.subscribe((value) => {
			searchTermValue = value;
		});
		const unsubscribeNotification = notificationStore.subscribe((value) => {
			latestNotification = value?.[value.length - 1] || null;
		});

		return () => {
			unsubscribeItems();
			unsubscribeSearch();
			unsubscribeNotification();
		};
	});

	// Derived computations
	const filteredItemsList = $derived.by(() => {
		if (!searchTermValue) return items;
		const lowerTerm = searchTermValue.toLowerCase();
		return items.filter(item => item.name.toLowerCase().includes(lowerTerm));
	});

	const totalInventoryValue = $derived.by(() => {
		return filteredItemsList.reduce((total, item) => {
			const count = parseFloat(item.count) || 0;
			const cost = parseFloat(item.cost) || 0;
			return total + (count * cost);
		}, 0);
	});

	const formatCurrency = (value) => {
		return new Intl.NumberFormat('en-CA', {
			style: 'currency',
			currency: 'CAD',
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		}).format(value);
	};

	const capitalizeColumn = (column) => {
		return column.replace(/([A-Z])/g, ' $1').trim().toUpperCase();
	};

	// Update pagination total when filtered list changes
	$effect(() => {
		setTotalItems(filteredItemsList.length);
	});

	const sortedItems = $derived.by(() => {
		if (currentSortColumn === 'totalValue') {
			return [...filteredItemsList].sort((a, b) => {
				const aValue = (a.count || 0) * (a.cost || 0);
				const bValue = (b.count || 0) * (b.cost || 0);
				return sortAscending ? aValue - bValue : bValue - aValue;
			});
		}
		return applySorting(filteredItemsList, currentSortColumn, sortAscending);
	});

	const paginatedItemsList = $derived.by(() => {
		if ($itemsPerPage === 'all') return sortedItems;
		const startIndex = ($currentPage - 1) * $itemsPerPage;
		return sortedItems.slice(startIndex, startIndex + $itemsPerPage);
	});

	// Load items on mount
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
	};

	const handleSearch = (value) => {
		tableLoading = true;
		setSearchTerm(value);
		paginationStore.setCurrentPage(1);
		setTimeout(() => tableLoading = false, 300);
	};

	const handleClearSearch = () => {
		tableLoading = true;
		clearSearch();
		setTimeout(() => tableLoading = false, 300);
	};

	const sortBy = (column) => {
		tableLoading = true;
		if (currentSortColumn === column) {
			sortAscending = !sortAscending;
		} else {
			currentSortColumn = column;
			sortAscending = true;
		}
		setTimeout(() => tableLoading = false, 300);
	};

	const handlePageChange = () => {
		tableLoading = true;
		setTimeout(() => tableLoading = false, 300);
	};
</script>

<svelte:head>
	<title>Item Manager | Inventory</title>
</svelte:head>

<div class="page-viewport-wrapper">
	<div class="glow-layer"></div>
	<div class="content-container">
		<header class="page-header">
			<div class="title-group">
				<h1 class="main-title">Item Manager</h1>
				<div class="system-status">
					<span class="status-dot"></span>
					<span class="status-text">SYSTEM SECURE</span>
				</div>
			</div>
		</header>

		<div class="form-frame">
			<ItemForm onAdd={handleItemAdd} />
		</div>

		<div class="ledger-actions">
			<div class="stats-ribbon">
				<div class="ribbon-item">
					<span class="ribbon-label">ITEMS:</span>
					<div class="ribbon-value">
						{#key items.length}
							<div class="count-context text-update">
								<span class="digital-font">{filteredItemsList.length}</span>
								<span class="count-separator">/</span>
								<span class="count-total">{items.length}</span>
							</div>
						{/key}
					</div>
				</div>
				<div class="ribbon-item">
					<span class="ribbon-label">TOTAL VALUE:</span>
					<div class="ribbon-value">
						{#key totalInventoryValue}
							<span class="digital-font text-update">
								{formatCurrency(totalInventoryValue)}
							</span>
						{/key}
					</div>
				</div>
				<div class="ribbon-item">
					<span class="ribbon-label">SORTING:</span>
					<div class="ribbon-value">
						{#key currentSortColumn}
							<span class="text-update">
								{capitalizeColumn(currentSortColumn)}
							</span>
						{/key}
						{#key sortAscending}
							<span class="order-tag text-update">
								{sortAscending ? 'ASC' : 'DESC'}
							</span>
						{/key}
					</div>
				</div>
			</div>

			<div class="search-primary">
				<SearchBar
					searchValue={searchTermValue}
					onSearch={handleSearch}
					onClear={handleClearSearch}
					placeholder="Search items..."
				/>
			</div>
		</div>

		<div class="table-frame">
			{#if !itemsLoaded}
				<div class="ledger-loading">
					<div class="pulse-ring"></div>
					<span class="loading-text">LOADING INVENTORY...</span>
				</div>
			{:else if paginatedItemsList.length === 0}
				<div class="null-state">
					<i class="fas fa-search-minus"></i>
					<p>NO ITEMS MATCHED.</p>
				</div>
			{:else}
				<Table
					paginatedItems={paginatedItemsList}
					onEdit={handleEdit}
					onDelete={handleDelete}
					{sortBy}
					{currentSortColumn}
					{sortAscending}
					loading={!itemsLoaded || tableLoading}
				/>
			{/if}
		</div>

		<div class="footer-extension">
			<Pagination store={paginationStore} globalTotal={items.length} onPageChange={handlePageChange} />
		</div>
	</div>
</div>

{#if latestNotification}
	<div class="notification {latestNotification.type}">
		<div class="notification-content">
			<i class="fas {latestNotification.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
			<span>{latestNotification.message}</span>
		</div>
	</div>
{/if}

{#if showEditModal}
	<button
		type="button"
		class="modal-backdrop"
		onclick={closeEditModal}
		onkeydown={(e) => e.key === 'Escape' && closeEditModal()}
		aria-label="Close modal"
	></button>
	<div class="modal-overlay" style="left: 50%; top: 50%;">
		<form class="edit-modal" onsubmit={confirmEdit}>
			<h3>{editData.title}</h3>
			{#if editData.field === 'storageType'}
				<select bind:value={editData.value} class="edit-input" required>
					<option value="Dry Storage">Dry Storage</option>
					<option value="Refrigerator">Refrigerator</option>
					<option value="Freezer">Freezer</option>
				</select>
			{:else if editData.field === 'booths'}
				<div class="booths-edit-container">
					<div class="booths-container">
						{#each [{ value: 'freshly', label: 'Freshly', color: '#10B981' }, { value: 'b1', label: 'B1', color: '#3B82F6' }, { value: 'b2', label: 'B2', color: '#8B5CF6' }, { value: 'jakes', label: 'Jakes', color: '#F59E0B' }, { value: 'epic', label: 'Epic', color: '#EF4444' }, { value: 'pulled', label: 'Pulled', color: '#6B7280' }] as booth}
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
				<button type="button" class="cancel-btn" onclick={closeEditModal}> Cancel </button>
				<button type="submit" class="confirm-btn"> Confirm </button>
			</div>
		</form>
	</div>
{/if}

<style>
	:global(body) {
		background-color: var(--tech-bg-end) !important;
		background-image: radial-gradient(circle at 50% -10%, var(--tech-bg-start) 0%, var(--tech-bg-end) 100%) !important;
		background-attachment: fixed !important;
		margin: 0;
		padding: 0;
		overflow-x: hidden;
	}

	.page-viewport-wrapper {
		position: relative;
		min-height: 100vh;
		width: 100%;
		display: flex;
		flex-direction: column;
		box-sizing: border-box;
	}

	.glow-layer {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100vh;
		background: radial-gradient(circle at 50% 0%, var(--tech-accent-muted) 0%, transparent 50%);
		pointer-events: none;
		z-index: 0;
	}

	.content-container {
		position: relative;
		z-index: 2;
		max-width: 1400px;
		margin: 0 auto;
		width: 100%;
		padding: 3rem 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		flex-wrap: wrap;
		gap: 2rem;
	}

	.main-title {
		font-size: 2.5rem;
		font-weight: 800;
		color: var(--tech-title);
		margin: 0;
		letter-spacing: -0.05em;
		text-transform: uppercase;
		line-height: 1;
	}

	.system-status {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-top: 0.8rem;
		opacity: 0.8;
	}

	.status-dot {
		width: 6px;
		height: 6px;
		background: var(--tech-accent);
		border-radius: 50%;
		box-shadow: 0 0 10px var(--tech-accent-muted);
		animation: pulse-soft 3s ease-in-out infinite;
	}

	@keyframes pulse-soft {
		0%, 100% { opacity: 0.4; transform: scale(0.9); }
		50% { opacity: 1; transform: scale(1.1); }
	}

	.status-text {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.6rem;
		color: var(--tech-status-text);
		letter-spacing: 0.2em;
	}

	.form-frame {
		margin-bottom: 1rem;
	}

	.ledger-actions {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		flex-wrap: wrap;
		gap: 2rem;
	}

	.stats-ribbon {
		display: flex;
		align-items: center;
		gap: 3rem;
	}

	.search-primary {
		flex: 1;
		display: flex;
		justify-content: flex-end;
		max-width: 600px;
	}

	.ribbon-item {
		display: flex;
		align-items: baseline;
		gap: 0.75rem;
		opacity: 0.6;
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		cursor: default;
	}

	.ribbon-item:hover {
		opacity: 1;
		transform: translateY(-1px);
	}

	.ribbon-label {
		color: var(--tech-label);
		font-family: 'JetBrains Mono', monospace;
		font-weight: 800;
		font-size: 0.65rem;
		letter-spacing: 0.1em;
	}

	.ribbon-value {
		color: var(--tech-value);
		font-family: 'JetBrains Mono', monospace;
		font-weight: 700;
		font-size: 0.85rem;
		transition: color 0.3s ease;
		display: inline-flex;
		align-items: baseline;
		gap: 0.4rem;
		min-width: fit-content;
	}
	
	/* Prevent layout shift by reserving space for dynamic content */
	.ribbon-item:nth-child(1) .ribbon-value {
		min-width: 80px; /* Reserve space for item counts */
	}
	
	.ribbon-item:nth-child(2) .ribbon-value {
		min-width: 120px; /* Reserve space for currency values */
	}
	
	.ribbon-item:nth-child(3) .ribbon-value {
		min-width: 160px; /* Reserve space for sorting column + order */
	}

	.ribbon-item:hover .ribbon-value {
		color: var(--tech-accent);
	}

	.digital-font {
		color: var(--tech-accent);
		text-shadow: 0 0 15px var(--tech-accent-muted);
	}

	.count-context {
		display: flex;
		align-items: baseline;
		gap: 0.35rem;
	}

	.count-separator {
		color: var(--tech-label);
		font-size: 0.7rem;
		opacity: 0.5;
	}

	.count-total {
		color: var(--tech-label);
		font-size: 0.8rem;
		opacity: 0.8;
	}

	.text-update {
		animation: subtle-glow 0.6s cubic-bezier(0.23, 1, 0.32, 1);
		display: inline-block;
	}

	.order-tag {
		color: var(--tech-label);
		font-size: 0.7rem;
	}

	@keyframes subtle-glow {
		0% { 
			color: var(--tech-accent); 
			text-shadow: 0 0 12px var(--tech-accent-muted);
		}
		100% { 
			text-shadow: 0 0 0px transparent;
		}
	}

	.table-frame {
		position: relative;
		background: var(--tech-glass-bg);
		border: 1px solid var(--tech-glass-border);
		border-radius: 12px;
		min-height: 500px;
		overflow: hidden;
		box-shadow: var(--tech-glass-shadow);
	}

	.ledger-loading, .null-state {
		height: 500px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2rem;
	}

	.pulse-ring {
		width: 44px;
		height: 44px;
		border: 3px solid var(--tech-cell-border);
		border-top-color: var(--tech-accent);
		border-radius: 50%;
		animation: spin 1s infinite linear;
	}

	@keyframes spin { to { transform: rotate(360deg); } }

	.loading-text {
		color: var(--tech-accent);
		font-family: 'JetBrains Mono', monospace;
		font-weight: 700;
		letter-spacing: 0.3em;
		font-size: 0.7rem;
	}

	.null-state { color: var(--tech-label); }
	.null-state i { font-size: 3rem; opacity: 0.5; }
	.null-state p { 
		font-family: 'JetBrains Mono', monospace; 
		font-size: 0.8rem; 
		letter-spacing: 0.15em;
		font-weight: 700;
	}

	/* Footer */
	.ledger-footer {
		display: flex;
		justify-content: center;
		align-items: center;
		padding: 1.5rem 0;
		border-top: 1px solid var(--tech-cell-border);
		margin-top: 1rem;
	}

	/* Notifications */
	.notification {
		position: fixed;
		bottom: 2rem;
		right: 2rem;
		z-index: 1000;
		background: var(--tech-glass-bg);
		border: 1px solid var(--tech-glass-border);
		border-radius: 8px;
		padding: 1rem 1.5rem;
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
		animation: slide-in 0.4s cubic-bezier(0.16, 1, 0.3, 1);
	}

	@keyframes slide-in {
		from { transform: translateX(100%); opacity: 0; }
		to { transform: translateX(0); opacity: 1; }
	}

	.notification-content {
		display: flex;
		align-items: center;
		gap: 1rem;
		color: var(--tech-value);
		font-weight: 700;
		font-size: 0.9rem;
	}

	.notification.success i { color: #22c55e; }
	.notification.error i { color: #ef4444; }

	/* Custom edit modal */
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background-color: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(4px);
		z-index: 9999;
		border: none;
	}

	.modal-overlay {
		position: fixed;
		transform: translate(-50%, -50%);
		z-index: 10000;
		width: 100%;
		max-width: 400px;
		pointer-events: none;
	}

	.edit-modal {
		background: var(--tech-bg-start);
		border-radius: 12px;
		padding: 2rem;
		box-shadow: 0 20px 50px rgba(0,0,0,0.5);
		border: 1px solid var(--tech-accent-muted);
		pointer-events: auto;
	}

	.edit-modal h3 {
		margin: 0 0 1.5rem 0;
		color: var(--tech-title);
		font-size: 1.25rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.edit-input {
		width: 100%;
		padding: 0.875rem 1rem;
		border: 1px solid var(--tech-glass-border);
		border-radius: 6px;
		background: var(--tech-badge-bg);
		color: var(--tech-value);
		font-size: 1rem;
		margin-bottom: 1.5rem;
		font-family: 'JetBrains Mono', monospace;
	}

	.edit-input:focus {
		outline: none;
		border-color: var(--tech-accent);
		box-shadow: 0 0 10px var(--tech-accent-muted);
	}

	.modal-buttons {
		display: flex;
		gap: 1rem;
	}

	.modal-buttons button {
		flex: 1;
		padding: 0.875rem 1rem;
		border: 1px solid transparent;
		border-radius: 6px;
		font-size: 0.8rem;
		font-weight: 800;
		cursor: pointer;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		font-family: 'JetBrains Mono', monospace;
		transition: all 0.2s;
	}

	.cancel-btn {
		background: var(--tech-badge-bg);
		color: var(--tech-label);
		border-color: var(--tech-glass-border);
	}

	.cancel-btn:hover {
		background: var(--tech-header-bg);
		color: var(--tech-value);
	}

	.confirm-btn {
		background: var(--tech-accent-muted);
		color: var(--tech-accent);
		border-color: var(--tech-accent-muted);
	}

	.confirm-btn:hover {
		background: var(--tech-accent);
		color: var(--tech-bg-start);
	}

	.booths-container {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.75rem;
		margin-bottom: 1.5rem;
	}

	.booth-option {
		position: relative;
		cursor: pointer;
	}

	.booth-checkbox {
		position: absolute;
		opacity: 0;
	}

	.booth-card {
		display: flex;
		align-items: center;
		padding: 0.75rem;
		background: var(--tech-badge-bg);
		border: 1px solid var(--tech-glass-border);
		border-radius: 6px;
		transition: all 0.2s;
	}

	.booth-indicator {
		width: 3px;
		height: 12px;
		background: var(--booth-color);
		margin-right: 0.75rem;
		border-radius: 2px;
	}

	.booth-name {
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--tech-label);
		text-transform: uppercase;
	}

	.booth-checkbox:checked + .booth-card {
		border-color: var(--booth-color);
		background: rgba(255, 255, 255, 0.05);
	}

	.booth-checkbox:checked + .booth-card .booth-name {
		color: var(--tech-value);
	}

	@media (max-width: 768px) {
		.main-title { font-size: 1.8rem; }
		.stats-ribbon { gap: 1rem; flex-wrap: wrap; }
		.ledger-actions { align-items: stretch; }
	}
</style>
