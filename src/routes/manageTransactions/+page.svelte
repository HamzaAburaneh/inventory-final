<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { elasticOut } from 'svelte/easing';
	import SearchBar from '../../components/SearchBar.svelte';
	import { fadeAndSlide } from '$lib/transitions';
	import { getItems, updateItemCount, resetItemCount, resetAllCounts } from '../../lib/items';
	import type { Item } from '../../types';
	import { applySorting } from '../../lib/items';

	let allItems: Item[] = [];
	let searchValue = '';
	let selectedItem: Item | null = null;

	let currentPage = 1;
	let itemsPerPage: number | 'all' = 10;

	let totalPages: number;

	let itemsPerPageOptions = [10, 25, 50, 'all'];

	let notificationMessage = '';
	let showNotification = false;

	$: filteredItems = searchValue.trim()
		? allItems.filter((item) => item.name.toLowerCase().includes(searchValue.toLowerCase()))
		: allItems;

	$: totalPages = Math.ceil(
		filteredItems.length / (itemsPerPage === 'all' ? filteredItems.length : itemsPerPage)
	);

	$: paginatedItems = getPaginatedItems(filteredItems, currentPage, itemsPerPage);
	$: filterLegend = `${filteredItems.length} results of ${allItems.length} total`;

	$: visiblePageNumbers = getVisiblePageNumbers(currentPage, totalPages);

	function getPaginatedItems(items: Item[], page: number, perPage: number | 'all') {
		if (perPage === 'all') return items;
		const start = (page - 1) * perPage;
		const end = start + perPage;
		return items.slice(start, end);
	}

	function getVisiblePageNumbers(current: number, total: number) {
		if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

		if (current <= 4) return [1, 2, 3, 4, 5, '...', total];
		if (current >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total];

		return [1, '...', current - 1, current, current + 1, '...', total];
	}

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
		currentPage = 1;
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
		currentPage = 1;

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

	const goToPage = (page: number) => {
		if (page >= 1 && page <= totalPages) {
			currentPage = page;
		}
	};

	const handleItemsPerPageChange = (event: Event) => {
		const select = event.target as HTMLSelectElement;
		itemsPerPage = select.value === 'all' ? 'all' : parseInt(select.value);
		currentPage = 1;
		updateItems();
	};
</script>

<div
	class="container mx-auto p-4 rounded-lg shadow-md bg-container mt-4"
	in:fadeAndSlide={{ duration: 300, y: 75 }}
>
	{#if showNotification}
		<div class="notification" in:fade out:fade>
			{notificationMessage}
		</div>
	{/if}

	<SearchBar {searchValue} onSearch={handleSearch} onClear={() => handleSearch('')} />

	<div class="filter-legend mt-2 text-white">
		{filterLegend}
	</div>

	<table class="custom-table table-auto w-full mt-4 border-collapse">
		<thead class="bg-zinc-800 text-white uppercase text-sm leading-normal">
			<tr>
				<th class="px-4 py-2 text-left fixed-width-name" on:click={() => sortBy('name')}>
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
				<th class="px-4 py-2 text-left fixed-width-count" on:click={() => sortBy('count')}>
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
			{#each paginatedItems as item (item.id)}
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
						/>
					</td>
					<td class="py-3 px-6 text-center">
						<button
							class="bg-emerald-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-emerald-500 mr-2 transition-transform active:scale-95 hover:shadow-lg"
							on:click={() => changeCount(item, +item.changeAmount)}
						>
							Increase
						</button>
						<button
							class="bg-red-800 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-600 mr-2 transition-transform active:scale-95 hover:shadow-lg"
							on:click={() => changeCount(item, -item.changeAmount)}
						>
							Decrease
						</button>
						<button
							class="bg-yellow-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-yellow-500 transition-transform active:scale-95 hover:shadow-lg"
							on:click={() => resetCount(item)}
						>
							Reset
						</button>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>

	<!-- Enhanced Pagination Controls -->
	<div class="pagination-controls mt-6 flex flex-col sm:flex-row justify-between items-center">
		<div class="flex items-center space-x-2 mb-4 sm:mb-0">
			<button
				class="pagination-button"
				on:click={() => goToPage(currentPage - 1)}
				disabled={currentPage === 1}
			>
				Previous
			</button>
			{#each visiblePageNumbers as pageNum}
				{#if pageNum === '...'}
					<span class="pagination-ellipsis">...</span>
				{:else}
					<button
						class="pagination-button"
						class:active={pageNum === currentPage}
						on:click={() => goToPage(pageNum)}
					>
						{pageNum}
					</button>
				{/if}
			{/each}
			<button
				class="pagination-button"
				on:click={() => goToPage(currentPage + 1)}
				disabled={currentPage === totalPages}
			>
				Next
			</button>
		</div>
		<div class="flex items-center space-x-4">
			<select
				bind:value={itemsPerPage}
				on:change={handleItemsPerPageChange}
				class="bg-zinc-700 text-white rounded-lg p-2"
			>
				{#each itemsPerPageOptions as option}
					<option value={option}>{option === 'all' ? 'All' : option} per page</option>
				{/each}
			</select>
		</div>
	</div>

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

	.filter-legend {
		font-size: 0.9rem;
		color: #a0aec0;
	}

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
