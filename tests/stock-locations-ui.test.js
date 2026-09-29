import { test, expect } from '@playwright/test';
import { createServer } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

// Dedicated component fixture: no Firebase, authentication, or inventory writes.
// It is served from tests only and never becomes an application route/build asset.
let server;
let fixtureUrl;
test.beforeAll(async () => {
	server = await createServer({
		configFile: false,
		root: process.cwd(),
		plugins: [tailwindcss(), svelte({ configFile: false, compilerOptions: { runes: true } })],
		server: { host: '127.0.0.1', port: 0 },
		cacheDir: path.join('node_modules', '.vite-stock-ui')
	});
	await server.listen();
	fixtureUrl = `http://127.0.0.1:${server.httpServer.address().port}/tests/fixtures/stock-ui/index.html`;
});
test.afterAll(async () => {
	await server?.close();
});
test.beforeEach(async ({ page }) => {
	await page.goto(fixtureUrl);
});

async function chooseLocation(page, label) {
	await page.getByRole('button', { name: 'Starting Location', exact: true }).click();
	await page.getByRole('option', { name: label, exact: true }).click();
}

test('opening balances require a default, preserve failed inputs and prevent duplicate submits', async ({
	page
}) => {
	await page.getByLabel('Item Name', { exact: true }).fill('New fixture stock');
	await page.getByRole('button', { name: 'Add Item', exact: true }).click();
	await expect(page.getByText('Choose a starting location', { exact: true })).toBeVisible();
	await chooseLocation(page, 'Freezer');
	await page.getByLabel('Opening Freezer stock').fill('5');
	await page.getByLabel('Opening Fridge stock').fill('3');
	await expect(page.getByText('Combined total: 8')).toBeVisible();
	await page.getByRole('button', { name: 'Add Item', exact: true }).click();
	await expect(page.getByRole('alert')).toHaveText('Fixture save failed');
	await expect(page.getByLabel('Opening Freezer stock')).toHaveValue('5');
	await expect(page.getByLabel('Item Name', { exact: true })).toHaveValue('New fixture stock');
	await page.getByRole('button', { name: 'Delay next add' }).click();
	await page.getByRole('button', { name: 'Add Item', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Saving…', exact: true })).toBeDisabled();
	await expect(page.getByLabel('Item Name', { exact: true })).toBeDisabled();
	await expect(page.getByLabel('Add requests')).toHaveText('2');
	await page.getByRole('button', { name: 'Complete delayed add' }).click();
	await expect(page.getByLabel('Item Name', { exact: true })).toHaveValue('');
	const submitted = JSON.parse(await page.getByLabel('Submitted item').textContent());
	expect(submitted.stockByStorage).toEqual({ Freezer: 5, Refrigerator: 3, 'Dry Storage': 0 });
	expect(submitted.count).toBe(8);
});

test('location inputs survive snapshots independently and filters use positive balances', async ({
	page
}) => {
	await page.getByLabel('Amount for Fixture fries in Freezer').fill('5');
	await page.getByLabel('Amount for Fixture fries in Fridge').fill('2');
	await page.getByRole('button', { name: 'Receive fresh snapshot' }).click();
	await expect(page.getByLabel('Amount for Fixture fries in Freezer')).toHaveValue('5');
	await expect(page.getByLabel('Amount for Fixture fries in Fridge')).toHaveValue('2');
	await page.getByRole('button', { name: 'Add to Freezer for Fixture fries', exact: true }).click();
	await expect(page.getByLabel('Amount for Fixture fries in Freezer')).toHaveValue('');
	await expect(page.getByLabel('Amount for Fixture fries in Fridge')).toHaveValue('2');
	await expect(page.getByLabel('Movement')).toContainText('"delta":5,"location":"Freezer"');
	await page.getByRole('button', { name: 'Fridge', exact: true }).click();
	await expect(page.getByText('No matching stock')).toBeVisible();
	await page.getByRole('button', { name: 'All locations', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Fixture fries · Total 12' })).toBeVisible();
});

test('a sent change shows beside the balance until the confirmed balance arrives', async ({
	page
}) => {
	await page.getByRole('button', { name: 'Delay adjustments' }).click();
	await page.getByLabel('Amount for Fixture fries in Freezer').fill('3');
	await page.getByRole('button', { name: 'Add to Freezer for Fixture fries', exact: true }).click();
	const ghost = page.locator('.ghost');
	await expect(ghost).toHaveText('+3');
	await expect(page.getByRole('heading', { name: 'Fixture fries · Total 10' })).toBeVisible();
	await page.getByRole('button', { name: 'Complete delayed adjustment' }).click();
	await expect(page.getByRole('heading', { name: 'Fixture fries · Total 13' })).toBeVisible();
	await expect(ghost).toHaveCount(0);
	await expect(page.getByLabel('Amount for Fixture fries in Freezer')).toHaveValue('');
});

test('clicking the transfer dialog backdrop cancels like Escape', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 900 });
	await page.getByRole('button', { name: 'Transfer stock', exact: true }).click();
	const dialog = page.getByRole('dialog');
	await expect(dialog).toBeVisible();
	await page.getByLabel('Quantity (10 available)').fill('4');
	// The card's own padding must not count as outside.
	const box = await dialog.boundingBox();
	await page.mouse.click(box.x + 4, box.y + 4);
	await expect(dialog).toBeVisible();
	await page.mouse.click(8, 8);
	await expect(dialog).not.toBeVisible();
	await expect(page.getByRole('button', { name: 'Transfer stock', exact: true })).toBeFocused();
	await expect(page.getByLabel('Movement')).toHaveText('null');
});

test('selecting the quantity and letting go on the backdrop keeps the transfer dialog open', async ({
	page
}) => {
	await page.setViewportSize({ width: 1280, height: 900 });
	await page.getByRole('button', { name: 'Transfer stock', exact: true }).click();
	const dialog = page.getByRole('dialog');
	const quantity = page.getByLabel('Quantity (10 available)');
	await quantity.fill('4');
	// Drag across the text, out over the backdrop, and let go there.
	const box = await quantity.boundingBox();
	await page.mouse.move(box.x + box.width - 6, box.y + box.height / 2);
	await page.mouse.down();
	await page.mouse.move(8, 8, { steps: 8 });
	await page.mouse.up();
	await expect(dialog).toBeVisible();
	await expect(quantity).toHaveValue('4');
	// A real backdrop click still cancels.
	await page.mouse.click(8, 8);
	await expect(dialog).not.toBeVisible();
});

test('number boxes refuse letters and other stray characters', async ({ page }) => {
	const amount = page.getByLabel('Amount for Fixture fries in Freezer');
	await amount.pressSequentially('4e+.a-2');
	await expect(amount).toHaveValue('42');
	await page.getByRole('button', { name: 'Transfer stock', exact: true }).click();
	const quantity = page.getByLabel('Quantity (10 available)');
	await quantity.pressSequentially('e3E');
	await expect(quantity).toHaveValue('3');
	await page.keyboard.press('Escape');
	await page.getByRole('button', { name: 'Starting Location', exact: true }).click();
	await page.getByRole('option', { name: 'Freezer', exact: true }).click();
	const opening = page.getByLabel('Opening Freezer stock');
	await opening.pressSequentially('1e5');
	await expect(opening).toHaveValue('15');
});

for (const theme of ['light', 'dark']) {
	for (const width of [390, 1280]) {
		test(`transfer preview, focus return and layout in ${theme} at ${width}px`, async ({
			page
		}, testInfo) => {
			await page.setViewportSize({ width, height: 900 });
			await page
				.getByRole('button', { name: theme === 'dark' ? 'Dark theme' : 'Light theme' })
				.click();
			await page.getByRole('button', { name: 'Transfer stock', exact: true }).click();
			const dialog = page.getByRole('dialog');
			await expect(dialog).toBeVisible();
			await page.getByLabel('Quantity (10 available)').fill('11');
			await expect(dialog.getByRole('button', { name: 'Transfer', exact: true })).toBeDisabled();
			await page.getByLabel('Quantity (10 available)').fill('4');
			await expect(dialog.getByText('Total stays 10.', { exact: false })).toBeVisible();
			await expect(dialog.getByRole('button', { name: 'Transfer', exact: true })).toBeEnabled();
			await page.screenshot({
				path: testInfo.outputPath(`transfer-${theme}-${width}.png`),
				fullPage: true
			});
			const bounds = await dialog.boundingBox();
			expect(bounds.x).toBeGreaterThanOrEqual(0);
			expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
			// The app reserves a scrollbar gutter; center within the page's content box.
			const content = await page.locator('body').boundingBox();
			expect(
				Math.abs(bounds.x + bounds.width / 2 - (content.x + content.width / 2))
			).toBeLessThanOrEqual(2);
			await page.keyboard.press('Escape');
			await expect(dialog).not.toBeVisible();
			await expect(page.getByRole('button', { name: 'Transfer stock', exact: true })).toBeFocused();
			await page.getByRole('button', { name: 'Transfer stock', exact: true }).click();
			await page.getByLabel('Quantity (10 available)').fill('4');
			await dialog.getByRole('button', { name: 'Transfer', exact: true }).click();
			await expect(dialog).not.toBeVisible();
			await expect(page.getByLabel('Movement')).toContainText(
				'"from":"Freezer","to":"Refrigerator","quantity":4'
			);
		});
	}
}
