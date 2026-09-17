import { describe, it, expect } from 'vitest';
import {
	normalizeItemStock,
	inspectItemStock,
	matchesStockLocation,
	emptyStockLocation,
	stockFingerprint
} from './stockLocations';
import { planStockAction } from './stockOperations';

const item = (freezer = 10, fridge = 0) => ({
	id: 'fries',
	name: 'Fries',
	count: freezer + fridge,
	storageType: 'Freezer',
	stockByStorage: { Freezer: freezer, Refrigerator: fridge, 'Dry Storage': 0 }
});
const action = (fields) => ({ id: 'operation', itemId: 'fries', user: 'tester', ...fields });

describe('location normalization', () => {
	it.each([
		[' fridge ', 'Refrigerator'],
		['dry', 'Dry Storage'],
		['', 'Freezer'],
		['FREEZER', 'Freezer']
	])('normalizes %s without writing', (storageType, expected) => {
		const source = { count: '12', storageType };
		expect(normalizeItemStock(source).stockByStorage[expected]).toBe(12);
		expect(source).toEqual({ count: '12', storageType });
	});
	it.each([-1, 1.5, NaN, Infinity, '2x', '', null, Number.MAX_SAFE_INTEGER + 1])(
		'rejects invalid count %s',
		(count) => expect(() => normalizeItemStock({ count })).toThrow()
	);
	it('rejects unknown maps, mixed families and mismatched totals, safely displaying errors', () => {
		for (const source of [
			{ ...item(), stockByStorage: { fridge: 10 } },
			{ ...item(), count: 9 },
			{ ...item(), storageType: 'Dry Storage' },
			{ count: 2, storageType: 'Shed' }
		]) {
			expect(() => normalizeItemStock(source)).toThrow();
			expect(inspectItemStock(source).error).toBeTruthy();
		}
	});
	it('normalizes absent keys and filters positive stock while All includes empty products', () => {
		expect(normalizeItemStock({ count: 2, stockByStorage: { Freezer: 2 } }).stockByStorage).toEqual(
			item(2).stockByStorage
		);
		expect(matchesStockLocation(item(0), 'all')).toBe(true);
		expect(matchesStockLocation(item(2), 'Refrigerator')).toBe(false);
		expect(matchesStockLocation(item(0, 2), 'Refrigerator')).toBe(true);
	});
	it('lists an empty item under its starting location only; invalid items under none', () => {
		expect(emptyStockLocation(item(0))).toBe('Freezer');
		expect(emptyStockLocation(item(0, 2))).toBeNull();
		expect(emptyStockLocation({ count: 0, storageType: 'fridge' })).toBe('Refrigerator');
		expect(matchesStockLocation(item(0), 'Freezer')).toBe(true);
		expect(matchesStockLocation(item(0), 'fridge')).toBe(false);
		const broken = { ...item(0), count: 9 };
		expect(emptyStockLocation(broken)).toBeNull();
		expect(matchesStockLocation(broken, 'Freezer')).toBe(false);
		expect(matchesStockLocation(broken, 'all')).toBe(true);
	});
});

describe('ledgered operation plans', () => {
	it('applies a queued +5 to the latest 8 and records 8 -> 13', () => {
		const result = planStockAction(
			item(8),
			action({ kind: 'adjust', delta: 5, location: 'Freezer' })
		);
		expect(result.item.count).toBe(13);
		expect(result.item.stockByStorage.Freezer).toBe(13);
		expect(result.ledger).toMatchObject({
			previousCount: 8,
			newCount: 13,
			location: 'Freezer',
			operationId: 'operation'
		});
	});
	it('transfers leave totals unchanged and write both maps', () => {
		const result = planStockAction(
			item(8, 2),
			action({ kind: 'transfer', fromLocation: 'Freezer', toLocation: 'Refrigerator', quantity: 3 })
		);
		expect(result.item.stockByStorage).toEqual(item(5, 5).stockByStorage);
		expect(result.ledger).toMatchObject({
			type: 'transfer',
			event: 'stockTransfer',
			previousCount: 10,
			newCount: 10,
			previousStockByStorage: item(8, 2).stockByStorage,
			newStockByStorage: item(5, 5).stockByStorage
		});
	});
	it.each([
		{ kind: 'adjust', delta: -11, location: 'Freezer' },
		{ kind: 'adjust', delta: 1 },
		{ kind: 'adjust', delta: 1, location: 'Dry Storage' },
		{ kind: 'transfer', fromLocation: 'Freezer', toLocation: 'Refrigerator', quantity: 11 },
		{ kind: 'transfer', fromLocation: 'Freezer', toLocation: 'Freezer', quantity: 1 }
	])('rejects invalid/insufficient operations without mutation', (fields) => {
		const source = item();
		expect(() => planStockAction(source, action(fields))).toThrow();
		expect(source).toEqual(item());
	});
	it('no-op does not create phantom history or revision', () =>
		expect(
			planStockAction(item(), action({ kind: 'adjust', location: 'Freezer', delta: 0 }))
		).toEqual({ item: item(), ledger: null }));
	it('sets one balance and resets all locations with revision protection', () => {
		const source = item(4, 6);
		const expectedStock = stockFingerprint(source);
		expect(
			planStockAction(
				source,
				action({ kind: 'set', quantity: 2, location: 'Freezer', expectedStock })
			).item.count
		).toBe(8);
		const reset = action({ kind: 'reset', expectedStock });
		expect(planStockAction(source, reset).item.count).toBe(0);
		expect(() => planStockAction(item(5, 6), reset)).toThrow('Stock changed');
		expect(() => planStockAction({ ...source, stockRevision: 'someone-else' }, reset)).toThrow(
			'Stock changed'
		);
	});
	it('create and delete have opening/final maps; deletion never recreates a missing item', () => {
		const created = planStockAction(null, action({ kind: 'create', item: item(3, 2) }));
		expect(created.ledger).toMatchObject({ event: 'itemCreated', previousCount: 0, newCount: 5 });
		const deleted = planStockAction(
			created.item,
			action({ kind: 'delete', expectedStock: stockFingerprint(created.item) })
		);
		expect(deleted.item).toBeNull();
		expect(deleted.ledger).toMatchObject({ event: 'itemDeleted', previousCount: 5, newCount: 0 });
		expect(() =>
			planStockAction(null, action({ kind: 'adjust', delta: 1, location: 'Freezer' }))
		).toThrow('deleted or merged');
	});
});
