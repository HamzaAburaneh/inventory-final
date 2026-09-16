<script>
	import { isOnline } from '../stores/connectivityStore.js';
	import { stockQueueState } from '../lib/stockActionQueue.js';

	const online = $derived($isOnline);
	const queued = $derived($stockQueueState.actions.length);
	const attention = $derived(
		$stockQueueState.actions.some((action) => action.status === 'attention') ||
			!!$stockQueueState.error
	);

	// Show while offline, or briefly after reconnecting until the queued writes
	// finish syncing. Hidden entirely when online with an empty queue.
	const visible = $derived(!online || queued > 0 || attention);
	const syncing = $derived(
		online && $stockQueueState.actions.some((action) => action.status === 'syncing')
	);

	const noun = $derived(queued === 1 ? 'change' : 'changes');
	const label = $derived(
		attention
			? 'Stock changes need attention'
			: syncing
				? `Syncing ${queued} ${noun}…`
				: queued > 0
					? `${online ? 'Pending' : 'Offline'} · ${queued} ${noun} queued`
					: 'Offline'
	);
</script>

{#if visible}
	<div class="offline-pill" class:syncing role="status" aria-live="polite">
		<i class="ti {syncing ? 'ti-refresh' : 'ti-cloud-off'}" aria-hidden="true"></i>
		<span>{label}</span>
	</div>
{/if}

<style>
	/* Pending state stays visible across routes using the shared theme palette. */
	.offline-pill {
		position: fixed;
		bottom: calc(1rem + env(safe-area-inset-bottom, 0px));
		left: 50%;
		transform: translateX(-50%);
		z-index: 1000;
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.4rem 0.85rem;
		border-radius: 9999px;
		font-size: 0.8rem;
		font-weight: 600;
		white-space: nowrap;
		background: var(--container-bg);
		border: 1px solid var(--table-border-color);
		color: var(--text-color);
		box-shadow: 0 0.25rem 0.75rem var(--tooltip-shadow);
		animation: offline-rise 220ms cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	.offline-pill i {
		font-size: 0.95rem;
	}

	/* Spin the refresh icon only while actively syncing. */
	.offline-pill.syncing i {
		animation: offline-spin 0.9s linear infinite;
	}

	@keyframes offline-rise {
		from {
			opacity: 0;
			transform: translate(-50%, 0.5rem);
		}
		to {
			opacity: 1;
			transform: translate(-50%, 0);
		}
	}

	@keyframes offline-spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.offline-pill {
			animation: none;
		}
		.offline-pill.syncing i {
			animation: none;
		}
	}
</style>
