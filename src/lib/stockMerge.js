import { emptyStock, normalizeItemStock, stockInteger } from './stockLocations.js';

/** @param {unknown} value Snapshot data. @returns {string} Stable JSON for reviewed-state comparisons, including timestamps. */
export function snapshotKey(value) {
	function normalize(entry) {
		if (entry?.toDate) return entry.toDate().toISOString();
		if (entry instanceof Date) return entry.toISOString();
		if (Array.isArray(entry)) return entry.map(normalize);
		if (entry && typeof entry === 'object')
			return Object.fromEntries(
				Object.keys(entry)
					.sort()
					.map((key) => [key, normalize(entry[key])])
			);
		return entry;
	}
	return JSON.stringify(normalize(value));
}

function assignedStock(item, location, allowSplit) {
	const state = normalizeItemStock(item);
	if (state.storageType === 'Dry Storage') throw new Error('Only cold products can be merged.');
	const split = state.stockByStorage.Freezer > 0 && state.stockByStorage.Refrigerator > 0;
	if (split) {
		if (!allowSplit)
			throw new Error('The duplicate already has split stock. Review it separately.');
		return state.stockByStorage;
	}
	if (!['Freezer', 'Refrigerator'].includes(location))
		throw new Error('Confirm the actual cold location for each single-location item.');
	return { ...emptyStock(), [location]: state.total };
}

/** @param {object} kept Current survivor with ID. @param {object} duplicate Current duplicate with ID. @param {object} mapping Approved locations/operation ID. @param {object[]} [catalog] Current catalog for alias conflict checks. @returns {object} Survivor and two linked immutable ledger entries. */
export function planStockMerge(kept, duplicate, mapping, catalog = [kept, duplicate]) {
	if (!kept?.id || !duplicate?.id || kept.id === duplicate.id)
		throw new Error('Choose two different existing items.');
	const own = [kept.id, ...(kept.legacyItemIds ?? [])];
	const retired = [duplicate.id, ...(duplicate.legacyItemIds ?? [])];
	if (
		new Set(own).size !== own.length ||
		new Set(retired).size !== retired.length ||
		own.some((id) => retired.includes(id))
	)
		throw new Error('Invalid or overlapping item aliases.');
	const combinedIds = new Set([...own, ...retired]);
	if (
		catalog.some(
			(item) =>
				item.id !== kept.id &&
				item.id !== duplicate.id &&
				[item.id, ...(item.legacyItemIds ?? [])].some((id) => combinedIds.has(id))
		)
	)
		throw new Error('Another product already owns one of these aliases.');
	const beforeKept = normalizeItemStock(kept);
	const beforeDuplicate = normalizeItemStock(duplicate);
	const assignedKept = assignedStock(kept, mapping.keptLocation, true);
	const assignedDuplicate = assignedStock(duplicate, mapping.duplicateLocation, false);
	const stockByStorage = Object.fromEntries(
		Object.keys(emptyStock()).map((key) => [
			key,
			stockInteger(assignedKept[key] + assignedDuplicate[key])
		])
	);
	const count = stockInteger(beforeKept.total + beforeDuplicate.total);
	const item = {
		...kept,
		stockByStorage,
		count,
		stockRevision: mapping.operationId,
		legacyItemIds: [...combinedIds].filter((id) => id !== kept.id),
		booths: [...new Set([...(kept.booths ?? []), ...(duplicate.booths ?? [])])]
	};
	const common = {
		operationId: mapping.operationId,
		event: 'itemMerged',
		type: 'merge',
		user: mapping.reviewer,
		approvedLocations: { kept: mapping.keptLocation, duplicate: mapping.duplicateLocation }
	};
	return {
		item,
		records: [
			{
				...common,
				id: `${mapping.operationId}-kept`,
				role: 'survivor',
				itemId: kept.id,
				itemName: kept.name,
				relatedItemId: duplicate.id,
				previousCount: beforeKept.total,
				newCount: count,
				previousStockByStorage: beforeKept.stockByStorage,
				newStockByStorage: stockByStorage,
				assignedStockByStorage: assignedKept
			},
			{
				...common,
				id: `${mapping.operationId}-duplicate`,
				role: 'duplicate',
				itemId: duplicate.id,
				itemName: duplicate.name,
				relatedItemId: kept.id,
				previousCount: beforeDuplicate.total,
				newCount: 0,
				previousStockByStorage: beforeDuplicate.stockByStorage,
				newStockByStorage: emptyStock(),
				assignedStockByStorage: assignedDuplicate
			}
		]
	};
}

/** @param {object[]} drafts All saved drafts with IDs. @param {string} keptId Survivor. @param {string} duplicateId Retired product. @param {object[]} resolutions Approved full expected draft and explicit resulting survivor override (null removes). @returns {object[]} Explicitly resolved drafts. */
export function planMergedDrafts(drafts, keptId, duplicateId, resolutions = []) {
	const affected = drafts.filter((draft) => Object.hasOwn(draft.lines ?? {}, duplicateId));
	if (resolutions.length !== affected.length)
		throw new Error('Every affected order draft needs an explicit approved resolution.');
	return affected.map((draft) => {
		const resolution = resolutions.find((entry) => entry.id === draft.id);
		if (!resolution || snapshotKey(draft) !== snapshotKey(resolution.expected))
			throw new Error(`Order draft ${draft.id} changed or was not reviewed.`);
		if (!Object.hasOwn(resolution, 'survivorOverride'))
			throw new Error('Specify the resulting order override or explicit null.');
		const override = resolution.survivorOverride;
		if (
			override !== null &&
			(typeof override !== 'object' ||
				Object.keys(override).some((key) => !['qty', 'included'].includes(key)))
		)
			throw new Error('Invalid order override.');
		if (override?.qty !== undefined) stockInteger(override.qty);
		if (override?.included !== undefined && typeof override.included !== 'boolean')
			throw new Error('Order inclusion must be true or false.');
		const lines = { ...draft.lines };
		delete lines[duplicateId];
		if (override === null) delete lines[keptId];
		else lines[keptId] = override;
		return { ...draft, lines };
	});
}
