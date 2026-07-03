import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from 'dotenv';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { findClockAnomalies } from '../lib/transactionAudit.js';

// Audits the `transactions` collection for clock anomalies — entries whose
// device timestamp is implausible against the trusted server `syncedAt` clock
// (see src/lib/transactionAudit.js for the rules). Prints a report; makes NO
// writes.
//
// Run from this folder:  npm run audit-timestamps
// Requires (in the project-root .env, alongside the VITE_FIREBASE_* config):
//   AUDIT_EMAIL=you@example.com
//   AUDIT_PASSWORD=your-password
// A sign-in is needed because the Firestore rules require an authenticated user.

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '../../.env') });

const firebaseConfig = {
	apiKey: process.env.VITE_FIREBASE_API_KEY,
	authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
	projectId: process.env.VITE_FIREBASE_PROJECT_ID,
	storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
	messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
	appId: process.env.VITE_FIREBASE_APP_ID,
	measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID
};

const STALE_THRESHOLD_DAYS = Number(process.env.AUDIT_STALE_DAYS || '2');

/**
 * Formats a millisecond duration as a compact human string (e.g. "6d 4h").
 * @param {number} ms - Duration in milliseconds (absolute value used).
 * @returns {string} Human-readable duration.
 */
function humanizeDuration(ms) {
	const abs = Math.abs(ms);
	const days = Math.floor(abs / (24 * 60 * 60 * 1000));
	const hours = Math.floor((abs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
	const minutes = Math.floor((abs % (60 * 60 * 1000)) / (60 * 1000));
	if (days > 0) return `${days}d ${hours}h`;
	if (hours > 0) return `${hours}h ${minutes}m`;
	return `${minutes}m`;
}

async function main() {
	const email = process.env.AUDIT_EMAIL;
	const password = process.env.AUDIT_PASSWORD;
	if (!email || !password) {
		console.error(
			'Missing AUDIT_EMAIL / AUDIT_PASSWORD in .env — needed to read Firestore (auth-required rules).'
		);
		process.exit(1);
	}

	const app = initializeApp(firebaseConfig);
	const db = getFirestore(app);
	const auth = getAuth(app);

	await signInWithEmailAndPassword(auth, email, password);
	console.log(`Signed in as ${email}. Reading transactions…`);

	const snapshot = await getDocs(collection(db, 'transactions'));
	const transactions = snapshot.docs.map((doc) => {
		const data = doc.data();
		return {
			id: doc.id,
			...data,
			timestamp: data.timestamp ? data.timestamp.toDate() : null,
			syncedAt: data.syncedAt ? data.syncedAt.toDate() : null
		};
	});

	const auditable = transactions.filter((t) => t.timestamp && t.syncedAt);
	const anomalies = findClockAnomalies(transactions, {
		staleThresholdMs: STALE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000
	});

	console.log('');
	console.log(`Transactions:        ${transactions.length}`);
	console.log(`Auditable (have both timestamps): ${auditable.length}`);
	console.log(`  — the rest are legacy rows or offline writes not yet synced.`);
	console.log(`Anomalies flagged:   ${anomalies.length}\n`);

	if (anomalies.length === 0) {
		console.log('No clock anomalies found. ✅');
		process.exit(0);
	}

	for (const { transaction, kind, gapMs } of anomalies) {
		const verdict =
			kind === 'future'
				? 'FUTURE — timestamp is AFTER sync (impossible; clock set ahead)'
				: `STALE — recorded ${humanizeDuration(gapMs)} before it synced (review)`;
		console.log(`• ${transaction.id}  [${verdict}]`);
		console.log(`    item:      ${transaction.itemName} (${transaction.type})`);
		console.log(`    timestamp: ${transaction.timestamp.toISOString()}  (device clock)`);
		console.log(`    syncedAt:  ${transaction.syncedAt.toISOString()}  (server clock)`);
		console.log(`    user:      ${transaction.user}\n`);
	}

	process.exit(0);
}

main().catch((error) => {
	console.error('Audit failed:', error);
	process.exit(1);
});
