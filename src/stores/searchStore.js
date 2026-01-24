import { writable } from 'svelte/store';

const searchStores = new Map();

function createSearchStore() {
	const searchTerm = writable('');
	
	function setSearchTerm(term) {
		searchTerm.set(term);
	}

	function clearSearch() {
		searchTerm.set('');
	}

	return {
		subscribe: searchTerm.subscribe,
		setSearchTerm,
		clearSearch
	};
}

export function getSearchStore(key) {
	if (!searchStores.has(key)) {
		searchStores.set(key, createSearchStore());
	}
	return searchStores.get(key);
}

// Keep backward compatibility for now if needed, but we should migrate
export const searchTerm = writable('');
export function setSearchTerm(term) {
	searchTerm.set(term);
}
export function clearSearch() {
	searchTerm.set('');
}
