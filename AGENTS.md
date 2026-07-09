# StockSense — Agent Context

StockSense is an intelligent inventory management web app: item tracking, transaction history/analysis, and AI-assisted stock predictions.

## Stack

- **SvelteKit 2 + Svelte 5 in runes mode** (`compilerOptions.runes: true`) — use `$state`, `$derived`, `$effect`, `$props`. Do NOT write Svelte 4 syntax (`export let`, `$:` reactive statements) in components.
- **Vite 8**, **Tailwind 4** (via `@tailwindcss/vite` plugin — no `tailwind.config` or PostCSS config; Tailwind is imported with `@import 'tailwindcss'` in `src/styles/global.css`) + vanilla CSS custom properties, **JavaScript with JSDoc types** (no TypeScript — keep it that way, types live in `src/types.js`).
- **Firebase**: Auth + Firestore (`src/firebase.js`, config from `.env` `VITE_FIREBASE_*` vars). Collections: `items`, `transactions`.
- **Predictions**: ARIMA (`src/lib/stockPrediction.js`) + AI-enhanced layer via OpenRouter (`src/lib/aiStockPrediction.js`), served at `src/routes/api/stockPredictions/+server.js`.
- UI extras: Chart.js, Three.js (`ThreeScene.svelte` — treat as stable, don't modify casually), sweetalert2, custom theme store (only `light`/`dark` are reachable from the UI toggle — `src/stores/themes.js`).

## Structure

```
src/
  components/   Reusable UI (Table, ItemForm, Navbar, StockPredictions, ThreeScene…)
  lib/          Domain logic: items.js, transactions.js, auth.js, stockPrediction.js,
                aiStockPrediction.js, transactionAnalysis.js, tableUtils.js
  routes/       Pages: / (landing), /login, /manageItems, /manageTransactions,
                /transactionHistory, /transactionAnalysis, /inventoryPredictions,
                /profile, /api/stockPredictions
  stores/       Svelte stores: authStore, itemStore, notificationStore,
                paginationStore, searchStore, themes
  scripts/      One-off data import/seed scripts (separate package.json)
  types.js      Canonical JSDoc typedefs (Item, Transaction, DailyAnalysis…)
```

## Data model (source of truth: `src/types.js`)

- **Item**: `id, name, barcode, count, lowCount, cost, storageType ('' | 'Freezer' | 'Refrigerator' | 'Dry Storage'), booths (string[])` — `storageType` is stored title-cased by the forms (legacy lowercase rows still exist; `tableUtils.js` helpers are case-insensitive). `booths` is an optional array of tags.
- **Transaction**: `id, itemId, itemName, type ('add' | 'remove'), previousCount, newCount, timestamp, user`

## Conventions

- Tabs, single quotes, no trailing commas, 100-char lines (`.prettierrc` enforced).
- Every exported function in `src/lib/` gets a JSDoc block with `@param`/`@returns`; import shared types via `@typedef {import('../types').X}`.
- Firestore access only through `src/lib/` modules — pages/components never call Firestore directly.
- Auth state flows through `src/stores/authStore.js`; preserve its subscription in layout/pages.
- User-facing notifications go through `notificationStore` / sweetalert2, not `alert()`.
- Whenever you make a CSS change, make sure it works in BOTH light and dark — use theme CSS variables (or `[data-theme='dark']` overrides) rather than hardcoded colors, and verify the change in both themes. Never ship a color that only looks right in one theme.
- Never commit `.env` or hardcode Firebase/OpenRouter keys.
- Never add `Co-Authored-By` trailers (or any AI-attribution) to commit messages.

## Proposing design changes

See the `design-preview` skill before proposing any visual/design change.

## Goals

1. **Correctness of inventory data** — every count change must produce a matching Transaction record (previousCount/newCount consistent).
2. **Polished, responsive UI** — mobile-first; see `MOBILE_RESPONSIVENESS_ANALYSIS.md`. Landing page is a centered, full-viewport-panel design (Japandi-influenced: light type weights, generous space, theme-variable colors only) with a fixed side dot-rail for section navigation; `ThreeScene.svelte` renders an abstract "breathing terrain + horizon sun" background shared with /login. (`HOMEPAGE_REDESIGN_PROMPT.md` describes the previous editorial design and is historical.)
3. **Reliable predictions** — ARIMA fallback must keep working when the AI layer or OpenRouter is unavailable.
4. **Stay in stack** — no new frameworks, no TypeScript migration, no rewrites of working components (especially `ThreeScene.svelte`, `Navbar.svelte`).
5. **Scroll direction always matches user intent** — see `.claude/rules/section-pager.md` (auto-loads when touching the section pager files).
6. **No cross-theme color leaks, anywhere** — no element, in any state, should ever show a color from the _other_ theme. This is a full-surface rule, not limited to a specific list of controls: it covers backgrounds, text, borders, outlines, box-shadows, focus rings, hover/active states, placeholders, scrollbars, autofill backgrounds, SVG fills/strokes, chart colors, and any browser-default UI that wasn't explicitly restyled. Every color on every element must resolve through a theme CSS variable and be checked in both themes (light/dark) — hardcoded hex/rgb/named colors or unstyled user-agent defaults are bugs. When auditing or touching styling, check base, hover, focus, active, and disabled states, not just the resting state.

## Verification workflow

Git hooks (Husky + lint-staged) run the checklist automatically — you don't run these by hand:

- **`git commit`** (pre-commit) runs lint-staged (`eslint --fix` + `prettier --write` on staged files), then `npm run check`, then `npm run test:unit`. Any failure blocks the commit.
- **`git push`** (pre-push) runs `npm run build`, then `npm run test:integration`. Any failure blocks the push.

Still manual — the developer's responsibility, hooks can't verify these:

- For UI changes: `npm run dev`, check light + dark and desktop + mobile.
- For landing-page scroll changes: a manual wheel/trackpad/touch/keyboard check alongside `sectionPager.test.js` + `home-scroll.test.js`.

New behavior still needs a test (discipline, not enforced by the hooks).

Escape hatch: `git commit --no-verify` / `git push --no-verify` skips the hooks — use sparingly.

## Gotchas

- `node_modules` is installed for Windows; don't run installs/builds from a Linux sandbox against it.
- `arima` package has inconsistent exports — `stockPrediction.js` already handles fallbacks; don't simplify that import.
- `src/scripts/` has its own `package.json`; its scripts are run standalone, not part of the app build.
- **PWA/offline**: the service worker (`src/service-worker.js`) only registers in production builds — test offline behavior via `npm run build && npm run preview` (or `tests/offline-pwa.test.js`), never `npm run dev`. Firestore uses `persistentLocalCache` in the browser (`src/firebase.js`); count changes made offline go through a queued-batch path in `src/lib/items.js` (`queueCountChange`) that reads the device cache — `runTransaction` requires a connection, so never route offline writes through it.

## Svelte MCP server

The Svelte MCP server injects its own usage instructions each session (list-sections,
get-documentation, svelte-autofixer, playground-link) — no need to duplicate them here.
The `svelte-code-writer` and `svelte-core-bestpractices` skills already mandate using it
for any Svelte component/module work.
