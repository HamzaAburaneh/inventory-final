/**
 * Utility functions for table formatting and styling
 */

export function capitalizeWords(str) {
	return str
		.split(' ')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ');
}

export function formatCost(cost) {
	if (cost == null || cost === '') return '';
	const numericCost = parseFloat(cost);
	return !isNaN(numericCost) ? `$ ${numericCost.toFixed(2)}` : '';
}

export function formatTotalValue(count, cost) {
	if (count == null || cost == null || count === '' || cost === '') return '';
	const numericCount = parseFloat(count);
	const numericCost = parseFloat(cost);
	if (isNaN(numericCount) || isNaN(numericCost)) return '';
	const totalValue = numericCount * numericCost;
	return `$ ${totalValue.toFixed(2)}`;
}

export function formatBooths(booths) {
	if (!booths || booths.length === 0) return [];
	const boothArray = Array.isArray(booths) ? booths : [booths];
	return boothArray.map((booth) => booth.charAt(0).toUpperCase() + booth.slice(1).toLowerCase());
}

/**
 * Map a storage type to its badge CSS modifier class. The actual soft-tint
 * colors live in TableCell's styles (per-theme via `[data-theme]`).
 * @param {string} storageType - the item's storage type
 * @returns {string} 'freezer' | 'refrigerator' | 'dry-storage' | 'unset'
 */
export function getStorageTypeClass(storageType) {
	switch ((storageType || '').toLowerCase()) {
		case 'freezer':
			return 'freezer';
		case 'refrigerator':
			return 'refrigerator';
		case 'dry storage':
			return 'dry-storage';
		default:
			return 'unset';
	}
}

/**
 * Whether an item is at or below its low-stock threshold.
 * A threshold of 0 (or missing) means "no alert configured", so it never flags.
 * @param {{ count?: number|string, lowCount?: number|string }} item
 * @returns {boolean} true when stock has reached the low-stock alert level
 */
export function isLowStock(item) {
	const count = parseFloat(item?.count) || 0;
	const low = parseFloat(item?.lowCount) || 0;
	return low > 0 && count <= low;
}

/**
 * Map a storage type to an icon name understood by `Icon.svelte`.
 * @param {string} storageType - the item's storage type
 * @returns {string} the icon name (defaults to 'package')
 */
export function getStorageTypeIcon(storageType) {
	switch ((storageType || '').toLowerCase()) {
		case 'freezer':
			return 'snowflake';
		case 'refrigerator':
			return 'thermometer';
		case 'dry storage':
			return 'package';
		default:
			return 'package';
	}
}

export function getBoothStyle(booth) {
	const boothColors = {
		freshly: { backgroundColor: '#10B981', color: '#FFFFFF' },
		b1: { backgroundColor: '#3B82F6', color: '#FFFFFF' },
		b2: { backgroundColor: '#8B5CF6', color: '#FFFFFF' },
		jakes: { backgroundColor: '#F59E0B', color: '#FFFFFF' },
		epic: { backgroundColor: '#EF4444', color: '#FFFFFF' },
		pulled: { backgroundColor: '#6B7280', color: '#FFFFFF' }
	};
	return boothColors[booth.toLowerCase()] || { backgroundColor: '#374151', color: '#E5E7EB' };
}

export const TABLE_COLUMNS = [
	{ name: 'name', width: '18%', minWidth: '9rem', icon: 'tag' },
	{ name: 'count', width: '7%', minWidth: '5rem', icon: 'hash' },
	{ name: 'lowCount', width: '8%', minWidth: '7rem', icon: 'alert' },
	{ name: 'cost', width: '8%', minWidth: '5.5rem', icon: 'dollar' },
	{ name: 'totalValue', width: '10%', minWidth: '8rem', icon: 'coins' },
	{ name: 'storageType', width: '15%', minWidth: '9rem', icon: 'thermometer' },
	{ name: 'booths', width: '20%', minWidth: '9.4rem', icon: 'store' },
	{ name: '', width: '3%', minWidth: '1.2rem', icon: '' }
];

/**
 * Resolve a transition/animation duration, collapsing to 0 when the user
 * prefers reduced motion.
 * @param {number} base - the intended duration in milliseconds
 * @param {boolean} reducedMotion - whether the user prefers reduced motion
 * @returns {number} the duration to use in milliseconds
 */
export function motionDuration(base, reducedMotion) {
	return reducedMotion ? 0 : base;
}

/**
 * Duration (ms) for a table row's exit (fade-out) transition.
 *
 * Rows fade out only on an explicit delete. Search / pagination changes are
 * list replacements, not deletes: their removals must resolve in 0ms so a
 * leaving `<tr>` is never left mid-fade. Svelte pins outroing rows with
 * `position: absolute` so surviving rows can `animate:flip`, and an absolutely
 * positioned `<tr>` blockifies — dropping out of the table's column model and
 * collapsing its cells. A 0ms exit removes the row before that is ever visible.
 * @param {boolean} isDeleting - whether the row is leaving due to an explicit delete
 * @param {boolean} reducedMotion - whether the user prefers reduced motion
 * @returns {number} the duration to use in milliseconds
 */
export function rowExitDuration(isDeleting, reducedMotion) {
	return reducedMotion || !isDeleting ? 0 : 150;
}

export function getColumnDisplayName(columnName) {
	switch (columnName) {
		case 'totalValue':
			return 'Total Value';
		case 'booths':
			return 'Booths';
		case 'lowCount':
			return 'Low Count';
		case 'storageType':
			return 'Storage Type';
		default:
			return columnName.charAt(0).toUpperCase() + columnName.slice(1);
	}
}
