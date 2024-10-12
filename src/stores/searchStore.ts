import { writable } from 'svelte/store';

function createSearchStore() {
	const { subscribe, set } = writable('');

	return {
		subscribe,
		setSearchTerm: (term: string) => set(term),
		clearSearch: () => set('')
	};
}

export const searchStore = createSearchStore();
