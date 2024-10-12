<script lang="ts">
	import { paginationStore, totalPages } from '../stores/paginationStore';

	function getVisiblePageNumbers(current: number, total: number) {
		if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

		if (current <= 4) return [1, 2, 3, 4, 5, '...', total];
		if (current >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total];

		return [1, '...', current - 1, current, current + 1, '...', total];
	}

	$: visiblePageNumbers = getVisiblePageNumbers($paginationStore.currentPage, $totalPages);

	function goToPage(page: number) {
		if (page >= 1 && page <= $totalPages) {
			paginationStore.setCurrentPage(page);
		}
	}
</script>

<div class="pagination-controls mt-6 flex flex-col sm:flex-row justify-between items-center">
	<div class="flex items-center space-x-2 mb-4 sm:mb-0">
		<button
			class="pagination-button"
			on:click={() => goToPage($paginationStore.currentPage - 1)}
			disabled={$paginationStore.currentPage === 1}
			aria-label="Previous page"
		>
			Previous
		</button>
		{#each visiblePageNumbers as pageNum}
			{#if typeof pageNum === 'number'}
				<button
					class="pagination-button"
					class:active={pageNum === $paginationStore.currentPage}
					on:click={() => goToPage(pageNum)}
					aria-label="Go to page {pageNum}"
					aria-current={pageNum === $paginationStore.currentPage ? 'page' : undefined}
				>
					{pageNum}
				</button>
			{:else}
				<span class="pagination-ellipsis">...</span>
			{/if}
		{/each}
		<button
			class="pagination-button"
			on:click={() => goToPage($paginationStore.currentPage + 1)}
			disabled={$paginationStore.currentPage === $totalPages}
			aria-label="Next page"
		>
			Next
		</button>
	</div>
</div>

<style>
	.pagination-controls {
		flex-wrap: wrap;
	}

	.pagination-button {
		color: white;
		font-weight: bold;
		padding: 0.5rem 0.75rem;
		border-radius: 0.375rem;
		transition: background-color 0.3s ease;
	}

	.pagination-button:hover:not(:disabled) {
		background-color: #1d4ed8;
	}

	.pagination-button.active {
		background-color: #1d4ed8;
	}

	.pagination-ellipsis {
		color: white;
		padding: 0.5rem 0.25rem;
	}

	@media (max-width: 640px) {
		.pagination-controls {
			flex-direction: column;
			align-items: stretch;
		}

		.pagination-controls > * {
			margin-bottom: 1rem;
		}
	}
</style>
