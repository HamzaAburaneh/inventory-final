import { describe, it, expect } from 'vitest';
import { findClockAnomalies } from './transactionAudit';

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

/**
 * @param {object} over - Overrides.
 * @returns {import('../types').Transaction} A minimal transaction.
 */
function tx(over) {
	return {
		id: 't',
		itemId: 'i',
		itemName: 'Fries',
		type: 'remove',
		previousCount: 10,
		newCount: 9,
		user: 'user',
		timestamp: new Date('2026-07-01T12:00:00Z'),
		syncedAt: new Date('2026-07-01T12:00:00Z'),
		...over
	};
}

describe('findClockAnomalies', () => {
	it('passes a normal online write (timestamp ≈ syncedAt)', () => {
		const t = new Date('2026-07-01T12:00:00Z');
		const s = new Date(t.getTime() + 200); // 200ms server processing
		expect(findClockAnomalies([tx({ timestamp: t, syncedAt: s })])).toEqual([]);
	});

	it('passes a legitimate short offline write (synced 30 min later)', () => {
		const t = new Date('2026-07-01T12:00:00Z');
		const s = new Date(t.getTime() + 30 * MINUTE);
		expect(findClockAnomalies([tx({ timestamp: t, syncedAt: s })])).toEqual([]);
	});

	it('flags a future timestamp (clock set ahead) — impossible to sync before it happened', () => {
		const s = new Date('2026-07-01T12:00:00Z');
		const t = new Date(s.getTime() + 7 * DAY); // device claims a week in the future
		const result = findClockAnomalies([tx({ timestamp: t, syncedAt: s })]);
		expect(result).toHaveLength(1);
		expect(result[0].kind).toBe('future');
		expect(result[0].gapMs).toBeLessThan(0);
	});

	it('flags a stale timestamp (clock set a week behind) for review', () => {
		const s = new Date('2026-07-08T12:00:00Z');
		const t = new Date(s.getTime() - 7 * DAY); // device claims a week ago
		const result = findClockAnomalies([tx({ timestamp: t, syncedAt: s })]);
		expect(result).toHaveLength(1);
		expect(result[0].kind).toBe('stale');
		expect(result[0].gapMs).toBeGreaterThan(0);
	});

	it('skips records that cannot be audited (missing syncedAt)', () => {
		expect(findClockAnomalies([tx({ syncedAt: null })])).toEqual([]);
		expect(findClockAnomalies([tx({ syncedAt: undefined })])).toEqual([]);
	});

	it('respects a custom future tolerance', () => {
		const s = new Date('2026-07-01T12:00:00Z');
		const t = new Date(s.getTime() + 3 * MINUTE); // 3 min ahead
		// Default 5-min tolerance: fine. Tighter 1-min tolerance: flagged.
		expect(findClockAnomalies([tx({ timestamp: t, syncedAt: s })])).toEqual([]);
		const strict = findClockAnomalies([tx({ timestamp: t, syncedAt: s })], {
			futureToleranceMs: MINUTE
		});
		expect(strict).toHaveLength(1);
		expect(strict[0].kind).toBe('future');
	});

	it('ranks the most extreme gap first', () => {
		const s = new Date('2026-07-30T12:00:00Z');
		const mild = tx({ id: 'mild', timestamp: new Date(s.getTime() - 3 * DAY), syncedAt: s });
		const wild = tx({ id: 'wild', timestamp: new Date(s.getTime() - 20 * DAY), syncedAt: s });
		const result = findClockAnomalies([mild, wild]);
		expect(result.map((a) => a.transaction.id)).toEqual(['wild', 'mild']);
	});
});
