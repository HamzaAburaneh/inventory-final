import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
	apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
	authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
	projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
	storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
	messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
	appId: import.meta.env.VITE_FIREBASE_APP_ID,
	measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

let db;
let auth;

try {
	let app;
	if (!getApps().length) {
		app = initializeApp(firebaseConfig);
	} else {
		app = getApp(); // if already initialized, use that app
	}
	db = getFirestore(app);
	auth = getAuth(app);
} catch (error) {
	console.error('Error initializing Firebase:', error);
	throw error;
}

export { db, auth };