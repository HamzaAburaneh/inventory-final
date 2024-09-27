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

	let items: Item[] = [];
	let searchValue = '';
	let selectedItem: Item | null = null;

	let currentPage = 1;
	let itemsPerPage = 10; // Number of items per page
	let paginatedItems: Item[] = [];

	// Update paginated items whenever the items array changes or page changes
	$: paginatedItems = paginateItems(items);

	onMount(async () => {
		items = await getItems();
	});

	// Handles searching items
	const handleSearch = async (value: string) => {
		searchValue = value;
		if (searchValue.trim()) {
			items = await searchItems(searchValue);
		} else {
			items = await getItems();
		}
		currentPage = 1; // Reset to first page after search
	};

	// Increase item count and update dynamically
	const increaseCount = async (item: Item) => {
		item.count++;
		await updateItemCount(item.id, item.count);
		updateItems(item);
	};

	// Decrease item count and update dynamically
	const decreaseCount = async (item: Item) => {
		if (item.count > 0) {
			item.count--;
			await updateItemCount(item.id, item.count);
			updateItems(item);
		}
	};

	// Reset item count and update dynamically
	const resetCount = async (item: Item) => {
		item.count = 0;
		await resetItemCount(item.id);
		updateItems(item);
	};

	// Reset all counts and refresh items
	const resetAll = async () => {
		await resetAllCounts();
		items = await getItems(); // Refresh items after reset
		currentPage = 1; // Reset to first page
	};

	// Update item in the items array
	const updateItems = (updatedItem: Item) => {
		items = items.map((item) => (item.id === updatedItem.id ? updatedItem : item));
	};

	// Paginate items based on current page and items per page
	const paginateItems = (items: Item[]) => {
		const startIndex = (currentPage - 1) * itemsPerPage;
		const endIndex = startIndex + itemsPerPage;
		return items.slice(startIndex, endIndex);
	};

	// Navigate to next page
	const nextPage = () => {
		if (currentPage * itemsPerPage < items.length) {
			currentPage++;
		}
	};

	// Navigate to previous page
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
			{#each paginatedItems as item}
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
		<span>Page {currentPage}</span>
		<button
			class="bg-gray-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-600"
			on:click={nextPage}
			disabled={currentPage * itemsPerPage >= items.length}
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
