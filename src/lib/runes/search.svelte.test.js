import { describe, it, expect } from 'vitest';
import { createSearchState } from './search.svelte.js';

describe('createSearchState', () => {
	it('starts with an empty term', () => {
		const search = createSearchState();
		expect(search.term).toBe('');
		expect(search.hasSearchTerm).toBe(false);
	});

	it('setTerm updates the term', () => {
		const search = createSearchState();
		search.setTerm('chicken');
		expect(search.term).toBe('chicken');
		expect(search.hasSearchTerm).toBe(true);
	});

	it('clear resets the term', () => {
		const search = createSearchState();
		search.setTerm('chicken');
		search.clear();
		expect(search.term).toBe('');
		expect(search.hasSearchTerm).toBe(false);
	});

	it('keeps each instance independent so searches never leak across pages', () => {
		const items = createSearchState();
		const transactions = createSearchState();

		items.setTerm('chicken');

		// Setting the term on one page must not bleed into another page's search.
		expect(transactions.term).toBe('');

		transactions.setTerm('refund');
		expect(items.term).toBe('chicken');

		items.clear();
		expect(transactions.term).toBe('refund');
	});
});
