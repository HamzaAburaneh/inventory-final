# StockSense — End-to-End Test Report

_Last run: 2026-06-18 · Method: real-browser automation (Playwright/Chromium) driving the
production build (`npm run build && npm run preview`, port 4173) against the live Firebase
project, plus full static verification and source review._

This document is the running log of what was tested, what passed, and every bug found (with
repro, expected vs. actual, and severity). Driver scripts used for the run live in `.driver/`
(scratch, not committed).

## How testing was done

- **Static gates:** `npm run lint`, `npm run check`, `npm run test:unit` (28 tests),
  `npm run build`, `npm run test:integration` (Playwright `tests/home-scroll.test.js`).
- **Real browser:** logged in with the documented test account (`test@example.com`), drove
  every route end-to-end — real clicks, typing, search, sort, edit/delete, theme toggle,
  resize, keyboard, hover, mobile tap. Captured **all** console errors/warnings and page
  errors per route/viewport/theme, and checked for horizontal overflow.
- **Unhappy paths:** empty/invalid login, invalid credentials, duplicate item, rapid
  add-then-add, logged-out access to protected URLs.
- **Side-effect hygiene:** all data created during testing (test items + their transaction
  records) was deleted afterward; the live DB was left clean (verified: 0 `ZZTEST*` items,
  0 `ZZTEST*` transactions).

## Status summary

| #   | Severity | Area                | Finding                                                                  | Status               |
| --- | -------- | ------------------- | ------------------------------------------------------------------------ | -------------------- |
| 1   | **High** | manageItems         | Adding an item crashed the table with `each_key_duplicate`               | **Fixed & verified** |
| 2   | Low      | transactionAnalysis | "Stock Out" rendered `-0` when nothing was removed                       | **Fixed**            |
| 3   | **High** | Auth / routing      | No client-side guard: logged-out users can open protected routes         | **Fixed & verified** |
| 4   | Low      | ThreeScene          | `THREE.Clock` deprecation warning in console on `/` and `/login`         | **Fixed & verified** |
| 5   | Low      | Navbar (a11y)       | Build warns `a11y_no_static_element_interactions` (dropdown hover divs)  | **Fixed**            |
| 6   | Low      | Navbar (UX)         | On desktop, hovering opens the avatar menu, then a click toggles it shut | **Fixed & verified** |
| 7   | Low      | Data/docs           | `storageType` stored capitalized vs. lowercase in `types.js`/AGENTS      | **Fixed (docs)**     |
| 8   | Info     | themes.js           | `blue`/`green` themes + `--color-*` vars are dead code                   | **Fixed (removed)**  |
| 9   | Info/Sec | Login UI            | Test credentials printed in the production login page                    | **Fixed (removed)**  |

---

## Detailed findings

### 1. [HIGH — FIXED] Adding an item crashes the Items table (`each_key_duplicate`)

- **Where:** `/manageItems`, after clicking **Add Item**.
- **Repro:** Log in → Items → fill the form → Add Item. (Reproduced reliably via automation.)
- **Expected:** New row appears once; table keeps working (search/sort/delete).
- **Actual:** A Svelte runtime error `https://svelte.dev/e/each_key_duplicate` was thrown.
  The keyed `{#each paginatedItems as item (item.id)}` momentarily held two rows with the
  same `id`, which **broke table reactivity** — afterward search no longer filtered and the
  row could not be deleted.
- **Root cause:** `itemStore.addItem` did an optimistic `update((items) => [...items, newItem])`
  while the always-on `subscribeToItems` realtime listener (set up in `loadItems`) **also**
  re-emitted the full collection via `set(...)` including the same new doc. The two paths
  race and can leave the same `id` in the array twice.
- **Fix:** Removed the optimistic append in `addItem`
  ([src/stores/itemStore.js](src/stores/itemStore.js)). The realtime subscription is the
  single source of truth and always reflects the new item. The optimistic mutations in
  `updateItem`/`deleteItem` were intentionally **kept** (they don't create duplicates and
  `manageTransactions.changeCount` reads the count back synchronously right after).
- **Re-test:** Add flow re-run on a clean build → `each_key_duplicate` errors: **0**,
  console errors: **0**, post-add search filters to exactly the new row, delete works.

### 2. [LOW — FIXED] "Stock Out" shows `-0`

- **Where:** `/transactionAnalysis` summary cards, when the selected range has no removals.
- **Expected:** `0`. **Actual:** `-0` (hard-coded leading `-`).
- **Fix:** Guard the sign in
  [src/routes/transactionAnalysis/+page.svelte](src/routes/transactionAnalysis/+page.svelte#L489)
  — only prepend `-` when `totalRemoved > 0`.

### 3. [HIGH — FIXED] No client-side auth guard on protected routes

- **Repro (before):** While **logged out** (navbar shows "Login"), navigate directly to
  `/manageItems` (or `/manageTransactions`, `/transactionHistory`, `/transactionAnalysis`,
  `/inventoryPredictions`, `/profile`).
- **Expected:** Redirect to `/login` (or a logged-out placeholder).
- **Actual (before):** The full page rendered (e.g. the "Add New Item" form). `+page.js`
  loaders return `{}` and nothing redirected on missing auth.
- **Why it matters:** During cleanup, the test account was able to **read, write and delete**
  items/transactions directly, which means the Firestore security rules are permissive — so
  the client-side guard is the main thing keeping unauthenticated visitors out of the UI.
- **Fix:** Added a layout-level guard in
  [src/routes/+layout.svelte](src/routes/+layout.svelte). A new `authReady` signal in
  [src/stores/authStore.js](src/stores/authStore.js) flips true after Firebase reports the
  initial auth state; the layout redirects logged-out users on protected routes to `/login`
  and **holds content behind a spinner until `authReady`** so (a) protected data never
  flashes for logged-out users and (b) logged-in users are **not** bounced on hard refresh.
- **Re-test (real browser):** logged out → `/manageItems` and `/transactionHistory` both
  redirect to `/login` with no form flash; `/` still public. Logged in → protected pages
  render, and a **hard refresh on `/manageItems` stays on `/manageItems`** (no flash-logout).
- **Server-side follow-up:** Firestore rules requiring `request.auth != null` are now
  tracked in [firestore.rules](firestore.rules) (with `firebase.json` + `.firebaserc`).
  They still need to be **deployed** by the project owner:
  `firebase login && firebase deploy --only firestore:rules`. Until then the database
  itself remains open even though the client guard blocks the UI.

### 4. [LOW — FIXED] `THREE.Clock` deprecation console warning

- Emitted on `/` and `/login`: `THREE.Clock: This module has been deprecated. Please use
THREE.Timer instead.`
- **Fix:** the animation loop only needed monotonic elapsed seconds, so
  [ThreeScene.svelte](src/components/ThreeScene.svelte) now derives `t` from a
  `performance.now()` baseline instead of `THREE.Clock` — no new dependency and no change to
  the visual behaviour. **Re-test:** `/login` now logs **0** console messages (warning gone).

### 5. [LOW — FIXED] Navbar a11y compiler warnings

- `npm run build` warned `a11y_no_static_element_interactions` at `Navbar.svelte:294` and
  `:314` — `<div>`s carrying `mouseenter`/`mouseleave` need an ARIA role.
- **Fix:** added `role="presentation"` to the two hover-wrapper `<div>`s (they are styling/
  grouping wrappers; the real controls — button, links — keep their own roles). Build is now
  warning-free for these. Keyboard access to the menu is unchanged.

### 6. [LOW — FIXED] Avatar dropdown: hover-open vs click-toggle

- Before: hovering the avatar opened the menu (`mouseenter`), and then **clicking** it ran
  `toggleDropdown`, closing it — so a click could appear to "do nothing".
- **Fix** in [Navbar.svelte](src/components/Navbar.svelte): the avatar button now **opens**
  the menu (idempotent) instead of toggling, so hover-then-click can't close it; added an
  Escape handler that closes the menu and returns focus to the avatar.
- **Re-test:** plain click opens ✓; Escape closes + refocuses the avatar ✓; hover opens ✓;
  sign-out → `/login` ✓ (mouse, keyboard, and mobile burger all still work).

### 7. [LOW — FIXED (docs)] `storageType` casing vs. documented model

- The form/edit dropdowns store `Freezer` / `Refrigerator` / `Dry Storage` (capitalized),
  while `types.js`/AGENTS.md documented `'freezer' | 'refrigerator' | 'dry storage'`.
- The runtime is already correct and casing-robust: `getStorageTypeClass()` / `getStorageTypeIcon()`
  lowercase before matching and `capitalizeWords()` normalizes display, so no data migration is needed.
- **Fix:** updated the canonical typedef in [types.js](src/types.js) and the data-model line
  in AGENTS.md to the actual title-cased values (noting legacy lowercase is tolerated), and
  documented the previously-undocumented `booths` field while there.

### 8. [INFO — FIXED] Dead theme code

- `src/stores/themes.js` defined `blue`/`green` themes and wrote `--color-*` CSS variables,
  but the app themes via the `[data-theme]` attribute + `global.css`, and the toggle only
  switches `light`/`dark` — so those variables and themes were unused.
- **Fix:** trimmed `themes.js` to just `subscribe` + `setTheme` over the two reachable
  themes. The toggle (light↔dark, persisted to `localStorage`) was re-verified in-browser.

### 9. [INFO / SECURITY — FIXED] Test credentials shown in production UI

- The login page printed `Test account: test@example.com / password123`.
- **Fix:** removed the hint line (and its dead CSS) from
  [src/routes/login/+page.svelte](src/routes/login/+page.svelte). Verified the string no
  longer appears on the rendered page.

---

## Passing checks (no issues found)

- **Static gates:** lint ✓, check ✓, unit 28/28 ✓, build ✓, integration 5/5 ✓ (landing
  scroll pager: one section per gesture, reversal, inertia, return-to-top).
- **Landing (`/`):** 5 sections (`intro, features, process, voices, begin`), dot-rail,
  ThreeScene background; correct `<title>`.
- **Login:** empty submit blocked by HTML validation; invalid credentials → "Invalid email
  or password" banner; password show/hide toggle; register/login mode toggle; valid login
  redirects to `/`.
- **manageItems:** add (writes an `add` transaction 0→count); duplicate-name guard
  ("Item with this name already exists."); search filters correctly; edit modal (cost) saves;
  delete shows confirm modal and writes a `remove` transaction. The **count** column has no
  edit affordance — count changes route only through the Ledger.
- **manageTransactions (Ledger):** +/- count changes, per-item reset, "Reset All" — each
  writes a matching transaction; counts animate.
- **transactionHistory:** 5,774 records; search (`baconn` → "Showing 2 of 2"); sortable
  headers; pagination.
- **transactionAnalysis:** 4 charts render; summary cards; CSV export present.
- **inventoryPredictions:** overview cards (Total / Needs Restock / Overstock) + chart render.
- **profile:** name & phone editable, email locked/disabled, save shows success, navbar
  avatar/email stay correct after update; revert works.
- **logout:** verified via hover-menu, keyboard, and mobile burger → all land on `/login`.
- **Data integrity (goal #1):** every count change observed (add / delete / ledger +/- /
  reset) produced a matching Transaction record with consistent previous/new counts.
- **Responsive + theme + console:** 7 routes × {light, dark} × {desktop 1280, tablet 768,
  mobile 390} = **42 page loads** → **0** console errors/warnings (excluding the known
  `THREE.Clock` deprecation) and **0** horizontal overflow.
- **Keyboard:** login tab order email → password → show/hide → submit; avatar menu opens via
  Enter and tabs Profile → Sign out → theme toggle.
