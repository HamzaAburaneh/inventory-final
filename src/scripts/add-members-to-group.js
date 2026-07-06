// Admin helper: add existing auth users to a group as members, without them
// having to enter the invite code. Uses the Firebase ADMIN SDK (bypasses rules)
// and the same service-account key as migrate-to-groups.js.
//
// It locates the group the same way the migration does — by owner + name — then
// for each target user creates a `groups/{gid}/members/{uid}` row and points
// their `userProfiles/{uid}.groupId` at the group, so they see its inventory on
// next sign-in. Idempotent: users already in the group are skipped.
//
// Usage (from src/scripts, after `npm install`):
//   # add specific people:
//   node add-members-to-group.js --owner you@example.com --name "CNE Inventory" \
//     --emails "a@x.com,b@y.com" --key ./sa.json
//   # or add every other registered user:
//   node add-members-to-group.js --owner you@example.com --name "CNE Inventory" \
//     --all --key ./sa.json

import { readFileSync } from 'fs';
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

/**
 * Parse a small set of `--flag value` (and boolean `--flag`) arguments.
 * @param {string[]} argv - process.argv.slice(2)
 * @returns {Record<string, string|boolean>}
 */
function parseArgs(argv) {
	const out = {};
	for (let i = 0; i < argv.length; i++) {
		if (argv[i].startsWith('--')) {
			const key = argv[i].slice(2);
			const next = argv[i + 1];
			if (next && !next.startsWith('--')) {
				out[key] = next;
				i++;
			} else {
				out[key] = true;
			}
		}
	}
	return out;
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const ownerEmail = args.owner;
	const groupName = args.name || 'My Inventory';
	if (!ownerEmail) {
		console.error('Missing --owner <email>.');
		process.exit(1);
	}
	if (!args.all && !args.emails) {
		console.error('Provide --emails "a@x.com,b@y.com" or --all.');
		process.exit(1);
	}

	const credential = args.key
		? cert(JSON.parse(readFileSync(args.key, 'utf8')))
		: applicationDefault();
	initializeApp({ credential });
	const db = getFirestore();
	const auth = getAuth();

	const owner = await auth.getUserByEmail(ownerEmail);

	// Locate the group by owner + name (matches migrate-to-groups.js).
	const found = await db
		.collection('groups')
		.where('ownerId', '==', owner.uid)
		.where('name', '==', groupName)
		.limit(1)
		.get();
	if (found.empty) {
		console.error(`No group named "${groupName}" owned by ${ownerEmail}.`);
		process.exit(1);
	}
	const groupId = found.docs[0].id;
	const inviteCode = found.docs[0].data().inviteCode || null;
	console.log(`Group "${groupName}" (${groupId})`);

	// Resolve the target user records.
	let users;
	if (args.emails) {
		const emails = String(args.emails)
			.split(',')
			.map((e) => e.trim())
			.filter(Boolean);
		users = [];
		for (const email of emails) {
			try {
				users.push(await auth.getUserByEmail(email));
			} catch {
				console.warn(`  ! skipping ${email} — no such account`);
			}
		}
	} else {
		const list = await auth.listUsers(1000);
		users = list.users;
	}

	let added = 0;
	let skipped = 0;
	for (const user of users) {
		if (user.uid === owner.uid) continue; // owner is already a member
		const memberRef = db.collection('groups').doc(groupId).collection('members').doc(user.uid);
		if ((await memberRef.get()).exists) {
			console.log(`  = ${user.email} already a member`);
			skipped++;
			continue;
		}
		await memberRef.set({
			role: 'member',
			displayName: user.displayName || user.email,
			email: user.email,
			inviteCode,
			joinedAt: FieldValue.serverTimestamp()
		});
		await db
			.collection('userProfiles')
			.doc(user.uid)
			.set({ groupId, role: 'member', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
		console.log(`  + added ${user.email}`);
		added++;
	}

	console.log('—'.repeat(40));
	console.log(`Done. Added ${added}, skipped ${skipped}. They'll see the group on next sign-in.`);
	process.exit(0);
}

main().catch((error) => {
	console.error('Failed:', error);
	process.exit(1);
});
