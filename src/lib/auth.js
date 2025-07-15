import { auth } from '../firebase';
import { 
	signInWithEmailAndPassword, 
	createUserWithEmailAndPassword, 
	signOut, 
	updateProfile,
	sendPasswordResetEmail,
	onAuthStateChanged
} from 'firebase/auth';

export async function login(email, password) {
	try {
		const userCredential = await signInWithEmailAndPassword(auth, email, password);
		return userCredential.user;
	} catch (error) {
		console.error('Login error:', error);
		throw error;
	}
}

export async function register(email, password, displayName) {
	try {
		const userCredential = await createUserWithEmailAndPassword(auth, email, password);
		
		if (displayName) {
			await updateProfile(userCredential.user, { displayName });
		}
		
		return userCredential.user;
	} catch (error) {
		console.error('Registration error:', error);
		throw error;
	}
}

export async function logout() {
	try {
		await signOut(auth);
	} catch (error) {
		console.error('Logout error:', error);
		throw error;
	}
}

export async function resetPassword(email) {
	try {
		await sendPasswordResetEmail(auth, email);
	} catch (error) {
		console.error('Password reset error:', error);
		throw error;
	}
}

export async function updateUserProfile(displayName, phoneNumber) {
	const currentUser = auth.currentUser;
	if (!currentUser) {
		throw new Error('No user logged in');
	}

	try {
		await updateProfile(currentUser, { displayName });
		// Note: phoneNumber updates require different Firebase method
		// For now, just update displayName
		return currentUser;
	} catch (error) {
		console.error('Profile update error:', error);
		throw error;
	}
}

export function onAuthStateChange(callback) {
	return onAuthStateChanged(auth, callback);
}

export function getCurrentUser() {
	return auth.currentUser;
}