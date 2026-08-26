import { writable } from 'svelte/store';
import { doc, getDoc } from 'firebase/firestore';
import { browser } from '$app/environment';
import { db } from '../firebase';
import { isGroupMember } from '../lib/groups';
import { setActiveGroupId } from '../lib/activeGroup';

/**
 * Reactive view of the signed-in user's group membership.
 *
 *   status: 'loading' — resolving the user's group
 *           'none'    — signed in but not a member of any group (onboard)
 *           'ready'   — member of `groupId` with `role`
 *
 * Kept in sync with the `activeGroup` singleton so the data layer and the UI
 * always agree on which group is active.
 * @typedef {{ status: 'loading' | 'none' | 'ready', groupId: string | null, role: string | null }} GroupState
 */

// Protected pages don't mount until this store reports 'ready' (see
// +layout.svelte), and resolving from scratch costs two SERIAL Firestore reads:
// the profile doc, then the membership doc keyed by the groupId the first one
// returns. That's two round trips in front of every page's own query before it
// can even be issued. Caching the last resolved answer lets a repeat visit mount
// immediately and revalidate in the background.
//
// This is a latency hint, not an authorization decision — exactly like the auth
// hint cookie. Firestore rules enforce access server-side, so a stale or
// tampered value can only produce a failed query, never data the user may not
// read. Keyed by uid so one account can never inherit another's group.
const CACHE_KEY = 'ss_active_group';

/**
 * Read the cached membership for a uid, or null if absent/stale/unparseable.
 * @param {string} uid - The signed-in user's uid.
 * @returns {{ groupId: string, role: string } | null} The cached membership.
 */
function readCache(uid) {
	if (!browser) return null;
	try {
		const raw = localStorage.getItem(CACHE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw);
		if (!parsed || parsed.uid !== uid || !parsed.groupId) return null;
		return { groupId: parsed.groupId, role: parsed.role || 'member' };
	} catch {
		return null;
	}
}

/**
 * Cache (or clear) the resolved membership for a uid.
 * @param {string | null} uid - The user's uid, or null to clear.
 * @param {string} [groupId] - The resolved group id.
 * @param {string} [role] - The user's role in that group.
 */
function writeCache(uid, groupId, role) {
	if (!browser) return;
	try {
		if (uid && groupId) {
			localStorage.setItem(CACHE_KEY, JSON.stringify({ uid, groupId, role: role || 'member' }));
		} else {
			localStorage.removeItem(CACHE_KEY);
		}
	} catch {
		// A full or disabled localStorage only costs us the fast path.
	}
}

function createGroupStore() {
	/** @type {import('svelte/store').Writable<GroupState>} */
	const store = writable({ status: 'loading', groupId: null, role: null });
	const { subscribe, set } = store;

	/**
	 * Resolve the given user's group from their profile, verifying they still
	 * hold a membership row (a removed user keeps a stale profile pointer).
	 *
	 * When a cached answer exists for this uid the store reports 'ready'
	 * immediately so the page can mount and issue its own query, and the two
	 * reads below run as a background revalidation that corrects the state if the
	 * membership has since changed.
	 * @param {import('firebase/auth').User | null} user - The signed-in user.
	 */
	async function resolve(user) {
		if (!user) {
			setActiveGroupId(null);
			writeCache(null);
			set({ status: 'none', groupId: null, role: null });
			return;
		}

		const cached = readCache(user.uid);
		if (cached) {
			setActiveGroupId(cached.groupId);
			set({ status: 'ready', groupId: cached.groupId, role: cached.role });
		} else {
			set({ status: 'loading', groupId: null, role: null });
		}

		try {
			const profileSnap = await getDoc(doc(db, 'userProfiles', user.uid));
			const groupId = profileSnap.exists() ? profileSnap.data().groupId : null;
			const role = profileSnap.exists() ? profileSnap.data().role : null;

			if (groupId && (await isGroupMember(groupId, user.uid))) {
				setActiveGroupId(groupId);
				writeCache(user.uid, groupId, role || 'member');
				set({ status: 'ready', groupId, role: role || 'member' });
			} else {
				setActiveGroupId(null);
				writeCache(null);
				set({ status: 'none', groupId: null, role: null });
			}
		} catch (error) {
			console.error('Failed to resolve group membership:', error);
			// Offline (or a transient failure) is not proof the membership is gone.
			// If we already served a cached group, keep it — dropping to 'none' here
			// would bounce an offline member to onboarding and break the offline-first
			// path. With no cache to fall back on there's nothing to do but onboard.
			if (!cached) {
				setActiveGroupId(null);
				set({ status: 'none', groupId: null, role: null });
			}
		}
	}

	/**
	 * Apply a group id locally after create/join, without a round-trip.
	 * @param {string} groupId - The joined/created group id.
	 * @param {string} role - The user's role in it.
	 * @param {string} [uid] - The user's uid, so the fast path is primed next load.
	 */
	function applyGroup(groupId, role, uid) {
		setActiveGroupId(groupId);
		if (uid) writeCache(uid, groupId, role);
		set({ status: 'ready', groupId, role });
	}

	function clear() {
		setActiveGroupId(null);
		writeCache(null);
		set({ status: 'none', groupId: null, role: null });
	}

	return { subscribe, resolve, applyGroup, clear };
}

export const groupStore = createGroupStore();
