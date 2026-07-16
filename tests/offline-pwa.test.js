import { expect, test } from '@playwright/test';

/**
 * Offline-first PWA regression tests (src/service-worker.js + static/manifest.webmanifest).
 * Playwright runs against the production build (`npm run build && npm run preview`),
 * which is the only place SvelteKit registers the service worker — so this suite
 * exercises the real offline path: visit once online, kill the network, reload,
 * and the cached app shell must still render.
 */

test.describe('offline PWA shell', () => {
	test('manifest is linked and served', async ({ page }) => {
		await page.goto('/');
		const manifestHref = await page.getAttribute('link[rel="manifest"]', 'href');
		expect(manifestHref).toContain('manifest.webmanifest');

		const response = await page.request.get('/manifest.webmanifest');
		expect(response.ok()).toBe(true);
		const manifest = await response.json();
		expect(manifest.name).toBe('StockSense');
		expect(manifest.display).toBe('standalone');
		expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
	});

	test('landing page still renders after going offline', async ({ page, context }) => {
		// First visit online: installs the service worker and precaches the shell.
		await page.goto('/');
		await page.waitForSelector('#closing');
		await page.evaluate(() => navigator.serviceWorker.ready);

		// Reload once while online so the navigation itself is runtime-cached
		// by the now-active worker.
		await page.reload();
		await page.waitForSelector('#closing');

		// Dead zone: no network at all. The pocket copy must take over.
		await context.setOffline(true);
		await page.reload();
		await page.waitForSelector('#closing', { timeout: 10000 });
		expect(await page.title()).toContain('StockSense');

		await context.setOffline(false);
	});
});
