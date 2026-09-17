export const STORAGE_LOCATIONS = ['Freezer', 'Refrigerator', 'Dry Storage'];

/** @param {unknown} value Legacy location. @returns {string} Canonical location. */
export function normalizeStorageLocation(value) {
	const key = String(value ?? '')
		.trim()
		.toLowerCase();
	const aliases = {
		'': 'Freezer',
		freezer: 'Freezer',
		refrigerator: 'Refrigerator',
		fridge: 'Refrigerator',
		dry: 'Dry Storage',
		'dry storage': 'Dry Storage'
	};
	if (!Object.hasOwn(aliases, key)) throw new Error(`Unknown storage location: ${value}`);
	return aliases[key];
}

/** @param {unknown} value Quantity. @param {boolean} [signed] Allow negatives. @returns {number} Validated integer. */
export function stockInteger(value, signed = false) {
	if (
		!['number', 'string'].includes(typeof value) ||
		value === null ||
		value === undefined ||
		typeof value === 'boolean' ||
		(typeof value === 'string' && !value.trim())
	)
		throw new Error('Enter a whole number.');
	const number = Number(value);
	if (!Number.isSafeInteger(number) || (!signed && number < 0))
		throw new Error('Stock must be a nonnegative whole number within the supported range.');
	return number;
}

/** @returns {Record<string, number>} Empty canonical map. */
export function emptyStock() {
	return { Freezer: 0, Refrigerator: 0, 'Dry Storage': 0 };
}

/** @param {object} item Stored item. @returns {{stockByStorage: Record<string, number>, total: number, locations: string[], storageType: string}} Validated stock. */
export function normalizeItemStock(item) {
	if (
		item.legacyItemIds !== undefined &&
		(!Array.isArray(item.legacyItemIds) ||
			item.legacyItemIds.some((id) => typeof id !== 'string' || !id || id === item.id) ||
			new Set(item.legacyItemIds).size !== item.legacyItemIds.length)
	)
		throw new Error('Invalid legacy item aliases.');
	const storageType = normalizeStorageLocation(item.storageType);
	const locations = storageType === 'Dry Storage' ? ['Dry Storage'] : ['Freezer', 'Refrigerator'];
	const stockByStorage = emptyStock();
	if (item.stockByStorage === undefined) stockByStorage[storageType] = stockInteger(item.count);
	else {
		if (
			!item.stockByStorage ||
			typeof item.stockByStorage !== 'object' ||
			Array.isArray(item.stockByStorage)
		)
			throw new Error('Invalid stock location balances.');
		for (const [key, value] of Object.entries(item.stockByStorage)) {
			if (!STORAGE_LOCATIONS.includes(key)) throw new Error(`Unknown stock balance: ${key}`);
			stockByStorage[key] = stockInteger(value);
		}
	}
	if (STORAGE_LOCATIONS.some((key) => !locations.includes(key) && stockByStorage[key] !== 0))
		throw new Error('Cold and dry stock cannot be combined.');
	const total = stockInteger(Object.values(stockByStorage).reduce((sum, value) => sum + value, 0));
	if (total !== stockInteger(item.count))
		throw new Error(
			'Location balances disagree with the total. Resolve this item before changing stock.'
		);
	return { stockByStorage, total, locations, storageType };
}

/** @param {object} item Stored item. @returns {object} Safe display state, with an error for invalid data. */
export function inspectItemStock(item) {
	try {
		return { ...normalizeItemStock(item), error: null };
	} catch (error) {
		return {
			stockByStorage: emptyStock(),
			total: Number(item.count) || 0,
			locations: [],
			error: error.message
		};
	}
}

/** @param {string} location Canonical location. @returns {string} Display label. */
export function locationLabel(location) {
	return location === 'Refrigerator' ? 'Fridge' : location;
}

/** @param {object} item Item. @returns {string|null} Location an empty item is listed under, or null when it holds stock or is invalid. */
export function emptyStockLocation(item) {
	const state = inspectItemStock(item);
	return !state.error && state.total === 0 ? state.storageType : null;
}

/** @param {object} item Item. @param {string} location Filter. @returns {boolean} Positive balance in the location, or an empty item whose starting location it is; All includes everything. */
export function matchesStockLocation(item, location) {
	if (!location || location === 'all') return true;
	const key = normalizeStorageLocation(location);
	return inspectItemStock(item).stockByStorage[key] > 0 || emptyStockLocation(item) === key;
}

/** @param {object} item Item. @returns {string} Stable location sort key. */
export function stockLocationSortKey(item) {
	const state = inspectItemStock(item);
	return state.error
		? '~invalid'
		: state.locations
				.map((key) => `${key}:${String(state.stockByStorage[key]).padStart(16, '0')}`)
				.join('|');
}

/** @param {object|null} item Item. @returns {string} Conflict condition catches older writers without revisions too. */
export function stockFingerprint(item) {
	if (!item) return 'missing';
	const state = normalizeItemStock(item);
	return JSON.stringify([
		state.storageType,
		state.stockByStorage,
		item.stockRevision ?? null,
		item.legacyItemIds ?? []
	]);
}
