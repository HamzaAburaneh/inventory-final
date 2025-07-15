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
