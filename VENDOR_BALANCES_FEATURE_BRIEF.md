# Planned feature: Vendor Balances

Status: product brief for a separate future feature. No application implementation,
live data conversion, or permissions redesign is authorized by this document alone.
Read AGENTS.md and the current code before turning this into an implementation task.

## Confirmed business workflow

Event vendors lend and borrow inventory from one another. Lending Compound five units
of fries creates an obligation owed to us; borrowing two units of cheese curds from
Dwight creates an obligation we owe Dwight. Repayment can be product or cash.
Vendors/counterparties are distinct from the booth tags identifying our own stands.

Currently these obligations are tracked as inventory items with names such as
"Fries to compound" or "Cheese curds from Dwight". Staff may reduce the count for
partial repayment, delete the item when fully settled, or leave it unchanged for owner
review. Existing counts cannot be imported as confirmed debts automatically.

## Proposed user workflow

A Vendor Balances page should show:

- **Owed to us:** products lent to other vendors and the remaining obligation.
- **We owe:** products borrowed and what we still need to repay.
- **Needs review:** records awaiting owner review, regardless of whether settled.
- **Settled history:** completed loans and their repayment records.

Record each loan separately, linked to a vendor and an existing product. Capture
direction, quantity, tracked unit, event/date context, notes, and the recording user.
Do not create another inventory item for each vendor. Multiple loans of the same
product can exist; show their individual histories and a per-vendor summary.

Keep fulfillment and review independent:

- Fulfillment: open, partially settled, or settled, derived from the loan and repayments.
- Review: needs review or reviewed, with reviewer, timestamp, and optional notes.

A cash or product repayment can settle a loan while leaving it visible for owner review.
Marking a record reviewed must not itself settle a debt or move inventory. A new repayment
or correction after review should flag the changed record for review again.

## Inventory and settlement behavior

| Event                                        | Stock effect                      | Obligation effect         |
| -------------------------------------------- | --------------------------------- | ------------------------- |
| Lend Compound 5 fries                        | Remove 5 from the chosen location | Compound owes us 5        |
| Compound returns 2 fries                     | Add 2 to the chosen location      | Compound owes us 3        |
| Compound pays cash to settle the remaining 3 | None                              | Mark the agreed 3 settled |
| Borrow 2 cheese curds from Dwight            | Add 2 to the chosen location      | We owe Dwight 2           |
| Return 1 cheese curd unit to Dwight          | Remove 1 from the chosen location | We owe Dwight 1           |
| Pay Dwight cash to settle the remaining 1    | None                              | Mark the agreed 1 settled |

Support partial and mixed product/cash repayments. For cash, record the actual amount,
currency, and the agreed quantity it settles. Do not silently convert cash into quantities
using today's item cost. A proposed default is to snapshot an agreed unit settlement
value when the loan is recorded, with explicit handling of later negotiated differences.
Record payments already made; integrating payment processing is not part of this brief.

Keep quantities in the item's tracked unit. Cases and individual jugs are not interchangeable.
Do not add different products together into one unit balance, automatically net borrowing
against lending, or assume a case-to-unit conversion from a similar name.

Each physical movement must atomically update inventory, the stock ledger, and its linked
loan/settlement state. Use operation IDs so retries do not duplicate a repayment or stock
movement. Cash settlement changes the obligation only. Refuse invalid/oversized repayments
and removals exceeding available stock. Reuse the storage feature's tested action queue
if implemented; do not fall back to cached absolute offline writes.

Keep settled records and their payment/return history. Corrections should be explicit,
linked audit entries rather than silent edits or deletion of the underlying history.
Lending, borrowing, and their repayments need distinct event meanings so they do not
inflate forecasts of stock issued to our own booths. They still affect actual on-hand
stock when product physically moves.

## Existing records: reviewed conversion only

Before importing vendor-named items, prepare a read-only report and have their current
meaning reviewed. Confirm vendor, product, unit, direction, outstanding quantity,
known repayments, and whether the owner has reviewed them.

- An unchanged count may be fully or partly repaid but awaiting review.
- A reduced count may represent a remainder, but does not identify repayment method.
- A deleted item does not provide a complete settlement history by itself.
- Missing information remains unknown; do not invent original loan dates, payments,
  or balances to make the history appear complete.
- Import confirmed opening obligations without replaying old stock movements.
- Separately reconcile any placeholder inventory quantities only with an approved plan;
  neither blindly combine them with stock nor delete them through a path that creates
  fictitious booth demand.
- Back up affected records, preserve original transaction evidence, and recheck state
  before applying a reviewed conversion. Use the intended group only.

The freezer/fridge cleanup must leave these vendor records alone. No new user roles or
access restrictions are part of this proposal; review is a business workflow, and any
owner-only enforcement should be agreed separately before implementation.

## Acceptance examples for the eventual implementation

- Lend 5, receive 2 back, and settle 3 in cash: zero remaining, with three auditable
  entries and no stock change for the cash payment.
- A settled loan awaiting review remains visible under Needs review and Settled history.
- Marking it reviewed changes neither stock nor the outstanding amount.
- Borrowing and returning goods produce the correct inventory changes and payable balance.
- Retrying or reconnecting after a recorded settlement cannot apply it twice.
- Uncertain legacy records remain pending review and do not become confirmed balances.
- Separate groups cannot read or change each other's vendors, loans, or repayments.
- Currency totals and product-unit totals remain distinct; no accidental double valuation.

Finalize this feature's data model, cash valuation defaults, and implementation plan
after the storage-location work. Do not expand the current storage feature into this page.
