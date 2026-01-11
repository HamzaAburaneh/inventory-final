<script>
	import { db } from '../../firebase';
	import {
		collection,
		query,
		orderBy,
		getDocs,
		limit,
		startAfter,
		endBefore,
		limitToLast,
		where,
		getCountFromServer
	} from 'firebase/firestore';
	import TransactionTable from '../../components/TransactionTable.svelte';
	import SearchBar from '../../components/SearchBar.svelte';
	import { searchTerm, setSearchTerm, clearSearch } from '../../stores/searchStore';
	import { fadeAndSlide } from '$lib/transitions';

	let transactions = $state([]);
	let loading = $state(false);
	let currentSortColumn = $state('timestamp');
	let sortAscending = $state(false);

	// Pagination state
	let itemsPerPage = $state(10);
	let lastVisible = $state(null);
	let firstVisible = $state(null);
	let isFirstPage = $state(true);
	let isLastPage = $state(false);

	// Count state
	let totalItems = $state(0);
	let currentPage = $state(1);

	// Store values as reactive state
	let searchTermValue = $state('');

	// Subscribe to search store
	$effect(() => {
		const unsubscribe = searchTerm.subscribe((value) => {
			if (value !== searchTermValue) {
				searchTermValue = value;
				fetchTransactions('first');
			}
		});
		return unsubscribe;
	});

	async function fetchTransactions(direction = 'first') {
		loading = true;
		// Don't clear transactions here to prevent flashing

		try {
			const transactionsRef = collection(db, 'transactions');
			let constraints = [];
			let countConstraints = []; // For counting total results

			// 1. Search & Sort Strategy
			if (searchTermValue) {
				// Search by itemName
				const searchOrderBy = orderBy('itemName', sortAscending ? 'asc' : 'desc');
				const searchStart = where('itemName', '>=', searchTermValue);
				const searchEnd = where('itemName', '<=', searchTermValue + '\uf8ff');

				constraints.push(searchOrderBy, searchStart, searchEnd);
				countConstraints.push(searchStart, searchEnd);
			} else {
				// Default sort
				if (currentSortColumn === 'changedAmount') {
					constraints.push(orderBy('timestamp', 'desc'));
					// No filtering constraints for count, so it counts all
				} else {
					constraints.push(orderBy(currentSortColumn, sortAscending ? 'asc' : 'desc'));
				}
			}

			// 2. Fetch Total Count (Only on first load or search change)
			if (direction === 'first') {
				const countQuery = query(transactionsRef, ...countConstraints);
				const countSnapshot = await getCountFromServer(countQuery);
				totalItems = countSnapshot.data().count;
				currentPage = 1;
			} else if (direction === 'next') {
				currentPage++;
			} else if (direction === 'prev') {
				if (currentPage > 1) currentPage--;
			}

			// 3. Pagination Cursors
			if (direction === 'next' && lastVisible) {
				constraints.push(startAfter(lastVisible));
				constraints.push(limit(itemsPerPage));
			} else if (direction === 'prev' && firstVisible) {
				constraints.push(endBefore(firstVisible));
				constraints.push(limitToLast(itemsPerPage));
			} else {
				// First page or reset
				constraints.push(limit(itemsPerPage));
			}

			const q = query(transactionsRef, ...constraints);
			const snapshot = await getDocs(q);

			// 3. Process Results
			if (!snapshot.empty) {
				firstVisible = snapshot.docs[0];
				lastVisible = snapshot.docs[snapshot.docs.length - 1];

				let fetchedData = snapshot.docs.map((doc) => {
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

				// Handle client-side sort for calculated fields if necessary
				if (!searchTermValue && currentSortColumn === 'changedAmount') {
					fetchedData.sort((a, b) => {
						const aVal = a.newCount - a.previousCount;
						const bVal = b.newCount - b.previousCount;
						return sortAscending ? aVal - bVal : bVal - aVal;
					});
				}

				transactions = fetchedData;

				// Update page state
				if (direction === 'first') {
					isFirstPage = true;
				} else if (direction === 'next') {
					isFirstPage = false;
				} else if (direction === 'prev') {
					// If we go back, we can't easily know if we are at start without checking size
					// Heuristic: If we fetched fewer than limit, or if we were at start
					// Safe bet: Check if we are at the very beginning of time/sort?
					// Simplified: If 'prev' was clicked, we assume we aren't at first page unless logic says so.
					// Ideally we track page numbers, but for cursor pagination:
					// If the list is full size, assume there might be more previous.
					// Actually, accurate "isFirstPage" with cursors is hard.
					// Fix: Just toggle isFirstPage based on known state or button clicks.
					// Better: If we used 'endBefore', and we got results, check if we overlap with start?
					// Simplest UI: If user clicks Prev, and we get full page, enable Prev.
					// If we hit 'first' action, disable Prev.
				}

				// Check for last page
				isLastPage = snapshot.docs.length < itemsPerPage;

				// Fix for 'Prev' button state logic:
				// If we just loaded the first page, disable Prev.
				// If we navigated, enable Prev.
				if (direction === 'first') isFirstPage = true;
				else isFirstPage = false;
			} else {
				// No results found
				transactions = [];
				isLastPage = true;
				if (direction === 'first') isFirstPage = true;
			}

			loading = false;
		} catch (error) {
			console.error('Error fetching transactions:', error);
			loading = false;
		}
	}

	function handleSearch(value) {
		setSearchTerm(value);
		// Effect will trigger fetch
	}

	function handleClear() {
		clearSearch();
		// Effect will trigger fetch
	}

	function handleSort(column) {
		if (currentSortColumn === column) {
			sortAscending = !sortAscending;
		} else {
			currentSortColumn = column;
			sortAscending = true;
		}
		fetchTransactions('first');
	}

	function handleNext() {
		if (loading || isLastPage) return;
		fetchTransactions('next');
	}

	function handlePrev() {
		if (loading || currentPage <= 1) return;
		fetchTransactions('prev');
	}

	function handleItemsPerPage(e) {
		itemsPerPage = parseInt(e.target.value);
		fetchTransactions('first');
	}

	// Initial Load
	$effect(() => {
		// Only fetch once on mount (or when itemsPerPage/Sort changes if we added those as deps)
		fetchTransactions('first');
	});
</script>

<svelte:head>
	<title>Transaction History</title>
</svelte:head>

<div
	class="container mx-auto p-4 rounded-lg shadow-md bg-container mt-4"
	in:fadeAndSlide={{ duration: 300, y: 75 }}
>
	<h1 class="text-3xl font-bold mb-6">Transaction History</h1>

	<SearchBar searchValue={searchTermValue} onSearch={handleSearch} onClear={handleClear} />

	<div class="filter-legend text-white mb-4">
		{#if searchTermValue}
			Showing results for "{searchTermValue}"
		{:else}
			Showing transactions sorted by {currentSortColumn} ({sortAscending
				? 'Ascending'
				: 'Descending'})
		{/if}
	</div>

	<div class="table-container relative">
		{#if loading && transactions.length === 0}
			<div class="flex justify-center items-center h-64">
				<div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
			</div>
		{:else if transactions.length === 0}
			<p class="text-center my-4">No transactions found.</p>
		{:else}
			<div
				class="transition-opacity duration-300"
				class:opacity-50={loading}
				class:opacity-100={!loading}
			>
				<TransactionTable
					paginatedItems={transactions}
					sortBy={handleSort}
					{currentSortColumn}
					{sortAscending}
				/>
			</div>
		{/if}
	</div>

	<!-- Custom Server-Side Pagination Controls -->
	<div class="pagination-controls">
		<div class="pagination-buttons">
			<button
				class="pagination-button"
				onclick={handlePrev}
				disabled={isFirstPage}
				aria-label="Previous page"
			>
				<i class="fas fa-chevron-left"></i>
			</button>

			<span class="pagination-info">
				Page {currentPage} of {Math.ceil(totalItems / itemsPerPage) || 1} ({totalItems} items)
			</span>

			<button
				class="pagination-button"
				onclick={handleNext}
				disabled={isLastPage}
				aria-label="Next page"
			>
				<i class="fas fa-chevron-right"></i>
			</button>
		</div>

		<div class="items-per-page">
			<label for="itemsPerPage">Items per page:</label>
			<select
				id="itemsPerPage"
				bind:value={itemsPerPage}
				onchange={handleItemsPerPage}
				class="pagination-select"
			>
				<option value={10}>10</option>
				<option value={25}>25</option>
				<option value={50}>50</option>
			</select>
		</div>
	</div>
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

	/* Pagination Styles copied/adapted for local use */
	.pagination-controls {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 0;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.pagination-buttons {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.pagination-button {
		background-color: var(--table-cell-bg);
		color: var(--text-color);
		border: 1px solid var(--table-border-color);
		border-radius: var(--border-radius);
		padding: 0.5rem 1rem;
		font-size: 1rem;
		cursor: pointer;
		transition:
			background-color 0.3s ease,
			color 0.3s ease,
			transform 0.1s ease-out;
	}

	.pagination-button:hover:not(:disabled) {
		background-color: var(--hover-bg-color);
	}

	.pagination-button:active:not(:disabled) {
		transform: scale(1.1);
	}

	.pagination-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.pagination-info {
		font-size: 1rem;
		color: var(--text-color);
		padding: 0 1rem;
	}

	.items-per-page {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.items-per-page label {
		font-size: 1rem;
		color: var(--text-color);
	}

	.pagination-select {
		background-color: var(--table-cell-bg);
		color: var(--text-color);
		border: 1px solid var(--table-border-color);
		border-radius: var(--border-radius);
		padding: 0.5rem 2rem 0.5rem 0.5rem;
		font-size: 1rem;
		appearance: none;
		background-image: var(--pagination-arrow-icon); /* Ensure this var exists or fallback */
		background-repeat: no-repeat;
		background-position: right 0.5rem center;
		background-size: 1.5em;
		cursor: pointer;
	}

	@media (max-width: 640px) {
		.pagination-controls {
			flex-direction: column;
			align-items: stretch;
		}
		.pagination-buttons,
		.items-per-page {
			justify-content: center;
		}
	}
</style>
