/**
 * Where an item sits inside a positioned container, in the container's own
 * coordinates. `offsetLeft`/`offsetTop` only reach the nearest positioned ancestor,
 * so the offsets of any positioned elements in between (and their borders) are
 * added until the container is reached.
 * @param {{ offsetLeft: number, offsetTop: number, offsetParent: unknown }} item
 * @param {unknown} container The positioned element the indicator is placed in.
 * @returns {{ x: number, y: number }} The item's top-left corner.
 */
export function offsetWithin(item, container) {
	let x = item.offsetLeft;
	let y = item.offsetTop;
	let parent = /** @type {any} */ (item.offsetParent);
	while (parent && parent !== container) {
		x += parent.offsetLeft + (parent.clientLeft || 0);
		y += parent.offsetTop + (parent.clientTop || 0);
		parent = parent.offsetParent;
	}
	return { x, y };
}

/**
 * Attachment for a positioned container whose direct child
 * `[data-sliding-indicator]` highlights the current item: the indicator is sized
 * and moved onto that item, so the highlight glides between items instead of
 * jumping. Pass whatever decides the current item as `_key`; a new value re-runs
 * the attachment and re-measures.
 *
 * When the indicator appears (first placement, after nothing was current, or
 * after the container was hidden) it fades in where it lands instead of sliding
 * in from an old spot: `data-ready`, the CSS hook for the slide transition, is
 * only set once that fade has finished. Style it so that without `data-ready`
 * only opacity transitions. The container gets `data-gliding` at the same moment,
 * so the current item can drop its own highlight, which covers everything up to
 * then (and would otherwise dip as the two cross-fade).
 * @param {string} selector The current item inside the container.
 * @param {unknown} [_key] Value that decides the current item.
 * @returns {(container: HTMLElement) => () => void} Svelte attachment.
 */
export function slidingIndicator(selector, _key) {
	return (container) => {
		const indicator = /** @type {HTMLElement | null} */ (
			container.querySelector(':scope > [data-sliding-indicator]')
		);
		if (!indicator) return () => {};

		const shown = () => indicator.style.opacity === '1';

		const handOver = () => {
			if (container.offsetParent === null || !shown()) return;
			container.dataset.gliding = '';
			indicator.dataset.ready = '';
		};

		const hide = () => {
			indicator.style.opacity = '0';
			delete container.dataset.gliding;
		};

		const place = () => {
			if (container.offsetParent === null) {
				delete indicator.dataset.ready;
				hide();
				return;
			}
			const item = /** @type {HTMLElement | null} */ (container.querySelector(selector));
			if (!item) {
				hide();
				return;
			}
			const appearing = !shown();
			if (appearing) delete indicator.dataset.ready;
			const { x, y } = offsetWithin(item, container);
			indicator.style.width = `${item.offsetWidth}px`;
			indicator.style.height = `${item.offsetHeight}px`;
			indicator.style.transform = `translate(${x}px, ${y}px)`;
			if (!appearing) return;

			indicator.style.opacity = '1';
			// Hand over once the fade-in is done; with no fade (reduced motion), next frame.
			const fades = typeof indicator.getAnimations === 'function' ? indicator.getAnimations() : [];
			if (fades.length) Promise.all(fades.map((fade) => fade.finished)).then(handOver, handOver);
			else requestAnimationFrame(handOver);
		};

		// Measure once the new current item has its class.
		const frame = requestAnimationFrame(place);
		const observer = new ResizeObserver(place);
		observer.observe(container);
		return () => {
			cancelAnimationFrame(frame);
			observer.disconnect();
		};
	};
}
