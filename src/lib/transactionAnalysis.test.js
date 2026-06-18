import { describe, it, expect } from 'vitest';
import {
	computeDailyAnalysis,
	computeHourlyActivityPattern,
	computeTopMovers,
	computeSummaryStats
} from './transactionAnalysis';

/**
 * @typedef {import('../types').Transaction} Transaction
 */

/**
 * Build a transaction with sane defaults.
 * @param {Partial<Transaction>} overrides
 * @returns {Transaction}
 */
function tx(overrides = {}) {
	return {
		id: '1',
		itemId: 'item1',
		itemName: 'Item 1',
		type: 'add',
		previousCount: 0,
		newCount: 10,
		timestamp: new Date('2023-01-01T09:00:00'),
		user: 'user1',
		...overrides
	};
}

describe('computeDailyAnalysis', () => {
	it('fills every day in the range, even with no transactions (empty window)', () => {
		const start = new Date('2023-01-01T00:00:00Z');
		const end = new Date('2023-01-03T00:00:00Z');
		const result = computeDailyAnalysis([], start, end);

		expect(result).toHaveLength(3);
		expect(result.every((d) => d.transactionCount === 0)).toBe(true);
		expect(result.every((d) => d.netChange === 0)).toBe(true);
	});

	it('aggregates added/removed/net per day', () => {
		const start = new Date('2023-01-01T00:00:00Z');
		const end = new Date('2023-01-01T23:59:59Z');
		const result = computeDailyAnalysis(
			[
				tx({ timestamp: new Date('2023-01-01T09:00:00Z'), previousCount: 0, newCount: 10 }),
				tx({
					timestamp: new Date('2023-01-01T10:00:00Z'),
					type: 'remove',
					previousCount: 10,
					newCount: 4
				})
			],
			start,
			end
		);

		const day = result.find((d) => d.date === '2023-01-01');
		expect(day.totalAdded).toBe(10);
		expect(day.totalRemoved).toBe(6);
		expect(day.netChange).toBe(4);
		expect(day.transactionCount).toBe(2);
	});
});

describe('computeHourlyActivityPattern', () => {
	it('always returns 24 zeroed buckets for an empty window', () => {
		const result = computeHourlyActivityPattern([]);
		expect(result).toHaveLength(24);
		expect(result.every((h) => h.transactionCount === 0)).toBe(true);
	});

	it('buckets a single transaction into its local hour', () => {
		const result = computeHourlyActivityPattern([
			tx({ timestamp: new Date('2023-01-01T09:30:00'), previousCount: 0, newCount: 5 })
		]);
		const nine = result.find((h) => h.hour === 9);
		expect(nine.transactionCount).toBe(1);
		expect(nine.totalChange).toBe(5);
	});
});

describe('computeTopMovers', () => {
	it('returns an empty array for an empty window (no NaN/divide-by-zero)', () => {
		expect(computeTopMovers([])).toEqual([]);
	});

	it('yields zero volatility for a single-transaction item', () => {
		const result = computeTopMovers([tx({ previousCount: 0, newCount: 10 })]);
		expect(result).toHaveLength(1);
		expect(result[0].volatility).toBe(0);
		expect(Number.isNaN(result[0].volatility)).toBe(false);
		expect(result[0].totalTransactions).toBe(1);
	});

	it('ranks by transaction count and respects the limit', () => {
		const transactions = [
			tx({ itemId: 'a', itemName: 'A' }),
			tx({ itemId: 'a', itemName: 'A' }),
			tx({ itemId: 'b', itemName: 'B' })
		];
		const result = computeTopMovers(transactions, 1);
		expect(result).toHaveLength(1);
		expect(result[0].itemId).toBe('a');
		expect(result[0].totalTransactions).toBe(2);
	});
});

describe('computeSummaryStats', () => {
	it('returns zeroed stats for an empty window', () => {
		const result = computeSummaryStats([], 5);
		expect(result.totalTransactions).toBe(0);
		expect(result.totalAdded).toBe(0);
		expect(result.totalRemoved).toBe(0);
		expect(result.netChange).toBe(0);
		expect(result.uniqueItems).toBe(0);
		expect(result.totalItems).toBe(5);
		expect(result.inactiveItems).toBe(5);
	});

	it('counts new items, deletions, and active/inactive split', () => {
		const result = computeSummaryStats(
			[
				tx({ itemId: 'a', type: 'add', previousCount: 0, newCount: 10 }),
				tx({ itemId: 'a', type: 'remove', previousCount: 10, newCount: 0 }),
				tx({ itemId: 'b', type: 'add', previousCount: 3, newCount: 8 })
			],
			4
		);

		expect(result.totalTransactions).toBe(3);
		expect(result.totalAdded).toBe(15); // 10 + 5
		expect(result.totalRemoved).toBe(10);
		expect(result.netChange).toBe(5);
		expect(result.newItemsCreated).toBe(1); // a: add from 0
		expect(result.itemsDeleted).toBe(1); // a: remove to 0
		expect(result.uniqueItems).toBe(2); // a, b
		expect(result.totalItems).toBe(4);
		expect(result.inactiveItems).toBe(2);
	});
});
