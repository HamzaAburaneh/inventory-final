import { describe, it, expect, beforeEach } from 'vitest';
import { setActiveGroupId, getActiveGroupId, requireActiveGroupId } from './activeGroup';

describe('activeGroup', () => {
	beforeEach(() => setActiveGroupId(null));

	it('returns null when no group is set', () => {
		expect(getActiveGroupId()).toBe(null);
	});

	it('stores and returns the active group id', () => {
		setActiveGroupId('g1');
		expect(getActiveGroupId()).toBe('g1');
		expect(requireActiveGroupId()).toBe('g1');
	});

	it('treats an empty string as no group', () => {
		setActiveGroupId('');
		expect(getActiveGroupId()).toBe(null);
	});

	it('requireActiveGroupId throws when none is set', () => {
		expect(() => requireActiveGroupId()).toThrow(/No active group/);
	});

	it('clears back to null', () => {
		setActiveGroupId('g1');
		setActiveGroupId(null);
		expect(getActiveGroupId()).toBe(null);
	});
});
