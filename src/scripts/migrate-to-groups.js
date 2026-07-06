// One-off migration: move the legacy single-tenant inventory into a group.
//
// Before this, every signed-in user shared top-level `items` and
// `transactions` collections. The app is now multi-tenant (see firestore.rules
// + src/lib/groups.js): data lives under `groups/{gid}/…` and users join a
// group with an invite code. This script creates one group, makes a chosen
// user its owner, and copies every existing item and transaction into it
// (preserving document IDs). It does NOT delete the old collections, so the
// originals remain as a backup until you're confident.
//
// It uses the Firebase ADMIN SDK, which bypasses security rules — so it can
// read the old global data and write the new group data regardless of which
// rules are deployed, and can look the owner up by email.
//
// Prerequisites:
//   1. A service-account key JSON from the Firebase console
//      (Project settings → Service accounts → Generate new private key).
//   2. Point GOOGLE_APPLICATION_CREDENTIALS at it, or pass --key <path>.
//
// Usage (from src/scripts, after `npm install`):
//   node migrate-to-groups.js --owner you@example.com --name "CNE Inventory"
//   node migrate-to-groups.js --owner you@example.com --name "CNE Inventory" --key ./sa.json
//
// Safe to re-run: it reuses an existing group with the same name owned by the
// same user, and overwrites already-copied docs by id (idempotent copy).

import { readFileSync } from 'fs';
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

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

/** @returns {string} A 6-character unambiguous invite code. */
function generateCode() {
	let code = '';
	for (let i = 0; i < 6; i++) {
		code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
	}
	return code;
}

/**
 * Copy every doc from a source collection into a destination collection,
 * preserving IDs, in batches under Firestore's 500-write limit.
 * @param {FirebaseFirestore.Firestore} db
 * @param {FirebaseFirestore.CollectionReference} srcRef
 * @param {FirebaseFirestore.CollectionReference} dstRef
 * @returns {Promise<number>} Number of documents copied.
 */
async function copyCollection(db, srcRef, dstRef) {
	const snapshot = await srcRef.get();
	const docs = snapshot.docs;
	const chunkSize = 400;
	for (let i = 0; i < docs.length; i += chunkSize) {
		const batch = db.batch();
		for (const docSnap of docs.slice(i, i + chunkSize)) {
			batch.set(dstRef.doc(docSnap.id), docSnap.data());
		}
		await batch.commit();
	}
	return docs.length;
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const ownerEmail = args.owner;
	const groupName = args.name || 'My Inventory';
	if (!ownerEmail) {
		console.error('Missing --owner <email>. Run with --owner you@example.com --name "Group".');
		process.exit(1);
	}

	// Admin credentials: explicit --key path, or GOOGLE_APPLICATION_CREDENTIALS.
	const credential = args.key
		? cert(JSON.parse(readFileSync(args.key, 'utf8')))
		: applicationDefault();
	initializeApp({ credential });
	const db = getFirestore();
	const auth = getAuth();

	// Resolve the owner from their email.
	const owner = await auth.getUserByEmail(ownerEmail);
	console.log(`Owner: ${owner.email} (${owner.uid})`);

	// Reuse an existing group with this name owned by this user, else create one.
	const existing = await db
		.collection('groups')
		.where('ownerId', '==', owner.uid)
		.where('name', '==', groupName)
		.limit(1)
		.get();

	let groupId;
	let inviteCode;
	if (!existing.empty) {
		groupId = existing.docs[0].id;
		inviteCode = existing.docs[0].data().inviteCode;
		console.log(`Reusing existing group "${groupName}" (${groupId})`);
	} else {
		const groupRef = db.collection('groups').doc();
		groupId = groupRef.id;
		inviteCode = generateCode();
		await groupRef.set({
			name: groupName,
			ownerId: owner.uid,
			inviteCode,
			createdAt: FieldValue.serverTimestamp()
		});
		await db.collection('inviteCodes').doc(inviteCode).set({
			groupId,
			createdBy: owner.uid,
			createdAt: FieldValue.serverTimestamp()
		});
		await db
			.collection('groups')
			.doc(groupId)
			.collection('members')
			.doc(owner.uid)
			.set({
				role: 'owner',
				displayName: owner.displayName || owner.email,
				email: owner.email,
				joinedAt: FieldValue.serverTimestamp()
			});
		console.log(`Created group "${groupName}" (${groupId}), invite code ${inviteCode}`);
	}

	// Point the owner's profile at the group (merge to keep phoneNumber etc.).
	await db
		.collection('userProfiles')
		.doc(owner.uid)
		.set({ groupId, role: 'owner', updatedAt: FieldValue.serverTimestamp() }, { merge: true });

	// Copy the data.
	const itemsCopied = await copyCollection(
		db,
		db.collection('items'),
		db.collection('groups').doc(groupId).collection('items')
	);
	const txCopied = await copyCollection(
		db,
		db.collection('transactions'),
		db.collection('groups').doc(groupId).collection('transactions')
	);

	console.log('—'.repeat(48));
	console.log(`Copied ${itemsCopied} items and ${txCopied} transactions into group ${groupId}.`);
	console.log(`Invite code: ${inviteCode}`);
	console.log('Old top-level `items`/`transactions` were left intact as a backup.');
	console.log('Next: deploy the new rules (firebase deploy --only firestore:rules).');
	process.exit(0);
}

main().catch((error) => {
	console.error('Migration failed:', error);
	process.exit(1);
});
