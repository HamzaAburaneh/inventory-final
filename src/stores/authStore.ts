import { writable } from 'svelte/store';
import { auth } from '../firebase';
import { signInWithEmailAndPassword, signOut, updateProfile, type User } from 'firebase/auth';
import { doc, setDoc, getFirestore } from 'firebase/firestore';

const db = getFirestore();

function createAuthStore() {
	const { subscribe, set } = writable<User | null>(null);

	return {
		subscribe,
		login: async (email: string, password: string) => {
			try {
				const userCredential = await signInWithEmailAndPassword(auth, email, password);
				set(userCredential.user);
			} catch (error) {
				console.error('Error logging in:', error);
				throw error;
			}
		},
		logout: async () => {
			try {
				await signOut(auth);
				set(null);
			} catch (error) {
				console.error('Error logging out:', error);
				throw error;
			}
		},
		init: () => {
			auth.onAuthStateChanged((user) => {
				set(user);
			});
		},
		updateProfile: async (displayName: string, phoneNumber: string) => {
			const user = auth.currentUser;
			if (user) {
				try {
					await updateProfile(user, { displayName });
					// Store phone number in Firestore
					await setDoc(doc(db, 'userProfiles', user.uid), { phoneNumber }, { merge: true });
					set(auth.currentUser);
				} catch (error) {
					console.error('Error updating profile:', error);
					throw error;
				}
			} else {
				throw new Error('No user is currently logged in');
			}
		}
	};
}

export const authStore = createAuthStore();
