<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { elasticOut } from 'svelte/easing';
	import Swal from 'sweetalert2';
	import SearchBar from '../../components/SearchBar.svelte';
	import Pagination from '../../components/Pagination.svelte';
	import { fadeAndSlide } from '$lib/transitions';
	import { paginationStore, paginatedItems } from '../../stores/paginationStore';
	import { itemStore, filteredItems } from '../../stores/itemStore';
	import { searchStore } from '../../stores/searchStore';
	import { notificationStore } from '../../stores/notificationStore';
	import type { Item } from '../../types';
	import { applySorting } from '../../lib/items';
	import { theme } from '../../themes';
	import { addTransaction } from '../../lib/transactions';
	import { authStore } from '../../stores/authStore';

	let currentSortColumn: keyof Item = 'name';
	let sortAscending = true;
	let itemsLoaded = false;

	$: filteredItemsList = $filteredItems($searchStore);
	$: {
		paginationStore.setTotalItems(filteredItemsList.length);
	}
	$: sortedItems = applySorting(filteredItemsList, currentSortColumn, sortAscending);
	$: paginatedItemsList = $paginatedItems(sortedItems);
	$: filterLegend = `${filteredItemsList.length} results of ${$itemStore.length} total items.`;

	onMount(async () => {
		await itemStore.fetchItems();
		itemsLoaded = true;
	});

	const sortBy = (column: keyof Item) => {
		if (currentSortColumn === column) {
			sortAscending = !sortAscending;
		} else {
			currentSortColumn = column;
			sortAscending = true;
		}
	};

	const handleSearch = (value: string) => {
		searchStore.setSearchTerm(value);
		paginationStore.setCurrentPage(1);
	};

	const getCurrentUser = () => {
		return $authStore?.email || 'Unknown';
	};

	const changeCount = async (item: Item, amount: number) => {
		const previousCount = item.count;
		await itemStore.changeCount(item.id, amount);
		const updatedItem = $itemStore.find((i) => i.id === item.id);
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

	const resetCount = async (item: Item) => {
		const currentTheme = $theme;
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
		const currentTheme = $theme;
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
			const itemsToReset = $itemStore.filter((item) => item.count !== 0);
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

	const handleChangeAmountInput = (item: Item, event: Event) => {
		const input = event.target as HTMLInputElement;
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
			searchValue={$searchStore}
			onSearch={handleSearch}
			onClear={() => searchStore.clearSearch()}
		/>

		<div class="filter-legend text-white mb-4">
			{filterLegend}
		</div>

		<div class="table-container overflow-x-auto">
			<table class="custom-table w-full">
				<thead>
					<tr>
						<th class="w-1/3 px-6 py-3" on:click={() => sortBy('name')}>
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
						<th class="w-1/6 px-6 py-3" on:click={() => sortBy('count')}>
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
					{#each paginatedItemsList as item (item.id)}
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
										on:input={(e) => handleChangeAmountInput(item, e)}
										class="change-amount-input w-16 rounded-md shadow-sm sm:text-sm text-center"
									/>
								</div>
							</td>
							<td class="px-6 py-4">
								<div class="flex justify-center items-center space-x-2">
									<button
										class="bg-emerald-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-emerald-500 transition-transform active:scale-95 hover:shadow-lg"
										on:click={() => changeCount(item, +item.changeAmount)}
										disabled={item.changeAmount === 0}
									>
										Increase
									</button>
									<button
										class="bg-red-800 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-600 transition-transform active:scale-95 hover:shadow-lg"
										on:click={() => changeCount(item, -item.changeAmount)}
										disabled={item.changeAmount === 0}
									>
										Decrease
									</button>
									<button
										class="bg-yellow-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-yellow-500 transition-transform active:scale-95 hover:shadow-lg"
										on:click={() => resetCount(item)}
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

		<Pagination />

		<div class="flex justify-center mt-6">
			<button
				class="bg-red-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-red-500 transition-transform active:scale-95"
				on:click={resetAll}
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

{#if $notificationStore}
	<div class="notification" in:fade out:fade>
		{$notificationStore.message}
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
		top: 20px;
		left: 50%;
		transform: translateX(-50%);
		background-color: #38a169;
		color: white;
		padding: 1rem 2rem;
		border-radius: 0.5rem;
		z-index: 1000;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
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
