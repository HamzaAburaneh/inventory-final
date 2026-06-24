<script>
	import { db } from '../../firebase';
	import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
	import TransactionTable from '../../components/TransactionTable.svelte';
	import TableSkeleton from '../../components/TableSkeleton.svelte';
	import Pagination from '../../components/Pagination.svelte';
	import SearchBar from '../../components/SearchBar.svelte';
	import { getPaginationStore } from '../../stores/paginationStore';
	import { createSearchState } from '../../lib/runes/search.svelte.js';
	import { onMount } from 'svelte';

	let allTransactions = $state([]);
	// `ready` reveals the page chrome as soon as the listener is attached (mirrors
	// manageItems' `itemsLoaded`); `received` flips once the first snapshot lands so
	// the empty state only shows after real data has come back, not during the wait.
	let ready = $state(false);
	let received = $state(false);
	let currentSortColumn = $state('timestamp');
	let sortAscending = $state(false);
	let unsubscribeFromTransactions = null;

	const paginationStore = getPaginationStore('transactionHistory');
	const { currentPage, itemsPerPage, setTotalItems, setCurrentPage } = paginationStore;

	const search = createSearchState();

	// Reactive store views ($store auto-subscription)
	const searchTermValue = $derived(search.term);

	const filteredTransactions = $derived.by(() => {
		if (searchTermValue) {
			const lowerSearchTerm = searchTermValue.toLowerCase();
			return allTransactions.filter((transaction) =>
				transaction.itemName.toLowerCase().includes(lowerSearchTerm)
			);
		}
		return allTransactions;
	});

	$effect(() => {
		setTotalItems(filteredTransactions.length);
	});

	const sortedTransactions = $derived(
		sortTransactions(filteredTransactions, currentSortColumn, sortAscending)
	);
	const paginatedTransactions = $derived.by(() => {
		if ($itemsPerPage === 'all') {
			return sortedTransactions;
		}
		const startIndex = ($currentPage - 1) * $itemsPerPage;
		const endIndex = startIndex + $itemsPerPage;
		return sortedTransactions.slice(startIndex, endIndex);
	});

	function sortTransactions(transactions, column, ascending) {
		return [...transactions].sort((a, b) => {
			let aValue, bValue;
			if (column === 'changedAmount') {
				aValue = a.newCount - a.previousCount;
				bValue = b.newCount - b.previousCount;
			} else {
				aValue = a[column];
				bValue = b[column];
			}
			if (aValue < bValue) return ascending ? -1 : 1;
			if (aValue > bValue) return ascending ? 1 : -1;
			return 0;
		});
	}

	function subscribeToTransactions() {
		const transactionsRef = collection(db, 'transactions');
		let q = query(transactionsRef, orderBy('timestamp', 'desc'));

		try {
			// Set up real-time subscription
			unsubscribeFromTransactions = onSnapshot(
				q,
				(querySnapshot) => {
					allTransactions = querySnapshot.docs.map((doc) => {
						const data = doc.data();
						return {
							id: doc.id,
							itemId: data.itemId,
							itemName: data.itemName,
							type: data.type,
							previousCount: data.previousCount,
							newCount: data.newCount,
							timestamp: data.timestamp?.toDate() || new Date(),
							user: data.user
						};
					});
					received = true;
				},
				(error) => {
					console.error('Error in transactions subscription:', error);
					received = true;
				}
			);
		} catch (error) {
			console.error('Error setting up transactions subscription:', error);
			received = true;
		}
	}

	onMount(() => {
		subscribeToTransactions();
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

	function handleSort(column) {
		if (currentSortColumn === column) {
			sortAscending = !sortAscending;
		} else {
			currentSortColumn = column;
			sortAscending = true;
		}
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
				<h2 class="history-title">Transaction History</h2>
				<div class="history-stats">
					<span class="stats-text"
						>{filteredTransactions.length} of {allTransactions.length} transactions</span
					>
					<span class="stats-text total-value">{paginatedTransactions.length} on this page</span>
				</div>
			</div>

			<div class="search-section">
				<SearchBar searchValue={searchTermValue} onSearch={handleSearch} onClear={handleClear} />
			</div>

			<div class="table-section">
				{#if received && filteredTransactions.length === 0}
					<p class="empty-state">No transactions found.</p>
				{:else}
					<TransactionTable
						paginatedItems={paginatedTransactions}
						sortBy={handleSort}
						{currentSortColumn}
						{sortAscending}
					/>
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
		padding: 0.6rem 1.25rem;
		border-bottom: 1px solid var(--table-border-color);
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.5rem 1rem;
	}

	.history-title {
		margin: 0;
		font-size: 1.05rem;
		font-weight: 700;
		color: var(--text-color);
		letter-spacing: -0.025em;
	}

	.history-stats {
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

	.stats-text.total-value {
		background: var(--add-item-color);
		color: var(--add-item-on);
		font-weight: 600;
		border-color: var(--add-item-color);
	}

	.search-section {
		padding: 0.75rem 1.25rem;
		border-bottom: 1px solid var(--table-border-color);
	}

	.table-section {
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
		.history-header {
			flex-direction: column;
			align-items: stretch;
		}

		.history-stats {
			width: 100%;
		}

		.stats-text {
			flex: 1;
			text-align: center;
			padding: 0.5rem 0.75rem;
			font-size: 0.8rem;
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

		.history-header {
			padding: 0.7rem 2rem;
		}

		.search-section {
			padding: 0.85rem 2rem;
		}

		.pagination-section {
			padding: 0.7rem 2rem;
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
