<script>
	import { fly } from 'svelte/transition';
	import { createSubscriber } from 'svelte/reactivity';
	import { prefersReducedMotion } from 'svelte/motion';
	import {
		stockQueueState,
		retryStockAction,
		cancelStockAction,
		prepareStockActionReconfirmation,
		reconfirmStockAction
	} from '../lib/stockActionQueue.js';
	import ConfirmModal from './ConfirmModal.svelte';
	import StockLocationChips from './StockLocationChips.svelte';
	import { isOnline } from '../stores/connectivityStore.js';
	import { locationLabel, inspectItemStock } from '../lib/stockLocations.js';
	let confirmation = $state(null);
	let busy = $state(false);
	let error = $state('');
	const labels = { queued: 'Queued', syncing: 'Syncing', attention: 'Needs attention' };
	const icons = {
		queued: 'ti-clock',
		syncing: 'ti-refresh',
		attention: 'ti-alert-triangle'
	};
	const riseParams = $derived({ y: 8, duration: prefersReducedMotion.current ? 0 : 220 });
	const attentionCount = $derived(
		$stockQueueState.actions.filter((action) => action.status === 'attention').length
	);
	// Online replay normally finishes in well under a second, so mounting the panel
	// for every action would push the page down and back up. Show it only when the
	// user can act on something: a conflict, a queue error, being offline, or an
	// action that has waited longer than the grace period (a stuck sync).
	const STALE_AFTER_MS = 5000;
	// A one-second clock that only runs while something reads it (i.e. while
	// actions are pending), so idle pages tick nothing.
	const subscribeClock = createSubscriber((update) => {
		const timer = setInterval(update, 1000);
		return () => clearInterval(timer);
	});
	const now = () => {
		subscribeClock();
		return Date.now();
	};
	const stale = $derived(
		$stockQueueState.actions.some((action) => now() - action.createdAt > STALE_AFTER_MS)
	);
	const visible = $derived(
		!!$stockQueueState.error ||
			attentionCount > 0 ||
			(!!$stockQueueState.actions.length && (!$isOnline || stale))
	);
	function describe(action) {
		if (action.cancelRequested) return 'Cancellation awaiting confirmation';
		if (action.kind === 'adjust')
			return `${action.delta > 0 ? '+' : ''}${action.delta} in ${locationLabel(action.location)}`;
		if (action.kind === 'transfer')
			return `${action.quantity} from ${locationLabel(action.fromLocation)} to ${locationLabel(action.toLocation)}`;
		if (action.kind === 'set') return `Set ${locationLabel(action.location)} to ${action.quantity}`;
		return (
			{
				reset: 'Reset all locations to zero',
				delete: 'Delete item',
				create: `Create item with ${action.item?.count ?? 0} units`
			}[action.kind] ?? action.kind
		);
	}
	const reviewedTotal = $derived(
		confirmation?.action?.kind === 'set'
			? confirmation.item.count -
					inspectItemStock(confirmation.item).stockByStorage[confirmation.action.location] +
					confirmation.action.quantity
			: 0
	);
	async function act(callback, id) {
		if (busy) return;
		busy = true;
		error = '';
		try {
			await callback(id);
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Could not update pending change.';
		} finally {
			busy = false;
		}
	}
	async function review(id) {
		if (busy) return;
		busy = true;
		error = '';
		try {
			confirmation = await prepareStockActionReconfirmation(id);
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Could not refresh stock for review.';
		} finally {
			busy = false;
		}
	}
	async function confirm() {
		const action = confirmation;
		confirmation = null;
		await act((id) => reconfirmStockAction(id, action.expectedRevision), action.action.id);
	}
</script>

{#if visible}
	<section
		class="queue-panel"
		class:has-attention={attentionCount > 0 || !!$stockQueueState.error}
		aria-label="Pending stock changes"
		in:fly={riseParams}
	>
		<header class="panel-head">
			<span class="panel-icon" aria-hidden="true"><i class="ti ti-cloud-upload"></i></span>
			<div class="panel-title">
				<h3>Pending stock changes</h3>
				<p>Saved on this device. They sync while you are signed in and connected.</p>
			</div>
			<span class="count-badge" class:attention={attentionCount > 0}>
				{$stockQueueState.actions.length}
			</span>
		</header>
		{#if $stockQueueState.error || error}
			<p class="error" role="alert">
				<i class="ti ti-alert-triangle" aria-hidden="true"></i>
				{$stockQueueState.error || error}
			</p>
		{/if}
		<ul>
			{#each $stockQueueState.actions as action (action.id)}
				<li>
					<div class="entry">
						<div class="entry-text">
							<strong>{action.itemName || action.itemId}</strong>
							<span class="entry-desc">{describe(action)}</span>
						</div>
						<span class="status-pill status-{action.status}">
							<i class="ti {icons[action.status] ?? 'ti-clock'}" aria-hidden="true"></i>
							{labels[action.status] || action.status}
						</span>
					</div>
					{#if action.error}<p class="entry-error">{action.error}</p>{/if}
					{#if action.status !== 'syncing'}
						<div class="actions">
							<button
								type="button"
								disabled={busy}
								onclick={() => act(retryStockAction, action.id)}
							>
								<i class="ti ti-refresh" aria-hidden="true"></i> Retry
							</button>
							{#if action.status === 'attention' && ['set', 'reset', 'delete'].includes(action.kind)}
								<button
									type="button"
									class="queue-btn review"
									disabled={busy}
									onclick={() => review(action.id)}
								>
									<i class="ti ti-eye-check" aria-hidden="true"></i> Review and confirm
								</button>
							{/if}
							<button
								type="button"
								class="queue-btn cancel"
								disabled={busy}
								onclick={() => act(cancelStockAction, action.id)}
							>
								<i class="ti ti-x" aria-hidden="true"></i> Cancel change
							</button>
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	</section>
{/if}

<ConfirmModal
	visible={!!confirmation}
	title="Apply to the latest stock?"
	confirmText="Confirm again"
	onConfirm={confirm}
	onCancel={() => (confirmation = null)}
	chipLabel={confirmation?.item?.name}
	chipFrom={confirmation?.item?.count}
	chipTo={reviewedTotal}
>
	Review this {confirmation?.action?.kind} for {confirmation?.item?.name}. Confirming creates a new
	action against the balances below. A reset clears all locations; deletion removes the item. If
	stock changes again, another review is required.
	{#if confirmation?.action?.kind === 'set'}
		Only {locationLabel(confirmation.action.location)} will be set to {confirmation.action
			.quantity}.{/if}
	{#if confirmation?.item}<StockLocationChips item={confirmation.item} />{/if}
</ConfirmModal>

<style>
	.queue-panel {
		margin-bottom: 1rem;
		padding: 1rem 1.25rem;
		color: var(--text-color);
		background: var(--container-bg);
		border: 1px solid var(--table-border-color);
		border-left: 4px solid var(--add-item-color);
		border-radius: var(--border-radius);
		box-shadow: var(--nav-dropdown-shadow);
	}
	.queue-panel.has-attention {
		border-left-color: var(--event-remove);
	}
	.panel-head {
		display: flex;
		align-items: center;
		gap: 0.65rem;
	}
	.panel-icon {
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
	.has-attention .panel-icon {
		color: var(--event-remove);
		background: var(--event-remove-bg);
	}
	.panel-title {
		flex: 1;
		min-width: 0;
	}
	h3 {
		margin: 0;
		font-size: 1rem;
		font-weight: 700;
	}
	p {
		margin: 0.15rem 0 0;
		font-size: 0.8rem;
		color: var(--text-color-dimmed);
	}
	.count-badge {
		flex-shrink: 0;
		min-width: 1.6rem;
		padding: 0.15rem 0.5rem;
		border-radius: 999px;
		text-align: center;
		font-size: 0.78rem;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		color: var(--add-item-color);
		background: color-mix(in srgb, var(--add-item-color) 14%, var(--container-bg));
	}
	.count-badge.attention {
		color: var(--event-remove);
		background: var(--event-remove-bg);
	}
	ul {
		list-style: none;
		padding: 0;
		margin: 0.75rem 0 0;
	}
	li {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		padding: 0.65rem 0;
		border-top: 1px solid var(--table-border-color);
	}
	.entry {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.4rem 0.75rem;
	}
	.entry-text {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.2rem 0.5rem;
		min-width: 0;
	}
	.entry-text strong {
		font-size: 0.9rem;
		font-weight: 700;
	}
	.entry-desc {
		font-size: 0.82rem;
		color: var(--text-color-dimmed);
	}
	.status-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.18rem 0.55rem;
		border-radius: 999px;
		font-size: 0.74rem;
		font-weight: 700;
		white-space: nowrap;
		color: var(--text-color-dimmed);
		background: var(--hover-bg-color);
	}
	.status-syncing {
		color: var(--add-item-color);
		background: color-mix(in srgb, var(--add-item-color) 14%, var(--container-bg));
	}
	.status-attention {
		color: var(--event-remove);
		background: var(--event-remove-bg);
	}
	.error,
	.entry-error {
		display: flex;
		align-items: flex-start;
		gap: 0.35rem;
		margin: 0;
		color: var(--event-remove);
		font-size: 0.82rem;
		font-weight: 600;
	}
	.error {
		margin-top: 0.6rem;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}
	.queue-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		min-height: 2.25rem;
		padding: 0.3rem 0.7rem;
		border: 1.5px solid var(--table-border-color);
		border-radius: var(--border-radius);
		color: var(--text-color);
		background: var(--container-bg);
		font: inherit;
		font-size: 0.8rem;
		font-weight: 700;
		cursor: pointer;
		transition:
			background-color 0.12s ease-out,
			color 0.12s ease-out,
			border-color 0.12s ease-out;
	}
	.queue-btn:hover:not(:disabled) {
		background: var(--hover-bg-color);
	}
	.queue-btn.review {
		color: var(--add-item-color);
		border-color: var(--add-item-color);
	}
	.queue-btn.review:hover:not(:disabled) {
		background: color-mix(in srgb, var(--add-item-color) 10%, var(--container-bg));
	}
	.queue-btn.cancel:hover:not(:disabled) {
		color: var(--event-remove);
		border-color: var(--event-remove);
		background: var(--event-remove-bg);
	}
	.queue-btn:focus-visible {
		outline: 2px solid var(--add-item-color);
		outline-offset: 2px;
	}
	.queue-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	@media (pointer: coarse) {
		.queue-btn {
			min-height: 2.75rem;
		}
	}
</style>
