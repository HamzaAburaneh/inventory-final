<script>
	import { inspectItemStock, locationLabel } from '../lib/stockLocations.js';
	import { centsToInput, cleanVendorName, formatCents, toCents } from '../lib/vendorBalances.js';

	// Records a new loan. `items` are the workspace's inventory items and
	// `vendorNames` the counterparties already on file, offered as suggestions.
	// `onsave(details, operationId)` performs the write; the operation and loan IDs
	// are fixed for the life of the dialog, so pressing Save again after a failed
	// or unacknowledged attempt can never record the loan twice.
	let { items = [], vendorNames = [], onsave, onclose } = $props();

	const operationId = crypto.randomUUID();
	const loanId = crypto.randomUUID();

	let direction = $state('lent');
	let vendorName = $state('');
	let productMode = $state('item');
	let itemId = $state('');
	let productName = $state('');
	let quantity = $state('');
	let location = $state('');
	let price = $state('');
	let priceEdited = $state(false);
	let note = $state('');
	let busy = $state(false);
	let error = $state('');

	const sortedItems = $derived(
		[...items].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
	);
	const item = $derived(
		productMode === 'item' ? (items.find((row) => row.id === itemId) ?? null) : null
	);
	const stock = $derived(item ? inspectItemStock(item) : null);
	const movesStock = $derived(Boolean(item));
	const amount = $derived(Number(quantity));
	const quantityValid = $derived(Number.isSafeInteger(amount) && amount > 0);
	const priceCents = $derived.by(() => {
		try {
			return toCents(price, true);
		} catch {
			return undefined;
		}
	});
	const outward = $derived(direction === 'lent');
	const available = $derived(stock && location ? stock.stockByStorage[location] : 0);
	const stockOk = $derived(!movesStock || (location && (!outward || amount <= available)));
	const valid = $derived(
		Boolean(cleanVendorName(vendorName)) &&
			(productMode === 'item' ? Boolean(item) : Boolean(productName.trim())) &&
			quantityValid &&
			priceCents !== undefined &&
			stockOk &&
			!stock?.error
	);

	function chooseItem(id) {
		itemId = id;
		const chosen = items.find((row) => row.id === id);
		if (!chosen) return;
		const state = inspectItemStock(chosen);
		location =
			state.locations.find((key) => state.stockByStorage[key] > 0) ?? state.locations[0] ?? '';
		// Follow the chosen item's cost until someone types their own value.
		if (!priceEdited)
			price = Number(chosen.cost) > 0 ? centsToInput(toCents(Number(chosen.cost))) : '';
	}

	function openDialog(node) {
		const opener = document.activeElement;
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
					kind: 'loan',
					loanId,
					direction,
					vendorName,
					itemId: item?.id ?? null,
					productName: item ? item.name : productName.trim(),
					quantity: amount,
					unitPriceCents: priceCents,
					location: movesStock ? location : null,
					note
				},
				operationId
			);
			onclose();
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Could not save the loan.';
		} finally {
			busy = false;
		}
	}
</script>

<dialog
	{@attach openDialog}
	aria-labelledby="vendor-loan-title"
	onclick={onBackdropClick}
	oncancel={(event) => {
		event.preventDefault();
		if (!busy) onclose();
	}}
>
	<form onsubmit={submit}>
		<div class="modal-head">
			<span class="modal-icon" aria-hidden="true"><i class="fas fa-handshake"></i></span>
			<div>
				<h2 id="vendor-loan-title">Record a loan</h2>
				<p class="subtitle">Product lent to or borrowed from another vendor</p>
			</div>
		</div>

		<div class="toggle" role="group" aria-label="Direction">
			<button
				type="button"
				aria-pressed={direction === 'lent'}
				disabled={busy}
				onclick={() => (direction = 'lent')}>We lent it</button
			>
			<button
				type="button"
				aria-pressed={direction === 'borrowed'}
				disabled={busy}
				onclick={() => (direction = 'borrowed')}>We borrowed it</button
			>
		</div>

		<div class="field">
			<label for="loan-vendor">{direction === 'lent' ? 'Lent to' : 'Borrowed from'}</label>
			<input
				id="loan-vendor"
				list="loan-vendor-names"
				autocomplete="off"
				placeholder="Vendor name, e.g. Compound"
				bind:value={vendorName}
				disabled={busy}
				required
			/>
			<datalist id="loan-vendor-names">
				{#each vendorNames as name (name)}<option value={name}></option>{/each}
			</datalist>
		</div>

		<div class="toggle" role="group" aria-label="Product type">
			<button
				type="button"
				aria-pressed={productMode === 'item'}
				disabled={busy}
				onclick={() => (productMode = 'item')}>Inventory item</button
			>
			<button
				type="button"
				aria-pressed={productMode === 'other'}
				disabled={busy}
				onclick={() => (productMode = 'other')}>Other product</button
			>
		</div>

		{#if productMode === 'item'}
			<div class="field">
				<label for="loan-item">Item</label>
				<select
					id="loan-item"
					value={itemId}
					onchange={(event) => chooseItem(event.currentTarget.value)}
					disabled={busy}
					required
				>
					<option value="" disabled>Choose an item</option>
					{#each sortedItems as row (row.id)}<option value={row.id}>{row.name}</option>{/each}
				</select>
			</div>
		{:else}
			<div class="field">
				<label for="loan-product">Product</label>
				<input
					id="loan-product"
					placeholder="e.g. Liner baskets"
					bind:value={productName}
					disabled={busy}
					required
				/>
				<p class="hint">Not an inventory item, so no stock changes. Only what's owed is tracked.</p>
			</div>
		{/if}

		<div class="row">
			<div class="field">
				<label for="loan-quantity">Units</label>
				<input
					id="loan-quantity"
					type="number"
					min="1"
					step="1"
					inputmode="numeric"
					placeholder="0"
					bind:value={quantity}
					disabled={busy}
					required
				/>
			</div>
			<div class="field">
				<label for="loan-price">Value per unit</label>
				<div class="money">
					<span aria-hidden="true">$</span>
					<input
						id="loan-price"
						type="text"
						inputmode="decimal"
						autocomplete="off"
						placeholder="Optional"
						bind:value={price}
						oninput={() => (priceEdited = true)}
						onblur={() => {
							if (priceCents != null) price = centsToInput(priceCents);
						}}
						disabled={busy}
					/>
				</div>
			</div>
		</div>

		{#if movesStock && stock && !stock.error}
			<div class="field">
				<span class="label" id="loan-location-label">{outward ? 'Take from' : 'Put into'}</span>
				<div class="toggle" role="group" aria-labelledby="loan-location-label">
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
		{/if}

		<div class="field">
			<label for="loan-note">Note</label>
			<input id="loan-note" placeholder="Optional" bind:value={note} disabled={busy} />
		</div>

		{#if valid}
			<p class="preview">
				{cleanVendorName(vendorName)}
				{outward ? 'will owe us' : 'is owed'}
				<strong>{amount} × {item ? item.name : productName.trim()}</strong>{#if priceCents}
					({formatCents(amount * priceCents)}){/if}.
				{#if movesStock}
					{locationLabel(location)}
					{available} → <strong>{available + (outward ? -amount : amount)}</strong>.
				{/if}
			</p>
		{:else if movesStock && location && quantityValid && outward && amount > available}
			<p class="error">Only {available} in {locationLabel(location)}.</p>
		{:else if priceCents === undefined}
			<p class="error">Enter a valid value per unit, or leave it blank.</p>
		{/if}
		{#if stock?.error || error}<p class="error" role="alert">{stock?.error || error}</p>{/if}

		<div class="actions">
			<button type="button" class="secondary" disabled={busy} onclick={onclose}>Cancel</button>
			<button class="primary" type="submit" disabled={busy || !valid}>
				{busy ? 'Saving…' : 'Save loan'}
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
		width: min(30rem, calc(100vw - 2rem));
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
	.row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.6rem;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		min-width: 0;
	}
	label,
	.label {
		font-size: 0.78rem;
		font-weight: 700;
		color: var(--text-color);
	}
	input,
	select {
		min-height: 2.5rem;
		padding: 0.5rem 0.75rem;
		border: 1.5px solid var(--input-border-color, var(--table-border-color));
		border-radius: var(--border-radius);
		color: var(--text-color);
		background: var(--input-bg, var(--container-bg));
		font: inherit;
		font-size: 0.95rem;
		font-weight: 600;
		transition: border-color 0.15s ease-out;
	}
	/* A "$" sits inside the value box so the figure reads as money. */
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
		font-variant-numeric: tabular-nums;
	}
	input::placeholder {
		color: var(--placeholder-text);
		font-weight: 500;
	}
	select option {
		color: var(--text-color);
		background: var(--container-bg);
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
		font-size: 0.78rem;
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
	input:disabled,
	select:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	button:focus-visible,
	input:focus-visible,
	select:focus-visible {
		outline: 2px solid var(--add-item-color);
		outline-offset: 2px;
	}
	@media (pointer: coarse) {
		.toggle button,
		.actions button,
		input,
		select {
			min-height: 2.75rem;
		}
	}
	@media (max-width: 400px) {
		.row {
			grid-template-columns: 1fr;
		}
	}
</style>
