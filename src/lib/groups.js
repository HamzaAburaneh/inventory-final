import {
	collection,
	deleteDoc,
	doc,
	getDoc,
	getDocs,
	serverTimestamp,
	setDoc,
	updateDoc,
	writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';

/**
 * @typedef {import('../types').Group} Group
 * @typedef {import('../types').GroupMember} GroupMember
 */

// Invite codes are a user-facing bearer token, so keep them short but
// unambiguous: no O/0/I/1 to avoid transcription mistakes.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

/**
 * Generate a random, unambiguous invite code.
 * @returns {string} A 6-character uppercase code.
 */
function generateCode() {
	const bytes = new Uint32Array(CODE_LENGTH);
	crypto.getRandomValues(bytes);
	let code = '';
	for (let i = 0; i < CODE_LENGTH; i++) {
		code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
	}
	return code;
}

/**
 * Allocate an invite code that isn't already taken, then return it. The code
 * doc maps the code to its group so an invitee can resolve it (see rules).
 * @param {string} groupId - The group the code grants access to.
 * @param {string} uid - The creator's uid (rules require createdBy == uid).
 * @returns {Promise<string>} The freshly reserved code.
 */
async function reserveCode(groupId, uid) {
	for (let attempt = 0; attempt < 8; attempt++) {
		const code = generateCode();
		const ref = doc(db, 'inviteCodes', code);
		const existing = await getDoc(ref);
		if (existing.exists()) continue;
		await setDoc(ref, { groupId, createdBy: uid, createdAt: serverTimestamp() });
		return code;
	}
	throw new Error('Could not allocate a unique invite code, please try again');
}

/**
 * Non-sensitive display fields captured from an auth user, so member lists can
 * be rendered without an admin lookup (the client SDK can't read other users).
 * @param {import('firebase/auth').User} user - The signed-in user.
 * @returns {{ displayName: string, email: string }}
 */
function memberIdentity(user) {
	return {
		displayName: user.displayName || user.email || 'Member',
		email: user.email || ''
	};
}

/**
 * Create a new group owned by the given user, reserve an invite code, add the
 * owner membership, and point the user's profile at the group.
 * @param {import('firebase/auth').User} user - The signed-in creator.
 * @param {string} name - Human-readable group name.
 * @returns {Promise<{ groupId: string, inviteCode: string }>}
 */
export async function createGroup(user, name) {
	if (!user) throw new Error('Must be signed in to create a group');
	const trimmed = (name || '').trim();
	if (!trimmed) throw new Error('Group name is required');

	// Reserve the group id and invite code first, then create the group document
	// with its code already set. The owner isn't a member yet at this point, and
	// the rules only allow updating a group once you're its owner-member — so a
	// separate update() here would be denied. Writing the code inline avoids it.
	const groupRef = doc(collection(db, 'groups'));
	const groupId = groupRef.id;

	const inviteCode = await reserveCode(groupId, user.uid);

	await setDoc(groupRef, {
		name: trimmed,
		ownerId: user.uid,
		inviteCode,
		createdAt: serverTimestamp()
	});

	await setDoc(doc(db, 'groups', groupId, 'members', user.uid), {
		role: 'owner',
		...memberIdentity(user),
		joinedAt: serverTimestamp()
	});

	await setDoc(
		doc(db, 'userProfiles', user.uid),
		{ groupId, role: 'owner', updatedAt: serverTimestamp() },
		{ merge: true }
	);

	return { groupId, inviteCode };
}

/**
 * Join an existing group by invite code: resolve the code to its group, add a
 * member row (validated by rules against the code), and update the profile.
 * @param {import('firebase/auth').User} user - The signed-in joiner.
 * @param {string} code - The invite code, case-insensitive.
 * @returns {Promise<{ groupId: string }>}
 */
export async function joinGroupByCode(user, code) {
	if (!user) throw new Error('Must be signed in to join a group');
	const normalized = (code || '').trim().toUpperCase();
	if (!normalized) throw new Error('Invite code is required');

	const codeSnap = await getDoc(doc(db, 'inviteCodes', normalized));
	if (!codeSnap.exists()) throw new Error('That invite code is not valid');
	const { groupId } = codeSnap.data();

	await setDoc(doc(db, 'groups', groupId, 'members', user.uid), {
		role: 'member',
		inviteCode: normalized,
		...memberIdentity(user),
		joinedAt: serverTimestamp()
	});

	await setDoc(
		doc(db, 'userProfiles', user.uid),
		{ groupId, role: 'member', updatedAt: serverTimestamp() },
		{ merge: true }
	);

	return { groupId };
}

/**
 * Read a group document.
 * @param {string} groupId - The group id.
 * @returns {Promise<(Group & { id: string }) | null>}
 */
export async function getGroup(groupId) {
	if (!groupId) return null;
	const snap = await getDoc(doc(db, 'groups', groupId));
	return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Confirm the user still holds a membership row in the group. A removed user
 * keeps a stale `profile.groupId` (we can't write their profile), so callers
 * use this to re-onboard them rather than hit permission-denied reads.
 * @param {string} groupId - The group id.
 * @param {string} uid - The user id.
 * @returns {Promise<boolean>}
 */
export async function isGroupMember(groupId, uid) {
	if (!groupId || !uid) return false;
	const snap = await getDoc(doc(db, 'groups', groupId, 'members', uid));
	return snap.exists();
}

/**
 * List the members of a group.
 * @param {string} groupId - The group id.
 * @returns {Promise<Array<GroupMember & { uid: string }>>}
 */
export async function listMembers(groupId) {
	const snapshot = await getDocs(collection(db, 'groups', groupId, 'members'));
	return snapshot.docs.map((d) => ({ uid: d.id, ...d.data() }));
}

/**
 * Remove a member from a group (owner only, enforced by rules).
 * @param {string} groupId - The group id.
 * @param {string} uid - The member to remove.
 * @returns {Promise<void>}
 */
export async function removeMember(groupId, uid) {
	await deleteDoc(doc(db, 'groups', groupId, 'members', uid));
}

/**
 * Leave a group: delete your own membership and clear your profile pointer.
 * @param {import('firebase/auth').User} user - The signed-in user.
 * @param {string} groupId - The group id.
 * @returns {Promise<void>}
 */
export async function leaveGroup(user, groupId) {
	const batch = writeBatch(db);
	batch.delete(doc(db, 'groups', groupId, 'members', user.uid));
	batch.set(
		doc(db, 'userProfiles', user.uid),
		{ groupId: null, role: null, updatedAt: serverTimestamp() },
		{ merge: true }
	);
	await batch.commit();
}

/**
 * Rotate a group's invite code: reserve a new one, point the group at it, and
 * delete the old code so it stops working (owner only).
 * @param {import('firebase/auth').User} user - The signed-in owner.
 * @param {string} groupId - The group id.
 * @param {string} [oldCode] - The current code to revoke, if known.
 * @returns {Promise<string>} The new invite code.
 */
export async function regenerateInviteCode(user, groupId, oldCode) {
	const inviteCode = await reserveCode(groupId, user.uid);
	await updateDoc(doc(db, 'groups', groupId), { inviteCode });
	if (oldCode && oldCode !== inviteCode) {
		await deleteDoc(doc(db, 'inviteCodes', oldCode)).catch(() => {});
	}
	return inviteCode;
}
