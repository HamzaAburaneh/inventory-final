<script>
	import { fade, fly } from 'svelte/transition';
	import { elasticOut } from 'svelte/easing';
	import Swal from 'sweetalert2';
	import SearchBar from '../../components/SearchBar.svelte';
	import Pagination from '../../components/Pagination.svelte';
	import { fadeAndSlide } from '$lib/transitions';
	import { getPaginationStore } from '../../stores/paginationStore';
	import { itemStore } from '../../stores/itemStore';
	import { searchTerm, clearSearch, setSearchTerm } from '../../stores/searchStore';
	import { notificationStore } from '../../stores/notificationStore';
	import { applySorting } from '../../lib/items';
	import { themeStore } from '../../stores/themes.js';
	import { addTransaction } from '../../lib/transactions';
	import { authStore } from '../../stores/authStore';
	import { get } from 'svelte/store';

	let currentSortColumn = $state('name');
	let sortAscending = $state(true);
	let itemsLoaded = $state(false);
	
	const paginationStore = getPaginationStore('manageTransactions');
	const { currentPage, itemsPerPage, setTotalItems } = paginationStore;

	// Store values as reactive state
	let items = $state([]);
	let searchTermValue = $state('');
	let notificationValue = $state(null);
	let currentTheme = $state('light');
	let authUser = $state(null);
	
	// Subscribe to stores
	$effect(() => {
		const unsubscribeItems = itemStore.subscribe(value => {
			items = value;
		});
		const unsubscribeSearch = searchTerm.subscribe(value => {
			searchTermValue = value;
		});
		const unsubscribeNotification = notificationStore.subscribe(value => {
			notificationValue = value;
		});
		const unsubscribeTheme = themeStore.subscribe(value => {
			currentTheme = value;
		});
		const unsubscribeAuth = authStore.subscribe(value => {
			authUser = value;
		});
		
		return () => {
			unsubscribeItems();
			unsubscribeSearch();
			unsubscribeNotification();
			unsubscribeTheme();
			unsubscribeAuth();
		};
	});

	const filteredItemsList = $derived(() => {
		if (!searchTermValue) {
			return items;
		}
		const lowerCaseSearchTerm = searchTermValue.toLowerCase();
		return items.filter(item =>
			item.name.toLowerCase().includes(lowerCaseSearchTerm)
		);
	});
	
	$effect(() => {
		setTotalItems(filteredItemsList().length);
	});
	
	const sortedItems = $derived(applySorting(filteredItemsList(), currentSortColumn, sortAscending));
	
	const paginatedItemsList = $derived(() => {
		if ($itemsPerPage === 'all') {
			return sortedItems;
		}
		const startIndex = ($currentPage - 1) * $itemsPerPage;
		const endIndex = startIndex + $itemsPerPage;
		return sortedItems.slice(startIndex, endIndex);
	});
	
	const filterLegend = $derived(`${filteredItemsList().length} results of ${items.length} total items.`);

	$effect(async () => {
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
		setSearchTerm(value);
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

	const resetCount = async (item) => {
		const result = await Swal.fire({
			title: 'Are you sure?',
			text: `This will reset the count for "${item.name}" to 0.`,
			icon: 'warning',
			showCancelButton: true,
			confirmButtonColor: '#D97706',
			cancelButtonColor: '#6B7280',
			confirmButtonText: 'Yes, reset it!',
			background: currentTheme === 'dark' ? '#1F2937' : '#FFFFFF',
			color: currentTheme === 'dark' ? '#FFFFFF' : '#000000'
		});

		if (result.isConfirmed) {
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
		}
	};

	const resetAll = async () => {
		const result = await Swal.fire({
			title: 'Are you sure?',
			html: `This will reset the count for <strong style="color: #DC2626;">ALL</strong> items to 0.`,
			icon: 'warning',
			showCancelButton: true,
			confirmButtonColor: '#D97706',
			cancelButtonColor: '#6B7280',
			confirmButtonText: 'Yes, reset all!',
			background: currentTheme === 'dark' ? '#1F2937' : '#FFFFFF',
			color: currentTheme === 'dark' ? '#FFFFFF' : '#000000'
		});

		if (result.isConfirmed) {
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
		}
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
	<div
		class="container mx-auto p-4 sm:p-6 rounded-lg shadow-md bg-container mt-4"
		in:fadeAndSlide={{ duration: 300, y: 75 }}
	>
		<SearchBar
			searchValue={searchTermValue}
			onSearch={handleSearch}
			onClear={clearSearch}
		/>

		<div class="filter-legend text-white mb-4">
			{filterLegend}
		</div>

		<div class="table-container overflow-x-auto">
			<table class="custom-table w-full">
				<thead>
					<tr>
						<th class="w-1/3 px-6 py-3" onclick={() => sortBy('name')} data-label="Item Name">
							<div class="header flex items-center cursor-pointer">
								Item Name
								<i
									class="fas fa-sort ml-2 {currentSortColumn === 'name'
										? sortAscending
											? 'fa-sort-up'
											: 'fa-sort-down'
										: ''}"
								></i>
							</div>
						</th>
						<th class="w-1/6 px-6 py-3" onclick={() => sortBy('count')} data-label="Count">
							<div class="header flex items-center justify-center cursor-pointer">
								Count
								<i
									class="fas fa-sort ml-2 {currentSortColumn === 'count'
										? sortAscending
											? 'fa-sort-up'
											: 'fa-sort-down'
										: ''}"
								></i>
							</div>
						</th>
						<th class="w-1/6 px-6 py-3" data-label="Change Amount">
							<div class="flex items-center justify-center">Change Amount</div>
						</th>
						<th class="w-1/3 px-6 py-3" data-label="Actions">
							<div class="flex items-center justify-center">Actions</div>
						</th>
					</tr>
				</thead>
				<tbody>
					{#each paginatedItemsList() as item (item.id)}
						<tr class="border-b border-zinc-800" in:fade={{ duration: 200 }}>
							<td class="px-6 py-4 whitespace-nowrap" data-label="Item Name">{item.name}</td>
							<td class="px-6 py-4 text-center" data-label="Count">
								<div class="relative inline-block w-full h-6">
									{#key item.count}
										<span
											class="absolute inset-0 flex items-center justify-end"
											transition:fly={{ y: -20, duration: 300, easing: elasticOut }}
										>
											{item.count}
										</span>
									{/key}
								</div>
							</td>
							<td class="px-6 py-4" data-label="Change Amount">
								<div class="flex justify-end">
									<input
										type="number"
										inputmode="numeric"
										pattern="[0-9]*"
										placeholder="0"
										value={item.changeAmount === 0 ? '' : item.changeAmount}
										oninput={(e) => handleChangeAmountInput(item, e)}
										class="change-amount-input w-16 h-8 rounded-md shadow-sm sm:text-sm text-center"
									/>
								</div>
							</td>
							<td class="px-6 py-4" data-label="Actions">
								<div class="grid grid-cols-3 gap-2 w-full max-w-xs mx-auto">
									<button
										class="flex justify-center items-center h-8 bg-emerald-700 text-white text-xs font-medium rounded-md shadow-sm hover:bg-emerald-600 active:bg-emerald-800 transition-colors"
										onclick={() => changeCount(item, +item.changeAmount)}
										disabled={item.changeAmount === 0}
									>
										+
									</button>
									<button
										class="flex justify-center items-center h-8 bg-red-700 text-white text-xs font-medium rounded-md shadow-sm hover:bg-red-600 active:bg-red-800 transition-colors"
										onclick={() => changeCount(item, -item.changeAmount)}
										disabled={item.changeAmount === 0}
									>
										−
									</button>
									<button
										class="flex justify-center items-center h-8 bg-amber-600 text-white text-xs font-medium rounded-md shadow-sm hover:bg-amber-500 active:bg-amber-700 transition-colors text-center"
										onclick={() => resetCount(item)}
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

		<Pagination store={paginationStore} />

		<div class="flex justify-center mt-6">
			<button
				class="bg-red-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-red-500 transition-transform active:scale-95"
				onclick={resetAll}
			>
				Reset All Counts
			</button>
		</div>
	</div>
{:else}
	<div class="flex justify-center items-center h-screen">
		<div class="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-gray-900"></div>
	</div>
{/if}

{#if notificationValue}
	<div class="notification {notificationValue.type}" in:fade out:fade>
		{notificationValue.message}
	</div>
{/if}

<style>
	.filter-legend {
		font-size: 0.9rem;
		color: #949494;
	}

	.container {
		margin-top: 20px;
		padding: 1rem;
		max-width: 90%;
		background-color: var(--container-bg);
		box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
		border-radius: 1rem;
	}

	.table-container {
		min-height: 400px;
		max-height: 70vh;
		overflow-y: auto;
		margin-bottom: 1rem;
	}

	.custom-table {
		border-collapse: separate;
		border-spacing: 0;
	}

	.custom-table th {
		position: sticky;
		top: 0;
		background-color: var(--container-bg);
		z-index: 10;
		box-shadow: 0 2px 2px -1px rgba(0, 0, 0, 0.4);
	}

	.custom-table th,
	.custom-table td {
		padding: 0.75rem;
		text-align: left;
		border-bottom: 1px solid var(--table-border-color);
	}

	.custom-table tbody tr {
		background-color: var(--container-bg);
		transition: background-color 0.3s ease;
	}

	.custom-table tbody tr:hover {
		background-color: var(--table-row-hover-bg);
	}

	.header {
		display: flex;
		align-items: center;
		cursor: pointer;
	}

	.header i {
		margin-left: 0.5rem;
		font-size: 0.8em;
	}

	.header:hover {
		color: var(--icon-hover-color);
		transition: color 0.3s ease;
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

	button {
		transition:
			background-color 0.3s ease,
			transform 0.1s ease;
	}

	button[disabled] {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.relative {
		height: 1.5em;
		width: 100%;
	}

	.change-amount-input {
		background-color: var(--input-bg);
		color: var(--input-text);
		border: 1px solid var(--input-border);
		transition: all 0.3s ease;
		display: flex;
		align-items: center;
		justify-content: center;
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
		color: var(--input-text);
		opacity: 0.6;
	}

	.change-amount-input:hover {
		background-color: var(--input-hover-bg);
	}

	.change-amount-input:focus {
		border-color: var(--input-focus-border);
		outline: none;
	}

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
			position: relative;
			border-bottom: 2px solid rgba(255, 255, 255, 0.1);
		}

		.custom-table td:last-child {
			border-bottom: none;
		}

		.custom-table tr:hover td {
			border-bottom-color: rgba(255, 255, 255, 0.2);
		}

		.custom-table td::before {
			content: attr(data-label);
			font-weight: bold;
			text-align: left;
			white-space: nowrap;
		}

		.custom-table td[data-label="Actions"] {
			justify-content: center;
			padding: 1rem;
		}

		.custom-table td[data-label="Actions"]::before {
			display: none;
		}

		.custom-table td[data-label="Change Amount"] {
			justify-content: space-between;
		}

		.custom-table td[data-label="Change Amount"] .flex {
			justify-content: flex-end;
		}
	}

	@media (min-width: 640px) {
		.container {
			padding: 1.5rem;
			max-width: 95%;
		}
	}

	@media (min-width: 1024px) {
		.container {
			padding: 2.5rem;
			max-width: 90%;
		}
	}
</style>
