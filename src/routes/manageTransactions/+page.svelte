<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { elasticOut } from 'svelte/easing';
	import SearchBar from '../../components/SearchBar.svelte';
	import { fadeAndSlide } from '$lib/transitions';
	import {
		getItems,
		searchItems,
		updateItemCount,
		resetItemCount,
		resetAllCounts
	} from '../../lib/items';
	import type { Item } from '../../types';

	let allItems: Item[] = [];
	let searchValue = '';
	let selectedItem: Item | null = null;

	let currentPage = 1;
	let itemsPerPage = 10;
	let totalPages: number;

	let changeAmount: number = 1;
	let lastChangedItem: string | null = null;

	$: filteredItems = searchValue.trim()
		? allItems.filter((item) => item.name.toLowerCase().includes(searchValue.toLowerCase()))
		: allItems;

	$: totalPages = Math.ceil(filteredItems.length / itemsPerPage);

	$: paginatedItems = getPaginatedItems(filteredItems, currentPage, itemsPerPage);

	function getPaginatedItems(items: Item[], page: number, perPage: number) {
		const start = (page - 1) * perPage;
		const end = start + perPage;
		return items.slice(start, end);
	}

	onMount(async () => {
		allItems = await getItems();
	});

	const handleSearch = (value: string) => {
		searchValue = value;
		currentPage = 1;
	};

	const changeCount = async (item: Item, amount: number) => {
		const newCount = Math.max(0, item.count + amount);
		item.count = newCount;
		await updateItemCount(item.id, newCount);
		updateItems(item);
		lastChangedItem = item.id;
		setTimeout(() => {
			lastChangedItem = null;
		}, 2000);
	};

	const resetCount = async (item: Item) => {
		item.count = 0;
		await resetItemCount(item.id);
		updateItems(item);
		lastChangedItem = item.id;
		setTimeout(() => {
			lastChangedItem = null;
		}, 2000);
	};

	const resetAll = async () => {
		await resetAllCounts();
		allItems = await getItems();
		currentPage = 1;
	};

	const updateItems = (updatedItem: Item) => {
		allItems = allItems.map((item) => (item.id === updatedItem.id ? updatedItem : item));
	};

	const nextPage = () => {
		if (currentPage < totalPages) {
			currentPage++;
		}
	};

	const previousPage = () => {
		if (currentPage > 1) {
			currentPage--;
		}
	};
</script>

<div
	class="container mx-auto p-4 rounded-lg shadow-md bg-container mt-4"
	in:fadeAndSlide={{ duration: 300, y: 75 }}
>
	<SearchBar {searchValue} onSearch={handleSearch} onClear={() => handleSearch('')} />

	<div class="mb-4 mt-4">
		<label for="changeAmount" class="block text-sm font-medium text-gray-400">Change Amount:</label>
		<input
			type="number"
			id="changeAmount"
			bind:value={changeAmount}
			min="1"
			class="mt-1 block w-full rounded-md bg-gray-700 border-gray-600 text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
		/>
	</div>

	<table class="table-auto w-full mt-4 border-collapse">
		<thead class="bg-gray-800 text-gray-400 uppercase text-sm leading-normal">
			<tr>
				<th class="py-3 px-6 text-left">Item Name</th>
				<th class="py-3 px-6 text-center">Count</th>
				<th class="py-3 px-6 text-center">Actions</th>
			</tr>
		</thead>
		<tbody class="text-gray-400 text-sm font-light">
			{#each paginatedItems as item (item.id)}
				<tr class="border-b border-gray-700 hover:bg-gray-800" in:fade={{ duration: 200 }}>
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
						<button
							class="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-500 mr-2 transition-transform active:scale-95"
							on:click={() => changeCount(item, changeAmount)}
						>
							Increase
						</button>
						<button
							class="bg-red-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-500 mr-2 transition-transform active:scale-95"
							on:click={() => changeCount(item, -changeAmount)}
						>
							Decrease
						</button>
						<button
							class="bg-yellow-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-yellow-500 transition-transform active:scale-95"
							on:click={() => resetCount(item)}
						>
							Reset Count
						</button>
					</td>
				</tr>
				{#if lastChangedItem === item.id}
					<tr in:fade={{ duration: 200 }} out:fade={{ duration: 200 }}>
						<td colspan="3" class="py-2 px-6 text-center text-green-400">
							Item count updated successfully!
						</td>
					</tr>
				{/if}
			{/each}
		</tbody>
	</table>

	<!-- Pagination Controls -->
	<div class="flex justify-between items-center mt-6">
		<button
			class="bg-gray-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-600 transition-transform active:scale-95"
			on:click={previousPage}
			disabled={currentPage === 1}
		>
			Previous
		</button>
		<span>Page {currentPage} of {totalPages}</span>
		<button
			class="bg-gray-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-600 transition-transform active:scale-95"
			on:click={nextPage}
			disabled={currentPage === totalPages}
		>
			Next
		</button>
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
</style>
