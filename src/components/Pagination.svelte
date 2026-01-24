<script>
	let { store, globalTotal = null, onPageChange = null } = $props();

	const {
		currentPage,
		totalPages,
		itemsPerPage,
		totalItems,
		startIndex,
		endIndex,
		setCurrentPage,
		setItemsPerPage,
		nextPage,
		previousPage,
		goToFirstPage,
		goToLastPage
	} = store;

	function handlePageChange(action) {
		onPageChange?.();
		action();
	}

	function handleItemsPerPageChange(event) {
		const newItemsPerPage = event.target.value === 'all' ? 'all' : parseInt(event.target.value);
		onPageChange?.();
		setItemsPerPage(newItemsPerPage);
	}
</script>

<div class="ledger-footer">
	<div class="footer-summary">
		<span class="summary-text">
			SHOWING <span class="summary-highlight">{$totalItems === 0 ? 0 : $startIndex + 1}</span> 
			TO <span class="summary-highlight">{$endIndex}</span> 
			OF <span class="summary-highlight">{$totalItems}</span>
			{#if globalTotal !== null && globalTotal !== $totalItems}
				<span class="summary-separator">/</span>
				<span class="summary-total">{globalTotal}</span>
			{/if}
			ENTRIES
		</span>
	</div>

	<div class="pagination-modern">
		<button
			class="pag-btn icon-only"
			onclick={() => handlePageChange(goToFirstPage)}
			disabled={$currentPage === 1}
			aria-label="First Page"
		>
			<i class="fas fa-angle-double-left"></i>
		</button>

		<button
			class="pag-btn"
			onclick={() => handlePageChange(previousPage)}
			disabled={$currentPage === 1}
			aria-label="Previous Page"
		>
			<i class="fas fa-chevron-left"></i>
			<span class="btn-text">PREV</span>
		</button>

		<div class="pag-indicator">
			<span class="indicator-current">{$currentPage}</span>
			<span class="indicator-separator">/</span>
			<span class="indicator-total">{$totalPages}</span>
		</div>

		<button
			class="pag-btn"
			onclick={() => handlePageChange(nextPage)}
			disabled={$currentPage === $totalPages || $totalPages === 0}
			aria-label="Next Page"
		>
			<span class="btn-text">NEXT</span>
			<i class="fas fa-chevron-right"></i>
		</button>

		<button
			class="pag-btn icon-only"
			onclick={() => handlePageChange(goToLastPage)}
			disabled={$currentPage === $totalPages || $totalPages === 0}
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
				value={$itemsPerPage}
				onchange={handleItemsPerPageChange}
				class="settings-select"
			>
				{#each [5, 10, 25, 50, 'all'] as option}
					<option value={option}>{option === 'all' ? 'ALL' : option}</option>
				{/each}
			</select>
			<i class="fas fa-chevron-down select-icon"></i>
		</div>
	</div>
</div>

<style>
	.ledger-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.5rem 0;
		border-top: 1px solid var(--tech-cell-border);
		width: 100%;
		flex-wrap: wrap;
		gap: 2rem;
	}

	.footer-summary {
		flex: 1;
		min-width: 200px;
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
		gap: 0.75rem;
		flex: 1;
		justify-content: center;
		min-width: 300px;
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
		gap: 0.5rem;
	}

	.pag-btn:hover:not(:disabled) {
		background: var(--tech-header-bg);
		border-color: var(--tech-accent);
		color: var(--tech-accent);
	}

	.pag-btn:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	.pag-btn.icon-only {
		padding: 0.5rem;
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
		min-width: 250px;
	}

	.settings-label {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.65rem;
		font-weight: 800;
		color: var(--tech-label);
		letter-spacing: 0.05em;
	}

	.page-size-control {
		position: relative;
		display: flex;
		align-items: center;
	}

	.settings-select {
		appearance: none;
		background: var(--tech-badge-bg);
		border: 1px solid var(--tech-badge-border);
		color: var(--tech-value);
		padding: 0.4rem 2.2rem 0.4rem 0.8rem;
		border-radius: 4px;
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.75rem;
		font-weight: 700;
		cursor: pointer;
		transition: all 0.2s;
	}

	.settings-select:hover {
		border-color: var(--tech-accent);
	}

	.settings-select:focus {
		outline: none;
		border-color: var(--tech-accent);
		box-shadow: 0 0 10px var(--tech-accent-muted);
	}

	.select-icon {
		position: absolute;
		right: 0.8rem;
		font-size: 0.7rem;
		color: var(--tech-accent);
		pointer-events: none;
	}

	@media (max-width: 768px) {
		.btn-text { display: none; }
		.ledger-footer {
			flex-direction: column;
			text-align: center;
		}
		.footer-settings { justify-content: center; }
	}
</style>
