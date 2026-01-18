/**
 * Runes-based pagination state management
 * Replaces the store-based paginationStore.js with Svelte 5 runes
 */

import { browser } from '$app/environment';

/**
 * Creates a reactive pagination state object using Svelte 5 runes
 * @param {string} key - Unique key for localStorage persistence
 * @returns {object} Pagination state and methods
 */
export function createPaginationState(key) {
	// Get initial itemsPerPage from localStorage or default to 10
	const getInitialItemsPerPage = () => {
		if (browser) {
			const saved = localStorage.getItem(`pagination_${key}_itemsPerPage`);
			if (saved) {
				if (saved === 'all') return 'all';
				const parsed = parseInt(saved, 10);
				return !isNaN(parsed) ? parsed : 10;
			}
		}
		return 10;
	};

	let currentPage = $state(1);
	let itemsPerPage = $state(getInitialItemsPerPage());
	let totalItems = $state(0);

	// Derived values
	const totalPages = $derived(itemsPerPage === 'all' ? 1 : Math.ceil(totalItems / itemsPerPage));

	const startIndex = $derived(itemsPerPage === 'all' ? 0 : (currentPage - 1) * itemsPerPage);

	const endIndex = $derived(
		itemsPerPage === 'all' ? totalItems : Math.min(startIndex + itemsPerPage, totalItems)
	);

	/**
	 * Set current page
	 * @param {number} page
	 */
	function setCurrentPage(page) {
		currentPage = page;
	}

	/**
	 * Set items per page and persist to localStorage
	 * @param {number|'all'} items
	 */
	function setItemsPerPage(items) {
		itemsPerPage = items;
		currentPage = 1; // Reset to first page when changing items per page

		// Save to localStorage
		if (browser) {
			localStorage.setItem(`pagination_${key}_itemsPerPage`, items.toString());
		}
	}

	/**
	 * Set total items count
	 * @param {number} total
	 */
	function setTotalItems(total) {
		totalItems = total;
		// Ensure current page is valid after total items change
		if (currentPage > totalPages && totalPages > 0) {
			currentPage = totalPages;
		}
	}

	/**
	 * Go to next page
	 */
	function nextPage() {
		if (currentPage < totalPages) {
			currentPage = currentPage + 1;
		}
	}

	/**
	 * Go to previous page
	 */
	function previousPage() {
		if (currentPage > 1) {
			currentPage = currentPage - 1;
		}
	}

	/**
	 * Go to first page
	 */
	function goToFirstPage() {
		currentPage = 1;
	}

	/**
	 * Go to last page
	 */
	function goToLastPage() {
		currentPage = totalPages;
	}

	/**
	 * Reset pagination state
	 */
	function reset() {
		currentPage = 1;
		itemsPerPage = 10;
		totalItems = 0;
	}

	/**
	 * Paginate an array based on current state
	 * @param {Array} items - Array to paginate
	 * @returns {Array} Paginated subset of items
	 */
	function paginate(items) {
		if (itemsPerPage === 'all') {
			return items;
		}
		return items.slice(startIndex, endIndex);
	}

	return {
		// Getters for reactive state
		get currentPage() {
			return currentPage;
		},
		get itemsPerPage() {
			return itemsPerPage;
		},
		get totalItems() {
			return totalItems;
		},
		get totalPages() {
			return totalPages;
		},
		get startIndex() {
			return startIndex;
		},
		get endIndex() {
			return endIndex;
		},

		// Methods
		setCurrentPage,
		setItemsPerPage,
		setTotalItems,
		nextPage,
		previousPage,
		goToFirstPage,
		goToLastPage,
		reset,
		paginate
	};
}

// Cache for pagination instances (similar to store pattern)
const paginationCache = new Map();

/**
 * Get or create a pagination state instance
 * @param {string} key - Unique key for the pagination instance
 * @returns {object} Pagination state object
 */
export function getPaginationState(key) {
	if (!paginationCache.has(key)) {
		paginationCache.set(key, createPaginationState(key));
	}
	return paginationCache.get(key);
}
