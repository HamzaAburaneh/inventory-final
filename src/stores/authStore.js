import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { auth, db } from '../firebase';
import {
	onAuthStateChanged,
	signInWithEmailAndPassword,
	signOut,
	updateProfile
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

// Becomes true after Firebase reports the initial auth state (logged in or out).
// Route guards must wait for this so a logged-in user isn't bounced to /login
// during the brief window before onAuthStateChanged first fires on a hard load.
export const authReady = writable(false);

// Name of the lightweight UI-hint cookie. Firebase's session lives in the
// browser (IndexedDB), which the server can't read, so the server would always
// render a logged-out navbar and "pop" to the real state on hydration (the
// refresh flash). We mirror the signed-in user into this cookie so the SSR load
// (src/routes/+layout.server.js) can render the correct navbar shell on the
// first paint. It is a display hint ONLY — never used for authorization, which
// is still enforced by Firebase tokens + Firestore rules — so it holds only
// non-sensitive display fields and carries no credentials.
export const AUTH_HINT_COOKIE = 'ss_auth_hint';

// Mirror (or clear) the signed-in user into the hint cookie. Passing null clears
// it. Set client-side via document.cookie; SameSite=Lax, ~30 day lifetime.
function writeAuthHint(user) {
	if (!browser) return;
	if (user) {
		const hint = encodeURIComponent(
			JSON.stringify({
				uid: user.uid,
				email: user.email,
				displayName: user.displayName,
				photoURL: user.photoURL ?? null
			})
		);
		document.cookie = `${AUTH_HINT_COOKIE}=${hint}; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax`;
	} else {
		document.cookie = `${AUTH_HINT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
	}
}

function createAuthStore() {
	const { subscribe, set } = writable(null);

	// Guard so the auth listener is registered exactly once, even if init() is
	// called again (HMR, a remount, or a second importer). A duplicate listener
	// would otherwise race to set the store and flip authReady prematurely.
	let unsubscribe = null;

	// Register the Firebase auth listener. The navbar renders from the SSR hint
	// cookie until this fires (see +layout.svelte), so the UI is correct on the
	// first paint; this then confirms or corrects it once Firebase restores the
	// persisted session (browserLocalPersistence by default — survives refresh
	// and browser restart) and flips authReady so route guards know the real
	// state. A stale hint (e.g. signed out in another tab) self-corrects the
	// moment this fires, and the cookie is rewritten to match.
	function init() {
		if (unsubscribe) return;
		unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
			set(firebaseUser);
			writeAuthHint(firebaseUser);
			authReady.set(true);
		});
	}

	async function login(email, password) {
		try {
			const userCredential = await signInWithEmailAndPassword(auth, email, password);
			set(userCredential.user);
			writeAuthHint(userCredential.user);
		} catch (error) {
			console.error('Login error:', error);
			throw error;
		}
	}

	async function logout() {
		try {
			await signOut(auth);
			set(null);
			writeAuthHint(null);
		} catch (error) {
			console.error('Logout error:', error);
			throw error;
		}
	}

	async function updateUserProfile(displayName, phoneNumber) {
		const currentUser = auth.currentUser;
		if (!currentUser) throw new Error('No user logged in');

		try {
			// Update display name in Firebase Auth
			await updateProfile(currentUser, { displayName });

			// Update phone number in Firestore
			if (phoneNumber !== undefined) {
				const userProfileRef = doc(db, 'userProfiles', currentUser.uid);
				await setDoc(
					userProfileRef,
					{
						phoneNumber: phoneNumber,
						updatedAt: new Date()
					},
					{ merge: true }
				);
			}

			// Update the store with the new display name
			set({ ...currentUser, displayName });
			writeAuthHint({ ...currentUser, displayName });
		} catch (error) {
			console.error('Profile update error:', error);
			throw error;
		}
	}

	return {
		subscribe,
		login,
		logout,
		updateProfile: updateUserProfile,
		init
	};
}

export const authStore = createAuthStore();
