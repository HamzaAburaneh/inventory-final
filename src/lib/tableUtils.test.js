import { describe, expect, it } from 'vitest';
import { motionDuration, rowExitDuration, isLowStock } from './tableUtils.js';

describe('isLowStock', () => {
	it('flags when count is at or below a positive threshold', () => {
		expect(isLowStock({ count: 3, lowCount: 5 })).toBe(true);
		expect(isLowStock({ count: 5, lowCount: 5 })).toBe(true);
		expect(isLowStock({ count: 0, lowCount: 1 })).toBe(true);
	});

	it('does not flag when count is above the threshold', () => {
		expect(isLowStock({ count: 10, lowCount: 5 })).toBe(false);
	});

	it('never flags when no threshold is configured', () => {
		expect(isLowStock({ count: 0, lowCount: 0 })).toBe(false);
		expect(isLowStock({ count: 0 })).toBe(false);
		expect(isLowStock({})).toBe(false);
	});

	it('handles string-typed fields from Firestore', () => {
		expect(isLowStock({ count: '2', lowCount: '5' })).toBe(true);
		expect(isLowStock({ count: '9', lowCount: '5' })).toBe(false);
	});
});

describe('motionDuration', () => {
	it('returns the base duration when motion is allowed', () => {
		expect(motionDuration(200, false)).toBe(200);
		expect(motionDuration(250, false)).toBe(250);
	});

	it('collapses to 0 when the user prefers reduced motion', () => {
		expect(motionDuration(200, true)).toBe(0);
		expect(motionDuration(250, true)).toBe(0);
	});
});

describe('rowExitDuration', () => {
	it('fades out over 150ms for an explicit delete', () => {
		expect(rowExitDuration(true, false)).toBe(150);
	});

	it('removes instantly for search / pagination list replacements', () => {
		// A non-delete removal must resolve in 0ms so the leaving <tr> is never
		// left mid-fade as an absolutely-positioned, column-collapsed row.
		expect(rowExitDuration(false, false)).toBe(0);
	});

	it('removes instantly when the user prefers reduced motion, even on delete', () => {
		expect(rowExitDuration(true, true)).toBe(0);
		expect(rowExitDuration(false, true)).toBe(0);
	});
});
