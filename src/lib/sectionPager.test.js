import { describe, expect, it } from 'vitest';
import { createGestureTracker, nextTarget, normalizeWheelDelta } from './sectionPager.js';

describe('normalizeWheelDelta', () => {
	it('passes pixel deltas through', () => {
		expect(normalizeWheelDelta(120, 0, 800)).toBe(120);
		expect(normalizeWheelDelta(-53, 0, 800)).toBe(-53);
	});

	it('scales line deltas (Firefox wheel) so they can reach the threshold', () => {
		expect(normalizeWheelDelta(3, 1, 800)).toBe(48);
		expect(normalizeWheelDelta(-3, 1, 800)).toBe(-48);
	});

	it('scales page deltas by viewport height', () => {
		expect(normalizeWheelDelta(1, 2, 800)).toBe(800);
	});
});

describe('nextTarget', () => {
	const list = [0, 700, 1400, 2100];

	it('scrolling down picks the next target strictly below the position', () => {
		expect(nextTarget(list, 0, 1)).toBe(700);
		expect(nextTarget(list, 700, 1)).toBe(1400);
		// off-position landing between sections still moves down, never back up
		expect(nextTarget(list, 1000, 1)).toBe(1400);
	});

	it('scrolling up picks the next target strictly above the position', () => {
		expect(nextTarget(list, 2100, -1)).toBe(1400);
		// off-position landing: up ALWAYS resolves above the current position,
		// even when the nearest section is below (the old nearest±1 logic
		// could get this wrong)
		expect(nextTarget(list, 1300, -1)).toBe(700);
		expect(nextTarget(list, 750, -1)).toBe(700);
	});

	it('returns undefined at either end', () => {
		expect(nextTarget(list, 0, -1)).toBeUndefined();
		expect(nextTarget(list, 2100, 1)).toBeUndefined();
	});

	it('ignores targets within the 2px dead zone', () => {
		expect(nextTarget(list, 699, 1)).toBe(1400);
		expect(nextTarget(list, 701, -1)).toBe(0);
	});

	it('handles duplicate clamped targets at the bottom', () => {
		const clamped = [0, 700, 1400, 1400];
		expect(nextTarget(clamped, 1400, 1)).toBeUndefined();
		expect(nextTarget(clamped, 1400, -1)).toBe(700);
	});
});

describe('createGestureTracker', () => {
	it('one deliberate flick pages once in its own direction', () => {
		const t = createGestureTracker();
		expect(t.feed(120, 0)).toBe(1);
		const u = createGestureTracker();
		expect(u.feed(-120, 0)).toBe(-1);
	});

	it('small deltas accumulate to the threshold within a gesture', () => {
		const t = createGestureTracker();
		expect(t.feed(25, 0)).toBe(0);
		expect(t.feed(25, 50)).toBe(0);
		expect(t.feed(25, 100)).toBe(1);
	});

	it('jitter below the threshold never pages', () => {
		const t = createGestureTracker();
		expect(t.feed(10, 0)).toBe(0);
		// 300ms pause = new gesture, accumulator resets
		expect(t.feed(10, 300)).toBe(0);
		expect(t.feed(10, 600)).toBe(0);
	});

	it('trailing inertia after a page turn never re-triggers, even after the animation ends', () => {
		const t = createGestureTracker();
		expect(t.feed(120, 0)).toBe(1);
		// decaying tail while the scroll animation runs (blocked)
		expect(t.feed(80, 50, true)).toBe(0);
		expect(t.feed(60, 100, true)).toBe(0);
		// animation finished, tail keeps coming — same gesture, stays consumed
		expect(t.feed(40, 150)).toBe(0);
		expect(t.feed(25, 220)).toBe(0);
		expect(t.feed(15, 290)).toBe(0);
	});

	it('a fresh gesture after a pause pages again', () => {
		const t = createGestureTracker();
		expect(t.feed(120, 0)).toBe(1);
		expect(t.feed(120, 500)).toBe(1);
	});

	it('reversing against leftover inertia pages UP, never down (regression)', () => {
		const t = createGestureTracker();
		expect(t.feed(120, 0)).toBe(1);
		// inertia from the down flick is still streaming...
		expect(t.feed(50, 60, true)).toBe(0);
		expect(t.feed(30, 120, true)).toBe(0);
		// ...when the user flicks up: the flip re-arms immediately and the up
		// delta is never netted against the leftover positive accumulation
		expect(t.feed(-120, 160)).toBe(-1);
	});

	it('mixed-direction deltas within one stream never page opposite to the latest direction', () => {
		const t = createGestureTracker();
		expect(t.feed(40, 0)).toBe(0);
		expect(t.feed(15, 50)).toBe(0); // +55 accumulated, below threshold
		// user reverses: flip resets the accumulator, so the old +55 cannot
		// combine with anything to fire a downward turn
		expect(t.feed(-30, 100)).toBe(0);
		expect(t.feed(-40, 150)).toBe(-1);
	});

	it('deltas during the animation stay attached to the consumed gesture', () => {
		const t = createGestureTracker();
		expect(t.feed(120, 0)).toBe(1);
		// a same-direction burst >gap later but while still blocked: it starts
		// a new gesture but cannot page while blocked
		expect(t.feed(120, 400, true)).toBe(0);
		// once unblocked, its continuation may page (deliberate double scroll)
		expect(t.feed(120, 450)).toBe(1);
	});
});
