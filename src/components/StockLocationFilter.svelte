<script>
	import Icon from './Icon.svelte';
	import { STORAGE_LOCATIONS, locationLabel } from '../lib/stockLocations.js';
	import { getStorageTypeIcon } from '../lib/tableUtils.js';
	let { value = 'all', onchange } = $props();
</script>

<div class="location-filter" role="group" aria-label="Filter by stock location">
	{#each ['all', ...STORAGE_LOCATIONS] as location (location)}
		<button
			type="button"
			class="segment"
			data-location={location}
			aria-pressed={value === location}
			onclick={() => onchange(location)}
		>
			{#if location !== 'all'}
				<Icon name={getStorageTypeIcon(location)} size={14} class="segment-icon" />
			{/if}
			{location === 'all' ? 'All locations' : locationLabel(location)}
		</button>
	{/each}
</div>

<style>
	/* Segmented control: one bordered pill, buttons separated by hairlines, the
	   active segment tinted with its location accent. Height matches the toolbar
	   sort buttons it sits beside. */
	.location-filter {
		display: inline-flex;
		flex-wrap: wrap;
		padding: 0.2rem;
		gap: 0.2rem;
		border: 1.5px solid var(--table-border-color);
		border-radius: 999px;
		background: var(--container-bg);
	}
	.segment {
		--segment-accent: var(--add-item-color);
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		min-height: 2.25rem;
		padding: 0 0.8rem;
		border: 1.5px solid transparent;
		border-radius: 999px;
		color: var(--text-color-dimmed);
		background: transparent;
		cursor: pointer;
		font: inherit;
		font-size: 0.82rem;
		font-weight: 700;
		white-space: nowrap;
		transition:
			background-color 0.15s ease-out,
			color 0.15s ease-out,
			border-color 0.15s ease-out;
	}
	.segment[data-location='Freezer'] {
		--segment-accent: var(--location-freezer);
	}
	.segment[data-location='Refrigerator'] {
		--segment-accent: var(--location-fridge);
	}
	.segment[data-location='Dry Storage'] {
		--segment-accent: var(--location-dry);
	}
	.segment :global(.segment-icon) {
		flex-shrink: 0;
	}
	.segment:hover {
		color: var(--text-color);
		background: var(--hover-bg-color);
	}
	.segment[aria-pressed='true'] {
		color: var(--text-color);
		border-color: color-mix(in srgb, var(--segment-accent) 45%, transparent);
		background: color-mix(in srgb, var(--segment-accent) 14%, var(--container-bg));
	}
	.segment[aria-pressed='true'] :global(.segment-icon) {
		color: var(--segment-accent);
	}
	.segment:focus-visible {
		outline: 2px solid var(--add-item-color);
		outline-offset: 1px;
	}
	.segment:active {
		background: var(--hover-bg-color);
	}
	@media (pointer: coarse) {
		.segment {
			min-height: 2.5rem;
		}
	}
</style>
