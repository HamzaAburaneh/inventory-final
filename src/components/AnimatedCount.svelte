<script>
	// Rolls a number when it changes: the new value rises in from below on an
	// increase (or drops in from above on a decrease) while the old value slides
	// out the other way, and the digits briefly tint green/red before settling.
	// Both faces share one grid cell, so the swap never shifts surrounding layout.
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { prefersReducedMotion } from 'svelte/motion';
	let { value, class: className = '' } = $props();
	// Memo of the last rendered value so a change knows which way to roll. It
	// starts empty so the first render is a plain mount, not a roll.
	let last = { value: undefined, direction: 0 };
	const change = $derived.by(() => {
		const direction = Math.sign(Number(value) - Number(last.value)) || 0;
		last = { value, direction };
		return last;
	});
	const duration = $derived(prefersReducedMotion.current ? 0 : 260);
</script>

<span class="animated-count {className}">
	{#key change.value}
		<span
			class="count-face"
			class:up={change.direction > 0}
			class:down={change.direction < 0}
			in:fly={{ y: change.direction * 10, duration, easing: cubicOut }}
			out:fly={{ y: change.direction * -10, duration, easing: cubicOut }}>{change.value}</span
		>
	{/key}
</span>

<style>
	.animated-count {
		display: inline-grid;
		vertical-align: baseline;
	}
	.count-face {
		grid-area: 1 / 1;
		justify-self: center;
		white-space: nowrap;
	}
	/* One-sided keyframes fade from the tint back to the element's own colour,
	   so any caller-set colour (status text, chip text) stays the resting value. */
	.count-face.up {
		--flash-color: var(--event-add);
		animation: count-flash 900ms ease-out;
	}
	.count-face.down {
		--flash-color: var(--event-remove);
		animation: count-flash 900ms ease-out;
	}
	@keyframes count-flash {
		from {
			color: var(--flash-color);
		}
	}
</style>
