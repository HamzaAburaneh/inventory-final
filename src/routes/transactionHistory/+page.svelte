<script>
	import { db } from '../../firebase';
	import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
	import TransactionTable from '../../components/TransactionTable.svelte';
	import Pagination from '../../components/Pagination.svelte';
	import SearchBar from '../../components/SearchBar.svelte';
	import { getPaginationStore } from '../../stores/paginationStore';
	import { searchTerm, setSearchTerm, clearSearch } from '../../stores/searchStore';
	import { fade } from 'svelte/transition';
	import { fadeAndSlide } from '$lib/transitions';

	let allTransactions = $state([]);
	let loading = $state(true);
	let currentSortColumn = $state('timestamp');
	let sortAscending = $state(false);
	let transactionsLoaded = $state(false);
	let unsubscribeFromTransactions = null;
	
	const paginationStore = getPaginationStore('transactionHistory');
	const { currentPage, itemsPerPage, setTotalItems, setCurrentPage } = paginationStore;

	// Store values as reactive state
	let searchTermValue = $state('');
	
	// Subscribe to search store more efficiently
	const unsubscribeSearch = searchTerm.subscribe(value => {
		searchTermValue = value;
	});
	
	// Clean up subscriptions on component destroy
	$effect(() => {
		return () => {
			unsubscribeSearch();
			if (unsubscribeFromTransactions) {
				unsubscribeFromTransactions();
			}
		};
	});

	// Optimize filtering to be reactive like manage transactions
	const filteredTransactions = $derived(() => {
		if (searchTermValue) {
			const lowerSearchTerm = searchTermValue.toLowerCase();
			return allTransactions.filter((transaction) =>
				transaction.itemName.toLowerCase().includes(lowerSearchTerm)
			);
		} else {
			return allTransactions;
		}
	});
	
	// Update pagination when filtered results change
	$effect(() => {
		setTotalItems(filteredTransactions().length);
		setCurrentPage(1);
	});
	
	const sortedTransactions = $derived(sortTransactions(filteredTransactions(), currentSortColumn, sortAscending));
	const paginatedTransactions = $derived(() => {
		if ($itemsPerPage === 'all') {
			return sortedTransactions;
		}
		const startIndex = ($currentPage - 1) * $itemsPerPage;
		const endIndex = startIndex + $itemsPerPage;
		return sortedTransactions.slice(startIndex, endIndex);
	});
	const filterLegend = $derived('Showing ' + paginatedTransactions().length + ' of ' + filteredTransactions().length + ' filtered transactions (' + allTransactions.length + ' total).');
	$effect(() => {
		transactionsLoaded = allTransactions.length > 0;
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
		loading = true;
		const transactionsRef = collection(db, 'transactions');
		let q = query(transactionsRef, orderBy('timestamp', 'desc'));

		try {
			// Set up real-time subscription
			unsubscribeFromTransactions = onSnapshot(q, (querySnapshot) => {
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
				loading = false;
			}, (error) => {
				console.error('Error in transactions subscription:', error);
				loading = false;
			});
		} catch (error) {
			console.error('Error setting up transactions subscription:', error);
			loading = false;
		}
	}

	$effect(() => {
		subscribeToTransactions();
	});

	function handleSearch(value) {
		setSearchTerm(value);
		// Fixed: Removed redundant filterTransactions call - the store subscription handles it
	}

	function handleClear() {
		clearSearch();
		// Fixed: Removed redundant filterTransactions call - clearSearch triggers the store update
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

{#if transactionsLoaded}
	<div
		class="container mx-auto p-4 rounded-lg shadow-md bg-container mt-4"
		in:fadeAndSlide={{ duration: 300, y: 75 }}
	>
		<h1 class="text-3xl font-bold mb-6">Transaction History</h1>

		<SearchBar searchValue={searchTermValue} onSearch={handleSearch} onClear={handleClear} />

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
					paginatedItems={paginatedTransactions()}
					sortBy={handleSort}
					{currentSortColumn}
					{sortAscending}
				/>
			{/if}
		</div>

		<Pagination store={paginationStore} />
	</div>
{:else}
	<div class="flex justify-center items-center h-screen">
		<div class="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-gray-900"></div>
	</div>
{/if}

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
