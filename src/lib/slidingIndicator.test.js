import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { offsetWithin, slidingIndicator } from './slidingIndicator';

describe('offsetWithin', () => {
	it('is the item offset when the container is its offset parent', () => {
		const container = {};
		const item = { offsetLeft: 40, offsetTop: 9, offsetParent: container };
		expect(offsetWithin(item, container)).toEqual({ x: 40, y: 9 });
	});

	it('adds positioned elements (and their borders) between the item and the container', () => {
		const container = {};
		const wrapper = {
			offsetLeft: 100,
			offsetTop: 10,
			clientLeft: 1,
			clientTop: 1,
			offsetParent: container
		};
		const item = { offsetLeft: 8, offsetTop: 4, offsetParent: wrapper };
		expect(offsetWithin(item, container)).toEqual({ x: 109, y: 15 });
	});
});

describe('slidingIndicator', () => {
	/** @type {(() => void)[]} */
	let frames;
	/** @type {(() => void)[]} */
	let observers;
	let disconnect;

	beforeEach(() => {
		frames = [];
		observers = [];
		disconnect = vi.fn();
		vi.stubGlobal('requestAnimationFrame', (callback) => frames.push(callback));
		vi.stubGlobal('cancelAnimationFrame', vi.fn());
		vi.stubGlobal(
			'ResizeObserver',
			class {
				constructor(callback) {
					observers.push(callback);
				}
				observe() {}
				disconnect() {
					disconnect();
				}
			}
		);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	// Runs queued frames, including ones queued while running.
	const runFrames = () => {
		while (frames.length) frames.shift()();
	};

	/** A container holding an indicator and, optionally, a current item. */
	function setup({ current = true, animations } = {}) {
		const indicator = { style: {}, dataset: {} };
		if (animations) indicator.getAnimations = () => animations;
		const container = {
			dataset: {},
			offsetParent: {},
			querySelector: (selector) => {
				if (selector === ':scope > [data-sliding-indicator]') return indicator;
				if (selector === '.link.active') return current ? item : null;
				return null;
			}
		};
		const item = {
			offsetLeft: 120,
			offsetTop: 9,
			offsetWidth: 96,
			offsetHeight: 38,
			offsetParent: container
		};
		return { container, indicator, item };
	}

	it('moves and sizes the indicator onto the current item', () => {
		const { container, indicator } = setup();
		slidingIndicator('.link.active', '/orders')(container);
		runFrames();
		expect(indicator.style).toMatchObject({
			width: '96px',
			height: '38px',
			transform: 'translate(120px, 9px)',
			opacity: '1'
		});
		expect(container.dataset.gliding).toBe('');
		expect(indicator.dataset.ready).toBe('');
	});

	it('fades in where it lands and only takes over once the fade is done', async () => {
		let finish;
		const fade = { finished: new Promise((resolve) => (finish = resolve)) };
		const { container, indicator } = setup({ animations: [fade] });
		slidingIndicator('.link.active', '/orders')(container);
		runFrames();
		expect(indicator.style.opacity).toBe('1');
		// Mid-fade: the item keeps its own highlight and nothing may slide yet.
		expect(container.dataset.gliding).toBeUndefined();
		expect(indicator.dataset.ready).toBeUndefined();

		finish();
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(container.dataset.gliding).toBe('');
		expect(indicator.dataset.ready).toBe('');
	});

	it('reappears without sliding in from where it last was', () => {
		const { container, indicator } = setup();
		// It was on another page, then nothing was current (the home page).
		indicator.dataset.ready = '';
		indicator.style.opacity = '0';
		indicator.style.transform = 'translate(40px, 9px)';
		slidingIndicator('.link.active', '/orders')(container);
		frames.shift()();
		expect(indicator.dataset.ready).toBeUndefined();
		expect(indicator.style.transform).toBe('translate(120px, 9px)');
		expect(indicator.style.opacity).toBe('1');
	});

	it('slides between items once it is showing', () => {
		const { container, indicator, item } = setup();
		slidingIndicator('.link.active', '/items')(container);
		runFrames();
		item.offsetLeft = 260;
		slidingIndicator('.link.active', '/orders')(container);
		runFrames();
		expect(indicator.dataset.ready).toBe('');
		expect(container.dataset.gliding).toBe('');
		expect(indicator.style.transform).toBe('translate(260px, 9px)');
	});

	it('fades out when nothing is current, handing the highlight back to the items', () => {
		const { container, indicator } = setup({ current: false });
		indicator.style.opacity = '1';
		container.dataset.gliding = '';
		slidingIndicator('.link.active', '/')(container);
		runFrames();
		expect(indicator.style.opacity).toBe('0');
		expect(container.dataset.gliding).toBeUndefined();
	});

	it('forgets it was ready while hidden, then fades back in when shown', () => {
		const { container, indicator } = setup();
		indicator.dataset.ready = '';
		container.offsetParent = null;
		slidingIndicator('.link.active', '/orders')(container);
		runFrames();
		expect(indicator.dataset.ready).toBeUndefined();
		expect(indicator.style.opacity).toBe('0');

		container.offsetParent = {};
		observers[0]();
		expect(indicator.style.opacity).toBe('1');
		expect(indicator.dataset.ready).toBeUndefined();
		runFrames();
		expect(indicator.dataset.ready).toBe('');
	});

	it('re-measures when the container resizes and stops watching on cleanup', () => {
		const { container, indicator, item } = setup();
		const cleanup = slidingIndicator('.link.active', '/orders')(container);
		runFrames();
		item.offsetLeft = 80;
		observers[0]();
		expect(indicator.style.transform).toBe('translate(80px, 9px)');
		cleanup();
		expect(disconnect).toHaveBeenCalled();
		expect(cancelAnimationFrame).toHaveBeenCalled();
	});

	it('does nothing without an indicator', () => {
		const container = { dataset: {}, offsetParent: {}, querySelector: () => null };
		const cleanup = slidingIndicator('.link.active', '/orders')(container);
		expect(frames).toHaveLength(0);
		expect(() => cleanup()).not.toThrow();
	});
});
