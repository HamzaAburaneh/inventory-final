# StockSense page-loading audit — October 4, 2026

The strongest evidence points to avoidable application work, not a need to replace Firestore. History really does load the selected season before displaying its first page. Predictions also starts duplicate forecast requests, several pages restart the shared inventory subscription, and Analytics has unnecessary sequential and duplicate reads.

This is a source and production-build audit of all page-loading paths. It is not a measurement of the deployed app, live database, browser cache, network, or device. Recommendations are ranked by likely payoff and implementation risk; no speedup in seconds is claimed. No app behavior, production data, permissions, or deployment was changed.

## Status (October 4, 2026)

**Deferred: Predictions/forecast and Transaction Analysis.** Those routes are likely to be reworked later, so improving how they load now isn't worth the effort. This parks finding 1 (duplicate forecast), finding 4 (Analytics reads) and finding 5 (forecast loading, including Orders reusing the forecast), plus the stale-request and chart-cleanup issues in those routes. Revisit them as part of the rework, not before.

**Done in the first round:**

- Finding 2, in part: `itemStore.loadItems()` reuses the running listener for the same account and group instead of clearing the list and restarting it. A failed listener is forgotten, so the next page starts a fresh one. Exposing first-snapshot readiness and errors to pages is still open.
- Finding 3, first steps: History keeps its review listener across season and filter changes, and reverses the loaded season for oldest-first instead of querying again.

The temporary `[history timing]` console log has been removed from `createSeasonHistoryFeed`; re-add it if History's load needs measuring again.

## Checking the other agent's claims

| Claim                                                                           | Verdict                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| History loads the full season to display 10 rows                                | Confirmed for the default All view. The database query has no limit; pagination happens in memory. Saved page-size preferences can override 10. Ordinary event/type filters narrow the query; the Transfers view still queries the whole season. |
| The 2025 season has about 2,250 records                                         | Not independently verified. A source comment says the largest season has about 2,250 rows; it does not prove the current live count or its year.                                                                                                 |
| Rows wait for transactions and transfer reviews                                 | Confirmed. The two listeners start concurrently, and neither emits display data until both have supplied snapshots.                                                                                                                              |
| All items are loaded for merged-item naming                                     | Confirmed, through a live catalog subscription. Items also supply aliases and transfer-location information. Item readiness does not block the transaction callback.                                                                             |
| Changing filter, sort, or season downloads everything again                     | It recreates both ledger and review subscriptions. Search and pagination do not. A fresh full network download or full billed reread on every reattachment is not established: cache/listener behavior matters.                                  |
| Offline caching makes it slow                                                   | Possible on a particular device, but unproven here. Persistence also accelerates repeat reads and supports offline access. Do not disable it based on this audit.                                                                                |
| Firestore can return 20 records almost instantly; any database is slow at 2,250 | Too absolute. A smaller query reduces work, but actual latency depends on network, cache, region, startup, and rendering. Thousands of records are not inherently beyond a database's capability.                                                |
| Switching databases would not fix it                                            | These application issues would remain unless redesigned. There is no evidence here to justify migration, but production database/network latency has not been ruled out.                                                                         |
| Use count/sum queries for all totals                                            | Potentially useful, but not a drop-in replacement for the current paired transfers, review exclusions, substring search, and per-day totals. Aggregations also lack offline and realtime-listener support.                                       |

Evidence: [History page](C:/dev/inventory-final/src/routes/transactionHistory/+page.svelte:24), [transaction subscription](C:/dev/inventory-final/src/lib/transactions.js:105), [review subscription](C:/dev/inventory-final/src/lib/stockReviews.js:12), [filter semantics](C:/dev/inventory-final/src/lib/transactionHistory.js:102). Firebase documents [listener billing](https://firebase.google.com/docs/firestore/pricing), [offline persistence](https://firebase.google.com/docs/firestore/manage-data/enable-offline), and [aggregation limitations](https://firebase.google.com/docs/firestore/query-data/aggregation-queries).

## Findings and recommended changes

### 1. Predictions requests the same forecast twice — high priority

The route fetches the default 14-day deterministic forecast for its overview. Its StockPredictions child independently fetches that same forecast on initial mount, after a 300 ms debounce. Each invocation obtains a token, reads 400 days of transactions, all current items, and all history reviews, uploads the data, and runs server verification and forecasting. The code has no shared in-flight request or result cache for these calls. SDK caching may reduce database traffic, but there are still two application requests and two API calls/calculations.

Give the page one forecast owner and feed both views from its result. Coalesce identical in-flight requests. Then consider reuse between Predictions and Orders, with keys and invalidation covering user, group, forecast day/window, method, item state, history, and reviews. Preserve the deterministic fallback and existing history exclusions.

Evidence: [overview request and lifecycle](C:/dev/inventory-final/src/routes/inventoryPredictions/+page.svelte:44), [child request/effect](C:/dev/inventory-final/src/components/StockPredictions.svelte:22), [forecast client](C:/dev/inventory-final/src/lib/predictionsClient.js:29).

### 2. The shared inventory listener discards useful loaded data — high priority

Every itemStore.loadItems()/fetchItems() call stops the previous listener, clears the store, and starts another full-catalog listener. Manage Items, Manage Transactions, History, Predictions, Orders, and Vendor Balances invoke it. Predictions invokes it from both parent and child. This creates unnecessary empty states and subscription churn during navigation.

Make acquiring the same user's same-group listener idempotent. Retain confirmed items during same-scope navigation, expose actual first-snapshot readiness and errors, and define listener ownership/cleanup explicitly. Clear data immediately on an actual account/group change and reject late callbacks from the old scope.

The current async loadItems function does not await a snapshot. Awaiting it in the stock pages does not mean inventory is loaded, and subscription errors are only logged. This can make the page appear empty or broken while data is still arriving. Also replace the per-item previous.find lookup with an ID-indexed Map; it currently performs quadratic work on each full snapshot, though that is likely secondary at a small catalog size.

Evidence: [item store](C:/dev/inventory-final/src/stores/itemStore.js:33), [snapshot/error handling](C:/dev/inventory-final/src/lib/items.js:130), [Manage Items readiness](C:/dev/inventory-final/src/routes/manageItems/+page.svelte:129), [Manage Transactions readiness](C:/dev/inventory-final/src/routes/manageTransactions/+page.svelte:92).

### 3. History couples first-page display to complete reporting data — high priority, staged fix

The initial query returns every matching raw record in the selected August 15–September 15 season. The page then annotates reviews, combines confirmed transfer pairs, searches, totals, counts days, and slices the visible page. Rendering 10 rows limits DOM work, not download or whole-season processing.

Start with the smaller improvements: reuse the group's review listener independently of sort/type changes; sort the already-complete matching result locally; retain usable data during refresh. If loading All first, other filters can optionally reuse that complete superset, but must preserve stored-event matching and review semantics. Do not always force a broader All query when a narrower filter would otherwise suffice.

For faster cold loads, separate a bounded first-page query from complete summary/search/export work. Firestore supports [cursor pagination](https://firebase.google.com/docs/firestore/query-data/query-cursors). This needs a deliberate design: two raw documents can form one displayed transfer, partners can straddle page boundaries, and later review decisions can change classification. A bounded page must not pretend its totals are season totals. Showing unreviewed rows as ordinary movements while reviews are pending would also mislead users.

Full-season background loading improves first display but does not by itself reduce total reads. To reduce reads substantially, use cursor pages plus suitable complete summaries, and fetch full detail only when a feature needs it. Preserve whole-season substring search, exports, day counts, and pagination expectations or explicitly redesign them. Prefer rebuildable reporting data over rewriting immutable ledger records.

Evidence: [page derivations/pagination](C:/dev/inventory-final/src/routes/transactionHistory/+page.svelte:87), [query and review gate](C:/dev/inventory-final/src/lib/transactions.js:105), [pair combination](C:/dev/inventory-final/src/lib/transactionHistory.js:138).

### 4. Analytics adds an avoidable read stage and reads items twice — high priority

Analytics already fetches the transaction window only once for its four reports. However, it waits for that query before starting review and item reads. Separately, its initial total-item count downloads the catalog again. There is no need for these independent reads to be sequential or for counting to use a second catalog snapshot.

Capture the group once, start transactions/items/reviews together, and derive item count from the same catalog used to resolve aliases. That also removes the existing count cache, which is not keyed by group and can become stale after item creation/deletion. Keep review failures visible; never interpret them as no exclusions.

Repeated range selections refetch data. Add latest-request protection so an older response cannot overwrite a newer range, and consider scoped range reuse with explicit refresh/invalidation. Existing performance logging times the combined load, not individual queries or the final painted charts.

Evidence: [sequential reads](C:/dev/inventory-final/src/lib/transactionAnalysis.js:40), [count cache](C:/dev/inventory-final/src/lib/transactionAnalysis.js:67), [shared report calculation](C:/dev/inventory-final/src/lib/transactionAnalysis.js:387), [page loader](C:/dev/inventory-final/src/routes/transactionAnalysis/+page.svelte:143).

### 5. Forecast loading has further sequential work and lifecycle issues — medium priority

The forecast path obtains a token before starting data reads; history reviews start only after transaction data arrives. The server then makes a remote Identity Toolkit token-verification request before computing results. Orders waits for the forecast's date before subscribing to its draft. Some stages are independent, while the draft-date dependency is meaningful: before the fair, it may refer to opening day rather than today.

Parallelize independent scoped reads first. Profile token verification and calculation separately before redesigning server authentication. Do not remove verification. Reuse complete confirmed item data when its freshness contract allows it. With AI enabled, show the deterministic result while enrichment runs if the product flow supports that; the AI request timeout is currently 45 seconds per batch, not a guaranteed total page-load bound.

The child forecast component cancels its debounce timer but not requests already running. A slow earlier response can replace a newer selection. Add request-generation/disposal checks and cancellation where supported, including a user/group check before applying the final response. Ignoring stale results is required even when a request cannot be cancelled.

The overview chart's cleanup is returned from async onMount, so it is not registered as Svelte cleanup. Use synchronous lifecycle cleanup and guard against chart creation after unmount. See [Svelte lifecycle documentation](https://svelte.dev/docs/svelte/lifecycle-hooks).

Evidence: [client read order](C:/dev/inventory-final/src/lib/predictionsClient.js:35), [reviews after transactions](C:/dev/inventory-final/src/lib/transactions.js:69), [API verification](C:/dev/inventory-final/src/routes/api/stockPredictions/+server.js:19), [AI timeout](C:/dev/inventory-final/src/lib/aiStockPrediction.js:44), [Orders draft key](C:/dev/inventory-final/src/routes/orders/+page.svelte:163), [chart cleanup](C:/dev/inventory-final/src/routes/inventoryPredictions/+page.svelte:53).

### 6. Navigation includes a deliberate delay — medium priority for perceived speed

Client route changes wait for a 160 ms outgoing fade, with a 220 ms fallback timer, before committing navigation; the incoming route then fades in over 360 ms. The incoming fade is not another blocking network wait, and these durations are not measured total load times. Reduced-motion users skip these fades.

Allow route/data work to proceed without waiting for the outgoing visual transition, or shorten the transition while preserving smooth motion. This can improve every navigation even when data is cached.

Cold protected loads also wait for Firebase authentication. Without a cached membership hint, profile then membership reads precede page mount. A same-user cached group already permits immediate mounting with background revalidation; this optimization should be retained. Never treat the display hint as authorization.

Evidence: [route gate and transition](C:/dev/inventory-final/src/routes/+layout.svelte:62), [group cache](C:/dev/inventory-final/src/stores/groupStore.js:93).

### 7. Profile starts duplicate component reads — medium priority, small change

GroupManager and BoothManager each call load from both onMount and an initial effect. GroupManager additionally fetches group then members sequentially even though both need only group ID.

Use one scope-keyed loading path, parallelize group/member reads, and discard stale results after scope changes. These collections are probably small, so this is less important than forecast/history work, but it is straightforward to eliminate.

Evidence: [GroupManager](C:/dev/inventory-final/src/components/GroupManager.svelte:32), [BoothManager](C:/dev/inventory-final/src/components/BoothManager.svelte:27).

### 8. Vendor Balances has a growth limit — lower current priority

The initial listener loads all loans, including settled loans that are permanently retained. Filtering and summaries happen locally, and every matching card is rendered. Audit entries are correctly fetched only when a loan's history is opened, but each fetch retrieves its entire history.

Measure actual loan counts first. Coalesce repeated history requests and bound rendering/cache growth. At larger scale, paginate settled loans and long audit trails with complete totals maintained separately. Preserve repayment/review semantics and leave atomic stock-affecting vendor transactions intact.

Evidence: [loan query](C:/dev/inventory-final/src/lib/vendorLoans.js:49), [history query](C:/dev/inventory-final/src/lib/vendorLoans.js:64), [page loading/history cache](C:/dev/inventory-final/src/routes/vendorBalances/+page.svelte:78).

## Production bundle findings

A fresh Windows production build succeeded. The largest emitted JavaScript chunks were:

| Chunk                 | Minified size | Estimated gzip size |
| --------------------- | ------------: | ------------------: |
| ThreeScene / Three.js |        507 kB |              127 kB |
| Firebase              |        436 kB |              129 kB |
| Chart.js              |        202 kB |               69 kB |

Following static imports in the build manifest, including shared layout/runtime, gives these approximate cold-route JavaScript totals:

| Route        | Minified size | Estimated gzip size |
| ------------ | ------------: | ------------------: |
| History      |        615 kB |              199 kB |
| Analytics    |        800 kB |              259 kB |
| Predictions  |        806 kB |              263 kB |
| Manage Items |        653 kB |              211 kB |
| Orders       |        623 kB |              201 kB |
| Landing page |      1,118 kB |              319 kB |
| Login        |      1,088 kB |              312 kB |

These are sums of local files and individually gzip-compressed files, not observed network transfer sizes or load times. They exclude HTML, CSS, external fonts, API data, and service-worker background downloads. Warm navigation can reuse shared assets.

Three.js is a static dependency of home/login, not History's static import graph. Defer the decorative scene until essential page content is usable. It already caps frame rate/pixel ratio and honors reduced motion; do not confuse its presence on home/login with a direct History rendering bottleneck. Charts can also be loaded after essential page content, and only required Chart.js registrations need be included.

The service worker precaches all build/static assets, so visiting any route on a new installation/update can cause background downloads of other routes' assets, including Three.js. That supports offline operation; it is a potential bandwidth competitor, not a measured cause here. Profile installation/update separately and preserve required offline routes if changing the precache policy.

Two external icon stylesheets are loaded globally. Their loading is already nonblocking, but they add requests/fonts and are not in the same-origin service-worker cache. Consolidating used icons into a local subset or SVG system is a secondary improvement. Static image assets are tiny; image compression is not a leading opportunity.

Evidence: [ThreeScene](C:/dev/inventory-final/src/components/ThreeScene.svelte:2), [global icon assets](C:/dev/inventory-final/src/app.html:41), [precache policy](C:/dev/inventory-final/src/service-worker.js:16). SvelteKit already provides route splitting and link preloading; the app enables hover preloading in [app.html](C:/dev/inventory-final/src/app.html:68). That does not start the Firestore calls currently inside component mount/effect hooks. See [SvelteKit performance guidance](https://svelte.dev/docs/kit/performance).

## Measurement plan and delivery order

1. Add temporary timing spans alongside the first improvements: navigation/cold start, auth ready, group ready, first catalog snapshot, first ledger snapshot, reviews ready, first visible rows, complete summaries, API upload/response, token verification, and model computation. Record row counts and cache metadata without logging inventory payloads or credentials.
2. Fix duplicate forecast ownership, item-listener restarts/readiness, Analytics read ordering/catalog duplication, and stale-request/lifecycle handling. Remove Profile double loads. These are concrete improvements independent of which database is used.
3. Measure History cold load, warm return, sort, filter, search, and refresh. Then implement its staged loading/pagination design if the full-season cost remains material. Keep complete-result semantics explicit.
4. Tune route transitions, deferred scene/charts, and precaching based on traces. Consider derived reporting summaries only after simpler changes are measured.

Compare the same account/group/season and device across fresh and warm sessions, normal and throttled connections, and first install versus existing service worker. Collect at least 5–10 samples per scenario; compare medians and slow cases. Use browser traces to separate transfer, JavaScript, IndexedDB, and paint time. Inspect live Firestore read metrics and database region, hosting time-to-first-byte, compression/cache headers, and prediction-server placement/cold starts before assigning infrastructure blame. Database distance can affect latency; see [Firestore best practices](https://firebase.google.com/docs/firestore/best-practices).

Use isolated test browser profiles for cold-cache experiments. Do not clear an operator's persistence or pending stock actions. Any future cache must be scoped to authenticated user/group, invalidated correctly, and must not weaken stock, ledger, receipt, or review guarantees. A reporting summary must handle review changes and aliases without silently reclassifying old audit rows.

Verification completed: production build; 70 passing tests across transactions, transaction history, transaction analysis, item store, and group store; targeted Svelte MCP review. These tests verify existing behavior, not speed. No browser timing, Lighthouse score, production read count, deployment headers/region, or live record count was measured. No dev/preview server or integration browser suite was started for this read-only audit. Onboarding has no large startup collection query; no separate high-impact loading issue was found there.
