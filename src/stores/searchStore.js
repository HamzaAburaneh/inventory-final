import { writable, derived } from 'svelte/store';

export const searchTerm = writable('');
export const searchResults = writable([]);
export const isSearching = writable(false);
export const searchHistory = writable([]);

export const hasResults = derived(
	searchResults,
	$searchResults => $searchResults.length > 0
);

export const hasSearchTerm = derived(
	searchTerm,
	$searchTerm => $searchTerm.trim().length > 0
);

export function setSearchTerm(term) {
	searchTerm.set(term);
}

export function setSearchResults(results) {
	searchResults.set(results);
}

export function setIsSearching(searching) {
	isSearching.set(searching);
}

export function addToHistory(term) {
	if (!term || term.trim().length === 0) return;
	
	searchHistory.update(history => {
		const trimmedTerm = term.trim();
		const filteredHistory = history.filter(item => item !== trimmedTerm);
		return [trimmedTerm, ...filteredHistory].slice(0, 10); // Keep only last 10 searches
	});
}

export function clearHistory() {
	searchHistory.set([]);
}

export function clearSearch() {
	searchTerm.set('');
	searchResults.set([]);
	isSearching.set(false);
}

export function removeFromHistory(term) {
	searchHistory.update(history => history.filter(item => item !== term));
}

export async function performSearch(searchFunction) {
	const currentTerm = searchTerm.subscribe(term => term)();
	if (!currentTerm || currentTerm.trim().length === 0) {
		setSearchResults([]);
		return;
	}

	setIsSearching(true);
	try {
		const results = await searchFunction(currentTerm.trim());
		setSearchResults(results);
		addToHistory(currentTerm.trim());
	} catch (error) {
		console.error('Search error:', error);
		setSearchResults([]);
	} finally {
		setIsSearching(false);
	}
}
