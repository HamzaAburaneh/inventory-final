// Repair one item whose location balances no longer add up to its total.
//
// This happens when an older build of the app (one that predates storage
// locations) changes `count` on an item that already carries a `stockByStorage`
// map: the total moves, the map does not, and the current app refuses further
// stock changes on that item until someone resolves it.
//
// The repair keeps `count` as the source of truth (that is what the ledger row
// written by the old build describes) and moves the difference into one
// location: the item's starting location by default, or `--location`. Nothing
// else changes. No ledger row is written because the total is not changing.
// A fresh `stockRevision` is stamped so pending actions re-check their base.
//
// DRY RUN BY DEFAULT: without --apply it reads, prints the plan and exits.
//
// Credentials work exactly like backfill-transaction-events.js: either
// BACKFILL_EMAIL / BACKFILL_PASSWORD in the project-root .env (an ordinary app
// sign-in; the rules let any member write their group's items) or a service
// account via GOOGLE_APPLICATION_CREDENTIALS / --key.
//
// Usage (from src/scripts, after `npm install`):
//   node reconcile-stock-item.js --audit                            # list every broken item
//   node reconcile-stock-item.js --item "test item"                 # dry run
//   node reconcile-stock-item.js --item "test item" --apply         # write
//   node reconcile-stock-item.js --item <itemId> --location Freezer --apply
//   node reconcile-stock-item.js --item <itemId> --location Refrigerator --all-in --apply
//   node reconcile-stock-item.js --item "test item" --group <groupId>
//
// --all-in puts the entire count in --location and zeroes the rest, for a map
// that is a stale snapshot rather than merely short by the difference.

import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from 'dotenv';
import {
	STORAGE_LOCATIONS,
	emptyStock,
	normalizeItemStock,
	normalizeStorageLocation,
	stockInteger
} from '../lib/stockLocations.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '../../.env') });

/**
 * Parse `--flag [value]` arguments. Flags with no value are booleans.
 * @param {string[]} argv - process.argv.slice(2)
 * @returns {Record<string, string | boolean>}
 */
function parseArgs(argv) {
	const args = {};
	for (let i = 0; i < argv.length; i += 1) {
		const token = argv[i];
		if (!token.startsWith('--')) continue;
		const key = token.slice(2);
		const next = argv[i + 1];
		if (next !== undefined && !next.startsWith('--')) {
			args[key] = next;
			i += 1;
		} else args[key] = true;
	}
	return args;
}

/**
 * @typedef {object} Backend
 * @property {string} label - How this run authenticated.
 * @property {() => Promise<string[]>} listGroups - Group ids to search.
 * @property {(groupId: string) => Promise<Array<{ id: string, data: Record<string, unknown> }>>} readItems
 * @property {(groupId: string, itemId: string, fields: Record<string, unknown>) => Promise<void>} updateItem
 */

/**
 * Admin SDK backend (service account, bypasses rules).
 * @param {string | undefined} keyPath - Service-account JSON path, if given.
 * @returns {Promise<Backend>} The configured backend.
 */
async function adminBackend(keyPath) {
	const { initializeApp, cert, applicationDefault } = await import('firebase-admin/app');
	const { getFirestore } = await import('firebase-admin/firestore');
	const app = initializeApp({
		credential: keyPath ? cert(JSON.parse(readFileSync(keyPath, 'utf8'))) : applicationDefault()
	});
	const db = getFirestore(app);
	return {
		label: keyPath ? `service account ${keyPath}` : 'application default credentials',
		listGroups: async () => (await db.collection('groups').get()).docs.map((d) => d.id),
		readItems: async (groupId) =>
			(await db.collection('groups').doc(groupId).collection('items').get()).docs.map((d) => ({
				id: d.id,
				data: d.data()
			})),
		updateItem: (groupId, itemId, fields) =>
			db.collection('groups').doc(groupId).collection('items').doc(itemId).update(fields)
	};
}

/**
 * Client SDK backend (ordinary app sign-in; rules apply).
 * @param {string} email - BACKFILL_EMAIL.
 * @param {string} password - BACKFILL_PASSWORD.
 * @returns {Promise<Backend>} The configured backend.
 */
async function clientBackend(email, password) {
	const { initializeApp } = await import('firebase/app');
	const { getFirestore, collection, doc, getDoc, getDocs, updateDoc } =
		await import('firebase/firestore');
	const { getAuth, signInWithEmailAndPassword } = await import('firebase/auth');
	const app = initializeApp({
		apiKey: process.env.VITE_FIREBASE_API_KEY,
		authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
		projectId: process.env.VITE_FIREBASE_PROJECT_ID,
		storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
		messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
		appId: process.env.VITE_FIREBASE_APP_ID
	});
	const db = getFirestore(app);
	const credential = await signInWithEmailAndPassword(getAuth(app), email, password);
	const uid = credential.user.uid;
	return {
		label: `signed in as ${email}`,
		listGroups: async () => {
			const profile = await getDoc(doc(db, 'userProfiles', uid));
			const groupId = profile.exists() ? profile.data().groupId : null;
			if (!groupId) throw new Error(`${email} has no group.`);
			return [groupId];
		},
		readItems: async (groupId) =>
			(await getDocs(collection(db, 'groups', groupId, 'items'))).docs.map((d) => ({
				id: d.id,
				data: d.data()
			})),
		updateItem: (groupId, itemId, fields) =>
			updateDoc(doc(db, 'groups', groupId, 'items', itemId), fields)
	};
}

/**
 * @param {Record<string, string | boolean>} args - Parsed CLI flags.
 * @returns {Promise<Backend>} Whichever backend the available credentials allow.
 */
async function resolveBackend(args) {
	const keyPath = args.key ? String(args.key) : process.env.GOOGLE_APPLICATION_CREDENTIALS;
	if (keyPath) return adminBackend(keyPath);
	const email = process.env.BACKFILL_EMAIL;
	const password = process.env.BACKFILL_PASSWORD;
	if (email && password) return clientBackend(email, password);
	throw new Error(
		'No credentials. Add BACKFILL_EMAIL / BACKFILL_PASSWORD to the project-root .env, or ' +
			'point --key / GOOGLE_APPLICATION_CREDENTIALS at a service-account JSON.'
	);
}

/**
 * Work out the repaired map for one item, or explain why it cannot be repaired.
 * @param {Record<string, unknown>} item - Stored item data.
 * @param {string | undefined} requestedLocation - `--location`, if given.
 * @param {boolean} [allIn] - Put the whole count in that location instead of only the difference.
 * @returns {{ stockByStorage: Record<string, number>, location: string, difference: number }}
 */
function planRepair(item, requestedLocation, allIn = false) {
	const storageType = normalizeStorageLocation(item.storageType);
	const allowed = storageType === 'Dry Storage' ? ['Dry Storage'] : ['Freezer', 'Refrigerator'];
	const location = requestedLocation ? normalizeStorageLocation(requestedLocation) : storageType;
	if (!allowed.includes(location))
		throw new Error(`${location} is not a valid location for a ${storageType} item.`);
	const stockByStorage = emptyStock();
	for (const [key, value] of Object.entries(item.stockByStorage ?? {})) {
		if (!STORAGE_LOCATIONS.includes(key)) throw new Error(`Unknown stock balance: ${key}`);
		stockByStorage[key] = stockInteger(value);
	}
	for (const key of STORAGE_LOCATIONS)
		if (!allowed.includes(key) && stockByStorage[key] !== 0)
			throw new Error(`${key} holds stock but this is a ${storageType} item. Fix that by hand.`);
	const count = stockInteger(item.count);
	const mapped = Object.values(stockByStorage).reduce((sum, value) => sum + value, 0);
	const difference = count - mapped;
	if (allIn)
		return { stockByStorage: { ...emptyStock(), [location]: count }, location, difference };
	const repaired = stockByStorage[location] + difference;
	if (repaired < 0)
		throw new Error(
			`Moving ${difference} into ${location} would leave it at ${repaired}. Pick another --location.`
		);
	return { stockByStorage: { ...stockByStorage, [location]: repaired }, location, difference };
}

/**
 * Read-only pass over every item; prints the ones the app would show as "Check stock".
 * @param {Backend} backend - Authenticated backend.
 * @param {string[]} groupIds - Groups to scan.
 * @returns {Promise<void>}
 */
async function audit(backend, groupIds) {
	let broken = 0;
	for (const groupId of groupIds)
		for (const item of await backend.readItems(groupId)) {
			try {
				normalizeItemStock({ id: item.id, ...item.data });
			} catch (error) {
				broken += 1;
				console.log(`${item.id} "${item.data.name}" (group ${groupId})`);
				console.log(
					`  storageType: ${item.data.storageType}  count: ${item.data.count}  ` +
						`stockByStorage: ${JSON.stringify(item.data.stockByStorage ?? null)}`
				);
				console.log(`  ${error.message}`);
			}
		}
	console.log(broken ? `${broken} item(s) need repair.` : 'Every item passes stock validation.');
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const auditOnly = args.audit === true;
	if (!auditOnly && (!args.item || args.item === true))
		throw new Error('Pass --item <name or id> to choose which item to repair, or --audit.');
	const apply = args.apply === true;
	const backend = await resolveBackend(args);
	console.log(`Authenticated: ${backend.label}`);
	const groupIds = args.group ? [String(args.group)] : await backend.listGroups();
	if (auditOnly) return audit(backend, groupIds);
	const wanted = String(args.item);
	const matches = [];
	for (const groupId of groupIds)
		for (const item of await backend.readItems(groupId))
			if (item.id === wanted || String(item.data.name ?? '').trim() === wanted.trim())
				matches.push({ groupId, ...item });
	if (matches.length === 0) throw new Error(`No item named or identified "${wanted}".`);
	if (matches.length > 1)
		throw new Error(
			`"${wanted}" matches ${matches.length} items. Re-run with the id: ` +
				matches.map((m) => `${m.id} (group ${m.groupId})`).join(', ')
		);
	const [match] = matches;
	console.log(`Item ${match.id} "${match.data.name}" in group ${match.groupId}`);
	console.log(`  stored count: ${match.data.count}`);
	console.log(`  stored stockByStorage: ${JSON.stringify(match.data.stockByStorage ?? null)}`);
	const plan = planRepair(
		match.data,
		args.location ? String(args.location) : undefined,
		args['all-in'] === true
	);
	if (plan.difference === 0 && !args['all-in']) {
		console.log('Balances already add up to the total. Nothing to do.');
		return;
	}
	console.log(
		`  difference: ${plan.difference > 0 ? '+' : ''}${plan.difference} -> ${plan.location}`
	);
	console.log(`  repaired stockByStorage: ${JSON.stringify(plan.stockByStorage)}`);
	if (!apply) {
		console.log('Dry run. Re-run with --apply to write this.');
		return;
	}
	await backend.updateItem(match.groupId, match.id, {
		stockByStorage: plan.stockByStorage,
		stockRevision: randomUUID()
	});
	console.log('Written. Reload the app; the item should accept stock changes again.');
}

// The client SDK keeps its sockets open, so exit explicitly once the work is done.
main().then(
	() => process.exit(0),
	(error) => {
		console.error(error.message);
		process.exit(1);
	}
);
