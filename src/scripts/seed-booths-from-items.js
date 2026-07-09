// One-off migration: seed each group's new `booths` subcollection from
// whatever booth strings are already used on its items.
//
// Before this, the app's booth list was hardcoded globally (6 fixed names in
// ItemForm.svelte + a matching color table in tableUtils.js). Booths are now
// per-group, owner-managed data living at `groups/{gid}/booths/{id}` (see
// src/lib/booths.js + firestore.rules). This script scans each group's
// `items` collection, collects the distinct raw booth strings already in use,
// and creates a matching booth doc for each one — reusing the legacy color
// when the name matches one of the original 6, otherwise picking the next
// color from the same palette BoothManager's UI offers.
//
// It uses the Firebase ADMIN SDK, which bypasses security rules.
//
// Safe to re-run: it never overwrites a booth doc that already exists (so it
// won't clobber a rename/recolor an owner made through the UI between runs).
// Groups with no items simply get no seeded booths.
//
// Prerequisites:
//   1. A service-account key JSON from the Firebase console
//      (Project settings → Service accounts → Generate new private key).
//   2. Point GOOGLE_APPLICATION_CREDENTIALS at it, or pass --key <path>.
//
// Usage (from src/scripts, after `npm install`):
//   node seed-booths-from-items.js                  # every group
//   node seed-booths-from-items.js --group <gid>     # a single group
//   node seed-booths-from-items.js --key ./sa.json

import { readFileSync } from 'fs';
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Mirrors BOOTH_PALETTE in src/lib/booths.js — the first 6 are the app's
// legacy hardcoded booth colors, kept in this order so seeded groups look the
// same as before.
const PALETTE = [
	'#10B981',
	'#3B82F6',
	'#8B5CF6',
	'#F59E0B',
	'#EF4444',
	'#6B7280',
	'#EC4899',
	'#14B8A6',
	'#F97316',
	'#6366F1'
];

const LEGACY_COLORS = {
	freshly: '#10B981',
	b1: '#3B82F6',
	b2: '#8B5CF6',
	jakes: '#F59E0B',
	epic: '#EF4444',
	pulled: '#6B7280'
};

/**
 * Parse a small set of `--flag value` arguments.
 * @param {string[]} argv - process.argv.slice(2)
 * @returns {Record<string, string>}
 */
function parseArgs(argv) {
	const out = {};
	for (let i = 0; i < argv.length; i++) {
		if (argv[i].startsWith('--')) {
			out[argv[i].slice(2)] = argv[i + 1];
			i++;
		}
	}
	return out;
}

/**
 * Turn a booth label into the same slug shape src/lib/booths.js's
 * `slugify()` produces, so seeded ids match what the app would generate.
 * @param {string} label
 * @returns {string}
 */
function slugify(label) {
	return (label || '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

/**
 * Seed one group's booths from the distinct booth strings on its items.
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} groupId
 * @returns {Promise<number>} Number of booth docs created.
 */
async function seedGroup(db, groupId) {
	const itemsSnap = await db.collection('groups').doc(groupId).collection('items').get();

	const distinct = new Set();
	for (const doc of itemsSnap.docs) {
		const booths = doc.data().booths;
		if (Array.isArray(booths)) {
			for (const b of booths) {
				if (typeof b === 'string' && b.trim()) distinct.add(b);
			}
		}
	}

	if (distinct.size === 0) return 0;

	const boothsCol = db.collection('groups').doc(groupId).collection('booths');
	let created = 0;
	let paletteIndex = 6; // first 6 slots are reserved for legacy-matched colors

	for (const raw of distinct) {
		const id = slugify(raw) || raw.toLowerCase();
		const existing = await boothsCol.doc(id).get();
		if (existing.exists) continue;

		const color = LEGACY_COLORS[id] || PALETTE[paletteIndex++ % PALETTE.length];
		const label = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();

		await boothsCol.doc(id).set({ label, color, createdAt: FieldValue.serverTimestamp() });
		created++;
	}

	return created;
}

async function main() {
	const args = parseArgs(process.argv.slice(2));

	const credential = args.key
		? cert(JSON.parse(readFileSync(args.key, 'utf8')))
		: applicationDefault();
	initializeApp({ credential });
	const db = getFirestore();

	const groupIds = [];
	if (args.group) {
		groupIds.push(args.group);
	} else {
		const groupsSnap = await db.collection('groups').get();
		for (const doc of groupsSnap.docs) groupIds.push(doc.id);
	}

	console.log(`Seeding booths for ${groupIds.length} group(s)…`);
	console.log('—'.repeat(48));

	let totalCreated = 0;
	for (const groupId of groupIds) {
		const created = await seedGroup(db, groupId);
		totalCreated += created;
		console.log(`Group ${groupId}: ${created} booth(s) created.`);
	}

	console.log('—'.repeat(48));
	console.log(`Done. ${totalCreated} booth doc(s) created across ${groupIds.length} group(s).`);
	process.exit(0);
}

main().catch((error) => {
	console.error('Seeding failed:', error);
	process.exit(1);
});
