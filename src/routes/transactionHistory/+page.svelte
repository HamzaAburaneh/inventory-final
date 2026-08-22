<script>
	import { subscribeToTransactions } from '../../lib/transactions';
	import TransactionTimeline from '../../components/TransactionTimeline.svelte';
	import TableSkeleton from '../../components/TableSkeleton.svelte';
	import Pagination from '../../components/Pagination.svelte';
	import SearchBar from '../../components/SearchBar.svelte';
	import { getPaginationStore } from '../../stores/paginationStore';
	import { createSearchState } from '../../lib/runes/search.svelte.js';
	import { onMount } from 'svelte';

	function transactionEvent(transaction) {
		if (transaction.event) return transaction.event;
		if (transaction.type === 'add' && transaction.previousCount === 0) return 'itemCreated';
		if (transaction.type === 'remove' && transaction.newCount === 0) return 'itemDeleted';
		return 'countChange';
	}

	let allTransactions = $state([]);
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

	const sortedTransactions = $derived(
		[...filteredTransactions].sort((a, b) =>
			sortNewest ? b.timestamp - a.timestamp : a.timestamp - b.timestamp
		)
	);

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
					allTransactions = transactions;
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
	}

	function handleClear() {
		search.clear();
		setCurrentPage(1);
	}

	function setTypeFilter(value) {
		typeFilter = value;
		setCurrentPage(1);
	}

	function formatSigned(value) {
		const sign = value > 0 ? '+' : value < 0 ? '−' : '';
		return `${sign}${Math.abs(value).toLocaleString()}`;
	}

	function escapeCsv(value) {
		const str = String(value ?? '');
		return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
	}

	// Export the full filtered/sorted set (not just the current page) as CSV.
	function exportCsv() {
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
						{filteredTransactions.length.toLocaleString()} of {allTransactions.length.toLocaleString()}
						records
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
				<button
					class="sort-button"
					onclick={() => (sortNewest = !sortNewest)}
					aria-label="Toggle sort order"
				>
					<i class="fas {sortNewest ? 'fa-arrow-down-wide-short' : 'fa-arrow-up-wide-short'}"></i>
					<span>{sortNewest ? 'Newest' : 'Oldest'}</span>
				</button>
			</div>

			<div class="timeline-section">
				{#if received && filteredTransactions.length === 0}
					<p class="empty-state">No transactions found.</p>
				{:else}
					<TransactionTimeline transactions={paginatedTransactions} />
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
		padding: 1rem 1.25rem;
		border-bottom: 1px solid var(--table-border-color);
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
