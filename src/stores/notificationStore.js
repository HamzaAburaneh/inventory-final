import { writable } from 'svelte/store';

function createNotificationStore() {
	const { subscribe, set, update } = writable([]);

	function addNotification(message, type = 'info', duration = 5000) {
		const id = Date.now() + Math.random();
		const notification = {
			id,
			message,
			type,
			duration
		};

		update(notifications => [...notifications, notification]);

		if (duration > 0) {
			setTimeout(() => {
				removeNotification(id);
			}, duration);
		}

		return id;
	}

	function removeNotification(id) {
		update(notifications => notifications.filter(n => n.id !== id));
	}

	function clearAll() {
		set([]);
	}

	function success(message, duration = 5000) {
		return addNotification(message, 'success', duration);
	}

	function error(message, duration = 8000) {
		return addNotification(message, 'error', duration);
	}

	function warning(message, duration = 6000) {
		return addNotification(message, 'warning', duration);
	}

	function info(message, duration = 5000) {
		return addNotification(message, 'info', duration);
	}

	// Alias for compatibility
	function showNotification(message, type = 'info', duration = 5000) {
		return addNotification(message, type, duration);
	}

	return {
		subscribe,
		addNotification,
		removeNotification,
		clearAll,
		success,
		error,
		warning,
		info,
		showNotification
	};
}

export const notificationStore = createNotificationStore();
