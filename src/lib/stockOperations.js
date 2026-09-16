import {
	emptyStock,
	normalizeItemStock,
	normalizeStorageLocation,
	stockFingerprint,
	stockInteger
} from './stockLocations.js';

/** @param {object|null} item Latest item. @param {object} action Durable action. @returns {{item: object|null, ledger: object|null}} Pure validated operation result. */
export function planStockAction(item, action) {
	if (action.kind === 'create') {
		if (item) throw new Error('This item already exists.');
		const state = normalizeItemStock(action.item);
		const created = {
			...action.item,
			storageType: state.storageType,
			stockByStorage: state.stockByStorage,
			count: state.total,
			stockRevision: action.id
		};
		return {
			item: created,
			ledger: ledger(action, created, emptyStock(), state.stockByStorage, 'itemCreated', 'add')
		};
	}
	if (!item) throw new Error('This item was deleted or merged. Review the pending action.');
	const state = normalizeItemStock(item);
	const before = state.stockByStorage;
	const after = { ...before };
	if (
		['set', 'reset', 'delete'].includes(action.kind) &&
		action.expectedStock !== stockFingerprint(item)
	)
		throw new Error('Stock changed since this action was entered. Refresh and confirm it again.');
	let event = 'countChange';
	let type;
	if (action.kind === 'reset' || action.kind === 'delete') {
		for (const key of state.locations) after[key] = 0;
		if (action.kind === 'delete') event = 'itemDeleted';
	} else if (action.kind === 'transfer') {
		const from = action.fromLocation;
		const to = action.toLocation;
		const quantity = stockInteger(action.quantity);
		if (
			quantity === 0 ||
			from === to ||
			!['Freezer', 'Refrigerator'].includes(from) ||
			!['Freezer', 'Refrigerator'].includes(to) ||
			!state.locations.includes(from)
		)
			throw new Error('Choose distinct cold locations and a positive whole quantity.');
		after[from] -= quantity;
		after[to] += quantity;
		event = 'stockTransfer';
		type = 'transfer';
	} else if (action.kind === 'adjust' || action.kind === 'set') {
		if (!action.location) throw new Error('Choose a stock location.');
		const location = normalizeStorageLocation(action.location);
		if (!state.locations.includes(location))
			throw new Error('This location is outside the item’s storage family.');
		after[location] =
			action.kind === 'set'
				? stockInteger(action.quantity)
				: after[location] + stockInteger(action.delta, true);
	} else throw new Error('Unknown stock action.');
	if (Object.values(after).some((value) => value < 0))
		throw new Error('Not enough stock in the selected location.');
	const total = stockInteger(
		Object.values(after).reduce((sum, value) => sum + stockInteger(value), 0)
	);
	const changed = JSON.stringify(before) !== JSON.stringify(after);
	if (!changed && event !== 'itemDeleted') return { item, ledger: null };
	const next = { ...item, count: total, stockByStorage: after, stockRevision: action.id };
	return {
		item: action.kind === 'delete' ? null : next,
		ledger: ledger(
			action,
			item,
			before,
			after,
			event,
			type ?? (total >= state.total ? 'add' : 'remove')
		)
	};
}

function ledger(action, item, before, after, event, type) {
	const record = {
		operationId: action.id,
		itemId: action.itemId,
		itemName: item.name,
		event,
		type,
		previousCount: Object.values(before).reduce((a, b) => a + b, 0),
		newCount: Object.values(after).reduce((a, b) => a + b, 0),
		previousStockByStorage: before,
		newStockByStorage: after,
		user: action.user
	};
	for (const key of ['location', 'fromLocation', 'toLocation', 'quantity'])
		if (action[key] !== undefined) record[key] = action[key];
	return record;
}
