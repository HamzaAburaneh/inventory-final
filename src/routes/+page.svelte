<script>
	import { fade, fly } from 'svelte/transition';

	let showFeatures = false;
</script>

<main class="container mx-auto px-4 py-8">
	<h1 class="text-4xl font-bold mb-6 text-center" in:fade={{ duration: 300 }}>
		Welcome to StockSense
	</h1>
	<p class="text-xl mb-8 text-center" in:fade={{ duration: 300, delay: 150 }}>
		Your intelligent inventory management solution
	</p>

	<div class="mb-12 text-center">
		<button
			class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition duration-300 ease-in-out transform hover:scale-105"
			on:click={() => (showFeatures = !showFeatures)}
		>
			{showFeatures ? 'Hide' : 'Show'} Key Features
		</button>
	</div>

	{#if showFeatures}
		<div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12" in:fade={{ duration: 300 }}>
			{#each ['Real-time Tracking', 'Smart Analytics', 'Easy Management', 'Secure Data'] as feature, i}
				<div
					in:fly={{ y: 50, delay: i * 100 }}
					class="bg-container-bg p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300"
				>
					<h3 class="text-xl font-semibold mb-3">{feature}</h3>
					<p class="text-input-text">
						Streamline your inventory processes with our advanced {feature.toLowerCase()} capabilities.
					</p>
				</div>
			{/each}
		</div>
	{/if}

	<div class="text-center">
		<a
			href="/login"
			class="bg-add-item-color hover:bg-green-600 text-white font-bold py-3 px-6 rounded-full text-lg transition-all duration-300 ease-in-out transform hover:scale-105 inline-block"
		>
			Get Started
		</a>
	</div>
</main>

<style>
	:global(body) {
		background-color: var(--background-color);
		color: var(--text-color);
	}

	main {
		max-width: 1200px;
	}

	.bg-container-bg {
		background-color: var(--container-bg);
	}

	.bg-add-item-color {
		background-color: var(--add-item-color);
	}

	.text-input-text {
		color: var(--input-text);
	}
</style>
