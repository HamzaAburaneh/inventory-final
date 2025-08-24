<script>
	import { fade } from 'svelte/transition';

	let { text, x = 0, y = 0, visible = false } = $props();
</script>

{#if visible}
	<div 
		class="tooltip" 
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
		background-color: #333;
		color: white;
		padding: 0.5rem 0.75rem;
		border-radius: 0.375rem;
		font-size: 0.875rem;
		z-index: 2000;
		pointer-events: none;
		transform: translate(-50%, -100%);
		transition: opacity 0.2s;
		white-space: nowrap;
		box-shadow: 0 0.25rem 0.5rem rgba(0, 0, 0, 0.2);
	}
</style>