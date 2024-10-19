<script lang="ts">
	import { onMount } from 'svelte';
	import StockPredictions from '../../components/StockPredictions.svelte';
	import { requireAuth } from '$lib/auth';
	import { fadeAndSlide } from '$lib/transitions';
	import { notificationStore } from '../../stores/notificationStore';
	import { fade } from 'svelte/transition';

	let itemsLoaded = false;

	onMount(async () => {
		requireAuth('/inventoryPredictions');
		// Simulate loading time (remove this in production)
		await new Promise((resolve) => setTimeout(resolve, 500));
		itemsLoaded = true;
	});
</script>

<svelte:head>
	<title>Inventory Predictions - StockSense</title>
</svelte:head>

{#if itemsLoaded}
	<div
		class="container mx-auto p-4 rounded-lg shadow-md bg-container mt-4"
		in:fadeAndSlide={{ duration: 300, y: 75 }}
	>
		<h1 class="text-3xl font-bold mb-6">Inventory Predictions</h1>
		<p class="mb-4">
			Welcome to the Inventory Predictions page. Here you can view AI-powered stock level
			predictions based on historical sales data. Use these insights to optimize your inventory
			management and avoid overstocking or stockouts.
		</p>
		<StockPredictions />
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
</style>
