import { describe, it, expect, vi } from 'vitest';
import { closeOnBackdrop, isBackdropHit } from './dialogBackdrop';

// A 200px card at (100, 100). Events on the backdrop target the dialog itself.
function fakeDialog() {
	const listeners = new Map();
	const dialog = {
		getBoundingClientRect: () => ({ left: 100, right: 300, top: 100, bottom: 300 }),
		addEventListener: (type, listener) => listeners.set(type, listener),
		removeEventListener: (type, listener) => {
			if (listeners.get(type) === listener) listeners.delete(type);
		},
		fire: (type, event) => listeners.get(type)?.(event)
	};
	return { dialog, listeners };
}

const at = (target, clientX, clientY) => ({ target, clientX, clientY });

describe('isBackdropHit', () => {
	it('counts the dialog as the target only outside the card', () => {
		const { dialog } = fakeDialog();
		expect(isBackdropHit(at(dialog, 20, 20), dialog)).toBe(true);
		expect(isBackdropHit(at(dialog, 310, 200), dialog)).toBe(true);
		// The card's own padding.
		expect(isBackdropHit(at(dialog, 104, 104), dialog)).toBe(false);
	});

	it('ignores anything inside the card', () => {
		const { dialog } = fakeDialog();
		expect(isBackdropHit(at({}, 20, 20), dialog)).toBe(false);
	});
});

describe('closeOnBackdrop', () => {
	it('closes on a press and release on the backdrop', () => {
		const { dialog } = fakeDialog();
		const onclose = vi.fn();
		closeOnBackdrop(onclose)(dialog);
		dialog.fire('pointerdown', at(dialog, 20, 20));
		dialog.fire('click', at(dialog, 20, 20));
		expect(onclose).toHaveBeenCalledTimes(1);
	});

	it('stays open when a drag from inside the card is released on the backdrop', () => {
		const { dialog } = fakeDialog();
		const onclose = vi.fn();
		const input = {};
		closeOnBackdrop(onclose)(dialog);
		dialog.fire('pointerdown', at(input, 150, 150));
		// The browser reports the release as a click on the dialog, their common ancestor.
		dialog.fire('click', at(dialog, 20, 20));
		expect(onclose).not.toHaveBeenCalled();
		// The next real backdrop click still closes.
		dialog.fire('pointerdown', at(dialog, 20, 20));
		dialog.fire('click', at(dialog, 20, 20));
		expect(onclose).toHaveBeenCalledTimes(1);
	});

	it('stays open when a press on the backdrop is released inside the card', () => {
		const { dialog } = fakeDialog();
		const onclose = vi.fn();
		closeOnBackdrop(onclose)(dialog);
		dialog.fire('pointerdown', at(dialog, 20, 20));
		dialog.fire('click', at(dialog, 150, 150));
		expect(onclose).not.toHaveBeenCalled();
	});

	it('stops listening when removed', () => {
		const { dialog, listeners } = fakeDialog();
		const cleanup = closeOnBackdrop(() => {})(dialog);
		expect(listeners.size).toBe(2);
		cleanup();
		expect(listeners.size).toBe(0);
	});
});
