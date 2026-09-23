import { it, expect } from 'vitest';
import {
	annotateStockHistory,
	findHistoricalTransferCandidates,
	preprocessStockHistory
} from './stockHistory';
import {
	computeSummaryStats,
	computeDailyAnalysis,
	computeHourlyActivityPattern,
	computeTopMovers
} from './transactionAnalysis';
import { buildDailySeries, buildForecastContext } from './predictionCore';

const removal = {
	id: 'r',
	itemId: 'old',
	itemName: 'Original',
	type: 'remove',
	previousCount: 10,
	newCount: 8,
	timestamp: new Date('2025-08-20T14:00:00Z')
};
const addition = {
	id: 'a',
	itemId: 'kept',
	type: 'add',
	previousCount: 0,
	newCount: 2,
	timestamp: new Date('2025-08-20T14:05:00Z')
};
const links = [{ locations: { old: 'Freezer', kept: 'Refrigerator' } }];

it('suggests the inclusive five minute boundary but never confirms it', () => {
	expect(findHistoricalTransferCandidates([removal, addition], links)).toHaveLength(1);
	expect(
		findHistoricalTransferCandidates(
			[removal, { ...addition, timestamp: new Date('2025-08-20T14:05:00.001Z') }],
			links
		)
	).toHaveLength(0);
	expect(
		findHistoricalTransferCandidates([removal, { ...addition, newCount: 3 }], links)
	).toHaveLength(0);
	expect(
		findHistoricalTransferCandidates([removal, { ...addition, event: 'itemCreated' }], links)
	).toHaveLength(0);
	expect(findHistoricalTransferCandidates([removal, addition], [])).toHaveLength(0);
});

it('suggests additions logged up to five minutes before the removal', () => {
	const early = { ...addition, timestamp: new Date('2025-08-20T13:55:00Z') };
	expect(findHistoricalTransferCandidates([removal, early], links)).toEqual([
		expect.objectContaining({ transactionIds: ['r', 'a'], fromLocation: 'Freezer' })
	]);
	expect(
		findHistoricalTransferCandidates(
			[removal, { ...addition, timestamp: new Date('2025-08-20T13:54:59.999Z') }],
			links
		)
	).toHaveLength(0);
});

it('surfaces ambiguous suggestions and rejects overlapping confirmed decisions', () => {
	expect(
		findHistoricalTransferCandidates([removal, addition, { ...addition, id: 'a2' }], links)
	).toHaveLength(2);
	expect(() =>
		annotateStockHistory(
			[],
			[
				{ id: 'one', confirmed: true, transactionIds: ['r', 'a'] },
				{ id: 'two', confirmed: true, transactionIds: ['r', 'a2'] }
			]
		)
	).toThrow('Overlapping');
});

it('annotates reviews reversibly while preserving audit originals and alias mapping once', () => {
	const rows = [removal, addition];
	const review = { id: 'review', confirmed: true, transactionIds: ['r', 'a'] };
	expect(preprocessStockHistory(annotateStockHistory(rows, [review]))).toEqual([]);
	const restored = annotateStockHistory(rows, [{ ...review, confirmed: false }]);
	const mapped = preprocessStockHistory(
		[...restored, ...restored],
		[{ id: 'kept', name: 'Product', legacyItemIds: ['old'] }]
	);
	expect(mapped).toHaveLength(2);
	expect(mapped[0]).toMatchObject({
		itemId: 'kept',
		originalItemId: 'old',
		originalItemName: 'Original'
	});
	expect(rows[0]).toBe(removal);
	expect(rows[0].itemId).toBe('old');
});

it('excludes transfers/merges/reviewed pairs in every movement transform and before fair segmentation', () => {
	const rows = [
		{ ...removal, id: 'real', itemId: 'kept' },
		{ ...removal, id: 'merge', event: 'itemMerged', timestamp: new Date('2026-08-25') },
		{ ...removal, id: 'transfer', event: 'stockTransfer' },
		{ ...removal, id: 'historical', historicalTransfer: true }
	];
	expect(computeSummaryStats(rows, 1).totalRemoved).toBe(2);
	expect(
		computeDailyAnalysis(rows, new Date('2025-08-20'), new Date('2025-08-20'))[0].totalRemoved
	).toBe(2);
	expect(computeHourlyActivityPattern(rows).reduce((sum, hour) => sum + hour.totalChange, 0)).toBe(
		2
	);
	expect(computeTopMovers(rows)[0].totalTransactions).toBe(1);
	expect(buildDailySeries(rows, 'kept', '2025-08-20', '2025-08-20')).toEqual(
		buildDailySeries([rows[0]], 'kept', '2025-08-20', '2025-08-20')
	);
	expect(
		buildForecastContext(rows, [{ id: 'kept', count: 10 }], 3, new Date('2025-08-21'))
	).toEqual(
		buildForecastContext([rows[0]], [{ id: 'kept', count: 10 }], 3, new Date('2025-08-21'))
	);
});
