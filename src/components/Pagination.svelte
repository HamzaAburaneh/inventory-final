<script>
	import { paginationStore } from '../stores/paginationStore';

	// Access the individual stores correctly
	let currentPage = $state(1);
	let totalPagesCount = $state(1);
	let itemsPerPage = $state(10);

	// Subscribe to the stores
	paginationStore.currentPage.subscribe(value => currentPage = value);
	paginationStore.totalPages.subscribe(value => totalPagesCount = value);
	paginationStore.itemsPerPage.subscribe(value => itemsPerPage = value);

	function goToPage(page) {
		if (page >= 1 && page <= totalPagesCount) {
			paginationStore.setCurrentPage(page);
		}
	}

	function handleItemsPerPageChange(event) {
		const select = event.target;
		const newItemsPerPage = select.value === 'all' ? 'all' : parseInt(select.value);
		paginationStore.setItemsPerPage(newItemsPerPage);
	}
</script>

<div class="pagination-controls">
	<div class="pagination-buttons">
		<button
			class="pagination-button"
			onclick={() => goToPage(currentPage - 1)}
			disabled={currentPage === 1}
			aria-label="Previous page"
		>
			<i class="fas fa-chevron-left"></i>
		</button>
		<span class="pagination-info">Page {currentPage} of {totalPagesCount}</span>
		<button
			class="pagination-button"
			onclick={() => goToPage(currentPage + 1)}
			disabled={currentPage === totalPagesCount}
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
			onchange={handleItemsPerPageChange}
			class="pagination-select"
		>
			{#each [5, 10, 25, 50, 'all'] as option}
				<option value={option}>{option === 'all' ? 'All' : option}</option>
			{/each}
		</select>
	</div>
</div>

<style>
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
			color 0.3s ease;
	}

	.pagination-button:hover:not(:disabled) {
		background-color: var(--hover-bg-color);
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
		background-image: var(--pagination-arrow-icon);
		background-repeat: no-repeat;
		background-position: right 0.5rem center;
		background-size: 1.5em;
		cursor: pointer;
	}

	.pagination-select:focus {
		outline: none;
		box-shadow: 0 0 0 2px var(--icon-hover-color);
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
