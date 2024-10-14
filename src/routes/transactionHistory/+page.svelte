<script lang="ts">
	import { onMount } from 'svelte';
	import { db } from '../../firebase';
	import { collection, query, orderBy, getDocs } from 'firebase/firestore';
	import type { Transaction } from '../../types';
	import TransactionTable from '../../components/TransactionTable.svelte';
	import Pagination from '../../components/Pagination.svelte';
	import SearchBar from '../../components/SearchBar.svelte';
	import { paginationStore, paginatedItems } from '../../stores/paginationStore';
	import { searchStore } from '../../stores/searchStore';

	let allTransactions: Transaction[] = [];
	let filteredTransactions: Transaction[] = [];
	let loading = true;
	let currentSortColumn: keyof Transaction | 'changedAmount' = 'timestamp';
	let sortAscending = false;

	$: sortedTransactions = sortTransactions(filteredTransactions, currentSortColumn, sortAscending);
	$: paginatedTransactions = $paginatedItems(sortedTransactions) as Transaction[];
	$: filterLegend = `Showing ${paginatedTransactions.length} of ${filteredTransactions.length} filtered transactions (${allTransactions.length} total).`;

	function sortTransactions(
		transactions: Transaction[],
		column: keyof Transaction | 'changedAmount',
		ascending: boolean
	) {
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

	async function fetchTransactions() {
		loading = true;
		const transactionsRef = collection(db, 'transactions');
		let q = query(transactionsRef, orderBy('timestamp', 'desc'));

		try {
			const querySnapshot = await getDocs(q);
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
				} as Transaction;
			});
			filterTransactions($searchStore);
		} catch (error) {
			console.error('Error fetching transactions:', error);
		} finally {
			loading = false;
		}
	}

	function filterTransactions(searchTerm: string) {
		if (searchTerm) {
			const lowerSearchTerm = searchTerm.toLowerCase();
			filteredTransactions = allTransactions.filter((transaction) =>
				transaction.itemName.toLowerCase().includes(lowerSearchTerm)
			);
		} else {
			filteredTransactions = allTransactions;
		}
		paginationStore.setTotalItems(filteredTransactions.length);
		paginationStore.setCurrentPage(1);
	}

	onMount(() => {
		fetchTransactions();
	});

	function handleSearch(value: string) {
		searchStore.setSearchTerm(value);
		filterTransactions(value);
	}

	function handleClear() {
		searchStore.clearSearch();
		filterTransactions('');
	}

	function handleSort(column: keyof Transaction | 'changedAmount') {
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

<div class="container mx-auto p-4 rounded-lg shadow-md bg-container mt-4">
	<h1 class="text-3xl font-bold mb-6">Transaction History</h1>

	<SearchBar searchValue={$searchStore} onSearch={handleSearch} onClear={handleClear} />

	<div class="filter-legend text-white mb-4">
		{filterLegend}
	</div>

	<div class="table-container">
		{#if loading}
			<p class="text-center my-4">Loading transactions...</p>
		{:else if sortedTransactions.length === 0}
			<p class="text-center my-4">No transactions found.</p>
		{:else}
			<TransactionTable
				paginatedItems={paginatedTransactions}
				sortBy={handleSort}
				{currentSortColumn}
				{sortAscending}
			/>
		{/if}
	</div>

	<Pagination />
</div>

<style>
	.container {
		max-width: 90%;
		background-color: var(--container-bg);
		box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
		border-radius: 1rem;
	}

	.table-container {
		height: 670px;
		overflow: auto;
		margin-bottom: 1rem;
	}

	.filter-legend {
		font-size: 0.9rem;
		color: #949494;
	}
</style>
