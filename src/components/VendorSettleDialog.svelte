<script>
	import { untrack } from 'svelte';
	import { inspectItemStock, locationLabel } from '../lib/stockLocations.js';
	import { centsToInput, formatCents, loanBalance, toCents } from '../lib/vendorBalances.js';

	// One follow-up on an existing loan. `mode` is 'return' (product back),
	// 'cash', 'correction' or 'review'; `item` is the loan's current inventory
	// item, or null for a free-text product. Like VendorLoanDialog, the operation
	// ID is fixed while the dialog is open, so saving again cannot apply twice.
	let { loan, item = null, mode, onsave, onclose } = $props();

	const operationId = crypto.randomUUID();

	let quantity = $state('');
	let amount = $state('');
	let amountEdited = $state(false);
	let location = $state('');
	let note = $state('');
	let busy = $state(false);
	let error = $state('');

	const balance = $derived(loanBalance(loan));
	const stock = $derived(item ? inspectItemStock(item) : null);
	const movesStock = $derived(mode === 'return' && Boolean(loan.itemId));
	// Product coming back into our storage when we lent it; leaving when we borrowed it.
	const inward = $derived(loan.direction === 'lent');
	const units = $derived(Number(quantity));
	const unitsValid = $derived(
		mode === 'correction'
			? Number.isSafeInteger(units) &&
					units !== 0 &&
					balance.owed + units >= Math.max(balance.settled, 1)
			: Number.isSafeInteger(units) && units > 0 && units <= balance.outstanding
	);
	const suggested = $derived(
		loan.unitPriceCents != null && unitsValid ? units * loan.unitPriceCents : null
	);
	const amountCents = $derived.by(() => {
		if (!amountEdited && suggested != null) return suggested;
		try {
			return toCents(amount);
		} catch {
			return undefined;
		}
	});
	const available = $derived(stock && location ? stock.stockByStorage[location] : 0);
	const stockOk = $derived(
		!movesStock || (Boolean(stock) && !stock.error && location && (inward || units <= available))
	);
	const valid = $derived(
		mode === 'review' ||
			(unitsValid &&
				stockOk &&
				(mode !== 'cash' || amountCents !== undefined) &&
				(mode !== 'correction' || Boolean(note.trim())))
	);

	const titles = $derived({
		return: inward ? 'Product returned to us' : 'Product returned to them',
		cash: inward ? 'Cash received' : 'Cash paid',
		correction: 'Correct what is owed',
		review: 'Mark as reviewed'
	});
	const icons = {
		return: 'fa-box',
		cash: 'fa-money-bill-wave',
		correction: 'fa-pen',
		review: 'fa-check'
	};

	// Pre-select where the product most likely goes: a location that has some when
	// it leaves, the first location when it comes back. Chosen once, on open.
	function initialLocation() {
		if (!stock || stock.error) return '';
		if (!inward)
			return (
				stock.locations.find((key) => stock.stockByStorage[key] > 0) ?? stock.locations[0] ?? ''
			);
		return stock.locations[0] ?? '';
	}

	function presetLocation() {
		location = initialLocation();
	}

	function openDialog(node) {
		const opener = document.activeElement;
		// Untracked: the item updates live, and that must not reopen the dialog.
		untrack(presetLocation);
		node.showModal();
		return () => {
			node.close();
			if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
		};
	}

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
			await onsave(
				{
					kind: mode,
					loanId: loan.id,
					...(mode === 'review' ? {} : { quantity: units }),
					...(mode === 'cash' ? { amountCents } : {}),
					...(movesStock ? { location } : {}),
					note
				},
				operationId
			);
			onclose();
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Could not save this.';
		} finally {
			busy = false;
		}
	}
</script>

<dialog
	{@attach openDialog}
	aria-labelledby="vendor-settle-title"
	onclick={onBackdropClick}
	oncancel={(event) => {
		event.preventDefault();
		if (!busy) onclose();
	}}
>
	<form onsubmit={submit}>
		<div class="modal-head">
			<span class="modal-icon" aria-hidden="true"><i class="fas {icons[mode]}"></i></span>
			<div>
				<h2 id="vendor-settle-title">{titles[mode]}</h2>
				<p class="subtitle">
					{loan.productName} · {loan.vendorName} · {balance.outstanding} of {balance.owed} outstanding
				</p>
			</div>
		</div>

		{#if mode === 'review'}
			<p class="hint">
				Confirms you have checked this loan. It doesn't change stock or what's owed. Any later
				change sends it back to Needs review.
			</p>
		{:else}
			<div class="field">
				<label for="settle-quantity">
					{#if mode === 'correction'}
						Change to units owed (e.g. 2 or -1)
					{:else if mode === 'cash'}
						Units this payment settles (up to {balance.outstanding})
					{:else}
						Units returned (up to {balance.outstanding})
					{/if}
				</label>
				<input
					id="settle-quantity"
					type="number"
					step="1"
					min={mode === 'correction' ? undefined : 1}
					max={mode === 'correction' ? undefined : balance.outstanding}
					inputmode="numeric"
					placeholder="0"
					bind:value={quantity}
					disabled={busy}
					required
				/>
			</div>
		{/if}

		{#if mode === 'cash'}
			<div class="field">
				<label for="settle-amount">
					Amount{#if loan.unitPriceCents != null}
						· {formatCents(loan.unitPriceCents)} per unit{/if}
				</label>
				<div class="money">
					<span aria-hidden="true">$</span>
					<input
						id="settle-amount"
						type="text"
						inputmode="decimal"
						autocomplete="off"
						placeholder="0.00"
						value={amountEdited || suggested == null ? amount : centsToInput(suggested)}
						oninput={(event) => {
							amountEdited = true;
							amount = event.currentTarget.value;
						}}
						onblur={() => {
							if (amountEdited && amountCents !== undefined) amount = centsToInput(amountCents);
						}}
						disabled={busy}
						required
					/>
				</div>
			</div>
		{/if}

		{#if movesStock && stock && !stock.error}
			<div class="field">
				<span class="label" id="settle-location-label">{inward ? 'Put into' : 'Take from'}</span>
				<div class="toggle" role="group" aria-labelledby="settle-location-label">
					{#each stock.locations as key (key)}
						<button
							type="button"
							aria-pressed={location === key}
							disabled={busy}
							onclick={() => (location = key)}
							>{locationLabel(key)} · {stock.stockByStorage[key]}</button
						>
					{/each}
				</div>
			</div>
		{:else if movesStock}
			<p class="error">This item no longer exists, so its stock can't change.</p>
		{/if}

		<div class="field">
			<label for="settle-note">{mode === 'correction' ? 'Reason' : 'Note'}</label>
			<input
				id="settle-note"
				placeholder={mode === 'correction' ? 'Required' : 'Optional'}
				bind:value={note}
				disabled={busy}
				required={mode === 'correction'}
			/>
		</div>

		{#if valid && mode !== 'review'}
			<p class="preview">
				{#if mode === 'correction'}
					Owed becomes <strong>{balance.owed + units}</strong>, with
					<strong>{balance.outstanding + units}</strong> outstanding.
				{:else}
					Outstanding {balance.outstanding} → <strong>{balance.outstanding - units}</strong>.
					{#if mode === 'cash'}No stock changes.{/if}
					{#if movesStock}
						{locationLabel(location)}
						{available} → <strong>{available + (inward ? units : -units)}</strong>.
					{/if}
				{/if}
			</p>
		{:else if quantity !== '' && !unitsValid}
			<p class="error">
				{mode === 'correction'
					? `Owed can't drop below ${Math.max(balance.settled, 1)}.`
					: `Enter 1 to ${balance.outstanding}.`}
			</p>
		{:else if movesStock && !inward && unitsValid && units > available}
			<p class="error">Only {available} in {locationLabel(location)}.</p>
		{/if}
		{#if error}<p class="error" role="alert">{error}</p>{/if}

		<div class="actions">
			<button type="button" class="secondary" disabled={busy} onclick={onclose}>Cancel</button>
			<button class="primary" type="submit" disabled={busy || !valid}>
				{busy ? 'Saving…' : mode === 'review' ? 'Mark reviewed' : 'Save'}
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
		gap: 0.85rem;
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
	.field {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}
	label,
	.label {
		font-size: 0.78rem;
		font-weight: 700;
		color: var(--text-color);
	}
	input {
		min-height: 2.5rem;
		padding: 0.5rem 0.75rem;
		border: 1.5px solid var(--input-border-color, var(--table-border-color));
		border-radius: var(--border-radius);
		color: var(--text-color);
		background: var(--input-bg, var(--container-bg));
		font: inherit;
		font-size: 0.95rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		transition: border-color 0.15s ease-out;
	}
	/* A "$" sits inside the amount box so the figure reads as money. */
	.money {
		position: relative;
		display: flex;
	}
	.money span {
		position: absolute;
		left: 0.75rem;
		top: 50%;
		transform: translateY(-50%);
		color: var(--text-color-dimmed);
		font-weight: 600;
		pointer-events: none;
	}
	.money input {
		flex: 1;
		min-width: 0;
		padding-left: 1.6rem;
	}
	input::placeholder {
		color: var(--placeholder-text);
		font-weight: 500;
	}
	.toggle {
		display: grid;
		grid-auto-columns: 1fr;
		grid-auto-flow: column;
		gap: 0.4rem;
	}
	.toggle button {
		min-height: 2.5rem;
		padding: 0.4rem 0.5rem;
		border: 1.5px solid var(--table-border-color);
		border-radius: var(--border-radius);
		color: var(--text-color-dimmed);
		background: var(--container-bg);
		font: inherit;
		font-size: 0.82rem;
		font-weight: 700;
		cursor: pointer;
		transition:
			background-color 0.15s ease-out,
			color 0.15s ease-out,
			border-color 0.15s ease-out;
	}
	.toggle button:hover:not(:disabled) {
		background: var(--hover-bg-color);
		color: var(--text-color);
	}
	.toggle button[aria-pressed='true'] {
		color: var(--add-item-color);
		border-color: var(--add-item-color);
		background: color-mix(in srgb, var(--add-item-color) 10%, var(--container-bg));
	}
	.preview {
		padding: 0.6rem 0.75rem;
		border-radius: 0.5rem;
		border: 1px solid var(--table-border-color);
		background: var(--hover-bg-color);
		font-size: 0.85rem;
		color: var(--text-color-dimmed);
	}
	.preview strong {
		color: var(--text-color);
	}
	.hint {
		color: var(--text-color-dimmed);
		font-size: 0.85rem;
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
		.toggle button,
		.actions button,
		input {
			min-height: 2.75rem;
		}
	}
</style>
