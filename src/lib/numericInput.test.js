import { describe, it, expect } from 'vitest';
import { fitsNumber, numberInsertion, onlyNumberChars } from './numericInput';

const money = { decimals: 2 };
const signed = { negative: true };

describe('fitsNumber', () => {
	it('accepts money as it is typed, up to two decimals', () => {
		for (const text of ['', '12', '12.', '12.3', '12.34', '.5'])
			expect(fitsNumber(text, money)).toBe(true);
		for (const text of ['12.345', '1.2.3', 'gsdfg', '-1', '1 000', '$5'])
			expect(fitsNumber(text, money)).toBe(false);
	});

	it('keeps whole numbers to digits, with a leading minus only when allowed', () => {
		for (const text of ['', '0', '42']) expect(fitsNumber(text)).toBe(true);
		for (const text of ['4.2', '-4', 'e', '4e2', '+4']) expect(fitsNumber(text)).toBe(false);
		for (const text of ['-', '-3', '3']) expect(fitsNumber(text, signed)).toBe(true);
		for (const text of ['3-', '--3', '-3.0']) expect(fitsNumber(text, signed)).toBe(false);
	});
});

describe('onlyNumberChars', () => {
	it('drops letters and stray symbols', () => {
		expect(onlyNumberChars('gsdfg', money)).toBe('');
		expect(onlyNumberChars('12a.5b0', money)).toBe('12.50');
		expect(onlyNumberChars('4e+2')).toBe('42');
		expect(onlyNumberChars('-3')).toBe('3');
		expect(onlyNumberChars('-3', signed)).toBe('-3');
	});

	it('reads full-width digits from an input method as digits', () => {
		expect(onlyNumberChars('１２．５', money)).toBe('12.5');
	});
});

describe('numberInsertion', () => {
	it('refuses letters and takes digits', () => {
		expect(numberInsertion('12', 2, 2, 'g', money)).toBeNull();
		expect(numberInsertion('12', 2, 2, 'e')).toBeNull();
		expect(numberInsertion('12', 2, 2, '5', money)).toBe('5');
	});

	it('refuses a second point and a third decimal', () => {
		expect(numberInsertion('12.5', 4, 4, '.', money)).toBeNull();
		expect(numberInsertion('12.34', 5, 5, '5', money)).toBeNull();
		expect(numberInsertion('12', 2, 2, '.')).toBeNull();
	});

	it('judges the text as it will be, with the selection replaced', () => {
		expect(numberInsertion('12.34', 0, 5, '7', money)).toBe('7');
		expect(numberInsertion('12.34', 0, 0, '9', money)).toBe('9');
		expect(numberInsertion('12.34', 4, 5, '0', money)).toBe('0');
	});

	it('pastes formatted money as its bare figure, but refuses pasted words', () => {
		expect(numberInsertion('', 0, 0, '$1,250.00', money)).toBe('1250.00');
		expect(numberInsertion('', 0, 0, ' 7 ', money)).toBe('7');
		expect(numberInsertion('', 0, 0, '12abc', money)).toBeNull();
		expect(numberInsertion('', 0, 0, '   ', money)).toBeNull();
		expect(numberInsertion('', 0, 0, '12.50')).toBeNull();
	});

	it('takes a minus only at the start, where negatives are allowed', () => {
		expect(numberInsertion('5', 0, 0, '-', signed)).toBe('-');
		expect(numberInsertion('5', 1, 1, '-', signed)).toBeNull();
		expect(numberInsertion('-5', 0, 0, '-', signed)).toBeNull();
		expect(numberInsertion('5', 0, 0, '-')).toBeNull();
	});

	it('leaves an out-of-shape old value editable, though never with letters', () => {
		expect(numberInsertion('0.333', 0, 0, '1', money)).toBe('1');
		expect(numberInsertion('0.333', 0, 0, 'x', money)).toBeNull();
	});

	it('checks only the inserted text when the selection is unknown, as in number boxes', () => {
		expect(numberInsertion('', 0, 0, '7')).toBe('7');
		expect(numberInsertion('', 0, 0, '-', signed)).toBe('-');
		expect(numberInsertion('', 0, 0, '+')).toBeNull();
	});
});
