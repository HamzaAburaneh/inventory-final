// src/lib/transitions.ts
import { cubicOut } from 'svelte/easing';

interface FadeAndSlideParams {
	delay?: number;
	duration?: number;
	y?: number;
}

export function fadeAndSlide(
	node: Element,
	{ delay = 0, duration = 500, y = 50 }: FadeAndSlideParams
) {
	return {
		delay,
		duration,
		easing: cubicOut,
		css: (t: number) => `
      transform: translateY(${(1 - t) * y}px);
      opacity: ${t};
    `
	};
}
