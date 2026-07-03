import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { queuedWrites, markQueued, markSynced } from './syncQueue';

describe('syncQueue', () => {
	beforeEach(() => {
		// The store is module-level state shared across tests; drain it to 0.
		// markSynced floors at 0, so extra calls are harmless.
		for (let i = 0; i < 10; i++) markSynced();
	});

	it('starts drained', () => {
		expect(get(queuedWrites)).toBe(0);
	});

	it('increments as offline writes are queued', () => {
		markQueued();
		markQueued();
		expect(get(queuedWrites)).toBe(2);
	});

	it('decrements as queued writes sync', () => {
		markQueued();
		markQueued();
		markQueued();
		markSynced();
		expect(get(queuedWrites)).toBe(2);
	});

	it('never goes below zero', () => {
		markSynced();
		markSynced();
		expect(get(queuedWrites)).toBe(0);
	});

	it('returns to zero once every queued write has synced', () => {
		markQueued();
		markQueued();
		markSynced();
		markSynced();
		expect(get(queuedWrites)).toBe(0);
	});
});
