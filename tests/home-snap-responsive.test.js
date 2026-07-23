import { expect, test } from '@playwright/test';

/**
 * Cross-viewport tests for the home page scroll-snapping contract
 * (src/routes/+page.svelte). Snapping is tuned per screen size:
 *   - phones / narrow screens use `proximity` so tall panels never trap content;
 *   - roomy tablet/desktop screens use `mandatory` for firm one-panel snapping;
 *   - very short screens (landscape phones) disable snapping entirely.
 * Whatever the snap *strength*, every panel must always expose a snap point
 * (`scroll-snap-align: start`) and remain reachable + aligned via keyboard paging.
 */

/**
 * Representative viewports spanning every branch of the snap media queries.
 * `snap` is the expected computed `scroll-snap-type` on <html.home-snap>.
 * Note: `proximity` is the default strictness, so Chromium drops it from the
 * computed value — authored `y proximity` reports back as just `y`.
 * @type {{name: string, width: number, height: number, snap: string}[]}
 */
const VIEWPORTS = [
	{ name: 'mobile portrait', width: 390, height: 844, snap: 'y' },
	{ name: 'tablet portrait', width: 768, height: 1024, snap: 'y mandatory' },
	{ name: 'desktop', width: 1280, height: 800, snap: 'y mandatory' },
	{ name: 'short desktop (< 620 tall)', width: 1200, height: 600, snap: 'y' },
	{ name: 'short landscape (<= 540 tall)', width: 844, height: 480, snap: 'none' }
];

/**
 * Polls until window.scrollY stops changing, then returns it.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<number>}
 */
async function settledScrollY(page) {
	let prev = -1;
	await expect
		.poll(
			async () => {
				const y = await page.evaluate(() => window.scrollY);
				const stable = y === prev;
				prev = y;
				return stable;
			},
			{ timeout: 8000, intervals: [250] }
		)
		.toBe(true);
	return prev;
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} id
 * @returns {Promise<number>} document-space top of the section
 */
function sectionTop(page, id) {
	return page.evaluate(
		(sectionId) => document.getElementById(sectionId).getBoundingClientRect().top + window.scrollY,
		id
	);
}

test.describe('home page scroll snapping across screen sizes', () => {
	for (const view of VIEWPORTS) {
		test.describe(`${view.name} (${view.width}x${view.height})`, () => {
			test.beforeEach(async ({ page }) => {
				// Set the viewport before navigation so the size-dependent media
				// queries resolve at load, exactly as they would for a real visitor.
				await page.setViewportSize({ width: view.width, height: view.height });
				await page.goto('/');
				await page.waitForSelector('#closing');
				await page.waitForTimeout(300);
			});

			test(`html resolves scroll-snap-type "${view.snap}"`, async ({ page }) => {
				const snapType = await page.evaluate(
					() => getComputedStyle(document.documentElement).scrollSnapType
				);
				expect(snapType).toBe(view.snap);
			});

			test('every panel exposes a snap point (scroll-snap-align: start)', async ({ page }) => {
				const aligns = await page.evaluate(() =>
					Array.from(document.querySelectorAll('.panel')).map(
						(panel) => getComputedStyle(panel).scrollSnapAlign
					)
				);
				// All five panels present, each a snap target regardless of snap strength.
				expect(aligns).toHaveLength(5);
				for (const align of aligns) {
					// Chromium normalizes `start` to `start start`.
					expect(align.split(' ')[0]).toBe('start');
				}
			});

			test('keyboard paging lands aligned on the next section', async ({ page }) => {
				await page.keyboard.press('ArrowDown');
				const y = await settledScrollY(page);
				const inventoryTop = await sectionTop(page, 'inventory');
				const traceabilityTop = await sectionTop(page, 'traceability');
				// Moved down and snapped to the inventory panel (within nav-offset
				// tolerance), never overshooting into the following panel.
				expect(y).toBeGreaterThan(0);
				expect(Math.abs(y - inventoryTop)).toBeLessThan(150);
				expect(y).toBeLessThan(traceabilityTop - 100);
				// Focus follows the visual position so keyboard/AT users land on the panel.
				expect(await page.evaluate(() => document.activeElement?.id)).toBe('inventory');
			});
		});
	}
});
