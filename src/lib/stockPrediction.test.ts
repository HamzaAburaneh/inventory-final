import { describe, it, expect } from 'vitest';
import { predictStockLevels } from './stockPrediction';
import type { Transaction } from '../types';

describe('Stock Prediction', () => {
	it('should return predictions for each item', () => {
		const mockTransactions: Transaction[] = [
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

	it('should use fallback prediction for insufficient data', () => {
		const mockTransactions: Transaction[] = [
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
