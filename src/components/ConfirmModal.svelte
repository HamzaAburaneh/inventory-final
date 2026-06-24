<script>
	import { fade, fly } from 'svelte/transition';
	import { prefersReducedMotion } from 'svelte/motion';

	let {
		visible = false,
		title = 'Are you sure?',
		confirmText = 'Confirm',
		cancelText = 'Cancel',
		variant = 'warning',
		onConfirm,
		onCancel,
		children
	} = $props();

	const fadeParams = $derived({ duration: prefersReducedMotion.current ? 0 : 200 });
	const flyParams = $derived({ y: 30, duration: prefersReducedMotion.current ? 0 : 250 });
</script>

{#if visible}
	<div
		class="modal-backdrop"
		role="presentation"
		onclick={onCancel}
		onkeydown={(e) => e.key === 'Escape' && onCancel()}
		in:fade={fadeParams}
		out:fade={fadeParams}
	></div>
	<div class="modal-overlay" in:fade={fadeParams} out:fade={fadeParams}>
		<div
			class="confirm-modal"
			role="dialog"
			tabindex="-1"
			aria-modal="true"
			aria-label={title}
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
			in:fly={flyParams}
			out:fade={fadeParams}
		>
			<div class="modal-icon {variant}" aria-hidden="true">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path
						d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
					></path>
					<line x1="12" y1="9" x2="12" y2="13"></line>
					<line x1="12" y1="17" x2="12.01" y2="17"></line>
				</svg>
			</div>
			<h3>{title}</h3>
			<p class="modal-message">{@render children?.()}</p>
			<div class="modal-buttons">
				<button type="button" class="cancel-btn" onclick={onCancel}>{cancelText}</button>
				<button type="button" class="confirm-btn {variant}" onclick={onConfirm}
					>{confirmText}</button
				>
			</div>
		</div>
	</div>
{/if}

<style>
	/* Plain semi-opaque overlay (no backdrop blur): fading a blurred layer recomputes
	   the blur every frame and stutters — animating opacity on a solid fill is
	   composited and stays smooth. */
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background-color: rgba(0, 0, 0, 0.55);
		z-index: 9999;
	}

	.modal-overlay {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 10000;
		width: min(24rem, calc(100vw - 2rem));
	}

	.confirm-modal {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		background-color: var(--container-bg);
		border-radius: 0.75rem;
		padding: 1.75rem;
		box-shadow: 0 0.625rem 1.875rem rgba(0, 0, 0, 0.4);
		border: 1px solid var(--table-border-color);
	}

	.modal-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 3.5rem;
		height: 3.5rem;
		border-radius: 50%;
		margin-bottom: 1rem;
	}

	.modal-icon svg {
		width: 1.85rem;
		height: 1.85rem;
	}

	.modal-icon.warning {
		color: #d97706;
		background: color-mix(in srgb, #d97706 16%, transparent);
	}

	.modal-icon.danger {
		color: #ef4444;
		background: color-mix(in srgb, #ef4444 16%, transparent);
	}

	.confirm-modal h3 {
		margin: 0 0 0.5rem 0;
		color: var(--text-color);
		font-size: 1.25rem;
		font-weight: 700;
	}

	.modal-message {
		margin: 0;
		color: var(--text-color);
		line-height: 1.5;
		font-size: 0.95rem;
	}

	/* Inline emphasis passed by callers (e.g. the word "ALL"). */
	.modal-message :global(strong) {
		font-weight: 700;
	}

	.modal-message :global(.emphasis) {
		color: #ef4444;
	}

	.modal-buttons {
		display: flex;
		gap: 0.75rem;
		margin-top: 1.5rem;
		width: 100%;
	}

	.modal-buttons button {
		flex: 1;
		padding: 0.6rem 1rem;
		border: none;
		border-radius: 0.5rem;
		font-size: 0.95rem;
		font-weight: 600;
		cursor: pointer;
		transition:
			background-color 0.15s ease-out,
			color 0.15s ease-out;
	}

	/* Suppress the global blue button:focus outline on click; keep a keyboard ring. */
	.modal-buttons button:focus {
		outline: none;
	}

	.modal-buttons button:focus-visible {
		outline: 2px solid var(--text-color);
		outline-offset: 2px;
	}

	.cancel-btn {
		background-color: var(--hover-bg-color);
		color: var(--text-color);
		border: 1px solid var(--table-border-color);
	}

	.cancel-btn:hover {
		background-color: var(--table-border-color);
	}

	.confirm-btn {
		color: #fff;
	}

	.confirm-btn.warning {
		background-color: #d97706;
	}

	.confirm-btn.warning:hover {
		background-color: #b45f06;
	}

	.confirm-btn.danger {
		background-color: #ef4444;
	}

	.confirm-btn.danger:hover {
		background-color: #dc2626;
	}
</style>
