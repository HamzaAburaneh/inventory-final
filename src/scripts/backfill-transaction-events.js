// One-off backfill: stamp the explicit `event` field onto legacy ledger rows.
//
// Transactions written before the lifecycle-event work have no `event` field.
// The app copes by reading `event ?? 'countChange'` (see the presentation
// helpers in TransactionTimeline.svelte and transactionHistory.js), so nothing
// is broken — but that default only exists in JavaScript, and Firestore can
// only filter on values that are actually stored. A server-side query for
// "Stock added" is `event == 'countChange' && type == 'add'`, and it silently
// skips every row missing the field.
//
// So this writes down what the app already assumes: `event: 'countChange'` on
// any transaction that lacks one. It changes no counts and rewrites no history
// — it only fills in a blank. Rows that already carry an `event` (including
// itemCreated / itemDeleted) are left untouched, which also makes it safe to
// re-run.
//
// DRY RUN BY DEFAULT: without --apply it reads, reports exactly what it would
// change, and exits without writing.
//
// ---------------------------------------------------------------------------
// Two ways to authenticate. Both need the project-root .env for the
// VITE_FIREBASE_* config.
//
// 1. Sign-in (easiest — no key to download). The rules let any group member
//    write that group's transactions, so an ordinary app login is enough. Add
//    to the project-root .env:
//        BACKFILL_EMAIL=you@example.com
//        BACKFILL_PASSWORD=your-password
//    Backfills the one group that account belongs to.
//
// 2. Service account (Admin SDK — bypasses rules, can do every group at once).
//    Firebase console -> Project settings -> Service accounts -> Generate new
//    private key. Then set GOOGLE_APPLICATION_CREDENTIALS, or pass --key.
//
// Usage (from src/scripts, after `npm install`):
//   node backfill-transaction-events.js                    # dry run
//   node backfill-transaction-events.js --apply            # actually write
//   node backfill-transaction-events.js --key ./sa.json    # force admin mode
//   node backfill-transaction-events.js --group <groupId>  # restrict to one group

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '../../.env') });

// Firestore caps a batched write at 500 operations.
const BATCH_LIMIT = 500;

const DEFAULT_EVENT = 'countChange';

/**
 * Parse a small set of `--flag [value]` arguments. Flags with no value are
 * treated as booleans.
 * @param {string[]} argv - process.argv.slice(2)
 * @returns {Record<string, string | boolean>}
 */
function parseArgs(argv) {
	const out = {};
	for (let i = 0; i < argv.length; i++) {
		if (!argv[i].startsWith('--')) continue;
		const key = argv[i].slice(2);
		const next = argv[i + 1];
		if (next && !next.startsWith('--')) {
			out[key] = next;
			i++;
		} else {
			out[key] = true;
		}
	}
	return out;
}

/**
 * Split a group's transactions into those needing a backfill and those already
 * carrying an event.
 *
 * Pure over the snapshot shape both SDKs share (`docs`, each with `id`, `ref`
 * and `data()`), so the two backends below can use it unchanged.
 * @param {{ docs: Array<{ id: string, ref: unknown, data: () => Record<string, unknown> }> }} snapshot
 *   Every transaction in the group.
 * @returns {{ missing: Array<{ id: string, ref: unknown, data: () => Record<string, unknown> }>,
 *   present: Record<string, number> }} The docs to write, and a tally of the events already stored.
 */
export function partitionByEvent(snapshot) {
	const missing = [];
	/** @type {Record<string, number>} */
	const present = {};
	for (const docSnap of snapshot.docs) {
		const event = docSnap.data().event;
		if (event === undefined || event === null || event === '') {
			missing.push(docSnap);
		} else {
			present[event] = (present[event] || 0) + 1;
		}
	}
	return { missing, present };
}

/**
 * @typedef {object} Backend
 * @property {string} label - How this backend authenticated, for the log.
 * @property {() => Promise<string[]>} listGroups - Group ids this run covers.
 * @property {(groupId: string) => Promise<{ docs: Array<{ id: string, ref: unknown,
 *   data: () => Record<string, unknown> }> }>} readTransactions - A group's ledger.
 * @property {(docs: Array<{ ref: unknown }>) => Promise<number>} writeEvents - Stamp
 *   DEFAULT_EVENT onto each doc; returns how many were written.
 */

/**
 * Admin SDK backend: a service-account key, bypassing security rules. Can
 * enumerate every group in the project.
 * @param {string | undefined} keyPath - Path to a service-account JSON, if given.
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
		readTransactions: (groupId) =>
			db.collection('groups').doc(groupId).collection('transactions').get(),
		writeEvents: async (docs) => {
			let written = 0;
			for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
				const chunk = docs.slice(i, i + BATCH_LIMIT);
				const batch = db.batch();
				for (const docSnap of chunk) batch.update(docSnap.ref, { event: DEFAULT_EVENT });
				await batch.commit();
				written += chunk.length;
				console.log(`  committed ${written}/${docs.length}`);
			}
			return written;
		}
	};
}

/**
 * Client SDK backend: an ordinary app sign-in. Security rules apply, which is
 * fine — members may write their own group's transactions — but it means this
 * can only reach the one group the account belongs to.
 * @param {string} email - BACKFILL_EMAIL.
 * @param {string} password - BACKFILL_PASSWORD.
 * @returns {Promise<Backend>} The configured backend.
 */
async function clientBackend(email, password) {
	const { initializeApp } = await import('firebase/app');
	const { getFirestore, collection, doc, getDoc, getDocs, writeBatch } =
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
			if (!groupId) throw new Error(`${email} has no group — nothing to back fill.`);
			return [groupId];
		},
		readTransactions: (groupId) => getDocs(collection(db, 'groups', groupId, 'transactions')),
		writeEvents: async (docs) => {
			let written = 0;
			for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
				const chunk = docs.slice(i, i + BATCH_LIMIT);
				const batch = writeBatch(db);
				for (const docSnap of chunk) batch.update(docSnap.ref, { event: DEFAULT_EVENT });
				await batch.commit();
				written += chunk.length;
				console.log(`  committed ${written}/${docs.length}`);
			}
			return written;
		}
	};
}

/**
 * Pick a backend from whatever credentials are actually available.
 * @param {Record<string, string | boolean>} args - Parsed CLI flags.
 * @returns {Promise<Backend>} The configured backend.
 */
async function resolveBackend(args) {
	const keyPath = args.key ? String(args.key) : process.env.GOOGLE_APPLICATION_CREDENTIALS;
	if (keyPath) return adminBackend(keyPath);

	const email = process.env.BACKFILL_EMAIL;
	const password = process.env.BACKFILL_PASSWORD;
	if (email && password) return clientBackend(email, password);

	throw new Error(
		'No credentials. Either add BACKFILL_EMAIL / BACKFILL_PASSWORD to the project-root .env ' +
			'(easiest — the rules let a group member write their own transactions), or point ' +
			'--key / GOOGLE_APPLICATION_CREDENTIALS at a service-account JSON.'
	);
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const apply = args.apply === true;

	const backend = await resolveBackend(args);
	console.log(`Authenticated: ${backend.label}`);

	const groupIds = args.group ? [String(args.group)] : await backend.listGroups();
	if (groupIds.length === 0) {
		console.log('No groups found — nothing to do.');
		return;
	}

	console.log(
		apply
			? `APPLYING to ${groupIds.length} group(s). Rows missing an event will be set to "${DEFAULT_EVENT}".`
			: `DRY RUN over ${groupIds.length} group(s). Nothing will be written — re-run with --apply to commit.`
	);

	let totalMissing = 0;
	let totalWritten = 0;

	for (const groupId of groupIds) {
		const snapshot = await backend.readTransactions(groupId);
		const { missing, present } = partitionByEvent(snapshot);
		totalMissing += missing.length;

		const alreadyTagged = Object.entries(present)
			.map(([event, count]) => `${event}=${count}`)
			.join(', ');
		console.log(
			`\nGroup ${groupId}: ${snapshot.docs.length} transactions, ${missing.length} missing an event` +
				(alreadyTagged ? ` (already tagged: ${alreadyTagged})` : '')
		);

		if (missing.length === 0) continue;

		// Show a couple of examples so the operator can sanity-check the target set
		// before committing to thousands of writes.
		for (const docSnap of missing.slice(0, 3)) {
			const data = docSnap.data();
			console.log(
				`  e.g. ${docSnap.id}: ${data.itemName} ${data.previousCount} -> ${data.newCount} (type=${data.type})`
			);
		}

		if (apply) totalWritten += await backend.writeEvents(missing);
	}

	console.log(
		apply
			? `\nDone. Wrote event="${DEFAULT_EVENT}" to ${totalWritten} transaction(s).`
			: `\nDry run complete. ${totalMissing} transaction(s) would be updated. Re-run with --apply to write.`
	);
	process.exit(0);
}

main().catch((error) => {
	console.error('Backfill failed:', error.message || error);
	process.exit(1);
});
