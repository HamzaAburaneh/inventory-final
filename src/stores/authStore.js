import { writable } from 'svelte/store';
import { auth, db } from '../firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

function createAuthStore() {
	const { subscribe, set, update } = writable(null);

	// Initialize Firebase auth listener
	function init() {
		onAuthStateChanged(auth, (firebaseUser) => {
			set(firebaseUser);
		});
	}

	async function login(email, password) {
		try {
			const userCredential = await signInWithEmailAndPassword(auth, email, password);
			set(userCredential.user);
		} catch (error) {
			console.error('Login error:', error);
			throw error;
		}
	}

	async function logout() {
		try {
			await signOut(auth);
			set(null);
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
				await setDoc(userProfileRef, {
					phoneNumber: phoneNumber,
					updatedAt: new Date()
				}, { merge: true });
			}
			
			// Update the store with the new display name
			set({ ...currentUser, displayName });
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
