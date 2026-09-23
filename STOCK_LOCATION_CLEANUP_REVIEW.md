# Proposed one-time freezer/fridge cleanup

Status: historical review. Seven cold pairs (avocado, bacon, beef barbacoa, beef burger,
cheese curds, ground beef, pork) were approved and merged on 2026-09-22. Vendor-named
entries such as the Enercare burgers were not merged. On the same day the owner confirmed
54 of their 2026 freezer/fridge moves (equal quantity, within five minutes, either order)
as historical transfers; three overlapping alternatives, split moves such as −10 → +9 and
+1, and additions with no nearby removal remain unreviewed and still count as demand.

## Source and limits

Observed on 2026-09-14 through the signed-in StockSense Manage Items page at
http://127.0.0.1:5173/manageItems. Selected All and read all 148 rendered inventory rows.
This is the current app's inventory view, not the historical CSV in src/scripts.
The displayed inventory value was $5,664.44.

The page exposes names, counts, storage labels, costs, thresholds, and booth tags.
It does not expose database item IDs, group ID, exact unrounded costs, pending-write
metadata, or full item documents. This report is not an executable migration manifest
or a database backup. Transaction histories and order drafts have not been audited.
Resolve exact IDs and re-read source documents before preparing any write operation.

## Likely pairs

Keep the existing base item's ID and metadata. Assign the base item's count to Freezer
and the corresponding “in fridge” item's count to Refrigerator, subject to confirmation
that the names represent actual physical stock in the same unit.

| Proposed survivor (exact current name) | Proposed duplicate (exact current name) | Freezer | Fridge | Combined | Displayed cost on both |
| -------------------------------------- | --------------------------------------- | ------: | -----: | -------: | ---------------------: |
| avacodo                                | Avacado In fridge                       |       0 |      3 |        3 |                 $79.67 |
| bacon                                  | Bacon in fridge                         |       2 |      1 |        3 |                 $33.44 |
| beef barbacoa                          | Beef barbacoa in fridge                 |       0 |      0 |        0 |                $213.33 |
| beef burger (beef chuck brisket)       | Beef burger in fridge                   |       0 |      7 |        7 |                 $61.20 |
| cheese curds                           | Cheese curds in fridge                  |       0 |      2 |        2 |                $155.19 |
| ground beef                            | Ground beef in fridge                   |       0 |      0 |        0 |                $450.00 |
| pork                                   | Pulled pork in fridge                   |       0 |      0 |        0 |                 $67.16 |

Every pair has matching displayed cost, zero low-count thresholds, and no displayed
booth tags. Those observations support pairing but do not prove product/unit identity.
All 14 source rows currently display Freezer as their storage type, including every
“in fridge” entry. Applying the ordinary storageType fallback without these explicit
assignments would incorrectly put the named fridge balances in Freezer.

The first six pairs are strong name/cost matches, allowing for the avocado spelling
variation and the burger description. The pork pair needs confirmation that “pork” is
the same pulled-pork product rather than a different preparation. Do not rename the
survivors merely to fix spelling as part of this review.

If all seven pairs are confirmed and no other changes occur, 14 rows become 7, reducing
the catalog from 148 to 141 items. These pairs retain a combined 15 tracked units:
2 in Freezer and 13 in Refrigerator. Do not treat mixed-product units as a common
physical measurement. Their displayed value sums to $1,078.11 before and after the
proposed consolidation, using the displayed matching costs.

## Do not infer these as freezer/fridge duplicates

- “Fries to compound” (4), “Fries to dwight” (10), “Fries to gus” (5), and similar
  destination entries are outside the cold-location cleanup. The user clarified that
  lending product to Compound creates an obligation to return product or pay cash;
  do not add such obligations to the 30 units on “fries”. Exact outstanding balances
  and the interpretation of each additional named entry still require review.
- The user clarified that “Cheese curds from Dwight” (2) represents borrowing from
  Dwight and owing him repayment. Track this through the planned vendor loan ledger,
  not a freezer/fridge merge. Whether the displayed 2 is currently outstanding remains
  unconfirmed. “Burgers taken from enercare” (2) remains a separate unresolved entry.
- “chipotle sauce jugs” (1) and “Chipotle sauce case (2 jug) from danny” (1) explicitly
  suggest different units; adding their counts would not be a valid unit conversion.
- “snowcrab” (0) and “New snow crab meat” (12) may be different products or packaging;
  neither is an explicitly named fridge duplicate.
- “Dehydrated potato powder” (0) and “Dehydrated, potato powder on roof of storage” (48)
  are a possible separate dry-storage cleanup, outside the cold-location scope.
- “Bacon bits” is distinct from bacon; different preparations/packages must stay distinct.

The “fries” base row currently displays Refrigerator. Do not assume that is physically
correct or automatically move it to Freezer based on the product name. This is a
separate location-confirmation issue, not evidence of a missing fridge duplicate.

Vendor lending/borrowing is a separate planned feature. Before converting existing
rows, establish original quantities, repayments, units, cash valuation, and whether
the associated physical stock movement is already reflected in inventory/history.
Conversion must not replay an old issue or receipt and change stock a second time.

The user confirmed that current repayments are handled inconsistently: reduce the
item count for a partial repayment, delete it when fully repaid, or leave it unchanged
for owner review. Therefore the visible count is not a reliable outstanding balance.
Retained entries may already be settled, and deleted entries do not provide a complete
repayment history. Owner review and any available ledger evidence are required before
importing opening vendor balances. See VENDOR_BALANCES_FEATURE_BRIEF.md.

## Before any merge is applied

1. Confirm the product/location assignments, especially the pork pair and shared units.
2. Complete and explicitly deploy compatible per-location app behavior before cleanup.
   Synchronize older clients' pending writes; do not merge under the old count-only app.
3. Read exact source documents/IDs within the intended group, check aliases, and back
   up affected records outside public folders. Refresh counts and expected source state.
4. Audit relevant transaction histories for reviewed equal-quantity removal/addition
   pairs within five minutes. Done: 54 pairs confirmed on 2026-09-22 (see Status).
5. Audit saved order references and include any needed explicit resolutions in the plan.
6. Produce the final ID-based dry-run manifest. Apply only approved pairs, with stale-state
   checks, retry protection, atomic stock/ledger writes, and original history preserved.

No permanent merge screen is required. Keep cleanup in scoped maintenance tooling;
new products should be created once with opening quantities in their allowed locations.
