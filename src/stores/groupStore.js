import { writable } from 'svelte/store';
import { doc, getDoc } from 'firebase/firestore';
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

function createGroupStore() {
	/** @type {import('svelte/store').Writable<GroupState>} */
	const store = writable({ status: 'loading', groupId: null, role: null });
	const { subscribe, set } = store;

	/**
	 * Resolve the given user's group from their profile, verifying they still
	 * hold a membership row (a removed user keeps a stale profile pointer).
	 * @param {import('firebase/auth').User | null} user - The signed-in user.
	 */
	async function resolve(user) {
		if (!user) {
			setActiveGroupId(null);
			set({ status: 'none', groupId: null, role: null });
			return;
		}
		set({ status: 'loading', groupId: null, role: null });
		try {
			const profileSnap = await getDoc(doc(db, 'userProfiles', user.uid));
			const groupId = profileSnap.exists() ? profileSnap.data().groupId : null;
			const role = profileSnap.exists() ? profileSnap.data().role : null;

			if (groupId && (await isGroupMember(groupId, user.uid))) {
				setActiveGroupId(groupId);
				set({ status: 'ready', groupId, role: role || 'member' });
			} else {
				setActiveGroupId(null);
				set({ status: 'none', groupId: null, role: null });
			}
		} catch (error) {
			console.error('Failed to resolve group membership:', error);
			setActiveGroupId(null);
			set({ status: 'none', groupId: null, role: null });
		}
	}

	/**
	 * Apply a group id locally after create/join, without a round-trip.
	 * @param {string} groupId - The joined/created group id.
	 * @param {string} role - The user's role in it.
	 */
	function applyGroup(groupId, role) {
		setActiveGroupId(groupId);
		set({ status: 'ready', groupId, role });
	}

	function clear() {
		setActiveGroupId(null);
		set({ status: 'none', groupId: null, role: null });
	}

	return { subscribe, resolve, applyGroup, clear };
}

export const groupStore = createGroupStore();
