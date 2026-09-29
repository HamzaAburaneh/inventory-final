/**
 * Whether a pointer event on a modal dialog landed on its dimmed backdrop. The
 * backdrop reports the dialog itself as its target, so the dialog's bounds tell a
 * backdrop press apart from one on the card's own padding or scrollbar.
 * @param {{ target: unknown, clientX: number, clientY: number }} event Pointer or click event.
 * @param {{ getBoundingClientRect: () => { left: number, right: number, top: number, bottom: number } }} dialog
 *   The open dialog.
 * @returns {boolean} True when the event is on the backdrop, outside the card.
 */
export function isBackdropHit(event, dialog) {
	if (event.target !== dialog) return false;
	const box = dialog.getBoundingClientRect();
	return (
		event.clientX < box.left ||
		event.clientX > box.right ||
		event.clientY < box.top ||
		event.clientY > box.bottom
	);
}

/**
 * Attachment for a modal `<dialog>` that closes it on a click on the dimmed
 * backdrop, like Escape. The press has to start on the backdrop too: the browser
 * reports a drag that starts inside the card and lets go outside it (selecting the
 * text in a box, say) as a click on the dialog, and that must leave it open.
 * @param {() => void} onclose Called for a backdrop click.
 * @returns {(dialog: HTMLDialogElement) => () => void} Svelte attachment.
 */
export function closeOnBackdrop(onclose) {
	return (dialog) => {
		let pressedBackdrop = false;
		/** @param {PointerEvent} event */
		const press = (event) => {
			pressedBackdrop = isBackdropHit(event, dialog);
		};
		/** @param {MouseEvent} event */
		const click = (event) => {
			const pressed = pressedBackdrop;
			pressedBackdrop = false;
			if (pressed && isBackdropHit(event, dialog)) onclose();
		};
		dialog.addEventListener('pointerdown', press);
		dialog.addEventListener('click', click);
		return () => {
			dialog.removeEventListener('pointerdown', press);
			dialog.removeEventListener('click', click);
		};
	};
}
