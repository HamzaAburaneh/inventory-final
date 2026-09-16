<script>
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { prefersReducedMotion } from 'svelte/motion';
	import Icon from './Icon.svelte';
	import AnimatedCount from './AnimatedCount.svelte';
	import { inspectItemStock, locationLabel } from '../lib/stockLocations.js';
	import { getStorageTypeIcon } from '../lib/tableUtils.js';
	let { item, onchange, ontransfer, onreset } = $props();
	let amounts = $state({});
	let busy = $state(false);
	let error = $state('');
	// The change a click just sent, shown beside the confirmed balance until that
	// balance rolls over (or the action ends up queued/needing attention). It gives
	// instant feedback without displaying an unconfirmed number as the balance.
	// Raw state keeps object identity, so `inflight === sent` checks below hold.
	let inflight = $state.raw(null);
	const stock = $derived(inspectItemStock(item));
	const ghost = $derived(
		inflight && stock.stockByStorage[inflight.location] === inflight.base ? inflight : null
	);
	const ms = (base) => (prefersReducedMotion.current ? 0 : base);
	const canAdjust = (location) => {
		const amount = Number(amounts[location]);
		return !busy && Number.isSafeInteger(amount) && amount > 0;
	};
	async function adjust(location, sign) {
		if (busy) return;
		const amount = Number(amounts[location]);
		if (!Number.isSafeInteger(amount) || amount <= 0) return;
		busy = true;
		error = '';
		const sent = { location, delta: amount * sign, base: stock.stockByStorage[location] };
		inflight = sent;
		// Safety net: if the confirmed balance never moves (a concurrent change netted
		// it out), do not leave the ghost hanging around.
		const expire = setTimeout(() => {
			if (inflight === sent) inflight = null;
		}, 4000);
		try {
			const result = await onchange(item, amount * sign, location);
			if (result?.status === 'applied' || result?.status === 'queued') amounts[location] = '';
			else error = result?.error || 'This change needs attention. Review the pending changes.';
			if (result?.status !== 'applied' && inflight === sent) inflight = null;
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Could not save the change.';
			if (inflight === sent) inflight = null;
		} finally {
			busy = false;
			if (inflight !== sent) clearTimeout(expire);
		}
	}
</script>

<div class="location-controls">
	{#if stock.error}
		<p class="error" role="alert">{stock.error}</p>
	{:else}
		<div class="rows">
			{#each stock.locations as location (location)}
				<div class="location-row" data-location={location}>
					<span class="location-name">
						<Icon name={getStorageTypeIcon(location)} size={14} class="location-icon" />
						<span class="label">{locationLabel(location)}</span>
						<strong><AnimatedCount value={stock.stockByStorage[location]} /></strong>
						{#if ghost?.location === location}
							<span
								class="ghost"
								class:ghost-minus={ghost.delta < 0}
								aria-hidden="true"
								in:fly={{ y: 6, duration: ms(180), easing: cubicOut }}
								out:fly={{ y: -6, duration: ms(220), easing: cubicOut }}
							>
								{ghost.delta > 0 ? '+' : '−'}{Math.abs(ghost.delta)}
							</span>
						{/if}
					</span>
					<div class="adjuster" class:busy={busy && inflight?.location === location}>
						<button
							type="button"
							class="adj-btn adj-minus"
							disabled={!canAdjust(location)}
							aria-label="Remove from {locationLabel(location)} for {item.name}"
							onclick={() => adjust(location, -1)}>−</button
						>
						<input
							type="number"
							min="1"
							step="1"
							inputmode="numeric"
							placeholder="0"
							bind:value={amounts[location]}
							aria-label="Amount for {item.name} in {locationLabel(location)}"
							disabled={busy}
						/>
						<button
							type="button"
							class="adj-btn adj-plus"
							disabled={!canAdjust(location)}
							aria-label="Add to {locationLabel(location)} for {item.name}"
							onclick={() => adjust(location, 1)}>+</button
						>
					</div>
				</div>
			{/each}
		</div>
		<div class="item-actions">
			{#if stock.locations.length === 2}
				<button
					type="button"
					class="icon-btn"
					disabled={busy}
					aria-label="Transfer stock"
					title="Transfer between Freezer and Fridge"
					onclick={() => ontransfer(item)}
				>
					<Icon name="transfer" size={16} />
				</button>
			{/if}
			<button
				type="button"
				class="icon-btn icon-btn-reset"
				disabled={busy || stock.total === 0}
				aria-label="Reset all locations"
				title="Reset all locations to 0"
				onclick={() => onreset(item)}
			>
				<i class="ti ti-rotate-clockwise" aria-hidden="true"></i>
			</button>
		</div>
	{/if}
	{#if error}<p class="error" role="alert">{error}</p>{/if}
</div>

<style>
	/* Compact per-location rows with a shared actions column on the right.
	   Desktop targets are 36px; coarse pointers get 44px. */
	.location-controls {
		--control-size: 2.25rem;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 0.75rem;
		width: 100%;
	}
	.rows {
		flex: 1 1 14rem;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.location-row {
		--row-accent: var(--text-color-dimmed);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.location-row[data-location='Freezer'] {
		--row-accent: var(--location-freezer);
	}
	.location-row[data-location='Refrigerator'] {
		--row-accent: var(--location-fridge);
	}
	.location-row[data-location='Dry Storage'] {
		--row-accent: var(--location-dry);
	}
	.location-name {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		min-width: 0;
		color: var(--text-color-dimmed);
		font-size: 0.8rem;
		font-weight: 600;
	}
	.location-name :global(.location-icon) {
		color: var(--row-accent);
		flex-shrink: 0;
	}
	.label {
		white-space: nowrap;
	}
	strong {
		color: var(--text-color);
		font-size: 0.9rem;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
	}
	.ghost {
		display: inline-block;
		padding: 0 0.35rem;
		border-radius: 999px;
		color: var(--event-add);
		background: var(--event-add-bg);
		font-size: 0.72rem;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		line-height: 1.4;
	}
	.ghost-minus {
		color: var(--event-remove);
		background: var(--event-remove-bg);
	}
	.adjuster {
		display: inline-flex;
		align-items: stretch;
		flex-shrink: 0;
		height: var(--control-size);
		border: 1.5px solid var(--table-border-color);
		border-radius: 999px;
		overflow: hidden;
		background: var(--hover-bg-color);
		transition: border-color 0.2s ease-out;
	}
	/* While a change is saving, the pill's border picks up the accent so the
	   press reads as "sending" until the balance rolls over. */
	.adjuster.busy {
		border-color: var(--add-item-color);
	}
	/* min-height/padding reset the global button rule so the pill keeps its height. */
	.adj-btn {
		width: var(--control-size);
		min-height: 0;
		padding: 0;
		border: none;
		background: transparent;
		color: var(--text-color);
		font: inherit;
		font-size: 1.15rem;
		font-weight: 700;
		line-height: 1;
		cursor: pointer;
		transition:
			background-color 0.12s ease-out,
			color 0.12s ease-out,
			transform 0.1s ease-out;
	}
	.adj-minus:hover:not(:disabled) {
		background: var(--event-remove-bg);
		color: var(--event-remove);
	}
	.adj-plus:hover:not(:disabled) {
		background: var(--event-add-bg);
		color: var(--event-add);
	}
	/* Overrides the global input rule (44px min-height, padding, radius, slow
	   transition) so the field fits inside the pill. */
	input {
		width: 3.5rem;
		min-width: 0;
		min-height: 0;
		padding: 0;
		border: none;
		border-left: 1px solid var(--table-border-color);
		border-right: 1px solid var(--table-border-color);
		border-radius: 0;
		background: var(--container-bg);
		color: var(--text-color);
		font: inherit;
		font-size: 0.9rem;
		font-weight: 700;
		text-align: center;
		appearance: textfield;
		font-variant-numeric: tabular-nums;
		transition: background-color 0.12s ease-out;
	}
	input:hover:not(:disabled) {
		background: var(--container-bg);
	}
	input::-webkit-inner-spin-button,
	input::-webkit-outer-spin-button {
		appearance: none;
		margin: 0;
	}
	input::placeholder {
		color: var(--placeholder-text);
		font-weight: 500;
	}
	.item-actions {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		flex-shrink: 0;
	}
	.icon-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: var(--control-size);
		height: var(--control-size);
		min-height: 0;
		padding: 0;
		border: 1.5px solid var(--table-border-color);
		border-radius: 999px;
		color: var(--text-color-dimmed);
		background: var(--container-bg);
		font-size: 1rem;
		cursor: pointer;
		transition:
			background-color 0.12s ease-out,
			color 0.12s ease-out,
			border-color 0.12s ease-out;
	}
	.icon-btn:hover:not(:disabled) {
		color: var(--add-item-color);
		border-color: var(--add-item-color);
		background: color-mix(in srgb, var(--add-item-color) 10%, var(--container-bg));
	}
	.icon-btn-reset:hover:not(:disabled) {
		color: var(--event-remove);
		border-color: var(--event-remove);
		background: var(--event-remove-bg);
	}
	.adj-btn:disabled,
	.icon-btn:disabled,
	input:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	/* While saving, the pill stays solid instead of greying out: the accent
	   border and the delta ghost already say "working", and the grey flash
	   before the number rolled read as a stall. */
	.adjuster.busy input:disabled,
	.adjuster.busy .adj-btn:disabled {
		opacity: 1;
		cursor: progress;
	}
	@media (prefers-reduced-motion: no-preference) {
		.adj-btn:active:not(:disabled) {
			transform: scale(0.88);
		}
	}
	.adj-btn:focus-visible,
	.icon-btn:focus-visible,
	input:focus-visible {
		outline: 2px solid var(--add-item-color);
		outline-offset: -2px;
	}
	.error {
		flex: 0 0 100%;
		color: var(--event-remove);
		margin: 0;
		font-size: 0.8rem;
	}
	@media (pointer: coarse) {
		.location-controls {
			--control-size: 2.75rem;
		}
		input {
			width: 4rem;
		}
	}
	@media (max-width: 640px) {
		.item-actions {
			flex-direction: row;
		}
	}
</style>
