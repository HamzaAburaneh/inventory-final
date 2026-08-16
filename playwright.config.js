import { devices } from '@playwright/test';

/**
 * The section pager is full of engine-specific behaviour — Firefox is the only
 * browser that reports wheel deltas in lines (`deltaMode === 1`), and snapping
 * during a programmatic smooth scroll differs across engines — so the suite
 * declares all three. Everyday commands stay on Chromium:
 *   npm run test:integration    Chromium only (this is what the pre-push hook runs)
 *   npm run test:cross-browser  Firefox + WebKit, needs a one-time
 *                               `npx playwright install firefox webkit`
 * A bare `npx playwright test` runs all three and is the slow path — prefer the
 * scripts above, or pass `--project=chromium` explicitly.
 */
const config = {
	webServer: {
		command: 'npm run build && npm run preview',
		port: 4173,
		// Deliberately NOT reusing a running server: a preview server serves the
		// bundle it booted with, so a leftover one silently tests stale code and
		// reports that a just-made change had no effect. The rebuild is the cheap
		// part of a run — browser fan-out is what costs, so prefer
		// `npm run test:integration` (Chromium only) over a bare `playwright test`.
		reuseExistingServer: false,
		timeout: 180000
	},
	testDir: 'tests',
	testMatch: /(.+\.)?(test|spec)\.js/,
	// Browsers are memory-hungry; leave the machine usable during a local run.
	workers: process.env.CI ? undefined : 2,
	projects: [
		{ name: 'chromium', use: { ...devices['Desktop Chrome'] } },
		{ name: 'firefox', use: { ...devices['Desktop Firefox'] } },
		{ name: 'webkit', use: { ...devices['Desktop Safari'] } }
	]
};

export default config;
