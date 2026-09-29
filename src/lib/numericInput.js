/**
 * What a number box takes: whole numbers by default, `decimals` places after a
 * point (2 for money), and a leading minus only when `negative`.
 * @typedef {{ decimals?: number, negative?: boolean }} NumberRules
 */

// Insertions that replace the selection. Others land elsewhere: a drop where it's
// dropped, a spelling fix over its word.
const SELECTION_INSERTS = new Set(['insertText', 'insertFromPaste']);
const INSERTS = new Set([
	...SELECTION_INSERTS,
	'insertFromDrop',
	'insertFromYank',
	'insertReplacementText',
	'insertFromPasteAsQuotation'
]);

/** @param {NumberRules} rules @returns {RegExp} One character a number may hold. */
function numberChar({ decimals = 0, negative = false }) {
	return new RegExp(`[0-9${decimals > 0 ? '.' : ''}${negative ? '-' : ''}]`);
}

/**
 * Whether text is a number, or the start of one, under the rules: "", "-", "."
 * and "12." all pass while they're being typed.
 * @param {string} text Box text.
 * @param {NumberRules} [rules]
 * @returns {boolean} True when nothing in it is out of place.
 */
export function fitsNumber(text, { decimals = 0, negative = false } = {}) {
	const point = decimals > 0 ? `(\\.\\d{0,${decimals}})?` : '';
	return new RegExp(`^${negative ? '-?' : ''}\\d*${point}$`).test(text);
}

/**
 * Text with every character a number can't hold removed. Full-width digits, as an
 * input method may produce, count as digits.
 * @param {string} text Box text.
 * @param {NumberRules} [rules]
 * @returns {string} Digits, and points or minus signs where the rules allow them.
 */
export function onlyNumberChars(text, rules = {}) {
	const allowed = numberChar(rules);
	return [...text.normalize('NFKC')].filter((char) => allowed.test(char)).join('');
}

/**
 * How a number box takes an insertion (typing, a paste or a drop). Money
 * formatting ($, commas, spaces) is dropped, as it never changes the figure.
 * Anything else a number can't hold refuses the whole insertion, and so does
 * one that would put a well-formed number out of shape: a second point, one
 * decimal too many or a minus that isn't first.
 * @param {string} value The box's text now.
 * @param {number} start Start of the text being replaced.
 * @param {number} end End of the text being replaced.
 * @param {string} text The text being inserted.
 * @param {NumberRules} [rules]
 * @returns {string | null} The text to insert, or null to refuse it.
 */
export function numberInsertion(value, start, end, text, rules = {}) {
	const insert = text.normalize('NFKC').replace(/[$,\s]/g, '');
	if (!insert || onlyNumberChars(insert, rules) !== insert) return null;
	const next = value.slice(0, start) + insert + value.slice(end);
	// A box that already holds something odd (an old value, say) can still be edited.
	if (fitsNumber(value, rules) && !fitsNumber(next, rules)) return null;
	return insert;
}

/**
 * Attachment that keeps an input to a plain number as it's typed (see
 * `NumberRules`). A letter or any other stray character is refused before it
 * lands, so the text and caret stay as they were, and pasted money such as
 * "$1,250.00" goes in as 1250.00. Works on text boxes and on `type="number"`
 * ones, though those hide their selection, so only what is inserted is checked.
 * Text an input method composes can't be refused; it is cleaned once committed.
 * @param {NumberRules} [rules]
 * @returns {(input: HTMLInputElement) => () => void} Svelte attachment.
 */
export function numericInput(rules = {}) {
	return (input) => {
		/** @param {InputEvent} event */
		const onBeforeInput = (event) => {
			if (!event.cancelable || !INSERTS.has(event.inputType)) return;
			const text = event.data ?? event.dataTransfer?.getData('text/plain') ?? '';
			// Nothing to judge up front; whatever lands is tidied afterwards.
			if (!text) return;
			const replacing = input.selectionStart !== null && SELECTION_INSERTS.has(event.inputType);
			const start = replacing ? (input.selectionStart ?? 0) : 0;
			const end = replacing ? (input.selectionEnd ?? start) : 0;
			const insert = numberInsertion(replacing ? input.value : '', start, end, text, rules);
			if (insert === text) return;
			event.preventDefault();
			if (insert !== null && replacing && event.inputType === 'insertFromPaste') {
				input.setRangeText(insert, start, end, 'end');
				input.dispatchEvent(
					new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste', data: insert })
				);
			}
		};

		// Strips what slipped past (composed or autofilled text), keeping the caret
		// beside the same characters. Number boxes can't show their raw text, so skip them.
		const tidy = () => {
			const caret = input.selectionStart;
			if (caret === null) return false;
			const { value } = input;
			const kept = onlyNumberChars(value, rules);
			if (kept === value) return false;
			const at = onlyNumberChars(value.slice(0, caret), rules).length;
			input.value = kept;
			input.setSelectionRange(at, at);
			return true;
		};
		/** @param {InputEvent} event */
		const onInput = (event) => {
			if (!event.isComposing) tidy();
		};
		// Chrome sends a composition's last input event before this one, so bound values
		// still hold the raw text; a fresh input event brings them up to date.
		const onCompositionEnd = () => {
			if (tidy()) input.dispatchEvent(new InputEvent('input', { bubbles: true }));
		};

		input.addEventListener('beforeinput', onBeforeInput);
		// Capture runs first on the input itself, so bindings only ever read clean text.
		input.addEventListener('input', onInput, true);
		input.addEventListener('compositionend', onCompositionEnd);
		return () => {
			input.removeEventListener('beforeinput', onBeforeInput);
			input.removeEventListener('input', onInput, true);
			input.removeEventListener('compositionend', onCompositionEnd);
		};
	};
}
