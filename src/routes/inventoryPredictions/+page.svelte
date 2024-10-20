<script lang="ts">
	import { onMount } from 'svelte';
	import StockPredictions from '../../components/StockPredictions.svelte';
	import { requireAuth } from '$lib/auth';
	import { fade, fly } from 'svelte/transition';
	import { notificationStore } from '../../stores/notificationStore';

	onMount(() => {
		requireAuth('/inventoryPredictions');
	});
</script>

<svelte:head>
	<title>Inventory Predictions - StockSense</title>
</svelte:head>

<div class="inventory-predictions-page">
	<div
		class="container mx-auto p-4 rounded-lg shadow-md bg-container mt-4"
		in:fly={{ y: 50, duration: 300, delay: 300 }}
		out:fade={{ duration: 200 }}
	>
		<h1 class="text-3xl font-bold mb-6" in:fly={{ y: 20, duration: 300, delay: 400 }}>
			Inventory Predictions
		</h1>
		<p class="mb-6 text-lg" in:fly={{ y: 20, duration: 300, delay: 500 }}>
			Welcome to the Inventory Predictions page. Here you can view AI-powered stock level
			predictions based on historical sales data. Use these insights to optimize your inventory
			management and avoid overstocking or stockouts.
		</p>
		<StockPredictions />
	</div>

	{#if $notificationStore}
		<div class="notification" in:fly={{ y: -50, duration: 300 }} out:fade={{ duration: 200 }}>
			{$notificationStore.message}
		</div>
	{/if}
</div>

<style>
	.inventory-predictions-page {
		background-color: var(--background-color);
		min-height: 100vh;
		padding: 1rem;
	}

	.container {
		max-width: 1200px;
		width: 100%;
		background-color: var(--container-bg);
		box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
		border-radius: 1rem;
	}

	.notification {
		position: fixed;
		top: 20px;
		left: 50%;
		transform: translateX(-50%);
		background-color: var(--primary-color);
		color: white;
		padding: 1rem 2rem;
		border-radius: 0.5rem;
		z-index: 1000;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		font-weight: bold;
	}

	@media (max-width: 768px) {
		.container {
			padding: 1.5rem;
		}

		h1 {
			font-size: 2rem;
		}

		p {
			font-size: 1rem;
		}
	}
</style>
