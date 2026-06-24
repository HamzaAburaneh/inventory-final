<script>
	import { fly } from 'svelte/transition';
	import { prefersReducedMotion } from 'svelte/motion';
	import { tick } from 'svelte';

	let { store } = $props();

	// The pagination store is created once per page (`getPaginationStore(key)`) and its
	// identity never changes, so capturing the initial value is intentional. Destructuring
	// at the top level is required for the nested `$currentPage` etc. store subscriptions.
	// svelte-ignore state_referenced_locally
	const { currentPage, totalPages, itemsPerPage, setCurrentPage, setItemsPerPage } = store;

	const menuParams = $derived({ y: 6, duration: prefersReducedMotion.current ? 0 : 150 });

	const perPageOptions = [5, 10, 25, 50, 'all'];

	const optionLabel = (option) => (option === 'all' ? 'All' : String(option));

	// Custom items-per-page dropdown state.
	let menuOpen = $state(false);
	let triggerEl = $state();
	let menuEl = $state();

	function openMenu(focusSelected = false) {
		menuOpen = true;
		if (focusSelected) {
			tick().then(() => {
				const selected = menuEl?.querySelector('.select-option.selected');
				(selected ?? menuEl?.querySelector('.select-option'))?.focus();
			});
		}
	}

	function closeMenu(refocus = false) {
		menuOpen = false;
		if (refocus) triggerEl?.focus();
	}

	function goToPage(page) {
		if (page >= 1 && page <= $totalPages) {
			// Preserve scroll position during pagination
			const scrollPos = window.pageYOffset || document.documentElement.scrollTop;
			setCurrentPage(page);

			// Restore scroll position after pagination update
			setTimeout(() => {
				window.scrollTo(0, scrollPos);
			}, 50);
		}
	}

	function chooseItemsPerPage(option) {
		const newItemsPerPage = option === 'all' ? 'all' : parseInt(option);

		// Preserve scroll position during items per page change
		const scrollPos = window.pageYOffset || document.documentElement.scrollTop;
		setItemsPerPage(newItemsPerPage);

		// Restore scroll position after items per page update
		setTimeout(() => {
			window.scrollTo(0, scrollPos);
		}, 50);

		closeMenu(true);
	}

	function onTriggerKey(event) {
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			openMenu(true);
		} else if (event.key === 'Escape') {
			closeMenu();
		}
	}

	function onMenuKey(event) {
		const options = [...menuEl.querySelectorAll('.select-option')];
		const index = options.indexOf(document.activeElement);
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			options[Math.min(index + 1, options.length - 1)]?.focus();
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			options[Math.max(index - 1, 0)]?.focus();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			closeMenu(true);
		} else if (event.key === 'Tab') {
			closeMenu();
		}
	}

	/** Close the dropdown when clicking anywhere outside the select. */
	function clickOutside(node, onOutside) {
		const handler = (event) => {
			if (!node.contains(event.target)) onOutside();
		};
		document.addEventListener('click', handler, true);
		return {
			destroy() {
				document.removeEventListener('click', handler, true);
			}
		};
	}
</script>

<div class="pagination-controls">
	<div class="pagination-buttons">
		<button
			class="pagination-button"
			onclick={() => goToPage($currentPage - 1)}
			disabled={$currentPage === 1}
			aria-label="Previous page"
		>
			<i class="fas fa-chevron-left"></i>
		</button>
		<span class="pagination-info">Page {$currentPage} of {$totalPages}</span>
		<button
			class="pagination-button"
			onclick={() => goToPage($currentPage + 1)}
			disabled={$currentPage === $totalPages}
			aria-label="Next page"
		>
			<i class="fas fa-chevron-right"></i>
		</button>
	</div>
	<div class="items-per-page">
		<span class="items-per-page-label" id="items-per-page-label">Items per page:</span>
		<div class="select" use:clickOutside={() => closeMenu()}>
			<button
				type="button"
				bind:this={triggerEl}
				class="select-trigger"
				class:open={menuOpen}
				aria-haspopup="listbox"
				aria-expanded={menuOpen}
				aria-labelledby="items-per-page-label"
				onclick={() => (menuOpen ? closeMenu() : openMenu())}
				onkeydown={onTriggerKey}
			>
				<span class="select-value-text">{optionLabel($itemsPerPage)}</span>
				<span class="select-chevron" class:open={menuOpen} aria-hidden="true">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<polyline points="6 9 12 15 18 9"></polyline>
					</svg>
				</span>
			</button>

			{#if menuOpen}
				<div
					class="select-menu"
					role="listbox"
					tabindex="-1"
					aria-labelledby="items-per-page-label"
					bind:this={menuEl}
					onkeydown={onMenuKey}
					transition:fly={menuParams}
				>
					{#each perPageOptions as option (option)}
						<button
							type="button"
							role="option"
							aria-selected={$itemsPerPage === option}
							class="select-option"
							class:selected={$itemsPerPage === option}
							onclick={() => chooseItemsPerPage(option)}
						>
							<span class="select-option-main">{optionLabel(option)}</span>
							{#if $itemsPerPage === option}
								<span class="select-check" aria-hidden="true">
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
										<polyline points="20 6 9 17 4 12"></polyline>
									</svg>
								</span>
							{/if}
						</button>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.pagination-controls {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0;
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
		padding: 0.35rem 0.7rem;
		font-size: 0.85rem;
		cursor: pointer;
		min-height: 0;
		transition:
			background-color 0.15s ease-out,
			color 0.15s ease-out;
	}

	.pagination-button:hover:not(:disabled) {
		background-color: var(--hover-bg-color);
	}

	.pagination-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.pagination-info {
		font-size: 0.85rem;
		color: var(--text-color);
		padding: 0 0.75rem;
	}

	.items-per-page {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.items-per-page-label {
		font-size: 0.85rem;
		color: var(--text-color);
	}

	/* Custom items-per-page dropdown — matches the storage-type select on ManageItems. */
	.select {
		position: relative;
	}

	.select-trigger {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.4rem;
		min-width: 3.75rem;
		padding: 0.35rem 0.45rem 0.35rem 0.6rem;
		border: 1.5px solid var(--input-border-color);
		border-radius: var(--border-radius);
		background-color: var(--input-bg);
		color: var(--input-text);
		font-size: 0.85rem;
		font-weight: 500;
		text-align: left;
		cursor: pointer;
		min-height: 0;
		-webkit-tap-highlight-color: transparent;
		transition:
			border-color 0.15s ease-out,
			box-shadow 0.15s ease-out,
			background-color 0.15s ease-out;
	}

	.select-trigger:hover:not(.open) {
		border-color: var(--input-hover-border-color);
		background-color: var(--input-hover-bg);
	}

	/* Suppress the global button:focus outline; keep the accent ring below. */
	.select-trigger:focus {
		outline: none;
	}

	.select-trigger.open,
	.select-trigger:focus-visible {
		outline: none;
		border-color: var(--add-item-color);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--add-item-color) 30%, transparent);
	}

	.select-value-text {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.select-chevron {
		display: inline-flex;
		flex-shrink: 0;
		color: var(--text-color-dimmed);
		transition: transform 0.2s ease-out;
	}

	.select-chevron.open {
		transform: rotate(180deg);
	}

	.select-chevron svg {
		width: 0.85rem;
		height: 0.85rem;
		display: block;
	}

	/* Opens upward: pagination sits at the bottom of the table. */
	.select-menu {
		position: absolute;
		bottom: calc(100% + 0.35rem);
		left: 0;
		right: auto;
		min-width: 100%;
		width: max-content;
		z-index: 50;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		padding: 0.3rem;
		background: var(--container-bg);
		border: 1px solid var(--table-border-color);
		border-radius: var(--border-radius);
		box-shadow: 0 -10px 28px rgba(0, 0, 0, 0.22);
	}

	.select-option {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.4rem;
		width: 100%;
		padding: 0.4rem 0.45rem 0.4rem 0.6rem;
		border: none;
		border-radius: calc(var(--border-radius) - 2px);
		background: transparent;
		color: var(--text-color);
		font-size: 0.85rem;
		font-weight: 500;
		text-align: left;
		cursor: pointer;
		min-height: 0;
		transition:
			background-color 0.12s ease-out,
			color 0.12s ease-out;
	}

	.select-option:hover:not(.selected),
	.select-option:focus-visible {
		outline: none;
		background: var(--hover-bg-color);
	}

	.select-option.selected {
		background: color-mix(in srgb, var(--add-item-color) 16%, transparent);
	}

	.select-option-main {
		white-space: nowrap;
	}

	.select-check {
		display: inline-flex;
		flex-shrink: 0;
		color: var(--add-item-color);
	}

	.select-check svg {
		width: 0.85rem;
		height: 0.85rem;
		display: block;
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
