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

	const paginationStore = getPaginationStore('manageTransactions');
	const { currentPage, itemsPerPage, setTotalItems } = paginationStore;

	const search = createSearchState();

	const items = $derived($itemStore);
	const searchTermValue = $derived(search.term);
	const notification = $derived($notificationStore.at(-1) ?? null);
	const authUser = $derived($authStore);

	const filteredItemsList = $derived.by(() => {
		if (!searchTermValue) {
			return items;
		}
		const lowerCaseSearchTerm = searchTermValue.toLowerCase();
		return items.filter((item) => item.name.toLowerCase().includes(lowerCaseSearchTerm));
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

	const totalUnits = $derived(
		filteredItemsList.reduce((sum, item) => sum + (parseInt(item.count, 10) || 0), 0)
	);

	const lowStockCount = $derived(
		filteredItemsList.filter((item) => stockStatus(item) === 'low').length
	);
	const outOfStockCount = $derived(
		filteredItemsList.filter((item) => stockStatus(item) === 'out').length
	);

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

	const storageChip = (item) => {
		switch ((item.storageType || '').toLowerCase()) {
			case 'freezer':
				return { icon: 'ti-snowflake', label: 'Freezer', color: 'freezer' };
			case 'refrigerator':
				return { icon: 'ti-temperature', label: 'Refrigerator', color: 'refrigerator' };
			case 'dry storage':
				return { icon: 'ti-box', label: 'Dry Storage', color: 'dry-storage' };
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
				<div class="tx-stats">
					<div class="stat-card">
						<span class="stat-number">{filteredItemsList.length}</span>
						<span class="stat-label">items</span>
					</div>
					<div class="stat-card">
						<span class="stat-number">{totalUnits}</span>
						<span class="stat-label">units</span>
					</div>
					{#if lowStockCount > 0}
						<div class="stat-card stat-card-warn">
							<span class="stat-number">{lowStockCount}</span>
							<span class="stat-label">low</span>
						</div>
					{/if}
					{#if outOfStockCount > 0}
						<div class="stat-card stat-card-danger">
							<span class="stat-number">{outOfStockCount}</span>
							<span class="stat-label">out</span>
						</div>
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

			<!-- Table -->
			<div class="table-wrap">
				<table class="tx-table">
					<thead>
						<tr>
							<th class="th-item">Item</th>
							<th class="th-count">Count</th>
							<th class="th-storage">Storage</th>
							<th class="th-status">Status</th>
							<th class="th-adjust">Adjust</th>
							<th class="th-reset"></th>
						</tr>
					</thead>
					<tbody>
						{#each paginatedItemsList as item (item.id)}
							{@const status = stockStatus(item)}
							{@const storage = storageChip(item)}
							<tr
								class="status-stripe"
								style="--stripe-color: var(--st-{status}-color)"
								in:fade={{ duration: 150 }}
							>
								<td class="col-item">
									<span class="item-name">{item.name}</span>
								</td>
								<td class="col-count">
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
								</td>
								<td class="col-storage">
									{#if storage}
										<span class="storage-pill" data-storage={storage.color}>
											<i class="ti {storage.icon}"></i>
											{storage.label}
										</span>
									{/if}
								</td>
								<td class="col-status">
									<span class="status-badge status-badge-{status}">
										<span class="status-dot"></span>
										{statusLabel[status]}
									</span>
								</td>
								<td class="col-adjust">
									<div class="adjuster">
										<button
											class="adj-btn"
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
											class="adj-btn"
											onclick={() => changeCount(item, +item.changeAmount)}
											disabled={item.changeAmount === 0}
											aria-label="Add {item.changeAmount || ''} to {item.name}"
										>
											+
										</button>
									</div>
								</td>
								<td class="col-reset">
									<button
										class="reset-btn"
										onclick={() => askResetCount(item)}
										disabled={item.count === 0}
										aria-label="Reset {item.name} to 0"
										title="Reset to 0"
									>
										<i class="ti ti-rotate-clockwise"></i>
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
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
	title="Are you sure?"
	confirmText={confirm.kind === 'resetAll' ? 'Yes, reset all!' : 'Yes, reset it!'}
	cancelText="Cancel"
	variant={confirm.kind === 'resetAll' ? 'danger' : 'warning'}
	onConfirm={handleConfirm}
	onCancel={cancelConfirm}
>
	{#if confirm.kind === 'resetAll'}
		This will reset the count for <strong class="emphasis">ALL</strong> items to 0.
	{:else if confirm.item}
		This will reset the count for <strong>"{confirm.item.name}"</strong> to 0.
	{/if}
</ConfirmModal>

{#if notification}
	<div class="notification {notification.type}" in:fade out:fade>
		{notification.message}
	</div>
{/if}

<style>
	/* =============================================
	   Status stripe colours (light)
	   ============================================= */
	.page-container {
		--st-in-color: #16a34a;
		--st-low-color: #d97706;
		--st-out-color: #dc2626;
		--st-in-bg: #f0fdf4;
		--st-low-bg: #fffbeb;
		--st-out-bg: #fef2f2;
		--st-in-text: #16a34a;
		--st-low-text: #b45309;
		--st-out-text: #dc2626;
	}

	:global([data-theme='dark']) .page-container {
		--st-in-color: #34d399;
		--st-low-color: #fbbf24;
		--st-out-color: #f87171;
		--st-in-bg: rgba(52, 211, 153, 0.08);
		--st-low-bg: rgba(251, 191, 36, 0.08);
		--st-out-bg: rgba(248, 113, 113, 0.08);
		--st-in-text: #34d399;
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
		padding: 1.5rem 1.75rem 1.25rem;
		border-bottom: 1px solid var(--table-border-color);
	}

	.tx-title {
		margin: 0;
		font-size: 1.4rem;
		font-weight: 700;
		color: var(--text-color);
		letter-spacing: -0.025em;
		line-height: 1.2;
	}

	.tx-subtitle {
		margin: 0.25rem 0 0;
		font-size: 0.88rem;
		color: var(--text-color-dimmed);
		line-height: 1.4;
	}

	.tx-stats {
		display: flex;
		align-items: stretch;
		gap: 0.625rem;
		margin-top: 1rem;
		flex-wrap: wrap;
	}

	.stat-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.1rem;
		padding: 0.6rem 1rem;
		min-width: 5rem;
		background: var(--hover-bg-color);
		border: 1px solid var(--table-border-color);
		border-radius: var(--border-radius);
		white-space: nowrap;
	}

	.stat-number {
		font-size: 1.2rem;
		font-weight: 700;
		color: var(--text-color);
		line-height: 1.2;
		font-variant-numeric: tabular-nums;
	}

	.stat-label {
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--text-color-dimmed);
		text-transform: lowercase;
	}

	.stat-card-warn {
		background: var(--st-low-bg);
		border-color: color-mix(in srgb, var(--st-low-text) 25%, var(--table-border-color));
	}

	.stat-card-warn .stat-number {
		color: var(--st-low-text);
	}

	.stat-card-warn .stat-label {
		color: var(--st-low-text);
		opacity: 0.7;
	}

	.stat-card-danger {
		background: var(--st-out-bg);
		border-color: color-mix(in srgb, var(--st-out-text) 25%, var(--table-border-color));
	}

	.stat-card-danger .stat-number {
		color: var(--st-out-text);
	}

	.stat-card-danger .stat-label {
		color: var(--st-out-text);
		opacity: 0.7;
	}

	/* =============================================
	   Toolbar
	   ============================================= */
	.tx-toolbar {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1rem 1.75rem;
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
		font-weight: 600;
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
		font-weight: 600;
		color: var(--text-color-dimmed);
		background: var(--container-bg);
		border: 1px solid var(--table-border-color);
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
		background: color-mix(in srgb, var(--add-item-color) 8%, var(--container-bg));
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
	   Table
	   ============================================= */
	.table-wrap {
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
	}

	.tx-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9rem;
	}

	.tx-table th {
		text-align: left;
		padding: 0.7rem 1.1rem;
		background: var(--table-header-bg);
		color: var(--text-color-dimmed);
		font-weight: 600;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		border-bottom: 1px solid var(--table-border-color);
		white-space: nowrap;
	}

	.th-count {
		text-align: center;
		width: 5rem;
	}

	.tx-table td {
		padding: 0.75rem 1.1rem;
		border-bottom: 1px solid var(--table-border-color);
		color: var(--text-color);
		vertical-align: middle;
	}

	.tx-table tbody tr:last-child td {
		border-bottom: none;
	}

	.tx-table tbody tr {
		transition: background-color 0.12s ease-out;
	}

	.tx-table tbody tr:hover td {
		background: var(--hover-bg-color);
	}

	/* Status stripe — left accent */
	.status-stripe td:first-child {
		border-left: 4px solid var(--stripe-color);
		padding-left: calc(1.1rem - 4px + 4px);
	}

	/* ---- Item column ---- */
	.item-name {
		font-weight: 600;
		color: var(--text-color);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 22rem;
		display: inline-block;
	}

	/* ---- Count column ---- */
	.col-count {
		text-align: center;
		width: 5rem;
		padding-left: 0.75rem;
		padding-right: 0.75rem;
	}

	.count-value {
		font-variant-numeric: tabular-nums;
		font-weight: 700;
		font-size: 1.05rem;
		color: var(--text-color);
	}

	.count-value.count-out {
		color: var(--st-out-text);
	}

	.count-value.count-warn {
		color: var(--st-low-text);
	}

	/* =============================================
	   Storage pills — muted, secondary feel
	   ============================================= */
	.storage-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.2rem 0.6rem;
		border-radius: 6px;
		font-size: 0.78rem;
		font-weight: 500;
		white-space: nowrap;
		background: var(--hover-bg-color);
		color: var(--text-color-dimmed);
		border: 1px solid var(--table-border-color);
	}

	.storage-pill[data-storage='freezer'] {
		background: color-mix(in srgb, #3b82f6 10%, transparent);
		color: #3b82f6;
		border-color: color-mix(in srgb, #3b82f6 20%, var(--table-border-color));
	}

	.storage-pill[data-storage='refrigerator'] {
		background: color-mix(in srgb, #10b981 10%, transparent);
		color: #10b981;
		border-color: color-mix(in srgb, #10b981 20%, var(--table-border-color));
	}

	.storage-pill[data-storage='dry-storage'] {
		background: color-mix(in srgb, #f59e0b 10%, transparent);
		color: #d97706;
		border-color: color-mix(in srgb, #f59e0b 20%, var(--table-border-color));
	}

	:global([data-theme='dark']) .storage-pill[data-storage='freezer'] {
		background: color-mix(in srgb, #60a5fa 10%, transparent);
		color: #60a5fa;
		border-color: color-mix(in srgb, #60a5fa 20%, var(--table-border-color));
	}

	:global([data-theme='dark']) .storage-pill[data-storage='refrigerator'] {
		background: color-mix(in srgb, #34d399 10%, transparent);
		color: #34d399;
		border-color: color-mix(in srgb, #34d399 20%, var(--table-border-color));
	}

	:global([data-theme='dark']) .storage-pill[data-storage='dry-storage'] {
		background: color-mix(in srgb, #fbbf24 10%, transparent);
		color: #fbbf24;
		border-color: color-mix(in srgb, #fbbf24 20%, var(--table-border-color));
	}

	/* =============================================
	   Status badges — clear, self-contained
	   ============================================= */
	.status-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.2rem 0.65rem;
		border-radius: 999px;
		font-size: 0.78rem;
		font-weight: 600;
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

	/* =============================================
	   Adjuster — larger touch targets
	   ============================================= */
	.adjuster {
		display: inline-flex;
		align-items: center;
		border: 1px solid var(--table-border-color);
		border-radius: 999px;
		overflow: hidden;
		background: var(--hover-bg-color);
	}

	.adj-btn {
		width: 34px;
		height: 34px;
		border: none;
		background: transparent;
		color: var(--text-color);
		font-size: 1rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition:
			background-color 0.12s ease-out,
			color 0.12s ease-out;
	}

	.adj-btn:hover:not(:disabled) {
		background: var(--table-border-color);
		color: var(--add-item-color);
	}

	.adj-btn:disabled {
		opacity: 0.25;
		cursor: not-allowed;
	}

	.adj-input {
		width: 36px;
		height: 34px;
		min-height: 0;
		text-align: center;
		font-size: 0.88rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		color: var(--text-color);
		background: transparent;
		border: none;
		border-left: 1px solid var(--table-border-color);
		border-right: 1px solid var(--table-border-color);
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
		background: color-mix(in srgb, var(--add-item-color) 6%, var(--hover-bg-color));
	}

	/* =============================================
	   Reset button
	   ============================================= */
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
		font-weight: 600;
		color: var(--st-out-text);
		background: transparent;
		border: 1px solid transparent;
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
		border-color: color-mix(in srgb, var(--st-out-text) 20%, transparent);
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
	   Responsive
	   ============================================= */
	@media (max-width: 640px) {
		.page-container {
			padding: 0.75rem;
		}

		.tx-header {
			padding: 1.25rem 1.25rem 1rem;
		}

		.tx-title {
			font-size: 1.2rem;
		}

		.tx-subtitle {
			font-size: 0.82rem;
		}

		.tx-stats {
			gap: 0.5rem;
		}

		.stat-card {
			flex: 1;
			min-width: 0;
			padding: 0.5rem 0.5rem;
		}

		.stat-number {
			font-size: 1.05rem;
		}

		.stat-label {
			font-size: 0.7rem;
		}

		.tx-toolbar {
			padding: 0.75rem 1.25rem;
			gap: 0.75rem;
		}

		.tx-search {
			min-width: 100%;
		}

		.tx-sort {
			width: 100%;
			justify-content: flex-end;
		}

		.tx-table {
			font-size: 0.85rem;
		}

		.tx-table th {
			padding: 0.6rem 0.75rem;
			font-size: 0.7rem;
		}

		.tx-table td {
			padding: 0.6rem 0.75rem;
		}

		.item-name {
			max-width: 10rem;
		}

		.count-value {
			font-size: 0.95rem;
		}

		.storage-pill,
		.status-badge {
			font-size: 0.72rem;
		}

		.adj-btn {
			width: 32px;
			height: 32px;
		}

		.adj-input {
			width: 32px;
			height: 32px;
			font-size: 0.82rem;
		}

		.tx-footer {
			padding: 0.75rem 1.25rem;
		}

		/* Hide less important columns on mobile */
		.col-storage,
		.col-status {
			display: none;
		}

		.th-storage,
		.th-status {
			display: none;
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
			padding: 1.75rem 2.25rem 1.5rem;
		}

		.tx-toolbar {
			padding: 1rem 2.25rem;
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
