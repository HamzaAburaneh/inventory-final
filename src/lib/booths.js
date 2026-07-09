import {
	collection,
	deleteDoc,
	doc,
	getDoc,
	getDocs,
	serverTimestamp,
	setDoc,
	updateDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { requireActiveGroupId } from './activeGroup';

/**
 * @typedef {import('../types').Booth} Booth
 */

// Fixed, accessible swatch palette booths are chosen from — white text reads
// cleanly on all of these, so a saved booth never needs a per-color contrast
// check. The first 6 match the app's legacy hardcoded booth colors, so groups
// seeded from that data (see src/scripts/seed-booths-from-items.js) keep their
// familiar look.
export const BOOTH_PALETTE = [
	'#10B981', // green
	'#3B82F6', // blue
	'#8B5CF6', // purple
	'#F59E0B', // amber
	'#EF4444', // red
	'#6B7280', // gray
	'#EC4899', // pink
	'#14B8A6', // teal
	'#F97316', // orange
	'#6366F1' // indigo
];

// ————————————————————————————————————————————————————————————————————————
// Group-scoped path helpers (mirrors items.js / groups.js)
// ————————————————————————————————————————————————————————————————————————

/** @returns {import('firebase/firestore').CollectionReference} The active group's booths collection. */
function boothsCol() {
	return collection(db, 'groups', requireActiveGroupId(), 'booths');
}

/**
 * @param {string} id - Booth id.
 * @returns {import('firebase/firestore').DocumentReference} The booth doc in the active group.
 */
function boothDoc(id) {
	return doc(db, 'groups', requireActiveGroupId(), 'booths', id);
}

/**
 * Turn a booth label into a stable, url/doc-id-safe slug: lowercase, runs of
 * non-alphanumerics collapsed to a single hyphen, no leading/trailing hyphen.
 * @param {string} label - The human-entered booth name.
 * @returns {string} The slug (may be empty if label has no alphanumerics).
 */
export function slugify(label) {
	return (label || '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

/**
 * List a group's booths, sorted by label.
 * @returns {Promise<Array<Booth & { id: string }>>}
 */
export async function listBooths() {
	const snapshot = await getDocs(boothsCol());
	return snapshot.docs
		.map((d) => ({ id: d.id, ...d.data() }))
		.sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Add a new booth. The id is slugified from the label; if that slug is
 * already taken, `-2`, `-3`, … is appended until one is free.
 * @param {string} label - Display name.
 * @param {string} color - Hex color, expected to be one of BOOTH_PALETTE.
 * @returns {Promise<Booth & { id: string }>}
 */
export async function addBooth(label, color) {
	const trimmed = (label || '').trim();
	if (!trimmed) throw new Error('Booth name is required');

	const base = slugify(trimmed) || 'booth';
	let id = base;
	for (let suffix = 2; await getDoc(boothDoc(id)).then((snap) => snap.exists()); suffix++) {
		id = `${base}-${suffix}`;
	}

	const booth = { label: trimmed, color, createdAt: serverTimestamp() };
	await setDoc(boothDoc(id), booth);
	return { id, ...booth };
}

/**
 * Rename a booth. The id/slug is never changed, so existing items' `booths`
 * tags keep resolving to this doc.
 * @param {string} id - Booth id.
 * @param {string} label - New display name.
 * @returns {Promise<void>}
 */
export async function renameBooth(id, label) {
	const trimmed = (label || '').trim();
	if (!trimmed) throw new Error('Booth name is required');
	await updateDoc(boothDoc(id), { label: trimmed });
}

/**
 * Change a booth's color.
 * @param {string} id - Booth id.
 * @param {string} color - Hex color, expected to be one of BOOTH_PALETTE.
 * @returns {Promise<void>}
 */
export async function setBoothColor(id, color) {
	await updateDoc(boothDoc(id), { color });
}

/**
 * Delete a booth. Items still tagged with this id are left untouched — they
 * render as an "unmanaged" tag (see tableUtils.js's fallback styling) rather
 * than being silently stripped.
 * @param {string} id - Booth id.
 * @returns {Promise<void>}
 */
export async function deleteBooth(id) {
	await deleteDoc(boothDoc(id));
}
