# StockSense — Agent Context

## Product and operating model

StockSense manages event inventory. The immediate customer is the user's CNE operation;
the longer-term direction is a niche SaaS for operators at events such as the CNE and
Calgary Stampede. Prioritize the working CNE workflow without assuming its calendar
fits every future customer.

- Inventory represents stock held in storage. Removing stock usually means issuing
  it to a booth, not recording a sale or measuring customer consumption. Forecast
  demand means stock issued to booths.
- Booths are tags identifying which stands use a product. An operator can have many
  booths, and one product can serve several. Booths do not have separate stock balances.
- Lending to and borrowing from other vendors is a separate business workflow. For
  example, fries lent to Compound are owed back to this operation, while cheese curds
  borrowed from Dwight are owed to Dwight. Settlement may be product or cash. These
  obligations are not additional stock on hand or ordinary issues to our own booths.
- Current vendor tracking is informal: staff may reduce a vendor-named item's count
  after partial repayment, delete it when settled, or leave it unchanged for owner
  review. Neither an existing count nor an absent item reliably proves the balance owed.
- Low-stock status compares the combined stock across storage locations with the
  item's single total low-stock threshold; separate location thresholds are not requested.
- A count of 1 means one of the item's tracked unit. Units vary (case, jug, package,
  etc.); users currently put this distinction in names. Do not assume every item is
  counted in cases merely because existing forecast/order copy says so.
- Historical freezer-to-fridge movements were recorded as a removal from one item
  and an addition to a duplicate. Those removals are not booth demand. Combining old
  histories can overstate demand. Equal removals/additions for the same product within
  five minutes, in either order, are transfer candidates for review, not proof from timing alone.
- A permissions redesign is out of scope unless requested. Preserve existing
  owner/member behavior and group isolation.

### Current implementation versus planned work

Document implemented behavior accurately. Product direction is not permission to add
features incidentally, and planned fields must not be described as existing.

Items support `stockByStorage` with a stored combined `count`. `storageType` is the
starting location and cold/dry family. Legacy rows normalize on read and persist maps
on their next valid mutation. Cold items support Freezer and Refrigerator; dry items
support Dry Storage only. Creation accepts opening balances per allowed location.
An item with no stock anywhere displays and filters under its starting location.
Duplicate cleanup is implemented as reviewed maintenance tooling with no merge UI.
Seven cold freezer/fridge pairs were merged live on 2026-09-22, and 54 of their 2026
freezer/fridge moves were confirmed as historical transfers. Split moves and unpaired
additions remain unreviewed. Merging was one-time cleanup: the history page has no merge
filter, though merge rows still render. See STOCK_LOCATIONS_ROLLOUT.md for requirements.
Optional per-item unit labels are a future feature; fractional quantities and unit
conversion are not currently requested.

A separate vendor balances/loan ledger is planned, not implemented. Track counterparties,
products/units, direction, and settlements without making another item per vendor.
Real product movements affect stock; cash settlements do not. Existing vendor-named
items need a reviewed interpretation before conversion: their counts may not establish
current outstanding obligations. Keep this work outside the storage-location feature;
do not merge vendor-named rows into normal stock or treat lending as booth demand.
See VENDOR_BALANCES_FEATURE_BRIEF.md for the proposed workflow. Repayment status and
review status should be separate; settled records should remain available as history
instead of requiring item deletion. This does not authorize a permissions redesign.

Offline stock actions persist in IndexedDB before acknowledgment and replay against
current Firestore stock. Starting at 10, another device removing 2 followed by a queued
addition of 5 finishes at 13. Immutable operation receipts prevent duplicate application.
Web Locks coordinate tabs. Set/reset/delete compare balances and revision, including
prior pending actions; conflicts require refreshed confirmation. Screens show confirmed
balances with pending actions separately. Use a current browser with IndexedDB/Web Locks.
Broader event configuration and SaaS capabilities are future work.

## Stack and architecture

- **SvelteKit 2 + Svelte 5**, with `compilerOptions.runes: true`. Use `$state`,
  `$derived`, `$effect`, and `$props`; no `export let` or `$:` reactive statements.
- **JavaScript + JSDoc**, not TypeScript. Shared typedefs live in `src/types.js`.
- **Vite 8 + Tailwind 4**, using `@tailwindcss/vite`. Tailwind is imported in
  `src/styles/global.css`; no Tailwind/PostCSS config is needed for the current setup.
- **Firebase Auth + Firestore**, initialized in `src/firebase.js` from
  `VITE_FIREBASE_*` environment variables. Rules/indexes live in `firestore.rules`
  and `firestore.indexes.json`.
- **Predictions:** deterministic CNE calendar/cross-year baselines and ARIMA, with an
  optional OpenRouter AI layer. AI failures must preserve the deterministic fallback.
  Retain ARIMA's existing import compatibility and fallback handling.
- **UI:** Chart.js, Three.js, sweetalert2, and shared theme variables. Only light/dark
  are reachable through the UI theme toggle.

### Where to work

- `src/components/`: shared forms, tables, mobile item cards, transaction timeline,
  dialogs, navbar, predictions UI, and `ThreeScene.svelte`.
- `src/lib/items.js`: stock action entry points, guarded metadata edits and reads.
- `stockLocations.js` / `stockOperations.js`: pure validation and operation planning.
- `stockActionQueue.js`, `stockQueueStorage.js`, `stockActionTransport.js`: durable
  browser actions, scoped replay and atomic stock/ledger/receipt writes.
- `stockHistory.js` / `stockReviews.js`: shared aliases/exclusions and review reads.
- `stockMerge.js` / `stockMaintenance.js`: reviewed merge/draft/history maintenance,
  called by `src/scripts/stock-locations.js` (dry-run default; admin credentials).
- `src/lib/transactions.js`, `transactionHistory.js`, `transactionAnalysis.js`, and
  `transactionAudit.js`: ledger reads, season filters, analytics, and clock auditing.
- `src/lib/groups.js`, `activeGroup.js`, and `booths.js`: workspaces and booth tags.
- `src/lib/predictionsClient.js`: authenticated client reads and prediction API calls.
- `src/lib/stockPrediction.js`, `predictionCore.js`, `aiStockPrediction.js`,
  `predictionBacktest.js`, and `cneCalendar.js`: forecasting and evaluation.
- `src/lib/orders.js` and `orderSheet.js`: saved order drafts and order calculations.
- `src/stores/`: auth, group, items, connectivity, notifications, pagination, and themes.
  Additional UI state helpers live in `src/lib/runes/`.
- `src/routes/`: landing, login, onboarding, manageItems, manageTransactions,
  transactionHistory, transactionAnalysis, inventoryPredictions, orders, profile,
  and `api/stockPredictions`.
- `src/scripts/`: standalone import/maintenance scripts with their own package.json.

## Data and group boundaries

`src/types.js` is the canonical typedef reference; verify actual readers and writers
before changing a schema.

- **Item:** `id, name, barcode, count, lowCount, cost, storageType`, optional `booths`,
  `stockByStorage`, `stockRevision`, `legacyItemIds`. Canonical balances are nonnegative
  safe integers and sum to count. Invalid maps/total mismatches block stock mutation.
  Legacy case/whitespace/fridge/dry aliases normalize without a write. Booths are tags.
- **Transaction:** `id, itemId, itemName, type, previousCount, newCount, timestamp, user`,
  optional `event`, `syncedAt`, `operationId` and location/map/related-item fields.
  Types are `add | remove | transfer | merge`; events include `countChange`,
  `itemCreated`, `itemDeleted`, `stockTransfer`, `itemMerged`. Client entry time is
  distinct from authoritative syncedAt. Legacy rows may lack event/audit fields.
- **Group / GroupMember:** isolated workspace and owner/member records. The app currently
  resolves one active group per user through their profile and group store.
- **Booth:** group-scoped tag with a stable ID, editable label, and color.
- **OrderDraft / OrderLine:** daily draft with per-item quantity/inclusion overrides,
  coverage/lead days, and last-editor metadata. Lines are keyed by item ID; deletion
  or future merging must consider those references.

Inventory lives under `groups/{gid}/items` and `groups/{gid}/transactions`, alongside
`members`, `booths`, `orders`, `stockOperations`, `stockHistoryReviews` and
`stockHistoryReviewAudit`. `userProfiles/{uid}` records the user's group;
`inviteCodes/{code}` supports joining. Preserve these paths and access boundaries.
New inventory operations must stay within the active group.

The prediction API does not read Firestore. The authenticated client reads group data
and posts it with a Firebase ID token; the server verifies the token and computes results.
Normal prediction and backtest modes must agree on demand handling.

## Inventory correctness and history

- Every count change must write its matching ledger record atomically with the item
  update. `previousCount/newCount` describe item totals. Reset-all is per-item atomic,
  not a global transaction.
- Route stock changes through ledgered functions in `src/lib/items.js`. Metadata edits
  must not bypass the ledger. New stock fields require updated guards and item-store
  handling, not just database writes.
- Oversized removals/transfers fail without stock or ledger writes. Never clamp.
  No-op actions have deduplication receipts but no phantom ledger rows.
- Metadata edits cannot change total/maps, storage family, revision or aliases.
- Treat historical transactions as audit records. Do not silently rewrite them or
  reclassify ambiguous movements. The existing ledger does not fully distinguish booth
  issues, internal transfers, corrections, and other removals.
- Forecasting maps aliases to survivors and excludes explicit transfers, merges and
  both sides of confirmed historical transfers before run selection, sampling,
  training, actuals and AI inputs. Analytics uses the same exclusions. Unreviewed and
  unrelated legacy/lifecycle behavior stays unchanged; audit names/IDs remain original.
- History queries are CNE-season-scoped. Event filters depend on stored fields; missing
  legacy events do not automatically match. Check both sort directions and indexes
  when extending filters. Preserve device/server timestamp and `syncedAt` semantics.

## Coding and scope conventions

- Tabs, single quotes, no trailing commas, 100-character print width (`.prettierrc`).
- Exported functions in `src/lib/` need JSDoc parameters/returns. Import shared types
  from `src/types.js` through JSDoc typedefs.
- Put new Firestore access in `src/lib/`; pages/components must not call it directly.
  Existing auth/group infrastructure has exceptions; do not expand them casually.
- Preserve auth/group initialization, route guards, subscription cleanup, and group
  isolation. Client-side membership caches are hints, not authorization.
- Use notificationStore or existing sweetalert2/dialog patterns, never `alert()`.
- Stay in the stack; avoid unrelated rewrites or new frameworks. Targeted improvements
  to `Navbar.svelte` and `ThreeScene.svelte` are allowed when relevant to the request.
- Never commit `.env` or hardcode Firebase/OpenRouter keys. Never add `Co-Authored-By`
  trailers or other AI attribution to commit messages.
- Do not put mockups/scratch files in `static/`, which is publicly served.
- Update this document when an implemented change alters these contracts.

## Design and previews

Previews are opt-in: enter the preview-selection workflow only when the user explicitly
asks, including by writing `/make_a_preview` in their message. This is a conversational
trigger, not a claim that an installed slash command exists. Ordinary UI change requests
do not require a preview or selection round.

When requested, use the design-preview skill to show **5 options** by default, with
light/dark side by side on the app's real surfaces. Number the options and wait for the
user's choice before implementing the previewed design. Follow an explicitly requested
different count. This policy replaces the skill's older default of 10 options and
automatic previews for every visual change.

All UI work must support light/dark and desktop/mobile. Use theme variables or
theme-scoped definitions for backgrounds, text, borders, shadows, focus/hover/active/
disabled states, placeholders, autofill, scrollbars, SVGs, and charts. No cross-theme
leaks or browser defaults that conflict with the theme. Palette values belong in the
theme system, not hardcoded into components.

The landing page currently uses full-viewport panels and a fixed section-navigation
dot rail, with the shared Three.js backdrop also used on login. Preserve keyboard
navigation and reduced-motion support when changing these features. Looping motion
currently stops only for reduced-motion preferences; no pause control is a known
accessibility gap, not a requirement to preserve.

Before changing the section pager or landing-page integration, explicitly read
`.claude/rules/section-pager.md`; do not assume every agent auto-loads it. Scroll direction
must match the current gesture, and trackpad inertia must not trigger extra page turns.
Keep direction logic in `src/lib/sectionPager.js`. Verify historical design documents
against current code; `HOMEPAGE_REDESIGN_PROMPT.md` describes an older design.

## Verification and delivery

**Commit, push, and deploy only when the user explicitly asks for that action.**
A request to implement or fix something does not authorize any of those actions.

Run checks appropriate to the work even when no commit is requested. Add meaningful
tests for new behavior. Documentation-only edits do not need an app build. Report what
was verified and any checks that could not be completed.

- `npm run check` currently runs only `svelte-kit sync`; it is not a type checker or
  proof that components compile. Do not report it as one.
- `npm run test:unit -- --run` runs Vitest once. Target relevant tests while iterating;
  avoid accidentally leaving a watch process running.
- For an authorized commit, pre-commit runs lint-staged (ESLint/Prettier), sync, and
  the unit suite in run mode.
- For an authorized push, pre-push runs only the build. The Chromium integration suite
  is not in the hook because it loads the machine heavily; run `npm run test:integration`
  by hand before a deploy or after changes to page flow, offline behavior, or the stock UI.
  Do not routinely bypass hooks or duplicate successful checks unnecessarily.
- Playwright starts its own fresh production build/preview. Use
  `npm run test:integration` for Chromium; `npm run test:cross-browser` covers Firefox
  and WebKit when warranted. Bare Playwright runs all configured browsers.
- For UI changes, verify light/dark and desktop/mobile, including interactive states.
  Section-pager changes also need wheel/trackpad/touch/keyboard verification plus the
  relevant `sectionPager.test.js` and `home-scroll.test.js` regressions.

## Offline behavior and runtime gotchas

- Use Windows: node_modules is installed for Windows. Do not install/build from Linux
  against this dependency directory.
- The service worker registers only in production builds. Test PWA/offline behavior
  with a production build and preview, not dev. Current `tests/offline-pwa.test.js`
  covers the cached app shell, not inventory mutation synchronization.
- Firestore caching supports reads. Stock actions never send speculative absolute
  writes or ledger rows into its automatic offline write queue.
- Replay requires the authenticated app to be open and connected. It is scoped by
  user/group and ordered per item; conflicts pause dependent actions. Sign-out retains
  work. Retry reuses the ID; cancellation checks the server receipt and cannot undo
  an already-applied action. A refreshed confirmation creates a new ID in the original
  queue position; later absolute actions retain their own conflict checks.
- Old installations may still have cached absolute writes. Synchronize and retire
  those clients before deployment/migration; never discard work by clearing persistence.
- Emulator tests use `firebase.stock-tests.json`, project `demo-stocksense`, Auth on
  localhost:9099 and Firestore on localhost:8088. Set `STOCK_EMULATOR_TESTS=1` and run
  Playwright with `playwright.stock.config.js`. Fixtures never use production credentials.

## Svelte skills and tools

For Svelte component/module work, load `svelte-code-writer` and
`svelte-core-bestpractices` and use the Svelte MCP documentation/autofixer workflow.
Use runes for new component state while preserving existing store contracts when
unrelated to the task. Do not migrate working stores merely for stylistic consistency.

### Svelte MCP server usage

When working on Svelte or SvelteKit topics, use the Svelte MCP server's tools:

1. **list-sections** — call this FIRST to discover all available documentation
   sections (titles, use_cases, paths). Always start here for Svelte/SvelteKit tasks.
2. **get-documentation** — after reviewing the `list-sections` results (especially
   `use_cases`), fetch full documentation for every section relevant to the task.
   Accepts single or multiple sections.
3. **svelte-autofixer** — run on any Svelte code you write before delivering it.
   Keep calling it until it returns no issues or suggestions.
4. **playground-link** — only call after the user confirms they want one, and never
   when the code has already been written to files in the project.
