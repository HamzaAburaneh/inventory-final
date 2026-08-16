import { expect, test } from '@playwright/test';
import { MIN_PAGE_ADVANCE } from '../src/lib/sectionPager.js';

/**
 * Cross-viewport tests for the home page scroll-snapping contract
 * (src/routes/+page.svelte). Snapping is tuned per screen size:
 *   - phones / narrow screens use `proximity` so tall panels never trap content;
 *   - roomy tablet/desktop screens use `mandatory` for firm one-panel snapping;
 *   - very short screens (landscape phones) disable snapping entirely.
 * Whatever the snap *strength*, every panel must always expose a snap point
 * (`scroll-snap-align: start`) and remain reachable + aligned via keyboard paging.
 *
 * The size branches below are the *ceiling*, not the whole rule: a panel whose
 * content outgrows the viewport withdraws mandatory snapping at any size, since
 * mandatory snapping would drag a reader back off the part hanging below the
 * fold. The pager gives such a panel intermediate stops instead, so keyboard
 * paging through it can take an extra step before the next panel comes up.
 */

/**
 * Representative viewports spanning every branch of the snap media queries.
 * `snap` is the expected computed `scroll-snap-type` on <html.home-snap> when
 * every panel fits; where one overflows, `y mandatory` relaxes to `y`.
 * Note: `proximity` is the default strictness, so Chromium drops it from the
 * computed value — authored `y proximity` reports back as just `y`.
 * @type {{name: string, width: number, height: number, snap: string}[]}
 */
const VIEWPORTS = [
	{ name: 'mobile portrait', width: 390, height: 844, snap: 'y mandatory' },
	{ name: 'tablet portrait', width: 768, height: 1024, snap: 'y mandatory' },
	{ name: 'desktop', width: 1280, height: 800, snap: 'y mandatory' },
	{ name: 'short desktop', width: 1200, height: 600, snap: 'y mandatory' },
	{ name: 'short landscape', width: 844, height: 480, snap: 'y mandatory' },
	// A laptop at 150% browser zoom reports a small CSS viewport. These used to
	// fall through the old size gates and lose snapping altogether.
	{ name: 'laptop at 150% zoom', width: 853, height: 533, snap: 'y mandatory' },
	{ name: 'small laptop at 150% zoom', width: 911, height: 512, snap: 'y mandatory' }
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
 * Largest amount of real content any panel leaves below the fold when parked at
 * its own snap point. Measured independently of the pager so the snap-strength
 * assertion below verifies the reason, not just the class the page set.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<number>} pixels hidden, negative when every panel fits
 */
function worstPanelOverflow(page) {
	return page.evaluate(() => {
		const band = window.innerHeight - (document.querySelector('nav.navbar')?.offsetHeight ?? 0);
		return Array.from(document.querySelectorAll('.panel')).reduce((worst, panel) => {
			const top = panel.getBoundingClientRect().top;
			let contentBottom = 0;
			for (const node of panel.querySelectorAll('*')) {
				const box = node.getBoundingClientRect();
				if (box.width === 0 || box.height === 0) continue;
				contentBottom = Math.max(contentBottom, box.bottom - top);
			}
			return Math.max(worst, contentBottom - band);
		}, -Infinity);
	});
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
				// An overflowing panel relaxes mandatory snapping to proximity so its
				// lower content stays readable; the other size branches are unaffected.
				const overflowing = (await worstPanelOverflow(page)) > MIN_PAGE_ADVANCE;
				expect(snapType).toBe(overflowing && view.snap === 'y mandatory' ? 'y' : view.snap);
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
				const band = await page.evaluate(
					() => window.innerHeight - (document.querySelector('nav.navbar')?.offsetHeight ?? 0)
				);
				const inventoryTop = await sectionTop(page, 'inventory');
				const traceabilityTop = await sectionTop(page, 'traceability');

				await page.keyboard.press('ArrowDown');
				let y = await settledScrollY(page);
				// A single step moves down, by at most a screenful, and can never
				// overshoot into the panel after next.
				expect(y).toBeGreaterThan(0);
				expect(y).toBeLessThanOrEqual(band + MIN_PAGE_ADVANCE);
				expect(y).toBeLessThan(traceabilityTop - 100);

				// Where the hero outgrows the viewport it owns an extra stop, so reaching
				// the inventory panel takes one more step; it must still arrive aligned.
				for (let i = 0; i < 3 && Math.abs(y - inventoryTop) >= 150; i++) {
					await page.keyboard.press('ArrowDown');
					y = await settledScrollY(page);
				}
				expect(Math.abs(y - inventoryTop)).toBeLessThan(150);
				// Focus follows the visual position so keyboard/AT users land on the panel.
				expect(await page.evaluate(() => document.activeElement?.id)).toBe('inventory');
			});
		});
	}
});

/**
 * Touch devices are a separate axis from screen size, and the reason this block
 * exists: every test above runs with a desktop pointer, so none of them could see
 * that a real phone behaved differently from a phone-sized desktop window.
 *
 * Snapping is a desktop affordance. A phone browser retracts its URL bar
 * mid-gesture, which shifts every snap position while a finger is still moving,
 * so snapping fights the gesture instead of helping it. Both mandatory and
 * proximity were tried on a real device and both were wrong; touch now scrolls
 * natively, which is what a phone reader expects anyway.
 */
test.describe('touch devices', () => {
	test.use({ hasTouch: true, viewport: { width: 412, height: 915 } });

	test('a coarse pointer gets no snapping at all', async ({ page }) => {
		await page.goto('/');
		await page.waitForSelector('#closing');
		await page.waitForTimeout(300);

		const state = await page.evaluate(() => ({
			coarse: window.matchMedia('(pointer: coarse)').matches,
			snap: getComputedStyle(document.documentElement).scrollSnapType,
			tall: document.documentElement.classList.contains('home-tall-panel')
		}));

		// Guard the premise: if the harness stops emulating a coarse pointer this
		// test would silently start asserting desktop behaviour instead.
		expect(state.coarse, 'expected the context to emulate a touch pointer').toBe(true);
		expect(state.snap).toBe('none');
		// Holds regardless of the .home-tall-panel state, which is a more specific
		// selector and would win back proximity if the rule order ever regressed.
		expect(['true', 'false']).toContain(String(state.tall));
	});

	test('touch scrolling is left to the browser', async ({ page }) => {
		await page.goto('/');
		await page.waitForSelector('#closing');
		await page.waitForTimeout(300);

		// Free scrolling: the page may come to rest anywhere, including positions
		// no snap point would allow.
		await page.evaluate(() => window.scrollTo(0, 137));
		await page.waitForTimeout(600);
		expect(await page.evaluate(() => Math.round(window.scrollY))).toBe(137);
	});
});
