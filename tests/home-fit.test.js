import { expect, test } from '@playwright/test';

/**
 * On a snapping pointer, every landing-page panel must fit the strip of viewport
 * left under the fixed nav, at every screen size, without hiding any of its
 * content. Panels that outgrow that strip are scaled down by the pager's fit pass
 * (`--fit-scale` in src/routes/+page.svelte), so this suite is what stops the page
 * regressing to content sitting below the fold — which it did before, by up to
 * 250px.
 *
 * The matrix spans the sizes that actually bind: small phones, tablet portrait,
 * short laptops and landscape phones. Anything roomier has slack to spare. These
 * all run with a fine (desktop) pointer; touch is covered at the bottom, where
 * fitting is deliberately switched off — see the touch block for why.
 */
const VIEWPORTS = [
	{ name: 'small phone', width: 360, height: 640 },
	{ name: 'iphone', width: 390, height: 844 },
	{ name: 'large phone', width: 414, height: 896 },
	{ name: 'tablet portrait', width: 768, height: 1024 },
	{ name: 'tablet landscape', width: 1024, height: 768 },
	{ name: 'laptop 720', width: 1280, height: 720 },
	{ name: 'laptop 768', width: 1366, height: 768 },
	{ name: 'desktop 1080', width: 1920, height: 1080 },
	{ name: 'short desktop', width: 1200, height: 600 },
	{ name: 'short landscape', width: 844, height: 480 },
	// Browser zoom shrinks the CSS-pixel viewport, so a zoomed desktop lands on
	// sizes no physical screen reports. 960x600 (a 1440x900 laptop at 150%) is the
	// one that caught the stacked hero needing ~950px of height.
	{ name: 'laptop at 150% zoom', width: 853, height: 533 },
	{ name: 'small laptop at 150% zoom', width: 911, height: 512 },
	{ name: 'wide laptop at 150% zoom', width: 960, height: 600 },
	{ name: 'large laptop at 150% zoom', width: 1067, height: 600 }
];

const PANELS = ['intro', 'inventory', 'traceability', 'predictions', 'closing'];

/**
 * Effects layers far larger than anything the reader sees: the blurred halos
 * bleed past the card they sit behind (530px of glow around a 465px card), and
 * the badge's shine sweep is a ~625px wedge clipped to a 26px badge by
 * overflow:hidden. Bounding boxes report their full geometry either way, so they
 * bound nothing and must not be mistaken for content below the fold.
 */
const DECORATIVE =
	'.hero-glow, .glow-ring, .glow-bloom, .badge-shine-mask, .badge-shine-backdrop, .badge-shine-wedge';

/**
 * For each panel: pixels of content sitting below the fold when the pager is
 * parked at that panel's own stop. Negative means the panel fits with slack.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<number[]>}
 */
function hiddenPerPanel(page) {
	return page.evaluate(
		([ids, decorative]) => {
			const nav = document.querySelector('nav.navbar')?.offsetHeight ?? 0;
			return ids.map((id) => {
				const el = document.getElementById(id);
				const top = el.getBoundingClientRect().top + window.scrollY;
				// Where the pager parks for this panel, and the fold at that position
				const base = id === ids[0] ? 0 : top - nav;
				const fold = base + window.innerHeight;
				let contentBottom = 0;
				for (const node of el.querySelectorAll('*')) {
					const box = node.getBoundingClientRect();
					// Zero-area boxes are hidden or collapsed and bound nothing
					if (box.width === 0 || box.height === 0) continue;
					if (node.closest(decorative)) continue;
					contentBottom = Math.max(contentBottom, box.bottom + window.scrollY);
				}
				return Math.round(contentBottom - fold);
			});
		},
		[PANELS, DECORATIVE]
	);
}

test.describe('landing page content fits the viewport', () => {
	for (const view of VIEWPORTS) {
		test(`${view.name} (${view.width}x${view.height})`, async ({ page }) => {
			await page.setViewportSize({ width: view.width, height: view.height });
			await page.goto('/');
			await page.waitForSelector('#closing');
			// Let the mount-time fit pass measure and settle
			await page.waitForTimeout(500);

			const hidden = await hiddenPerPanel(page);
			for (const [index, overflow] of hidden.entries()) {
				// 2px of tolerance for sub-pixel rounding on fractional scales
				expect(overflow, `${PANELS[index]} has ${overflow}px below the fold`).toBeLessThanOrEqual(
					2
				);
			}
		});
	}

	test('panels with room to spare are left at natural size', async ({ page }) => {
		// The fit pass must be inert wherever it is not needed — a page that is
		// quietly scaled down on a roomy desktop would be a regression too.
		await page.setViewportSize({ width: 1920, height: 1080 });
		await page.goto('/');
		await page.waitForSelector('#closing');
		await page.waitForTimeout(500);

		const scales = await page.evaluate(
			(ids) =>
				ids.map((id) => {
					const wrapper = document
						.getElementById(id)
						.querySelector(':scope > .hero-layout, :scope > .scroll-reveal');
					return wrapper ? Number(getComputedStyle(wrapper).zoom) : 1;
				}),
			PANELS
		);

		for (const scale of scales) {
			expect(scale).toBe(1);
		}
	});
});

/**
 * Touch is the exception: fitting a panel to the viewport earns its keep by
 * landing the reader cleanly on a snap point, and coarse pointers do not snap
 * (see home-snap-responsive.test.js). Compressing the type there would cost
 * readability — 0.72 puts 16px body copy near 11px on a small phone — and buy
 * nothing, so panels stay at natural size and simply scroll.
 */
test.describe('touch devices are left at natural size', () => {
	test.use({ hasTouch: true, viewport: { width: 360, height: 640 } });

	test('no panel is scaled down on a coarse pointer', async ({ page }) => {
		await page.goto('/');
		await page.waitForSelector('#closing');
		await page.waitForTimeout(500);

		const state = await page.evaluate(
			(ids) => ({
				coarse: window.matchMedia('(pointer: coarse)').matches,
				scales: ids.map((id) => {
					const wrapper = document
						.getElementById(id)
						.querySelector(':scope > .hero-layout, :scope > .scroll-reveal');
					return wrapper ? Number(getComputedStyle(wrapper).zoom) : 1;
				})
			}),
			PANELS
		);

		// Guard the premise, so this cannot quietly become a desktop assertion
		expect(state.coarse, 'expected the context to emulate a touch pointer').toBe(true);
		// 360x640 is the tightest size in the matrix — the one that was scaled to
		// 0.72 back when touch still snapped.
		for (const scale of state.scales) {
			expect(scale).toBe(1);
		}
	});
});
