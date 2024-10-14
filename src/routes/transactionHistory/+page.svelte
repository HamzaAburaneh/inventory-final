<script lang="ts">
	import { onMount } from 'svelte';
	import { db } from '../../firebase';
	import { collection, query, orderBy, getDocs, where } from 'firebase/firestore';
	import type { Transaction } from '../../types';
	import TransactionTable from '../../components/TransactionTable.svelte';
	import Pagination from '../../components/Pagination.svelte';
	import SearchBar from '../../components/SearchBar.svelte';
	import { paginationStore, paginatedItems } from '../../stores/paginationStore';
	import { searchStore } from '../../stores/searchStore';
	import { fadeAndSlide } from '$lib/transitions';

	let transactions: Transaction[] = [];
	let loading = true;
	let filteredTransactions: Transaction[] = [];
	let currentSortColumn: keyof Transaction | 'changedAmount' = 'timestamp';
	let sortAscending = false;

	$: filteredTransactions = $paginatedItems(transactions);
	$: filterLegend = `${filteredTransactions.length} results of ${transactions.length} total transactions.`;

	async function fetchTransactions(searchTerm: string) {
		loading = true;
		const transactionsRef = collection(db, 'transactions');
		let q = query(transactionsRef, orderBy('timestamp', 'desc'));

		if (searchTerm) {
			q = query(q, where('itemId', '==', searchTerm));
		}

		try {
			const querySnapshot = await getDocs(q);
			transactions = querySnapshot.docs.map((doc) => {
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
			paginationStore.setTotalItems(transactions.length);
		} catch (error) {
			console.error('Error fetching transactions:', error);
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		fetchTransactions($searchStore);
	});

	function handleSearch(value: string) {
		searchStore.setSearchTerm(value);
		paginationStore.setCurrentPage(1);
		fetchTransactions(value);
	}

	function handleClear() {
		searchStore.clearSearch();
		paginationStore.setCurrentPage(1);
		fetchTransactions('');
	}

	function handleSort(column: keyof Transaction | 'changedAmount') {
		if (currentSortColumn === column) {
			sortAscending = !sortAscending;
		} else {
			currentSortColumn = column;
			sortAscending = true;
		}
		if (column === 'changedAmount') {
			transactions = transactions.sort((a, b) => {
				const aValue = a.newCount - a.previousCount;
				const bValue = b.newCount - b.previousCount;
				return sortAscending ? aValue - bValue : bValue - aValue;
			});
		} else {
			transactions = transactions.sort((a, b) => {
				const aValue = a[column];
				const bValue = b[column];
				if (aValue < bValue) return sortAscending ? -1 : 1;
				if (aValue > bValue) return sortAscending ? 1 : -1;
				return 0;
			});
		}
	}
</script>

<svelte:head>
	<title>Transaction History</title>
</svelte:head>

<div
	class="container mx-auto p-4 sm:p-6 rounded-lg shadow-md bg-container mt-4"
	in:fadeAndSlide={{ duration: 300, y: 75 }}
>
	<h1 class="text-3xl font-bold mb-6">Transaction History</h1>

	<div class="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between">
		<SearchBar searchValue={$searchStore} onSearch={handleSearch} onClear={handleClear} />
	</div>
	<div class="filter-legend text-white mb-4">
		{filterLegend}
	</div>

	{#if loading}
		<p class="text-center my-4">Loading transactions...</p>
	{:else if transactions.length === 0}
		<p class="text-center my-4">No transactions found.</p>
	{:else}
		<div class="overflow-x-auto">
			<TransactionTable
				paginatedItems={filteredTransactions}
				sortBy={handleSort}
				{currentSortColumn}
				{sortAscending}
			/>
		</div>
		<div class="mt-4">
			<Pagination />
		</div>
	{/if}
</div>

<style>
	.filter-legend {
		font-size: 0.9rem;
		color: #949494;
	}

	.container {
		max-width: 95%;
		background-color: var(--container-bg);
		box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
		border-radius: 1rem;
	}

	:global(.custom-table) {
		width: 100%;
		border-collapse: separate;
		border-spacing: 0;
	}

	:global(.custom-table th) {
		position: sticky;
		top: 0;
		background-color: var(--container-bg);
		z-index: 10;
		box-shadow: 0 2px 2px -1px rgba(0, 0, 0, 0.4);
	}

	:global(.custom-table th),
	:global(.custom-table td) {
		padding: 0.75rem;
		text-align: left;
		border-bottom: 1px solid var(--table-border-color);
	}

	:global(.custom-table tbody tr) {
		background-color: var(--container-bg);
	}

	:global(.custom-table tbody tr:hover) {
		background-color: var(--zinc-800);
	}
</style>
