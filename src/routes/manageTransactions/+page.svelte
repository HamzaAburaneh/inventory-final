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
						<th class="w-1/3 px-6 py-3" onclick={() => sortBy('name')}>
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
						<th class="w-1/6 px-6 py-3" onclick={() => sortBy('count')}>
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
						<th class="w-1/6 px-6 py-3">
							<div class="flex items-center justify-center">Change Amount</div>
						</th>
						<th class="w-1/3 px-6 py-3">
							<div class="flex items-center justify-center">Actions</div>
						</th>
					</tr>
				</thead>
				<tbody>
					{#each paginatedItemsList() as item (item.id)}
						<tr class="border-b border-zinc-800" in:fade={{ duration: 200 }}>
							<td class="px-6 py-4 text-left whitespace-nowrap">{item.name}</td>
							<td class="px-6 py-4 text-center">
								<div class="relative inline-block w-full h-6">
									{#key item.count}
										<span
											class="absolute inset-0 flex items-center justify-center"
											transition:fly={{ y: -20, duration: 300, easing: elasticOut }}
										>
											{item.count}
										</span>
									{/key}
								</div>
							</td>
							<td class="px-6 py-4">
								<div class="flex justify-center">
									<input
										type="text"
										placeholder="0"
										value={item.changeAmount === 0 ? '' : item.changeAmount}
										oninput={(e) => handleChangeAmountInput(item, e)}
										class="change-amount-input w-16 rounded-md shadow-sm sm:text-sm text-center"
									/>
								</div>
							</td>
							<td class="px-6 py-4">
								<div class="flex justify-center items-center space-x-2">
									<button
										class="bg-emerald-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-emerald-500 transition-transform active:scale-95 hover:shadow-lg"
										onclick={() => changeCount(item, +item.changeAmount)}
										disabled={item.changeAmount === 0}
									>
										Increase
									</button>
									<button
										class="bg-red-800 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-600 transition-transform active:scale-95 hover:shadow-lg"
										onclick={() => changeCount(item, -item.changeAmount)}
										disabled={item.changeAmount === 0}
									>
										Decrease
									</button>
									<button
										class="bg-yellow-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-yellow-500 transition-transform active:scale-95 hover:shadow-lg"
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
		padding: 2.5rem;
		max-width: 90%;
		background-color: var(--container-bg);
		box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
		border-radius: 1rem;
	}

	.table-container {
		max-height: 700px;
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
	}

	.change-amount-input:hover {
		background-color: var(--input-hover-bg);
	}

	.change-amount-input:focus {
		border-color: var(--input-focus-border);
		outline: none;
	}
</style>
