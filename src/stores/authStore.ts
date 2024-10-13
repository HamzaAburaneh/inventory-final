import { writable } from 'svelte/store';
import { auth } from '../firebase';
import { signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';

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
		}
	};
}

export const authStore = createAuthStore();
