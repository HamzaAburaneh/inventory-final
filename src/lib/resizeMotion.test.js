import { describe, it, expect } from 'vitest';
import { animationResizes, revealStyle } from './resizeMotion';

const box = {
	height: 60,
	paddingTop: 8,
	paddingBottom: 8,
	borderTop: 1,
	borderBottom: 1,
	marginTop: 4,
	marginBottom: 0,
	opacity: 1
};

const declarations = (css) =>
	Object.fromEntries(css.split('; ').map((declaration) => declaration.split(': ')));

describe('revealStyle', () => {
	it('closes the whole footprint, the parent gap included, at the start', () => {
		const start = declarations(revealStyle(box, 14, 'top', 0));
		expect(start).toMatchObject({
			height: '0px',
			'padding-top': '0px',
			'border-top-width': '0px',
			opacity: '0',
			// The element's own margin is gone and the gap above it is pulled back.
			'margin-top': '-14px',
			'margin-bottom': '0px'
		});
	});

	it('ends on the natural box with the gap restored', () => {
		const end = declarations(revealStyle(box, 14, 'top', 1));
		expect(end).toMatchObject({
			height: '60px',
			'padding-bottom': '8px',
			'border-bottom-width': '1px',
			opacity: '1',
			'margin-top': '4px',
			'margin-bottom': '0px'
		});
	});

	it('pulls the gap from below a first child, and from nowhere for an only child', () => {
		expect(declarations(revealStyle(box, 14, 'bottom', 0))['margin-bottom']).toBe('-14px');
		const alone = declarations(revealStyle(box, 14, null, 0));
		expect([alone['margin-top'], alone['margin-bottom']]).toEqual(['0px', '0px']);
	});
});

describe('animationResizes', () => {
	const keyframes = (...frames) => ({ effect: { getKeyframes: () => frames } });

	it('treats height, margin and padding changes as resizing', () => {
		expect(animationResizes(keyframes({ height: '0px' }, { height: '40px' }))).toBe(true);
		expect(animationResizes({ transitionProperty: 'max-height' })).toBe(true);
		expect(animationResizes({ transitionProperty: 'margin-top' })).toBe(true);
	});

	it('ignores colour, opacity and movement', () => {
		expect(animationResizes(keyframes({ opacity: '0', transform: 'translateY(6px)' }))).toBe(false);
		expect(animationResizes({ transitionProperty: 'background-color' })).toBe(false);
		expect(animationResizes({ effect: null })).toBe(false);
	});
});
