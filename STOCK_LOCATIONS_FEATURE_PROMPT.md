# Feature: stock by storage location, reliable offline actions, and duplicate cleanup

Read AGENTS.md first. Implement this feature in the existing StockSense app, following
its Svelte 5 runes, JavaScript/JSDoc, group isolation, theme, and verification conventions.
Give me a short implementation plan before coding, then proceed. Ask only about
unresolved decisions that materially affect correctness; use the defaults below.
Do not commit, push, deploy, or run production data maintenance unless I explicitly ask.
Do not create design previews unless I request /make_a_preview or explicitly ask for one.

## Business goal

One product should have one item, with stock split by storage location. Today staff
create duplicates such as "Avocado" and "Avocado in fridge".

Removing stock normally means issuing it from storage to a booth. This is the demand
we want to forecast, not customer sales. Booths remain tags showing which stands use
a product; do not introduce stock balances per booth.

Lending to or borrowing from other vendors is a separate planned feature. Entries
such as "Fries to compound" and "Cheese curds from Dwight" represent obligations
settled in product or cash, not freezer/fridge duplicates. Leave those records out of
this cleanup; do not add their counts to stock, delete them, or convert them to loans
in this feature. Do not infer historical outstanding balances from their names alone.
Existing forecasts may still contain this legacy activity until that separate reviewed
cleanup; do not claim this storage feature fully corrects it.

Counts are whole units. An item's unit might be a case, jug, or package. Do not add
fractional quantities, unit conversion, or per-item unit configuration in this feature.

Low-stock status and order calculations use the combined item count and its existing
lowCount threshold. An empty fridge alone does not make an otherwise well-stocked
product low-stock.

## Read and trace the affected paths

Read the current types, writes, stores, history, forecasting, orders, rules, and tests:

- src/types.js; src/lib/items.js; src/stores/itemStore.js.
- src/lib/syncQueue.js; src/stores/connectivityStore.js; the existing offline indicator;
  src/firebase.js; src/service-worker.js.
- src/lib/transactions.js; transactionHistory.js; transactionAnalysis.js.
- src/lib/predictionsClient.js; stockPrediction.js; predictionCore.js;
  aiStockPrediction.js; predictionBacktest.js; cneCalendar.js.
- src/lib/orders.js; orderSheet.js; src/routes/orders/+page.svelte.
- The Manage Items, Manage Transactions, and Transaction History pages and their
  shared table, mobile card, form, storage selector, timeline, and dialog components.
- firestore.rules, firestore.indexes.json, package.json, relevant unit/browser tests.

Do not assume AGENTS.md's planned features already exist. All new Firestore work
belongs in src/lib and under the current groups/{gid} boundary. Preserve the client-read,
authenticated-POST prediction API; do not add server Firestore reads to that endpoint.

## Item model and normalization

Create shared pure helpers in src/lib/stockLocations.js.

- Item.stockByStorage has all three canonical keys: Freezer, Refrigerator, Dry Storage.
  Values are finite, nonnegative safe integers.
- Item.count remains stored and equals the sum of the map after every stock write.
- Item.storageType remains the starting/default location, also determining the allowed
  storage family: Freezer/Refrigerator are cold; Dry Storage is dry-only.
- Cold items allow both cold locations, including when either is empty. Dry items
  allow only Dry Storage. Reject cross-family writes even when the item has zero stock.
- Item.legacyItemIds is an optional deduplicated list of merged IDs. No self-aliases.
- A legacy item without a map is read as its count in its normalized storageType.
  Normalize case/whitespace and accept "fridge" and "dry". Blank legacy storage defaults
  to Freezer. Reject unrecognized nonblank storage rather than silently relocating it.
- Normalize valid legacy numeric counts without silently truncating invalid values.
  Missing map keys may mean zero. Reject negative/fractional/nonfinite balances,
  unknown location keys, or invalid mixed-family data.
- For an existing map, the map is the authoritative stock representation. If its total
  disagrees with stored count, surface the inconsistency and block stock mutations
  until explicitly resolved; do not silently manufacture a corrective transaction.
- Ordinary reads do not write. Persist a normalized map when a valid stock mutation
  next occurs; no-op adjustments should not create phantom history. The reviewed
  one-time duplicate cleanup below may initialize maps for its selected items.

New items require a Starting Location/default and allow opening balances in each allowed
location: both freezer and fridge for cold products, only Dry Storage for dry products.
Derive the initial total from these inputs; do not require duplicate items to enter a split.
The default location is not a restriction on the other allowed cold location. Generic
updateItemFields must reject stock maps, total count, starting-location changes, and
merge bookkeeping edits; dedicated ledgered operations own these fields.

## Ledgered operations

Update shared types, all readers, stores, and consumers together.

- Ordinary adjustments require an explicit location. Keep existing argument ordering
  compatible where possible and update every caller. No implicit choice on split items.
- setItemCount with a location sets only that location. setItemCount(id, 0, user) with
  no location means Reset item and clears every location. Other locationless sets fail.
- Validate quantities before writing. Oversized removals fail with no writes, both
  online and during replay; this deliberately replaces current silent clamping.
- Update add, delete, reset-item, and reset-all to use normalized per-location balances.
  Record before/after maps for operations affecting multiple locations.
- Add transferItemStock(id, from, to, quantity, user): Freezer <-> Refrigerator only,
  distinct locations, positive whole quantity within the source balance, total unchanged.
- Online writes read the latest item and atomically save both stock and the ledger.
  Preserve per-item atomicity and accurate totals for bulk resets; do not imply that
  a multi-batch reset-all is globally atomic.
- Update itemStore methods and any local projections so count and map agree. Keep
  each location's amount input independent. Live snapshots must not erase unrelated
  in-progress inputs or double-apply optimistic changes.
- Preserve existing itemCreated/itemDeleted/countChange events. Add stockTransfer
  and itemMerged. Define transfers with a neutral type such as "transfer" rather
  than pretending they are stock added or removed, and update all type consumers.
- Include location for ordinary adjustments; fromLocation, toLocation, quantity for
  transfers; previousStockByStorage/newStockByStorage for transfers, merges, and resets.
  Keep previousCount/newCount as totals. Retain timestamp, syncedAt, and user fields.
- Add a stable operation ID for retry protection. Client-entry time and authoritative
  application time must remain distinguishable; timestamps are not a replay-order key.

## Offline behavior: queue actions, not cached final counts

Replace the stock-changing cached absolute-batch path. Reusing queueCountChange as-is
does NOT satisfy this feature.

Example acceptance case:

- Both devices last saw 10 fries in the freezer.
- Device A is offline and records +5 freezer fries.
- Device B online records -2 freezer fries, leaving 8.
- A reconnects: apply +5 to the current 8, finishing at 13.
- A's committed ledger row is 8 -> 13. A retry must still leave 13 and one ledger row.

Requirements:

- Persist each action locally before acknowledging it as queued, using durable browser
  storage. Include operation ID, original user/group, item ID, kind, locations,
  quantity/delta, original entry time, and ordering metadata. No secrets in the queue.
- Preserve queued actions through reloads/restarts. A local storage failure must be
  visible; never claim an action was saved when it was not durably stored.
- Do not send speculative stock updates or speculative final ledger records to
  Firestore's automatic offline write queue.
- Replay when the authenticated app is active and connectivity is available. Do not
  promise background synchronization while the app is closed.
- Apply deltas/transfers to the latest server balances using a Firestore transaction.
  Atomically check durable operation deduplication, update stock, and create its ledger
  record(s). Handle uncertain acknowledgments with the same ID, including retries of
  an operation that began online. No duplicate application across tabs or workers.
- Preserve local order for actions on an item. When an action needs attention, pause
  dependent actions on that item; unrelated items can continue.
- Separate pending projections from confirmed stock. Show queued/syncing/needs-attention
  status and expose retry/cancel for unapplied actions. Cancel must not undo an action
  that the server already applied.
- Recheck available stock when replaying removals/transfers. If insufficient, keep the
  action visible for review; do not partially apply, silently clamp, or create a ledger row.
- Scope pending actions by user and group. A different account/group must never replay
  someone else's queue. Sign-out must not silently erase unsynced work.
- Missing/deleted/merged targets require attention. Do not recreate a deleted duplicate
  or automatically redirect a pending write to its survivor.
- Keep set/reset/reset-all usable offline as queued actions, but they are absolute
  intentions, not additive deltas. Capture an expected stock revision or equivalent
  conflict condition, including earlier pending actions. If intervening writes invalidate
  it, require a refreshed user confirmation instead of erasing someone else's restock.
  New confirmation becomes a new operation; no repeated server application.
- Audit all stock-changing paths, including create/delete and misleading online status.
  Do not leave an alternate absolute offline writer that can overwrite the new balances.
  Give create/delete equivalent ordering/conflict protection rather than silently
  removing their existing offline support. Merges remain online-only.
- Existing Firestore-persisted writes from an older app version are different from the
  new queue. Document a rollout procedure to sync old clients before stock migration;
  do not clear persistence and lose unsynced data or claim old batches are fixed.
- Keep auth/group checks, PWA shell caching, and new queue status coherent. The existing
  syncQueue counter is session-only; it is not a durable operation queue.

Use a focused queue module and pure operation helpers, keeping Firestore operations in
the data layer. Explain the replay/deduplication design in the plan without requiring
a new backend framework. Add group-scoped rules/indexes if new documents need them.

## One-time duplicate cleanup (no permanent merge page or modal)

Read STOCK_LOCATION_CLEANUP_REVIEW.md for the seven preliminary pairs observed through
the signed-in inventory page. It is a candidate report, not approved mapping or an
ID-based database snapshot. Re-read current documents and resolve its uncertainties.

Inspect the actual group's items read-only and prepare a concrete proposed cleanup.
Use names, stored locations, quantities, metadata, and relevant transaction patterns
to identify likely freezer/fridge duplicates. Location words in names can support an
inference; they do not establish a physical balance. Flag ambiguous cases rather than
silently treating every cold product as having stock in both places.

Produce a reviewable manifest/report containing exact item IDs, original names/counts/
storage fields, proposed survivor and location assignments, resulting balances, metadata
differences, evidence, and uncertainties. Get approval of the concrete mapping before
applying it. Do not claim a local CSV/import file is a current database snapshot.

Implement a narrowly scoped maintenance command with a dry-run default and explicit
apply mode for an approved manifest. No merge buttons, pages, selectors, or dialogs
in the normal app. Reuse tested merge/domain logic through this actual caller.
Do not apply cleanup until compatible per-location code is deployed and older clients'
pending writes have been synchronized. Deployment remains explicit-request-only.

Before applying, save a local backup of affected documents outside publicly served
folders. Recheck the manifest's expected source state and stop on changed balances or
metadata; do not apply stale approval. Make retries safe and report per-pair completion.
Use one explicit group, never an unbounded all-groups cleanup. Online only; validate
and read all required documents before writes in each Firestore transaction.

- The approved manifest supplies the kept product, duplicate, and actual cold location
  for each single-location legacy item, correcting misleading storage tags where confirmed.
- Allow a kept item already split between freezer/fridge to absorb another single-location
  duplicate; preserve its split. Reject a duplicate already split for this initial workflow.
  This allows cleanup of more than two duplicates without redistributing the survivor.
- Cold items only. Reject dry/cold mixing, self-merges, stale/deleted selections, and
  invalid alias overlap. Block merging items with known local pending stock actions.
  Another device's unknown pending action must become needs-attention on replay.
- Preserve kept ID, name, barcode, cost, lowCount, and starting location. Union booth
  tags and flatten/deduplicate aliases from both items plus the duplicate ID.
- Combine stock, delete the duplicate, and append two linked itemMerged records atomically:
  survivor total A -> A+B; duplicate B -> 0. Use reciprocal relatedItemId, a shared
  operation ID with distinct record IDs/roles, and actual before/after stock maps.
  Distinguish stored pre-merge balances from user-confirmed location reassignment.
- Show resulting balances and metadata in the report, including differing cost,
  barcode, or thresholds and which values will be retained.
- Do not rewrite historical ledger rows. Audit saved order drafts for retired item IDs
  before cleanup and include any required override changes in the reviewed manifest.
  Require explicit resolution of conflicting quantity/inclusion choices; do not silently
  drop overrides or sum them. Back up affected drafts, reject concurrent changes, and
  coordinate each pair's approved updates atomically where feasible. If an atomic operation
  would exceed supported limits, stop and propose a staged plan before applying that pair.

## Historical transfers and forecasts

Alias mapping alone does not fix old internal transfers. Include reviewable candidates
in the one-time cleanup report for explicitly proposed duplicate products/merge aliases.
Use maintenance tooling and an approved manifest, not a permanent historical-review UI.

- Suggest a pair when an old removal is followed by an equal positive addition within
  five minutes, inclusive, across the corresponding freezer/fridge item IDs.
- Limit candidates to explicitly linked products and known or user-confirmed locations;
  do not merge or match products by fuzzy names.
- Exclude explicit lifecycle, merge, and transfer events from candidate matching.
  Legacy rows without event can be candidates. Show timestamps, names, quantities,
  locations, and users to the reviewer.
- Timing/quantity matches are suggestions. Require explicit acceptance. One record can
  belong to at most one confirmed pair; overlapping candidates need manual resolution.
- Persist review decisions in group-scoped metadata with source transaction IDs and
  reviewer/time. Keep original transactions unchanged, and allow a reviewed decision
  to be corrected with an audit trail. Do not store this only in browser memory.
- Keep history rows under their original item IDs/names by default. Show confirmed
  historical-transfer annotations without rewriting records. No automatic history rename.
- Before forecasting, map aliases onto the survivor in memory and exclude new transfers,
  both merge records, and both sides of confirmed historical transfers from the movement
  dataset. Do not mutate the input or include any row twice.
- Apply preprocessing before normal/backtest branching, fair-run segmentation, sample
  selection, training, holdout actuals, ARIMA, deterministic baseline, and AI inputs.
- Use the same exclusions for analytics added/removed totals, daily movement, hourly
  movement, and top movers. Audit views may still count/show the records explicitly.
- Unreviewed candidates keep their previous interpretation. Explain that historical
  demand may remain overstated until reviewed; never report a candidate as proven.
- Preserve handling of unrelated legacy/lifecycle events unless this feature explicitly
  changes it. Do not broaden this into a general waste/correction classification redesign.
- Keep forecasts and ordering product-total-based. If AI input describes storage,
  supply current location balances rather than presenting starting location as the only
  current location, and update relevant cache keys.

## UI behavior

Follow existing app patterns, accessibility, and theme variables. No design-selection
round unless requested.

Manage Transactions:

- One card per product, with name, total, and total-based stock status.
- Independent minus / amount / plus controls and count for each allowed location,
  including locations with zero stock.
- Transfer dialog with from/to swap, quantity, balance preview, and validation.
- Keep reset-item and reset-all confirmations; explain pending/conflicted resets.
- All / Freezer / Fridge / Dry location filters show products with positive stock there.
  All includes empty products. Combine filters with existing search/status filtering
  and reset pagination appropriately. Cards still show product-wide totals.

Manage Items:

- Replace Storage Type with Stock Locations: quantity chips or No stock, also on mobile.
- Remove the storage-type edit path, including its modal branch and dead imports.
- Keep unrelated metadata editing and item functionality.
- Add location filters. Do not add merge or historical-cleanup controls to the app.
- Define meaningful sorting for the new column instead of sorting an object or silently
  retaining starting-location sorting.
- Starting Location/default is required on Add item. Accept opening quantities for
  each allowed location and display their combined total. Await an explicit success result before
  clearing the form; the parent's caught errors must not look like success to the child.
  Prevent double submission and preserve inputs on failure.

Transaction History:

- Add Transfers and Merged items filters and clear timeline descriptions.
- Show locations on ordinary adjustments and distinguish stock transfers from booth issues.
- Exclude transfers, merges, and confirmed historical transfer pairs from added/removed
  totals, while retaining the audit records.
- Extend CSV with Location, From location, To location, Quantity, and review information.
  Preserve full-filtered-set export, original IDs/names where included, and CSV escaping.
- Add necessary composite indexes for both sort directions, without changing season
  boundaries or truncating history.

All dialogs need keyboard operation, focus containment/return, clear errors, and
mobile layouts. Verify light/dark across base, hover, focus, active, disabled, queued,
and error states. Mobile action targets should be at least 44px.

## Build order and acceptance

Work in reviewable stages:

1. Normalization, domain contracts, operation planning, and tests.
2. Ledgered writes and durable action queue with replay/conflict tests.
3. Tested maintenance merge logic and historical review metadata, then shared
   forecast/analytics preprocessing.
4. Stores, forms, pages, history/CSV, maintenance draft-reference handling, and
   end-to-end verification. Prepare the dry-run cleanup report; applying it is a
   separate step after compatible deployment and concrete mapping approval.

Required regression coverage:

- Legacy aliases/defaults, invalid maps, totals, cold/dry rules, zero-stock filters.
- Per-location adjust/set, resets, add/delete, no-ops, and direct-write guards.
- Transfer total preservation; insufficient quantities produce no writes.
- Merge balances/metadata/aliases, sequential merges into a split survivor, two linked
  records, duplicate deletion, same-group constraints, and offline rejection.
- Maintenance dry-run makes no writes, stale manifests are rejected, apply retries do
  not duplicate merges, and backups plus approved draft-reference handling are verified.
- Offline 10 - 2 + 5 = 13, two clients, replay retry after lost acknowledgment, reload,
  multiple tabs, user/group isolation, ordered actions, missing targets, insufficient
  stock, and conflicting resets. Test durable deduplication, not just callback counts.
- Candidate five-minute boundaries, unequal quantities, unrelated products, overlapping
  matches, explicit review, review correction, and original-ledger immutability.
- Nonmutating alias mapping, no double counting, and exclusions across prediction,
  backtest actuals/run selection, analytics, history summaries, and CSV.
- Item-store projections, input preservation, failed adds, and retired order overrides.

Use meaningful browser/emulator integration tests for concurrency and reconnect;
mocked unit tests and the existing offline shell test alone do not establish correctness.
Use isolated test data, never live inventory mutations to test the feature.

Run relevant lint/format checks, npm run check (sync only), npm run test:unit -- --run,
and production-build/browser verification appropriate to this change. Playwright's
configured server performs its own fresh build; avoid unnecessary duplicate builds.
Verify the UI in both themes on desktop/mobile and offline/reconnect against a production
preview. Report any verification limitations rather than claiming unrun tests passed.

Update AGENTS.md and shared typedefs to describe the final implementation and remove
superseded behavior descriptions. Only the scoped, reviewed maintenance tooling above
is allowed; no unrelated mass migrations, ledger rewrites, new permission roles,
framework changes, unused helpers, or public scratch files.
