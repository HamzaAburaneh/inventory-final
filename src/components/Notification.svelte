<script>
	import { fly } from 'svelte/transition';
	import { cubicIn } from 'svelte/easing';
	import { prefersReducedMotion } from 'svelte/motion';
	import { notificationStore } from '../stores/notificationStore.js';

	// Dismissible toast for the most recent notification. Reads the store directly
	// so pages only need to render <Notification /> once.
	const latest = $derived($notificationStore.at(-1) ?? null);
	const reduce = $derived(prefersReducedMotion.current);

	function dismiss(id) {
		notificationStore.removeNotification(id);
	}
</script>

{#if latest}
	<div
		class="toast toast-{latest.type}"
		role="status"
		aria-live="polite"
		in:fly={{ y: 16, duration: reduce ? 0 : 240 }}
		out:fly={{ y: 16, duration: reduce ? 0 : 160, easing: cubicIn }}
	>
		<span class="toast-icon" aria-hidden="true">
			{#if latest.type === 'success'}
				<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
			{:else if latest.type === 'error'}
				<svg viewBox="0 0 24 24">
					<circle cx="12" cy="12" r="10" />
					<line x1="12" y1="8" x2="12" y2="12" />
					<line x1="12" y1="16" x2="12.01" y2="16" />
				</svg>
			{:else if latest.type === 'warning'}
				<svg viewBox="0 0 24 24">
					<path
						d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
					/>
					<line x1="12" y1="9" x2="12" y2="13" />
					<line x1="12" y1="17" x2="12.01" y2="17" />
				</svg>
			{:else}
				<svg viewBox="0 0 24 24">
					<circle cx="12" cy="12" r="10" />
					<line x1="12" y1="16" x2="12" y2="12" />
					<line x1="12" y1="8" x2="12.01" y2="8" />
				</svg>
			{/if}
		</span>

		<span class="toast-msg">{latest.message}</span>

		<button
			class="toast-close"
			onclick={() => dismiss(latest.id)}
			aria-label="Dismiss notification"
		>
			<svg viewBox="0 0 24 24" aria-hidden="true">
				<line x1="18" y1="6" x2="6" y2="18" />
				<line x1="6" y1="6" x2="18" y2="18" />
			</svg>
		</button>
	</div>
{/if}

<style>
	.toast {
		position: fixed;
		/* Line the toast up with the page content column instead of overhanging it.
		   Content left edge = <main> padding (1rem) + the `max-width: 95%` centering
		   margin (~2.5vw) + `.page-container` padding (~1.25rem) ≈ this calc, so the
		   toast sits within the cards on mobile rather than sticking out past them. */
		left: calc(2.2rem + 2.5vw);
		right: calc(2.2rem + 2.5vw);
		bottom: max(16px, env(safe-area-inset-bottom));
		margin: 0 auto;
		max-width: 28rem;
		z-index: 1000;
		display: flex;
		align-items: center;
		gap: 0.7rem;
		padding: 0.6rem 0.65rem;
		border-radius: 12px;
		color: var(--text-color);
		/* Elevated surface: --container-bg in light; a touch lighter than the
		   near-black container in dark so it reads as floating. */
		--toast-bg: var(--container-bg);
		background: var(--toast-bg);
		border: 1px solid var(--table-border-color);
		box-shadow: 0 8px 22px rgba(0, 0, 0, 0.15);
		/* Per-type icon-tile colors (default = brand accent, for info). */
		--toast-accent: var(--add-item-color);
		--toast-on: var(--add-item-on);
	}

	:global([data-theme='dark']) .toast {
		--toast-bg: #1e1e1e;
		box-shadow: 0 8px 22px rgba(0, 0, 0, 0.5);
	}

	.toast-success {
		/* Success/"updated" toasts follow the brand accent (blue in light, gold in
		   dark) via the theme tokens, matching the rest of the UI. */
		--toast-accent: var(--add-item-color);
		--toast-on: var(--add-item-on);
	}
	.toast-error {
		--toast-accent: #dc2626;
		--toast-on: #ffffff;
	}
	.toast-warning {
		--toast-accent: #d97706;
		--toast-on: #ffffff;
	}

	:global([data-theme='dark']) .toast-error {
		--toast-accent: #f87171;
		--toast-on: #1c0808;
	}
	:global([data-theme='dark']) .toast-warning {
		--toast-accent: #fbbf24;
		--toast-on: #1c1404;
	}

	.toast-icon {
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 30px;
		border-radius: 9px;
		background: var(--toast-accent);
		color: var(--toast-on);
	}

	.toast-icon svg {
		width: 16px;
		height: 16px;
	}

	.toast-msg {
		flex: 1;
		min-width: 0;
		font-size: 0.9rem;
		font-weight: 500;
		line-height: 1.3;
	}

	.toast-close {
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		padding: 0;
		min-height: 0;
		border: none;
		border-radius: 7px;
		background: transparent;
		color: var(--text-color-dimmed);
		cursor: pointer;
		transition:
			background-color 0.15s ease-out,
			color 0.15s ease-out;
	}

	.toast-close:hover {
		background: var(--hover-bg-color);
		color: var(--text-color);
	}

	.toast-close svg {
		width: 16px;
		height: 16px;
	}

	.toast-icon svg,
	.toast-close svg {
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	@media (prefers-reduced-motion: reduce) {
		.toast-close {
			transition: none;
		}
	}
</style>
