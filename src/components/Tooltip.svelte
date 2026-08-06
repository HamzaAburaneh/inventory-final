<script>
	import { fade } from 'svelte/transition';

	let { text, x = 0, y = 0, visible = false } = $props();
</script>

{#if visible}
	<div
		class="tooltip"
		role="tooltip"
		style="left: {x}px; top: {y}px;"
		in:fade={{ duration: 150 }}
		out:fade={{ duration: 150 }}
	>
		{text}
	</div>
{/if}

<style>
	.tooltip {
		position: absolute;
		background-color: color-mix(in srgb, var(--tooltip-bg) 92%, transparent);
		-webkit-backdrop-filter: blur(6px);
		backdrop-filter: blur(6px);
		color: var(--tooltip-text);
		border: 1px solid var(--tooltip-border);
		padding: 0.5rem 0.75rem;
		border-radius: 0.375rem;
		font-size: 0.875rem;
		z-index: 2000;
		pointer-events: none;
		transform: translate(-50%, -100%);
		transition: opacity 0.2s;
		/* Basis strings ("12 days of sales, steady") run long enough to reach the
		   viewport edge on one line, so wrap instead of overflowing. */
		max-width: min(18rem, calc(100vw - 2rem));
		box-shadow: 0 0.25rem 0.5rem var(--tooltip-shadow);
	}

	@media (prefers-reduced-motion: reduce) {
		.tooltip {
			transition: none;
		}
	}
</style>
