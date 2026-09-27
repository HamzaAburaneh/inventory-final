import { describe, it, expect } from 'vitest';
import { itemStorage, pickerGroups } from './itemPicker';

const items = [
	{ id: 'a', name: '#100', storageType: 'Freezer' },
	{ id: 'b', name: '#8', storageType: 'fridge' },
	{ id: 'c', name: 'cheese curds', storageType: 'Refrigerator' },
	{ id: 'd', name: 'Bleach (bottles)', storageType: 'dry' },
	{ id: 'e', name: 'Mystery', storageType: 'attic' }
];

describe('itemStorage', () => {
	it('normalizes legacy names and returns null for unknown ones', () => {
		expect(itemStorage({ storageType: 'dry storage' })).toBe('Dry Storage');
		expect(itemStorage({ storageType: ' Fridge ' })).toBe('Refrigerator');
		expect(itemStorage({ storageType: 'attic' })).toBeNull();
	});
});

describe('pickerGroups', () => {
	it('groups cold and dry storage, legacy names included, with numbers in numeric order', () => {
		expect(pickerGroups(items)).toEqual([
			{
				key: 'cold',
				label: 'Cold storage',
				rows: [
					{ id: 'b', name: '#8', storage: 'Refrigerator', index: 0 },
					{ id: 'a', name: '#100', storage: 'Freezer', index: 1 },
					{ id: 'c', name: 'cheese curds', storage: 'Refrigerator', index: 2 }
				]
			},
			{
				key: 'dry',
				label: 'Dry storage',
				rows: [{ id: 'd', name: 'Bleach (bottles)', storage: 'Dry Storage', index: 3 }]
			},
			{
				key: 'other',
				label: 'Other',
				rows: [{ id: 'e', name: 'Mystery', storage: null, index: 4 }]
			}
		]);
	});

	it('finds any part of a name, ignoring case and spaces around the search', () => {
		expect(pickerGroups(items, '  CURDS ')).toEqual([
			{
				key: 'cold',
				label: 'Cold storage',
				rows: [{ id: 'c', name: 'cheese curds', storage: 'Refrigerator', index: 0 }]
			}
		]);
		expect(pickerGroups(items, 'zzz')).toEqual([]);
	});
});
