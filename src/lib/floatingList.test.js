import { describe, it, expect } from 'vitest';
import { listPlacement } from './floatingList';

const screen = { top: 0, bottom: 800 };

describe('listPlacement', () => {
	it('opens below when the list fits there', () => {
		expect(listPlacement({ top: 100, bottom: 140 }, 200, screen, 256)).toEqual({
			side: 'bottom',
			maxHeight: 256
		});
	});

	it('keeps a short list below even when there is more room above', () => {
		expect(listPlacement({ top: 600, bottom: 640 }, 100, screen, 256).side).toBe('bottom');
	});

	it('opens above near the bottom of the screen', () => {
		// 800 - 740 - 6 gap - 12 edge leaves 42px below; 722px above.
		expect(listPlacement({ top: 700, bottom: 740 }, 200, screen, 256)).toEqual({
			side: 'top',
			maxHeight: 256
		});
	});

	it('caps the height to the room on its side, but never below a few rows', () => {
		const short = { top: 0, bottom: 300 };
		// 300 - 140 - 18 = 142px below beats 100 - 18 = 82px above.
		expect(listPlacement({ top: 100, bottom: 140 }, 400, short, 256)).toEqual({
			side: 'bottom',
			maxHeight: 142
		});
		// Holding the bottom side with only 42px of room still shows 120px.
		expect(listPlacement({ top: 700, bottom: 740 }, 200, screen, 256, 'bottom')).toEqual({
			side: 'bottom',
			maxHeight: 120
		});
	});

	it('measures from the visible area, such as above an on-screen keyboard', () => {
		const aboveKeyboard = { top: 0, bottom: 420 };
		expect(listPlacement({ top: 330, bottom: 370 }, 200, aboveKeyboard, 256).side).toBe('top');
	});
});
