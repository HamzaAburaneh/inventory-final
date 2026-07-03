import { readable } from 'svelte/store';
import { browser } from '$app/environment';

// Whether the browser currently has a network connection. Seeded true so SSR
// and the first paint assume online (no offline flash); on the client it syncs
// to navigator.onLine and follows the window online/offline events.
export const isOnline = readable(true, (set) => {
	if (!browser) return;

	set(navigator.onLine);

	const goOnline = () => set(true);
	const goOffline = () => set(false);
	window.addEventListener('online', goOnline);
	window.addEventListener('offline', goOffline);

	return () => {
		window.removeEventListener('online', goOnline);
		window.removeEventListener('offline', goOffline);
	};
});
