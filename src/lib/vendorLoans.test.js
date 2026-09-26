import { describe, it, expect, vi, beforeEach } from 'vitest';

// A tiny in-memory Firestore: documents keyed by path, and a transaction that
// records its writes so a test can assert exactly what landed together.
const mocks = vi.hoisted(() => ({ docs: new Map(), writes: [] }));

vi.mock('../firebase', () => ({
	db: {},
	auth: { currentUser: { uid: 'u1', email: 'staff@example.com' } }
}));
vi.mock('./activeGroup', () => ({ requireActiveGroupId: () => 'group-1' }));

vi.mock('firebase/firestore', () => {
	let counter = 0;
	const ref = (path) => ({ path });
	return {
		collection: (base, ...segments) => ref([base.path, ...segments].filter(Boolean).join('/')),
		doc: (base, ...segments) =>
			ref(
				[base.path, ...(segments.length ? segments : [`auto-${++counter}`])]
					.filter(Boolean)
					.join('/')
			),
		serverTimestamp: () => 'SERVER_TIME',
		Timestamp: { fromMillis: (ms) => ({ ms }) },
		getDocs: vi.fn(),
		onSnapshot: vi.fn(),
		orderBy: vi.fn(),
		query: vi.fn(),
		runTransaction: async (_db, callback) =>
			callback({
				get: async ({ path }) => ({
					id: path.split('/').at(-1),
					exists: () => mocks.docs.has(path),
					data: () => mocks.docs.get(path)
				}),
				set: (target, data) => mocks.writes.push(['set', target.path, data]),
				update: (target, data) => mocks.writes.push(['update', target.path, data])
			})
	};
});

import { recordVendorAction } from './vendorLoans';

const itemPath = 'groups/group-1/items/fries';

beforeEach(() => {
	mocks.docs.clear();
	mocks.writes.length = 0;
	mocks.docs.set(itemPath, {
		name: 'Fries',
		storageType: 'Freezer',
		count: 10,
		stockByStorage: { Freezer: 10, Refrigerator: 0, 'Dry Storage': 0 }
	});
});

const lend = {
	kind: 'loan',
	loanId: 'loan-1',
	direction: 'lent',
	vendorName: 'Compound',
	itemId: 'fries',
	productName: 'Fries',
	quantity: 4,
	unitPriceCents: 3400,
	location: 'Freezer'
};

describe('recordVendorAction', () => {
	it('writes the loan, its entry, the item and a vendor ledger row together', async () => {
		const result = await recordVendorAction(lend, 'op-1');
		expect(result).toEqual({ status: 'applied', loanId: 'loan-1', operationId: 'op-1' });
		const paths = mocks.writes.map(([kind, path]) => `${kind} ${path}`);
		expect(paths).toEqual([
			'set groups/group-1/vendorLoans/loan-1',
			'set groups/group-1/vendorLoans/loan-1/entries/op-1',
			`update ${itemPath}`,
			'set groups/group-1/transactions/op-1'
		]);
		expect(mocks.writes[0][2]).toMatchObject({
			vendorName: 'Compound',
			quantity: 4,
			createdBy: 'staff@example.com',
			reviewStatus: 'needsReview',
			createdAt: 'SERVER_TIME'
		});
		expect(mocks.writes[2][2]).toMatchObject({
			count: 6,
			stockByStorage: { Freezer: 6, Refrigerator: 0, 'Dry Storage': 0 },
			stockRevision: 'op-1'
		});
		expect(mocks.writes[3][2]).toMatchObject({
			event: 'vendorMovement',
			vendorAction: 'lend',
			previousCount: 10,
			newCount: 6,
			syncedAt: 'SERVER_TIME'
		});
	});

	it('does nothing when the operation was already applied', async () => {
		mocks.docs.set('groups/group-1/vendorLoans/loan-1/entries/op-1', { kind: 'loan' });
		const result = await recordVendorAction(lend, 'op-1');
		expect(result.status).toBe('duplicate');
		expect(mocks.writes).toEqual([]);
	});

	it('writes nothing when the plan is refused', async () => {
		await expect(recordVendorAction({ ...lend, quantity: 11 }, 'op-2')).rejects.toThrow(
			'Not enough stock'
		);
		expect(mocks.writes).toEqual([]);
	});

	it('records cash against an existing loan without touching stock', async () => {
		mocks.docs.set('groups/group-1/vendorLoans/loan-1', {
			vendorId: 'compound',
			vendorName: 'Compound',
			direction: 'lent',
			itemId: 'fries',
			productName: 'Fries',
			unitPriceCents: 3400,
			quantity: 4,
			adjustedQuantity: 0,
			returnedQuantity: 0,
			cashSettledQuantity: 0,
			cashPaidCents: 0,
			reviewStatus: 'reviewed',
			reviewedBy: 'owner'
		});
		await recordVendorAction(
			{ kind: 'cash', loanId: 'loan-1', quantity: 2, amountCents: 6800 },
			'op-3'
		);
		expect(mocks.writes.map(([, path]) => path)).toEqual([
			'groups/group-1/vendorLoans/loan-1',
			'groups/group-1/vendorLoans/loan-1/entries/op-3'
		]);
		expect(mocks.writes[0][2]).toMatchObject({
			cashSettledQuantity: 2,
			cashPaidCents: 6800,
			reviewStatus: 'needsReview'
		});
	});
});
