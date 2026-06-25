<script>
	import { fade, fly } from 'svelte/transition';
	import { elasticOut } from 'svelte/easing';
	import SearchBar from '../../components/SearchBar.svelte';
	import TableSkeleton from '../../components/TableSkeleton.svelte';
	import ConfirmModal from '../../components/ConfirmModal.svelte';
	import Pagination from '../../components/Pagination.svelte';
	import { getPaginationStore } from '../../stores/paginationStore';
	import { itemStore } from '../../stores/itemStore';
	import { createSearchState } from '../../lib/runes/search.svelte.js';
	import { notificationStore } from '../../stores/notificationStore';
	import { applySorting } from '../../lib/items';
	import { isLowStock } from '../../lib/tableUtils.js';
	import { addTransaction } from '../../lib/transactions';
	import { authStore } from '../../stores/authStore';
	import { onMount } from 'svelte';

	let currentSortColumn = $state('name');
	let sortAscending = $state(true);
	let itemsLoaded = $state(false);
	let statusFilter = $state('all');

	const paginationStore = getPaginationStore('manageTransactions');
	const { currentPage, itemsPerPage, setTotalItems } = paginationStore;

	const search = createSearchState();

	const items = $derived($itemStore);
	const searchTermValue = $derived(search.term);
	const notification = $derived($notificationStore.at(-1) ?? null);
	const authUser = $derived($authStore);

	const searchedItemsList = $derived.by(() => {
		if (!searchTermValue) {
			return items;
		}
		const lowerCaseSearchTerm = searchTermValue.toLowerCase();
		return items.filter((item) => item.name.toLowerCase().includes(lowerCaseSearchTerm));
	});

	const totalUnits = $derived(
		searchedItemsList.reduce((sum, item) => sum + (parseInt(item.count, 10) || 0), 0)
	);
	const lowStockCount = $derived(
		searchedItemsList.filter((item) => stockStatus(item) === 'low').length
	);
	const outOfStockCount = $derived(
		searchedItemsList.filter((item) => stockStatus(item) === 'out').length
	);

	const filteredItemsList = $derived.by(() => {
		if (statusFilter === 'all') {
			return searchedItemsList;
		}
		return searchedItemsList.filter((item) => stockStatus(item) === statusFilter);
	});

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

	onMount(async () => {
		await itemStore.loadItems();
		itemsLoaded = true;
	});

	const sortBy = (column) => {
		if (currentSortColumn === column) {
			sortAscending = !sortAscending;
		} else {
			currentSortColumn = column;
			sortAscending = true;
		}
	};

	const handleSearch = (value) => {
		search.setTerm(value);
		paginationStore.setCurrentPage(1);
	};

	const toggleStatusFilter = (status) => {
		statusFilter = statusFilter === status ? 'all' : status;
		paginationStore.setCurrentPage(1);
	};

	const getCurrentUser = () => {
		return authUser?.email || 'Unknown';
	};

	const stockStatus = (item) => {
		if ((parseInt(item.count, 10) || 0) === 0) {
			return 'out';
		}
		return isLowStock(item) ? 'low' : 'in';
	};

	const statusLabel = { in: 'In stock', low: 'Low stock', out: 'Out of stock' };

	const storageTag = (item) => {
		switch ((item.storageType || '').toLowerCase()) {
			case 'freezer':
				return { icon: 'ti-snowflake', label: 'Freezer' };
			case 'refrigerator':
				return { icon: 'ti-temperature', label: 'Fridge' };
			case 'dry storage':
				return { icon: 'ti-box', label: 'Dry' };
			default:
				return null;
		}
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
		itemStore.setChangeAmount(item.id, 0);
		notificationStore.showNotification(`Count for "${item.name}" updated successfully!`, 'success');
	};

	let confirm = $state({ open: false, kind: null, item: null });

	const askResetCount = (item) => {
		confirm = { open: true, kind: 'reset', item };
	};

	const askResetAll = () => {
		confirm = { open: true, kind: 'resetAll', item: null };
	};

	const cancelConfirm = () => {
		confirm = { open: false, kind: null, item: null };
	};

	const handleConfirm = async () => {
		const { kind, item } = confirm;
		cancelConfirm();
		if (kind === 'reset') {
			await doResetCount(item);
		} else if (kind === 'resetAll') {
			await doResetAll();
		}
	};

	const doResetCount = async (item) => {
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
		itemStore.setChangeAmount(item.id, 0);
		notificationStore.showNotification(`Count for "${item.name}" reset successfully!`, 'success');
	};

	const doResetAll = async () => {
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
</script>

{#if itemsLoaded}
	<div class="page-container">
		<div class="tx-section">
			<!-- Header -->
			<div class="tx-header">
				<div class="header-text">
					<h2 class="tx-title">Adjust Stock</h2>
					<p class="tx-subtitle">Manage and adjust inventory counts</p>
				</div>
				<div class="tx-summary">
					<span class="sum-item"><strong>{searchedItemsList.length}</strong> items</span>
					<span class="sum-sep">·</span>
					<span class="sum-item"><strong>{totalUnits}</strong> units</span>
					{#if lowStockCount > 0}
						<button
							class="sum-chip sum-chip-low"
							class:active={statusFilter === 'low'}
							onclick={() => toggleStatusFilter('low')}
							aria-pressed={statusFilter === 'low'}
						>
							<span class="sum-chip-dot"></span>
							<strong>{lowStockCount}</strong> low
						</button>
					{/if}
					{#if outOfStockCount > 0}
						<button
							class="sum-chip sum-chip-out"
							class:active={statusFilter === 'out'}
							onclick={() => toggleStatusFilter('out')}
							aria-pressed={statusFilter === 'out'}
						>
							<span class="sum-chip-dot"></span>
							<strong>{outOfStockCount}</strong> out
						</button>
					{/if}
				</div>
			</div>

			<!-- Toolbar -->
			<div class="tx-toolbar">
				<div class="tx-search">
					<SearchBar
						searchValue={searchTermValue}
						onSearch={handleSearch}
						onClear={() => search.clear()}
					/>
				</div>
				<div class="tx-sort">
					<span class="sort-label">Sort by</span>
					<button
						class="sort-btn"
						class:active={currentSortColumn === 'name'}
						onclick={() => sortBy('name')}
					>
						<span>Name</span>
						{#if currentSortColumn === 'name'}
							<i class="fas {sortAscending ? 'fa-sort-up' : 'fa-sort-down'} sort-arrow"></i>
						{/if}
					</button>
					<button
						class="sort-btn"
						class:active={currentSortColumn === 'count'}
						onclick={() => sortBy('count')}
					>
						<span>Count</span>
						{#if currentSortColumn === 'count'}
							<i class="fas {sortAscending ? 'fa-sort-up' : 'fa-sort-down'} sort-arrow"></i>
						{/if}
					</button>
				</div>
			</div>

			<!-- List -->
			<div class="tx-list">
				<div class="tx-list-head" aria-hidden="true">
					<span class="h-item">Item</span>
					<span class="h-storage">Storage</span>
					<span class="h-status">Status</span>
					<span class="h-count">Count</span>
					<span class="h-adjust">Adjust</span>
					<span class="h-reset"></span>
				</div>

				{#if paginatedItemsList.length === 0}
					<div class="tx-empty" in:fade={{ duration: 150 }}>
						<i class="ti ti-package-off"></i>
						<p class="empty-title">No items to show</p>
						<p class="empty-hint">
							{#if statusFilter !== 'all'}
								No {statusFilter === 'low' ? 'low' : 'out-of-stock'} items match the current view.
							{:else if searchTermValue}
								Nothing matches “{searchTermValue}”.
							{:else}
								Add some items to start adjusting stock.
							{/if}
						</p>
						{#if statusFilter !== 'all'}
							<button class="empty-action" onclick={() => toggleStatusFilter(statusFilter)}>
								Clear filter
							</button>
						{/if}
					</div>
				{:else}
					{#each paginatedItemsList as item (item.id)}
						{@const status = stockStatus(item)}
						{@const storage = storageTag(item)}
						<div
							class="tx-row"
							style="--stripe-color: var(--st-{status}-color)"
							in:fade={{ duration: 150 }}
						>
							<div class="col-item">
								<span class="item-name">{item.name}</span>
							</div>
							<div class="col-storage">
								{#if storage}
									<span class="storage-tag">
										<i class="ti {storage.icon}"></i>
										{storage.label}
									</span>
								{/if}
							</div>
							<div class="col-status">
								<span class="status-badge status-badge-{status}">
									<span class="status-dot"></span>
									{statusLabel[status]}
								</span>
							</div>
							<div class="col-count">
								{#key item.count}
									<span
										class="count-value"
										class:count-out={status === 'out'}
										class:count-warn={status === 'low'}
										transition:fly={{ y: -12, duration: 200, easing: elasticOut }}
									>
										{item.count}
									</span>
								{/key}
							</div>
							<div class="col-adjust">
								<div class="adjuster">
									<button
										class="adj-btn adj-minus"
										onclick={() => changeCount(item, -item.changeAmount)}
										disabled={item.changeAmount === 0}
										aria-label="Remove {item.changeAmount || ''} from {item.name}"
									>
										−
									</button>
									<input
										type="number"
										inputmode="numeric"
										pattern="[0-9]*"
										placeholder="0"
										value={item.changeAmount === 0 ? '' : item.changeAmount}
										oninput={(e) => handleChangeAmountInput(item, e)}
										class="adj-input"
										aria-label="Change amount for {item.name}"
									/>
									<button
										class="adj-btn adj-plus"
										onclick={() => changeCount(item, +item.changeAmount)}
										disabled={item.changeAmount === 0}
										aria-label="Add {item.changeAmount || ''} to {item.name}"
									>
										+
									</button>
								</div>
							</div>
							<div class="col-reset">
								<button
									class="reset-btn"
									onclick={() => askResetCount(item)}
									disabled={item.count === 0}
									aria-label="Reset {item.name} to 0"
									title="Reset to 0"
								>
									<i class="ti ti-rotate-clockwise"></i>
								</button>
							</div>
						</div>
					{/each}
				{/if}
			</div>

			<!-- Footer -->
			<div class="tx-footer">
				<div class="footer-pagination">
					<Pagination store={paginationStore} />
				</div>
				<button class="reset-all-btn" onclick={askResetAll}>
					<i class="ti ti-rotate-clockwise"></i>
					Reset all counts
				</button>
			</div>
		</div>
	</div>
{:else}
	<TableSkeleton />
{/if}

<ConfirmModal
	visible={confirm.open}
	title={confirm.kind === 'resetAll' ? 'Reset all counts?' : 'Reset item count?'}
	confirmText={confirm.kind === 'resetAll' ? 'Reset all' : 'Reset'}
	cancelText="Cancel"
	variant={confirm.kind === 'resetAll' ? 'danger' : 'warning'}
	chipIcon={confirm.kind === 'resetAll' ? 'ti-stack-2' : 'ti-cube'}
	chipLabel={confirm.kind === 'resetAll' ? 'All items' : confirm.item?.name}
	chipFrom={confirm.kind === 'resetAll' ? items.length : (confirm.item?.count ?? null)}
	chipTo={0}
	onConfirm={handleConfirm}
	onCancel={cancelConfirm}
>
	{#if confirm.kind === 'resetAll'}
		This resets every item back to 0:
	{:else if confirm.item}
		You're about to reset:
	{/if}
</ConfirmModal>

{#if notification}
	<div class="notification {notification.type}" in:fade out:fade>
		{notification.message}
	</div>
{/if}

<style>
	/* =============================================
	   Status colours (light) — bold & punchy
	   ============================================= */
	.page-container {
		--st-in-color: #16a34a;
		--st-low-color: #d97706;
		--st-out-color: #dc2626;
		--st-in-bg: #dcfce7;
		--st-low-bg: #fef3c7;
		--st-out-bg: #fee2e2;
		--st-in-text: #15803d;
		--st-low-text: #b45309;
		--st-out-text: #b91c1c;
	}

	:global([data-theme='dark']) .page-container {
		--st-in-color: #34d399;
		--st-low-color: #fbbf24;
		--st-out-color: #f87171;
		--st-in-bg: rgba(52, 211, 153, 0.14);
		--st-low-bg: rgba(251, 191, 36, 0.14);
		--st-out-bg: rgba(248, 113, 113, 0.14);
		--st-in-text: #4ade80;
		--st-low-text: #fbbf24;
		--st-out-text: #f87171;
	}

	/* =============================================
	   Page layout
	   ============================================= */
	.page-container {
		max-width: 95%;
		margin: 0 auto;
		padding: 1.25rem;
		min-height: 100vh;
		width: 100%;
	}

	.tx-section {
		background: var(--container-bg);
		border-radius: var(--border-radius);
		box-shadow:
			0 1px 3px rgba(0, 0, 0, 0.06),
			0 4px 12px rgba(0, 0, 0, 0.04);
		border: 1px solid var(--table-border-color);
		overflow: hidden;
	}

	/* =============================================
	   Header
	   ============================================= */
	.tx-header {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1rem 1.5rem;
		flex-wrap: wrap;
		padding: 1.25rem 1.75rem 1.1rem;
		border-bottom: 1px solid var(--table-border-color);
	}

	.tx-title {
		margin: 0;
		font-size: 1.5rem;
		font-weight: 800;
		color: var(--text-color);
		letter-spacing: -0.03em;
		line-height: 1.15;
	}

	.tx-subtitle {
		margin: 0.2rem 0 0;
		font-size: 0.85rem;
		color: var(--text-color-dimmed);
		line-height: 1.4;
	}

	/* Slim inline summary bar */
	.tx-summary {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-wrap: wrap;
		font-size: 0.88rem;
		color: var(--text-color-dimmed);
	}

	.sum-item strong {
		color: var(--text-color);
		font-weight: 800;
		font-variant-numeric: tabular-nums;
	}

	.sum-sep {
		opacity: 0.4;
	}

	.sum-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.2rem 0.6rem;
		font-size: 0.82rem;
		font-weight: 600;
		border-radius: 999px;
		border: 1.5px solid transparent;
		cursor: pointer;
		transition: all 0.15s ease-out;
	}

	.sum-chip strong {
		font-weight: 800;
		font-variant-numeric: tabular-nums;
	}

	.sum-chip-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.sum-chip-low {
		background: var(--st-low-bg);
		color: var(--st-low-text);
	}

	.sum-chip-low .sum-chip-dot {
		background: var(--st-low-color);
	}

	.sum-chip-out {
		background: var(--st-out-bg);
		color: var(--st-out-text);
	}

	.sum-chip-out .sum-chip-dot {
		background: var(--st-out-color);
	}

	.sum-chip:hover {
		transform: translateY(-1px);
	}

	.sum-chip-low.active {
		border-color: var(--st-low-color);
	}

	.sum-chip-out.active {
		border-color: var(--st-out-color);
	}

	.sum-chip:focus-visible {
		outline: 2px solid var(--add-item-color);
		outline-offset: 2px;
	}

	/* =============================================
	   Toolbar
	   ============================================= */
	.tx-toolbar {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.85rem 1.75rem;
		border-bottom: 1px solid var(--table-border-color);
		flex-wrap: wrap;
		background: color-mix(in srgb, var(--hover-bg-color) 40%, var(--container-bg));
	}

	.tx-search {
		flex: 1;
		min-width: 14rem;
	}

	.tx-sort {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
	}

	.sort-label {
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-color-dimmed);
	}

	.sort-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		height: 2rem;
		padding: 0 0.75rem;
		font-size: 0.82rem;
		font-weight: 700;
		color: var(--text-color-dimmed);
		background: var(--container-bg);
		border: 1.5px solid var(--table-border-color);
		border-radius: var(--border-radius);
		cursor: pointer;
		transition: all 0.15s ease-out;
	}

	.sort-btn:hover {
		background: var(--hover-bg-color);
		color: var(--text-color);
	}

	.sort-btn.active {
		border-color: var(--add-item-color);
		color: var(--add-item-color);
		background: color-mix(in srgb, var(--add-item-color) 10%, var(--container-bg));
	}

	.sort-btn:focus-visible {
		outline: 2px solid var(--add-item-color);
		outline-offset: 2px;
	}

	.sort-arrow {
		font-size: 0.65rem;
		opacity: 0.8;
	}

	/* =============================================
	   List — hybrid grid rows
	   ============================================= */
	.tx-list {
		display: flex;
		flex-direction: column;
	}

	.tx-row,
	.tx-list-head {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 6.5rem 7rem 4.5rem 8.25rem 2.25rem;
		align-items: center;
		gap: 0.85rem;
		padding: 0.55rem 1.5rem 0.55rem 1.25rem;
	}

	.tx-list-head {
		padding-top: 0.55rem;
		padding-bottom: 0.55rem;
		background: var(--table-header-bg);
		border-bottom: 1px solid var(--table-border-color);
	}

	.tx-list-head span {
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.07em;
		color: var(--text-color-dimmed);
		white-space: nowrap;
	}

	.h-count {
		text-align: center;
	}

	.tx-row {
		position: relative;
		border-left: 4px solid var(--stripe-color);
		border-bottom: 1px solid var(--table-border-color);
		transition: background-color 0.12s ease-out;
	}

	.tx-row:last-child {
		border-bottom: none;
	}

	.tx-row:hover {
		background: var(--hover-bg-color);
	}

	/* ---- Item column ---- */
	.item-name {
		font-weight: 700;
		font-size: 0.95rem;
		color: var(--text-color);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		display: block;
	}

	/* ---- Storage tag — subtle, monochrome ---- */
	.col-storage {
		min-width: 0;
	}

	.storage-tag {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.76rem;
		font-weight: 600;
		color: var(--text-color-dimmed);
		white-space: nowrap;
	}

	.storage-tag i {
		font-size: 0.9rem;
		opacity: 0.85;
	}

	/* ---- Status badge ---- */
	.status-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.18rem 0.6rem;
		border-radius: 999px;
		font-size: 0.76rem;
		font-weight: 700;
		white-space: nowrap;
	}

	.status-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.status-badge-in {
		background: var(--st-in-bg);
		color: var(--st-in-text);
	}

	.status-badge-in .status-dot {
		background: var(--st-in-color);
	}

	.status-badge-low {
		background: var(--st-low-bg);
		color: var(--st-low-text);
	}

	.status-badge-low .status-dot {
		background: var(--st-low-color);
	}

	.status-badge-out {
		background: var(--st-out-bg);
		color: var(--st-out-text);
	}

	.status-badge-out .status-dot {
		background: var(--st-out-color);
	}

	/* ---- Count column ---- */
	.col-count {
		text-align: center;
	}

	.count-value {
		display: inline-block;
		font-variant-numeric: tabular-nums;
		font-weight: 800;
		font-size: 1.2rem;
		letter-spacing: -0.02em;
		color: var(--text-color);
	}

	.count-value.count-out {
		color: var(--st-out-text);
	}

	.count-value.count-warn {
		color: var(--st-low-text);
	}

	/* =============================================
	   Adjuster — prominent
	   ============================================= */
	.adjuster {
		display: inline-flex;
		align-items: center;
		border: 1.5px solid var(--table-border-color);
		border-radius: 999px;
		overflow: hidden;
		background: var(--hover-bg-color);
	}

	.adj-btn {
		width: 40px;
		height: 40px;
		border: none;
		background: transparent;
		color: var(--text-color);
		font-size: 1.35rem;
		font-weight: 700;
		line-height: 1;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition:
			background-color 0.12s ease-out,
			color 0.12s ease-out;
	}

	.adj-minus:hover:not(:disabled) {
		background: var(--st-out-bg);
		color: var(--st-out-text);
	}

	.adj-plus:hover:not(:disabled) {
		background: var(--st-in-bg);
		color: var(--st-in-text);
	}

	.adj-btn:disabled {
		opacity: 0.25;
		cursor: not-allowed;
	}

	.adj-input {
		width: 44px;
		height: 40px;
		min-height: 0;
		text-align: center;
		font-size: 0.95rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		color: var(--text-color);
		background: transparent;
		border: none;
		border-left: 1.5px solid var(--table-border-color);
		border-right: 1.5px solid var(--table-border-color);
		-moz-appearance: textfield;
		outline: none;
	}

	.adj-input::-webkit-outer-spin-button,
	.adj-input::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}

	.adj-input::placeholder {
		color: var(--text-color-dimmed);
		font-weight: 400;
	}

	.adj-input:focus {
		background: color-mix(in srgb, var(--add-item-color) 8%, var(--hover-bg-color));
	}

	/* =============================================
	   Reset button
	   ============================================= */
	.col-reset {
		display: flex;
		justify-content: center;
	}

	.reset-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		padding: 0;
		color: var(--text-color-dimmed);
		background: transparent;
		border: none;
		border-radius: var(--border-radius);
		cursor: pointer;
		transition: all 0.15s ease-out;
	}

	.reset-btn i {
		font-size: 1rem;
	}

	.reset-btn:hover:not(:disabled) {
		background: var(--st-out-bg);
		color: var(--st-out-text);
	}

	.reset-btn:disabled {
		opacity: 0.15;
		cursor: not-allowed;
	}

	.reset-btn:focus-visible {
		outline: 2px solid var(--add-item-color);
		outline-offset: 2px;
	}

	/* =============================================
	   Empty state
	   ============================================= */
	.tx-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.3rem;
		padding: 3rem 1.5rem;
		text-align: center;
	}

	.tx-empty i {
		font-size: 2.25rem;
		color: var(--text-color-dimmed);
		opacity: 0.6;
		margin-bottom: 0.4rem;
	}

	.empty-title {
		margin: 0;
		font-size: 1rem;
		font-weight: 700;
		color: var(--text-color);
	}

	.empty-hint {
		margin: 0;
		font-size: 0.85rem;
		color: var(--text-color-dimmed);
	}

	.empty-action {
		margin-top: 0.75rem;
		padding: 0.4rem 0.9rem;
		font-size: 0.82rem;
		font-weight: 700;
		color: var(--add-item-color);
		background: color-mix(in srgb, var(--add-item-color) 10%, transparent);
		border: 1.5px solid color-mix(in srgb, var(--add-item-color) 30%, transparent);
		border-radius: var(--border-radius);
		cursor: pointer;
		transition: all 0.15s ease-out;
	}

	.empty-action:hover {
		background: color-mix(in srgb, var(--add-item-color) 18%, transparent);
	}

	/* =============================================
	   Footer
	   ============================================= */
	.tx-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem 1.25rem;
		flex-wrap: wrap;
		padding: 0.85rem 1.75rem;
		border-top: 1px solid var(--table-border-color);
		background: color-mix(in srgb, var(--hover-bg-color) 40%, var(--container-bg));
	}

	.footer-pagination {
		flex: 1;
		min-width: 0;
	}

	.reset-all-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.45rem 0.85rem;
		font-size: 0.82rem;
		font-weight: 700;
		color: var(--st-out-text);
		background: transparent;
		border: 1.5px solid transparent;
		border-radius: var(--border-radius);
		cursor: pointer;
		white-space: nowrap;
		transition: all 0.15s ease-out;
	}

	.reset-all-btn i {
		font-size: 0.9rem;
	}

	.reset-all-btn:hover {
		background: var(--st-out-bg);
		border-color: color-mix(in srgb, var(--st-out-text) 25%, transparent);
	}

	/* =============================================
	   Notification
	   ============================================= */
	.notification {
		position: fixed;
		bottom: 20px;
		right: 20px;
		color: white;
		padding: 1rem 2rem;
		border-radius: 0.5rem;
		z-index: 1000;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
		font-weight: 500;
	}

	.notification.success {
		background-color: var(--add-item-color);
	}

	.notification.error {
		background-color: #dc3545;
	}

	.notification.warning {
		background-color: #ffc107;
		color: #333;
	}

	.notification.info {
		background-color: var(--nav-logo-color);
	}

	/* =============================================
	   Responsive — keep condensed rows on mobile
	   ============================================= */
	@media (max-width: 640px) {
		.page-container {
			padding: 0.75rem;
		}

		.tx-header {
			padding: 1.1rem 1.1rem 0.9rem;
		}

		.tx-title {
			font-size: 1.25rem;
		}

		.tx-subtitle {
			font-size: 0.8rem;
		}

		.tx-toolbar {
			padding: 0.75rem 1.1rem;
			gap: 0.75rem;
		}

		.tx-search {
			min-width: 100%;
		}

		.tx-sort {
			width: 100%;
			justify-content: flex-end;
		}

		/* Condensed rows: drop storage + status, keep name / count / adjuster / reset */
		.tx-row,
		.tx-list-head {
			grid-template-columns: minmax(0, 1fr) 2.75rem 7.25rem 2rem;
			gap: 0.6rem;
			padding: 0.5rem 1rem 0.5rem 0.85rem;
		}

		.col-storage,
		.col-status,
		.h-storage,
		.h-status {
			display: none;
		}

		.item-name {
			font-size: 0.9rem;
		}

		.count-value {
			font-size: 1.05rem;
		}

		.adj-btn {
			width: 36px;
			height: 36px;
			font-size: 1.25rem;
		}

		.adj-input {
			width: 38px;
			height: 36px;
			font-size: 0.9rem;
		}

		.tx-footer {
			padding: 0.75rem 1.1rem;
		}
	}

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

		.tx-header {
			padding: 1.5rem 2.25rem 1.25rem;
		}

		.tx-toolbar {
			padding: 0.85rem 2.25rem;
		}

		.tx-row,
		.tx-list-head {
			padding-left: 1.75rem;
			padding-right: 2.25rem;
		}

		.tx-footer {
			padding: 1rem 2.25rem;
		}
	}

	@media (min-width: 1024px) {
		.page-container {
			max-width: 94%;
			padding: 2.5rem;
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
