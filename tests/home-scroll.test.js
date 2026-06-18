import { expect, test } from '@playwright/test';

/**
 * Regression tests for the home page section pager (src/routes/+page.svelte).
 * Guards the scroll-direction goal in AGENTS.md: a wheel gesture must always
 * move the page in the gesture's direction, one section per gesture, and
 * trailing trackpad inertia must never re-trigger a page turn.
 */

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

test.describe('home page section pager', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await page.waitForSelector('#voices');
		// Let mount-time effects (snap offsets, wheel listener) settle
		await page.waitForTimeout(300);
	});

	test('wheel down from the top moves exactly one section down', async ({ page }) => {
		await page.mouse.wheel(0, 120);
		const y = await settledScrollY(page);
		const featuresTop = await sectionTop(page, 'features');
		const processTop = await sectionTop(page, 'process');
		expect(y).toBeGreaterThan(0);
		// Landed at features (within nav-offset tolerance), not past it
		expect(Math.abs(y - featuresTop)).toBeLessThan(150);
		expect(y).toBeLessThan(processTop - 100);
	});

	test('wheel up at the top does not move the page down', async ({ page }) => {
		await page.mouse.wheel(0, -120);
		await page.waitForTimeout(1200);
		expect(await page.evaluate(() => window.scrollY)).toBe(0);
	});

	test('decaying inertia after a page turn does not fire a second page', async ({ page }) => {
		// One deliberate flick followed by its inertia tail (same direction,
		// decaying magnitude, no pause in the stream).
		await page.mouse.wheel(0, 120);
		for (const d of [80, 60, 40, 25, 15, 8]) {
			await page.mouse.wheel(0, d);
			await page.waitForTimeout(60);
		}
		const y = await settledScrollY(page);
		const processTop = await sectionTop(page, 'process');
		// Still on features — the tail must not have paged on to process
		expect(y).toBeLessThan(processTop - 100);
	});

	test('scrolling up after scrolling down always moves the page up', async ({ page }) => {
		// Go down two sections
		await page.mouse.wheel(0, 120);
		await settledScrollY(page);
		await page.mouse.wheel(0, 120);
		const before = await settledScrollY(page);
		expect(before).toBeGreaterThan(0);
		// Leftover downward inertia immediately followed by an upward flick:
		// the reversal must win — the page may never end up further down.
		await page.mouse.wheel(0, 30);
		await page.mouse.wheel(0, 10);
		await page.mouse.wheel(0, -120);
		const after = await settledScrollY(page);
		expect(after).toBeLessThan(before);
	});

	test('repeated up gestures return to the very top', async ({ page }) => {
		await page.mouse.wheel(0, 120);
		await settledScrollY(page);
		await page.mouse.wheel(0, 120);
		await settledScrollY(page);
		for (let i = 0; i < 4; i++) {
			await page.mouse.wheel(0, -120);
			await settledScrollY(page);
		}
		expect(await page.evaluate(() => window.scrollY)).toBe(0);
	});
});
