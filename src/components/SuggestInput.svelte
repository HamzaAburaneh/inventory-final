<script>
	import { flushSync, tick } from 'svelte';
	import { fade } from 'svelte/transition';
	import { prefersReducedMotion } from 'svelte/motion';
	import { floatingList } from '../lib/floatingList.js';

	// Text box with a themed list of suggestions, in place of a native datalist. The
	// list floats over the page under the box (or above it when there's no room). It
	// shows every suggestion (lists here are short) and doesn't open on focus:
	// typing, the arrow button or the arrow keys open it. Any typed text is still
	// allowed. Focus stays in the box; one highlight follows both the arrow keys and
	// the pointer.
	let {
		id,
		value = $bindable(''),
		suggestions = [],
		listLabel = 'Suggestions',
		placeholder = '',
		disabled = false,
		required = false
	} = $props();

	const uid = $props.id();
	const listId = `${uid}-list`;

	let open = $state(false);
	let activeIndex = $state(-1);
	let inputEl = $state();
	let listEl = $state();
	// Set when the list is closed on purpose, so more typing leaves it closed.
	let dismissed = false;

	const options = $derived([...new Set(suggestions)]);
	// Capitalization doesn't matter: "daniel" picks out "Daniel".
	const matchIndex = $derived(
		value.trim()
			? options.findIndex((name) => name.toLowerCase() === value.trim().toLowerCase())
			: -1
	);
	const fadeOut = $derived({ duration: prefersReducedMotion.current ? 0 : 120 });
	const optionId = (index) => `${uid}-option-${index}`;

	async function openList(index = -1) {
		if (disabled || !options.length) return;
		open = true;
		activeIndex = index;
		await tick();
		revealActive();
	}

	function closeList() {
		flushSync(() => (open = false));
		activeIndex = -1;
	}

	function choose(name) {
		value = name;
		dismissed = true;
		closeList();
		inputEl?.focus();
	}

	function toggleList() {
		if (open) {
			dismissed = true;
			closeList();
		} else openList(matchIndex);
		inputEl?.focus();
	}

	// Scroll only the list, so the dialog around it stays put.
	function revealActive() {
		const option = listEl?.querySelector(`[data-index="${activeIndex}"]`);
		if (!option) return;
		if (option.offsetTop < listEl.scrollTop) listEl.scrollTop = option.offsetTop;
		else if (option.offsetTop + option.offsetHeight > listEl.scrollTop + listEl.clientHeight)
			listEl.scrollTop = option.offsetTop + option.offsetHeight - listEl.clientHeight;
	}

	function onInput() {
		if (!value.trim()) dismissed = false;
		if (open) activeIndex = -1;
		else if (!dismissed) openList();
	}

	function onKey(event) {
		const count = options.length;
		if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && count) {
			event.preventDefault();
			const down = event.key === 'ArrowDown';
			if (!open) {
				openList(matchIndex >= 0 ? matchIndex : down ? 0 : count - 1);
				return;
			}
			activeIndex =
				activeIndex < 0 ? (down ? 0 : count - 1) : (activeIndex + (down ? 1 : -1) + count) % count;
			revealActive();
		} else if (event.key === 'Enter' && open) {
			if (activeIndex >= 0) {
				// Take the highlighted name instead of submitting the form.
				event.preventDefault();
				choose(options[activeIndex]);
			} else closeList();
		} else if (event.key === 'Escape' && open) {
			// Close only the list; a dialog around it stays open.
			event.preventDefault();
			event.stopPropagation();
			dismissed = true;
			closeList();
		} else if (event.key === 'Tab' && open) {
			closeList();
		}
	}

	function closeOnOutsidePress(node) {
		const handler = (event) => {
			if (open && !node.contains(event.target)) closeList();
		};
		document.addEventListener('pointerdown', handler, true);
		return () => document.removeEventListener('pointerdown', handler, true);
	}
</script>

<div class={['suggest', options.length && 'has-toggle']} {@attach closeOnOutsidePress}>
	<input
		{id}
		bind:this={inputEl}
		bind:value
		type="text"
		role="combobox"
		aria-expanded={open}
		aria-controls={listId}
		aria-autocomplete="none"
		aria-activedescendant={open && activeIndex >= 0 ? optionId(activeIndex) : undefined}
		autocomplete="off"
		{placeholder}
		{disabled}
		{required}
		oninput={onInput}
		onkeydown={onKey}
	/>
	{#if options.length}
		<button
			type="button"
			class="toggle"
			tabindex="-1"
			aria-label="Show {listLabel.toLowerCase()}"
			aria-controls={listId}
			aria-expanded={open}
			{disabled}
			onmousedown={(event) => event.preventDefault()}
			onclick={toggleList}
		>
			<span class="toggle-pill">
				<i class={['fas fa-chevron-down', 'chevron', open && 'open']} aria-hidden="true"></i>
			</span>
		</button>
	{/if}

	{#if open}
		<div
			class="list"
			id={listId}
			role="listbox"
			aria-label={listLabel}
			popover="manual"
			bind:this={listEl}
			{@attach floatingList(() => inputEl, { maxHeight: 200 })}
			out:fade={fadeOut}
		>
			{#each options as name, index (name)}
				<button
					type="button"
					role="option"
					tabindex="-1"
					id={optionId(index)}
					class={['option', index === activeIndex && 'active']}
					data-index={index}
					aria-selected={index === matchIndex}
					onmousedown={(event) => event.preventDefault()}
					onpointermove={() => (activeIndex = index)}
					onclick={() => choose(name)}
				>
					<span class="option-name">{name}</span>
					{#if index === matchIndex}
						<i class="fas fa-check check" aria-hidden="true"></i>
					{/if}
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.suggest {
		--suggest-soft: color-mix(in srgb, var(--text-color) 8%, transparent);
		position: relative;
		display: flex;
		min-width: 0;
	}

	input {
		flex: 1;
		min-width: 0;
		min-height: 2.5rem;
		padding: 0.5rem 0.75rem;
		border: 1.5px solid var(--input-border-color, var(--table-border-color));
		border-radius: var(--border-radius);
		color: var(--text-color);
		background: var(--input-bg, var(--container-bg));
		font: inherit;
		font-size: 0.95rem;
		font-weight: 600;
		transition: border-color 0.15s ease-out;
	}

	.has-toggle input {
		padding-right: 3.3rem;
	}

	input::placeholder {
		color: var(--placeholder-text);
		font-weight: 500;
	}

	input:focus-visible {
		outline: 2px solid var(--add-item-color);
		outline-offset: 2px;
	}

	input:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* The whole right end of the box is the button; the pill inside shows it. */
	.toggle {
		position: absolute;
		top: 0;
		right: 0;
		bottom: 0;
		display: flex;
		width: 3rem;
		padding: 0.3rem 0.3rem 0.3rem 0.2rem;
		border: 0;
		border-radius: 0 var(--border-radius) var(--border-radius) 0;
		background: transparent;
		cursor: pointer;
	}

	.toggle-pill {
		display: grid;
		place-items: center;
		flex: 1;
		border-radius: 999px;
		color: var(--text-color-dimmed);
		background: var(--suggest-soft);
		transition:
			background-color 0.15s ease-out,
			color 0.15s ease-out;
	}

	.toggle:hover:not(:disabled) .toggle-pill {
		color: var(--text-color);
		background: color-mix(in srgb, var(--text-color) 14%, transparent);
	}

	.toggle[aria-expanded='true'] .toggle-pill {
		color: var(--add-item-color);
		background: color-mix(in srgb, var(--add-item-color) 16%, transparent);
	}

	.toggle:focus {
		outline: none;
	}

	.toggle:disabled {
		cursor: not-allowed;
	}

	.toggle:disabled .toggle-pill {
		opacity: 0.5;
	}

	.chevron {
		font-size: 0.75rem;
		transition: transform 0.2s ease-out;
	}

	.chevron.open {
		transform: rotate(180deg);
	}

	/* Floats over the page (floatingList places it); drops in toward the box. */
	.list {
		z-index: 50;
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		padding: 0.3rem;
		overflow-y: auto;
		overscroll-behavior: contain;
		border: 1px solid var(--table-border-color);
		border-radius: var(--border-radius);
		color: var(--text-color);
		background: var(--container-bg);
		box-shadow: var(--nav-dropdown-shadow);
		animation: list-drop 0.15s ease-out;
	}

	@keyframes list-drop {
		from {
			opacity: 0;
			translate: 0 var(--list-from, -6px);
		}
	}

	.option {
		display: flex;
		flex-shrink: 0;
		align-items: center;
		gap: 0.55rem;
		width: 100%;
		min-height: 2.4rem;
		padding: 0.35rem 0.6rem;
		border: 0;
		border-radius: calc(var(--border-radius) - 2px);
		color: var(--text-color);
		background: transparent;
		font: inherit;
		font-size: 0.9rem;
		font-weight: 500;
		text-align: left;
		cursor: pointer;
		transition: background-color 0.12s ease-out;
	}

	.option:focus {
		outline: none;
	}

	.option.active {
		background: var(--suggest-soft);
	}

	.option[aria-selected='true'] {
		font-weight: 700;
	}

	.option-name {
		flex: 1;
		min-width: 0;
		overflow-wrap: anywhere;
	}

	.check {
		flex-shrink: 0;
		font-size: 0.8rem;
		color: var(--add-item-color);
	}

	@media (pointer: coarse) {
		input,
		.option {
			min-height: 2.75rem;
		}

		.toggle {
			width: 3.25rem;
		}

		.has-toggle input {
			padding-right: 3.55rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.chevron,
		.toggle-pill {
			transition: none;
		}

		.list {
			animation: none;
		}
	}
</style>
