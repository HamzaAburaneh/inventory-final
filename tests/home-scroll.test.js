import { expect, test } from '@playwright/test';
import { MIN_PAGE_ADVANCE } from '../src/lib/sectionPager.js';

/**
 * Regression tests for the home page section pager (src/routes/+page.svelte).
 * Guards the scroll-direction goal in AGENTS.md: a wheel gesture must always
 * move the page in the gesture's direction, one section per gesture, and
 * trailing trackpad inertia must never re-trigger a page turn. Also guards the
 * coverage goal: paging must never carry the reader past content they have
 * not had a chance to see.
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

/**
 * Feeds a wheel stream from inside the page so the spacing between events is
 * identical on every engine. Real driver input cannot be used for the inertia
 * rule: WebKit's driver cannot dispatch wheel events faster than ~200ms, which
 * exceeds the tracker's gesture gap and would turn one decaying tail into a run
 * of separate deliberate flicks. Actual trackpad inertia arrives at ~60Hz.
 * @param {import('@playwright/test').Page} page
 * @param {number[]} deltas - deltaY values, dispatched in order
 * @param {number} [spacingMs] - delay between events, well inside the gesture gap
 * @returns {Promise<void>}
 */
function wheelStream(page, deltas, spacingMs = 30) {
	return page.evaluate(
		async ([list, spacing]) => {
			for (const deltaY of list) {
				window.dispatchEvent(new WheelEvent('wheel', { deltaY, cancelable: true, bubbles: true }));
				await new Promise((resolve) => setTimeout(resolve, spacing));
			}
		},
		[deltas, spacingMs]
	);
}

test.describe('home page section pager', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await page.waitForSelector('#closing');
		// Let mount-time effects (snap offsets, wheel listener) settle
		await page.waitForTimeout(300);
	});

	test('wheel down from the top moves exactly one section down', async ({ page }) => {
		await page.mouse.wheel(0, 120);
		const y = await settledScrollY(page);
		const inventoryTop = await sectionTop(page, 'inventory');
		const traceabilityTop = await sectionTop(page, 'traceability');
		expect(y).toBeGreaterThan(0);
		// Landed at inventory control (within nav-offset tolerance), not past it
		expect(Math.abs(y - inventoryTop)).toBeLessThan(150);
		expect(y).toBeLessThan(traceabilityTop - 100);
	});

	test('wheel up at the top does not move the page down', async ({ page }) => {
		await page.mouse.wheel(0, -120);
		await page.waitForTimeout(1200);
		expect(await page.evaluate(() => window.scrollY)).toBe(0);
	});

	test('decaying inertia after a page turn does not fire a second page', async ({ page }) => {
		// One deliberate flick followed by its inertia tail (same direction,
		// decaying magnitude, no pause in the stream).
		await wheelStream(page, [120, 80, 60, 40, 25, 15, 8]);
		const y = await settledScrollY(page);
		const traceabilityTop = await sectionTop(page, 'traceability');
		// Still on inventory control; the tail must not have paged on to traceability
		expect(y).toBeLessThan(traceabilityTop - 100);
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

	test('an opposite flick reverses a page turn that is still animating', async ({ page }) => {
		await page.mouse.wheel(0, 120);
		await expect.poll(async () => page.evaluate(() => window.scrollY)).toBeGreaterThan(10);
		const beforeReverse = await page.evaluate(() => window.scrollY);

		await page.mouse.wheel(0, -120);
		const afterReverse = await settledScrollY(page);

		expect(afterReverse).toBeLessThan(beforeReverse);
		expect(afterReverse).toBeLessThan(5);
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

	test('ArrowDown pages one section down and moves focus to it', async ({ page }) => {
		await page.keyboard.press('ArrowDown');
		const y = await settledScrollY(page);
		const inventoryTop = await sectionTop(page, 'inventory');
		const traceabilityTop = await sectionTop(page, 'traceability');
		expect(Math.abs(y - inventoryTop)).toBeLessThan(150);
		expect(y).toBeLessThan(traceabilityTop - 100);
		// Focus management: the jump lands the user on the section itself
		expect(await page.evaluate(() => document.activeElement?.id)).toBe('inventory');
	});

	test('ArrowUp after paging down returns to the top', async ({ page }) => {
		await page.keyboard.press('ArrowDown');
		await settledScrollY(page);
		await page.keyboard.press('ArrowUp');
		expect(await settledScrollY(page)).toBeLessThan(5);
	});

	test('paging down never skips over content', async ({ page }) => {
		// The coverage invariant: consecutive stops must overlap, so no strip of the
		// document can sit between two of them. A panel taller than the viewport has
		// to earn extra stops or its lower content becomes unreachable.
		const band = await page.evaluate(
			() => window.innerHeight - (document.querySelector('nav.navbar')?.offsetHeight ?? 0)
		);
		const positions = [await settledScrollY(page)];
		for (let i = 0; i < 14; i++) {
			await page.waitForTimeout(250); // let the gesture gap re-arm
			await page.mouse.wheel(0, 120);
			const y = await settledScrollY(page);
			if (y === positions[positions.length - 1]) break;
			positions.push(y);
		}
		// Consecutive stops may leave at most a sub-threshold sliver between them —
		// a strip too small to be worth a page turn. Anything more is content the
		// reader was carried past: the predictions panel used to hide 93px this way.
		for (let i = 1; i < positions.length; i++) {
			expect(positions[i] - positions[i - 1]).toBeLessThanOrEqual(band + MIN_PAGE_ADVANCE);
		}
		// ...and the walk really did run to the end, so those gaps cover the whole
		// page. Whatever remains is a tail shorter than a single page turn, which
		// by design never earns a stop of its own.
		const maxScroll = await page.evaluate(
			() => document.scrollingElement.scrollHeight - window.innerHeight
		);
		expect(maxScroll - positions[positions.length - 1]).toBeLessThan(MIN_PAGE_ADVANCE);
	});

	test('space pages down and shift+space pages up', async ({ page }) => {
		await page.keyboard.press('Space');
		const down = await settledScrollY(page);
		const inventoryTop = await sectionTop(page, 'inventory');
		expect(Math.abs(down - inventoryTop)).toBeLessThan(150);

		await page.keyboard.press('Shift+Space');
		expect(await settledScrollY(page)).toBeLessThan(5);
	});

	test('space activates a focused control instead of paging', async ({ page }) => {
		await page.getByRole('button', { name: 'Go to Get started' }).focus();
		await page.keyboard.press('Space');
		const y = await settledScrollY(page);
		const closingTop = await sectionTop(page, 'closing');
		// The button's own activation won: had the pager taken the key we would be
		// one section down at inventory control instead.
		expect(Math.abs(y - closingTop)).toBeLessThan(150);
	});

	test('a rail click interrupts a page turn that is still animating', async ({ page }) => {
		await page.mouse.wheel(0, 120);
		await expect.poll(async () => page.evaluate(() => window.scrollY)).toBeGreaterThan(10);
		await page.getByRole('button', { name: 'Go to Get started' }).click();
		const y = await settledScrollY(page);
		const closingTop = await sectionTop(page, 'closing');
		expect(Math.abs(y - closingTop)).toBeLessThan(150);
	});

	test('vertical gestures are hijacked but horizontal ones are left alone', async ({ page }) => {
		/**
		 * @param {number} deltaX
		 * @param {number} deltaY
		 * @returns {Promise<boolean>} whether the pager called preventDefault
		 */
		const dispatch = (deltaX, deltaY) =>
			page.evaluate(
				([x, y]) =>
					new Promise((resolve) => {
						window.addEventListener('wheel', (event) => resolve(event.defaultPrevented), {
							once: true,
							passive: true
						});
						window.dispatchEvent(
							new WheelEvent('wheel', { deltaX: x, deltaY: y, cancelable: true, bubbles: true })
						);
					}),
				[deltaX, deltaY]
			);

		// A sideways swipe must stay with the browser (back/forward navigation)
		expect(await dispatch(40, 0)).toBe(false);
		expect(await dispatch(120, 12)).toBe(false);
		// A vertical flick is the pager's
		expect(await dispatch(0, 120)).toBe(true);
	});

	test('turning on reduced motion mid-session releases the wheel', async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.waitForTimeout(300);
		const prevented = await page.evaluate(
			() =>
				new Promise((resolve) => {
					window.addEventListener('wheel', (event) => resolve(event.defaultPrevented), {
						once: true,
						passive: true
					});
					window.dispatchEvent(
						new WheelEvent('wheel', { deltaY: 120, cancelable: true, bubbles: true })
					);
				})
		);
		// The pager re-armed without a reload and handed scrolling back to the browser
		expect(prevented).toBe(false);
	});

	test('End jumps to the last section, Home returns to the first', async ({ page }) => {
		await page.keyboard.press('End');
		const y = await settledScrollY(page);
		const closingTop = await sectionTop(page, 'closing');
		expect(Math.abs(y - closingTop)).toBeLessThan(150);
		expect(await page.evaluate(() => document.activeElement?.id)).toBe('closing');

		await page.keyboard.press('Home');
		expect(await settledScrollY(page)).toBeLessThan(5);
		expect(await page.evaluate(() => document.activeElement?.id)).toBe('intro');
	});
});
