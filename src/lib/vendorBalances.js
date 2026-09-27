/**
 * Pure rules behind Vendor Balances: what a loan still owes, and what one action
 * does to the loan, its audit trail and (for inventory products) stock.
 *
 * A loan records one product lent to or borrowed from another vendor. It is paid
 * back in product, in cash, or both. Cash is valued at the unit price captured
 * when the loan was recorded, so a later cost change does not move an old debt:
 * lend 3 baskets at $100 and the vendor owes 3 baskets or $300. Quantities stay
 * whole units of the product's tracked unit; money is whole cents.
 *
 * Repayment and review are independent. Every recorded change sends the loan back
 * to Needs review, and marking it reviewed changes neither stock nor what is owed.
 * Lending and borrowing change real stock but are not booth demand, so their
 * ledger rows use their own event, which forecasting and analytics exclude.
 */

import { planStockAction } from './stockOperations.js';
import { normalizeStorageLocation, stockInteger } from './stockLocations.js';

/**
 * @typedef {import('../types').Item} Item
 * @typedef {import('../types').VendorLoan} VendorLoan
 * @typedef {import('../types').VendorLoanEntry} VendorLoanEntry
 */

export const VENDOR_MOVEMENT_EVENT = 'vendorMovement';

/** @param {unknown} name Typed vendor name. @returns {string} Display name with spacing tidied. */
export function cleanVendorName(name) {
	return String(name ?? '')
		.trim()
		.replace(/\s+/g, ' ');
}

/**
 * Stable document ID for a vendor, so "Compound", "compound " and "COMPOUND"
 * are one counterparty.
 * @param {unknown} name Typed vendor name.
 * @returns {string} Slug ID.
 */
export function vendorKey(name) {
	const key = cleanVendorName(name)
		.toLowerCase()
		.normalize('NFKD')
		.replace(/\p{M}/gu, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
	if (!key) throw new Error('Enter a vendor name.');
	return key.slice(0, 80);
}

/**
 * @param {unknown} value Dollars as typed or stored (e.g. item cost).
 * @param {boolean} [optional] Allow blank, returning null.
 * @returns {number | null} Nonnegative whole cents.
 */
export function toCents(value, optional = false) {
	// Typed money may carry a dollar sign, thousands separators or spaces.
	const text = typeof value === 'string' ? value.replace(/[$,\s]/g, '') : value;
	if (text === null || text === undefined || text === '') {
		if (optional) return null;
		throw new Error('Enter an amount.');
	}
	const number = Number(text);
	if (!Number.isFinite(number) || number < 0) throw new Error('Enter a valid nonnegative amount.');
	const cents = Math.round(number * 100);
	if (!Number.isSafeInteger(cents)) throw new Error('That amount is too large.');
	return cents;
}

/**
 * @param {unknown} value Cents carried on an action.
 * @param {boolean} [optional] Allow null.
 * @returns {number | null} Validated nonnegative whole cents.
 */
export function wholeCents(value, optional = false) {
	if (value === null || value === undefined) {
		if (optional) return null;
		throw new Error('Enter an amount.');
	}
	if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
		throw new Error('Enter a valid nonnegative amount.');
	return value;
}

/** @param {number | null | undefined} cents Whole cents. @returns {string} Money input text with two decimals, e.g. "23.30", or '' for none. */
export function centsToInput(cents) {
	return cents === null || cents === undefined ? '' : (cents / 100).toFixed(2);
}

/** @param {number | null | undefined} cents Whole cents. @returns {string} Dollar display, e.g. "$1,250.00". */
export function formatCents(cents) {
	if (cents === null || cents === undefined) return '—';
	return (cents / 100).toLocaleString('en-CA', { style: 'currency', currency: 'CAD' });
}

/**
 * What a loan still owes and where it stands.
 * @param {VendorLoan} loan Stored loan.
 * @returns {{ owed: number, outstanding: number, settled: number, status: 'open' | 'partial' | 'settled', outstandingCents: number | null }}
 *   `owed` is the original quantity plus corrections; `settled` counts units returned or paid for.
 */
export function loanBalance(loan) {
	const owed = loan.quantity + (loan.adjustedQuantity ?? 0);
	const settled = (loan.returnedQuantity ?? 0) + (loan.cashSettledQuantity ?? 0);
	const outstanding = owed - settled;
	return {
		owed,
		outstanding,
		settled,
		status: outstanding === 0 ? 'settled' : settled > 0 ? 'partial' : 'open',
		outstandingCents: loan.unitPriceCents == null ? null : outstanding * loan.unitPriceCents
	};
}

/**
 * Stock direction for a physical movement: lending and returning borrowed goods
 * take product out; borrowing and getting lent goods back bring it in.
 * @param {'lent' | 'borrowed'} direction Loan direction.
 * @param {'loan' | 'return'} kind Movement.
 * @returns {1 | -1} Sign of the stock change.
 */
export function movementSign(direction, kind) {
	const outward = (direction === 'lent') === (kind === 'loan');
	return outward ? -1 : 1;
}

/** @param {'lent' | 'borrowed'} direction Direction. @param {'loan' | 'return'} kind Movement. @returns {string} Ledger `vendorAction`. */
function vendorAction(direction, kind) {
	if (kind === 'loan') return direction === 'lent' ? 'lend' : 'borrow';
	return direction === 'lent' ? 'returnIn' : 'returnOut';
}

/**
 * Plain-language label for a vendor ledger row, e.g. "Lent to Compound".
 * @param {{ vendorAction?: string, vendorName?: string }} transaction - A vendorMovement ledger row.
 * @returns {string} Label for history views.
 */
export function vendorMovementLabel(transaction) {
	const name = transaction.vendorName || 'a vendor';
	return (
		{
			lend: `Lent to ${name}`,
			borrow: `Borrowed from ${name}`,
			returnIn: `Returned by ${name}`,
			returnOut: `Returned to ${name}`,
			// One-time 2026-09 migration rows from the old vendor-named items.
			carryOver: `Moved to vendor balances · ${name}`
		}[transaction.vendorAction] ?? `Vendor movement · ${name}`
	);
}

function requireText(value, message) {
	const text = String(value ?? '').trim();
	if (!text) throw new Error(message);
	return text;
}

function positive(value, message) {
	const quantity = stockInteger(value);
	if (quantity === 0) throw new Error(message);
	return quantity;
}

/**
 * Validate one action against the latest loan and item and describe every write.
 *
 * Throws with a message for the person entering it when the action is invalid:
 * returning or paying for more than is outstanding, removing more stock than the
 * location holds, or moving stock for a product that is not an inventory item.
 * @param {object} action - The action. `kind` is 'loan' | 'return' | 'cash' | 'correction' | 'review';
 *   `id` is its operation ID (also the entry ID), `user` who entered it.
 * @param {VendorLoan | null} loan - Current loan, or null when recording a new one.
 * @param {Item | null} item - Current inventory item when the action moves stock.
 * @returns {{ loan: VendorLoan, entry: VendorLoanEntry, stock: { item: Item, ledger: object } | null }}
 */
export function planVendorAction(action, loan, item) {
	const user = requireText(action.user, 'Sign in again to record this.');
	const note = String(action.note ?? '').trim();
	let next;
	let quantity = 0;
	let amountCents = null;
	let moves = false;

	if (action.kind === 'loan') {
		if (loan) throw new Error('This loan was already recorded.');
		if (!['lent', 'borrowed'].includes(action.direction))
			throw new Error('Choose whether this was lent or borrowed.');
		quantity = positive(action.quantity, 'Enter how many units.');
		const unitPriceCents = wholeCents(action.unitPriceCents, true);
		next = {
			vendorId: vendorKey(action.vendorName),
			vendorName: cleanVendorName(action.vendorName),
			direction: action.direction,
			itemId: action.itemId ?? null,
			productName: requireText(action.productName, 'Enter the product.'),
			unitPriceCents,
			quantity,
			adjustedQuantity: 0,
			returnedQuantity: 0,
			cashSettledQuantity: 0,
			cashPaidCents: 0,
			opening: false,
			note,
			createdBy: user,
			reviewStatus: 'needsReview',
			reviewedBy: null,
			lastEntryId: action.id
		};
		if (next.itemId && !item) throw new Error('That inventory item no longer exists.');
		moves = Boolean(next.itemId);
	} else {
		if (!loan) throw new Error('This loan no longer exists.');
		const balance = loanBalance(loan);
		next = { ...loan, lastEntryId: action.id };
		if (action.kind === 'return') {
			quantity = positive(action.quantity, 'Enter how many units came back.');
			if (quantity > balance.outstanding)
				throw new Error(`Only ${balance.outstanding} still outstanding.`);
			next.returnedQuantity = (loan.returnedQuantity ?? 0) + quantity;
			moves = Boolean(loan.itemId);
		} else if (action.kind === 'cash') {
			quantity = positive(action.quantity, 'Enter how many units this payment settles.');
			if (quantity > balance.outstanding)
				throw new Error(`Only ${balance.outstanding} still outstanding.`);
			amountCents = wholeCents(action.amountCents);
			next.cashSettledQuantity = (loan.cashSettledQuantity ?? 0) + quantity;
			next.cashPaidCents = (loan.cashPaidCents ?? 0) + amountCents;
		} else if (action.kind === 'correction') {
			quantity = stockInteger(action.quantity, true);
			if (quantity === 0) throw new Error('Enter how much to add or subtract.');
			requireText(note, 'Explain the correction.');
			if (balance.owed + quantity < balance.settled)
				throw new Error('A correction cannot leave less owed than was already settled.');
			if (balance.owed + quantity < 1) throw new Error('A loan must owe at least one unit.');
			next.adjustedQuantity = (loan.adjustedQuantity ?? 0) + quantity;
		} else if (action.kind === 'review') {
			if (loan.reviewStatus === 'reviewed') throw new Error('This loan is already reviewed.');
		} else throw new Error('Unknown vendor action.');
		next.reviewStatus = action.kind === 'review' ? 'reviewed' : 'needsReview';
		next.reviewedBy = action.kind === 'review' ? user : null;
	}

	let stock = null;
	let location = null;
	if (moves) {
		if (!item) throw new Error('That inventory item no longer exists.');
		location = normalizeStorageLocation(requireText(action.location, 'Choose a stock location.'));
		const kind = action.kind === 'loan' ? 'loan' : 'return';
		const sign = movementSign(next.direction, kind);
		const planned = planStockAction(item, {
			id: action.id,
			itemId: next.itemId,
			kind: 'adjust',
			delta: sign * quantity,
			location,
			user
		});
		stock = {
			item: planned.item,
			ledger: {
				...planned.ledger,
				event: VENDOR_MOVEMENT_EVENT,
				vendorAction: vendorAction(next.direction, kind),
				vendorLoanId: action.loanId,
				vendorName: next.vendorName
			}
		};
	}

	return {
		loan: next,
		entry: {
			kind: action.kind,
			quantity,
			amountCents,
			location,
			itemId: next.itemId,
			stockTransactionId: stock ? action.id : null,
			note,
			user
		},
		stock
	};
}

/**
 * Sort loans into the page's views. A loan can be in Needs review and in a
 * balance view at once; settled loans move to Settled history.
 * @param {VendorLoan[]} loans All loans in the workspace.
 * @returns {{ owedToUs: VendorLoan[], weOwe: VendorLoan[], needsReview: VendorLoan[], settled: VendorLoan[] }}
 */
export function groupLoans(loans) {
	const groups = { owedToUs: [], weOwe: [], needsReview: [], settled: [] };
	for (const loan of loans) {
		const { status } = loanBalance(loan);
		if (status === 'settled') groups.settled.push(loan);
		else if (loan.direction === 'lent') groups.owedToUs.push(loan);
		else groups.weOwe.push(loan);
		if (loan.reviewStatus !== 'reviewed') groups.needsReview.push(loan);
	}
	return groups;
}

/**
 * What a set of loans still owes in dollars. A loan without a unit price has no
 * value to add, so it is counted apart rather than treated as zero.
 * @param {VendorLoan[]} loans Stored loans.
 * @returns {{ cents: number, unpriced: number, count: number }} Priced outstanding
 *   cents, how many loans had no price, and how many loans there were.
 */
export function outstandingTotals(loans) {
	let cents = 0;
	let unpriced = 0;
	for (const loan of loans) {
		const { outstandingCents } = loanBalance(loan);
		if (outstandingCents === null) unpriced += 1;
		else cents += outstandingCents;
	}
	return { cents, unpriced, count: loans.length };
}

/**
 * Vendor names to suggest when recording a loan: one per counterparty, since
 * "daniel" and "Daniel" are the same vendor, spelled as on its most recent loan and
 * sorted A–Z ignoring case.
 * @param {VendorLoan[]} loans All loans.
 * @returns {string[]} Display names.
 */
export function vendorSuggestions(loans) {
	const latest = new Map();
	for (const loan of loans) {
		const name = cleanVendorName(loan.vendorName);
		if (!name) continue;
		const key = loan.vendorId || name.toLowerCase();
		// A loan that is still saving has no time yet, so it is the newest.
		const time = loan.createdAt?.getTime?.() ?? Infinity;
		const seen = latest.get(key);
		if (!seen || time >= seen.time) latest.set(key, { name, time });
	}
	return [...latest.values()]
		.map((entry) => entry.name)
		.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

/**
 * Outstanding totals per vendor, one line per product and direction. Different
 * products are never added together, and units stay apart from dollars.
 * @param {VendorLoan[]} loans All loans.
 * @returns {Array<{ vendorId: string, vendorName: string, lines: Array<{ direction: 'lent' | 'borrowed', productName: string, outstanding: number, outstandingCents: number | null }> }>}
 *   Vendors with anything outstanding, alphabetical.
 */
export function vendorSummaries(loans) {
	const vendors = new Map();
	for (const loan of loans) {
		const balance = loanBalance(loan);
		if (balance.outstanding === 0) continue;
		const vendor = vendors.get(loan.vendorId) ?? {
			vendorId: loan.vendorId,
			vendorName: loan.vendorName,
			lines: new Map()
		};
		const key = `${loan.direction}|${loan.itemId ?? loan.productName.toLowerCase()}`;
		const line = vendor.lines.get(key) ?? {
			direction: loan.direction,
			productName: loan.productName,
			outstanding: 0,
			outstandingCents: 0
		};
		line.outstanding += balance.outstanding;
		line.outstandingCents =
			line.outstandingCents === null || balance.outstandingCents === null
				? null
				: line.outstandingCents + balance.outstandingCents;
		vendor.lines.set(key, line);
		vendors.set(loan.vendorId, vendor);
	}
	return [...vendors.values()]
		.map((vendor) => ({ ...vendor, lines: [...vendor.lines.values()] }))
		.sort((a, b) => a.vendorName.localeCompare(b.vendorName));
}
