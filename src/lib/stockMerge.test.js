import { it, expect } from 'vitest';
import { planStockMerge, planMergedDrafts } from './stockMerge';
import { planStockMaintenance } from './stockMaintenance';
const kept = {
	id: 'kept',
	name: 'Avocado',
	count: 2,
	storageType: 'Freezer',
	cost: 7,
	lowCount: 3,
	barcode: '123',
	booths: ['one'],
	legacyItemIds: ['ancient']
};
const duplicate = {
	id: 'old',
	name: 'Avocado fridge',
	count: 4,
	storageType: 'Freezer',
	cost: 9,
	booths: ['two']
};
const mapping = {
	operationId: 'merge-1',
	keptLocation: 'Freezer',
	duplicateLocation: 'Refrigerator',
	reviewer: 'Owner'
};
it('preserves survivor metadata, unions booths and aliases, and makes two reciprocal neutral audit records', () => {
	const plan = planStockMerge(kept, duplicate, mapping);
	expect(plan.item).toMatchObject({
		id: 'kept',
		name: 'Avocado',
		count: 6,
		cost: 7,
		lowCount: 3,
		barcode: '123',
		booths: ['one', 'two'],
		legacyItemIds: ['ancient', 'old'],
		stockByStorage: { Freezer: 2, Refrigerator: 4, 'Dry Storage': 0 }
	});
	expect(plan.records[0]).toMatchObject({
		itemId: 'kept',
		relatedItemId: 'old',
		previousCount: 2,
		newCount: 6,
		type: 'merge'
	});
	expect(plan.records[1]).toMatchObject({
		itemId: 'old',
		relatedItemId: 'kept',
		previousCount: 4,
		newCount: 0,
		previousStockByStorage: { Freezer: 4, Refrigerator: 0, 'Dry Storage': 0 },
		assignedStockByStorage: { Freezer: 0, Refrigerator: 4, 'Dry Storage': 0 }
	});
	expect(duplicate.count).toBe(4);
});
it('supports a second merge into a split survivor without redistributing it', () => {
	const first = planStockMerge(kept, duplicate, mapping).item;
	const second = planStockMerge(
		first,
		{ ...duplicate, id: 'another', count: 3 },
		{ ...mapping, operationId: 'merge-2' }
	);
	expect(second.item.stockByStorage).toEqual({ Freezer: 2, Refrigerator: 7, 'Dry Storage': 0 });
	expect(second.item.legacyItemIds).toEqual(['ancient', 'old', 'another']);
});
it('rejects self, dry, split duplicates and alias conflicts', () => {
	expect(() => planStockMerge(kept, kept, mapping)).toThrow();
	expect(() =>
		planStockMerge(kept, { ...duplicate, storageType: 'Dry Storage' }, mapping)
	).toThrow();
	expect(() =>
		planStockMerge(kept, { ...duplicate, stockByStorage: { Freezer: 2, Refrigerator: 2 } }, mapping)
	).toThrow('already has split');
	expect(() =>
		planStockMerge(kept, duplicate, mapping, [
			kept,
			duplicate,
			{ id: 'third', legacyItemIds: ['old'] }
		])
	).toThrow('already owns');
});
it('requires explicit order resolution and rejects concurrent draft changes', () => {
	const draft = { id: '2026-08-20', lines: { kept: { qty: 3 }, old: { qty: 5, included: false } } };
	expect(() => planMergedDrafts([draft], 'kept', 'old')).toThrow('explicit approved');
	const resolution = {
		id: draft.id,
		expected: draft,
		survivorOverride: { qty: 5, included: true }
	};
	expect(planMergedDrafts([draft], 'kept', 'old', [resolution])[0].lines).toEqual({
		kept: { qty: 5, included: true }
	});
	expect(() =>
		planMergedDrafts([{ ...draft, updatedBy: 'someone' }], 'kept', 'old', [resolution])
	).toThrow('changed');
	expect(draft.lines.old.qty).toBe(5);
});
it('dry-run plans are nonmutating, group-specific, and fail stale expected state', () => {
	const snapshot = {
		groupId: 'group',
		items: [kept, duplicate],
		orders: [],
		reviews: [],
		transactions: []
	};
	const manifest = {
		groupId: 'group',
		pairs: [
			{
				...mapping,
				keptId: kept.id,
				duplicateId: duplicate.id,
				expectedKept: kept,
				expectedDuplicate: duplicate
			}
		]
	};
	expect(planStockMaintenance(snapshot, manifest).plans).toHaveLength(1);
	expect(snapshot.items).toEqual([kept, duplicate]);
	expect(() => planStockMaintenance(snapshot, { ...manifest, groupId: 'other' })).toThrow('group');
	expect(() =>
		planStockMaintenance({ ...snapshot, items: [{ ...kept, count: 3 }, duplicate] }, manifest)
	).toThrow('changed');
});
