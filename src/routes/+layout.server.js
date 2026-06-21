import { AUTH_HINT_COOKIE } from '../stores/authStore.js';

/**
 * Read the lightweight auth-hint cookie so the server can render the correct
 * navbar shell (signed-in routes + avatar, or the Login link) on the first
 * paint instead of always rendering logged-out and "popping" on hydration.
 *
 * This is a DISPLAY hint only — it is never trusted for authorization. Real auth
 * is enforced by Firebase tokens + Firestore rules on the client, and the value
 * is reconciled by `onAuthStateChanged` as soon as the client boots, so a stale
 * or tampered cookie only affects what the navbar shows for the first frame.
 *
 * @type {import('./$types').LayoutServerLoad}
 */
export function load({ cookies }) {
	const raw = cookies.get(AUTH_HINT_COOKIE);
	if (!raw) return { hintedUser: null };

	try {
		return { hintedUser: JSON.parse(raw) };
	} catch {
		return { hintedUser: null };
	}
}
