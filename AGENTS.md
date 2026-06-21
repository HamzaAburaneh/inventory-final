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

When proposing a visual/design change (colors, badges, icons, button/pill styles, layout treatments, etc.), do NOT just apply one choice — preview options first:

- Render them with the inline preview/visualization widget tool (`show_widget`), never as a static description, so the change can actually be seen before it's built.
- Always show **10 options** unless the user asks for a different count.
- Show **light and dark mode side by side** for every option (the app themes via `[data-theme]`; both must be judged), and use the app's real surfaces (`#ffffff`-ish light, `#121212`-ish dark) so the preview matches production.
- Number/label each option so the user can pick by number or mix-and-match (e.g. "freezer icon from 3, color from 7").
- Only after the user picks do you implement it in the codebase — then keep theme-dependent colors in CSS variables / `[data-theme]` rules, not hardcoded inline styles, so both themes stay correct.

## Goals

1. **Correctness of inventory data** — every count change must produce a matching Transaction record (previousCount/newCount consistent).
2. **Polished, responsive UI** — mobile-first; see `MOBILE_RESPONSIVENESS_ANALYSIS.md`. Landing page is a centered, full-viewport-panel design (Japandi-influenced: light type weights, generous space, theme-variable colors only) with a fixed side dot-rail for section navigation; `ThreeScene.svelte` renders an abstract "breathing terrain + horizon sun" background shared with /login. (`HOMEPAGE_REDESIGN_PROMPT.md` describes the previous editorial design and is historical.)
3. **Reliable predictions** — ARIMA fallback must keep working when the AI layer or OpenRouter is unavailable.
4. **Stay in stack** — no new frameworks, no TypeScript migration, no rewrites of working components (especially `ThreeScene.svelte`, `Navbar.svelte`).
5. **Scroll direction always matches user intent** — on the landing page's section pager (`src/routes/+page.svelte`), a wheel/trackpad gesture moves exactly one section in the gesture's direction; scrolling up must never move the page down (and vice versa), and trailing trackpad inertia must never re-trigger a page turn. The direction/inertia rules are pure functions in `src/lib/sectionPager.js`, guarded by `src/lib/sectionPager.test.js` (unit) and `tests/home-scroll.test.js` (Playwright). Rules for any change: derive direction from the sign of the current gesture (never from a signed accumulator that can mix opposite-direction deltas), re-arm gesture state on direction flips, and pick targets as "next snap point strictly above/below the current scroll position" — keep this logic in `sectionPager.js`, not inline in the page.

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
