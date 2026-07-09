import { describe, it, expect } from 'vitest';
import { slugify } from './booths';

describe('slugify', () => {
	it('lowercases a simple label', () => {
		expect(slugify('Freshly')).toBe('freshly');
	});

	it('collapses spaces to a single hyphen', () => {
		expect(slugify('Jakes Corner')).toBe('jakes-corner');
	});

	it('collapses punctuation and repeated separators to a single hyphen', () => {
		expect(slugify('B1 -- East!!')).toBe('b1-east');
	});

	it('trims leading and trailing hyphens', () => {
		expect(slugify('  --Epic--  ')).toBe('epic');
	});

	it('keeps numbers', () => {
		expect(slugify('Booth 42')).toBe('booth-42');
	});

	it('returns an empty string for a label with no alphanumerics', () => {
		expect(slugify('***')).toBe('');
	});

	it('returns an empty string for empty/undefined input', () => {
		expect(slugify('')).toBe('');
		expect(slugify(undefined)).toBe('');
	});

	it('produces the same slug for labels that only differ by case/punctuation (collision case)', () => {
		expect(slugify('B1')).toBe(slugify('b1!!'));
	});
});
