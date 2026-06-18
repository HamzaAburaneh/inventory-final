<script>
	/**
	 * Reveals content when it enters the viewport. Entrances are
	 * NON-DIRECTIONAL (no slide/wipe — nothing "scrolls into place"):
	 *  - default: pure fade
	 *  - blur:    fade + blur-to-sharp (headings)
	 *  - mask:    fade + gentle scale-up (cards)
	 * Respects prefers-reduced-motion (content shows immediately).
	 * (`y` prop still accepted from callers for API compatibility; no longer used.)
	 */
	let { delay = 0, blur = false, mask = false, children } = $props();

	let el = $state(null);
	let revealed = $state(false);

	$effect(() => {
		if (!el) return;

		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			revealed = true;
			return;
		}

		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						revealed = true;
						observer.disconnect();
					}
				}
			},
			{ threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
		);
		observer.observe(el);
		return () => observer.disconnect();
	});
</script>

<div
	bind:this={el}
	class="scroll-reveal"
	class:revealed
	class:blur
	class:mask
	style="--reveal-delay: {delay}ms;"
>
	{@render children()}
</div>

<style>
	/* Motion system: 400–600ms fades, one easing curve everywhere */
	.scroll-reveal {
		opacity: 0;
		transition: opacity 0.55s cubic-bezier(0.22, 1, 0.36, 1) var(--reveal-delay);
		will-change: opacity;
	}

	.scroll-reveal.blur {
		filter: blur(10px);
		transition:
			opacity 0.65s cubic-bezier(0.22, 1, 0.36, 1) var(--reveal-delay),
			filter 0.65s cubic-bezier(0.22, 1, 0.36, 1) var(--reveal-delay);
	}

	.scroll-reveal.mask > :global(*) {
		transform: scale(0.97);
		transition: transform 0.6s cubic-bezier(0.22, 1, 0.36, 1) var(--reveal-delay);
	}

	.scroll-reveal.revealed {
		opacity: 1;
		filter: blur(0);
	}

	.scroll-reveal.mask.revealed > :global(*) {
		transform: scale(1);
	}

	@media (prefers-reduced-motion: reduce) {
		.scroll-reveal,
		.scroll-reveal.blur {
			opacity: 1;
			filter: none;
			transition: none;
		}

		.scroll-reveal.mask > :global(*) {
			transform: none;
			transition: none;
		}
	}
</style>
