<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { elasticOut } from 'svelte/easing';
	import SearchBar from '../../components/SearchBar.svelte';
	import { fadeAndSlide } from '$lib/transitions';
	import { getItems, updateItemCount, resetItemCount, resetAllCounts } from '../../lib/items';
	import type { Item } from '../../types';

	let allItems: Item[] = [];
	let searchValue = '';
	let selectedItem: Item | null = null;

	let currentPage = 1;
	let itemsPerPage = 10;
	let totalPages: number;

	// Remove the global changeAmount variable

	// New variables for global notification
	let notificationMessage = '';
	let showNotification = false;

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
		// Initialize changeAmount for each item
		allItems = allItems.map((item) => ({ ...item, changeAmount: 0 }));
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

		// Set notification message
		notificationMessage = `Count for "${item.name}" updated successfully!`;
		showNotification = true;
		setTimeout(() => {
			showNotification = false;
			notificationMessage = '';
		}, 3000);
	};

	const resetCount = async (item: Item) => {
		item.count = 0;
		await resetItemCount(item.id);
		updateItems(item);

		// Set notification message
		notificationMessage = `Count for "${item.name}" reset successfully!`;
		showNotification = true;
		setTimeout(() => {
			showNotification = false;
			notificationMessage = '';
		}, 3000);
	};

	const resetAll = async () => {
		await resetAllCounts();
		allItems = await getItems();
		// Reset changeAmount for each item
		allItems = allItems.map((item) => ({ ...item, changeAmount: 0 }));
		currentPage = 1;

		// Set notification message
		notificationMessage = 'All counts have been reset successfully!';
		showNotification = true;
		setTimeout(() => {
			showNotification = false;
			notificationMessage = '';
		}, 3000);
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
	<!-- Global Notification -->
	{#if showNotification}
		<div class="notification" in:fade out:fade>
			{notificationMessage}
		</div>
	{/if}

	<!-- Search Bar -->
	<SearchBar {searchValue} onSearch={handleSearch} onClear={() => handleSearch('')} />

	<!-- Table -->
	<table class="table-auto w-full mt-4 border-collapse">
		<thead class="bg-zinc-800 text-white uppercase text-sm leading-normal">
			<tr>
				<th class="py-3 px-6 text-left">Item Name</th>
				<th class="py-3 px-6 text-center">Count</th>
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
					<!-- Change Amount input for each row -->
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

	<!-- Pagination Controls -->
	<div class="flex justify-between items-center mt-6">
		<button
			class="bg-zinc-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-zinc-600 transition-transform active:scale-95"
			on:click={previousPage}
			disabled={currentPage === 1}
		>
			Previous
		</button>
		<span>Page {currentPage} of {totalPages}</span>
		<button
			class="bg-zinc-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-zinc-600 transition-transform active:scale-95"
			on:click={nextPage}
			disabled={currentPage === totalPages}
		>
			Next
		</button>
	</div>

	<!-- Reset All Counts Button -->
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

	/* Global Notification Styles */
	.notification {
		position: fixed;
		top: 20px;
		left: 50%;
		transform: translateX(-50%);
		background-color: #38a169; /* Green background */
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
</style>
