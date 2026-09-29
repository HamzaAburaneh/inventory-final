import { test, expect } from '@playwright/test';
import { createServer } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

// Dedicated component fixture: no Firebase, authentication, or vendor writes.
// It is served from tests only and never becomes an application route/build asset.
let server;
let fixtureUrl;
test.beforeAll(async () => {
	server = await createServer({
		configFile: false,
		root: process.cwd(),
		plugins: [tailwindcss(), svelte({ configFile: false, compilerOptions: { runes: true } })],
		server: { host: '127.0.0.1', port: 0 },
		cacheDir: path.join('node_modules', '.vite-vendor-ui')
	});
	await server.listen();
	fixtureUrl = `http://127.0.0.1:${server.httpServer.address().port}/tests/fixtures/vendor-ui/index.html`;
});
test.afterAll(async () => {
	await server?.close();
});
test.beforeEach(async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 900 });
	await page.goto(fixtureUrl);
});

test('the cash amount takes only a money figure', async ({ page }) => {
	await page.getByRole('button', { name: 'Open cash dialog' }).click();
	const amount = page.getByLabel('Amount', { exact: true });
	await amount.pressSequentially('gsdfg');
	await expect(amount).toHaveValue('');
	// A second point and a third decimal are refused too.
	await amount.pressSequentially('12.3.45');
	await expect(amount).toHaveValue('12.34');
	// A letter typed mid-number leaves the text and caret alone.
	await page.keyboard.press('Home');
	await page.keyboard.type('x9');
	await expect(amount).toHaveValue('912.34');
});

test('pasted money keeps its figure and pasted words are refused', async ({ page, context }) => {
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await page.getByRole('button', { name: 'Open cash dialog' }).click();
	const amount = page.getByLabel('Amount', { exact: true });
	await amount.focus();
	await page.evaluate(() => navigator.clipboard.writeText('$1,250.00'));
	await page.keyboard.press('ControlOrMeta+V');
	await expect(amount).toHaveValue('1250.00');
	await page.keyboard.press('ControlOrMeta+A');
	await page.evaluate(() => navigator.clipboard.writeText('twelve'));
	await page.keyboard.press('ControlOrMeta+V');
	await expect(amount).toHaveValue('1250.00');
});

test('selecting the amount and letting go on the backdrop keeps the dialog open', async ({
	page
}) => {
	await page.getByRole('button', { name: 'Open cash dialog' }).click();
	const dialog = page.getByRole('dialog');
	const amount = page.getByLabel('Amount', { exact: true });
	await amount.fill('25');
	// Drag across the text, out over the backdrop, and let go there.
	const box = await amount.boundingBox();
	await page.mouse.move(box.x + box.width - 6, box.y + box.height / 2);
	await page.mouse.down();
	await page.mouse.move(8, 8, { steps: 8 });
	await page.mouse.up();
	await expect(dialog).toBeVisible();
	await expect(amount).toHaveValue('25');
	// A real backdrop click still cancels, without saving.
	await page.mouse.click(8, 8);
	await expect(dialog).not.toBeVisible();
	await expect(page.getByLabel('Saved')).toHaveText('null');
});

test('the loan dialog keeps units whole and the value per unit to money', async ({ page }) => {
	await page.getByRole('button', { name: 'Open loan dialog' }).click();
	const dialog = page.getByRole('dialog');
	const units = page.getByLabel('Units', { exact: true });
	await units.pressSequentially('3e.5');
	await expect(units).toHaveValue('35');
	const price = page.getByLabel('Value per unit');
	await price.pressSequentially('abc2.5x0');
	await expect(price).toHaveValue('2.50');
	// The drag-to-select release doesn't close this dialog either.
	const box = await price.boundingBox();
	await page.mouse.move(box.x + box.width - 6, box.y + box.height / 2);
	await page.mouse.down();
	await page.mouse.move(8, 8, { steps: 8 });
	await page.mouse.up();
	await expect(dialog).toBeVisible();
});
