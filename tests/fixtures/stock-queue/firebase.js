import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import {
	initializeFirestore,
	persistentLocalCache,
	persistentMultipleTabManager,
	connectFirestoreEmulator
} from 'firebase/firestore';
// Test-only build. Never imports application credentials or connects to production.
const app = initializeApp({
	projectId: 'demo-stocksense',
	apiKey: 'demo-key',
	authDomain: 'localhost'
});
export const auth = getAuth(app);
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
export const db = initializeFirestore(app, {
	localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});
connectFirestoreEmulator(db, '127.0.0.1', 8088);
