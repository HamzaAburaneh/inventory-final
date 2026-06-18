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

| #   | Severity | Area               | Finding                                                              | Status               |
| --- | -------- | ------------------ | -------------------------------------------------------------------- | -------------------- |
| 1   | **High** | manageItems        | Adding an item crashed the table with `each_key_duplicate`           | **Fixed & verified** |
| 2   | Low      | transactionAnalysis| "Stock Out" rendered `-0` when nothing was removed                   | **Fixed**            |
| 3   | **High** | Auth / routing     | No client-side guard: logged-out users can open protected routes     | **Open — needs decision** |
| 4   | Low      | ThreeScene         | `THREE.Clock` deprecation warning in console on `/` and `/login`     | Open (cosmetic)      |
| 5   | Low      | Navbar (a11y)      | Build warns `a11y_no_static_element_interactions` (dropdown hover divs)| Open (cosmetic)    |
| 6   | Low      | Navbar (UX)        | On desktop, hovering opens the avatar menu, then a click toggles it shut | Open (minor)     |
| 7   | Low      | Data/docs          | `storageType` stored capitalized vs. lowercase in `types.js`/AGENTS  | Open (doc mismatch)  |
| 8   | Info     | themes.js          | `blue`/`green` themes + `--color-*` vars are dead code               | Open (cleanup)       |
| 9   | Info/Sec | Login UI           | Test credentials printed in the production login page                | Open (by design?)    |

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

### 3. [HIGH — OPEN, needs decision] No client-side auth guard on protected routes

- **Repro:** While **logged out** (navbar shows "Login"), navigate directly to
  `/manageItems` (or `/manageTransactions`, `/transactionHistory`, `/transactionAnalysis`,
  `/inventoryPredictions`, `/profile`).
- **Expected:** Redirect to `/login` (or a logged-out placeholder).
- **Actual:** The full page renders (e.g. the "Add New Item" form). `+page.js` loaders return
  `{}` and no page/layout redirects on missing auth.
- **Why it matters:** During cleanup, the test account was able to **read, write and delete**
  items/transactions directly, which means the Firestore security rules are permissive — so
  the client-side guard may be the main thing keeping unauthenticated visitors out of the UI.
- **Recommended fix (not applied — your call):** a layout-level guard in
  `src/routes/+layout.svelte` that, **after** Firebase auth has initialized (to avoid a
  redirect flash for already-logged-in users on hard refresh), redirects to `/login` when
  `$authStore` is null and the path is protected. Optionally tighten Firestore rules to
  require `request.auth != null`.

### 4. [LOW — OPEN] `THREE.Clock` deprecation console warning

- Emitted on `/` and `/login` (anywhere `ThreeScene.svelte` mounts):
  `THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.`
- Internal to Three.js usage. `ThreeScene.svelte` is flagged "don't modify casually" in
  AGENTS.md, so left as-is. Cosmetic console noise only.

### 5. [LOW — OPEN] Navbar a11y compiler warnings

- `npm run build` warns `a11y_no_static_element_interactions` at
  `Navbar.svelte:294` and `:314` — `<div>`s carrying `mouseenter`/`mouseleave` need an ARIA
  role. Pre-existing; `Navbar.svelte` is flagged as protected. (Keyboard access to the menu
  works regardless — see Passing checks.)

### 6. [LOW — OPEN] Avatar dropdown: hover-open vs click-toggle

- On a hover-capable desktop, moving the pointer onto the avatar opens the menu
  (`mouseenter`), and then **clicking** the avatar runs `toggleDropdown`, which closes it —
  so a deliberate click can appear to "do nothing".
- Not blocking: the menu is fully reachable via **hover**, **keyboard** (focus avatar →
  Enter), and on **mobile** via the burger panel. All three were verified to open the menu
  and complete sign-out → `/login`.

### 7. [LOW — OPEN] `storageType` casing vs. documented model

- The form/edit dropdowns store `Freezer` / `Refrigerator` / `Dry Storage` (capitalized),
  while `types.js`/AGENTS.md document `'freezer' | 'refrigerator' | 'dry storage'`.
  Internally consistent (edit normalizes legacy lowercase rows), but the docs/typedef and
  stored values disagree.

### 8. [INFO — OPEN] Dead theme code

- `src/stores/themes.js` defines `blue`/`green` themes and writes `--color-*` CSS variables,
  but the app themes via the `[data-theme]` attribute + `global.css`, and the toggle only
  switches `light`/`dark`. The `--color-*` variables and the extra themes are unused.

### 9. [INFO / SECURITY — OPEN] Test credentials shown in production UI

- The login page prints `Test account: test@example.com / password123`. Convenient for QA;
  worth removing before any real production deployment.

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
