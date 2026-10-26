# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

All project context, conventions, goals, and the verification workflow live in `AGENTS.md` (imported above). Follow its "Verification and delivery" section after every change.

## Command quick reference

Run these from Windows (see AGENTS.md runtime gotchas). `README.md` is the stock create-svelte
template and adds nothing beyond these.

- `npm run build`: production build (also what pre-push runs).
- `npm run lint`: Prettier check plus ESLint. `npm run format` rewrites with Prettier.
- `npm run test:unit -- --run`: whole Vitest suite once (unit tests sit beside sources as
  `src/**/*.test.js`).
- `npx vitest run src/lib/items.test.js`: one test file; add `-t "name"` for one test.
- `npx playwright test tests/home-scroll.test.js --project=chromium`: one integration file
  (Playwright builds and previews the app itself).
- Emulator suites (`stock-locations-ui`, `stock-queue-emulator`, `vendor-dialogs-ui`): set
  `STOCK_EMULATOR_TESTS=1` and run `npx playwright test --config playwright.stock.config.js`.
