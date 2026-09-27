import { cubicOut } from 'svelte/easing';
import { prefersReducedMotion } from 'svelte/motion';

// Fast start, gentle landing: matches the app's other panel motion.
const EASE_OUT = 'cubic-bezier(0.2, 0, 0, 1)';
// How long after a content animation to keep leaving the size to it.
const SETTLE_MS = 120;

/**
 * One frame of `reveal`: the element's box scaled by `t`, with the parent's gap
 * beside it eased in as well, so the whole footprint grows from nothing.
 * @param {{ height: number, paddingTop: number, paddingBottom: number, borderTop: number, borderBottom: number, marginTop: number, marginBottom: number, opacity: number }} box
 *   The element's natural box, in px.
 * @param {number} gap The parent's row gap, in px.
 * @param {'top' | 'bottom' | null} gapSide Side of the element the gap sits on, if any.
 * @param {number} t Progress from 0 (closed) to 1 (open).
 * @returns {string} CSS declarations for that frame.
 */
export function revealStyle(box, gap, gapSide, t) {
	const hiddenGap = (1 - t) * gap;
	return [
		'overflow: hidden',
		'min-height: 0',
		`opacity: ${t * box.opacity}`,
		`height: ${t * box.height}px`,
		`padding-top: ${t * box.paddingTop}px`,
		`padding-bottom: ${t * box.paddingBottom}px`,
		`border-top-width: ${t * box.borderTop}px`,
		`border-bottom-width: ${t * box.borderBottom}px`,
		`margin-top: ${t * box.marginTop - (gapSide === 'top' ? hiddenGap : 0)}px`,
		`margin-bottom: ${t * box.marginBottom - (gapSide === 'bottom' ? hiddenGap : 0)}px`
	].join('; ');
}

/**
 * Svelte transition that opens or closes an element's height, fading it in step,
 * like `slide`. It also eases the gap a flex column or grid parent keeps beside the
 * element, so the content around it glides instead of jumping by that gap.
 * @param {HTMLElement} node Element entering or leaving.
 * @param {{ duration?: number, easing?: (t: number) => number }} [params] Timing.
 * @returns {{ duration: number, easing: (t: number) => number, css: (t: number) => string }}
 *   Transition config.
 */
export function reveal(node, { duration = 200, easing = cubicOut } = {}) {
	const px = (value) => parseFloat(value) || 0;
	const style = getComputedStyle(node);
	const parent = node.parentElement ? getComputedStyle(node.parentElement) : null;
	const stacked =
		parent !== null &&
		(parent.display.includes('grid') ||
			(parent.display.includes('flex') && parent.flexDirection.startsWith('column')));
	const gapSide = node.previousElementSibling ? 'top' : node.nextElementSibling ? 'bottom' : null;
	const box = {
		height: px(style.height),
		paddingTop: px(style.paddingTop),
		paddingBottom: px(style.paddingBottom),
		borderTop: px(style.borderTopWidth),
		borderBottom: px(style.borderBottomWidth),
		marginTop: px(style.marginTop),
		marginBottom: px(style.marginBottom),
		opacity: Number(style.opacity)
	};
	const gap = stacked ? px(parent.rowGap) : 0;
	return {
		duration: prefersReducedMotion.current ? 0 : duration,
		easing,
		css: (t) => revealStyle(box, gap, gapSide, t)
	};
}

/**
 * Whether a running animation changes its element's size, as a `reveal` or `slide`
 * does, rather than only its colour, opacity or position.
 * @param {{ transitionProperty?: string, effect?: { getKeyframes?: () => object[] } | null }} animation
 *   A running Web Animation, CSS transition or CSS animation.
 * @returns {boolean} True when it animates height, margins or padding.
 */
export function animationResizes(animation) {
	if (typeof animation.transitionProperty === 'string')
		return /height|margin|padding/.test(animation.transitionProperty);
	const frames = animation.effect?.getKeyframes?.() ?? [];
	return frames.some((frame) => ['height', 'maxHeight', 'minHeight'].some((key) => key in frame));
}

/**
 * Attachment that eases a surface's height, such as a dialog's, when its content
 * grows or shrinks, instead of letting it jump. At rest the surface keeps its
 * natural height. While easing it carries `data-resizing`, so its styles can pin a
 * footer to the moving edge. Content that animates its own size (a `reveal` or
 * `slide`) is left to do so, and people who prefer reduced motion see no easing.
 * @param {{ content: string, duration?: number }} options `content` selects the
 *   descendant that holds the content, without any footer; its height drives the surface.
 * @returns {(node: HTMLElement) => () => void} Svelte attachment.
 */
export function smoothResize({ content, duration = 220 }) {
	return (node) => {
		const target = node.querySelector(content);
		if (!(target instanceof HTMLElement) || typeof ResizeObserver === 'undefined') return () => {};

		let contentHeight = target.offsetHeight;
		let settled = node.offsetHeight;
		let contentMovingUntil = 0;
		/** @type {Animation | null} */
		let active = null;

		const stop = () => {
			active?.cancel();
			active = null;
			node.removeAttribute('data-resizing');
		};

		const observer = new ResizeObserver(() => {
			const next = target.offsetHeight;
			if (next === contentHeight) {
				if (!active) settled = node.offsetHeight;
				return;
			}
			contentHeight = next;
			// Mid-ease, start from where the surface is now; otherwise from its last rest.
			const from = active ? node.offsetHeight : settled;
			stop();
			const to = node.offsetHeight;
			settled = to;
			const now = performance.now();
			if (target.getAnimations({ subtree: true }).some(animationResizes))
				contentMovingUntil = now + SETTLE_MS;
			if (prefersReducedMotion.current || now < contentMovingUntil || Math.abs(to - from) < 1)
				return;
			node.setAttribute('data-resizing', '');
			const animation = node.animate(
				[
					{ height: `${from}px`, overflow: 'hidden' },
					{ height: `${to}px`, overflow: 'hidden' }
				],
				{ duration, easing: EASE_OUT }
			);
			active = animation;
			animation.onfinish = () => {
				if (active !== animation) return;
				active = null;
				node.removeAttribute('data-resizing');
				settled = node.offsetHeight;
			};
		});
		observer.observe(target);

		// A window resize can change the surface's rest height (its max-height) alone.
		const onWindowResize = () => {
			if (!active) settled = node.offsetHeight;
		};
		window.addEventListener('resize', onWindowResize);

		return () => {
			observer.disconnect();
			window.removeEventListener('resize', onWindowResize);
			stop();
		};
	};
}
