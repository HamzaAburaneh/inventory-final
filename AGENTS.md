# StockSense — Agent Context

StockSense is an intelligent inventory management web app: item tracking, transaction history/analysis, and AI-assisted stock predictions.

## Stack

- **SvelteKit 2 + Svelte 5 in runes mode** (`compilerOptions.runes: true`) — use `$state`, `$derived`, `$effect`, `$props`. Do NOT write Svelte 4 syntax (`export let`, `$:` reactive statements) in components.
- **Vite 8**, **Tailwind 4** (via `@tailwindcss/vite` plugin — no `tailwind.config` or PostCSS config; Tailwind is imported with `@import 'tailwindcss'` in `src/styles/global.css`) + vanilla CSS custom properties, **JavaScript with JSDoc types** (no TypeScript — keep it that way, types live in `src/types.js`).
- **Firebase**: Auth + Firestore (`src/firebase.js`, config from `.env` `VITE_FIREBASE_*` vars). Collections: `items`, `transactions`.
- **Predictions**: ARIMA (`src/lib/stockPrediction.js`) + AI-enhanced layer via OpenRouter (`src/lib/aiStockPrediction.js`), served at `src/routes/api/stockPredictions/+server.js`.
- UI extras: Chart.js, Three.js (`ThreeScene.svelte` — treat as stable, don't modify casually), sweetalert2, custom theme store (themes: light/dark/blue/green in `src/stores/themes.js`).

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

- **Item**: `id, name, barcode, count, lowCount, cost, storageType ('' | 'freezer' | 'refrigerator' | 'dry storage')`
- **Transaction**: `id, itemId, itemName, type ('add' | 'remove'), previousCount, newCount, timestamp, user`

## Conventions

- Tabs, single quotes, no trailing commas, 100-char lines (`.prettierrc` enforced).
- Every exported function in `src/lib/` gets a JSDoc block with `@param`/`@returns`; import shared types via `@typedef {import('../types').X}`.
- Firestore access only through `src/lib/` modules — pages/components never call Firestore directly.
- Auth state flows through `src/stores/authStore.js`; preserve its subscription in layout/pages.
- User-facing notifications go through `notificationStore` / sweetalert2, not `alert()`.
- Never commit `.env` or hardcode Firebase/OpenRouter keys.

## Goals

1. **Correctness of inventory data** — every count change must produce a matching Transaction record (previousCount/newCount consistent).
2. **Polished, responsive UI** — mobile-first; see `MOBILE_RESPONSIVENESS_ANALYSIS.md`. Landing page is a centered, full-viewport-panel design (Japandi-influenced: light type weights, generous space, theme-variable colors only) with a fixed side dot-rail for section navigation; `ThreeScene.svelte` renders an abstract "breathing terrain + horizon sun" background shared with /login. (`HOMEPAGE_REDESIGN_PROMPT.md` describes the previous editorial design and is historical.)
3. **Reliable predictions** — ARIMA fallback must keep working when the AI layer or OpenRouter is unavailable.
4. **Stay in stack** — no new frameworks, no TypeScript migration, no rewrites of working components (especially `ThreeScene.svelte`, `Navbar.svelte`).
5. **Scroll direction always matches user intent** — on the landing page's section pager (`src/routes/+page.svelte`), a wheel/trackpad gesture moves exactly one section in the gesture's direction; scrolling up must never move the page down (and vice versa), and trailing trackpad inertia must never re-trigger a page turn. The direction/inertia rules are pure functions in `src/lib/sectionPager.js`, guarded by `src/lib/sectionPager.test.js` (unit) and `tests/home-scroll.test.js` (Playwright). Rules for any change: derive direction from the sign of the current gesture (never from a signed accumulator that can mix opposite-direction deltas), re-arm gesture state on direction flips, and pick targets as "next snap point strictly above/below the current scroll position" — keep this logic in `sectionPager.js`, not inline in the page.

## Verification workflow (run after every change)

1. `npm run lint` — prettier + eslint must pass. Auto-fix formatting with `npm run format`.
2. `npm run check` — svelte-kit sync.
3. `npm run test:unit` — vitest, covers `src/**/*.test.js` (e.g. `stockPrediction.test.js`). Add/extend unit tests for any new logic in `src/lib/`.
4. `npm run build` — must compile cleanly; Svelte 5 runes-mode errors surface here.
5. For UI changes: `npm run dev` and manually verify the affected route in light AND dark themes, desktop and mobile widths.
6. `npm run test:integration` runs Playwright against a preview build (`testDir: tests/`; create tests there for new critical flows).
7. For any change touching landing-page scrolling (`src/routes/+page.svelte` snap CSS, wheel pager, or `src/lib/sectionPager.js`): `npm run test:unit` must pass `src/lib/sectionPager.test.js`, run `npm run test:integration` (covers `tests/home-scroll.test.js`), then manually verify in `npm run dev` — mouse wheel and trackpad: one section per gesture both directions, a quick down-then-up reversal goes up, touch swipe and arrow/PageDown keys still snap to section boundaries, and reduced-motion mode scrolls freely.

A change is done only when steps 1–4 pass and any new behavior has a test.

## Gotchas

- `node_modules` is installed for Windows; don't run installs/builds from a Linux sandbox against it.
- `arima` package has inconsistent exports — `stockPrediction.js` already handles fallbacks; don't simplify that import.
- `src/scripts/` has its own `package.json`; its scripts are run standalone, not part of the app build.

## Svelte MCP server

You are able to use the Svelte MCP server, where you have access to comprehensive Svelte 5 and SvelteKit documentation. Here's how to use the available tools effectively:

### 1. list-sections

Use this FIRST to discover all available documentation sections. Returns a structured list with titles, use_cases, and paths.
When asked about Svelte or SvelteKit topics, ALWAYS use this tool at the start of the chat to find relevant sections.

### 2. get-documentation

Retrieves full documentation content for specific sections. Accepts single or multiple sections.
After calling the list-sections tool, you MUST analyze the returned documentation sections (especially the use_cases field) and then use the get-documentation tool to fetch ALL documentation sections that are relevant for the user's task.

### 3. svelte-autofixer

Analyzes Svelte code and returns issues and suggestions.
You MUST use this tool whenever writing Svelte code before sending it to the user. Keep calling it until no issues or suggestions are returned.

### 4. playground-link

Generates a Svelte Playground link with the provided code.
After completing the code, ask the user if they want a playground link. Only call this tool after user confirmation and NEVER if code was written to files in their project.
