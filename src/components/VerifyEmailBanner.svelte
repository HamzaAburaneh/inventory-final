<script>
	import { slide } from 'svelte/transition';
	import { authStore } from '../stores/authStore.js';
	import { sendVerificationEmail } from '../lib/auth.js';
	import { notificationStore } from '../stores/notificationStore.js';

	const DISMISS_PREFIX = 'ss_verify_dismissed_';

	const user = $derived($authStore);
	let dismissedUid = $state(null);
	let sending = $state(false);
	let justSent = $state(false);
	let checking = $state(false);
	let shake = $state(false);

	// A soft nudge only: shown to any signed-in user whose email isn't verified,
	// until they verify or dismiss it. Dismissal is keyed per-uid so switching to
	// (or creating) a different account always shows that account's own banner.
	const dismissed = $derived.by(() => {
		const uid = user?.uid;
		if (!uid) return false;
		if (dismissedUid === uid) return true;
		return (
			typeof sessionStorage !== 'undefined' && sessionStorage.getItem(DISMISS_PREFIX + uid) === '1'
		);
	});

	const show = $derived(!!user && !user.emailVerified && !dismissed);

	async function resend() {
		if (sending || justSent) return;
		sending = true;
		try {
			await sendVerificationEmail();
			justSent = true;
			setTimeout(() => (justSent = false), 2500);
		} catch (error) {
			console.error('Resend verification failed:', error);
			notificationStore.error('Could not send the email — try again shortly');
		} finally {
			sending = false;
		}
	}

	async function recheck() {
		if (checking) return;
		checking = true;
		try {
			await authStore.refresh();
			if (user?.emailVerified) {
				// The banner auto-hides as `show` flips false; confirm with a toast.
				notificationStore.success('Email verified — thanks!');
			} else {
				shake = true;
				setTimeout(() => (shake = false), 450);
				notificationStore.warning('Not verified yet — click the link in the email, then recheck');
			}
		} finally {
			checking = false;
		}
	}

	function dismiss() {
		const uid = user?.uid;
		if (!uid) return;
		dismissedUid = uid;
		if (typeof sessionStorage !== 'undefined') {
			sessionStorage.setItem(DISMISS_PREFIX + uid, '1');
		}
	}
</script>

{#if show}
	<div class="verify-banner" role="status" transition:slide={{ duration: 220 }}>
		<div class="vb-inner" class:shake>
			<span class="vb-icon" aria-hidden="true">
				<svg
					viewBox="0 0 24 24"
					width="15"
					height="15"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<rect x="3" y="5" width="18" height="14" rx="2" />
					<path d="m3 7 9 6 9-6" />
				</svg>
			</span>

			<span class="vb-text">
				Verify your email <b>{user.email}</b> to secure your account.
			</span>

			<div class="vb-actions">
				<button class="vb-primary" onclick={resend} disabled={sending || justSent}>
					{#if sending}
						<span class="vb-spin" aria-hidden="true"></span>Sending…
					{:else if justSent}
						<svg
							class="vb-check"
							viewBox="0 0 24 24"
							width="13"
							height="13"
							fill="none"
							stroke="currentColor"
							stroke-width="2.6"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							<polyline points="20 6 9 17 4 12" />
						</svg>Sent
					{:else}
						Resend email
					{/if}
				</button>

				<button class="vb-secondary" onclick={recheck} disabled={checking}>
					{#if checking}
						<span class="vb-spin" aria-hidden="true"></span>Checking…
					{:else}
						I've verified
					{/if}
				</button>

				<button class="vb-close" onclick={dismiss} aria-label="Dismiss verification reminder">
					<svg
						viewBox="0 0 24 24"
						width="14"
						height="14"
						fill="none"
						stroke="currentColor"
						stroke-width="2.2"
						stroke-linecap="round"
						aria-hidden="true"
					>
						<line x1="6" y1="6" x2="18" y2="18" />
						<line x1="18" y1="6" x2="6" y2="18" />
					</svg>
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	/* Semantic-amber tokens, guaranteed AA-contrast in both themes. Light uses a
	   dark amber fill with white text; dark uses a bright amber fill with near-
	   black text — both solidly legible (the previous ghost buttons were not). */
	.verify-banner {
		--vb-fill: #b45309;
		--vb-on: #ffffff;
		--vb-tint: rgba(217, 119, 6, 0.1);
		--vb-border: rgba(217, 119, 6, 0.3);
		--vb-icon: #b45309;
	}

	:global([data-theme='dark']) .verify-banner {
		--vb-fill: #fbbf24;
		--vb-on: #1c1404;
		--vb-tint: rgba(251, 191, 36, 0.12);
		--vb-border: rgba(251, 191, 36, 0.28);
		--vb-icon: #fbbf24;
	}

	.verify-banner {
		max-width: 1400px;
		margin: 0.75rem auto 0;
		padding: 0 1rem;
	}

	.vb-inner {
		display: flex;
		align-items: center;
		gap: 12px;
		background: var(--vb-tint);
		border: 1px solid var(--vb-border);
		border-radius: 12px;
		padding: 10px 10px 10px 14px;
	}

	.vb-inner.shake {
		animation: vb-shake 0.42s ease;
	}

	.vb-icon {
		flex-shrink: 0;
		display: grid;
		place-items: center;
		width: 30px;
		height: 30px;
		border-radius: 50%;
		background: var(--container-bg);
		color: var(--vb-icon);
	}

	.vb-text {
		flex: 1;
		min-width: 0;
		font-size: 0.85rem;
		line-height: 1.35;
		color: var(--text-color);
	}

	.vb-text b {
		font-weight: 600;
		word-break: break-all;
	}

	.vb-actions {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-shrink: 0;
	}

	/* Buttons: quick scale on press = tactile confirmation (~150ms). */
	.vb-primary,
	.vb-secondary {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-family: inherit;
		font-size: 0.8rem;
		font-weight: 600;
		border-radius: 8px;
		padding: 0.5rem 0.85rem;
		cursor: pointer;
		white-space: nowrap;
		transition:
			transform 0.14s ease,
			filter 0.15s ease,
			background 0.15s ease,
			border-color 0.15s ease;
	}

	.vb-primary:active:not(:disabled),
	.vb-secondary:active:not(:disabled) {
		transform: scale(0.97);
	}

	.vb-primary {
		border: none;
		background: var(--vb-fill);
		color: var(--vb-on);
	}

	.vb-primary:hover:not(:disabled) {
		filter: brightness(1.08);
		transform: translateY(-1px);
	}

	.vb-secondary {
		background: transparent;
		color: var(--text-color);
		border: 1px solid var(--table-border-color);
	}

	.vb-secondary:hover:not(:disabled) {
		background: var(--container-bg);
		border-color: var(--vb-border);
	}

	.vb-primary:disabled,
	.vb-secondary:disabled {
		opacity: 0.75;
		cursor: default;
	}

	.vb-check {
		color: var(--vb-on);
	}

	/* Dismiss: no gimmick rotation. Hover = subtle surface; press = slight
	   shrink. The removal itself is the banner's slide-collapse (transition). */
	.vb-close {
		flex-shrink: 0;
		display: grid;
		place-items: center;
		width: 30px;
		height: 30px;
		border: none;
		border-radius: 8px;
		background: transparent;
		color: var(--text-color-dimmed);
		cursor: pointer;
		transition:
			background 0.15s ease,
			color 0.15s ease,
			transform 0.12s ease;
	}

	.vb-close:hover {
		background: rgba(128, 128, 128, 0.14);
		color: var(--text-color);
	}

	.vb-close:active {
		transform: scale(0.88);
	}

	/* Loading ring: rotation here IS meaningful — it signals work in progress. */
	.vb-spin {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		border: 2px solid currentColor;
		border-top-color: transparent;
		animation: vb-spin 0.7s linear infinite;
	}

	@keyframes vb-spin {
		to {
			transform: rotate(360deg);
		}
	}

	@keyframes vb-shake {
		10%,
		90% {
			transform: translateX(-1px);
		}
		30%,
		70% {
			transform: translateX(-4px);
		}
		50% {
			transform: translateX(4px);
		}
	}

	@media (max-width: 640px) {
		.verify-banner {
			padding: 0 0.5rem;
		}

		.vb-inner {
			flex-wrap: wrap;
		}

		.vb-text {
			flex-basis: 100%;
			order: -1;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.vb-primary,
		.vb-secondary,
		.vb-close,
		.vb-spin,
		.vb-inner.shake {
			animation: none;
			transition: none;
		}
	}
</style>
