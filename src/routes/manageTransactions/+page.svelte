<script>
	import SearchBar from '../../components/SearchBar.svelte';
	import Pagination from '../../components/Pagination.svelte';
	import ConfirmModal from '../../components/ConfirmModal.svelte';
	import { getPaginationStore } from '../../stores/paginationStore';
	import { itemStore } from '../../stores/itemStore';
	import { getSearchStore } from '../../stores/searchStore';
	import { notificationStore } from '../../stores/notificationStore';
	import { applySorting } from '../../lib/items';
	import { themeStore } from '../../stores/themes.js';
	import { addTransaction } from '../../lib/transactions';
	import { authStore } from '../../stores/authStore';
	import { onMount } from 'svelte';
	import { blur } from 'svelte/transition';

	let currentSortColumn = $state('name');
	let sortAscending = $state(true);
	let itemsLoaded = $state(false);
	let tableLoading = $state(false);

	// Modal state
	let confirmModal = $state({
		visible: false,
		title: '',
		message: '',
		htmlMessage: '',
		isDanger: false,
		onConfirm: () => {}
	});

	const paginationStore = getPaginationStore('manageTransactions');
	const { currentPage, itemsPerPage, setTotalItems } = paginationStore;

	const searchStore = getSearchStore('manageTransactions');
	const { setSearchTerm, clearSearch } = searchStore;

	// Store values as reactive state
	let items = $state([]);
	let searchTermValue = $state('');
	let notificationValue = $state(null);
	let currentTheme = $state('light');
	let authUser = $state(null);

	// Subscribe to stores
	$effect(() => {
		const unsubscribeItems = itemStore.subscribe((value) => {
			items = value;
		});
		const unsubscribeSearch = searchStore.subscribe((value) => {
			searchTermValue = value;
		});
		const unsubscribeNotification = notificationStore.subscribe((value) => {
			notificationValue = value;
		});
		const unsubscribeTheme = themeStore.subscribe((value) => {
			currentTheme = value;
		});
		const unsubscribeAuth = authStore.subscribe((value) => {
			authUser = value;
		});

		return () => {
			unsubscribeItems();
			unsubscribeSearch();
			unsubscribeNotification();
			unsubscribeTheme();
			unsubscribeAuth();
		};
	});

	// Use $derived.by for functions that compute values
	const filteredItemsList = $derived.by(() => {
		if (!searchTermValue) {
			return items;
		}
		const lowerCaseSearchTerm = searchTermValue.toLowerCase();
		return items.filter((item) => item.name.toLowerCase().includes(lowerCaseSearchTerm));
	});

	// Update total items when filtered list changes
	$effect(() => {
		setTotalItems(filteredItemsList.length);
	});

	const sortedItems = $derived(applySorting(filteredItemsList, currentSortColumn, sortAscending));

	const paginatedItemsList = $derived.by(() => {
		if ($itemsPerPage === 'all') {
			return sortedItems;
		}
		const startIndex = ($currentPage - 1) * $itemsPerPage;
		const endIndex = startIndex + $itemsPerPage;
		return sortedItems.slice(startIndex, endIndex);
	});

	const filterLegend = $derived(
		`${filteredItemsList.length} results of ${items.length} total items.`
	);

	// Load items on mount instead of async $effect
	onMount(async () => {
		await itemStore.loadItems();
		itemsLoaded = true;
	});

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

	const handleSearch = (value) => {
		tableLoading = true;
		setSearchTerm(value);
		paginationStore.setCurrentPage(1);
		setTimeout(() => tableLoading = false, 300);
	};

	const getCurrentUser = () => {
		return authUser?.email || 'Unknown';
	};

	const changeCount = async (item, amount) => {
		const previousCount = item.count;
		await itemStore.changeCount(item.id, amount);
		const updatedItem = items.find((i) => i.id === item.id);
		if (updatedItem) {
			await addTransaction({
				itemId: item.id,
				itemName: item.name,
				type: amount > 0 ? 'add' : 'remove',
				previousCount: previousCount,
				newCount: updatedItem.count,
				user: getCurrentUser()
			});
		}
		// Reset the input field after operation
		itemStore.setChangeAmount(item.id, 0);
		notificationStore.showNotification(`Count for "${item.name}" updated successfully!`, 'success');
	};

	const resetCount = async (item) => {
		confirmModal = {
			visible: true,
			title: 'Are you sure?',
			message: `This will reset the count for "${item.name}" to 0.`,
			htmlMessage: '',
			isDanger: false,
			onConfirm: async () => {
				confirmModal.visible = false;
				const previousCount = item.count;
				await itemStore.resetItemCount(item.id);
				await addTransaction({
					itemId: item.id,
					itemName: item.name,
					type: 'remove',
					previousCount: previousCount,
					newCount: 0,
					user: getCurrentUser()
				});
				// Reset the input field after operation
				itemStore.setChangeAmount(item.id, 0);
				notificationStore.showNotification(`Count for "${item.name}" reset successfully!`, 'success');
			}
		};
	};

	const resetAll = async () => {
		confirmModal = {
			visible: true,
			title: 'Are you sure?',
			message: '',
			htmlMessage: `This will reset the count for <strong style="color: #ef4444;">ALL</strong> items to 0.`,
			isDanger: true,
			onConfirm: async () => {
				confirmModal.visible = false;
				const itemsToReset = items.filter((item) => item.count !== 0);
				await itemStore.resetAllCounts();
				for (const item of itemsToReset) {
					await addTransaction({
						itemId: item.id,
						itemName: item.name,
						type: 'remove',
						previousCount: item.count,
						newCount: 0,
						user: getCurrentUser()
					});
				}
				notificationStore.showNotification('All counts have been reset successfully!', 'success');
			}
		};
	};

	const handleChangeAmountInput = (item, event) => {
		const input = event.target;
		const value = input.value.replace(/[^0-9]/g, '');

		if (value === '') {
			itemStore.setChangeAmount(item.id, 0);
			input.value = '';
		} else {
			const numValue = parseInt(value, 10);
			itemStore.setChangeAmount(item.id, numValue);
			input.value = numValue.toString();
		}
	};

	const capitalizeColumn = (column) => {
		return column.replace(/([A-Z])/g, ' $1').trim().toUpperCase();
	};

	const handlePageChange = () => {
		tableLoading = true;
		setTimeout(() => tableLoading = false, 300);
	};
</script>

<svelte:head>
	<title>Manage Transactions</title>
</svelte:head>

<div class="page-viewport-wrapper">
	<div class="glow-layer"></div>
	<div class="content-container">
		<header class="page-header">
			<div class="title-group">
				<h1 class="main-title">Manage Transactions</h1>
				<div class="system-status">
					<span class="status-dot"></span>
					<span class="status-text">SYSTEM SECURE</span>
				</div>
			</div>
		</header>

		<div class="ledger-actions">
			<div class="stats-ribbon">
				<div class="ribbon-item">
					<span class="ribbon-label">SOURCE:</span>
					<span class="ribbon-value">ITEMS_DB</span>
				</div>
				<div class="ribbon-item">
					<span class="ribbon-label">ITEMS:</span>
					<div class="ribbon-value">
						{#key items.length}
							<div class="count-context text-update">
								<span class="digital-font">{filteredItemsList.length}</span>
								{#if searchTermValue}
									<span class="count-separator">/</span>
									<span class="count-total">{items.length}</span>
								{/if}
							</div>
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
				<SearchBar searchValue={searchTermValue} onSearch={handleSearch} onClear={clearSearch} />
			</div>
		</div>

		<div class="table-frame">
			{#if !itemsLoaded}
				<div class="ledger-loading">
					<div class="pulse-ring"></div>
					<span class="loading-text">LOADING ITEMS...</span>
				</div>
			{:else if paginatedItemsList.length === 0}
				<div class="null-state">
					<i class="fas fa-search-minus"></i>
					<p>NO ITEMS MATCHED.</p>
				</div>
			{:else}
				<div class="table-render-layer">
					<div class="table-wrapper">
						<div class="table-scroll">
							<table class="tech-table">
								<thead>
									<tr>
										<th class="name-col" onclick={() => sortBy('name')}>
											<div class="header-content">
												<span>Item Name</span>
												<i class="fas fa-sort{currentSortColumn === 'name' ? (sortAscending ? '-up' : '-down') : ''} sort-icon"></i>
											</div>
										</th>
										<th class="count-col" onclick={() => sortBy('count')}>
											<div class="header-content justify-center">
												<span class="header-text">Count</span>
												<i class="fas fa-sort{currentSortColumn === 'count' ? (sortAscending ? '-up' : '-down') : ''} sort-icon"></i>
											</div>
										</th>
										<th class="change-col">
											<div class="header-content justify-center">
												<span class="header-text">Change Amount</span>
											</div>
										</th>
										<th class="actions-col">
											<div class="header-content justify-center">
												<span class="header-text">Actions</span>
											</div>
										</th>
									</tr>
								</thead>
								<tbody class="table-body-transition" class:loading-fade={!itemsLoaded || tableLoading}>
									{#each paginatedItemsList as item (item.id)}
										<tr class="table-row">
											<td class="name-col" data-label="Item Name">
												<span class="name-text">{item.name}</span>
											</td>
											<td class="count-col" data-label="Count">
												{#key item.count}
													<span class="count-badge result text-update" in:blur={{ duration: 400, amount: 2 }}>
														{item.count}
													</span>
												{/key}
											</td>
											<td class="change-col" data-label="Change Amount">
												<div class="flex justify-center">
													<input
														type="number"
														inputmode="numeric"
														pattern="[0-9]*"
														placeholder="0"
														value={item.changeAmount === 0 ? '' : item.changeAmount}
														oninput={(e) => handleChangeAmountInput(item, e)}
														class="change-amount-input"
													/>
												</div>
											</td>
											<td class="actions-col" data-label="Actions">
												<div class="actions-grid">
													<button
														class="action-btn add"
														onclick={() => changeCount(item, +item.changeAmount)}
														disabled={item.changeAmount === 0}
														title="Add Amount"
													>
														<i class="fas fa-plus"></i>
													</button>
													<button
														class="action-btn subtract"
														onclick={() => changeCount(item, -item.changeAmount)}
														disabled={item.changeAmount === 0}
														title="Subtract Amount"
													>
														<i class="fas fa-minus"></i>
													</button>
													<button
														class="action-btn reset"
														onclick={() => resetCount(item)}
														disabled={item.count === 0}
														title="Reset to Zero"
													>
														<i class="fas fa-undo"></i>
													</button>
												</div>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</div>
				</div>
			{/if}
		</div>

		<div class="footer-extension">
			<Pagination store={paginationStore} globalTotal={items.length} onPageChange={handlePageChange} />
			
			{#if items.some(item => item.count !== 0)}
				<button
					class="reset-all-btn"
					onclick={resetAll}
				>
					<i class="fas fa-exclamation-triangle"></i>
					RESET ALL COUNTS
				</button>
			{/if}
		</div>
	</div>
</div>

{#if notificationValue && notificationValue.message}
	<div class="notification {notificationValue.type}">
		<div class="notification-content">
			<i class="fas {notificationValue.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
			<span>{notificationValue.message}</span>
		</div>
	</div>
{/if}

<ConfirmModal
	bind:show={confirmModal.visible}
	title={confirmModal.title}
	message={confirmModal.message || confirmModal.htmlMessage}
	type={confirmModal.isDanger ? 'danger' : 'warning'}
	confirmText="Yes, reset it!"
	cancelText="Cancel"
	onConfirm={confirmModal.onConfirm}
	onCancel={() => confirmModal.visible = false}
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
		font-weight: 800;
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
	.ribbon-item:nth-child(2) .ribbon-value {
		min-width: 80px; /* Reserve space for item counts */
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

	@keyframes subtle-glow {
		0% { 
			color: var(--tech-accent); 
			text-shadow: 0 0 12px var(--tech-accent-muted);
		}
		100% { 
			text-shadow: 0 0 0px transparent;
		}
	}

	.order-tag {
		color: var(--tech-label);
		font-size: 0.7rem;
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

	.table-wrapper {
		width: 100%;
	}

	.table-scroll {
		width: 100%;
		overflow-x: auto;
		overflow-y: auto;
		max-height: 70vh;
		min-height: 400px;
		scrollbar-width: thin;
		scrollbar-color: var(--tech-scrollbar-thumb) transparent;
	}

	.table-scroll::-webkit-scrollbar {
		width: 6px;
		height: 6px;
	}

	.table-scroll::-webkit-scrollbar-thumb {
		background: var(--tech-scrollbar-thumb);
	}

	.tech-table {
		width: 100%;
		border-collapse: collapse;
	}

	.tech-table th {
		position: sticky;
		top: 0;
		background: var(--tech-header-bg);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		z-index: 20;
		padding: 1.1rem 1.25rem;
		text-align: left;
		font-family: 'Inter', sans-serif;
		font-weight: 700;
		color: var(--tech-header-text);
		text-transform: uppercase;
		font-size: 0.7rem;
		letter-spacing: 0.1em;
		cursor: pointer;
	}

	.header-content {
		display: flex;
		align-items: center;
		justify-content: flex-start;
		position: relative;
		width: 100%;
	}

	.justify-center { 
		justify-content: center;
		padding: 0 1.5rem;
	}

	.header-text {
		position: relative;
	}

	.sort-icon {
		position: absolute;
		right: 0.5rem;
		font-size: 0.75rem;
		color: var(--tech-accent);
		opacity: 0.4;
		transition: all 0.2s;
	}

	.tech-table th:hover .sort-icon {
		opacity: 1;
	}

	/* Force center alignment for these columns */
	.count-col, .change-col, .actions-col {
		text-align: center;
	}

	.table-row {
		background: transparent;
		transition: background-color 0.2s ease;
	}

	.table-row:nth-child(even) {
		background: var(--tech-row-stripe);
	}

	.table-row:hover {
		background: var(--tech-row-hover);
	}

	.table-body-transition {
		transition: opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1), filter 0.4s ease;
	}

	.loading-fade {
		opacity: 0.2;
		filter: blur(2px);
		pointer-events: none;
	}

	.tech-table td {
		padding: 1rem 1.25rem;
		vertical-align: middle;
		border-bottom: 1px solid var(--tech-cell-border);
		color: var(--tech-cell-text);
		font-size: 0.9rem;
	}

	.name-text {
		font-weight: 700;
		color: var(--tech-value);
	}

	.count-badge.result {
		font-family: 'JetBrains Mono', monospace;
		font-size: 1rem;
		color: var(--tech-accent);
		display: inline-block;
		min-width: 45px;
		text-align: center;
		font-weight: 800;
		text-shadow: 0 0 10px var(--tech-accent-muted);
		padding: 0.25rem;
	}

	.change-amount-input {
		width: 70px;
		height: 36px;
		background: var(--tech-badge-bg);
		border: 1px solid var(--tech-badge-border);
		color: var(--tech-value);
		text-align: center;
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.9rem;
		font-weight: 700;
		border-radius: 4px;
		transition: all 0.2s;
		-moz-appearance: textfield;
	}

	.change-amount-input::-webkit-outer-spin-button,
	.change-amount-input::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}

	.change-amount-input:focus {
		outline: none;
		border-color: var(--tech-accent);
		background: var(--tech-header-bg);
		box-shadow: 0 0 0 2px var(--tech-accent-muted);
	}

	.actions-grid {
		display: flex;
		gap: 0.75rem;
		justify-content: center;
		align-items: center;
	}

	.action-btn {
		width: 38px;
		height: 38px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 8px;
		border: 1px solid transparent;
		transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
		cursor: pointer;
		position: relative;
		overflow: hidden;
		background: var(--tech-glass-bg);
		padding: 0; /* Reset padding for perfect centering */
	}

	.action-btn i {
		font-size: 0.9rem;
		line-height: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
	}

	.action-btn:disabled {
		opacity: 0.15;
		cursor: not-allowed;
		filter: grayscale(1);
		border-color: transparent !important;
	}

	.action-btn.add {
		color: #22c55e;
		border-color: rgba(34, 197, 94, 0.2);
		background: rgba(34, 197, 94, 0.05);
	}

	.action-btn.add:not(:disabled):hover {
		background: #22c55e;
		color: white;
		box-shadow: 0 0 15px rgba(34, 197, 94, 0.4);
		transform: translateY(-2px);
	}

	.action-btn.subtract {
		color: #ef4444;
		border-color: rgba(239, 68, 68, 0.2);
		background: rgba(239, 68, 68, 0.05);
	}

	.action-btn.subtract:not(:disabled):hover {
		background: #ef4444;
		color: white;
		box-shadow: 0 0 15px rgba(239, 68, 68, 0.4);
		transform: translateY(-2px);
	}

	.action-btn.reset {
		color: #f59e0b;
		border-color: rgba(245, 158, 11, 0.2);
		background: rgba(245, 158, 11, 0.05);
	}

	.action-btn.reset:not(:disabled):hover {
		background: #f59e0b;
		color: white;
		box-shadow: 0 0 15px rgba(245, 158, 11, 0.4);
		transform: translateY(-2px);
	}

	.action-btn:not(:disabled):active {
		transform: translateY(0) scale(0.95);
	}

	/* Ledger Footer */
	.ledger-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.5rem 0;
		border-top: 1px solid var(--tech-cell-border);
		margin-top: 1rem;
		flex-wrap: wrap;
		gap: 2rem;
	}

	.reset-all-btn {
		background: rgba(239, 68, 68, 0.1);
		border: 1px solid rgba(239, 68, 68, 0.2);
		color: #ef4444;
		padding: 0.75rem 1.5rem;
		font-family: 'JetBrains Mono', monospace;
		font-weight: 800;
		font-size: 0.75rem;
		letter-spacing: 0.1em;
		border-radius: 4px;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		cursor: pointer;
		transition: all 0.3s;
	}

	.reset-all-btn:disabled {
		opacity: 0.3;
		cursor: not-allowed;
		filter: grayscale(1);
	}

	.reset-all-btn:not(:disabled):hover {
		background: #ef4444;
		color: white;
		transform: translateY(-2px);
		box-shadow: 0 5px 15px rgba(239, 68, 68, 0.3);
	}

	.reset-all-btn i { font-size: 0.85rem; }

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

	/* States */
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

	/* Mobile */
	@media (max-width: 768px) {
		.tech-table thead { display: none; }
		.tech-table td {
			display: grid;
			grid-template-columns: 1fr 1fr;
			text-align: right;
			border-bottom: 1px solid var(--tech-cell-border);
		}
		.tech-table td::before {
			content: attr(data-label);
			text-align: left;
			font-weight: 800;
			font-size: 0.7rem;
			color: var(--tech-label);
			text-transform: uppercase;
		}
		.actions-grid { justify-content: flex-end; }
		.stats-ribbon { gap: 1rem; flex-wrap: wrap; }
		.main-title { font-size: 1.8rem; }
	}
</style>

