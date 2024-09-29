<script lang="ts">
	import { onMount } from 'svelte';
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
		currentPage = 1; // Reset to first page after search
	};

	const increaseCount = async (item: Item) => {
		item.count++;
		await updateItemCount(item.id, item.count);
		updateItems(item);
	};

	const decreaseCount = async (item: Item) => {
		if (item.count > 0) {
			item.count--;
			await updateItemCount(item.id, item.count);
			updateItems(item);
		}
	};

	const resetCount = async (item: Item) => {
		item.count = 0;
		await resetItemCount(item.id);
		updateItems(item);
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
				<tr class="border-b border-gray-700 hover:bg-gray-800">
					<td class="py-3 px-6 text-left whitespace-nowrap">{item.name}</td>
					<td class="py-3 px-6 text-center">{item.count}</td>
					<td class="py-3 px-6 text-center">
						<button
							class="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-500 mr-2"
							on:click={() => increaseCount(item)}
						>
							Increase
						</button>
						<button
							class="bg-red-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-500 mr-2"
							on:click={() => decreaseCount(item)}
						>
							Decrease
						</button>
						<button
							class="bg-yellow-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-yellow-500"
							on:click={() => resetCount(item)}
						>
							Reset Count
						</button>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>

	<!-- Pagination Controls -->
	<div class="flex justify-between items-center mt-6">
		<button
			class="bg-gray-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-600"
			on:click={previousPage}
			disabled={currentPage === 1}
		>
			Previous
		</button>
		<span>Page {currentPage} of {totalPages}</span>
		<button
			class="bg-gray-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-600"
			on:click={nextPage}
			disabled={currentPage === totalPages}
		>
			Next
		</button>
	</div>

	<div class="flex justify-center mt-6">
		<button
			class="bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-500"
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
	/* Dark Mode Button Styles */
	button {
		transition: background-color 0.3s ease;
	}

	button[disabled] {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
