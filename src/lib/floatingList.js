// Gap between a list and its box, and the margin kept from the screen edge, in px.
const GAP = 6;
const EDGE = 12;
// Even when squeezed, show a few rows rather than a sliver.
const MIN_HEIGHT = 120;

/**
 * Where a dropdown list goes: below its box when it fits there, or fits better
 * than above; otherwise above. Its height is capped to the room on that side.
 * @param {{ top: number, bottom: number }} anchor The box's rect, in viewport px.
 * @param {number} listHeight The list's full height, in px.
 * @param {{ top: number, bottom: number }} visible The visible part of the viewport, in px.
 * @param {number} maxHeight The tallest the list may be, in px.
 * @param {'bottom' | 'top'} [side] Keep this side instead of choosing one.
 * @returns {{ side: 'bottom' | 'top', maxHeight: number }} Placement.
 */
export function listPlacement(anchor, listHeight, visible, maxHeight, side) {
	const below = visible.bottom - anchor.bottom - GAP - EDGE;
	const above = anchor.top - visible.top - GAP - EDGE;
	const wanted = Math.min(listHeight, maxHeight);
	const chosen = side ?? (below >= wanted || below >= above ? 'bottom' : 'top');
	const room = chosen === 'bottom' ? below : above;
	return { side: chosen, maxHeight: Math.min(maxHeight, Math.max(room, MIN_HEIGHT)) };
}

/**
 * Attachment that floats a dropdown list over everything beside its box, the way a
 * native select does: in the top layer (above an open dialog and never clipped by
 * it), as wide as the box, below it or above it when there's more room there, and
 * following the box while open. It sets `--list-from` so an entrance can drop
 * toward the box. Give the element `popover="manual"`.
 * @param {() => Element | null | undefined} getAnchor Returns the box the list belongs to.
 * @param {{ maxHeight?: number, scroller?: string }} [options] `maxHeight` in px, and
 *   `scroller` selecting an inner element that scrolls when the list itself doesn't.
 * @returns {(node: HTMLElement) => () => void} Svelte attachment.
 */
export function floatingList(getAnchor, { maxHeight = 256, scroller } = {}) {
	return (node) => {
		const popover = typeof node.showPopover === 'function' && node.hasAttribute('popover');
		if (popover) node.showPopover();
		node.style.position = 'fixed';
		node.style.inset = 'auto';
		node.style.margin = '0';

		/** @type {'bottom' | 'top' | undefined} */
		let side;
		let frame = 0;
		const setPx = (property, value) => {
			const next = `${Math.round(value * 10) / 10}px`;
			if (node.style[property] !== next) node.style[property] = next;
		};
		const naturalHeight = () => {
			const inner = scroller ? node.querySelector(scroller) : null;
			return inner
				? node.scrollHeight - inner.clientHeight + inner.scrollHeight
				: node.scrollHeight;
		};
		const place = () => {
			const anchor = getAnchor();
			if (anchor?.isConnected) {
				const rect = anchor.getBoundingClientRect();
				const view = window.visualViewport;
				const visible = view
					? { top: view.offsetTop, bottom: view.offsetTop + view.height }
					: { top: 0, bottom: window.innerHeight };
				const placed = listPlacement(rect, naturalHeight(), visible, maxHeight, side);
				if (!side) {
					// Chosen once per opening, so the list doesn't hop sides as it filters.
					side = placed.side;
					node.dataset.side = side;
					node.style.setProperty('--list-from', side === 'bottom' ? '-6px' : '6px');
				}
				setPx('left', rect.left);
				setPx('width', rect.width);
				setPx('maxHeight', placed.maxHeight);
				setPx('top', side === 'bottom' ? rect.bottom + GAP : rect.top - GAP - node.offsetHeight);
			}
			frame = requestAnimationFrame(place);
		};
		place();

		return () => {
			cancelAnimationFrame(frame);
			if (popover && node.matches(':popover-open')) node.hidePopover();
		};
	};
}
