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
	if (isNaN(numericCost)) return '';
	return new Intl.NumberFormat('en-CA', {
		style: 'currency',
		currency: 'CAD',
		minimumFractionDigits: 2
	}).format(numericCost);
}

export function formatTotalValue(count, cost) {
	if (count == null || cost == null || count === '' || cost === '') return '';
	const numericCount = parseFloat(count);
	const numericCost = parseFloat(cost);
	if (isNaN(numericCount) || isNaN(numericCost)) return '';
	const totalValue = numericCount * numericCost;
	return new Intl.NumberFormat('en-CA', {
		style: 'currency',
		currency: 'CAD',
		minimumFractionDigits: 2
	}).format(totalValue);
}

export function formatBooths(booths) {
	if (!booths || booths.length === 0) return [];
	const boothArray = Array.isArray(booths) ? booths : [booths];
	const displayNames = {
		'freshly': 'Freshly',
		'b1': 'B1',
		'b2': 'B2',
		'jakes': 'Jakes',
		'epic': 'Epic',
		'pulled': 'Pulled'
	};
	return boothArray.map(booth => displayNames[booth.toLowerCase()] || booth.charAt(0).toUpperCase() + booth.slice(1).toLowerCase());
}

export function getStorageTypeStyle(storageType) {
	switch (storageType.toLowerCase()) {
		case 'freezer':
			return { backgroundColor: '#3b82f6', color: '#BFDBFE' }; // True Blue
		case 'dry storage':
			return { backgroundColor: '#f59e0b', color: '#FDE68A' }; // True Orange
		case 'refrigerator':
			return { backgroundColor: '#10b981', color: '#A7F3D0' }; // True Green
		default:
			return { backgroundColor: '#6B7280', color: '#E5E7EB' };
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
	{name: 'name', width: '22%', minWidth: '10rem'},
	{name: 'count', width: '7%', minWidth: '4.5rem'},
	{name: 'lowCount', width: '9%', minWidth: '6.5rem'},
	{name: 'cost', width: '9%', minWidth: '5.5rem'},
	{name: 'totalValue', width: '13%', minWidth: '7.5rem'},
	{name: 'storageType', width: '15%', minWidth: '9rem'},
	{name: 'booths', width: '20%', minWidth: '11rem'},
	{name: '', width: '5%', minWidth: '3.5rem'}
];

export function getColumnDisplayName(columnName) {
	switch (columnName) {
		case 'name':
			return 'Item Name';
		case 'count':
			return 'Count';
		case 'lowCount':
			return 'Low Count';
		case 'cost':
			return 'Unit Cost';
		case 'totalValue':
			return 'Total Value';
		case 'storageType':
			return 'Storage Type';
		case 'booths':
			return 'Booths';
		default:
			return columnName.charAt(0).toUpperCase() + columnName.slice(1);
	}
}