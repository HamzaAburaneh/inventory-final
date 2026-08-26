<script>
	import {
		subscribeToTransactions,
		getAllTransactions,
		getTransactionCount,
		RECENT_WINDOW_SIZE
	} from '../../lib/transactions';
	import {
		mergeTransactionWindows,
		windowCoversLedger,
		paginationNeedsFullHistory,
		countTransactionsByDay
	} from '../../lib/transactionHistory';
	import TransactionTimeline from '../../components/TransactionTimeline.svelte';
	import TableSkeleton from '../../components/TableSkeleton.svelte';
	import Pagination from '../../components/Pagination.svelte';
	import SearchBar from '../../components/SearchBar.svelte';
	import { getPaginationStore } from '../../stores/paginationStore';
	import { createSearchState } from '../../lib/runes/search.svelte.js';
	import { onMount } from 'svelte';

	function transactionEvent(transaction) {
		return transaction.event ?? 'countChange';
	}

	// The live listener is bounded to the newest RECENT_WINDOW_SIZE records so first
	// paint doesn't scale with ledger size. `fullTransactions` stays null until
	// something needs the whole ledger (search, type filter, oldest-first, deep
	// paging, "all" page size, CSV export), at which point it's fetched once and
	// merged over the live window — see `ensureFullHistory`.
	//
	// Both use $state.raw: these arrays are only ever reassigned wholesale from a
	// snapshot, never mutated, so deep proxying would buy nothing and cost a lot.
	// Measured over a ~6.3k-record ledger, the derived chain ran 12.9 ms proxied
	// vs 1.1 ms raw — the proxy's per-property access traps, paid on every filter,
	// stats pass and sort comparison.
	let recentTransactions = $state.raw([]);
	/** @type {import('../../types').Transaction[] | null} */
	let fullTransactions = $state.raw(null);
	let loadingFull = $state(false);
	let fullLoadFailed = $state(false);
	// Size of the whole ledger, from a server-side count aggregation — so the header
	// can say "250 of 6,314" without downloading 6,314 records to find out. Stays
	// null when the count is unavailable (offline: aggregations can't be served from
	// the local cache), in which case the header falls back to what's loaded.
	/** @type {number | null} */
	let ledgerTotal = $state(null);
	// `ready` reveals the page chrome as soon as the listener is attached (mirrors
	// manageItems' `itemsLoaded`); `received` flips once the first snapshot lands so
	// the empty state only shows after real data has come back, not during the wait.
	let ready = $state(false);
	let received = $state(false);
	// The timeline is inherently chronological, so sorting collapses to a single
	// newest/oldest toggle on the transaction timestamp.
	let sortNewest = $state(true);
	// View filter: '' (all) | stock add/remove | item lifecycle events.
	let typeFilter = $state('');
	let unsubscribeFromTransactions = null;

	const paginationStore = getPaginationStore('transactionHistory');
	const { currentPage, itemsPerPage, setTotalItems, setCurrentPage } = paginationStore;

	const search = createSearchState();
	const searchTermValue = $derived(search.term);

	const typeFilters = [
		{ value: '', label: 'All' },
		{ value: 'add', label: 'Stock added' },
		{ value: 'remove', label: 'Stock removed' },
		{ value: 'itemCreated', label: 'New items' },
		{ value: 'itemDeleted', label: 'Deleted items' }
	];

	// The set every downstream derived works from. Before escalation that's just the
	// live window; after it, the full ledger with the live window merged over the
	// top by id — so transactions that arrive in realtime after the one-shot fetch
	// still show up. The ledger is append-only (items.js only ever adds rows, and
	// deleting an item writes an `itemDeleted` row rather than removing history), so
	// a merge can never leave a stale row behind.
	const allTransactions = $derived(mergeTransactionWindows(fullTransactions, recentTransactions));

	// True once every downstream figure (search, filters, stats, sort, export) spans
	// the whole ledger rather than just the live window.
	const scopeIsFull = $derived(fullTransactions !== null);

	// What "of N records" counts. Once escalated the loaded set is authoritative
	// (and includes anything that arrived since the count was taken); before that
	// the server count is, falling back to the loaded window if it's unavailable.
	const totalRecords = $derived(
		scopeIsFull ? allTransactions.length : (ledgerTotal ?? allTransactions.length)
	);

	// Whether what's loaded is known to be the complete ledger — either because it
	// was escalated, or because Firestore returned fewer rows than the window cap
	// (which means it ran out). Anything else is a partial view, even when the
	// server count is unavailable and we can't say how partial.
	const windowIsEverything = $derived(
		scopeIsFull || windowCoversLedger(received, recentTransactions.length, RECENT_WINDOW_SIZE)
	);

	/** @type {Promise<void> | null} */
	let fullLoadPromise = null;

	/**
	 * Load the whole ledger once, then let it be merged with the live window.
	 * Idempotent and safe to call from several triggers at once — the in-flight
	 * promise is shared, and a plain (non-reactive) variable guards re-entry so
	 * calling this from an effect can't loop.
	 * @returns {Promise<void>} Resolves once the full ledger is loaded (or failed).
	 */
	function ensureFullHistory() {
		if (fullLoadPromise) return fullLoadPromise;
		// Firestore returned fewer rows than the window cap, which means it ran out of
		// documents — the window already IS the whole ledger. Promote it rather than
		// paying for a redundant read (the common case for a young group).
		if (windowCoversLedger(received, recentTransactions.length, RECENT_WINDOW_SIZE)) {
			fullTransactions = recentTransactions;
			fullLoadPromise = Promise.resolve();
			return fullLoadPromise;
		}
		loadingFull = true;
		fullLoadFailed = false;
		fullLoadPromise = getAllTransactions()
			.then((transactions) => {
				fullTransactions = transactions;
			})
			.catch((error) => {
				console.error('Error loading full transaction history:', error);
				fullLoadFailed = true;
				// Clear the guard so a later trigger (or a retry) can try again.
				fullLoadPromise = null;
			})
			.finally(() => {
				loadingFull = false;
			});
		return fullLoadPromise;
	}

	const filteredTransactions = $derived.by(() => {
		let result = allTransactions;
		if (typeFilter) {
			result = result.filter((transaction) => {
				const event = transactionEvent(transaction);
				if (typeFilter === 'itemCreated' || typeFilter === 'itemDeleted') {
					return event === typeFilter;
				}
				return event === 'countChange' && transaction.type === typeFilter;
			});
		}
		if (searchTermValue) {
			const lowerSearchTerm = searchTermValue.toLowerCase();
			result = result.filter((transaction) =>
				transaction.itemName.toLowerCase().includes(lowerSearchTerm)
			);
		}
		return result;
	});

	// Summary figures shown in the stat cards, computed over the filtered set so they
	// stay in sync with the active search / type filter.
	const stats = $derived.by(() => {
		let added = 0;
		let removed = 0;
		for (const transaction of filteredTransactions) {
			const delta = transaction.newCount - transaction.previousCount;
			if (delta > 0) added += delta;
			else removed += delta;
		}
		return { total: filteredTransactions.length, net: added + removed, added, removed };
	});

	$effect(() => {
		setTotalItems(filteredTransactions.length);
	});

	// Pagination lives in a store, so this is the one trigger that has to be an
	// effect rather than an event handler. Escalate when the user asks for a page
	// the live window can't fill, or picks the "all" page size — otherwise "all"
	// would quietly mean "all 250".
	$effect(() => {
		const needsFull = paginationNeedsFullHistory({
			received,
			windowSize: recentTransactions.length,
			page: $currentPage,
			perPage: $itemsPerPage
		});
		if (needsFull) ensureFullHistory();
	});

	const sortedTransactions = $derived(
		[...filteredTransactions].sort((a, b) =>
			sortNewest ? b.timestamp - a.timestamp : a.timestamp - b.timestamp
		)
	);

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

	function startSubscription() {
		try {
			unsubscribeFromTransactions = subscribeToTransactions(
				(transactions) => {
					recentTransactions = transactions;
					received = true;
				},
				() => {
					received = true;
				}
			);
		} catch (error) {
			console.error('Error setting up transactions subscription:', error);
			received = true;
		}
	}

	onMount(() => {
		startSubscription();
		// Deliberately not awaited — it's a separate tiny round trip that must never
		// delay the rows. Offline it just rejects and the header falls back.
		try {
			getTransactionCount()
				.then((count) => {
					ledgerTotal = count;
				})
				.catch((error) => {
					console.warn('Transaction count unavailable:', error);
				});
		} catch (error) {
			console.warn('Transaction count unavailable:', error);
		}
		ready = true;

		return () => {
			if (unsubscribeFromTransactions) {
				unsubscribeFromTransactions();
			}
		};
	});

	function handleSearch(value) {
		search.setTerm(value);
		setCurrentPage(1);
		// Searching only the newest 250 would silently hide older matches, so pull the
		// rest. Fires once — subsequent keystrokes filter the already-loaded set.
		if (value) ensureFullHistory();
	}

	function handleClear() {
		search.clear();
		setCurrentPage(1);
	}

	function setTypeFilter(value) {
		typeFilter = value;
		setCurrentPage(1);
		// Same reasoning as search: a filtered count over a 250-row window would be
		// wrong for the ledger as a whole.
		if (value) ensureFullHistory();
	}

	function toggleSort() {
		sortNewest = !sortNewest;
		// "Oldest" over the newest-250 window would show the oldest of the window, not
		// of the ledger — which is simply the wrong answer. Load the rest.
		if (!sortNewest) ensureFullHistory();
	}

	function formatSigned(value) {
		const sign = value > 0 ? '+' : value < 0 ? '−' : '';
		return `${sign}${Math.abs(value).toLocaleString()}`;
	}

	function escapeCsv(value) {
		const str = String(value ?? '');
		return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
	}

	// Export the full filtered/sorted set (not just the current page) as CSV. The
	// bounded listener means "full" has to be loaded first — export is a deliberate,
	// infrequent action, so paying for the whole ledger here is the right trade
	// rather than silently exporting a truncated file.
	async function exportCsv() {
		await ensureFullHistory();
		const header = ['Item', 'Event', 'Type', 'Previous', 'New', 'Change', 'Timestamp', 'User'];
		const rows = sortedTransactions.map((transaction) => [
			transaction.itemName,
			transactionEvent(transaction),
			transaction.type,
			transaction.previousCount,
			transaction.newCount,
			transaction.newCount - transaction.previousCount,
			new Date(transaction.timestamp).toISOString(),
			transaction.user
		]);
		const csv = [header, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');
		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `transaction-history-${new Date().toISOString().slice(0, 10)}.csv`;
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
						{filteredTransactions.length.toLocaleString()} of {totalRecords.toLocaleString()}
						records
						{#if loadingFull}
							<span class="scope-note">
								<i class="fas fa-circle-notch fa-spin"></i> loading full history…
							</span>
						{:else if fullLoadFailed}
							<span class="scope-note scope-error">
								<i class="fas fa-triangle-exclamation"></i> couldn't load older records
							</span>
							<button class="scope-link" onclick={ensureFullHistory}>Retry</button>
						{:else if !windowIsEverything}
							<span class="scope-note">· latest {allTransactions.length.toLocaleString()}</span>
							<button class="scope-link" onclick={ensureFullHistory}>Load full history</button>
						{/if}
					</p>
				</div>
				<button
					class="export-button"
					onclick={exportCsv}
					disabled={loadingFull || sortedTransactions.length === 0}
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

			<p class="stats-scope">
				{#if windowIsEverything}
					Figures cover all {totalRecords.toLocaleString()} records.
				{:else if ledgerTotal !== null}
					Figures cover the latest {allTransactions.length.toLocaleString()} of {ledgerTotal.toLocaleString()}
					records — search, filter or sort by oldest to include the full history.
				{:else}
					Figures cover the latest {allTransactions.length.toLocaleString()} records — search, filter
					or sort by oldest to include the full history.
				{/if}
			</p>

			<div class="toolbar">
				<div class="toolbar-search">
					<SearchBar searchValue={searchTermValue} onSearch={handleSearch} onClear={handleClear} />
				</div>
				<div class="segmented" role="group" aria-label="Filter by change type">
					{#each typeFilters as option (option.value)}
						<button
							class="segment"
							class:active={typeFilter === option.value}
							aria-pressed={typeFilter === option.value}
							onclick={() => setTypeFilter(option.value)}
						>
							{option.label}
						</button>
					{/each}
				</div>
				<button class="sort-button" onclick={toggleSort} aria-label="Toggle sort order">
					<i class="fas {sortNewest ? 'fa-arrow-down-wide-short' : 'fa-arrow-up-wide-short'}"></i>
					<span>{sortNewest ? 'Newest' : 'Oldest'}</span>
				</button>
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
		font-size: var(--text-2xl);
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
		color: #1f9d4d;
	}

	.stat-value.neg {
		color: #d83a32;
	}

	:global([data-theme='dark']) .stat-value.pos {
		color: #5bcf7e;
	}

	:global([data-theme='dark']) .stat-value.neg {
		color: #f06a62;
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

	.segmented {
		display: flex;
		background: var(--hover-bg-color);
		border-radius: var(--border-radius);
		padding: 3px;
		gap: 2px;
	}

	.segment {
		font-size: 0.78rem;
		font-weight: 500;
		color: var(--text-color-dimmed);
		background: transparent;
		border: none;
		padding: 0.4rem 0.85rem;
		border-radius: calc(var(--border-radius) - 2px);
		min-height: 0;
		transition:
			background-color 0.15s ease-out,
			color 0.15s ease-out;
	}

	.segment:hover:not(.active) {
		color: var(--text-color);
	}

	.segment.active {
		background: var(--add-item-color);
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
		.stats-grid {
			grid-template-columns: repeat(2, 1fr);
		}

		.toolbar-search {
			flex-basis: 100%;
		}

		.segmented {
			flex: 1;
		}

		.segment {
			flex: 1;
			text-align: center;
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
