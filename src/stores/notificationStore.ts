import { writable } from 'svelte/store';

interface Notification {
	message: string;
	type: 'success' | 'error' | 'info';
}

function createNotificationStore() {
	const { subscribe, set } = writable<Notification | null>(null);

	return {
		subscribe,
		showNotification: (message: string, type: 'success' | 'error' | 'info' = 'info') => {
			set({ message, type });
			setTimeout(() => set(null), 3000); // Hide notification after 3 seconds
		},
		clearNotification: () => set(null)
	};
}

export const notificationStore = createNotificationStore();
