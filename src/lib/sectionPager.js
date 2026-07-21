/**
 * Pure helpers for the landing page's wheel section pager
 * (src/routes/+page.svelte). Kept free of DOM access so the
 * direction/inertia rules can be unit tested — see AGENTS.md goal 5:
 * a gesture must always page in the gesture's own direction, and
 * trailing trackpad inertia must never re-trigger a page turn.
 */

/**
 * Convert a WheelEvent delta to pixels.
 * @param {number} deltaY - raw `WheelEvent.deltaY`
 * @param {number} deltaMode - `WheelEvent.deltaMode`: 0 = pixels, 1 = lines, 2 = pages
 * @param {number} viewportHeight - `window.innerHeight`, used for page mode
 * @returns {number} delta in pixels
 */
export function normalizeWheelDelta(deltaY, deltaMode, viewportHeight) {
	if (deltaMode === 1) return deltaY * 16;
	if (deltaMode === 2) return deltaY * viewportHeight;
	return deltaY;
}

/**
 * Pick the snap target for a page turn: the next target strictly below
 * (dir > 0) or strictly above (dir < 0) the current scroll position. Because
 * the candidate is chosen relative to the live position — not "nearest
 * section ± 1" — scrolling up can only ever move the page up, regardless of
 * where a previous scroll or CSS snap landed.
 * @param {number[]} targetList - snap positions in ascending document order
 * @param {number} scrollY - current scroll position
 * @param {1|-1} dir - gesture direction (1 = down, -1 = up)
 * @returns {number|undefined} the target position, or undefined at either end
 */
export function nextTarget(targetList, scrollY, dir) {
	return dir > 0
		? targetList.find((t) => t > scrollY + 2)
		: [...targetList].reverse().find((t) => t < scrollY - 2);
}

/**
 * Map a keyboard key to a section-paging intent. Step intents ({dir}) flow
 * through the same nextTarget() pipeline as wheel gestures, so a key press
 * can only ever move the page in the key's own direction; jump intents
 * ({jump}) target the first/last section directly. Returns null for any
 * unmapped key so callers can leave native behavior untouched.
 * @param {string} key - `KeyboardEvent.key`
 * @returns {{dir: 1|-1}|{jump: 'first'|'last'}|null} paging intent, or null
 */
export function keyToPageIntent(key) {
	switch (key) {
		case 'ArrowDown':
		case 'PageDown':
			return { dir: 1 };
		case 'ArrowUp':
		case 'PageUp':
			return { dir: -1 };
		case 'Home':
			return { jump: 'first' };
		case 'End':
			return { jump: 'last' };
		default:
			return null;
	}
}

/**
 * Turns a raw wheel-delta stream into discrete page-turn intents.
 *
 * Rules:
 * - A gesture starts on a pause in the stream (> gestureGapMs) OR on a
 *   direction flip. Flips re-arm immediately, so reversing always reads as
 *   fresh intent — deltas from opposite directions are never summed together
 *   (summing could net leftover downward inertia against an upward flick and
 *   page the wrong way).
 * - Once a gesture triggers a page turn it is consumed: its trailing inertia
 *   (same direction, no pause) is ignored, even after the scroll animation
 *   ends.
 * - Deltas fed while `blocked` (animating) still advance gesture state, so
 *   inertia stays attached to its consumed gesture. A direction flip is the
 *   one exception: it is accumulated as fresh intent and may interrupt the
 *   in-progress page turn once it reaches the threshold.
 * @param {{gestureGapMs?: number, threshold?: number}} [options]
 * @returns {{feed: (delta: number, now: number, blocked?: boolean) => -1|0|1}}
 *   feed returns the page-turn direction, or 0 for no turn
 */
export function createGestureTracker({ gestureGapMs = 200, threshold = 60 } = {}) {
	let accum = 0;
	let lastTime = -Infinity;
	let dir = 0;
	let consumed = false;
	let interrupting = false;
	return {
		feed(delta, now, blocked = false) {
			if (delta === 0) return 0;
			const fresh = now - lastTime > gestureGapMs;
			lastTime = now;
			const sign = delta > 0 ? 1 : -1;
			const reversed = dir !== 0 && sign !== dir;
			if (fresh || sign !== dir) {
				dir = sign;
				accum = 0;
				consumed = false;
				interrupting = blocked && reversed;
			}
			if ((blocked && !interrupting) || consumed) return 0;
			accum += delta;
			if (Math.abs(accum) < threshold) return 0;
			consumed = true;
			interrupting = false;
			accum = 0;
			return sign;
		}
	};
}
