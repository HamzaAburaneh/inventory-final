import { planStockMerge, planMergedDrafts, snapshotKey } from './stockMerge.js';
import { findHistoricalTransferCandidates, annotateStockHistory } from './stockHistory.js';

const withId = (snapshot) => ({ ...snapshot.data(), id: snapshot.id });
function assertGroup(groupId) {
	if (!groupId || typeof groupId !== 'string' || groupId.includes('/'))
		throw new Error('Provide one explicit group ID.');
}

/** @param {object} db Admin Firestore instance. @param {string} groupId Single workspace. @returns {Promise<object>} Read-only inventory, draft and history report. */
export async function readStockMaintenanceSnapshot(db, groupId) {
	assertGroup(groupId);
	const base = db.collection('groups').doc(groupId);
	const [items, orders, transactions, reviews] = await Promise.all(
		['items', 'orders', 'transactions', 'stockHistoryReviews'].map((name) =>
			base.collection(name).get()
		)
	);
	return {
		groupId,
		capturedAt: new Date().toISOString(),
		items: items.docs.map(withId),
		orders: orders.docs.map(withId),
		transactions: transactions.docs.map((row) => ({
			...withId(row),
			timestamp: row.data().timestamp?.toDate()?.toISOString() ?? null
		})),
		reviews: reviews.docs.map(withId)
	};
}

/** @param {object} snapshot Read-only group snapshot. @param {object} manifest Proposed exact mappings. @returns {object} Validated review report, with no writes. */
export function planStockMaintenance(snapshot, manifest) {
	if (snapshot.groupId !== manifest.groupId)
		throw new Error('Manifest group does not match the selected workspace.');
	const catalog = [...snapshot.items];
	let drafts = [...snapshot.orders];
	const plans = [];
	for (const pair of manifest.pairs ?? []) {
		const kept = catalog.find((row) => row.id === pair.keptId);
		const duplicate = catalog.find((row) => row.id === pair.duplicateId);
		if (
			snapshotKey(kept) !== snapshotKey(pair.expectedKept) ||
			snapshotKey(duplicate) !== snapshotKey(pair.expectedDuplicate)
		)
			throw new Error(`Source state changed for ${pair.keptId}/${pair.duplicateId}.`);
		const plan = planStockMerge(
			kept,
			duplicate,
			{ ...pair, reviewer: manifest.reviewedBy },
			catalog
		);
		const updatedDrafts = planMergedDrafts(drafts, kept.id, duplicate.id, pair.draftResolutions);
		plans.push({ pair, ...plan, updatedDrafts });
		catalog.splice(
			catalog.findIndex((row) => row.id === duplicate.id),
			1
		);
		catalog[catalog.findIndex((row) => row.id === kept.id)] = plan.item;
		drafts = drafts.map((draft) => updatedDrafts.find((row) => row.id === draft.id) ?? draft);
	}
	const candidates = findHistoricalTransferCandidates(
		annotateStockHistory(snapshot.transactions, snapshot.reviews),
		manifest.historyLinks ?? []
	);
	return { groupId: snapshot.groupId, plans, candidates };
}

/** @param {object} db Admin Firestore. @param {object} manifest Approved scoped manifest. @param {function(object):Promise<void>} backup Persist private backup before any writes. @param {function():unknown} serverTimestamp Admin timestamp factory. @returns {Promise<object[]>} Per-pair completion, safe to retry with original IDs. */
export async function applyStockMaintenance(db, manifest, backup, serverTimestamp) {
	assertGroup(manifest.groupId);
	if (
		!manifest.reviewedBy ||
		manifest.approved !== true ||
		manifest.compatibleAppDeployed !== true ||
		manifest.oldClientsSynchronized !== true ||
		manifest.localPendingActionsCleared !== true
	)
		throw new Error(
			'Apply requires explicit mapping approval, compatible deployment and cleared old/local pending actions.'
		);
	const base = db.collection('groups').doc(manifest.groupId);
	const results = [];
	for (const pair of manifest.pairs ?? []) {
		if (!pair.operationId || pair.operationId.includes('/'))
			throw new Error('Each pair needs a stable operation ID.');
		const receiptRef = base.collection('stockOperations').doc(pair.operationId);
		const completed = await receiptRef.get();
		if (completed.exists) {
			if (completed.data().manifestKey !== snapshotKey(pair))
				throw new Error('Operation ID belongs to another mapping.');
			results.push({ operationId: pair.operationId, status: 'already-applied' });
			continue;
		}
		const snapshot = await readStockMaintenanceSnapshot(db, manifest.groupId);
		const report = planStockMaintenance(snapshot, { ...manifest, pairs: [pair] });
		await backup({ snapshot, manifest: { ...manifest, pairs: [pair] }, report });
		await db.runTransaction(async (transaction) => {
			const receipt = await transaction.get(receiptRef);
			if (receipt.exists) {
				if (receipt.data().manifestKey !== snapshotKey(pair))
					throw new Error('Operation ID belongs to another mapping.');
				return;
			}
			const items = await transaction.get(base.collection('items'));
			const orders = await transaction.get(base.collection('orders'));
			const current = {
				groupId: manifest.groupId,
				items: items.docs.map(withId),
				orders: orders.docs.map(withId),
				transactions: [],
				reviews: []
			};
			const plan = planStockMaintenance(current, { ...manifest, pairs: [pair] }).plans[0];
			if (plan.updatedDrafts.length + 5 > 450)
				throw new Error(
					'Too many affected drafts for one safe atomic merge; prepare a staged plan.'
				);
			const { id: _id, ...item } = plan.item;
			transaction.set(base.collection('items').doc(pair.keptId), item);
			transaction.delete(base.collection('items').doc(pair.duplicateId));
			for (const { id, ...record } of plan.records)
				transaction.set(base.collection('transactions').doc(id), {
					...record,
					timestamp: serverTimestamp(),
					syncedAt: serverTimestamp()
				});
			for (const { id, ...draft } of plan.updatedDrafts)
				transaction.set(base.collection('orders').doc(id), {
					...draft,
					updatedBy: manifest.reviewedBy,
					updatedAt: serverTimestamp()
				});
			transaction.set(receiptRef, {
				status: 'applied',
				kind: 'merge',
				manifestKey: snapshotKey(pair),
				appliedAt: serverTimestamp(),
				user: manifest.reviewedBy
			});
		});
		results.push({ operationId: pair.operationId, status: 'applied' });
	}
	return results;
}

/** @param {object} db Admin Firestore. @param {object} manifest Approved decisions with exact source rows and previous review. @param {function(object):Promise<void>} backup Private backup callback. @param {function():unknown} serverTimestamp Admin timestamp factory. @returns {Promise<void>} Audited, nonoverlapping review updates; original ledger remains unchanged. */
export async function applyHistoricalStockReviews(db, manifest, backup, serverTimestamp) {
	assertGroup(manifest.groupId);
	if (!manifest.approved || !manifest.reviewedBy)
		throw new Error('Historical review requires explicit approval and reviewer.');
	const base = db.collection('groups').doc(manifest.groupId);
	for (const decision of manifest.reviewDecisions ?? []) {
		if (
			!decision.id ||
			!decision.operationId ||
			decision.id.includes('/') ||
			decision.operationId.includes('/')
		)
			throw new Error('Review and audit IDs are required.');
		await backup({ groupId: manifest.groupId, decision });
		await db.runTransaction(async (transaction) => {
			const auditRef = base.collection('stockHistoryReviewAudit').doc(decision.operationId);
			const audit = await transaction.get(auditRef);
			if (audit.exists) {
				if (audit.data().decisionKey !== snapshotKey(decision))
					throw new Error('Audit ID reused for a different review.');
				return;
			}
			const reviews = (await transaction.get(base.collection('stockHistoryReviews'))).docs.map(
				withId
			);
			const previous = reviews.find((row) => row.id === decision.id) ?? null;
			if (snapshotKey(previous) !== snapshotKey(decision.expectedReview ?? null))
				throw new Error('Historical review changed.');
			const sources = [];
			if (
				!Array.isArray(decision.transactionIds) ||
				decision.transactionIds.length !== 2 ||
				new Set(decision.transactionIds).size !== 2
			)
				throw new Error('Review requires two different ledger IDs.');
			for (const id of decision.transactionIds) {
				const row = await transaction.get(base.collection('transactions').doc(id));
				if (!row.exists) throw new Error('Historical source no longer exists.');
				sources.push(withId(row));
			}
			if (snapshotKey(sources) !== snapshotKey(decision.expectedTransactions))
				throw new Error('Historical source data changed.');
			if (decision.confirmed) {
				const candidates = findHistoricalTransferCandidates(
					sources.map((row) => ({ ...row, timestamp: row.timestamp.toDate() })),
					manifest.historyLinks ?? []
				);
				if (
					!candidates.some(
						(row) => snapshotKey(row.transactionIds) === snapshotKey(decision.transactionIds)
					)
				)
					throw new Error('Review is not an explicitly linked, valid transfer candidate.');
			}
			const next = {
				id: decision.id,
				transactionIds: decision.transactionIds,
				confirmed: decision.confirmed === true,
				reviewer: manifest.reviewedBy,
				reviewedAt: serverTimestamp()
			};
			annotateStockHistory([], [...reviews.filter((row) => row.id !== next.id), next]);
			transaction.set(base.collection('stockHistoryReviews').doc(next.id), next);
			transaction.set(auditRef, {
				decisionKey: snapshotKey(decision),
				previous,
				next,
				timestamp: serverTimestamp(),
				reviewer: manifest.reviewedBy
			});
		});
	}
}
