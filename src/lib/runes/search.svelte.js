/**
 * Runes-based search state management
 * Replaces the store-based searchStore.js with Svelte 5 runes
 */

/**
 * Creates a reactive search state object using Svelte 5 runes
 * @returns {object} Search state and methods
 */
export function createSearchState() {
	let term = $state('');
	let results = $state([]);
	let isSearching = $state(false);
	let history = $state([]);

	// Derived values
	const hasResults = $derived(results.length > 0);
	const hasSearchTerm = $derived(term.trim().length > 0);

	/**
	 * Set the search term
	 * @param {string} value
	 */
	function setTerm(value) {
		term = value;
	}

	/**
	 * Set search results
	 * @param {Array} value
	 */
	function setResults(value) {
		results = value;
	}

	/**
	 * Set searching state
	 * @param {boolean} value
	 */
	function setIsSearching(value) {
		isSearching = value;
	}

	/**
	 * Add a term to search history
	 * @param {string} searchTerm
	 */
	function addToHistory(searchTerm) {
		if (!searchTerm || searchTerm.trim().length === 0) return;

		const trimmedTerm = searchTerm.trim();
		// Remove duplicate and add to front, keep only last 10
		history = [trimmedTerm, ...history.filter((item) => item !== trimmedTerm)].slice(0, 10);
	}

	/**
	 * Clear search history
	 */
	function clearHistory() {
		history = [];
	}

	/**
	 * Clear all search state
	 */
	function clear() {
		term = '';
		results = [];
		isSearching = false;
	}

	/**
	 * Remove a specific term from history
	 * @param {string} searchTerm
	 */
	function removeFromHistory(searchTerm) {
		history = history.filter((item) => item !== searchTerm);
	}

	/**
	 * Perform a search using the provided search function
	 * @param {function} searchFunction - Async function that performs the actual search
	 */
	async function performSearch(searchFunction) {
		if (!term || term.trim().length === 0) {
			results = [];
			return;
		}

		isSearching = true;
		try {
			const searchResults = await searchFunction(term.trim());
			results = searchResults;
			addToHistory(term.trim());
		} catch (error) {
			console.error('Search error:', error);
			results = [];
		} finally {
			isSearching = false;
		}
	}

	return {
		// Getters for reactive state (use these in templates)
		get term() {
			return term;
		},
		get results() {
			return results;
		},
		get isSearching() {
			return isSearching;
		},
		get history() {
			return history;
		},
		get hasResults() {
			return hasResults;
		},
		get hasSearchTerm() {
			return hasSearchTerm;
		},

		// Methods
		setTerm,
		setResults,
		setIsSearching,
		addToHistory,
		clearHistory,
		clear,
		removeFromHistory,
		performSearch
	};
}
