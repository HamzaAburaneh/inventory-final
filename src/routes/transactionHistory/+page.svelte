<script>
	import { subscribeToTransactions, getEarliestTransactionYear } from '../../lib/transactions';
	import {
		availableYears,
		countTransactionsByDay,
		currentSeasonYear,
		isMissingIndexError
	} from '../../lib/transactionHistory';
	import TransactionTimeline from '../../components/TransactionTimeline.svelte';
	import { isInventoryMovement } from '../../lib/stockHistory.js';
	import TableSkeleton from '../../components/TableSkeleton.svelte';
	import Pagination from '../../components/Pagination.svelte';
	import SearchBar from '../../components/SearchBar.svelte';
	import { getPaginationStore } from '../../stores/paginationStore';
	import { createSearchState } from '../../lib/runes/search.svelte.js';
	import { onMount } from 'svelte';

	function transactionEvent(transaction) {
		return transaction.event ?? 'countChange';
	}

	// The page shows one CNE season at a time, loaded whole. That keeps the query
	// bounded without truncating anything — every figure below covers the selected
	// season completely, so there is no "these numbers only describe the latest N
	// rows" caveat to explain. It also stays flat as the ledger grows: the largest
	// season on record is ~2,250 rows, and next season's view carries none of this
	// season's.
	//
	// $state.raw because this array is only ever reassigned wholesale from a
	// snapshot, never mutated — deep proxying would cost per-property access traps
	// on every filter, stats pass and sort comparison, and buy nothing.
	let transactions = $state.raw([]);

	// Between fairs this resolves to the last season that actually ran, so opening
	// the page in February shows real data instead of an empty current season.
	const LATEST_SEASON = currentSeasonYear();
	let selectedYear = $state(LATEST_SEASON);
	/** @type {number | null} */
	let earliestYear = $state(null);
	// Until the oldest row is known this offers the latest season alone, so the
	// picker renders immediately rather than popping in.
	const yearOptions = $derived(availableYears(earliestYear, LATEST_SEASON));

	// Set when a query fails because its composite index is still building. Index
	// builds are asynchronous, so a fresh deploy can fail this way for a few
	// minutes and then start working on its own — worth saying, since retrying is
	// genuinely the right response.
	let indexPending = $state(false);
	let loadFailed = $state(false);

	// `ready` reveals the page chrome as soon as the listener is attached (mirrors
	// manageItems' `itemsLoaded`); `received` flips once the first snapshot lands so
	// the empty state only shows after real data has come back, not during the wait.
	let ready = $state(false);
	let received = $state(false);
	let sortNewest = $state(true);
	// View filter: '' (all) | stock add/remove | item lifecycle events.
	let typeFilter = $state('');
	let unsubscribeFromTransactions = null;

	const paginationStore = getPaginationStore('transactionHistory');
	const { currentPage, itemsPerPage, setTotalItems, setCurrentPage } = paginationStore;

	const search = createSearchState();
	const searchTermValue = $derived(search.term);

	// Icons match the ones TransactionTimeline puts on the rows themselves, so a
	// filter and the rows it produces are recognisably the same thing.
	const typeFilters = [
		{ value: '', label: 'All', icon: '' },
		{ value: 'add', label: 'Stock added', icon: 'fa-arrow-up' },
		{ value: 'remove', label: 'Stock removed', icon: 'fa-arrow-down' },
		{ value: 'itemCreated', label: 'New items', icon: 'fa-box-open' },
		{ value: 'itemDeleted', label: 'Deleted items', icon: 'fa-trash-can' },
		{ value: 'stockTransfer', label: 'Transfers', icon: 'fa-arrows-left-right' },
		{ value: 'itemMerged', label: 'Merged items', icon: 'fa-object-group' }
	];

	// Firestore already applied the year and the type filter, so only the search
	// term is left to apply here — it has no server-side equivalent, since
	// Firestore cannot match a substring.
	const filteredTransactions = $derived.by(() => {
		if (!searchTermValue) return transactions;
		const lowerSearchTerm = searchTermValue.toLowerCase();
		return transactions.filter((transaction) =>
			transaction.itemName.toLowerCase().includes(lowerSearchTerm)
		);
	});

	// Summary figures shown in the stat cards, computed over the filtered set so they
	// stay in sync with the active search / type filter.
	const stats = $derived.by(() => {
		let added = 0;
		let removed = 0;
		for (const transaction of filteredTransactions) {
			if (!isInventoryMovement(transaction)) continue;
			const delta = transaction.newCount - transaction.previousCount;
			if (delta > 0) added += delta;
			else removed += delta;
		}
		return { total: filteredTransactions.length, net: added + removed, added, removed };
	});

	$effect(() => {
		setTotalItems(filteredTransactions.length);
	});

	const sortedTransactions = $derived(filteredTransactions);

	// Counted over the whole filtered set, not the current page, so a day header
	// reports that day's real total regardless of page size.
	const dayCounts = $derived(countTransactionsByDay(filteredTransactions));

	const paginatedTransactions = $derived.by(() => {
		if ($itemsPerPage === 'all') {
			return sortedTransactions;
		}
		const startIndex = ($currentPage - 1) * $itemsPerPage;
		const endIndex = startIndex + $itemsPerPage;
		return sortedTransactions.slice(startIndex, endIndex);
	});

	/**
	 * (Re)attach the live listener for the selected year, filter and sort order.
	 *
	 * All three are query parameters, so changing any of them re-queries rather
	 * than re-processing a superset that was fetched for a different question.
	 */
	function startSubscription() {
		if (unsubscribeFromTransactions) {
			unsubscribeFromTransactions();
			unsubscribeFromTransactions = null;
		}
		// The rows on screen answer the previous query. Leave them visible so the
		// list doesn't blank out mid-switch, but don't let `received` claim the new
		// snapshot has landed.
		received = false;
		indexPending = false;
		loadFailed = false;
		try {
			unsubscribeFromTransactions = subscribeToTransactions(
				(rows) => {
					transactions = rows;
					received = true;
					indexPending = false;
					loadFailed = false;
				},
				(error) => {
					// Distinguish "the index is still building, try again shortly" from a
					// real failure — the first fixes itself, the second doesn't.
					if (isMissingIndexError(error)) indexPending = true;
					else loadFailed = true;
					transactions = [];
					received = true;
				},
				{ year: selectedYear, filter: typeFilter, sortNewest }
			);
		} catch (error) {
			console.error('Error setting up transactions subscription:', error);
			loadFailed = true;
			received = true;
		}
	}

	onMount(() => {
		startSubscription();
		// Not awaited — one document read that only populates the year picker, and
		// must never delay the rows. Offline it rejects and the picker falls back to
		// the current year alone.
		getEarliestTransactionYear()
			.then((year) => {
				earliestYear = year;
			})
			.catch((error) => {
				console.warn('Earliest transaction year unavailable:', error);
			});
		ready = true;

		return () => {
			if (unsubscribeFromTransactions) {
				unsubscribeFromTransactions();
			}
		};
	});

	// A native <select> renders its open list with the OS, not the page — on macOS
	// that is a grey panel with a system-blue highlight that ignores every theme
	// variable. This is a listbox built from ordinary elements so the open state is
	// styled like the rest of the app.
	let seasonOpen = $state(false);
	/** @type {HTMLElement | undefined} */
	let seasonEl = $state();

	/** Move focus onto an option once the list opens, so keyboard use continues. */
	function focusOption(year) {
		requestAnimationFrame(() => {
			seasonEl?.querySelector(`[data-season="${year}"]`)?.focus();
		});
	}

	function openSeasons(focusYear = selectedYear) {
		seasonOpen = true;
		focusOption(focusYear);
	}

	function closeSeasons(returnFocus = true) {
		if (!seasonOpen) return;
		seasonOpen = false;
		if (returnFocus) {
			/** @type {HTMLElement | null | undefined} */
			const trigger = seasonEl?.querySelector('.season-trigger');
			trigger?.focus();
		}
	}

	function onTriggerKeydown(event) {
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			openSeasons();
		} else if (event.key === 'Escape') {
			closeSeasons();
		}
	}

	function onOptionKeydown(event) {
		const options = [...(seasonEl?.querySelectorAll('.season-option') ?? [])];
		const index = options.indexOf(event.currentTarget);
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			const next = event.key === 'ArrowDown' ? index + 1 : index - 1;
			options[Math.max(0, Math.min(options.length - 1, next))]?.focus();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			closeSeasons();
		} else if (event.key === 'Tab') {
			// Tabbing away from the list is a dismissal; don't steal focus back.
			closeSeasons(false);
		}
	}

	// Dismiss on an outside press. Bound only while open, and on pointerdown so the
	// list is gone before a click lands on whatever is underneath.
	$effect(() => {
		if (!seasonOpen) return;
		const onPointerDown = (event) => {
			if (!seasonEl?.contains(event.target)) closeSeasons(false);
		};
		document.addEventListener('pointerdown', onPointerDown);
		return () => document.removeEventListener('pointerdown', onPointerDown);
	});

	function chooseYear(year) {
		closeSeasons();
		if (year === selectedYear) return;
		selectedYear = year;
		setCurrentPage(1);
		startSubscription();
	}

	function handleSearch(value) {
		search.setTerm(value);
		setCurrentPage(1);
	}

	function handleClear() {
		search.clear();
		setCurrentPage(1);
	}

	function setTypeFilter(value) {
		if (value === typeFilter) return;
		typeFilter = value;
		setCurrentPage(1);
		startSubscription();
	}

	function toggleSort() {
		sortNewest = !sortNewest;
		setCurrentPage(1);
		// A direction on the query, not a client-side re-sort of a partial set — so
		// "Oldest" means the oldest of the year, which is what it looks like it means.
		startSubscription();
	}

	function formatSigned(value) {
		if (value > 0) return `+${value}`;
		if (value < 0) return `\u2212${Math.abs(value)}`;
		return '0';
	}

	function csvCell(value) {
		const str = String(value ?? '');
		return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
	}

	// Export the full filtered/sorted set (not just the current page) as CSV. The
	// whole selected year is already loaded, so this needs no extra reads and the
	// file matches exactly what the page is showing.
	function exportCsv() {
		const header = [
			'Item',
			'Event',
			'Type',
			'Previous',
			'New',
			'Change',
			'Timestamp',
			'User',
			'Transaction ID',
			'Item ID',
			'Location',
			'From location',
			'To location',
			'Quantity',
			'Historical transfer review'
		];
		const rows = sortedTransactions.map((transaction) => [
			transaction.itemName,
			transactionEvent(transaction),
			transaction.type,
			transaction.previousCount,
			transaction.newCount,
			transaction.newCount - transaction.previousCount,
			new Date(transaction.timestamp).toISOString(),
			transaction.user,
			transaction.id,
			transaction.itemId,
			transaction.location,
			transaction.fromLocation,
			transaction.toLocation,
			transaction.quantity,
			transaction.historicalTransfer ? 'Confirmed historical transfer' : ''
		]);
		const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `transaction-history-${selectedYear}.csv`;
		link.click();
		URL.revokeObjectURL(url);
	}
</script>

<svelte:head>
	<title>Transaction History</title>
</svelte:head>

{#if !ready}
	<TableSkeleton />
{:else}
	<div class="page-container">
		<div class="history-section">
			<div class="history-header">
				<div class="history-heading">
					<h2 class="history-title">Transaction history</h2>
					<p class="history-sub">
						{#if searchTermValue || typeFilter}
							{filteredTransactions.length.toLocaleString()} of {transactions.length.toLocaleString()}
							records in the {selectedYear} season
						{:else}
							{transactions.length.toLocaleString()}
							{transactions.length === 1 ? 'record' : 'records'} in the {selectedYear} season
						{/if}
						{#if !received}
							<span class="scope-note"><i class="fas fa-circle-notch fa-spin"></i> loading…</span>
						{/if}
					</p>
				</div>
				<button
					class="export-button"
					onclick={exportCsv}
					disabled={sortedTransactions.length === 0}
				>
					<i class="fas fa-download"></i>
					<span>Export</span>
				</button>
			</div>

			<div class="stats-grid">
				<div class="stat-card">
					<div class="stat-label"><i class="fas fa-clock-rotate-left"></i> Total</div>
					<div class="stat-value">{stats.total.toLocaleString()}</div>
				</div>
				<div class="stat-card">
					<div class="stat-label"><i class="fas fa-arrow-trend-up"></i> Net change</div>
					<div class="stat-value" class:pos={stats.net > 0} class:neg={stats.net < 0}>
						{formatSigned(stats.net)}
					</div>
				</div>
				<div class="stat-card">
					<div class="stat-label"><i class="fas fa-arrow-up"></i> Added</div>
					<div class="stat-value pos">{formatSigned(stats.added)}</div>
				</div>
				<div class="stat-card">
					<div class="stat-label"><i class="fas fa-arrow-down"></i> Removed</div>
					<div class="stat-value neg">{formatSigned(stats.removed)}</div>
				</div>
			</div>

			{#if indexPending}
				<p class="stats-scope scope-error">
					<i class="fas fa-triangle-exclamation"></i>
					This filter needs a database index that is still building. It usually takes a few minutes —
					try again shortly.
					<button class="scope-link" onclick={startSubscription}>Retry</button>
				</p>
			{:else if loadFailed}
				<p class="stats-scope scope-error">
					<i class="fas fa-triangle-exclamation"></i>
					Couldn't load the {selectedYear} season.
					<button class="scope-link" onclick={startSubscription}>Retry</button>
				</p>
			{:else}
				<p class="stats-scope">
					Movement totals exclude transfers, merges and confirmed historical transfers. Figures
					cover {typeFilter || searchTermValue ? 'every matching record' : 'every record'} in the {selectedYear}
					season (Aug 15 – Sep 15).
				</p>
			{/if}

			<div class="toolbar">
				<div class="toolbar-search">
					<SearchBar searchValue={searchTermValue} onSearch={handleSearch} onClear={handleClear} />
				</div>
				<div class="segmented" role="group" aria-label="Filter by change type">
					{#each typeFilters as option (option.value)}
						<button
							class="segment"
							class:active={typeFilter === option.value}
							data-filter={option.value}
							aria-pressed={typeFilter === option.value}
							onclick={() => setTypeFilter(option.value)}
						>
							{#if option.icon}
								<i class="fas {option.icon}" aria-hidden="true"></i>
							{/if}
							<span>{option.label}</span>
						</button>
					{/each}
				</div>
				<button class="sort-button" onclick={toggleSort} aria-label="Toggle sort order">
					<i class="fas {sortNewest ? 'fa-arrow-down-wide-short' : 'fa-arrow-up-wide-short'}"></i>
					<span>{sortNewest ? 'Newest' : 'Oldest'}</span>
				</button>
			</div>

			<div class="season-bar">
				<span class="year-label" id="season-label">Season</span>
				<div class="season-select" bind:this={seasonEl}>
					<button
						type="button"
						class="season-trigger"
						class:open={seasonOpen}
						aria-haspopup="listbox"
						aria-expanded={seasonOpen}
						aria-labelledby="season-label season-value"
						onclick={() => (seasonOpen = !seasonOpen)}
						onkeydown={onTriggerKeydown}
					>
						<span id="season-value">{selectedYear}</span>
						<i class="fas fa-chevron-down" aria-hidden="true"></i>
					</button>
					{#if seasonOpen}
						<div class="season-list" role="listbox" aria-labelledby="season-label">
							{#each yearOptions as year (year)}
								<button
									type="button"
									role="option"
									class="season-option"
									class:selected={year === selectedYear}
									aria-selected={year === selectedYear}
									data-season={year}
									onclick={() => chooseYear(year)}
									onkeydown={onOptionKeydown}
								>
									<span>{year}</span>
									{#if year === selectedYear}
										<i class="fas fa-check" aria-hidden="true"></i>
									{/if}
								</button>
							{/each}
						</div>
					{/if}
				</div>
			</div>

			<div class="timeline-section">
				{#if received && filteredTransactions.length === 0}
					<p class="empty-state">No transactions found.</p>
				{:else}
					<TransactionTimeline transactions={paginatedTransactions} {dayCounts} />
				{/if}
			</div>

			<div class="pagination-section">
				<Pagination store={paginationStore} />
			</div>
		</div>
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

	.history-section {
		background: var(--container-bg);
		border-radius: var(--border-radius);
		padding: 0;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
		border: 1px solid var(--table-border-color);
		overflow: hidden;
	}

	.history-header {
		background: var(--table-header-bg);
		padding: 0.85rem 1.25rem;
		border-bottom: 1px solid var(--table-border-color);
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.5rem 1rem;
	}

	.history-title {
		margin: 0;
		font-size: 1.15rem;
		font-weight: var(--font-weight-bold);
		color: var(--text-color);
		letter-spacing: -0.025em;
	}

	.history-sub {
		margin: 0.15rem 0 0;
		font-size: 0.78rem;
		color: var(--text-color-dimmed);
	}

	.scope-note {
		margin-left: 0.35rem;
		color: var(--text-color-dimmed);
	}

	.scope-link {
		margin-left: 0.4rem;
		padding: 0;
		font-size: inherit;
		font-weight: 500;
		color: var(--link-color);
		background: none;
		border: none;
		min-height: 0;
		text-decoration: underline;
		cursor: pointer;
	}

	.scope-link:hover {
		text-decoration-thickness: 2px;
	}

	.scope-error {
		color: var(--danger-text);
	}

	.stats-scope {
		margin: 0;
		padding: 0 1.25rem 0.9rem;
		font-size: 0.72rem;
		color: var(--text-color-dimmed);
		border-bottom: 1px solid var(--table-border-color);
	}

	.export-button {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		font-size: 0.82rem;
		font-weight: 500;
		color: var(--text-color);
		background: var(--container-bg);
		border: 1px solid var(--table-border-color);
		padding: 0.45rem 0.8rem;
		border-radius: var(--border-radius);
		min-height: 0;
		transition:
			background-color 0.15s ease-out,
			border-color 0.15s ease-out;
	}

	.export-button:hover:not(:disabled) {
		background: var(--hover-bg-color);
		border-color: var(--hover-border-color);
	}

	.export-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.625rem;
		/* The scope caption sits directly below and carries the section's bottom
		   border, so this must not draw one too. */
		padding: 1rem 1.25rem 0.6rem;
	}

	.stat-card {
		background: var(--table-header-bg);
		border: 1px solid var(--table-border-color);
		border-radius: 10px;
		padding: 0.7rem 0.8rem;
	}

	.stat-label {
		font-size: 0.72rem;
		font-weight: 500;
		color: var(--text-color-dimmed);
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.stat-value {
		font-size: 1.35rem;
		font-weight: 700;
		margin-top: 0.25rem;
		letter-spacing: -0.02em;
		color: var(--text-color);
		font-variant-numeric: tabular-nums;
	}

	.stat-value.pos {
		color: var(--event-add);
	}

	.stat-value.neg {
		color: var(--event-remove);
	}

	.toolbar {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		padding: 0.75rem 1.25rem;
		border-bottom: 1px solid var(--table-border-color);
		flex-wrap: wrap;
	}

	.toolbar-search {
		flex: 1;
		min-width: 180px;
	}

	/* Discrete bordered chips rather than one shared slab — they match
	   .sort-button and .export-button, so the whole toolbar reads as one family
	   of controls instead of a segmented control sitting next to two buttons. */
	.segmented {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.segment {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		font-size: 0.78rem;
		font-weight: 500;
		color: var(--text-color);
		background: var(--container-bg);
		border: 1px solid var(--table-border-color);
		padding: 0.3rem 0.8rem 0.3rem 0.35rem;
		border-radius: var(--border-radius);
		min-height: 0;
		transition:
			background-color 0.15s ease-out,
			border-color 0.15s ease-out,
			color 0.15s ease-out;
	}

	/* The same tinted square the timeline puts on every row (.row-ic), scaled down:
	   a filter chip and the rows it produces then carry an identical badge. The
	   fixed box also stops a trash can and an arrow — different glyph widths — from
	   landing each label on a different x. */
	.segment i {
		flex: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.4rem;
		height: 1.4rem;
		border-radius: 6px;
		font-size: 0.68rem;
	}

	.segment[data-filter='add'] i {
		background: var(--event-add-bg);
		color: var(--event-add);
	}

	.segment[data-filter='remove'] i {
		background: var(--event-remove-bg);
		color: var(--event-remove);
	}

	.segment[data-filter='itemCreated'] i {
		background: var(--event-create-bg);
		color: var(--event-create);
	}

	.segment[data-filter='itemDeleted'] i {
		background: var(--event-delete-bg);
		color: var(--event-delete);
	}

	.segment:hover:not(.active) {
		background: var(--hover-bg-color);
		border-color: var(--hover-border-color);
	}

	.segment[data-filter=''] {
		padding: 0.45rem 0.8rem;
	}

	.segment.active {
		background: var(--add-item-color);
		border-color: var(--add-item-color);
		color: var(--add-item-on);
	}

	.sort-button {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		font-size: 0.78rem;
		font-weight: 500;
		color: var(--text-color);
		background: var(--container-bg);
		border: 1px solid var(--table-border-color);
		padding: 0.45rem 0.8rem;
		border-radius: var(--border-radius);
		min-height: 0;
		transition:
			background-color 0.15s ease-out,
			border-color 0.15s ease-out;
	}

	.sort-button:hover {
		background: var(--hover-bg-color);
		border-color: var(--hover-border-color);
	}

	/* Its own row under the filters rather than competing with them: the season
	   scopes everything above it, and it is the control you touch least. */
	.season-bar {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		padding: 0.7rem 1.25rem;
		border-bottom: 1px solid var(--table-border-color);
	}

	.season-select {
		position: relative;
		/* Wide enough for a four-digit year and its chevron, and no wider — a
		   full-bleed control for "2026" reads as a text field, not a picker. */
		width: 9.5rem;
	}

	.season-trigger {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		width: 100%;
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--text-color);
		background: var(--container-bg);
		border: 1px solid var(--table-border-color);
		border-radius: var(--border-radius);
		padding: 0.45rem 0.7rem;
		min-height: 0;
		cursor: pointer;
		transition:
			background-color 0.15s ease-out,
			border-color 0.15s ease-out;
	}

	.season-trigger:hover,
	.season-trigger.open {
		background: var(--hover-bg-color);
		border-color: var(--hover-border-color);
	}

	.season-trigger:focus-visible {
		outline: 2px solid var(--focus-border-color);
		outline-offset: 1px;
	}

	.season-trigger i {
		font-size: 0.65rem;
		color: var(--text-color-dimmed);
		transition: transform 0.15s ease-out;
	}

	.season-trigger.open i {
		transform: rotate(180deg);
	}

	.season-list {
		position: absolute;
		top: calc(100% + 0.3rem);
		left: 0;
		right: 0;
		z-index: 20;
		display: flex;
		flex-direction: column;
		padding: 0.25rem;
		background: var(--container-bg);
		border: 1px solid var(--table-border-color);
		border-radius: var(--border-radius);
		box-shadow: 0 8px 20px var(--tooltip-shadow);
	}

	.season-option {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		width: 100%;
		font-size: 0.78rem;
		font-weight: 500;
		text-align: left;
		color: var(--text-color);
		background: none;
		border: none;
		border-radius: calc(var(--border-radius) - 3px);
		padding: 0.45rem 0.55rem;
		min-height: 0;
		cursor: pointer;
	}

	.season-option:hover {
		background: var(--hover-bg-color);
	}

	.season-option:focus-visible {
		outline: 2px solid var(--focus-border-color);
		outline-offset: -2px;
	}

	.season-option.selected {
		font-weight: 600;
		color: var(--value-color);
	}

	.season-option i {
		font-size: 0.7rem;
	}

	.timeline-section {
		padding: 0;
	}

	.empty-state {
		margin: 0;
		padding: 3rem 1.25rem;
		text-align: center;
		color: var(--text-color-dimmed);
		font-size: 0.95rem;
	}

	.pagination-section {
		padding: 0.6rem 1.25rem;
		border-top: 1px solid var(--table-border-color);
		background: var(--hover-bg-color);
	}

	@media (max-width: 640px) {
		.page-container {
			max-width: 100%;
			padding: 0.75rem;
		}

		/* At 375px, 1.25rem of gutter on each side is 13% of the screen spent on
		   padding — room the rows need for item names and emails. */
		.history-header,
		.stats-grid,
		.stats-scope,
		.toolbar,
		.season-bar,
		.pagination-section {
			padding-left: 1rem;
			padding-right: 1rem;
		}

		/* Keep Export on the title's row. Wrapping left it on a ragged line of its
		   own below the scope link, reading as a stray control rather than the
		   section's action. */
		.history-header {
			flex-wrap: nowrap;
			align-items: flex-start;
			gap: 0.75rem;
		}

		.history-heading {
			flex: 1 1 auto;
			min-width: 0;
		}

		.export-button {
			flex: none;
		}

		.stats-grid {
			grid-template-columns: repeat(2, 1fr);
		}

		.toolbar-search {
			flex-basis: 100%;
		}

		.season-bar {
			flex-direction: column;
			align-items: stretch;
			gap: 0.3rem;
		}

		.season-select {
			width: 100%;
		}

		.season-trigger {
			min-height: var(--touch-target-min);
		}

		.season-option {
			min-height: 2.4rem;
		}

		/* Four filter labels cannot share one row at this width: flexing them to
		   equal widths compressed each below its own text, so labels broke mid-word
		   ("Stock / added") and ran under the sort button. A 2x2 grid beneath a
		   full-width "All" fits every label on one line. */
		.segmented {
			display: grid;
			grid-template-columns: repeat(2, 1fr);
			gap: 0.4rem;
			flex: 1 1 100%;
		}

		.segment {
			/* Chips are equal-width grid cells here, so a shared left inset puts every
			   badge on the same column rather than wherever its label centres it. */
			justify-content: flex-start;
			padding: 0.4rem 0.5rem 0.4rem 0.45rem;
		}

		.segment:first-child {
			grid-column: 1 / -1;
			justify-content: center;
			padding: 0.55rem 0.5rem;
		}

		.sort-button {
			flex: 1 1 100%;
			justify-content: center;
			min-height: var(--touch-target-min);
		}

		/* An inline link at 0.78rem is a ~12px tap target; give it some height
		   without disturbing the text flow around it. */
		.scope-link {
			display: inline-block;
			padding: 0.25rem 0;
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

		.history-header,
		.stats-grid,
		.stats-scope,
		.toolbar,
		.season-bar,
		.pagination-section {
			padding-left: 2rem;
			padding-right: 2rem;
		}

		.history-title {
			font-size: 1.1rem;
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
