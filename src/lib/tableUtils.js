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
	return boothArray.map(booth => booth.charAt(0).toUpperCase() + booth.slice(1).toLowerCase());
}

export function getStorageTypeStyle(storageType) {
	switch (storageType.toLowerCase()) {
		case 'freezer':
			return { backgroundColor: '#1E3A8A', color: '#BFDBFE' };
		case 'dry storage':
			return { backgroundColor: '#92400E', color: '#FDE68A' };
		case 'refrigerator':
			return { backgroundColor: '#065F46', color: '#A7F3D0' };
		default:
			return { backgroundColor: '#374151', color: '#E5E7EB' };
	}
}

export function getBoothStyle(booth) {
	const boothColors = {
		'freshly': { backgroundColor: '#10B981', color: '#FFFFFF' },
		'b1': { backgroundColor: '#3B82F6', color: '#FFFFFF' },
		'b2': { backgroundColor: '#8B5CF6', color: '#FFFFFF' },
		'jakes': { backgroundColor: '#F59E0B', color: '#FFFFFF' },
		'epic': { backgroundColor: '#EF4444', color: '#FFFFFF' },
		'pulled': { backgroundColor: '#6B7280', color: '#FFFFFF' }
	};
	return boothColors[booth.toLowerCase()] || { backgroundColor: '#374151', color: '#E5E7EB' };
}

export const TABLE_COLUMNS = [
	{name: 'name', width: '18%', minWidth: '9rem'},
	{name: 'count', width: '7%', minWidth: '5rem'},
	{name: 'lowCount', width: '8%', minWidth: '7rem'},
	{name: 'cost', width: '8%', minWidth: '5.5rem'},
	{name: 'totalValue', width: '10%', minWidth: '8rem'},
	{name: 'storageType', width: '15%', minWidth: '9rem'},
	{name: 'booths', width: '20%', minWidth: '9.4rem'},
	{name: '', width: '3%', minWidth: '1.2rem'}
];

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