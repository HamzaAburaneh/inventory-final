// Admin credentials come from Application Default Credentials, never browser sessions.
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, relative, isAbsolute, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { snapshotKey } from '../lib/stockMerge.js';
import {
	readStockMaintenanceSnapshot,
	planStockMaintenance,
	applyStockMaintenance,
	applyHistoricalStockReviews
} from '../lib/stockMaintenance.js';

const args = process.argv.slice(2);
const value = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
const groupId = value('--group');
const manifestPath = value('--manifest');
const apply = args.includes('--apply');
const output = value('--out');
const projectId = value('--project');
if (!groupId || !projectId || !output || (apply && !manifestPath))
	throw new Error(
		'Usage: node src/scripts/stock-locations.js --project PROJECT --group GROUP --out PRIVATE_REPORT.json [--manifest APPROVED.json] [--apply]'
	);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
function privatePath(path) {
	const target = resolve(path);
	for (const publicFolder of ['static', 'build', '.svelte-kit']) {
		const child = relative(resolve(root, publicFolder), target);
		if (!child.startsWith('..') && !isAbsolute(child))
			throw new Error('Reports and backups must stay outside publicly served/generated folders.');
	}
	return target;
}
const reportPath = privatePath(output);
const app = initializeApp({ projectId, credential: applicationDefault() });
const db = getFirestore(app);
const manifest = manifestPath
	? JSON.parse(await readFile(manifestPath, 'utf8'))
	: { groupId, approved: false, pairs: [], historyLinks: [], reviewDecisions: [] };
if (manifest.groupId !== groupId) throw new Error('Manifest and command group differ.');
const snapshot = await readStockMaintenanceSnapshot(db, groupId);
let report;
const backup = async (data) => {
	const backupDirectory = privatePath(
		value('--backup-dir') ?? resolve(root, '.private-stock-maintenance')
	);
	await mkdir(backupDirectory, { recursive: true });
	await writeFile(
		resolve(backupDirectory, `${Date.now()}-${randomUUID()}.json`),
		JSON.stringify(JSON.parse(snapshotKey(data)), null, 2),
		{ flag: 'wx' }
	);
};
if (apply) {
	const results = await applyStockMaintenance(db, manifest, backup, FieldValue.serverTimestamp);
	await applyHistoricalStockReviews(db, manifest, backup, FieldValue.serverTimestamp);
	report = { groupId, mode: 'apply', results };
} else {
	report = { mode: 'dry-run', snapshot, manifest, ...planStockMaintenance(snapshot, manifest) };
}
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, JSON.stringify(JSON.parse(snapshotKey(report)), null, 2), {
	flag: 'wx'
});
console.log(`Saved ${apply ? 'completion' : 'read-only'} report to ${reportPath}`);
