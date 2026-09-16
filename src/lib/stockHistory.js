/** @param {object} transaction Ledger row. @returns {boolean} Include in movement statistics, preserving unrelated lifecycle behavior. */
export function isInventoryMovement(transaction) {
	return (
		!['stockTransfer', 'itemMerged'].includes(transaction.event) &&
		transaction.type !== 'transfer' &&
		transaction.historicalTransfer !== true
	);
}

/** @param {object[]} transactions Original ledger. @param {object[]} reviews Persisted decisions. @returns {object[]} Annotated copies, preserving original names/IDs. */
export function annotateStockHistory(transactions, reviews = []) {
	const confirmed = new Map();
	for (const review of reviews) {
		if (!review.confirmed) continue;
		for (const id of review.transactionIds ?? []) {
			if (confirmed.has(id)) throw new Error('Overlapping confirmed historical transfer reviews.');
			confirmed.set(id, review.id);
		}
	}
	return transactions.map((row) => ({
		...row,
		historicalTransfer: confirmed.has(row.id),
		historicalTransferReviewId: confirmed.get(row.id) ?? null
	}));
}

/** @param {object[]} transactions Annotated ledger. @param {object[]} [items] Current products with aliases. @returns {object[]} Nonmutating movement input shared by all forecasts/analytics. */
export function preprocessStockHistory(transactions, items = []) {
	const owners = new Map();
	for (const item of items) {
		for (const id of [item.id, ...(item.legacyItemIds ?? [])]) {
			if (owners.has(id) && owners.get(id).id !== item.id)
				throw new Error('An item alias belongs to more than one product.');
			owners.set(id, item);
		}
	}
	const seen = new Set();
	return transactions
		.filter((row) => {
			if (!isInventoryMovement(row) || (row.id && seen.has(row.id))) return false;
			if (row.id) seen.add(row.id);
			return true;
		})
		.map((row) => {
			const item = owners.get(row.itemId);
			return item
				? {
						...row,
						originalItemId: row.originalItemId ?? row.itemId,
						originalItemName: row.originalItemName ?? row.itemName,
						itemId: item.id,
						itemName: item.name
					}
				: { ...row };
		});
}

/** @param {object[]} transactions Ledger. @param {object[]} links Explicit product/location links ({locations: {[itemId]: location}}). @returns {object[]} Suggestions only, including overlapping matches. */
export function findHistoricalTransferCandidates(transactions, links) {
	const candidates = [];
	const rows = transactions.filter(
		(row) => (!row.event || row.event === 'countChange') && !row.historicalTransfer
	);
	for (const link of links) {
		const locations = link.locations;
		for (const removal of rows) {
			const from = locations[removal.itemId];
			const quantity = Number(removal.previousCount) - Number(removal.newCount);
			if (
				removal.type !== 'remove' ||
				!['Freezer', 'Refrigerator'].includes(from) ||
				!Number.isSafeInteger(quantity) ||
				quantity <= 0
			)
				continue;
			for (const addition of rows) {
				const to = locations[addition.itemId];
				const delay =
					new Date(addition.timestamp).getTime() - new Date(removal.timestamp).getTime();
				if (
					addition.type !== 'add' ||
					addition.itemId === removal.itemId ||
					!['Freezer', 'Refrigerator'].includes(to) ||
					from === to ||
					!(delay >= 0 && delay <= 300000) ||
					Number(addition.newCount) - Number(addition.previousCount) !== quantity
				)
					continue;
				candidates.push({
					transactionIds: [removal.id, addition.id],
					quantity,
					fromLocation: from,
					toLocation: to,
					removal,
					addition,
					confirmed: false
				});
			}
		}
	}
	return candidates.filter(
		(candidate, index) =>
			candidates.findIndex(
				(other) => JSON.stringify(other.transactionIds) === JSON.stringify(candidate.transactionIds)
			) === index
	);
}
