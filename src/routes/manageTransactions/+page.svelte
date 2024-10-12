<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { elasticOut } from 'svelte/easing';
	import SearchBar from '../../components/SearchBar.svelte';
	import Pagination from '../../components/Pagination.svelte';
	import { fadeAndSlide } from '$lib/transitions';
	import { getItems, updateItemCount, resetItemCount, resetAllCounts } from '../../lib/items';
	import type { Item } from '../../types';
	import { applySorting } from '../../lib/items';
	import { paginationStore, paginatedItems } from '../../stores/paginationStore';

	let allItems: Item[] = [];
	let searchValue = '';
	let selectedItem: Item | null = null;

	let notificationMessage = '';
	let showNotification = false;

	$: filteredItems = searchValue.trim()
		? allItems.filter((item) => item.name.toLowerCase().includes(searchValue.toLowerCase()))
		: allItems;

	$: {
		paginationStore.setTotalItems(filteredItems.length);
	}

	$: paginatedItemsList = $paginatedItems(filteredItems);
	$: filterLegend = `${filteredItems.length} results of ${allItems.length} total items.`;

	onMount(async () => {
		allItems = await getItems();
		allItems = allItems.map((item) => ({ ...item, changeAmount: 0 }));
		updateItems();
	});

	let currentSortColumn: keyof Item = 'name';
	let sortAscending = true;

	const sortBy = (column: keyof Item) => {
		sortAscending = currentSortColumn === column ? !sortAscending : true;
		currentSortColumn = column;
		updateItems();
	};

	const handleSearch = (value: string) => {
		searchValue = value;
		paginationStore.setCurrentPage(1);
	};

	const changeCount = async (item: Item, amount: number) => {
		const newCount = Math.max(0, item.count + amount);
		item.count = newCount;
		await updateItemCount(item.id, newCount);
		updateItems();

		showNotificationWithMessage(`Count for "${item.name}" updated successfully!`);
	};

	const resetCount = async (item: Item) => {
		item.count = 0;
		await resetItemCount(item.id);
		updateItems();

		showNotificationWithMessage(`Count for "${item.name}" reset successfully!`);
	};

	const resetAll = async () => {
		await resetAllCounts();
		allItems = await getItems();
		allItems = allItems.map((item) => ({ ...item, changeAmount: 0 }));
		paginationStore.setCurrentPage(1);

		showNotificationWithMessage('All counts have been reset successfully!');
	};

	const updateItems = () => {
		allItems = applySorting(allItems, currentSortColumn, sortAscending);
	};

	const showNotificationWithMessage = (message: string) => {
		notificationMessage = message;
		showNotification = true;
		setTimeout(() => {
			showNotification = false;
			notificationMessage = '';
		}, 3000);
	};

	const handleItemsPerPageChange = (event: Event) => {
		const select = event.target as HTMLSelectElement;
		const newItemsPerPage = select.value === 'all' ? 'all' : parseInt(select.value);
		paginationStore.setItemsPerPage(newItemsPerPage);
	};
</script>

<div
	class="container mx-auto p-4 sm:p-6 rounded-lg shadow-md bg-container mt-4"
	in:fadeAndSlide={{ duration: 300, y: 75 }}
>
	{#if showNotification}
		<div class="notification" in:fade out:fade>
			{notificationMessage}
		</div>
	{/if}

	<SearchBar {searchValue} onSearch={handleSearch} onClear={() => handleSearch('')} />

	<div
		class="top-controls flex flex-col sm:flex-row justify-between items-center mb-4 space-y-2 sm:space-y-0"
	>
		<div class="filter-legend text-white">
			{filterLegend}
		</div>
		<select
			bind:value={$paginationStore.itemsPerPage}
			on:change={handleItemsPerPageChange}
			class="bg-zinc-700 text-white rounded-lg p-2"
		>
			{#each $paginationStore.itemsPerPageOptions as option}
				<option value={option}>{option === 'all' ? 'All' : option} per page</option>
			{/each}
		</select>
	</div>

	<div class="overflow-x-auto">
		<table class="custom-table table-auto w-full mt-4 border-collapse">
			<thead class="bg-zinc-800 text-white uppercase text-sm leading-normal">
				<tr>
					<th class="px-4 py-2 text-left" on:click={() => sortBy('name')}>
						<div class="header">
							Item Name
							<i
								class="fas fa-sort{currentSortColumn === 'name'
									? sortAscending
										? '-up'
										: '-down'
									: ''}"
							></i>
						</div>
					</th>
					<th class="px-4 py-2 text-left" on:click={() => sortBy('count')}>
						<div class="header">
							Count
							<i
								class="fas fa-sort{currentSortColumn === 'count'
									? sortAscending
										? '-up'
										: '-down'
									: ''}"
							></i>
						</div>
					</th>
					<th class="py-3 px-6 text-center">Change Amount</th>
					<th class="py-3 px-6 text-center">Actions</th>
				</tr>
			</thead>
			<tbody class="text-white text-sm font-light">
				{#each paginatedItemsList as item (item.id)}
					<tr class="border-b border-zinc-800 hover:bg-zinc-800" in:fade={{ duration: 200 }}>
						<td class="py-3 px-6 text-left whitespace-nowrap">{item.name}</td>
						<td class="py-3 px-6 text-center">
							<div class="relative inline-block">
								{#key item.count}
									<span
										in:fly={{ y: -20, duration: 300, easing: elasticOut }}
										out:fade={{ duration: 200 }}
										class="absolute left-0 right-0"
									>
										{item.count}
									</span>
								{/key}
							</div>
						</td>
						<td class="py-3 px-6 text-center">
							<input
								type="number"
								bind:value={item.changeAmount}
								min="0"
								class="w-16 rounded-md bg-zinc-800 border-zinc-800 hover:border-stone-400 text-white shadow-sm focus:border-stone-400 focus:ring-stone-400 sm:text-sm text-center"
								on:input={() => (item.changeAmount = Math.max(0, item.changeAmount))}
							/>
						</td>
						<td class="py-3 px-6 text-center">
							<div
								class="flex flex-col sm:flex-row justify-center items-center space-y-2 sm:space-y-0 sm:space-x-2"
							>
								<button
									class="bg-emerald-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-emerald-500 transition-transform active:scale-95 hover:shadow-lg w-full sm:w-auto"
									on:click={() => changeCount(item, +item.changeAmount)}
									disabled={item.changeAmount === 0}
								>
									Increase
								</button>
								<button
									class="bg-red-800 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-600 transition-transform active:scale-95 hover:shadow-lg w-full sm:w-auto"
									on:click={() => changeCount(item, -item.changeAmount)}
									disabled={item.changeAmount === 0}
								>
									Decrease
								</button>
								<button
									class="bg-yellow-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-yellow-500 transition-transform active:scale-95 hover:shadow-lg w-full sm:w-auto"
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
			class="bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-500 transition-transform active:scale-95"
			on:click={resetAll}
		>
			Reset All Counts
		</button>
	</div>
</div>

<style>
	.top-controls {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}

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
	}

	.header {
		display: flex;
		align-items: center;
		cursor: pointer;
	}

	.custom-table th,
	.custom-table td {
		padding: 0.75rem;
		text-align: left;
	}

	.custom-table th {
		cursor: default;
		border-bottom: 2px solid var(--table-border-color);
	}

	.custom-table th .header {
		display: inline;
		cursor: pointer;
	}

	.custom-table th .header:hover {
		color: var(--icon-hover-color);
		transition: color 0.3s ease;
	}

	.custom-table td {
		cursor: default;
	}
</style>
