<script>
	import { untrack } from 'svelte';
	import Icon from './Icon.svelte';
	import { closeOnBackdrop } from '../lib/dialogBackdrop.js';
	import { numericInput } from '../lib/numericInput.js';
	import { reveal, smoothResize } from '../lib/resizeMotion.js';
	import { inspectItemStock, locationLabel } from '../lib/stockLocations.js';
	import { getStorageTypeIcon } from '../lib/tableUtils.js';
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
	// Returns and payments often settle everything at once; "All N" fills that in.
	const canFill = $derived((mode === 'return' || mode === 'cash') && balance.outstanding > 0);

	const titles = $derived({
		return: inward ? 'Product returned to us' : 'Product returned to them',
		cash: inward ? 'Cash received' : 'Cash paid',
		correction: 'Correct what is owed',
		review: 'Mark as reviewed'
	});
	const icons = {
		return: 'fa-box-open',
		cash: 'fa-coins',
		correction: 'fa-pen-to-square',
		review: 'fa-clipboard-check'
	};

	function initials(name) {
		const words = name.trim().split(/\s+/).filter(Boolean);
		return (
			words
				.slice(0, 2)
				.map((word) => word[0].toUpperCase())
				.join('') || '?'
		);
	}

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

	// Escape and a backdrop click cancel, except while a save is in flight.
	function dismiss() {
		if (!busy) onclose();
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
	{@attach smoothResize({ content: '.body' })}
	{@attach closeOnBackdrop(dismiss)}
	aria-labelledby="vendor-settle-title"
	oncancel={(event) => {
		event.preventDefault();
		dismiss();
	}}
>
	<form onsubmit={submit}>
		<div class="body">
			<span class="sheet-handle" aria-hidden="true"></span>
			<header class="modal-head">
				<span class="modal-icon" data-mode={mode} aria-hidden="true">
					<i class="fas {icons[mode]}"></i>
				</span>
				<h2 id="vendor-settle-title">{titles[mode]}</h2>
				<button type="button" class="close" aria-label="Close" disabled={busy} onclick={onclose}>
					<i class="fas fa-xmark" aria-hidden="true"></i>
				</button>
			</header>

			<div class="loan-card" data-direction={loan.direction}>
				<span class="avatar" aria-hidden="true">{initials(loan.vendorName)}</span>
				<div class="loan-card-main">
					<span class="loan-card-direction">
						{loan.direction === 'lent' ? 'Owes us' : 'We owe'}
					</span>
					<strong>{loan.vendorName}</strong>
					<span class="loan-card-product">{loan.productName}</span>
				</div>
				<div class="loan-card-balance">
					<strong>{balance.outstanding}<span> / {balance.owed}</span></strong>
					<span>
						still owed{#if balance.outstandingCents !== null}
							· {formatCents(balance.outstandingCents)}{/if}
					</span>
				</div>
			</div>

			{#if mode === 'review'}
				<p class="info">
					<i class="fas fa-circle-info" aria-hidden="true"></i>
					<span>
						Confirms you have checked this loan. It doesn't change stock or what's owed. Any later
						change sends it back to Needs review.
					</span>
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
					<div class="quantity">
						<input
							id="settle-quantity"
							type="number"
							step="1"
							min={mode === 'correction' ? undefined : 1}
							max={mode === 'correction' ? undefined : balance.outstanding}
							inputmode="numeric"
							placeholder="0"
							bind:value={quantity}
							{@attach numericInput({ negative: mode === 'correction' })}
							disabled={busy}
							required
						/>
						{#if canFill}
							<button
								type="button"
								class="fill"
								disabled={busy}
								onclick={() => (quantity = String(balance.outstanding))}
							>
								All {balance.outstanding}
							</button>
						{/if}
					</div>
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
							{@attach numericInput({ decimals: 2 })}
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
				<div class="field" transition:reveal>
					<span class="label" id="settle-location-label">{inward ? 'Put into' : 'Take from'}</span>
					<div class="locations" role="group" aria-labelledby="settle-location-label">
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
			{:else if movesStock}
				<p class="error" transition:reveal>
					<i class="fas fa-triangle-exclamation" aria-hidden="true"></i>
					This item no longer exists, so its stock can't change.
				</p>
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
				<div class="outcome" data-direction={loan.direction} transition:reveal>
					<span class="outcome-icon" aria-hidden="true"><i class="fas {icons[mode]}"></i></span>
					<div class="outcome-text">
						{#if mode === 'correction'}
							<strong>Owed becomes {balance.owed + units}</strong>
							<span>{balance.outstanding + units} still outstanding</span>
						{:else}
							<strong>Outstanding {balance.outstanding} → {balance.outstanding - units}</strong>
							{#if mode === 'cash'}<span>No stock changes.</span>{/if}
							{#if movesStock}
								<span class="outcome-stock">
									{locationLabel(location)}
									{available} → <strong>{available + (inward ? units : -units)}</strong>
								</span>
							{/if}
						{/if}
					</div>
				</div>
			{:else if quantity !== '' && !unitsValid}
				<p class="error" transition:reveal>
					<i class="fas fa-triangle-exclamation" aria-hidden="true"></i>
					{mode === 'correction'
						? `Owed can't drop below ${Math.max(balance.settled, 1)}.`
						: `Enter 1 to ${balance.outstanding}.`}
				</p>
			{:else if movesStock && !inward && unitsValid && units > available}
				<p class="error" transition:reveal>
					<i class="fas fa-triangle-exclamation" aria-hidden="true"></i>
					Only {available} in {locationLabel(location)}.
				</p>
			{/if}
			{#if error}
				<p class="error" role="alert" transition:reveal>
					<i class="fas fa-triangle-exclamation" aria-hidden="true"></i>
					{error}
				</p>
			{/if}
		</div>

		<div class="actions">
			<button type="button" class="secondary" disabled={busy} onclick={onclose}>Cancel</button>
			<button class={['primary', busy && 'busy']} type="submit" disabled={busy || !valid}>
				{busy ? 'Saving…' : mode === 'review' ? 'Mark reviewed' : 'Save'}
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
		width: min(28rem, calc(100vw - 2rem));
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

	/* Header: the icon and colour of the button that opened the dialog. */

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
		color: var(--tone);
		background: var(--tone-bg);
	}

	.modal-icon[data-mode='return'] {
		--tone: var(--event-create);
		--tone-bg: var(--event-create-bg);
	}

	.modal-icon[data-mode='cash'] {
		--tone: var(--event-add);
		--tone-bg: var(--event-add-bg);
	}

	.modal-icon[data-mode='correction'] {
		--tone: var(--event-delete);
		--tone-bg: var(--event-delete-bg);
	}

	.modal-icon[data-mode='review'] {
		--tone: var(--review-color);
		--tone-bg: var(--review-bg);
	}

	h2 {
		flex: 1;
		min-width: 0;
		font-size: 1.15rem;
		font-weight: 700;
		letter-spacing: -0.01em;
	}

	.close {
		display: grid;
		place-items: center;
		flex-shrink: 0;
		width: 2rem;
		height: 2rem;
		margin-right: -0.5rem;
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

	/* Direction: green "owes us" or red "we owe", as on the page. */

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

	/* The loan being settled, drawn like its card on the page. */

	.loan-card {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.75rem;
		padding: 0.7rem 0.8rem;
		border: 1px solid var(--table-border-color);
		border-radius: 0.7rem;
		background: var(--soft);
	}

	.avatar {
		display: grid;
		place-items: center;
		width: 2.4rem;
		height: 2.4rem;
		border-radius: 50%;
		font-size: 0.8rem;
		font-weight: 800;
		color: var(--dir-ink);
		background: var(--dir-bg);
	}

	.loan-card-main {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.loan-card-direction {
		font-size: 0.7rem;
		font-weight: 700;
		color: var(--dir-ink);
	}

	.loan-card-main strong {
		font-size: 0.92rem;
		overflow-wrap: anywhere;
	}

	.loan-card-product {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--text-color-dimmed);
		overflow-wrap: anywhere;
	}

	.loan-card-balance {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		font-variant-numeric: tabular-nums;
		text-align: right;
	}

	.loan-card-balance strong {
		font-size: 1.3rem;
		line-height: 1.1;
	}

	.loan-card-balance strong span {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--text-color-dimmed);
	}

	.loan-card-balance > span {
		font-size: 0.72rem;
		font-weight: 600;
		color: var(--text-color-dimmed);
		white-space: nowrap;
	}

	.info {
		display: flex;
		align-items: flex-start;
		gap: 0.55rem;
		padding: 0.7rem 0.8rem;
		border: 1px solid color-mix(in srgb, var(--review-color) 35%, transparent);
		border-radius: 0.7rem;
		color: var(--text-color);
		background: var(--review-bg);
		font-size: 0.85rem;
	}

	.info i {
		margin-top: 0.15rem;
		color: var(--review-color);
	}

	/* Fields */

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

	.quantity {
		display: flex;
		gap: 0.5rem;
	}

	.quantity input {
		flex: 1;
		min-width: 0;
	}

	.fill {
		flex-shrink: 0;
		padding: 0 0.9rem;
		border: 1.5px solid var(--table-border-color);
		border-radius: var(--border-radius);
		color: var(--text-color);
		background: var(--soft);
		font: inherit;
		font-size: 0.82rem;
		font-weight: 700;
		cursor: pointer;
		transition: border-color 0.15s ease-out;
	}

	.fill:hover:not(:disabled) {
		border-color: var(--hover-border-color);
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

	/* What will happen, tinted by the loan's direction. */

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
		.location,
		.fill,
		.actions button,
		input {
			min-height: 2.75rem;
		}

		.close {
			width: 2.5rem;
			height: 2.5rem;
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
