<script>
	import ItemForm from '../../components/ItemForm.svelte';
	import SearchBar from '../../components/SearchBar.svelte';
	import Table from '../../components/Table.svelte';
	import Pagination from '../../components/Pagination.svelte';
	import ConfirmModal from '../../components/ConfirmModal.svelte';
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

	// Delete modal state
	let deleteModal = $state({
		visible: false,
		itemId: null,
		itemName: '',
		onConfirm: () => {}
	});

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
			// Clean cost string (remove commas) before parsing
			const cleanCost = typeof formData.cost === 'string' ? formData.cost.replace(/,/g, '') : formData.cost;
			
			const newItem = {
				...formData,
				count: formData.count ? parseInt(formData.count, 10) : 0,
				lowCount: formData.lowCount ? parseInt(formData.lowCount, 10) : 0,
				cost: cleanCost ? parseFloat(parseFloat(cleanCost).toFixed(2)) : 0,
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
		const item = items.find(i => i.id === id);
		if (!item) return;

		deleteModal = {
			visible: true,
			itemId: id,
			itemName: item.name,
			onConfirm: async () => {
				await itemStore.deleteItem(id);
				notificationStore.showNotification('Item deleted successfully!', 'success');
				deleteModal.visible = false;
			}
		};
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

		// Handle comprehensive edit mode (all fields)
		if (field === 'all' && typeof oldValue === 'object') {
			const item = oldValue;
			editData = {
				id,
				field: 'all',
				value: {
					name: item.name || '',
					lowCount: item.lowCount != null ? item.lowCount.toString() : '0',
					cost: item.cost != null ? item.cost.toString() : '0',
					storageType: item.storageType || '',
					booths: Array.isArray(item.booths) ? [...item.booths] : []
				},
				title: 'Edit Item'
			};
		} else {
			// Handle single field edit mode
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
		}

		showEditModal = true;
	};

	const confirmEdit = async (event) => {
		event.preventDefault();
		try {
			if (editData.field === 'all') {
				// Update all editable fields at once (excluding count)
				const updates = {};
				const values = editData.value;
				
				// Process each editable field
				updates.name = values.name;
				updates.lowCount = parseInt(values.lowCount, 10) || 0;
				updates.cost = parseFloat(values.cost) || 0;
				updates.storageType = values.storageType;
				updates.booths = Array.isArray(values.booths) ? values.booths : [];
				
				await itemStore.updateItem(editData.id, updates);
				notificationStore.showNotification('Item updated successfully!', 'success');
			} else {
				// Single field update
				await updateItem(editData.id, editData.field, editData.value);
			}
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
	<div class="modal-backdrop" onclick={closeEditModal} transition:blur={{ duration: 200 }}></div>
	<div class="modal-container">
		<form class="tech-modal" onsubmit={confirmEdit} transition:blur={{ duration: 300 }}>
			<div class="modal-header">
				<div class="header-left">
					<div class="header-icon">
						<i class="fas fa-edit"></i>
					</div>
					<h2 class="modal-title">{editData.title}</h2>
				</div>
				<button type="button" class="close-btn" onclick={closeEditModal} aria-label="Close">
					<i class="fas fa-times"></i>
				</button>
			</div>

			<div class="modal-body">
				{#if editData.field === 'all'}
					<!-- Comprehensive Edit Form -->
					<div class="comprehensive-edit-form">
						<div class="form-field">
							<label for="edit-name" class="field-label">Item Name</label>
							<input
								id="edit-name"
								type="text"
								bind:value={editData.value.name}
								class="tech-input"
								placeholder="Enter item name..."
								required
							/>
						</div>

						<div class="form-row">
							<div class="form-field">
								<label for="edit-lowCount" class="field-label">Low Count Alert</label>
								<input
									id="edit-lowCount"
									type="number"
									bind:value={editData.value.lowCount}
									class="tech-input"
									placeholder="0"
									min="0"
								/>
							</div>

							<div class="form-field">
								<label for="edit-cost" class="field-label">Unit Cost ($)</label>
								<input
									id="edit-cost"
									type="number"
									bind:value={editData.value.cost}
									class="tech-input"
									placeholder="0.00"
									step="0.01"
									min="0"
								/>
							</div>
						</div>

						<div class="form-field">
							<label class="field-label">Storage Type</label>
							<div class="storage-type-grid horizontal">
								{#each [
									{ value: 'Freezer', icon: 'fa-snowflake', color: '#3B82F6' },
									{ value: 'Refrigerator', icon: 'fa-temperature-low', color: '#10B981' },
									{ value: 'Dry Storage', icon: 'fa-box', color: '#F59E0B' }
								] as type}
									<label class="storage-node">
										<input
											type="radio"
											name="storageTypeEdit"
											value={type.value}
											bind:group={editData.value.storageType}
											class="hidden-radio"
										/>
										<div class="node-card icon-only">
											<i class="fas {type.icon} storage-icon" style="--type-color: {type.color}"></i>
											<i class="fas fa-check node-check"></i>
										</div>
									</label>
								{/each}
							</div>
						</div>

						<div class="form-field">
							<label class="field-label">Booths</label>
							<div class="booths-container compact">
								{#each [{ value: 'freshly', label: 'Freshly', color: '#10B981' }, { value: 'b1', label: 'B1', color: '#3B82F6' }, { value: 'b2', label: 'B2', color: '#8B5CF6' }, { value: 'jakes', label: 'Jakes', color: '#F59E0B' }, { value: 'epic', label: 'Epic', color: '#EF4444' }, { value: 'pulled', label: 'Pulled', color: '#6B7280' }] as booth}
									<label class="booth-option">
										<input
											type="checkbox"
											value={booth.value}
											bind:group={editData.value.booths}
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
					</div>
				{:else if editData.field === 'storageType'}
					<div class="storage-type-grid vertical">
						{#each ['Freezer', 'Refrigerator', 'Dry Storage'] as type}
							<label class="storage-node">
								<input
									type="radio"
									name="storageTypeEdit"
									value={type}
									bind:group={editData.value}
									class="hidden-radio"
								/>
								<div class="node-card">
									<div class="node-indicator" style="--type-color: {type === 'Freezer' ? '#3B82F6' : type === 'Refrigerator' ? '#10B981' : '#F59E0B'}"></div>
									<span class="node-label">{type}</span>
									<i class="fas fa-check node-check"></i>
								</div>
							</label>
						{/each}
					</div>
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
						class="tech-input"
						placeholder="Enter value..."
						required
					/>
				{/if}
			</div>

			<div class="modal-footer">
				<button type="button" class="modal-btn cancel-btn" onclick={closeEditModal}>
					Cancel
				</button>
				<button type="submit" class="modal-btn confirm-btn">
					Confirm
				</button>
			</div>
		</form>
	</div>
{/if}

<ConfirmModal
	bind:show={deleteModal.visible}
	title="Delete Item"
	message={`Are you sure you want to delete <strong>"${deleteModal.itemName}"</strong>?<br><span style="color: #ef4444; font-size: 0.8rem; font-weight: 800;">THIS ACTION CANNOT BE UNDONE.</span>`}
	type="danger"
	confirmText="Delete"
	cancelText="Cancel"
	onConfirm={deleteModal.onConfirm}
	onCancel={() => deleteModal.visible = false}
/>

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
		/* Professional multi-layered base shadow */
		box-shadow: 
			0 4px 6px -1px rgba(0, 0, 0, 0.1),
			0 2px 4px -1px rgba(0, 0, 0, 0.06),
			inset 0 0 0 1px rgba(255, 255, 255, 0.02);
		transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.table-frame:hover {
		/* Deeper, more atmospheric shadow on hover */
		box-shadow: 
			0 30px 60px -12px rgba(0, 0, 0, 0.5),
			0 18px 36px -18px rgba(0, 0, 0, 0.5);
		border-color: rgba(255, 255, 255, 0.1); 
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

	/* Tech Modals */
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(2px);
		-webkit-backdrop-filter: blur(2px);
		z-index: 10000;
	}

	.modal-container {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 10001;
		pointer-events: none;
	}

	.tech-modal {
		position: relative;
		background: var(--tech-glass-bg);
		border: 1px solid var(--tech-glass-border);
		border-radius: 8px;
		width: 90%;
		max-width: 500px;
		max-height: 90vh;
		box-shadow: var(--tech-glass-shadow);
		pointer-events: auto;
		display: flex;
		flex-direction: column;
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 16px;
		border-bottom: 1px solid var(--tech-glass-border);
		flex-shrink: 0;
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.header-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--tech-accent);
		font-size: 1rem;
		flex-shrink: 0;
	}

	.modal-title {
		margin: 0;
		color: var(--tech-title);
		font-size: 0.95rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.025em;
	}

	.close-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: 4px;
		border: none;
		background: transparent;
		color: var(--tech-label);
		cursor: pointer;
		transition: all 0.15s ease;
		padding: 0;
	}

	.close-btn:hover {
		background: var(--tech-badge-bg);
		color: var(--tech-value);
	}

	.close-btn i {
		font-size: 1rem;
	}

	.modal-body {
		padding: 16px;
		overflow-y: auto;
		flex: 1;
	}

	.tech-input {
		width: 100%;
		background: var(--tech-badge-bg);
		border: 1px solid var(--tech-glass-border);
		border-radius: 4px;
		padding: 0.6rem 0.85rem;
		color: var(--tech-value);
		font-family: 'Inter', sans-serif;
		font-size: 0.875rem;
		font-weight: 500;
		transition: all 0.2s;
	}

	.tech-input:focus {
		outline: none;
		border-color: var(--tech-accent);
		background: var(--tech-header-bg);
		box-shadow: 0 0 10px var(--tech-accent-muted);
	}

	.storage-type-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.5rem;
		width: 100%;
	}

	.storage-type-grid.vertical {
		grid-template-columns: 1fr;
	}

	.storage-type-grid.horizontal {
		grid-template-columns: repeat(3, 1fr);
	}

	.storage-node {
		cursor: pointer;
	}

	.hidden-radio {
		position: absolute;
		opacity: 0;
	}

	.storage-node .node-card {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 0.7rem;
		background: var(--tech-badge-bg);
		border: 1px solid var(--tech-glass-border);
		border-radius: 4px;
		transition: all 0.2s;
	}

	.storage-node .node-indicator {
		width: 3px;
		height: 14px;
		background: var(--type-color);
		border-radius: 2px;
	}

	.storage-node .node-label {
		font-size: 0.55rem;
		font-weight: 800;
		color: var(--tech-label);
		text-transform: uppercase;
		margin-left: 0.4rem;
		flex: 1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.storage-node .node-check {
		font-size: 0.7rem;
		color: var(--tech-accent);
		opacity: 0;
		transition: all 0.2s;
	}

	.storage-node .node-card.icon-only {
		justify-content: center;
		position: relative;
		min-height: 36px;
	}

	.storage-icon {
		font-size: 1rem;
		color: var(--type-color);
	}

	.storage-node .node-card.icon-only .node-check {
		position: absolute;
		top: 2px;
		right: 2px;
		font-size: 0.6rem;
	}

	.hidden-radio:checked + .node-card {
		border-color: var(--tech-accent);
		background: var(--tech-accent-muted);
	}

	.hidden-radio:checked + .node-card .node-label {
		color: var(--tech-value);
	}

	.hidden-radio:checked + .node-card .node-check {
		opacity: 1;
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		padding: 10px 16px;
		background: var(--tech-header-bg);
		border-top: 1px solid var(--tech-glass-border);
		flex-shrink: 0;
	}

	.modal-btn {
		padding: 8px 16px;
		border-radius: 2px;
		font-family: inherit;
		font-size: 0.75rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s ease;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		outline: none;
		border: 1px solid transparent;
	}

	.cancel-btn {
		background: transparent;
		border: 1px solid var(--tech-badge-border);
		color: var(--tech-label);
	}

	.cancel-btn:hover {
		border-color: var(--tech-label);
		color: var(--tech-value);
	}

	.confirm-btn {
		background: var(--tech-badge-bg);
		border: 1px solid var(--tech-accent);
		color: var(--tech-accent);
	}

	.confirm-btn:hover {
		background: var(--tech-accent);
		color: #ffffff;
	}

	.booths-container {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.5rem;
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
		padding: 0.45rem 0.5rem;
		background: var(--tech-badge-bg);
		border: 1px solid var(--tech-glass-border);
		border-radius: 4px;
		transition: all 0.2s;
		min-height: 36px;
	}

	.booth-indicator {
		width: 3px;
		height: 12px;
		background: var(--booth-color);
		margin-right: 0.5rem;
		border-radius: 2px;
		flex-shrink: 0;
	}

	.booth-name {
		font-size: 0.6rem;
		font-weight: 700;
		color: var(--tech-label);
		text-transform: uppercase;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		flex: 1;
	}

	.booth-checkbox:checked + .booth-card {
		border-color: var(--booth-color);
		background: rgba(255, 255, 255, 0.05);
	}

	.booth-checkbox:checked + .booth-card .booth-name {
		color: var(--tech-value);
	}

	.booths-container.compact {
		grid-template-columns: repeat(3, 1fr);
		gap: 0.4rem;
	}

	/* Comprehensive Edit Form Styles */
	.comprehensive-edit-form {
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
	}

	.form-field {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.form-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}

	.field-label {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.6rem;
		font-weight: 800;
		color: var(--tech-label);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.tech-input[type="number"] {
		-moz-appearance: textfield;
	}

	.tech-input[type="number"]::-webkit-outer-spin-button,
	.tech-input[type="number"]::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}

	@media (max-width: 768px) {
		.content-container {
			padding: 1.25rem;
			gap: 1rem;
		}

		.page-header {
			gap: 1rem;
			margin-bottom: 0;
		}

		.main-title { 
			font-size: 1.5rem;
			letter-spacing: -0.02em;
		}

		.system-status {
			display: none;
		}

		.form-frame {
			margin-bottom: 0.5rem;
		}

		.ledger-actions {
			flex-direction: column;
			gap: 1rem;
			align-items: stretch;
		}

		.stats-ribbon {
			gap: 0.75rem;
			background: var(--tech-glass-bg);
			padding: 0.875rem 1rem;
			border-radius: 8px;
			border: 1px solid var(--tech-glass-border);
			flex-direction: row;
			flex-wrap: wrap;
			justify-content: space-between;
		}

		.ribbon-item {
			opacity: 1;
			padding: 0.25rem 0;
			flex: 1 1 auto;
			min-width: max-content;
		}

		.ribbon-item:not(:last-child) {
			border-bottom: none;
		}

		.ribbon-item:hover {
			transform: none;
		}

		.ribbon-label {
			font-size: 0.55rem;
			opacity: 0.8;
		}

		.ribbon-value {
			font-size: 0.75rem;
		}

		.ribbon-item:nth-child(1) .ribbon-value,
		.ribbon-item:nth-child(2) .ribbon-value,
		.ribbon-item:nth-child(3) .ribbon-value {
			min-width: auto;
		}

		.search-primary {
			max-width: 100%;
			width: 100%;
		}

		/* Table frame - transparent background for mobile cards */
		.table-frame {
			min-height: auto;
			border-radius: 8px;
			background: transparent;
			border: none;
			box-shadow: none;
		}

		.table-frame:hover {
			box-shadow: none;
			border-color: transparent;
		}

		.ledger-loading, .null-state {
			height: 300px;
			background: var(--tech-glass-bg);
			border-radius: 12px;
			border: 1px solid var(--tech-glass-border);
		}

		.null-state i {
			font-size: 2rem;
		}

		.null-state p {
			font-size: 0.7rem;
		}

		.loading-text {
			font-size: 0.6rem;
		}

		/* Footer */
		.footer-extension {
			margin-top: 0.5rem;
		}

		.notification {
			bottom: 1rem;
			right: 1rem;
			left: 1rem;
			padding: 0.875rem 1.25rem;
		}

		.notification-content {
			font-size: 0.85rem;
		}

		.tech-modal {
			width: 95%;
			max-width: none;
			margin: 1rem;
		}

		.modal-header {
			padding: 14px 16px;
		}

		.modal-title {
			font-size: 1rem;
		}

		.modal-body {
			padding: 16px;
		}

		.storage-type-grid {
			grid-template-columns: 1fr;
			gap: 0.5rem;
		}

		.booths-container {
			grid-template-columns: 1fr;
			gap: 0.5rem;
		}

		.booth-card {
			padding: 0.65rem;
		}

		.booth-name {
			font-size: 0.7rem;
		}

		/* Comprehensive Edit Form - Mobile */
		.form-row {
			grid-template-columns: 1fr;
			gap: 1rem;
		}

		.comprehensive-edit-form {
			gap: 1rem;
		}
	}
</style>
