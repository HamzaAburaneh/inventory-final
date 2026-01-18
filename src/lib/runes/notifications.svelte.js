/**
 * Runes-based notification state management
 * Replaces the store-based notificationStore.js with Svelte 5 runes
 */

/**
 * @typedef {Object} Notification
 * @property {number} id - Unique identifier
 * @property {string} message - Notification message
 * @property {'info'|'success'|'warning'|'error'} type - Notification type
 * @property {number} duration - Duration in milliseconds (0 = permanent)
 */

// Singleton state for notifications (module-level)
let notifications = $state([]);

// Track active timeouts for cleanup
const timeoutMap = new Map();

/**
 * Generate unique ID for notifications
 * @returns {number}
 */
function generateId() {
	return Date.now() + Math.random();
}

/**
 * Add a notification
 * @param {string} message
 * @param {'info'|'success'|'warning'|'error'} type
 * @param {number} duration - Duration in ms (0 = no auto-dismiss)
 * @returns {number} Notification ID
 */
function addNotification(message, type = 'info', duration = 5000) {
	const id = generateId();
	const notification = { id, message, type, duration };

	notifications = [...notifications, notification];

	if (duration > 0) {
		const timeoutId = setTimeout(() => {
			removeNotification(id);
		}, duration);
		timeoutMap.set(id, timeoutId);
	}

	return id;
}

/**
 * Remove a notification by ID
 * @param {number} id
 */
function removeNotification(id) {
	// Clear any pending timeout
	if (timeoutMap.has(id)) {
		clearTimeout(timeoutMap.get(id));
		timeoutMap.delete(id);
	}
	notifications = notifications.filter((n) => n.id !== id);
}

/**
 * Clear all notifications
 */
function clearAll() {
	// Clear all timeouts
	timeoutMap.forEach((timeoutId) => clearTimeout(timeoutId));
	timeoutMap.clear();
	notifications = [];
}

/**
 * Show a success notification
 * @param {string} message
 * @param {number} duration
 * @returns {number} Notification ID
 */
function success(message, duration = 5000) {
	return addNotification(message, 'success', duration);
}

/**
 * Show an error notification
 * @param {string} message
 * @param {number} duration
 * @returns {number} Notification ID
 */
function error(message, duration = 8000) {
	return addNotification(message, 'error', duration);
}

/**
 * Show a warning notification
 * @param {string} message
 * @param {number} duration
 * @returns {number} Notification ID
 */
function warning(message, duration = 6000) {
	return addNotification(message, 'warning', duration);
}

/**
 * Show an info notification
 * @param {string} message
 * @param {number} duration
 * @returns {number} Notification ID
 */
function info(message, duration = 5000) {
	return addNotification(message, 'info', duration);
}

/**
 * Alias for addNotification (backward compatibility)
 * @param {string} message
 * @param {'info'|'success'|'warning'|'error'} type
 * @param {number} duration
 * @returns {number} Notification ID
 */
function showNotification(message, type = 'info', duration = 5000) {
	return addNotification(message, type, duration);
}

/**
 * Get the notifications state object
 * Use this to access notifications in components
 * @returns {object} Notifications state and methods
 */
export function getNotifications() {
	return {
		// Getter for reactive state
		get list() {
			return notifications;
		},
		get count() {
			return notifications.length;
		},
		get latest() {
			return notifications[notifications.length - 1] || null;
		},

		// Methods
		add: addNotification,
		remove: removeNotification,
		clearAll,
		success,
		error,
		warning,
		info,
		showNotification
	};
}

// Export a default instance for easy importing
export const notificationState = getNotifications();
