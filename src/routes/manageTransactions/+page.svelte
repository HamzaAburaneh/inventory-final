<script>
	import { fade, fly } from 'svelte/transition';
	import { flip } from 'svelte/animate';
	import { cubicOut } from 'svelte/easing';
	import { prefersReducedMotion } from 'svelte/motion';
	import SearchBar from '../../components/SearchBar.svelte';
	import TableSkeleton from '../../components/TableSkeleton.svelte';
	import ConfirmModal from '../../components/ConfirmModal.svelte';
	import Pagination from '../../components/Pagination.svelte';
	import StockLocationFilter from '../../components/StockLocationFilter.svelte';
	import StockLocationChips from '../../components/StockLocationChips.svelte';
	import StockLocationControls from '../../components/StockLocationControls.svelte';
	import StockTransferDialog from '../../components/StockTransferDialog.svelte';
	import StockQueuePanel from '../../components/StockQueuePanel.svelte';
	import AnimatedCount from '../../components/AnimatedCount.svelte';
	import { flashOnChange } from '../../lib/transitions.js';
	import { matchesStockLocation } from '../../lib/stockLocations.js';
	import { getPaginationStore } from '../../stores/paginationStore';
	import { itemStore } from '../../stores/itemStore';
	import { createSearchState } from '../../lib/runes/search.svelte.js';
	import { notificationStore } from '../../stores/notificationStore';
	import { applySorting } from '../../lib/items';
	import { isLowStock } from '../../lib/tableUtils.js';
	import { onMount, tick } from 'svelte';

	let currentSortColumn = $state('name');
	let sortAscending = $state(true);
	let itemsLoaded = $state(false);
	// True once the first list render is done: the staggered 8px-rise entrance
	// plays only on initial load; rows appearing later (search matches, filter
	// toggles, page flips) crossfade quickly in place instead.
	let listReady = $state(false);
	let statusFilter = $state('all');
	let locationFilter = $state('all');
	let transferId = $state(null);
	const transferItem = $derived(items.find((item) => item.id === transferId));

	const paginationStore = getPaginationStore('manageTransactions');
	const { currentPage, itemsPerPage, setTotalItems } = paginationStore;

	const search = createSearchState();

	const items = $derived($itemStore);
	const searchTermValue = $derived(search.term);

	// Respect the user's reduced-motion setting for every transition/animation below.
	const reduceMotion = $derived(prefersReducedMotion.current);

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

	const filteredItemsList = $derived(
		searchedItemsList.filter(
			(item) =>
				(statusFilter === 'all' || stockStatus(item) === statusFilter) &&
				matchesStockLocation(item, locationFilter)
		)
	);

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
		try {
			await itemStore.loadItems();
		} catch {
			// No active group yet — the layout guard will redirect; nothing to do.
			return;
		}
		itemsLoaded = true;
		await tick();
		listReady = true;
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

	const stockStatus = (item) => {
		if ((parseInt(item.count, 10) || 0) === 0) {
			return 'out';
		}
		return isLowStock(item) ? 'low' : 'in';
	};

	const statusLabel = { in: 'In stock', low: 'Low stock', out: 'Out of stock' };

	function notifyOutcome(result, label) {
		notificationStore.showNotification(
			result.status === 'applied'
				? label
				: result.status === 'queued'
					? 'Change saved on this device, pending sync.'
					: 'Change needs attention. Review pending changes.',
			result.status === 'attention' ? 'error' : 'success'
		);
	}
	const changeCount = async (item, amount, location) => {
		const result = await itemStore.changeCount(item.id, amount, location);
		notifyOutcome(result, 'Stock updated successfully!');
		return result;
	};
	const transferStock = async (id, from, to, quantity) => {
		const result = await itemStore.transferStock(id, from, to, quantity);
		notifyOutcome(result, 'Stock transferred successfully!');
		return result;
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
		try {
			const result = await itemStore.resetItemCount(item.id);
			notifyOutcome(result, 'All locations reset successfully!');
		} catch (error) {
			notificationStore.showNotification(
				error instanceof Error ? error.message : 'Could not reset the count. Please try again.',
				'error'
			);
		}
	};

	const doResetAll = async () => {
		// Each item's count reset and its ledger record are paired in the same
		// atomic batch by the data layer.
		try {
			const result = await itemStore.resetAllCounts();
			notifyOutcome(result, 'All counts have been reset successfully!');
		} catch (error) {
			notificationStore.showNotification(
				error instanceof Error ? error.message : 'Could not reset all counts. Please try again.',
				'error'
			);
		}
	};
</script>

{#if itemsLoaded}
	<div class="page-container">
		<StockQueuePanel />
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
					<span class="sum-item"><strong><AnimatedCount value={totalUnits} /></strong> units</span>
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
				<StockLocationFilter
					value={locationFilter}
					onchange={(value) => {
						locationFilter = value;
						paginationStore.setCurrentPage(1);
					}}
				/>
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
					<button
						class="sort-btn"
						class:active={currentSortColumn === 'stockByStorage'}
						onclick={() => sortBy('stockByStorage')}
					>
						<span>Locations</span>
						{#if currentSortColumn === 'stockByStorage'}
							<i class="fas {sortAscending ? 'fa-sort-up' : 'fa-sort-down'} sort-arrow"></i>
						{/if}
					</button>
				</div>
			</div>

			<!-- List -->
			<div class="tx-list">
				<div class="tx-list-head" aria-hidden="true">
					<span class="h-item">Item</span>
					<span class="h-storage">Stock locations</span>
					<span class="h-status">Status</span>
					<span class="h-count">Total</span>
					<span class="h-adjust">Adjust</span>
				</div>

				{#if paginatedItemsList.length === 0}
					<div class="tx-empty" in:fade={{ duration: reduceMotion ? 0 : 150 }}>
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
					{#each paginatedItemsList as item, i (item.id)}
						{@const status = stockStatus(item)}
						<div
							class="tx-row"
							style="--stripe-color: var(--st-{status}-color)"
							use:flashOnChange={item.count}
							in:fly={{
								y: listReady ? 0 : 8,
								duration: reduceMotion ? 0 : listReady ? 150 : 320,
								delay: reduceMotion || listReady ? 0 : Math.min(i * 45, 450),
								easing: cubicOut
							}}
							animate:flip={{
								duration: (d) => (reduceMotion ? 0 : Math.min(Math.sqrt(d) * 30, 300)),
								easing: cubicOut
							}}
						>
							<div class="col-item">
								<span class="item-name" title={item.name}>{item.name}</span>
							</div>
							<div class="col-storage"><StockLocationChips {item} /></div>
							<div class="col-status">
								<span class="status-stack">
									{#key status}
										<span
											class="status-badge status-badge-{status}"
											in:fly={{ y: 6, duration: reduceMotion ? 0 : 220, easing: cubicOut }}
											out:fade={{ duration: reduceMotion ? 0 : 150 }}
										>
											<span class="status-dot"></span>
											{statusLabel[status]}
										</span>
									{/key}
								</span>
							</div>
							<div class="col-count">
								<span
									class="count-value"
									class:count-out={status === 'out'}
									class:count-warn={status === 'low'}
								>
									<AnimatedCount value={item.count} />
								</span>
							</div>
							<div class="col-adjust">
								<StockLocationControls
									{item}
									onchange={changeCount}
									ontransfer={(item) => (transferId = item.id)}
									onreset={askResetCount}
								/>
							</div>
						</div>
					{/each}
				{/if}
			</div>

			<!-- Footer -->
			<div class="tx-footer">
				<div class="footer-pagination">
					<Pagination store={paginationStore} compact />
				</div>
				<button class="reset-all-btn motion-safe:active:scale-95" onclick={askResetAll}>
					<i class="ti ti-rotate-clockwise"></i>
					Reset all counts
				</button>
			</div>
		</div>
	</div>
{:else}
	<TableSkeleton />
{/if}

{#if transferItem}<StockTransferDialog
		item={transferItem}
		ontransfer={transferStock}
		onclose={() => (transferId = null)}
	/>{/if}

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
		This clears every storage location for every item. Offline resets wait to sync; intervening
		stock changes require confirmation again.
	{:else if confirm.item}
		This clears every location for this item. If stock changes before an offline reset syncs, you
		must review it again.
	{/if}
</ConfirmModal>

<style>
	.page-container {
		--st-in-color: var(--event-add);
		--st-low-color: var(--icon-hover-color);
		--st-out-color: var(--event-remove);
		--st-in-bg: var(--event-add-bg);
		--st-low-bg: color-mix(in srgb, var(--icon-hover-color) 15%, var(--container-bg));
		--st-out-bg: var(--event-remove-bg);
		--st-in-text: var(--text-color);
		--st-low-text: var(--text-color);
		--st-out-text: var(--danger-text);
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
		box-shadow: var(--nav-dropdown-shadow);
		border: 1px solid var(--table-border-color);
		overflow: hidden;
		/* Keep row-glide repaints contained to this card instead of the page. */
		contain: paint;
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
		font-size: var(--text-2xl);
		font-weight: var(--font-weight-bold);
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
		min-height: 44px;
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
		grid-template-columns: minmax(8rem, 1fr) minmax(8rem, 0.7fr) 7rem 4rem minmax(17rem, 1fr);
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
		background: var(--container-bg);
		border-left: 4px solid var(--stripe-color);
		border-bottom: 1px solid var(--table-border-color);
		transition:
			background-color 0.12s ease-out,
			border-left-color 0.35s ease-out;
	}

	/* A just-adjusted row washes with its status colour and settles, tying the
	   chip, balance and total changes together as one event. */
	.tx-row:global(.is-flashing) {
		animation: row-flash 900ms ease-out;
	}

	@keyframes row-flash {
		from {
			background-color: color-mix(in srgb, var(--stripe-color) 16%, var(--container-bg));
		}
	}

	.tx-row:last-child {
		border-bottom: none;
	}

	.tx-row:hover {
		/* Active/editing row picks up a faint wash of its own status stripe colour
		   (green/amber/red) instead of a flat grey, which read as "disabled" in
		   light mode. --stripe-color and --container-bg both flip per theme, so the
		   tint stays subtle in light and dark. */
		background: color-mix(in srgb, var(--stripe-color) 9%, var(--container-bg));
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

	/* ---- Status badge ---- */
	/* Old and new badges share one cell so a status swap crossfades in place. */
	.status-stack {
		display: inline-grid;
	}

	.status-stack > .status-badge {
		grid-area: 1 / 1;
		justify-self: start;
	}

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
		position: relative;
		z-index: 1;
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
	   Responsive — keep condensed rows on mobile
	   ============================================= */
	@media (max-width: 1050px) {
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

		/* Stacked card rows: the grid header makes no sense here, so hide it and
		   lay each row out as name / storage+status+count meta / full-width
		   adjuster. This gives the name the whole width (no more clipping) and
		   turns the adjuster into big, thumb-friendly targets. */
		.tx-list-head {
			display: none;
		}

		.tx-row {
			display: flex;
			flex-wrap: wrap;
			align-items: center;
			gap: 0.55rem;
			padding: 0.7rem 0.9rem;
		}

		.col-item {
			flex: 0 0 100%;
			min-width: 0;
		}

		.col-storage,
		.col-status,
		.col-count {
			flex: 0 0 auto;
		}

		.col-adjust {
			flex: 0 0 100%;
		}

		/* Name owns the full width, so it wraps instead of clipping. */
		.item-name {
			font-size: 0.95rem;
			white-space: normal;
			overflow-wrap: anywhere;
		}

		.count-value {
			font-size: 1.05rem;
		}

		/* Footer 3: compact pager + per-page on one row, then a full-width
		   outlined-red "Reset all" separated by a divider. */
		.tx-footer {
			flex-direction: column;
			align-items: stretch;
			gap: 0.75rem;
			padding: 0.75rem 1.1rem;
		}

		.footer-pagination {
			padding-bottom: 0.75rem;
			border-bottom: 1px solid var(--table-border-color);
		}

		.reset-all-btn {
			width: 100%;
			justify-content: center;
			padding: 0.6rem;
			background: var(--st-out-bg);
			border-color: color-mix(in srgb, var(--st-out-text) 40%, transparent);
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
