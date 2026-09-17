<script>
	import { fade, fly } from 'svelte/transition';
	import { flip } from 'svelte/animate';
	import { cubicOut } from 'svelte/easing';
	import { prefersReducedMotion } from 'svelte/motion';
	import Icon from './Icon.svelte';
	import AnimatedCount from './AnimatedCount.svelte';
	import { emptyStockLocation, inspectItemStock, locationLabel } from '../lib/stockLocations.js';
	import { getStorageTypeIcon } from '../lib/tableUtils.js';
	let { item } = $props();
	// Chips appear with the app's soft rise as a location fills and fade as it
	// empties; survivors slide into the freed space instead of jumping.
	const ms = (base) => (prefersReducedMotion.current ? 0 : base);
	const stock = $derived(inspectItemStock(item));
	const occupied = $derived(
		stock.locations.filter((location) => stock.stockByStorage[location] > 0)
	);
	// An empty item keeps its starting location visible (and filterable) at 0.
	const emptyLocation = $derived(emptyStockLocation(item));
</script>

<div class="stock-chips">
	{#if stock.error}
		<span class="stock-error" title={stock.error}>
			<i class="ti ti-alert-triangle" aria-hidden="true"></i>
			Check stock
		</span>
	{:else if emptyLocation}
		<span
			class="stock-chip empty"
			data-location={emptyLocation}
			title="No stock in any location"
			in:fade={{ duration: ms(200), delay: ms(120) }}
		>
			<Icon name={getStorageTypeIcon(emptyLocation)} size={13} class="chip-icon" />
			{locationLabel(emptyLocation)}
			<strong>0</strong>
		</span>
	{:else}
		{#each occupied as location (location)}
			<span
				class="stock-chip"
				data-location={location}
				in:fly={{ y: 6, duration: ms(220), easing: cubicOut }}
				out:fade={{ duration: ms(150) }}
				animate:flip={{ duration: ms(220), easing: cubicOut }}
			>
				<Icon name={getStorageTypeIcon(location)} size={13} class="chip-icon" />
				{locationLabel(location)}
				<strong><AnimatedCount value={stock.stockByStorage[location]} /></strong>
			</span>
		{/each}
	{/if}
</div>

<style>
	.stock-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}
	.stock-chip {
		--chip-accent: var(--text-color-dimmed);
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.2rem 0.6rem 0.2rem 0.5rem;
		border: 1px solid color-mix(in srgb, var(--chip-accent) 35%, transparent);
		border-radius: 999px;
		color: var(--text-color);
		background: color-mix(in srgb, var(--chip-accent) 12%, var(--container-bg));
		font-size: 0.76rem;
		font-weight: 600;
		white-space: nowrap;
		line-height: 1.3;
	}
	.stock-chip[data-location='Freezer'] {
		--chip-accent: var(--location-freezer);
	}
	.stock-chip[data-location='Refrigerator'] {
		--chip-accent: var(--location-fridge);
	}
	.stock-chip[data-location='Dry Storage'] {
		--chip-accent: var(--location-dry);
	}
	.stock-chip :global(.chip-icon) {
		color: var(--chip-accent);
		flex-shrink: 0;
	}
	strong {
		font-weight: 800;
		font-variant-numeric: tabular-nums;
	}
	.stock-chip.empty {
		color: var(--text-color-dimmed);
		background: transparent;
		border-style: dashed;
		font-weight: 500;
	}
	.stock-chip.empty :global(.chip-icon),
	.stock-chip.empty strong {
		opacity: 0.7;
	}
	.stock-error {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		color: var(--event-remove);
		font-size: 0.78rem;
		font-weight: 600;
		white-space: nowrap;
	}
</style>
