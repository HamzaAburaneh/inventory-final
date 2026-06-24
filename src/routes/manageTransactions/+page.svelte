<script>
	import { fade, fly } from 'svelte/transition';
	import { elasticOut } from 'svelte/easing';
	import SearchBar from '../../components/SearchBar.svelte';
	import TableSkeleton from '../../components/TableSkeleton.svelte';
	import ConfirmModal from '../../components/ConfirmModal.svelte';
	import Pagination from '../../components/Pagination.svelte';
	import { getPaginationStore } from '../../stores/paginationStore';
	import { itemStore } from '../../stores/itemStore';
	import { createSearchState } from '../../lib/runes/search.svelte.js';
	import { notificationStore } from '../../stores/notificationStore';
	import { applySorting } from '../../lib/items';
	import { addTransaction } from '../../lib/transactions';
	import { authStore } from '../../stores/authStore';
	import { onMount } from 'svelte';

	let currentSortColumn = $state('name');
	let sortAscending = $state(true);
	let itemsLoaded = $state(false);

	const paginationStore = getPaginationStore('manageTransactions');
	const { currentPage, itemsPerPage, setTotalItems } = paginationStore;

	// Reactive store views ($store auto-subscription)
	const search = createSearchState();

	const items = $derived($itemStore);
	const searchTermValue = $derived(search.term);
	const notification = $derived($notificationStore.at(-1) ?? null);
	const authUser = $derived($authStore);

	const filteredItemsList = $derived.by(() => {
		if (!searchTermValue) {
			return items;
		}
		const lowerCaseSearchTerm = searchTermValue.toLowerCase();
		return items.filter((item) => item.name.toLowerCase().includes(lowerCaseSearchTerm));
	});

	$effect(() => {
		setTotalItems(filteredItemsList.length);
	});

	const sortedItems = $derived(applySorting(filteredItemsList, currentSortColumn, sortAscending));

	const paginatedItemsList = $derived.by(() => {
		if ($itemsPerPage === 'all') {
			return sortedItems;
		}
		const startIndex = ($currentPage - 1) * $itemsPerPage;
		const endIndex = startIndex + $itemsPerPage;
		return sortedItems.slice(startIndex, endIndex);
	});

	const totalUnits = $derived(
		filteredItemsList.reduce((sum, item) => sum + (parseInt(item.count, 10) || 0), 0)
	);

	onMount(async () => {
		await itemStore.loadItems();
		itemsLoaded = true;
	});

	const sortBy = (column) => {
		if (currentSortColumn === column) {
			sortAscending = !sortAscending;
		} else {
			currentSortColumn = column;
			sortAscending = true;
		}
	};

	const handleSearch = (value) => {
		search.setTerm(value);
		paginationStore.setCurrentPage(1);
	};

	const getCurrentUser = () => {
		return authUser?.email || 'Unknown';
	};

	const changeCount = async (item, amount) => {
		const previousCount = item.count;
		await itemStore.changeCount(item.id, amount);
		const updatedItem = items.find((i) => i.id === item.id);
		if (updatedItem) {
			await addTransaction({
				itemId: item.id,
				itemName: item.name,
				type: amount > 0 ? 'add' : 'remove',
				previousCount: previousCount,
				newCount: updatedItem.count,
				user: getCurrentUser()
			});
		}
		// Reset the input field after operation
		itemStore.setChangeAmount(item.id, 0);
		notificationStore.showNotification(`Count for "${item.name}" updated successfully!`, 'success');
	};

	// Confirmation modal state. `kind` selects which action runs on confirm; `item`
	// holds the row being reset for the single-item case.
	let confirm = $state({ open: false, kind: null, item: null });

	const askResetCount = (item) => {
		confirm = { open: true, kind: 'reset', item };
	};

	const askResetAll = () => {
		confirm = { open: true, kind: 'resetAll', item: null };
	};

	const cancelConfirm = () => {
		confirm = { open: false, kind: null, item: null };
	};

	const handleConfirm = async () => {
		const { kind, item } = confirm;
		cancelConfirm();
		if (kind === 'reset') {
			await doResetCount(item);
		} else if (kind === 'resetAll') {
			await doResetAll();
		}
	};

	const doResetCount = async (item) => {
		const previousCount = item.count;
		await itemStore.resetItemCount(item.id);
		await addTransaction({
			itemId: item.id,
			itemName: item.name,
			type: 'remove',
			previousCount: previousCount,
			newCount: 0,
			user: getCurrentUser()
		});
		// Reset the input field after operation
		itemStore.setChangeAmount(item.id, 0);
		notificationStore.showNotification(`Count for "${item.name}" reset successfully!`, 'success');
	};

	const doResetAll = async () => {
		const itemsToReset = items.filter((item) => item.count !== 0);
		await itemStore.resetAllCounts();
		for (const item of itemsToReset) {
			await addTransaction({
				itemId: item.id,
				itemName: item.name,
				type: 'remove',
				previousCount: item.count,
				newCount: 0,
				user: getCurrentUser()
			});
		}
		notificationStore.showNotification('All counts have been reset successfully!', 'success');
	};

	const handleChangeAmountInput = (item, event) => {
		const input = event.target;
		const value = input.value.replace(/[^0-9]/g, '');

		if (value === '') {
			itemStore.setChangeAmount(item.id, 0);
			input.value = '';
		} else {
			const numValue = parseInt(value, 10);
			itemStore.setChangeAmount(item.id, numValue);
			input.value = numValue.toString();
		}
	};
</script>

{#if itemsLoaded}
	<div class="page-container">
		<div class="transactions-section">
			<div class="transactions-header">
				<h2 class="transactions-title">Adjust Stock</h2>
				<div class="transactions-stats">
					<span class="stats-text">{filteredItemsList.length} of {items.length} items</span>
					<span class="stats-text total-value">{totalUnits} units in stock</span>
				</div>
			</div>

			<div class="search-section">
				<SearchBar
					searchValue={searchTermValue}
					onSearch={handleSearch}
					onClear={() => search.clear()}
				/>
			</div>

			<div class="table-section">
				<div class="table-scroll">
					<table class="custom-table">
						<thead>
							<tr class="table-header">
								<th class="name-col" onclick={() => sortBy('name')} data-label="Item Name">
									<div class="header">
										<span>Item Name</span>
										<i
											class="fas fa-sort sort-icon {currentSortColumn === 'name'
												? sortAscending
													? 'fa-sort-up'
													: 'fa-sort-down'
												: ''}"
										></i>
									</div>
								</th>
								<th class="count-col" onclick={() => sortBy('count')} data-label="Count">
									<div class="header header-center">
										<span>Count</span>
										<i
											class="fas fa-sort sort-icon {currentSortColumn === 'count'
												? sortAscending
													? 'fa-sort-up'
													: 'fa-sort-down'
												: ''}"
										></i>
									</div>
								</th>
								<th class="change-col" data-label="Change Amount">
									<div class="header header-center">Change Amount</div>
								</th>
								<th class="actions-col" data-label="Actions">
									<div class="header header-center">Actions</div>
								</th>
							</tr>
						</thead>
						<tbody>
							{#each paginatedItemsList as item (item.id)}
								<tr in:fade={{ duration: 200 }}>
									<td class="name-col" data-label="Item Name">{item.name}</td>
									<td class="count-col count-cell" data-label="Count">
										<div class="count-anim">
											{#key item.count}
												<span
													class="count-value"
													transition:fly={{ y: -20, duration: 300, easing: elasticOut }}
												>
													{item.count}
												</span>
											{/key}
										</div>
									</td>
									<td class="change-col" data-label="Change Amount">
										<div class="change-wrap">
											<input
												type="number"
												inputmode="numeric"
												pattern="[0-9]*"
												placeholder="0"
												value={item.changeAmount === 0 ? '' : item.changeAmount}
												oninput={(e) => handleChangeAmountInput(item, e)}
												class="change-amount-input"
											/>
										</div>
									</td>
									<td class="actions-col" data-label="Actions">
										<div class="action-grid">
											<button
												class="act-btn act-add"
												onclick={() => changeCount(item, +item.changeAmount)}
												disabled={item.changeAmount === 0}
											>
												+
											</button>
											<button
												class="act-btn act-remove"
												onclick={() => changeCount(item, -item.changeAmount)}
												disabled={item.changeAmount === 0}
											>
												−
											</button>
											<button
												class="act-btn act-reset"
												onclick={() => askResetCount(item)}
												disabled={item.count === 0}
											>
												Reset
											</button>
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>

			<div class="pagination-section">
				<Pagination store={paginationStore} />
			</div>

			<div class="actions-section">
				<button class="reset-all-btn" onclick={askResetAll}> Reset All Counts </button>
			</div>
		</div>
	</div>
{:else}
	<TableSkeleton />
{/if}

<ConfirmModal
	visible={confirm.open}
	title="Are you sure?"
	confirmText={confirm.kind === 'resetAll' ? 'Yes, reset all!' : 'Yes, reset it!'}
	cancelText="Cancel"
	variant={confirm.kind === 'resetAll' ? 'danger' : 'warning'}
	onConfirm={handleConfirm}
	onCancel={cancelConfirm}
>
	{#if confirm.kind === 'resetAll'}
		This will reset the count for <strong class="emphasis">ALL</strong> items to 0.
	{:else if confirm.item}
		This will reset the count for <strong>"{confirm.item.name}"</strong> to 0.
	{/if}
</ConfirmModal>

{#if notification}
	<div class="notification {notification.type}" in:fade out:fade>
		{notification.message}
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

	.transactions-section {
		background: var(--container-bg);
		border-radius: var(--border-radius);
		padding: 0;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
		border: 1px solid var(--table-border-color);
		overflow: hidden;
	}

	.transactions-header {
		background: var(--table-header-bg);
		padding: 0.6rem 1.25rem;
		border-bottom: 1px solid var(--table-border-color);
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.5rem 1rem;
	}

	.transactions-title {
		margin: 0;
		font-size: 1.05rem;
		font-weight: 700;
		color: var(--text-color);
		letter-spacing: -0.025em;
	}

	.transactions-stats {
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

	.table-scroll {
		width: 100%;
		overflow-x: auto;
		overflow-y: auto;
		max-height: 41.9rem;
		min-height: 18.8rem;
		-webkit-overflow-scrolling: touch;
	}

	.custom-table {
		width: 100%;
		border-collapse: separate;
		border-spacing: 0;
	}

	.table-header th {
		position: sticky;
		top: 0;
		background-color: var(--table-header-bg);
		z-index: 10;
		box-shadow: 0 0.063rem 0.188rem rgba(0, 0, 0, 0.15);
		color: var(--text-color);
		font-weight: 700;
		padding: 0.625rem 1rem;
		text-align: left;
		border-bottom: 1px solid var(--table-border-color);
		font-size: 0.7rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		white-space: nowrap;
		cursor: pointer;
	}

	.custom-table td {
		padding: 0.75rem 1rem;
		text-align: left;
		border-bottom: 1px solid var(--table-border-color);
		color: var(--text-color);
	}

	.custom-table tbody tr {
		background-color: var(--container-bg);
		transition: background-color 0.15s ease-out;
	}

	.custom-table tbody tr:hover {
		background-color: var(--table-row-hover-bg);
	}

	.name-col {
		width: 34%;
		white-space: nowrap;
	}
	.count-col {
		width: 16%;
	}
	.change-col {
		width: 18%;
	}
	.actions-col {
		width: 32%;
	}

	.header {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		transition: color 0.15s ease-out;
	}

	.header-center {
		justify-content: center;
	}

	.table-header th:hover .header {
		color: var(--icon-hover-color);
	}

	.sort-icon {
		font-size: 0.8em;
	}

	.count-cell {
		text-align: center;
	}

	.count-anim {
		position: relative;
		display: inline-block;
		width: 100%;
		height: 1.5rem;
	}

	.count-value {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 600;
	}

	.change-wrap {
		display: flex;
		justify-content: center;
	}

	.act-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 2rem;
		min-height: 0;
		padding: 0 0.5rem;
		font-size: 0.78rem;
		font-weight: 600;
		color: #fff;
		border: none;
		border-radius: var(--border-radius);
		cursor: pointer;
		transition:
			background-color 0.15s ease-out,
			transform 0.1s ease;
	}

	.act-btn:active:not(:disabled) {
		transform: scale(0.96);
	}

	.act-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Suppress the global blue button:focus outline on mouse click; keep a themed
	   keyboard-only ring for accessibility. */
	.act-btn:focus,
	.reset-all-btn:focus {
		outline: none;
	}

	.act-btn:focus-visible,
	.reset-all-btn:focus-visible {
		outline: 2px solid var(--add-item-color);
		outline-offset: 2px;
	}

	.act-add {
		background-color: #047857;
	}
	.act-add:hover:not(:disabled) {
		background-color: #059669;
	}
	.act-remove {
		background-color: #b91c1c;
	}
	.act-remove:hover:not(:disabled) {
		background-color: #dc2626;
	}
	.act-reset {
		background-color: #d97706;
	}
	.act-reset:hover:not(:disabled) {
		background-color: #f59e0b;
	}

	.action-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.5rem;
		width: 100%;
		max-width: 20rem;
		margin: 0 auto;
	}

	.pagination-section {
		padding: 0.6rem 1.25rem;
		border-top: 1px solid var(--table-border-color);
		background: var(--hover-bg-color);
	}

	/* Destructive bulk action gets the soft-tint → solid-on-hover treatment used by
	   the Add button, but in danger red so it reads as distinct and cautionary. */
	.actions-section {
		display: flex;
		justify-content: center;
		padding: 0.85rem 1.25rem;
		border-top: 1px solid var(--table-border-color);
	}

	.reset-all-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 14rem;
		padding: 0.6rem 1.5rem;
		background: color-mix(in srgb, #ef4444 16%, transparent);
		color: #ef4444;
		border: none;
		border-radius: 8px;
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
		transition:
			background-color 0.15s ease-out,
			color 0.15s ease-out;
	}

	.reset-all-btn:hover,
	.reset-all-btn:active {
		background: #ef4444;
		color: #fff;
	}

	.notification {
		position: fixed;
		bottom: 20px;
		right: 20px;
		color: white;
		padding: 1rem 2rem;
		border-radius: 0.5rem;
		z-index: 1000;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
	}

	.notification.success {
		background-color: var(--add-item-color); /* Green */
	}

	.notification.error {
		background-color: #dc3545; /* Red */
	}

	.notification.warning {
		background-color: #ffc107; /* Yellow */
		color: #333; /* Dark text for contrast */
	}

	.notification.info {
		background-color: #17a2b8; /* Blue */
	}

	.change-amount-input {
		width: 4rem;
		height: 2rem;
		min-height: 0;
		text-align: center;
		font-size: 0.85rem;
		border-radius: var(--border-radius);
		background-color: var(--input-bg);
		color: var(--input-text);
		border: 1px solid var(--input-border-color);
		transition:
			background-color 0.15s ease-out,
			border-color 0.15s ease-out,
			box-shadow 0.15s ease-out;
		/* Hide number input spinner arrows */
		-moz-appearance: textfield;
	}

	.change-amount-input::-webkit-outer-spin-button,
	.change-amount-input::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}

	.change-amount-input::placeholder {
		text-align: center;
		color: var(--placeholder-text);
	}

	.change-amount-input:hover {
		background-color: var(--input-hover-bg);
		border-color: var(--input-hover-border-color);
	}

	.change-amount-input:focus {
		border-color: var(--add-item-color);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--add-item-color) 30%, transparent);
		outline: none;
	}

	/* Header stacks like manageItems on small screens. */
	@media (max-width: 640px) {
		.transactions-header {
			flex-direction: column;
			align-items: stretch;
		}

		.transactions-stats {
			width: 100%;
		}

		.stats-text {
			flex: 1;
			text-align: center;
			padding: 0.5rem 0.75rem;
		}
	}

	/* Table rows collapse into stacked cards on mobile. */
	@media (max-width: 768px) {
		.custom-table thead {
			display: none;
		}

		.custom-table,
		.custom-table tbody,
		.custom-table tr,
		.custom-table td {
			display: block;
			width: 100%;
		}

		.custom-table tr {
			display: flex;
			flex-direction: column;
			margin-bottom: 1rem;
			border: 1px solid var(--table-border-color);
			border-radius: 8px;
			overflow: hidden;
			background-color: var(--container-bg);
		}

		.custom-table td {
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding: 0.75rem 1rem;
			text-align: right;
			border-bottom: 1px solid var(--table-border-color);
		}

		.custom-table td:last-child {
			border-bottom: none;
		}

		.custom-table td::before {
			content: attr(data-label);
			font-weight: 700;
			text-align: left;
			white-space: nowrap;
		}

		.name-col {
			white-space: normal;
		}

		.count-cell {
			text-align: right;
		}

		.count-anim {
			position: static;
			display: inline-flex;
			width: auto;
			height: auto;
		}

		.count-value {
			position: static;
			justify-content: flex-end;
		}

		.change-wrap {
			justify-content: flex-end;
		}

		.actions-col {
			justify-content: center;
			padding: 1rem;
		}

		.actions-col::before {
			display: none;
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

		.transactions-header {
			padding: 0.7rem 2rem;
		}

		.search-section {
			padding: 0.85rem 2rem;
		}

		.pagination-section {
			padding: 0.7rem 2rem;
		}

		.actions-section {
			padding: 1rem 2rem;
		}

		.transactions-title {
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
