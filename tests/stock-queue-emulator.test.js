import { test, expect } from '@playwright/test';
import { build, preview } from 'vite';
import { createRequire } from 'node:module';
import path from 'node:path';
import { writeFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import {
	readStockMaintenanceSnapshot,
	planStockMaintenance,
	applyStockMaintenance,
	applyHistoricalStockReviews
} from '../src/lib/stockMaintenance.js';

test.skip(
	process.env.STOCK_EMULATOR_TESTS !== '1',
	'Requires isolated local Auth/Firestore emulators; see rollout testing instructions.'
);
test.describe.configure({ mode: 'serial' });
const require = createRequire(path.resolve('src/scripts/package.json'));
let admin;
let adminAuth;
let server;
let url;
let group;
let email;
let uid;

test.beforeAll(async () => {
	process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8088';
	process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
	const { initializeApp } = require('firebase-admin/app');
	const { getFirestore } = require('firebase-admin/firestore');
	const { getAuth } = require('firebase-admin/auth');
	const app = initializeApp({ projectId: 'demo-stocksense' }, `stock-test-${randomUUID()}`);
	admin = getFirestore(app);
	adminAuth = getAuth(app);
	const outDir = path.resolve('node_modules/.stock-queue-test-build');
	await build({
		configFile: false,
		root: path.resolve('tests/fixtures/stock-queue'),
		resolve: {
			alias: [
				{
					find: path.resolve('src/firebase').replaceAll('\\', '/'),
					replacement: path.resolve('tests/fixtures/stock-queue/firebase.js').replaceAll('\\', '/')
				}
			]
		},
		plugins: [
			{
				name: 'isolated-firebase',
				enforce: 'pre',
				resolveId(source, importer) {
					if (source === '../firebase' && importer?.includes('/src/lib/'))
						return path.resolve('tests/fixtures/stock-queue/firebase.js').replaceAll('\\', '/');
				}
			}
		],
		build: { outDir, emptyOutDir: true, minify: false }
	});
	const assets = (await readdir(path.join(outDir, 'assets'))).map((name) => `/assets/${name}`);
	await writeFile(
		path.join(outDir, 'sw.js'),
		`self.addEventListener('install',e=>e.waitUntil(caches.open('fixture').then(c=>c.addAll(${JSON.stringify(['/', ...assets])})).then(()=>self.skipWaiting())));self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('fetch',e=>{if(new URL(e.request.url).origin===self.location.origin)e.respondWith(caches.match(e.request,{ignoreVary:true}).then(r=>r||fetch(e.request)));});`
	);
	server = await preview({
		configFile: false,
		root: path.resolve('tests/fixtures/stock-queue'),
		build: { outDir },
		preview: { host: '127.0.0.1', port: 0 }
	});
	url = `http://127.0.0.1:${server.httpServer.address().port}`;
});
test.afterAll(async () => {
	await new Promise((resolve) => server?.httpServer.close(resolve) ?? resolve());
});

test.beforeEach(async () => {
	group = `group-${randomUUID()}`;
	email = `${randomUUID()}@stock-test.example`;
	const user = await adminAuth.createUser({ email, password: 'stock-test-password' });
	uid = user.uid;
	await admin.doc(`groups/${group}`).set({ name: 'Isolated test group', ownerId: uid });
	await admin.doc(`groups/${group}/members/${uid}`).set({ role: 'owner' });
	await admin
		.doc(`groups/${group}/items/fries`)
		.set({ name: 'Fries', count: 10, storageType: 'Freezer' });
});

async function open(page) {
	page.on('pageerror', (error) => console.log('Queue fixture error:', error.message));
	page.on('requestfailed', (request) =>
		console.log('Queue fixture failed request:', request.url(), request.failure()?.errorText)
	);
	page.on('console', (message) => {
		if (message.type() === 'error') console.log('Queue fixture console:', message.text());
	});
	await page.goto(url);
	await page.waitForFunction(() => window.fixtureReady);
	await page.evaluate(({ email, group }) => window.stockTest.login(email, group), { email, group });
	await page.evaluate((group) => window.stockTest.read(group, 'fries'), group);
}
const enqueue = (page, details) =>
	page.evaluate(
		(details) =>
			window.stockTest.enqueueStockAction({
				itemId: 'fries',
				user: 'Test operator',
				kind: 'adjust',
				location: 'Freezer',
				...details
			}),
		details
	);
const count = async () => (await admin.doc(`groups/${group}/items/fries`).get()).data()?.count;
const ledger = async () =>
	(await admin.collection(`groups/${group}/transactions`).get()).docs.map((row) => row.data());

test('two devices, offline reload, 10 - 2 + 5 = 13 and lost acknowledgment deduplication', async ({
	browser
}) => {
	const offline = await browser.newContext();
	const online = await browser.newContext();
	const a = await offline.newPage();
	const b = await online.newPage();
	await open(a);
	await open(b);
	await a.reload();
	await a.waitForFunction(() => window.fixtureReady);
	await a.evaluate(({ email, group }) => window.stockTest.login(email, group), { email, group });
	await offline.setOffline(true);
	const queued = await enqueue(a, { delta: 5 });
	expect(queued.status).toBe('queued');
	const action = await a.evaluate(async () => (await window.stockTest.accessStockQueue())[0]);
	await enqueue(b, { delta: -2 });
	expect(await count()).toBe(8);
	await a.reload();
	await a.waitForFunction(() => window.fixtureReady);
	// The original session resumes from persisted Firebase auth without network login.
	await offline.setOffline(false);
	await a.evaluate(({ email, group }) => window.stockTest.login(email, group), { email, group });
	await expect.poll(count).toBe(13);
	// Simulate a worker retrying a previously committed operation after losing its ack.
	await Promise.all([
		a.evaluate((action) => window.stockTest.applyStockAction(action), action),
		b.evaluate((action) => window.stockTest.applyStockAction(action), action)
	]);
	expect(await count()).toBe(13);
	const records = await ledger();
	expect(records).toHaveLength(2);
	expect(records.find((row) => row.operationId === queued.operationId)).toMatchObject({
		previousCount: 8,
		newCount: 13
	});
	await offline.close();
	await online.close();
});

test('two tabs preserve FIFO and a replayed oversized removal blocks only its item', async ({
	context
}) => {
	const a = await context.newPage();
	const b = await context.newPage();
	await open(a);
	await open(b);
	await context.setOffline(true);
	await enqueue(a, { delta: -8 });
	await enqueue(b, { delta: 1 });
	await admin.doc(`groups/${group}/items/fries`).update({ count: 3 });
	await admin
		.doc(`groups/${group}/items/other`)
		.set({ name: 'Other', count: 1, storageType: 'Freezer' });
	await context.setOffline(false);
	await expect
		.poll(async () => a.evaluate(() => window.stockTest.state.actions[0]?.status))
		.toBe('attention');
	expect(await count()).toBe(3);
	await a.evaluate((group) => window.stockTest.read(group, 'other'), group);
	await enqueue(a, { itemId: 'other', delta: 2 });
	expect((await admin.doc(`groups/${group}/items/other`).get()).data().count).toBe(3);
	const first = await a.evaluate(() => window.stockTest.state.actions[0].id);
	await a.evaluate((id) => window.stockTest.cancelStockAction(id), first);
	await expect.poll(count).toBe(4);
	expect((await ledger()).filter((row) => row.itemId === 'fries')).toHaveLength(1);
});

test('reset conflicts require fresh confirmation, retain following action order, and never erase an intervening restock silently', async ({
	page,
	context
}) => {
	await open(page);
	await context.setOffline(true);
	const reset = await enqueue(page, { kind: 'reset' });
	await enqueue(page, { delta: 2 });
	await admin.doc(`groups/${group}/items/fries`).update({ count: 15 });
	await context.setOffline(false);
	await expect
		.poll(async () => page.evaluate(() => window.stockTest.state.actions[0]?.status))
		.toBe('attention');
	expect(await count()).toBe(15);
	const review = await page.evaluate(
		(id) => window.stockTest.prepareStockActionReconfirmation(id),
		reset.operationId
	);
	await page.evaluate(({ id, expected }) => window.stockTest.reconfirmStockAction(id, expected), {
		id: reset.operationId,
		expected: review.expectedRevision
	});
	await expect.poll(count).toBe(2);
	expect(
		(await ledger()).map((row) => [row.previousCount, row.newCount]).sort((a, b) => b[0] - a[0])
	).toEqual([
		[15, 0],
		[0, 2]
	]);
});

test('queues survive sign-out, cannot cross accounts, and deleted targets need attention', async ({
	page,
	context
}) => {
	await open(page);
	await context.setOffline(true);
	await enqueue(page, { delta: 2 });
	await page.evaluate(() => window.stockTest.logout());
	await context.setOffline(false);
	const stranger = await adminAuth.createUser({
		email: `${randomUUID()}@stock-test.example`,
		password: 'stock-test-password'
	});
	await page.evaluate(({ email, group }) => window.stockTest.login(email, group), {
		email: stranger.email,
		group
	});
	expect(await page.evaluate(() => window.stockTest.state.actions.length)).toBe(0);
	expect(await count()).toBe(10);
	await admin.doc(`groups/${group}/items/fries`).delete();
	await page.evaluate(({ email, group }) => window.stockTest.login(email, group), { email, group });
	await expect
		.poll(async () => page.evaluate(() => window.stockTest.state.actions[0]?.status))
		.toBe('attention');
	expect((await ledger()).length).toBe(0);
});

test('maintenance dry-run, backup, stale guards, atomic draft migration and idempotent apply', async () => {
	const { FieldValue } = require('firebase-admin/firestore');
	await admin
		.doc(`groups/${group}/items/fridge`)
		.set({ name: 'Fries in fridge', count: 4, storageType: 'Freezer', cost: 8 });
	await admin
		.doc(`groups/${group}/orders/draft`)
		.set({ lines: { fries: { qty: 3 }, fridge: { qty: 5 } } });
	const snapshot = await readStockMaintenanceSnapshot(admin, group);
	const manifest = {
		groupId: group,
		approved: true,
		reviewedBy: 'Test owner',
		compatibleAppDeployed: true,
		oldClientsSynchronized: true,
		localPendingActionsCleared: true,
		pairs: [
			{
				operationId: randomUUID(),
				keptId: 'fries',
				duplicateId: 'fridge',
				keptLocation: 'Freezer',
				duplicateLocation: 'Refrigerator',
				expectedKept: snapshot.items.find((row) => row.id === 'fries'),
				expectedDuplicate: snapshot.items.find((row) => row.id === 'fridge'),
				draftResolutions: [
					{ id: 'draft', expected: snapshot.orders[0], survivorOverride: { qty: 5 } }
				]
			}
		]
	};
	planStockMaintenance(snapshot, manifest);
	expect(await count()).toBe(10);
	expect(await ledger()).toHaveLength(0);
	await admin.doc(`groups/${group}/items/fries`).update({ count: 11 });
	await expect(
		applyStockMaintenance(admin, manifest, async () => {}, FieldValue.serverTimestamp)
	).rejects.toThrow('changed');
	await admin.doc(`groups/${group}/items/fries`).update({ count: 10 });
	let backedUp = false;
	await applyStockMaintenance(
		admin,
		manifest,
		async (backup) => {
			expect(backup.snapshot.items).toHaveLength(2);
			expect(await count()).toBe(10);
			backedUp = true;
		},
		FieldValue.serverTimestamp
	);
	expect(backedUp).toBe(true);
	expect(await count()).toBe(14);
	expect(await ledger()).toHaveLength(2);
	expect((await admin.doc(`groups/${group}/items/fridge`).get()).exists).toBe(false);
	expect((await admin.doc(`groups/${group}/orders/draft`).get()).data().lines).toEqual({
		fries: { qty: 5 }
	});
	expect(
		(
			await applyStockMaintenance(
				admin,
				manifest,
				async () => {
					throw new Error('should not back up a completed operation');
				},
				FieldValue.serverTimestamp
			)
		)[0].status
	).toBe('already-applied');
});

test('historical decisions are auditable, reversible and leave ledger sources unchanged', async () => {
	const { FieldValue, Timestamp } = require('firebase-admin/firestore');
	const removal = {
		itemId: 'freezer-id',
		itemName: 'Original fries',
		type: 'remove',
		previousCount: 10,
		newCount: 8,
		timestamp: Timestamp.fromDate(new Date('2025-08-20T14:00:00Z'))
	};
	const addition = {
		itemId: 'fridge-id',
		itemName: 'Fries in fridge',
		type: 'add',
		previousCount: 0,
		newCount: 2,
		timestamp: Timestamp.fromDate(new Date('2025-08-20T14:05:00Z'))
	};
	await admin.doc(`groups/${group}/transactions/removal`).set(removal);
	await admin.doc(`groups/${group}/transactions/addition`).set(addition);
	const manifest = {
		groupId: group,
		approved: true,
		reviewedBy: 'Test owner',
		historyLinks: [{ locations: { 'freezer-id': 'Freezer', 'fridge-id': 'Refrigerator' } }],
		reviewDecisions: [
			{
				id: 'review',
				operationId: randomUUID(),
				confirmed: true,
				transactionIds: ['removal', 'addition'],
				expectedTransactions: [
					{ ...removal, id: 'removal' },
					{ ...addition, id: 'addition' }
				]
			}
		]
	};
	await applyHistoricalStockReviews(admin, manifest, async () => {}, FieldValue.serverTimestamp);
	const expectedReview = (
		await admin.doc(`groups/${group}/stockHistoryReviews/review`).get()
	).data();
	await applyHistoricalStockReviews(
		admin,
		{
			...manifest,
			reviewDecisions: [
				{
					...manifest.reviewDecisions[0],
					operationId: randomUUID(),
					expectedReview,
					confirmed: false
				}
			]
		},
		async () => {},
		FieldValue.serverTimestamp
	);
	expect((await admin.collection(`groups/${group}/stockHistoryReviewAudit`).get()).size).toBe(2);
	expect((await admin.doc(`groups/${group}/transactions/removal`).get()).data()).toEqual(removal);
	expect(
		(await admin.doc(`groups/${group}/stockHistoryReviews/review`).get()).data().confirmed
	).toBe(false);
});

test('offline create, adjust, reset and delete retain their order through replay', async ({
	page,
	context
}) => {
	await open(page);
	await context.setOffline(true);
	await enqueue(page, {
		itemId: 'new-item',
		kind: 'create',
		item: { name: 'New stock', count: 2, storageType: 'Freezer' }
	});
	await enqueue(page, { itemId: 'new-item', delta: 3 });
	await enqueue(page, { itemId: 'new-item', kind: 'reset' });
	await enqueue(page, { itemId: 'new-item', kind: 'delete' });
	await context.setOffline(false);
	await expect.poll(async () => page.evaluate(() => window.stockTest.state.actions.length)).toBe(0);
	expect((await admin.doc(`groups/${group}/items/new-item`).get()).exists).toBe(false);
	const records = await ledger();
	expect(records).toHaveLength(4);
	expect(records.map((row) => `${row.event}:${row.previousCount}->${row.newCount}`).sort()).toEqual(
		['countChange:2->5', 'countChange:5->0', 'itemCreated:0->2', 'itemDeleted:0->0'].sort()
	);
});

test('disabled durable storage surfaces an error and never claims a stock write was queued', async ({
	browser
}) => {
	const context = await browser.newContext();
	await context.addInitScript(() =>
		Object.defineProperty(globalThis, 'indexedDB', { get: () => undefined })
	);
	const page = await context.newPage();
	await open(page);
	const failure = await page.evaluate(async () => {
		try {
			await window.stockTest.enqueueStockAction({
				itemId: 'fries',
				kind: 'adjust',
				location: 'Freezer',
				delta: 2,
				user: 'Test'
			});
			return null;
		} catch (error) {
			return error.message;
		}
	});
	expect(failure).toContain('Durable storage is unavailable');
	expect(await count()).toBe(10);
	expect(await ledger()).toHaveLength(0);
	await context.close();
});
