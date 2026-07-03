import { writable } from 'svelte/store';

// Count of offline writes that have been queued locally but not yet
// acknowledged by the Firestore backend. The offline write paths in items.js
// call markQueued() when they hand a batch to Firestore's offline queue, and
// markSynced() when that batch's commit promise finally resolves on reconnect.
// The offline indicator subscribes to this to show "N changes queued".
//
// Best-effort per session: a page reload while offline resets this counter,
// though Firestore still holds (and will sync) the pending writes from its
// IndexedDB cache.
export const queuedWrites = writable(0);

/**
 * Records that an offline write has been queued.
 * @returns {void}
 */
export function markQueued() {
	queuedWrites.update((n) => n + 1);
}

/**
 * Records that a previously queued write has synced to the backend.
 * @returns {void}
 */
export function markSynced() {
	queuedWrites.update((n) => Math.max(0, n - 1));
}
