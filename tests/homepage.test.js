import { expect, test } from '@playwright/test';

/**
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<void>}
 */
async function waitForHomepage(page) {
	await page.waitForSelector('#closing');
	await page.waitForTimeout(250);
}

/**
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<number>}
 */
async function settledScrollY(page) {
	let previous = -1;
	await expect
		.poll(
			async () => {
				const current = await page.evaluate(() => window.scrollY);
				const stable = current === previous;
				previous = current;
				return stable;
			},
			{ timeout: 8000, intervals: [250] }
		)
		.toBe(true);
	return previous;
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} id
 * @returns {Promise<number>}
 */
function sectionTop(page, id) {
	return page.evaluate(
		(sectionId) => document.getElementById(sectionId).getBoundingClientRect().top + window.scrollY,
		id
	);
}

test.describe('Inventory Observatory homepage', () => {
	test('renders the five approved panels and truthful product demonstrations', async ({ page }) => {
		await page.goto('/');
		await waitForHomepage(page);

		await expect(page.locator('.panel')).toHaveCount(5);
		await expect(
			page.getByRole('heading', { name: 'Know what’s in stock. Know what happens next.' })
		).toBeVisible();
		await expect(page.getByText('Live inventory visibility')).toBeVisible();
		await expect(page.getByText('Traceable count changes')).toBeVisible();
		await expect(page.getByText('Forecast-ready insights')).toBeVisible();
		await expect(page.getByText('Example inventory record')).toBeAttached();
		await expect(page.getByText('Example transaction sequence')).toBeAttached();
		await expect(page.getByText('Illustrative forecast example')).toBeAttached();
		await expect(page.getByText('John Doe')).toHaveCount(0);
		await expect(page.getByText('Join thousands of businesses')).toHaveCount(0);
	});

	test('exposes five labelled, keyboard-operable rail targets of at least 48px', async ({
		page
	}) => {
		await page.goto('/');
		await waitForHomepage(page);

		const rail = page.getByRole('navigation', { name: 'Homepage panels' });
		const stops = rail.getByRole('button');
		await expect(stops).toHaveCount(5);
		await expect(stops.nth(0)).toHaveAccessibleName('Go to Overview');
		await expect(stops.nth(1)).toHaveAccessibleName('Go to Inventory control');
		await expect(stops.nth(2)).toHaveAccessibleName('Go to Transaction traceability');

		const sizes = await stops.evaluateAll((buttons) =>
			buttons.map((button) => {
				const rect = button.getBoundingClientRect();
				return { width: rect.width, height: rect.height };
			})
		);
		for (const size of sizes) {
			expect(size.width).toBeGreaterThanOrEqual(48);
			expect(size.height).toBeGreaterThanOrEqual(48);
		}

		await stops.nth(2).focus();
		await page.keyboard.press('Enter');
		await expect
			.poll(async () =>
				Math.abs(
					(await sectionTop(page, 'traceability')) - (await page.evaluate(() => window.scrollY))
				)
			)
			.toBeLessThan(150);
		await expect(stops.nth(2)).toHaveAttribute('aria-current', 'location');
	});

	test('publishes focused homepage metadata', async ({ page }) => {
		await page.goto('/');
		await waitForHomepage(page);

		await expect(page).toHaveTitle('StockSense | Inventory intelligence in focus');
		await expect(page.locator('meta[name="description"]')).toHaveAttribute(
			'content',
			/StockSense brings inventory counts, traceable transaction history/
		);
	});

	test('does not request Firestore data for anonymous homepage decoration', async ({ page }) => {
		const firestoreRequests = [];
		page.on('request', (request) => {
			if (request.url().includes('firestore.googleapis.com')) {
				firestoreRequests.push(request.url());
			}
		});

		await page.goto('/');
		await waitForHomepage(page);
		await page.waitForTimeout(500);
		expect(firestoreRequests).toEqual([]);
	});

	test('renders theme-bound base, hover, focus, and status colors', async ({ page }) => {
		await page.goto('/');
		await waitForHomepage(page);

		async function renderedColors() {
			await page.locator('.action-primary').first().focus();
			await page.locator('.action-secondary').first().hover();
			return page.evaluate(() => {
				const color = (selector, property) =>
					getComputedStyle(document.querySelector(selector)).getPropertyValue(property);
				return {
					pageText: color('.page', 'color'),
					cardSurface: color('.inventory-demo', 'background-color'),
					cardBorder: color('.inventory-demo', 'border-color'),
					primarySurface: color('.action-primary', 'background-color'),
					primaryText: color('.action-primary', 'color'),
					primaryFocus: color('.action-primary', 'outline-color'),
					secondaryHover: color('.action-secondary', 'background-color'),
					activeRail: color('.rail-stop.active .rail-dot', 'background-color'),
					statusText: color('.status-ok', 'color'),
					statusSurface: color('.status-ok', 'background-color'),
					themeColor: document.querySelector('meta[name="theme-color"]').content
				};
			});
		}

		const lightColors = await renderedColors();

		await page.evaluate(() => localStorage.setItem('theme', 'dark'));
		await page.reload();
		await waitForHomepage(page);
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

		const darkColors = await renderedColors();

		for (const property of Object.keys(lightColors)) {
			expect(darkColors[property], `${property} should change with the theme`).not.toBe(
				lightColors[property]
			);
		}
	});

	test('adds restrained hover motion to homepage signals and demonstrations', async ({ page }) => {
		await page.goto('/');
		await waitForHomepage(page);

		const signal = page.locator('.signal-strip p').first();
		const signalLabel = signal.locator('span');
		const signalBase = await signal.evaluate((element) => ({
			background: getComputedStyle(element).backgroundColor,
			underline: getComputedStyle(element, '::after').transform
		}));
		await signal.hover();
		await page.waitForTimeout(300);
		const signalHover = await signal.evaluate((element) => ({
			background: getComputedStyle(element).backgroundColor,
			underline: getComputedStyle(element, '::after').transform
		}));
		expect(signalHover.background).not.toBe(signalBase.background);
		expect(signalHover.underline).not.toBe(signalBase.underline);
		expect(await signalLabel.evaluate((element) => getComputedStyle(element).transform)).not.toBe(
			'none'
		);

		const inventoryDemo = page.locator('.inventory-demo');
		await inventoryDemo.hover();
		await page.waitForTimeout(280);
		expect(await inventoryDemo.evaluate((element) => getComputedStyle(element).transform)).not.toBe(
			'none'
		);

		const eventBody = page.locator('.event-body').first();
		await eventBody.hover();
		await page.waitForTimeout(260);
		expect(await eventBody.evaluate((element) => getComputedStyle(element).transform)).not.toBe(
			'none'
		);

		const forecastDemo = page.locator('.forecast-demo');
		await forecastDemo.hover();
		await page.waitForTimeout(280);
		await expect(page.locator('.forecast-chart-desktop .forecast-line')).toHaveCSS(
			'stroke-width',
			'4px'
		);
	});

	test('opens account creation from the closing action', async ({ page }) => {
		await page.goto('/');
		await waitForHomepage(page);

		await page.getByRole('link', { name: 'Get started' }).click();
		await expect(page).toHaveURL(/\/login\?mode=register$/);
		await expect(page.getByRole('heading', { name: 'Create an account' })).toBeVisible();
	});
});

test.describe('Inventory Observatory mobile behavior', () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test('avoids horizontal overflow while preserving the side rail', async ({ page }) => {
		await page.goto('/');
		await waitForHomepage(page);

		const geometry = await page.evaluate(() => ({
			viewportWidth: window.innerWidth,
			documentWidth: document.documentElement.scrollWidth,
			railDisplay: getComputedStyle(document.querySelector('.rail')).display
		}));

		expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
		expect(geometry.railDisplay).toBe('flex');
		await expect(
			page.getByRole('heading', { name: 'One inventory. Zero guesswork.' })
		).toBeAttached();
	});

	test('keeps the current panel stable while the mobile theme menu opens', async ({ page }) => {
		await page.goto('/');
		await waitForHomepage(page);

		await page.getByRole('button', { name: 'Go to Get started' }).click();
		const before = await settledScrollY(page);
		expect(Math.abs((await sectionTop(page, 'closing')) - before)).toBeLessThan(150);

		const openMenuBox = await page.getByRole('button', { name: 'Open menu' }).boundingBox();
		expect(openMenuBox).not.toBeNull();
		await page.mouse.click(
			openMenuBox.x + openMenuBox.width / 2,
			openMenuBox.y + openMenuBox.height / 2
		);
		// The mobile panel uses a 260ms slide transition; measure the toggle only
		// after its final hit box is stable so this remains a true pointer test.
		await page.waitForTimeout(300);
		const themeToggleBox = await page
			.getByRole('switch', { name: 'Switch to dark mode' })
			.boundingBox();
		expect(themeToggleBox).not.toBeNull();
		await page.mouse.click(
			themeToggleBox.x + themeToggleBox.width / 2,
			themeToggleBox.y + themeToggleBox.height / 2
		);
		const closeMenuBox = await page.getByRole('button', { name: 'Close menu' }).boundingBox();
		expect(closeMenuBox).not.toBeNull();
		await page.mouse.click(
			closeMenuBox.x + closeMenuBox.width / 2,
			closeMenuBox.y + closeMenuBox.height / 2
		);

		const after = await settledScrollY(page);
		expect(Math.abs(after - before)).toBeLessThan(12);
	});
});

test.describe('Inventory Observatory short landscape behavior', () => {
	test.use({ viewport: { width: 844, height: 390 } });

	test('keeps the five-stop side rail visible and inside the viewport', async ({ page }) => {
		await page.goto('/');
		await waitForHomepage(page);

		const railGeometry = await page.locator('.rail').evaluate((rail) => {
			const rect = rail.getBoundingClientRect();
			return {
				display: getComputedStyle(rail).display,
				top: rect.top,
				bottom: rect.bottom,
				viewportHeight: window.innerHeight,
				stops: rail.querySelectorAll('.rail-stop').length
			};
		});

		expect(railGeometry.display).toBe('flex');
		expect(railGeometry.stops).toBe(5);
		expect(railGeometry.top).toBeGreaterThanOrEqual(0);
		expect(railGeometry.bottom).toBeLessThanOrEqual(railGeometry.viewportHeight);
	});
});

test.describe('Inventory Observatory reduced motion', () => {
	test.use({ viewport: { width: 1280, height: 800 } });

	test('removes automatic entrances and mandatory scroll snapping', async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.goto('/');
		await waitForHomepage(page);

		const signal = page.locator('.signal-strip p').first();
		await signal.hover();
		const signalMotion = await signal.evaluate((element) => ({
			transition: getComputedStyle(element).transitionDuration,
			labelTransform: getComputedStyle(element.querySelector('span')).transform
		}));

		const inventoryDemo = page.locator('.inventory-demo');
		await inventoryDemo.hover();
		const inventoryMotion = await inventoryDemo.evaluate((element) => ({
			transition: getComputedStyle(element).transitionDuration,
			transform: getComputedStyle(element).transform
		}));

		const motion = await page.evaluate(() => ({
			snap: getComputedStyle(document.documentElement).scrollSnapType,
			heroAnimation: getComputedStyle(document.querySelector('.hero-layout')).animationName,
			revealOpacity: getComputedStyle(document.querySelector('.scroll-reveal')).opacity
		}));

		expect(motion.snap).toBe('none');
		expect(motion.heroAnimation).toBe('none');
		expect(motion.revealOpacity).toBe('1');
		expect(signalMotion.transition).toBe('0s');
		expect(signalMotion.labelTransform).toBe('none');
		expect(inventoryMotion.transition).toBe('0s');
		expect(inventoryMotion.transform).toBe('none');
	});
});
