<script>
	import { fade, fly } from 'svelte/transition';
	import { prefersReducedMotion } from 'svelte/motion';

	let {
		visible = false,
		title = 'Are you sure?',
		confirmText = 'Confirm',
		cancelText = 'Cancel',
		variant = 'warning',
		chipIcon = 'ti-cube',
		chipLabel = null,
		chipFrom = null,
		chipTo = null,
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
			<div class="modal-head">
				<span class="modal-icon {variant}" aria-hidden="true">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path
							d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
						></path>
						<line x1="12" y1="9" x2="12" y2="13"></line>
						<line x1="12" y1="17" x2="12.01" y2="17"></line>
					</svg>
				</span>
				<h3>{title}</h3>
			</div>
			<div class="modal-body">
				<p class="modal-message">{@render children?.()}</p>
				{#if chipLabel}
					<div class="modal-chip">
						<i class="ti {chipIcon}" aria-hidden="true"></i>
						<span class="modal-chip-name">{chipLabel}</span>
						{#if chipFrom != null && chipTo != null}
							<span class="modal-chip-change">
								<span>{chipFrom}</span>
								<i class="ti ti-arrow-right" aria-hidden="true"></i>
								<span>{chipTo}</span>
							</span>
						{/if}
					</div>
				{/if}
			</div>
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

	/* Layout mirrors the manage-items edit modal: icon + title in a left-aligned
	   header row, message body, then a button row. */
	.confirm-modal {
		display: flex;
		flex-direction: column;
		background-color: var(--container-bg);
		border-radius: 0.75rem;
		padding: 1.5rem;
		box-shadow: 0 0.625rem 1.875rem rgba(0, 0, 0, 0.4);
		border: 1px solid var(--table-border-color);
	}

	.modal-head {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		margin-bottom: 1.1rem;
	}

	/* Destructive reset: red caution glyph in a tinted square for both variants. */
	.modal-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 2rem;
		height: 2rem;
		border-radius: 0.5rem;
		color: #ef4444;
		background: color-mix(in srgb, #ef4444 18%, transparent);
	}

	.modal-icon svg {
		width: 1.1rem;
		height: 1.1rem;
	}

	.confirm-modal h3 {
		margin: 0;
		color: var(--text-color);
		font-size: 1.15rem;
		font-weight: 700;
	}

	.modal-body {
		margin-bottom: 1.25rem;
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

	/* Item summary chip with a before → after count badge. */
	.modal-chip {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.6rem;
		padding: 0.5rem 0.65rem;
		border-radius: 0.5rem;
		background: var(--hover-bg-color);
		border: 1px solid var(--table-border-color);
	}

	.modal-chip > i {
		font-size: 1rem;
		color: var(--text-color-dimmed);
		flex-shrink: 0;
	}

	.modal-chip-name {
		font-size: 0.82rem;
		font-weight: 600;
		color: var(--text-color);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
	}

	/* Opaque tint (mixed into the modal surface, not translucent) so the red and the
	   "→" keep full contrast regardless of the chip's hover background. */
	.modal-chip-change {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		margin-left: auto;
		flex-shrink: 0;
		font-size: 0.78rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		padding: 0.15rem 0.6rem;
		border-radius: 999px;
		color: #ef4444;
		background: color-mix(in srgb, #ef4444 18%, var(--container-bg));
	}

	.modal-chip-change i {
		font-size: 1rem;
		line-height: 1;
	}

	:global([data-theme='dark']) .modal-chip-change {
		color: #f87171;
	}

	.modal-buttons {
		display: flex;
		gap: 0.75rem;
	}

	.modal-buttons button {
		flex: 1;
		padding: 0.6rem 1rem;
		border: none;
		border-radius: 8px;
		font-size: 0.9rem;
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
		outline: 2px solid var(--add-item-color);
		outline-offset: 2px;
	}

	.cancel-btn {
		background: var(--table-border-color);
		color: var(--text-color);
	}

	.cancel-btn:hover {
		background: color-mix(in srgb, var(--table-border-color) 80%, var(--text-color));
	}

	/* Single-item reset (warning): soft red that fills solid on hover.
	   Reset all (danger): solid red from the start to read as the weightier action. */
	.confirm-btn.warning {
		background: color-mix(in srgb, #ef4444 18%, transparent);
		color: #ef4444;
	}

	.confirm-btn.warning:hover {
		background: #ef4444;
		color: #fff;
	}

	.confirm-btn.danger {
		background: #ef4444;
		color: #fff;
	}

	.confirm-btn.danger:hover {
		background: #dc2626;
		color: #fff;
	}
</style>
