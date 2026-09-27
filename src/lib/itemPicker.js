import { normalizeStorageLocation } from './stockLocations.js';

const GROUPS = [
	{
		key: 'cold',
		label: 'Cold storage',
		holds: (storage) => Boolean(storage) && storage !== 'Dry Storage'
	},
	{ key: 'dry', label: 'Dry storage', holds: (storage) => storage === 'Dry Storage' },
	{ key: 'other', label: 'Other', holds: (storage) => !storage }
];

/**
 * An item's canonical starting location, or null when it isn't a known one.
 * @param {{ storageType?: string }} item Inventory item.
 * @returns {string | null} 'Freezer', 'Refrigerator', 'Dry Storage' or null.
 */
export function itemStorage(item) {
	try {
		return normalizeStorageLocation(item.storageType);
	} catch {
		return null;
	}
}

/**
 * Items as an item picker lists them: grouped by cold or dry storage, sorted A–Z
 * with numbers in numeric order (#8 before #100), and narrowed to names containing
 * the search text anywhere, ignoring case.
 * @param {Array<{ id: string, name: string, storageType?: string }>} items Inventory items.
 * @param {string} [query] Search text; blank lists everything.
 * @returns {Array<{ key: string, label: string, rows: Array<{ id: string, name: string, storage: string | null, index: number }> }>}
 *   Non-empty groups in display order. `index` is a row's position across all groups,
 *   which is also its keyboard order.
 */
export function pickerGroups(items, query = '') {
	const needle = query.trim().toLowerCase();
	const rows = items
		.map((item) => ({ id: item.id, name: String(item.name ?? ''), storage: itemStorage(item) }))
		.filter((row) => !needle || row.name.toLowerCase().includes(needle))
		.sort((a, b) =>
			a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true })
		);
	let index = 0;
	return GROUPS.map(({ key, label, holds }) => ({
		key,
		label,
		rows: rows.filter((row) => holds(row.storage)).map((row) => ({ ...row, index: index++ }))
	})).filter((group) => group.rows.length);
}
