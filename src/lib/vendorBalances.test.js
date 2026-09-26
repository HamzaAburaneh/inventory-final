import { describe, it, expect } from 'vitest';
import {
	cleanVendorName,
	vendorKey,
	toCents,
	centsToInput,
	wholeCents,
	loanBalance,
	movementSign,
	planVendorAction,
	groupLoans,
	vendorSummaries,
	vendorMovementLabel
} from './vendorBalances';
import { isInventoryMovement, preprocessStockHistory } from './stockHistory';

const fries = {
	id: 'fries',
	name: 'Fries',
	storageType: 'Freezer',
	count: 10,
	stockByStorage: { Freezer: 6, Refrigerator: 4, 'Dry Storage': 0 },
	cost: 34
};

const lend = (overrides = {}) => ({
	id: 'op-1',
	loanId: 'loan-1',
	kind: 'loan',
	direction: 'lent',
	vendorName: ' Compound ',
	itemId: 'fries',
	productName: 'Fries',
	unitPriceCents: 3400,
	quantity: 5,
	location: 'Freezer',
	user: 'staff@example.com',
	...overrides
});

/** Apply a sequence of actions the way the transport would, returning every result. */
function run(actions, item = fries) {
	let loan = null;
	let current = item;
	const results = [];
	for (const action of actions) {
		const result = planVendorAction({ loanId: 'loan-1', ...action }, loan, current);
		loan = result.loan;
		if (result.stock) current = result.stock.item;
		results.push(result);
	}
	return { loan, item: current, results };
}

describe('vendor names', () => {
	it('treats spacing, case and accents as one counterparty', () => {
		expect(cleanVendorName('  Smash   City ')).toBe('Smash City');
		expect(vendorKey('Compound')).toBe(vendorKey(' compound  '));
		expect(vendorKey('Café Mike')).toBe('cafe-mike');
		expect(() => vendorKey('  ')).toThrow('vendor name');
	});
});

describe('money', () => {
	it('converts typed dollars to whole cents and validates action cents', () => {
		expect(toCents('100')).toBe(10000);
		expect(toCents(53.23)).toBe(5323);
		expect(toCents('', true)).toBeNull();
		expect(toCents('$1,250.50')).toBe(125050);
		expect(centsToInput(2330)).toBe('23.30');
		expect(centsToInput(null)).toBe('');
		expect(() => toCents('-1')).toThrow('nonnegative');
		expect(wholeCents(300)).toBe(300);
		expect(() => wholeCents(1.5)).toThrow();
	});
});

describe('movementSign', () => {
	it('takes stock out when lending or returning what we borrowed', () => {
		expect(movementSign('lent', 'loan')).toBe(-1);
		expect(movementSign('lent', 'return')).toBe(1);
		expect(movementSign('borrowed', 'loan')).toBe(1);
		expect(movementSign('borrowed', 'return')).toBe(-1);
	});
});

describe('planVendorAction', () => {
	it('lend 5, get 2 back, settle 3 in cash: nothing owed, three entries, no stock for cash', () => {
		const { loan, item, results } = run([
			lend(),
			{ id: 'op-2', kind: 'return', quantity: 2, location: 'Refrigerator', user: 'a' },
			{ id: 'op-3', kind: 'cash', quantity: 3, amountCents: 10200, user: 'a' }
		]);
		expect(loanBalance(loan)).toMatchObject({ outstanding: 0, status: 'settled' });
		expect(loan.cashPaidCents).toBe(10200);
		expect(results.map((r) => r.entry.kind)).toEqual(['loan', 'return', 'cash']);
		expect(results[2].stock).toBeNull();
		expect(item.stockByStorage).toEqual({ Freezer: 1, Refrigerator: 6, 'Dry Storage': 0 });
		expect(item.count).toBe(7);
	});

	it('writes lending as a vendor movement, not ordinary demand', () => {
		const { results } = run([lend()]);
		const ledger = results[0].stock.ledger;
		expect(ledger).toMatchObject({
			event: 'vendorMovement',
			type: 'remove',
			vendorAction: 'lend',
			vendorLoanId: 'loan-1',
			vendorName: 'Compound',
			previousCount: 10,
			newCount: 5,
			location: 'Freezer'
		});
		expect(isInventoryMovement(ledger)).toBe(false);
		expect(preprocessStockHistory([ledger])).toEqual([]);
	});

	it('borrowing adds stock and returning it removes stock, tracking what we owe', () => {
		const { loan, item } = run([
			lend({ direction: 'borrowed', vendorName: 'Dwight', quantity: 2, location: 'Refrigerator' }),
			{ id: 'op-2', kind: 'return', quantity: 1, location: 'Refrigerator', user: 'a' }
		]);
		expect(item.stockByStorage.Refrigerator).toBe(5);
		expect(loanBalance(loan)).toMatchObject({ outstanding: 1, status: 'partial' });
		expect(groupLoans([loan]).weOwe).toHaveLength(1);
	});

	it('refuses repayments beyond what is outstanding and removals beyond the location', () => {
		const { loan } = run([lend()]);
		expect(() =>
			planVendorAction(
				{ id: 'x', loanId: 'loan-1', kind: 'return', quantity: 6, location: 'Freezer', user: 'a' },
				loan,
				fries
			)
		).toThrow('Only 5 still outstanding');
		expect(() =>
			planVendorAction(
				{ id: 'x', loanId: 'loan-1', kind: 'cash', quantity: 6, amountCents: 0, user: 'a' },
				loan,
				fries
			)
		).toThrow('Only 5');
		expect(() => run([lend({ quantity: 7 })])).toThrow('Not enough stock');
	});

	it('keeps free-text products out of stock', () => {
		const forks = run([lend({ itemId: null, productName: 'Forks', unitPriceCents: null })]);
		expect(forks.results[0].stock).toBeNull();
		expect(loanBalance(forks.loan).outstandingCents).toBeNull();
	});

	it('values what is outstanding at the price captured with the loan', () => {
		const { loan } = run([
			lend({ itemId: null, productName: 'Liner basket', unitPriceCents: 10000, quantity: 3 })
		]);
		expect(loanBalance(loan).outstandingCents).toBe(30000);
		const paid = planVendorAction(
			{ id: 'op-2', loanId: 'loan-1', kind: 'cash', quantity: 1, amountCents: 10000, user: 'a' },
			loan,
			null
		).loan;
		expect(loanBalance(paid)).toMatchObject({ outstanding: 2, outstandingCents: 20000 });
	});

	it('keeps review independent of repayment, and any later change needs review again', () => {
		const { loan: settled } = run([
			lend(),
			{ id: 'op-2', kind: 'cash', quantity: 5, amountCents: 17000, user: 'a' }
		]);
		const groups = groupLoans([settled]);
		expect(groups.needsReview).toHaveLength(1);
		expect(groups.settled).toHaveLength(1);
		const review = planVendorAction(
			{ id: 'op-3', loanId: 'loan-1', kind: 'review', user: 'owner' },
			settled,
			null
		);
		expect(review.stock).toBeNull();
		expect(review.loan).toMatchObject({ reviewStatus: 'reviewed', reviewedBy: 'owner' });
		expect(loanBalance(review.loan)).toEqual(loanBalance(settled));
		expect(() =>
			planVendorAction({ id: 'op-4', loanId: 'loan-1', kind: 'review', user: 'o' }, review.loan)
		).toThrow('already reviewed');
		const corrected = planVendorAction(
			{
				id: 'op-5',
				loanId: 'loan-1',
				kind: 'correction',
				quantity: 1,
				note: 'miscount',
				user: 'a'
			},
			review.loan,
			null
		).loan;
		expect(corrected).toMatchObject({ reviewStatus: 'needsReview', reviewedBy: null });
		expect(loanBalance(corrected).outstanding).toBe(1);
	});

	it('requires a reason and cannot correct below what was settled', () => {
		const { loan } = run([
			lend(),
			{ id: 'op-2', kind: 'cash', quantity: 3, amountCents: 1, user: 'a' }
		]);
		const correct = (quantity, note = 'recount') =>
			planVendorAction(
				{ id: 'c', loanId: 'loan-1', kind: 'correction', quantity, note, user: 'a' },
				loan,
				null
			);
		expect(() => correct(-1, '')).toThrow('Explain');
		expect(() => correct(-3)).toThrow('already settled');
		expect(loanBalance(correct(-2).loan)).toMatchObject({ outstanding: 0, status: 'settled' });
	});
});

describe('vendorSummaries', () => {
	it('totals per vendor and product without mixing products, directions or unpriced value', () => {
		const loan = (overrides) => ({
			...run([lend()]).loan,
			...overrides
		});
		const summaries = vendorSummaries([
			loan({ quantity: 5 }),
			loan({ quantity: 2 }),
			loan({ itemId: null, productName: 'Forks', unitPriceCents: null, quantity: 1 }),
			loan({ direction: 'borrowed', quantity: 4 }),
			loan({ vendorId: 'dwight', vendorName: 'Dwight', quantity: 1, returnedQuantity: 1 })
		]);
		expect(summaries).toHaveLength(1);
		expect(summaries[0].lines).toEqual([
			{ direction: 'lent', productName: 'Fries', outstanding: 7, outstandingCents: 23800 },
			{ direction: 'lent', productName: 'Forks', outstanding: 1, outstandingCents: null },
			{ direction: 'borrowed', productName: 'Fries', outstanding: 4, outstandingCents: 13600 }
		]);
	});
});

describe('vendorMovementLabel', () => {
	it('labels every ledger row kind, including the 2026-09 carry-over rows', () => {
		expect(vendorMovementLabel({ vendorAction: 'lend', vendorName: 'Compound' })).toBe(
			'Lent to Compound'
		);
		expect(vendorMovementLabel({ vendorAction: 'returnOut', vendorName: 'Dwight' })).toBe(
			'Returned to Dwight'
		);
		expect(vendorMovementLabel({ vendorAction: 'carryOver', vendorName: 'compound' })).toBe(
			'Moved to vendor balances · compound'
		);
	});
});
