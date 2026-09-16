import { auth, db } from './firebase.js';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getDocFromServer, doc, disableNetwork, enableNetwork } from 'firebase/firestore';
import { setActiveGroupId } from '../../../src/lib/activeGroup.js';
import * as queue from '../../../src/lib/stockActionQueue.js';
import { applyStockAction } from '../../../src/lib/stockActionTransport.js';
import { accessStockQueue } from '../../../src/lib/stockQueueStorage.js';
let stop;
window.stockTest = {
	...queue,
	applyStockAction,
	accessStockQueue,
	async login(email, groupId) {
		await signInWithEmailAndPassword(auth, email, 'stock-test-password');
		setActiveGroupId(groupId);
		stop?.();
		stop = queue.startStockQueue(auth.currentUser.uid, groupId);
	},
	async logout() {
		stop?.();
		setActiveGroupId(null);
		await signOut(auth);
	},
	async read(groupId, itemId) {
		const row = await getDocFromServer(doc(db, 'groups', groupId, 'items', itemId));
		return row.exists() ? row.data() : null;
	},
	async pause() {
		await disableNetwork(db);
	},
	async resume() {
		await enableNetwork(db);
		await queue.drainStockQueue();
	},
	state: null
};
queue.stockQueueState.subscribe((state) => (window.stockTest.state = state));
if (!(await navigator.serviceWorker.getRegistration()))
	await navigator.serviceWorker.register('/sw.js');
await navigator.serviceWorker.ready;
window.fixtureReady = true;
