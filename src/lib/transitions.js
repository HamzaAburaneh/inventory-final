// src/lib/transitions.js
import { cubicOut } from 'svelte/easing';

/**
 * @typedef {object} FadeAndSlideParams
 * @property {number} [delay=0]
 * @property {number} [duration=500]
 * @property {number} [y=50]
 */

/**
 * Custom Svelte transition for fading and sliding elements.
 * @param {Element} node - The DOM node to apply the transition to.
 * @param {FadeAndSlideParams} params - Parameters for the transition.
 * @returns {object} Svelte transition object.
 */
export function fadeAndSlide(node, { delay = 0, duration = 500, y = 50 }) {
	return {
		delay,
		duration,
		easing: cubicOut,
		css: (t) => `
      transform: translateY(${(1 - t) * y}px);
      opacity: ${t};
    `
	};
}

/**
 * Svelte action that replays a CSS animation on `node` whenever `value` changes.
 * It toggles the `is-flashing` class; the caller's stylesheet decides what the
 * flash looks like. The class is removed when the animation ends so it can fire
 * again on the next change.
 * @param {HTMLElement} node - The element to flash.
 * @param {unknown} value - Watched value; any change after mount triggers a flash.
 * @returns {{ update(next: unknown): void, destroy(): void }} Action handle.
 */
export function flashOnChange(node, value) {
	const stop = () => node.classList.remove('is-flashing');
	node.addEventListener('animationend', stop);
	return {
		update(next) {
			if (Object.is(next, value)) return;
			value = next;
			stop();
			// Force a style flush so re-adding the class restarts the animation.
			void node.offsetWidth;
			node.classList.add('is-flashing');
		},
		destroy() {
			node.removeEventListener('animationend', stop);
		}
	};
}
