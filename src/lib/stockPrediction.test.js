import { describe, it, expect } from 'vitest';
import { predictStockLevels } from './stockPrediction';

/**
 * @typedef {import('../types').Transaction} Transaction
 */

describe('Stock Prediction', () => {
	it('should return predictions for each item', () => {
		/** @type {Transaction[]} */
		const mockTransactions = [
			{
				id: '1',
				itemId: 'item1',
				itemName: 'Item 1',
				type: 'add',
				previousCount: 0,
				newCount: 10,
				timestamp: new Date('2023-01-01'),
				user: 'user1'
			},
			{
				id: '2',
				itemId: 'item1',
				itemName: 'Item 1',
				type: 'remove',
				previousCount: 10,
				newCount: 5,
				timestamp: new Date('2023-01-02'),
				user: 'user1'
			},
			{
				id: '3',
				itemId: 'item2',
				itemName: 'Item 2',
				type: 'add',
				previousCount: 0,
				newCount: 20,
				timestamp: new Date('2023-01-01'),
				user: 'user2'
			}
		];

		const predictions = predictStockLevels(mockTransactions, 7);

		expect(predictions).toHaveProperty('item1');
		expect(predictions).toHaveProperty('item2');
		expect(predictions['item1']).toHaveLength(7);
		expect(predictions['item2']).toHaveLength(7);
	});

	it('should not count restocks as demand', () => {
		// Day 1: restock 0→100 (not demand), then sell 100→90 (10 sold).
		// Day 2: sell 90→80 (10 sold).
		/** @type {Transaction[]} */
		const mockTransactions = [
			{
				id: '1',
				itemId: 'item1',
				itemName: 'Item 1',
				type: 'add',
				previousCount: 0,
				newCount: 100,
				timestamp: new Date('2023-01-01'),
				user: 'user1'
			},
			{
				id: '2',
				itemId: 'item1',
				itemName: 'Item 1',
				type: 'remove',
				previousCount: 100,
				newCount: 90,
				timestamp: new Date('2023-01-01'),
				user: 'user1'
			},
			{
				id: '3',
				itemId: 'item1',
				itemName: 'Item 1',
				type: 'remove',
				previousCount: 90,
				newCount: 80,
				timestamp: new Date('2023-01-02'),
				user: 'user1'
			}
		];

		const predictions = predictStockLevels(mockTransactions, 7);

		// Daily demand is 10 both days; the +100 restock must not inflate it.
		// (Short history → moving-average fallback, so every value is the mean.)
		predictions['item1'].forEach((value) => expect(value).toBe(10));
	});

	it('should predict zero demand for restock-only items', () => {
		/** @type {Transaction[]} */
		const mockTransactions = [
			{
				id: '1',
				itemId: 'item1',
				itemName: 'Item 1',
				type: 'add',
				previousCount: 0,
				newCount: 50,
				timestamp: new Date('2023-01-01'),
				user: 'user1'
			}
		];

		const predictions = predictStockLevels(mockTransactions, 7);

		expect(predictions).toHaveProperty('item1');
		predictions['item1'].forEach((value) => expect(value).toBe(0));
	});

	it('should use fallback prediction for insufficient data', () => {
		/** @type {Transaction[]} */
		const mockTransactions = [
			{
				id: '1',
				itemId: 'item1',
				itemName: 'Item 1',
				type: 'add',
				previousCount: 0,
				newCount: 10,
				timestamp: new Date('2023-01-01'),
				user: 'user1'
			}
		];

		const predictions = predictStockLevels(mockTransactions, 7);

		expect(predictions).toHaveProperty('item1');
		expect(predictions['item1']).toHaveLength(7);
		expect(new Set(predictions['item1']).size).toBe(1); // All values should be the same (average)
	});
});
