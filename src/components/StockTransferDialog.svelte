<script>
	import Icon from './Icon.svelte';
	import { inspectItemStock, locationLabel } from '../lib/stockLocations.js';
	import { getStorageTypeIcon } from '../lib/tableUtils.js';
	let { item, ontransfer, onclose } = $props();
	let from = $state('Freezer');
	let quantity = $state('');
	let busy = $state(false);
	let error = $state('');
	const to = $derived(from === 'Freezer' ? 'Refrigerator' : 'Freezer');
	const stock = $derived(inspectItemStock(item));
	const amount = $derived(Number(quantity));
	const valid = $derived(
		!stock.error &&
			Number.isSafeInteger(amount) &&
			amount > 0 &&
			amount <= stock.stockByStorage[from]
	);
	const directions = [
		['Freezer', 'Refrigerator'],
		['Refrigerator', 'Freezer']
	];
	function openDialog(node) {
		const opener = document.activeElement;
		node.showModal();
		return () => {
			node.close();
			if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
		};
	}
	// A click on the dimmed backdrop cancels, like Escape. The backdrop reports the
	// dialog itself as its target, so use the card's bounds to tell a backdrop
	// click apart from one on the card's own padding.
	function onBackdropClick(event) {
		if (busy || event.target !== event.currentTarget) return;
		const box = event.currentTarget.getBoundingClientRect();
		const inside =
			event.clientX >= box.left &&
			event.clientX <= box.right &&
			event.clientY >= box.top &&
			event.clientY <= box.bottom;
		if (!inside) onclose();
	}
	async function submit(event) {
		event.preventDefault();
		if (busy || !valid) return;
		busy = true;
		error = '';
		try {
			const result = await ontransfer(item.id, from, to, amount);
			if (result?.status === 'applied' || result?.status === 'queued') onclose();
			else error = result?.error || 'Transfer needs attention. Review pending changes.';
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Could not save the transfer.';
		} finally {
			busy = false;
		}
	}
</script>

<dialog
	{@attach openDialog}
	aria-labelledby="stock-transfer-title"
	onclick={onBackdropClick}
	oncancel={(event) => {
		event.preventDefault();
		if (!busy) onclose();
	}}
>
	<form onsubmit={submit}>
		<div class="modal-head">
			<span class="modal-icon" aria-hidden="true"><Icon name="transfer" size={18} /></span>
			<div>
				<h2 id="stock-transfer-title">Transfer stock</h2>
				<p class="subtitle">{item.name} · Total {stock.total}</p>
			</div>
		</div>

		<div class="direction" role="group" aria-label="Transfer direction">
			{#each directions as [source, target] (source)}
				<button
					type="button"
					class="direction-btn"
					aria-pressed={from === source}
					disabled={busy}
					onclick={() => (from = source)}
				>
					<Icon name={getStorageTypeIcon(source)} size={14} />
					{locationLabel(source)}
					<span class="arrow" aria-hidden="true">→</span>
					<Icon name={getStorageTypeIcon(target)} size={14} />
					{locationLabel(target)}
				</button>
			{/each}
		</div>

		<div class="field">
			<label for="transfer-quantity">Quantity ({stock.stockByStorage[from]} available)</label>
			<input
				id="transfer-quantity"
				type="number"
				min="1"
				max={stock.stockByStorage[from]}
				step="1"
				inputmode="numeric"
				placeholder="0"
				bind:value={quantity}
				disabled={busy}
				required
			/>
		</div>

		{#if valid}
			<div class="preview">
				<div class="preview-cell" data-location={from}>
					<span class="preview-label">
						<Icon name={getStorageTypeIcon(from)} size={13} class="preview-icon" />
						{locationLabel(from)}
					</span>
					<span class="preview-change">
						{stock.stockByStorage[from]}
						<span class="arrow" aria-hidden="true">→</span>
						<strong>{stock.stockByStorage[from] - amount}</strong>
					</span>
				</div>
				<div class="preview-cell" data-location={to}>
					<span class="preview-label">
						<Icon name={getStorageTypeIcon(to)} size={13} class="preview-icon" />
						{locationLabel(to)}
					</span>
					<span class="preview-change">
						{stock.stockByStorage[to]}
						<span class="arrow" aria-hidden="true">→</span>
						<strong>{stock.stockByStorage[to] + amount}</strong>
					</span>
				</div>
				<p class="preview-total">Total stays {stock.total}.</p>
			</div>
		{/if}
		{#if quantity !== '' && !valid}
			<p class="error">Enter a positive whole quantity within the source balance.</p>
		{/if}
		{#if stock.error || error}<p class="error" role="alert">{stock.error || error}</p>{/if}
		<p class="hint">Moves stock between storage locations. This is not an issue to a booth.</p>

		<div class="actions">
			<button type="button" class="secondary" disabled={busy} onclick={onclose}>Cancel</button>
			<button class="primary" type="submit" disabled={busy || !valid}>
				{busy ? 'Saving…' : 'Transfer'}
			</button>
		</div>
	</form>
</dialog>

<style>
	dialog {
		margin: auto;
		color: var(--text-color);
		background: var(--container-bg);
		border: 1px solid var(--table-border-color);
		border-radius: 0.75rem;
		box-shadow: var(--nav-dropdown-shadow);
		padding: 1.5rem;
		width: min(26rem, calc(100vw - 2rem));
		max-height: calc(100dvh - 2rem);
		overflow-y: auto;
	}
	dialog::backdrop {
		background: var(--modal-backdrop);
	}
	form {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}
	h2,
	p {
		margin: 0;
	}
	.modal-head {
		display: flex;
		align-items: center;
		gap: 0.65rem;
	}
	.modal-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 2rem;
		height: 2rem;
		border-radius: 0.5rem;
		font-size: 1.1rem;
		color: var(--add-item-color);
		background: color-mix(in srgb, var(--add-item-color) 16%, transparent);
	}
	h2 {
		font-size: 1.15rem;
		font-weight: 700;
	}
	.subtitle {
		color: var(--text-color-dimmed);
		font-size: 0.82rem;
		font-weight: 600;
	}
	.direction {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.4rem;
	}
	.direction-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-wrap: wrap;
		gap: 0.3rem;
		min-height: 2.5rem;
		padding: 0.4rem 0.5rem;
		border: 1.5px solid var(--table-border-color);
		border-radius: var(--border-radius);
		color: var(--text-color-dimmed);
		background: var(--container-bg);
		font: inherit;
		font-size: 0.8rem;
		font-weight: 700;
		cursor: pointer;
		transition:
			background-color 0.15s ease-out,
			color 0.15s ease-out,
			border-color 0.15s ease-out;
	}
	.direction-btn:hover:not(:disabled) {
		background: var(--hover-bg-color);
		color: var(--text-color);
	}
	.direction-btn[aria-pressed='true'] {
		color: var(--add-item-color);
		border-color: var(--add-item-color);
		background: color-mix(in srgb, var(--add-item-color) 10%, var(--container-bg));
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}
	label {
		font-size: 0.78rem;
		font-weight: 700;
		color: var(--text-color);
	}
	input {
		min-height: 2.5rem;
		padding: 0.5rem 0.75rem;
		transition: border-color 0.15s ease-out;
		border: 1.5px solid var(--input-border-color, var(--table-border-color));
		border-radius: var(--border-radius);
		color: var(--text-color);
		background: var(--input-bg, var(--container-bg));
		font: inherit;
		font-size: 1rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	input::placeholder {
		color: var(--placeholder-text);
		font-weight: 500;
	}
	/* Before → after per location, side by side. */
	.preview {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.4rem;
		padding: 0.6rem;
		border-radius: 0.5rem;
		background: var(--hover-bg-color);
		border: 1px solid var(--table-border-color);
	}
	.preview-cell {
		--cell-accent: var(--text-color-dimmed);
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		padding: 0.5rem 0.65rem;
		border-radius: 0.4rem;
		background: color-mix(in srgb, var(--cell-accent) 10%, var(--container-bg));
		border: 1px solid color-mix(in srgb, var(--cell-accent) 30%, transparent);
	}
	.preview-cell[data-location='Freezer'] {
		--cell-accent: var(--location-freezer);
	}
	.preview-cell[data-location='Refrigerator'] {
		--cell-accent: var(--location-fridge);
	}
	.preview-label {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.74rem;
		font-weight: 700;
		color: var(--text-color-dimmed);
	}
	.preview-label :global(.preview-icon) {
		color: var(--cell-accent);
	}
	.preview-change {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.95rem;
		font-variant-numeric: tabular-nums;
		color: var(--text-color-dimmed);
	}
	.arrow {
		font-size: 0.85em;
		opacity: 0.7;
	}
	.preview-change strong {
		color: var(--text-color);
		font-weight: 800;
	}
	.preview-total {
		grid-column: 1 / -1;
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--text-color-dimmed);
		text-align: center;
	}
	.hint {
		color: var(--text-color-dimmed);
		font-size: 0.8rem;
	}
	.error {
		color: var(--event-remove);
		font-size: 0.85rem;
		font-weight: 600;
	}
	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		margin-top: 0.25rem;
	}
	.actions button {
		min-height: 2.5rem;
		padding: 0.5rem 1rem;
		border-radius: var(--border-radius);
		font: inherit;
		font-size: 0.9rem;
		font-weight: 700;
		cursor: pointer;
		transition:
			background-color 0.15s ease-out,
			filter 0.15s ease-out;
	}
	.secondary {
		color: var(--text-color);
		background: transparent;
		border: 1.5px solid var(--table-border-color);
	}
	.secondary:hover:not(:disabled) {
		background: var(--hover-bg-color);
	}
	.primary {
		color: var(--add-item-on);
		background: var(--add-item-color);
		border: 1.5px solid var(--add-item-color);
	}
	.primary:hover:not(:disabled) {
		filter: brightness(1.08);
	}
	button:disabled,
	input:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	button:focus-visible,
	input:focus-visible {
		outline: 2px solid var(--add-item-color);
		outline-offset: 2px;
	}
	@media (pointer: coarse) {
		.direction-btn,
		.actions button,
		input {
			min-height: 2.75rem;
		}
	}
	/* Direction labels need ~150px each; stack them on narrow phones while the
	   shorter before/after cells stay side by side until very small widths. */
	@media (max-width: 430px) {
		.direction {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 340px) {
		.preview {
			grid-template-columns: 1fr;
		}
	}
</style>
