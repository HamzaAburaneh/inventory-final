<script>
	import Icon from './Icon.svelte';
	import ItemPicker from './ItemPicker.svelte';
	import SuggestInput from './SuggestInput.svelte';
	import { reveal, smoothResize } from '../lib/resizeMotion.js';
	import { inspectItemStock, locationLabel } from '../lib/stockLocations.js';
	import { getStorageTypeIcon } from '../lib/tableUtils.js';
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
		// Start in the vendor box: it's the first thing to fill in, and it keeps the
		// direction cards from opening with a focus ring on top of their selection.
		node.querySelector('#loan-vendor')?.focus();
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
	{@attach smoothResize({ content: '.body' })}
	aria-labelledby="vendor-loan-title"
	onclick={onBackdropClick}
	oncancel={(event) => {
		event.preventDefault();
		if (!busy) onclose();
	}}
>
	<form onsubmit={submit}>
		<div class="body">
			<span class="sheet-handle" aria-hidden="true"></span>
			<header class="modal-head">
				<span class="modal-icon" aria-hidden="true"><i class="fas fa-handshake"></i></span>
				<div class="modal-titles">
					<h2 id="vendor-loan-title">Record a loan</h2>
					<p class="subtitle">Product lent to or borrowed from another vendor</p>
				</div>
				<button type="button" class="close" aria-label="Close" disabled={busy} onclick={onclose}>
					<i class="fas fa-xmark" aria-hidden="true"></i>
				</button>
			</header>

			<div class="direction-choice" role="group" aria-label="Direction">
				<button
					type="button"
					class="direction-card"
					data-direction="lent"
					aria-pressed={direction === 'lent'}
					disabled={busy}
					onclick={() => (direction = 'lent')}
				>
					<span class="direction-icon" aria-hidden="true"><i class="fas fa-arrow-right"></i></span>
					<span class="direction-text">
						<strong>We lent it</strong>
						<span>They'll owe us</span>
					</span>
				</button>
				<button
					type="button"
					class="direction-card"
					data-direction="borrowed"
					aria-pressed={direction === 'borrowed'}
					disabled={busy}
					onclick={() => (direction = 'borrowed')}
				>
					<span class="direction-icon" aria-hidden="true"><i class="fas fa-arrow-left"></i></span>
					<span class="direction-text">
						<strong>We borrowed it</strong>
						<span>We'll owe them</span>
					</span>
				</button>
			</div>

			<div class="field">
				<label for="loan-vendor">{direction === 'lent' ? 'Lent to' : 'Borrowed from'}</label>
				<SuggestInput
					id="loan-vendor"
					bind:value={vendorName}
					suggestions={vendorNames}
					listLabel="Vendors"
					placeholder="Vendor name, e.g. Compound"
					disabled={busy}
					required
				/>
			</div>

			<div class="tabs" role="group" aria-label="Product type">
				<button
					type="button"
					aria-pressed={productMode === 'item'}
					disabled={busy}
					onclick={() => (productMode = 'item')}
				>
					<i class="fas fa-box" aria-hidden="true"></i> Inventory item
				</button>
				<button
					type="button"
					aria-pressed={productMode === 'other'}
					disabled={busy}
					onclick={() => (productMode = 'other')}
				>
					<i class="fas fa-tag" aria-hidden="true"></i> Other product
				</button>
			</div>

			{#if productMode === 'item'}
				<div class="field" transition:reveal>
					<span class="label" id="loan-item-label">Item</span>
					<ItemPicker
						{items}
						value={itemId}
						labelId="loan-item-label"
						disabled={busy}
						onchoose={chooseItem}
					/>
				</div>
			{:else}
				<div class="field" transition:reveal>
					<label for="loan-product">Product</label>
					<input
						id="loan-product"
						placeholder="e.g. Liner baskets"
						bind:value={productName}
						disabled={busy}
						required
					/>
					<p class="hint">
						Not an inventory item, so no stock changes. Only what's owed is tracked.
					</p>
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
				<div class="field" transition:reveal>
					<span class="label" id="loan-location-label">{outward ? 'Take from' : 'Put into'}</span>
					<div class="locations" role="group" aria-labelledby="loan-location-label">
						{#each stock.locations as key (key)}
							<button
								type="button"
								class="location"
								data-location={key}
								aria-pressed={location === key}
								disabled={busy}
								onclick={() => (location = key)}
							>
								<span class="location-icon"><Icon name={getStorageTypeIcon(key)} size={15} /></span>
								{locationLabel(key)}
								<span class="location-count">{stock.stockByStorage[key]}</span>
							</button>
						{/each}
					</div>
				</div>
			{/if}

			<div class="field">
				<label for="loan-note">Note</label>
				<input id="loan-note" placeholder="Optional" bind:value={note} disabled={busy} />
			</div>

			{#if valid}
				<div class="outcome" data-direction={direction} transition:reveal>
					<span class="outcome-icon" aria-hidden="true">
						<i class="fas {outward ? 'fa-arrow-right' : 'fa-arrow-left'}"></i>
					</span>
					<div class="outcome-text">
						<strong>
							{outward
								? `${cleanVendorName(vendorName)} will owe us`
								: `We'll owe ${cleanVendorName(vendorName)}`}
						</strong>
						<span>
							{amount} × {item ? item.name : productName.trim()}{#if priceCents}
								· {formatCents(amount * priceCents)}{/if}
						</span>
						{#if movesStock}
							<span class="outcome-stock" transition:reveal>
								{locationLabel(location)}
								{available} → <strong>{available + (outward ? -amount : amount)}</strong>
							</span>
						{/if}
					</div>
				</div>
			{:else if movesStock && location && quantityValid && outward && amount > available}
				<p class="error" transition:reveal>
					<i class="fas fa-triangle-exclamation" aria-hidden="true"></i>
					Only {available} in {locationLabel(location)}.
				</p>
			{:else if priceCents === undefined}
				<p class="error" transition:reveal>
					<i class="fas fa-triangle-exclamation" aria-hidden="true"></i>
					Enter a valid value per unit, or leave it blank.
				</p>
			{/if}
			{#if stock?.error || error}
				<p class="error" role="alert" transition:reveal>
					<i class="fas fa-triangle-exclamation" aria-hidden="true"></i>
					{stock?.error || error}
				</p>
			{/if}
		</div>

		<div class="actions">
			<button type="button" class="secondary" disabled={busy} onclick={onclose}>Cancel</button>
			<button class={['primary', busy && 'busy']} type="submit" disabled={busy || !valid}>
				{busy ? 'Saving…' : 'Save loan'}
			</button>
		</div>
	</form>
</dialog>

<style>
	dialog {
		--soft: color-mix(in srgb, var(--text-color) 8%, transparent);
		margin: auto;
		padding: 0;
		color: var(--text-color);
		background: var(--container-bg);
		border: 1px solid var(--table-border-color);
		border-radius: 0.9rem;
		box-shadow: var(--nav-dropdown-shadow);
		width: min(30rem, calc(100vw - 2rem));
		max-height: calc(100dvh - 2rem);
		overflow-y: auto;
		overscroll-behavior: contain;
		animation: dialog-rise 0.22s ease-out;
	}

	dialog::backdrop {
		background: var(--modal-backdrop);
		animation: backdrop-fade 0.2s ease-out;
	}

	@keyframes dialog-rise {
		from {
			opacity: 0;
			transform: translateY(12px);
		}
	}

	@keyframes sheet-rise {
		from {
			opacity: 0;
			transform: translateY(48px);
		}
	}

	@keyframes backdrop-fade {
		from {
			opacity: 0;
		}
	}

	h2,
	p {
		margin: 0;
	}

	form {
		display: flex;
		flex-direction: column;
	}

	/* While the dialog eases to a new height (smoothResize), the form fills it and
	   the buttons ride its bottom edge instead of jumping. */
	dialog:global([data-resizing]) form {
		min-height: 100%;
	}

	dialog:global([data-resizing]) .actions {
		margin-top: auto;
	}

	.body {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		padding: 1.25rem 1.5rem 1.1rem;
	}

	.sheet-handle {
		display: none;
	}

	/* Header */

	.modal-head {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.modal-icon {
		display: grid;
		place-items: center;
		flex-shrink: 0;
		width: 2.4rem;
		height: 2.4rem;
		border-radius: 0.65rem;
		font-size: 1rem;
		color: var(--add-item-color);
		background: color-mix(in srgb, var(--add-item-color) 16%, transparent);
	}

	.modal-titles {
		flex: 1;
		min-width: 0;
	}

	h2 {
		font-size: 1.15rem;
		font-weight: 700;
		letter-spacing: -0.01em;
	}

	.subtitle {
		margin-top: 0.1rem;
		color: var(--text-color-dimmed);
		font-size: 0.82rem;
		font-weight: 500;
	}

	.close {
		display: grid;
		place-items: center;
		flex-shrink: 0;
		align-self: flex-start;
		width: 2rem;
		height: 2rem;
		margin: -0.2rem -0.5rem 0 0;
		border: 0;
		border-radius: 0.5rem;
		color: var(--text-color-dimmed);
		background: transparent;
		font-size: 1.05rem;
		cursor: pointer;
		transition:
			background-color 0.15s ease-out,
			color 0.15s ease-out;
	}

	.close:hover:not(:disabled) {
		color: var(--text-color);
		background: var(--soft);
	}

	/* Direction: green "they'll owe us" or red "we'll owe them", as on the page. */

	[data-direction='lent'] {
		--dir: var(--vendor-owes-us);
		--dir-bg: var(--vendor-owes-us-bg);
	}

	[data-direction='borrowed'] {
		--dir: var(--vendor-we-owe);
		--dir-bg: var(--vendor-we-owe-bg);
	}

	[data-direction] {
		--dir-ink: color-mix(in srgb, var(--dir) 78%, var(--text-color));
	}

	.direction-choice {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
	}

	.direction-card {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		min-width: 0;
		padding: 0.7rem 0.8rem;
		border: 1.5px solid var(--table-border-color);
		border-radius: 0.7rem;
		color: var(--text-color-dimmed);
		background: var(--container-bg);
		font: inherit;
		text-align: left;
		cursor: pointer;
		transition:
			background-color 0.15s ease-out,
			border-color 0.15s ease-out,
			color 0.15s ease-out;
	}

	.direction-card:hover:not(:disabled) {
		color: var(--text-color);
		border-color: color-mix(in srgb, var(--dir) 45%, var(--table-border-color));
	}

	.direction-card[aria-pressed='true'] {
		color: var(--dir-ink);
		border-color: var(--dir);
		background: var(--dir-bg);
	}

	.direction-icon {
		display: grid;
		place-items: center;
		flex-shrink: 0;
		width: 2rem;
		height: 2rem;
		border-radius: 50%;
		font-size: 0.85rem;
		color: var(--dir);
		background: color-mix(in srgb, var(--dir) 14%, transparent);
	}

	.direction-card[aria-pressed='true'] .direction-icon {
		color: var(--container-bg);
		background: var(--dir);
	}

	.direction-text {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.direction-text strong {
		font-size: 0.92rem;
	}

	.direction-text span {
		font-size: 0.75rem;
		font-weight: 600;
	}

	/* Product type: a small switch, secondary to the direction choice. */

	.tabs {
		display: inline-flex;
		align-self: flex-start;
		gap: 0.2rem;
		padding: 0.2rem;
		border-radius: 0.6rem;
		background: var(--soft);
	}

	.tabs button {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		min-height: 2rem;
		padding: 0.25rem 0.75rem;
		border: 1px solid transparent;
		border-radius: 0.45rem;
		color: var(--text-color-dimmed);
		background: transparent;
		font: inherit;
		font-size: 0.78rem;
		font-weight: 700;
		cursor: pointer;
		transition:
			background-color 0.15s ease-out,
			color 0.15s ease-out;
	}

	.tabs button:hover:not(:disabled) {
		color: var(--text-color);
	}

	.tabs button[aria-pressed='true'] {
		color: var(--text-color);
		background: var(--container-bg);
		border-color: var(--table-border-color);
	}

	/* Fields */

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

	.hint {
		color: var(--text-color-dimmed);
		font-size: 0.78rem;
	}

	/* Storage locations in the app's storage colours, with their stock as a badge. */

	.locations {
		display: grid;
		grid-auto-columns: 1fr;
		grid-auto-flow: column;
		gap: 0.4rem;
	}

	.location {
		--loc: var(--text-color-dimmed);
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		min-height: 2.5rem;
		padding: 0.4rem 0.6rem;
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
			border-color 0.15s ease-out,
			color 0.15s ease-out;
	}

	.location[data-location='Freezer'] {
		--loc: var(--location-freezer);
	}

	.location[data-location='Refrigerator'] {
		--loc: var(--location-fridge);
	}

	.location[data-location='Dry Storage'] {
		--loc: var(--location-dry);
	}

	.location:hover:not(:disabled) {
		color: var(--text-color);
		border-color: color-mix(in srgb, var(--loc) 45%, var(--table-border-color));
	}

	.location[aria-pressed='true'] {
		color: var(--text-color);
		border-color: var(--loc);
		background: color-mix(in srgb, var(--loc) 12%, var(--container-bg));
	}

	.location-icon {
		display: inline-grid;
		color: var(--loc);
	}

	.location-count {
		min-width: 1.4rem;
		padding: 0 0.35rem;
		border-radius: 999px;
		font-size: 0.72rem;
		text-align: center;
		font-variant-numeric: tabular-nums;
		color: var(--text-color);
		background: color-mix(in srgb, var(--loc) 18%, transparent);
	}

	/* What will happen, tinted by direction. */

	.outcome {
		display: flex;
		align-items: flex-start;
		gap: 0.65rem;
		padding: 0.7rem 0.8rem;
		border: 1px solid color-mix(in srgb, var(--dir) 35%, transparent);
		border-radius: 0.7rem;
		background: var(--dir-bg);
		font-size: 0.85rem;
	}

	.outcome-icon {
		display: grid;
		place-items: center;
		flex-shrink: 0;
		width: 1.75rem;
		height: 1.75rem;
		border-radius: 50%;
		font-size: 0.8rem;
		color: var(--container-bg);
		background: var(--dir);
	}

	.outcome-text {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		min-width: 0;
		color: var(--text-color);
		font-variant-numeric: tabular-nums;
	}

	.outcome-text > strong {
		color: var(--dir-ink);
	}

	.outcome-stock {
		color: color-mix(in srgb, var(--text-color) 70%, transparent);
	}

	.outcome-stock strong {
		color: var(--text-color);
	}

	.error {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		padding: 0.6rem 0.75rem;
		border: 1px solid color-mix(in srgb, var(--danger-text) 30%, transparent);
		border-radius: 0.6rem;
		color: var(--danger-text);
		background: var(--nav-danger-surface);
		font-size: 0.85rem;
		font-weight: 600;
	}

	.error i {
		margin-top: 0.15rem;
	}

	/* Footer stays in view while a long form scrolls. */

	.actions {
		position: sticky;
		bottom: 0;
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		padding: 0.85rem 1.5rem;
		border-top: 1px solid var(--table-border-color);
		background: var(--container-bg);
	}

	.actions button {
		min-height: 2.5rem;
		padding: 0.5rem 1.1rem;
		border-radius: var(--border-radius);
		font: inherit;
		font-size: 0.9rem;
		font-weight: 700;
		cursor: pointer;
		transition:
			background-color 0.15s ease-out,
			color 0.15s ease-out,
			filter 0.15s ease-out;
	}

	.secondary {
		color: var(--text-color);
		background: transparent;
		border: 1.5px solid var(--table-border-color);
	}

	.secondary:hover:not(:disabled) {
		background: var(--soft);
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

	/* Not ready yet: a quiet grey rather than a faded accent. */
	.primary:disabled:not(.busy) {
		opacity: 1;
		color: var(--text-color-dimmed);
		background: var(--soft);
		border-color: transparent;
	}

	.primary.busy {
		opacity: 0.75;
		cursor: progress;
	}

	button:focus-visible,
	input:focus-visible {
		outline: 2px solid var(--add-item-color);
		outline-offset: 2px;
	}

	@media (pointer: coarse) {
		.direction-card,
		.location,
		.actions button,
		input {
			min-height: 2.75rem;
		}

		.tabs button,
		.close {
			min-height: 2.5rem;
		}

		.close {
			width: 2.5rem;
		}
	}

	@media (max-width: 400px) {
		.row {
			grid-template-columns: 1fr;
		}
	}

	/* On phones the dialog rises from the bottom edge as a sheet, within thumb reach. */
	@media (max-width: 640px) {
		dialog {
			width: 100%;
			max-width: 100%;
			max-height: calc(100dvh - 1.5rem);
			margin: auto 0 0;
			border-bottom: 0;
			border-radius: 1rem 1rem 0 0;
			animation-name: sheet-rise;
		}

		.sheet-handle {
			display: block;
			width: 2.5rem;
			height: 0.3rem;
			margin: -0.35rem auto 0;
			border-radius: 999px;
			background: var(--table-border-color);
		}

		.actions {
			padding-bottom: calc(0.85rem + env(safe-area-inset-bottom));
		}
	}

	@media (prefers-reduced-motion: reduce) {
		dialog,
		dialog::backdrop {
			animation: none;
		}
	}
</style>
