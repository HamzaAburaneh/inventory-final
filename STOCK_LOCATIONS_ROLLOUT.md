# Storage-location rollout and reviewed maintenance

The app queues stock actions in IndexedDB and replays them while the authenticated app
is open. Inventory screens show confirmed balances; the queue lists pending changes.
Group-scoped immutable `stockOperations` receipts prevent retries, two tabs and lost
acknowledgments from applying the same operation twice. Absolute actions compare both
balances and the last stock revision; conflicts require a fresh confirmation.

Do not deploy or apply maintenance without the owner's explicit request.

1. Before deployment, have staff reconnect every older installation and wait for its
   existing Firestore writes to finish. The new action queue cannot repair an old queued
   absolute batch. Never clear persistence to discard unresolved work.
2. Deploy the compatible app, Firestore rules and indexes together. Review metadata
   reads and receipt writes require the new rules. Check index readiness. Have all
   clients reload/update their service worker and verify the location controls. Close
   obsolete tabs/installations; old clients are not made safe by the new queue.
3. Synchronize all known new pending actions before maintenance. The command cannot
   inspect another device's IndexedDB. An unknown later action targeting a deleted
   duplicate will require attention, rather than redirecting or recreating the item.
4. Use administrator Application Default Credentials to produce a read-only report:

   ```powershell
   node src/scripts/stock-locations.js --project PROJECT_ID --group GROUP_ID --out .private-stock-maintenance/review.json
   ```

   This reads one explicit group, including current item IDs, ledger, existing review
   decisions and order drafts. Keep reports private. The earlier browser candidate
   report is not an approved mapping. “pork” versus “Pulled pork in fridge” remains
   unresolved. Vendor-named obligations are outside this feature.

5. Prepare a JSON manifest with `groupId`, `approved: false`, `reviewedBy`, `pairs`,
   `historyLinks` and `reviewDecisions`. Each pair has a stable unique `operationId`,
   `keptId`, `duplicateId`, `keptLocation`, `duplicateLocation`, full `expectedKept`
   and `expectedDuplicate` objects including IDs, and `draftResolutions`. Each draft
   resolution has `id`, full `expected` draft, and an explicitly chosen
   `survivorOverride` (`{qty, included}`, either field optional, or `null` to remove).
   No automatic summing of order overrides occurs.

   `historyLinks` entries have `locations: {"originalItemId": "Freezer", "duplicateId":
"Refrigerator"}` for explicitly confirmed product/location relationships. Running
   the command with `--manifest PATH` is still a dry run and reports equal opposite
   movements within five minutes, in either order, as candidates. It makes no database writes.

   A review decision has `id`, unique `operationId`, ordered `transactionIds`
   (removal, addition), full `expectedTransactions` (including IDs), `expectedReview`
   (null for a new decision), and `confirmed`. Corrections use a new operation ID and
   the current expected review. Both original ledger rows remain unchanged. Reversing
   a decision records another audit entry and restores the old demand interpretation.

6. Ask the owner to approve the exact manifest and unresolved physical assignments.
   Only then set `approved`, `compatibleAppDeployed`, `oldClientsSynchronized`, and
   `localPendingActionsCleared` to true, recording who reviewed it. Apply explicitly:

   ```powershell
   node src/scripts/stock-locations.js --project PROJECT_ID --group GROUP_ID --manifest APPROVED.json --out .private-stock-maintenance/result.json --apply
   ```

   Backups are written before database changes, by default in the ignored
   `.private-stock-maintenance` directory. Each pair combines the survivor, deletes
   the duplicate, writes two linked merge records and resolves its affected drafts
   in one transaction. Changed source items/drafts stop that pair. Pairs are individually
   atomic, not a global batch; completed pairs can be retried with their original IDs.
   Sequential pairs must expect the preceding pair's resulting survivor/drafts.
   Oversized draft updates stop for a separately reviewed staged plan.

7. Check resulting totals, aliases, order drafts and history. Only explicitly confirmed
   historical transfer pairs are excluded. Unreviewed transfers and legacy vendor
   activity may still overstate demand. Do not call the entire ledger corrected.

The command requires real administrator credentials for a fresh database report.
Signing into the web app does not authorize extracting its credentials. No live
inventory migration is part of local implementation/testing.

For isolated synchronization regression tests, start `npx --yes firebase-tools
emulators:start --only auth,firestore --project demo-stocksense --config
firebase.stock-tests.json`, then set `STOCK_EMULATOR_TESTS=1` and run
`npx playwright test --config playwright.stock.config.js --project=chromium`.
The queue fixture builds the actual queue/transport into a production bundle and
uses real IndexedDB, two browser contexts/tabs, and emulator transactions. Its
test-only shell worker enables offline reload; the normal production service
worker remains covered separately by `tests/offline-pwa.test.js`.

Older import scripts such as `add-unique-items.js` and `add-transactions.js` target
the retired root-level collections. They are not app stock writers and are not
compatible maintenance entry points for group inventory. Do not use them to apply
this feature or repopulate migrated items.
