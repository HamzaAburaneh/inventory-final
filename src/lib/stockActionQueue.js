import { writable } from 'svelte/store';
import { auth } from '../firebase';
import { requireActiveGroupId } from './activeGroup';
import { accessStockQueue } from './stockQueueStorage.js';
import { applyStockAction, readStockItem, assertStockScope } from './stockActionTransport.js';
import { planStockAction } from './stockOperations.js';
import { stockFingerprint } from './stockLocations.js';

export const stockQueueState = writable({ ready: false, actions: [], error: null });
let scope = null;
let channel;
let draining = false;
let timer;
let replayError = null;
const online = () => typeof navigator === 'undefined' || navigator.onLine !== false;
const matches = (action, current) =>
	current && action.uid === current.uid && action.groupId === current.groupId;

async function withReplayLock(current, callback) {
	if (!globalThis.navigator?.locks)
		throw new Error(
			'This browser cannot safely coordinate stock changes across tabs. Use a current browser.'
		);
	return navigator.locks.request(`stocksense-replay:${current.uid}:${current.groupId}`, callback);
}

async function refresh() {
	const current = scope;
	try {
		const rows = await accessStockQueue();
		if (scope === current)
			stockQueueState.set({
				ready: true,
				actions: rows.filter((action) => matches(action, current)),
				error: replayError
			});
	} catch (error) {
		if (scope === current) stockQueueState.set({ ready: false, actions: [], error: error.message });
	}
}

async function change(id, update) {
	await accessStockQueue((rows, store) => {
		const action = rows.find((row) => row.id === id && matches(row, scope));
		if (!action) return;
		if (update === null) store.delete(action.sequence);
		else store.put({ ...action, ...update });
	}, true);
	channel?.postMessage('changed');
	await refresh();
}

async function findAction(id) {
	const action = (await accessStockQueue()).find((row) => row.id === id && matches(row, scope));
	if (!action) throw new Error('This pending action is no longer available in this workspace.');
	assertStockScope(action);
	return action;
}

/** @param {string|null} uid Authenticated user. @param {string|null} groupId Active group. @returns {function():void} Stop this session's replay, preserving stored actions. */
export function startStockQueue(uid, groupId) {
	const current = uid && groupId ? { uid, groupId } : null;
	scope = current;
	clearInterval(timer);
	channel?.close();
	channel =
		typeof BroadcastChannel !== 'undefined' && current
			? new BroadcastChannel('stocksense-stock-actions')
			: null;
	if (channel)
		channel.onmessage = () => {
			refresh();
			drainStockQueue();
		};
	const resume = () => {
		refresh();
		drainStockQueue();
	};
	globalThis.addEventListener?.('online', resume);
	if (current) {
		resume();
		timer = setInterval(resume, 15000);
	} else stockQueueState.set({ ready: true, actions: [], error: null });
	return () => {
		globalThis.removeEventListener?.('online', resume);
		if (scope !== current) return;
		scope = null;
		clearInterval(timer);
		channel?.close();
		channel = null;
		stockQueueState.set({ ready: true, actions: [], error: null });
	};
}

/** @returns {Promise<void>} Replay ordered durable actions in the active session. */
export async function drainStockQueue() {
	if (draining || !scope || !online()) return;
	draining = true;
	const current = scope;
	replayError = null;
	try {
		await withReplayLock(current, async () => {
			const blocked = new Set();
			for (const row of await accessStockQueue()) {
				if (scope !== current || !online()) break;
				if (!matches(row, current) || blocked.has(row.itemId)) continue;
				const latest = (await accessStockQueue()).find((entry) => entry.id === row.id);
				if (!latest) continue;
				if (latest.status === 'attention') {
					blocked.add(latest.itemId);
					continue;
				}
				try {
					await change(latest.id, { status: 'syncing', error: null });
					await applyStockAction(latest);
					await change(latest.id, null);
				} catch (error) {
					if (scope !== current) break;
					const unavailable =
						!online() || ['unavailable', 'deadline-exceeded', 'aborted'].includes(error.code);
					await change(latest.id, {
						status: unavailable ? 'queued' : 'attention',
						error: error.message
					});
					blocked.add(latest.itemId);
					if (unavailable) break;
				}
			}
		});
	} catch (error) {
		if (scope === current) replayError = error.message;
	} finally {
		draining = false;
		await refresh();
	}
}

/** @param {object} details Action fields. @returns {Promise<object>} Applied/queued/attention outcome. */
export async function enqueueStockAction(details) {
	if (!globalThis.navigator?.locks)
		throw new Error(
			'Use a current browser that supports safe stock synchronization across tabs. No action was saved.'
		);
	const uid = auth.currentUser?.uid;
	const groupId = requireActiveGroupId();
	if (!uid) throw new Error('Sign in before changing stock.');
	if (!matches({ uid, groupId }, scope)) startStockQueue(uid, groupId);
	const action = {
		...details,
		id: crypto.randomUUID(),
		uid,
		groupId,
		createdAt: Date.now(),
		status: 'queued',
		error: null
	};
	const pendingCreation = (await accessStockQueue()).some(
		(row) => matches(row, action) && row.itemId === action.itemId && row.kind === 'create'
	);
	const base = details.kind === 'create' || pendingCreation ? null : await readStockItem(action);
	assertStockScope(action);
	await accessStockQueue((rows, store) => {
		const previous = rows.filter((row) => matches(row, action) && row.itemId === action.itemId);
		let projected = base;
		// A snapshot may already contain an acknowledged operation still present locally.
		const appliedIndex = previous.findIndex((row) => row.id === base?.stockRevision);
		for (const pending of previous.slice(appliedIndex + 1)) {
			if (pending.status === 'attention')
				throw new Error('Resolve the earlier action on this item first.');
			if (!pending.cancelRequested) projected = planStockAction(projected, pending).item;
		}
		action.itemName = projected?.name ?? action.item?.name ?? action.itemId;
		action.predecessorId = previous.at(-1)?.id ?? null;
		if (['set', 'reset', 'delete'].includes(action.kind)) {
			action.expectedStock = stockFingerprint(projected);
			if (details.reviewedStock && details.reviewedStock !== action.expectedStock)
				throw new Error('Stock or pending actions changed. Review again before confirming.');
		}
		planStockAction(projected, action);
		store.add(action);
	}, true);
	channel?.postMessage('changed');
	await refresh();
	await drainStockQueue();
	const pending = (await accessStockQueue()).find((row) => row.id === action.id);
	return {
		id: action.itemId,
		operationId: action.id,
		status: pending ? (pending.status === 'attention' ? 'attention' : 'queued') : 'applied',
		error: pending?.error
	};
}

/** @param {string} id Pending ID. @returns {Promise<void>} Retry with the same deduplication ID. */
export async function retryStockAction(id) {
	await findAction(id);
	await change(id, { status: 'queued', error: null });
	await drainStockQueue();
}

/** @returns {Promise<object[]>} Durable actions belonging to the current authenticated workspace only. */
export async function getPendingStockActions() {
	const current = { uid: auth.currentUser?.uid, groupId: requireActiveGroupId() };
	return (await accessStockQueue()).filter((action) => matches(action, current));
}

/** @param {string} id Pending ID. @returns {Promise<void>} Request cancellation; server receipt decides if already applied. */
export async function cancelStockAction(id) {
	await findAction(id);
	await change(id, {
		cancelRequested: true,
		status: 'queued',
		error: 'Cancellation pending server confirmation.'
	});
	await drainStockQueue();
}

/** @param {string} id Pending ID. @returns {Promise<object>} Fresh stock for a concrete confirmation. */
export async function prepareStockActionReconfirmation(id) {
	const action = await findAction(id);
	if (!['set', 'reset', 'delete'].includes(action.kind))
		throw new Error('This action needs retry or cancellation.');
	const item = await readStockItem(action, true);
	if (!item) throw new Error('This item no longer exists. Cancel the action.');
	return { action, item, expectedRevision: stockFingerprint(item) };
}

/** @param {string} id Pending ID. @param {string} expectedRevision Reviewed stock fingerprint. @returns {Promise<object>} A new confirmed operation. */
export async function reconfirmStockAction(id, expectedRevision) {
	const action = await findAction(id);
	return withReplayLock(action, async () => {
		const item = await readStockItem(action, true);
		if (stockFingerprint(item) !== expectedRevision)
			throw new Error('Stock changed again. Review the latest balance before confirming.');
		const canceled = await applyStockAction({ ...action, cancelRequested: true });
		if (canceled.status === 'applied') {
			await change(id, null);
			return { status: 'applied' };
		}
		const replacement = {
			...action,
			id: crypto.randomUUID(),
			createdAt: Date.now(),
			predecessorId: action.id,
			expectedStock: expectedRevision,
			cancelRequested: false,
			status: 'queued',
			error: null
		};
		planStockAction(item, replacement);
		assertStockScope(action);
		await accessStockQueue((rows, store) => {
			const original = rows.find((row) => row.id === id);
			if (!original) throw new Error('The action changed during review.');
			store.put({ ...replacement, sequence: original.sequence });
			for (const next of rows.filter((row) => matches(row, action) && row.predecessorId === id))
				store.put({ ...next, predecessorId: replacement.id });
		}, true);
		channel?.postMessage('changed');
		await refresh();
		// Keep this operation in the original position. Later absolute intentions retain
		// their old fingerprints and require their own confirmation if now invalid.
		setTimeout(() => drainStockQueue(), 0);
		return { status: 'queued', operationId: replacement.id };
	});
}
