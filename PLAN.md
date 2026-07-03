# PLAN — Offline-first PWA

StockSense is used on phones, on the floor, at an outdoor event (CNE) where signal
drops. This plan makes the app installable and usable in dead zones: it opens without
a network, shows your inventory from a local cache, and lets you keep counting — with
changes syncing automatically when signal returns.

## How it works (plain terms)

| Layer                                                          | What it does                                                                                                                                                       |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **App identity card** (`manifest.webmanifest` + icons)         | Lets the phone install StockSense to the home screen and open it fullscreen like a native app.                                                                     |
| **Pocket copy of the app** (`service-worker.js`)               | First online visit saves the app's screens/code on the device; later visits open instantly, network or not.                                                        |
| **Pocket copy of the data** (Firestore `persistentLocalCache`) | Items and transactions are stored on the device, so all 103 items stay readable offline.                                                                           |
| **Offline counting** (`queueCountChange` in `items.js`)        | Offline +/- changes write the count and its ledger record into a queued batch, apply to the local copy instantly, and sync as one atomic unit when signal returns. |
| **Offline indicator** (option 10 — pending)                    | A pill showing `Offline · N changes queued` so you always know which mode you're in.                                                                               |

## Status

### Done — committed as `feat(pwa): offline-first app`

- [x] Web app manifest + generated 192/512 icons (yellow stacked-layers logo on dark).
- [x] `apple-touch-icon` + manifest `<link>` in `app.html`.
- [x] SvelteKit service worker: precache build, network-first pages with cached-shell
      fallback; Firestore/cross-origin traffic never intercepted.
- [x] Firestore `persistentLocalCache` in `firebase.js` (browser only; SSR keeps the
      plain instance).
- [x] Offline write paths in `items.js`: `runTransaction` needs a connection, so
      offline `adjustItemCount`/`setItemCount`/`delete` switch to a queued batch built
      from the device cache. Ledger records stamped with device time when offline.
- [x] Unit tests: 4 offline cases (queued batch, immediate resolve, cache-miss error,
      offline delete) — 61/61 passing.
- [x] Playwright: manifest served + landing page renders with the network killed —
      7/7 passing.
- [x] Gotcha documented in `AGENTS.md` (service worker is production-only).

### Done — offline indicator (option 10), committed as `feat(pwa): offline indicator pill`

- [x] Online/offline state store (`connectivityStore.js`) — a `readable` seeded true
      for SSR, following `navigator.onLine` + the window `online`/`offline` events.
- [x] Queued-write counter (`syncQueue.js`) — `markQueued`/`markSynced` driven by the
      offline path in `items.js` (`commitBatch`): counts up as writes queue, down as
      each commit promise resolves on reconnect.
- [x] `OfflineIndicator.svelte` pill, bottom center: `Offline · N changes queued` with
      a `cloud-off` icon; transitions to `Syncing N changes…` (spinning `refresh`) while
      the queue drains on reconnect; hidden when online and empty. Mounted globally in
      `+layout.svelte`. - Light: `#fef3c7` bg, `#f5c542` border, `#92400e` text. - Dark: `#3a2a0e` bg, `#f5c542` border, `#fcd34d` text — via a `[data-theme='dark']`
      rule, not inline styles.
- [x] Unit tests for the counter transitions (`syncQueue.test.js`) — 66/66 passing.
- [ ] Manual check: light + dark, desktop + mobile (yours to eyeball in the browser).

> Note: the app's brand wordmark is already per-theme (blue in light, gold in dark) via
> the existing accent variables — no change needed. The yellow-in-light logo in the
> design preview was a mockup artifact only.

## Trade-offs (accepted, by design)

- **Last-write-wins offline.** An offline change reads `previousCount` from _this_
  device's cache. If two devices change the same item in a dead zone, the last one to
  sync wins. This is the standard offline trade-off; the online path still uses
  `runTransaction` for a fresh read.
- **Predictions need the network.** `/api/stockPredictions` is intentionally not cached
  for offline use — it requires a live request and a valid auth token.

## How to verify

- **Automated:** `npm run test:unit` (offline write cases) and `npm run test:integration`
  (`tests/offline-pwa.test.js`) — both run in the git hooks.
- **Manual (offline is production-only — `npm run dev` won't register the worker):**
  1. `npm run build && npm run preview`, open on your phone **while online** once.
  2. Add to home screen; confirm the icon and fullscreen launch.
  3. Airplane mode → reopen the app → it still loads and lists items.
  4. Adjust a count offline → the pill shows the queued count.
  5. Turn signal back on → the change appears on another device; the pill clears.
