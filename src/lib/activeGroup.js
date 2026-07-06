// The signed-in user's current group id, held as a module singleton so the
// data layer (items.js, transactions.js, transactionAnalysis.js) can scope
// every Firestore path to `groups/{gid}/…` without threading the id through
// every call. Set by the group store once auth + profile resolve; cleared on
// logout. One group per user (see AGENTS.md), so a single value is enough.

let activeGroupId = null;

/**
 * Set (or clear) the active group id.
 * @param {string | null} groupId - The group id, or null when signed out.
 */
export function setActiveGroupId(groupId) {
	activeGroupId = groupId || null;
}

/**
 * Get the active group id, or null if none is set yet.
 * @returns {string | null}
 */
export function getActiveGroupId() {
	return activeGroupId;
}

/**
 * Get the active group id, throwing if none is set. Use in write paths where a
 * missing group is a programming error (the route guard should have redirected
 * a group-less user to onboarding before any mutation is possible).
 * @returns {string} The active group id.
 */
export function requireActiveGroupId() {
	if (!activeGroupId) {
		throw new Error('No active group — the user is not a member of any group');
	}
	return activeGroupId;
}
