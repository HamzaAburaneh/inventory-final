<script>
	import { get } from 'svelte/store';
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
	import { getSearchStore } from '../../stores/searchStore';

	// Get pre-loaded data from +page.js
	let { data } = $props();

	// Initialize state with pre-loaded data
	let transactions = $state(data.transactions || []);
	let loading = $state(false);
	let currentSortColumn = $state('timestamp');
	let sortAscending = $state(false);

	// Pagination state
	let itemsPerPage = $state(10);
	let lastVisible = $state(data.lastDoc || null);
	let firstVisible = $state(data.firstDoc || null);
	let isFirstPage = $state(true);
	let isLastPage = $state((data.transactions?.length || 0) < 10);

	// Count state
	let totalItems = $state(data.totalItems || 0);
	let globalTotalItems = $state(data.totalItems || 0);
	let currentPage = $state(1);

	// Search store
	const searchStore = getSearchStore('transactionHistory');
	const { setSearchTerm, clearSearch } = searchStore;

	// Track the current search term locally for display
	let searchTermValue = $state('');

	// Derived values for pagination display
	let totalPages = $derived(Math.ceil(totalItems / itemsPerPage) || 1);
	let startIndex = $derived((currentPage - 1) * itemsPerPage + 1);
	let endIndex = $derived(Math.min(currentPage * itemsPerPage, totalItems));

	// Subscribe to search store changes and fetch when it changes
	$effect(() => {
		const unsubscribe = searchStore.subscribe((value) => {
			if (value !== searchTermValue) {
				searchTermValue = value;
				// Use queueMicrotask to avoid synchronous state mutation in $effect
				queueMicrotask(() => fetchTransactions('first'));
			}
		});
		return unsubscribe;
	});

	async function fetchTransactions(direction = 'first') {
		loading = true;
		const currentSearchTerm = searchTermValue;
		const minLoadingTime = new Promise(resolve => setTimeout(resolve, 300));

		try {
			const transactionsRef = collection(db, 'transactions');
			let constraints = [];
			const countConstraints = [];

			// Fetch total count on first load or search change
			if (direction === 'first' || direction === 'last') {
				if (currentSearchTerm) {
					countConstraints.push(
						where('itemName', '>=', currentSearchTerm),
						where('itemName', '<=', currentSearchTerm + '\uf8ff')
					);
				}
				const countQuery = query(transactionsRef, ...countConstraints);
				const countSnapshot = await getCountFromServer(countQuery);
				totalItems = countSnapshot.data().count;
			}

			// Determine actual sorting to use
			let sortField = currentSortColumn;
			let sortDir = sortAscending ? 'asc' : 'desc';

			if (currentSearchTerm) {
				sortField = 'itemName';
			} else if (currentSortColumn === 'changedAmount') {
				sortField = 'timestamp';
				sortDir = 'desc'; // Default timestamp order
			}

			// Build constraints based on direction
			if (direction === 'first') {
				currentPage = 1;
				constraints.push(orderBy(sortField, sortDir), limit(itemsPerPage));
			} else if (direction === 'last') {
				currentPage = totalPages;
				// To get last page items, we inverse the primary order
				const inverseDir = sortDir === 'asc' ? 'desc' : 'asc';
				constraints.push(orderBy(sortField, inverseDir), limit(itemsPerPage));
			} else if (direction === 'next' && lastVisible) {
				currentPage++;
				constraints.push(orderBy(sortField, sortDir), startAfter(lastVisible), limit(itemsPerPage));
			} else if (direction === 'prev' && firstVisible) {
				currentPage--;
				constraints.push(
					orderBy(sortField, sortDir),
					endBefore(firstVisible),
					limitToLast(itemsPerPage)
				);
			}

			// Add search filters if needed
			if (currentSearchTerm) {
				constraints.push(
					where('itemName', '>=', currentSearchTerm),
					where('itemName', '<=', currentSearchTerm + '\uf8ff')
				);
			}

			const q = query(transactionsRef, ...constraints);
			const snapshot = await getDocs(q);

			if (!snapshot.empty) {
				let docs = snapshot.docs;

				// If we went to the 'last' page, the results are in reverse order
				if (direction === 'last') {
					docs = [...docs].reverse();
				}

				firstVisible = docs[0];
				lastVisible = docs[docs.length - 1];

				let fetchedData = docs.map((doc) => {
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

				// Client-side sort for calculated fields
				if (!currentSearchTerm && currentSortColumn === 'changedAmount') {
					fetchedData.sort((a, b) => {
						const aVal = a.newCount - a.previousCount;
						const bVal = b.newCount - b.previousCount;
						return sortAscending ? aVal - bVal : bVal - aVal;
					});
				}

				transactions = fetchedData;
				isLastPage = currentPage === totalPages;
				isFirstPage = currentPage === 1;
			} else {
				transactions = [];
				isLastPage = true;
				isFirstPage = true;
			}
		} catch (error) {
			console.error('Error fetching transactions:', error);
		} finally {
			await minLoadingTime;
			loading = false;
		}
	}

	function handleSearch(value) {
		setSearchTerm(value);
	}

	function handleClear() {
		clearSearch();
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
		if (!loading && !isLastPage) {
			fetchTransactions('next');
		}
	}

	function handlePrev() {
		if (!loading && !isFirstPage) {
			fetchTransactions('prev');
		}
	}

	function handleFirst() {
		if (!loading && !isFirstPage) {
			fetchTransactions('first');
		}
	}

	function handleLast() {
		if (!loading && !isLastPage) {
			fetchTransactions('last');
		}
	}

	function handleItemsPerPageChange(event) {
		itemsPerPage = parseInt(event.target.value);
		fetchTransactions('first');
	}

	function capitalizeColumn(column) {
		return column.replace(/([A-Z])/g, ' $1').trim().toUpperCase();
	}
</script>

<svelte:head>
	<title>Transaction History</title>
</svelte:head>

<div class="page-viewport-wrapper">
	<div class="glow-layer"></div>
	<div class="content-container">
		<header class="page-header">
			<div class="title-group">
				<h1 class="main-title">Transaction History</h1>
				<div class="system-status">
					<span class="status-dot"></span>
					<span class="status-text">SYSTEM SECURE</span>
				</div>
			</div>
		</header>

		<div class="ledger-actions">
			<div class="stats-ribbon">
				<div class="ribbon-item">
					<span class="ribbon-label">SOURCE:</span>
					<span class="ribbon-value">TRANSACTIONS_DB</span>
				</div>
				<div class="ribbon-item">
					<span class="ribbon-label">RECORDS:</span>
					<div class="ribbon-value">
						{#key totalItems}
							<div class="count-context text-update">
								<span class="digital-font">{totalItems}</span>
								{#if searchTermValue}
									<span class="count-separator">/</span>
									<span class="count-total">{globalTotalItems}</span>
								{/if}
							</div>
						{/key}
					</div>
				</div>
				<div class="ribbon-item">
					<span class="ribbon-label">SORTING:</span>
					<div class="ribbon-value">
						{#key currentSortColumn}
							<span class="text-update">
								{capitalizeColumn(currentSortColumn)}
							</span>
						{/key}
						{#key sortAscending}
							<span class="order-tag text-update">
								{sortAscending ? 'ASC' : 'DESC'}
							</span>
						{/key}
					</div>
				</div>
			</div>

			<div class="search-primary">
				<SearchBar searchValue={searchTermValue} onSearch={handleSearch} onClear={handleClear} />
			</div>
		</div>

			<div class="table-frame">
				{#if loading && transactions.length === 0}
					<div class="ledger-loading">
						<div class="pulse-ring"></div>
						<span class="loading-text">LOADING HISTORY...</span>
					</div>
				{:else if transactions.length === 0}
					<div class="null-state">
						<i class="fas fa-search-minus"></i>
						<p>NO ITEMS MATCHED.</p>
					</div>
				{:else}
					<div
						class="table-render-layer"
					>
						<TransactionTable
							paginatedItems={transactions}
							sortBy={handleSort}
							{currentSortColumn}
							{sortAscending}
							{loading}
						/>
					</div>
				{/if}
			</div>

			<footer class="ledger-footer">
				<div class="footer-summary">
					<span class="summary-text">
						SHOWING <span class="summary-highlight">{Math.min(startIndex, totalItems)}</span> 
						TO <span class="summary-highlight">{endIndex}</span> 
						OF <span class="summary-highlight">{totalItems}</span>
						{#if searchTermValue}
							<span class="summary-separator">/</span>
							<span class="summary-total">{globalTotalItems}</span>
						{/if}
						ENTRIES
					</span>
				</div>

				<div class="pagination-modern">
					<button
						class="pag-btn icon-only"
						onclick={handleFirst}
						disabled={isFirstPage}
						aria-label="First Page"
					>
						<i class="fas fa-angle-double-left"></i>
					</button>

					<button
						class="pag-btn"
						onclick={handlePrev}
						disabled={isFirstPage}
						aria-label="Previous Page"
					>
						<i class="fas fa-chevron-left"></i>
						<span class="btn-text">PREV</span>
					</button>

					<div class="pag-indicator">
						<span class="indicator-current">{currentPage}</span>
						<span class="indicator-separator">/</span>
						<span class="indicator-total">{totalPages}</span>
					</div>

					<button
						class="pag-btn"
						onclick={handleNext}
						disabled={isLastPage}
						aria-label="Next Page"
					>
						<span class="btn-text">NEXT</span>
						<i class="fas fa-chevron-right"></i>
					</button>

					<button
						class="pag-btn icon-only"
						onclick={handleLast}
						disabled={isLastPage}
						aria-label="Last Page"
					>
						<i class="fas fa-angle-double-right"></i>
					</button>
				</div>

				<div class="footer-settings">
					<span class="settings-label">ITEMS PER PAGE:</span>
					<div class="page-size-control">
						<select
							id="itemsPerPage"
							value={itemsPerPage}
							onchange={handleItemsPerPageChange}
							class="settings-select"
						>
							<option value={10}>10</option>
							<option value={25}>25</option>
							<option value={50}>50</option>
						</select>
						<i class="fas fa-chevron-down select-icon"></i>
					</div>
				</div>
			</footer>
	</div>
</div>

<style>
	:global(body) {
		background-color: var(--tech-bg-end) !important;
		background-image: radial-gradient(circle at 50% -10%, var(--tech-bg-start) 0%, var(--tech-bg-end) 100%) !important;
		background-attachment: fixed !important;
		margin: 0;
		padding: 0;
		overflow-x: hidden;
	}

	.page-viewport-wrapper {
		position: relative;
		min-height: 100vh;
		width: 100%;
		display: flex;
		flex-direction: column;
		box-sizing: border-box;
	}

	.glow-layer {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100vh;
		background: radial-gradient(circle at 50% 0%, var(--tech-accent-muted) 0%, transparent 50%);
		pointer-events: none;
		z-index: 0;
	}

	/* Page Layout Polish */
	.content-container {
		position: relative;
		z-index: 2;
		max-width: 1400px;
		margin: 0 auto;
		width: 100%;
		padding: 3rem 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem; /* Tighter vertical spacing */
	}

	@media (max-width: 768px) {
		.content-container {
			padding: 1.5rem 1rem;
			gap: 1.25rem;
		}
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		flex-wrap: wrap;
		gap: 2rem;
	}

	.main-title {
		font-size: 2.5rem;
		font-weight: 800;
		color: var(--tech-title);
		margin: 0;
		letter-spacing: -0.05em;
		text-transform: uppercase;
		line-height: 1;
	}

	@media (max-width: 768px) {
		.main-title {
			font-size: 1.75rem;
			letter-spacing: -0.02em;
		}
	}

	.system-status {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-top: 0.8rem;
		opacity: 0.8;
	}

	.status-dot {
		width: 6px;
		height: 6px;
		background: var(--tech-accent);
		border-radius: 50%;
		box-shadow: 0 0 10px var(--tech-accent-muted);
		animation: pulse-soft 3s ease-in-out infinite;
	}

	@keyframes pulse-soft {
		0%, 100% { opacity: 0.4; transform: scale(0.9); }
		50% { opacity: 1; transform: scale(1.1); }
	}

	.status-text {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.6rem;
		color: var(--tech-status-text);
		letter-spacing: 0.2em;
		font-weight: 800;
	}

	.header-controls {
		display: flex;
		justify-content: flex-end;
		margin-top: -0.25rem;
	}

	/* Ledger Actions Bar */
	.ledger-actions {
		display: flex;
		justify-content: space-between;
		align-items: flex-end; /* Align stats and search on the bottom */
		flex-wrap: wrap;
		gap: 2rem;
	}

	@media (max-width: 768px) {
		.ledger-actions {
			flex-direction: column;
			align-items: stretch;
			gap: 1rem;
		}
	}

	/* Stats Ribbon: Cleaner & Interactive */
	.stats-ribbon {
		display: flex;
		align-items: center;
		padding: 0;
		gap: 3rem; /* More balanced gap */
	}

	@media (max-width: 768px) {
		.stats-ribbon {
			gap: 1rem;
			margin-bottom: 0;
			flex-wrap: wrap;
			justify-content: flex-start;
			background: var(--tech-glass-bg);
			padding: 1rem;
			border-radius: 8px;
			border: 1px solid var(--tech-glass-border);
			width: 100%;
		}
	}

	.search-primary {
		flex: 1;
		display: flex;
		justify-content: flex-end;
		max-width: 600px;
	}

	@media (max-width: 768px) {
		.search-primary {
			max-width: 100%;
			justify-content: stretch;
		}
	}

	.ribbon-item {
		display: flex;
		align-items: baseline;
		gap: 0.75rem;
		opacity: 0.6; /* Softly muted by default */
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		cursor: pointer;
	}

	.ribbon-item:hover {
		opacity: 1; /* Brightens on hover */
		transform: translateY(-1px);
	}

	@media (max-width: 768px) {
		.ribbon-item {
			font-size: 0.75rem;
			gap: 0.5rem;
			flex: 1 1 auto;
			min-width: max-content;
			opacity: 1 !important;
			width: auto;
			padding: 0;
		}

		.ribbon-item:hover {
			transform: translateY(-1px);
		}
	}

	@media (max-width: 768px) {
		.ribbon-label {
			font-size: 0.6rem;
			opacity: 1 !important;
			color: var(--tech-value);
		}

		.ribbon-value {
			font-size: 0.85rem;
			color: var(--tech-accent);
		}

		/* Hide system status on mobile */
		.system-status {
			display: none;
		}
	}

	.ribbon-label {
		color: var(--tech-label);
		font-family: 'JetBrains Mono', monospace;
		font-weight: 800;
		font-size: 0.65rem;
		letter-spacing: 0.1em;
	}

	.ribbon-value {
		color: var(--tech-value);
		font-family: 'JetBrains Mono', monospace;
		font-weight: 700;
		font-size: 0.85rem;
		transition: color 0.3s ease;
		display: inline-flex;
		align-items: baseline;
		gap: 0.4rem; /* Precise gap between Column and Order */
		min-width: fit-content;
	}
	
	/* Prevent layout shift by reserving space for dynamic content */
	.ribbon-item:nth-child(2) .ribbon-value {
		min-width: 80px; /* Reserve space for record counts */
	}
	
	.ribbon-item:nth-child(3) .ribbon-value {
		min-width: 160px; /* Reserve space for sorting column + order */
	}

	.ribbon-item:hover .ribbon-value {
		color: var(--tech-accent);
	}

	.digital-font {
		color: var(--tech-accent);
		text-shadow: 0 0 15px var(--tech-accent-muted);
	}

	.count-context {
		display: flex;
		align-items: baseline;
		gap: 0.35rem;
	}

	.count-separator {
		color: var(--tech-label);
		font-size: 0.7rem;
		opacity: 0.5;
	}

	.count-total {
		color: var(--tech-label);
		font-size: 0.8rem;
		opacity: 0.8;
	}

	/* Simplified Glow/Fade Animation on value change */
	.text-update {
		animation: subtle-glow 0.6s cubic-bezier(0.23, 1, 0.32, 1);
		display: inline-block;
	}

	@keyframes subtle-glow {
		0% { 
			color: var(--tech-accent); 
			text-shadow: 0 0 12px var(--tech-accent-muted);
		}
		100% { 
			text-shadow: 0 0 0px transparent;
		}
	}

	.ribbon-item:hover .digital-font {
		text-shadow: 0 0 20px var(--tech-accent-muted);
	}

	.order-tag {
		color: var(--tech-label);
		font-size: 0.7rem;
	}

	.table-frame {
		position: relative;
		background: var(--tech-glass-bg);
		border: 1px solid var(--tech-glass-border);
		border-radius: 12px;
		min-height: 500px;
		overflow: hidden;
		/* Professional multi-layered base shadow */
		box-shadow: 
			0 4px 6px -1px rgba(0, 0, 0, 0.1),
			0 2px 4px -1px rgba(0, 0, 0, 0.06),
			inset 0 0 0 1px rgba(255, 255, 255, 0.02);
		transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.table-frame:hover {
		/* Deeper, more atmospheric shadow on hover */
		box-shadow: 
			0 30px 60px -12px rgba(0, 0, 0, 0.5),
			0 18px 36px -18px rgba(0, 0, 0, 0.5);
		border-color: rgba(255, 255, 255, 0.1); 
	}

	@media (max-width: 768px) {
		.table-frame {
			border-radius: 8px;
			min-height: 400px;
		}

		.table-frame:hover {
			box-shadow: 
				0 4px 6px -1px rgba(0, 0, 0, 0.1),
				0 2px 4px -1px rgba(0, 0, 0, 0.06),
				inset 0 0 0 1px rgba(255, 255, 255, 0.02);
		}
	}

	/* Loading and Empty States */
	.ledger-loading {
		height: 500px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2rem;
	}

	.pulse-ring {
		width: 44px;
		height: 44px;
		border: 3px solid var(--tech-cell-border);
		border-top-color: var(--tech-accent);
		border-radius: 50%;
		animation: spin 1s cubic-bezier(0.4, 0, 0.2, 1) infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.loading-text {
		color: var(--tech-accent);
		font-family: 'JetBrains Mono', monospace;
		font-weight: 700;
		letter-spacing: 0.3em;
		font-size: 0.7rem;
		opacity: 0.8;
	}

	.null-state {
		height: 500px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		color: var(--tech-label);
		gap: 1.5rem;
	}

	.null-state i { font-size: 3.5rem; opacity: 0.5; }
	.null-state p { 
		font-family: 'JetBrains Mono', monospace; 
		font-size: 0.8rem; 
		letter-spacing: 0.15em;
		font-weight: 700;
	}

	.table-render-layer {
		transition: opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1), filter 0.4s ease;
	}

	.loading-fade { 
		opacity: 0.15; 
		filter: blur(4px);
		pointer-events: none;
	}

	/* Footer & Pagination Modern SaaS Style */
	.ledger-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.5rem 0;
		border-top: 1px solid var(--tech-cell-border);
		margin-top: 1rem;
		flex-wrap: wrap;
		gap: 2rem;
	}

	.footer-summary {
		flex: 1;
	}

	.summary-text {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.75rem;
		color: var(--tech-label);
		letter-spacing: 0.05em;
		font-weight: 700;
	}

	.summary-highlight {
		color: var(--tech-accent);
		font-weight: 800;
	}

	.summary-separator {
		color: var(--tech-label);
		margin: 0 0.2rem;
		font-size: 0.7rem;
		opacity: 0.4;
	}

	.summary-total {
		color: var(--tech-label);
		font-size: 0.75rem;
		font-weight: 800;
	}

	.pagination-modern {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex: 1;
		justify-content: center;
	}

	.pag-btn {
		background: var(--tech-badge-bg);
		border: 1px solid var(--tech-badge-border);
		color: var(--tech-label);
		padding: 0.5rem 1rem;
		font-size: 0.7rem;
		font-weight: 800;
		font-family: 'JetBrains Mono', monospace;
		letter-spacing: 0.05em;
		border-radius: 4px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s;
		min-width: 38px;
	}

	.pag-btn:hover:not(:disabled) {
		background: var(--tech-header-bg);
		border-color: var(--tech-accent);
		color: var(--tech-accent);
	}

	.pag-btn.icon-only {
		padding: 0.5rem;
	}

	.page-indicator {
		background: var(--tech-accent-muted);
		border: 1px solid var(--tech-accent-muted);
		color: var(--tech-accent);
		padding: 0.5rem 1.2rem;
		font-size: 0.8rem;
		font-weight: 800;
		border-radius: 4px;
		font-family: 'JetBrains Mono', monospace;
	}

	.pag-indicator {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		font-family: 'JetBrains Mono', monospace;
		font-weight: 800;
		font-size: 0.8rem;
		padding: 0 1rem;
	}

	.indicator-current {
		color: var(--tech-accent);
	}

	.indicator-separator {
		color: var(--tech-label);
		opacity: 0.3;
	}

	.indicator-total {
		color: var(--tech-label);
	}

	.footer-settings {
		flex: 1;
		display: flex;
		justify-content: flex-end;
		align-items: center;
		gap: 1rem;
	}

	.settings-label {
		color: var(--tech-label);
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.65rem;
		font-weight: 800;
		letter-spacing: 0.05em;
	}

	.page-size-control {
		position: relative;
		display: flex;
		align-items: center;
		background: var(--tech-badge-bg);
		border: 1px solid var(--tech-badge-border);
		border-radius: 4px;
		transition: all 0.2s;
	}

	.page-size-control:hover {
		border-color: var(--tech-accent);
		background: var(--tech-header-bg);
	}

	.settings-select {
		background: transparent;
		color: var(--tech-value);
		border: none;
		padding: 0.5rem 2rem 0.5rem 0.85rem;
		font-family: 'JetBrains Mono', monospace;
		font-weight: 800;
		font-size: 0.75rem;
		cursor: pointer;
		appearance: none;
		outline: none;
		z-index: 2;
	}

	/* Force dynamic background for standard dropdown options */
	.settings-select option {
		background-color: var(--tech-header-bg);
		color: var(--tech-value);
	}

	.select-icon {
		position: absolute;
		right: 0.75rem;
		font-size: 0.7rem;
		color: var(--tech-label);
		pointer-events: none;
		z-index: 1;
	}

	@media (max-width: 1000px) {
		.ledger-footer {
			flex-direction: column;
			align-items: center;
			text-align: center;
			padding: 1rem 0;
			gap: 1.5rem;
		}
		.footer-summary, .pagination-modern, .footer-settings {
			width: 100%;
			justify-content: center;
		}
		.footer-settings { order: -1; margin-bottom: 0; }
	}

	@media (max-width: 768px) {
		.ledger-footer {
			padding: 1rem 0.5rem;
			gap: 1rem;
		}

		.footer-summary {
			order: 2;
		}

		.pagination-modern {
			order: 1;
		}

		.footer-settings {
			order: 3;
		}
	}

	@media (max-width: 480px) {
		.btn-text { display: none; }
		.pag-btn { 
			min-width: 44px;
			padding: 0.6rem;
		}
		
		.pag-indicator {
			padding: 0 0.75rem;
			font-size: 0.75rem;
		}

		.summary-text {
			font-size: 0.7rem;
		}

		.settings-label {
			font-size: 0.6rem;
		}

		.settings-select {
			font-size: 0.7rem;
			padding: 0.45rem 1.75rem 0.45rem 0.75rem;
		}
	}
</style>
