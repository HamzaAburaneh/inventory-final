<script>
	import { flushSync, tick } from 'svelte';
	import { fade } from 'svelte/transition';
	import { prefersReducedMotion } from 'svelte/motion';
	import Icon from './Icon.svelte';
	import { floatingList } from '../lib/floatingList.js';
	import { itemStorage, pickerGroups } from '../lib/itemPicker.js';
	import { getStorageTypeIcon } from '../lib/tableUtils.js';

	// Themed, searchable item dropdown. The list floats over the page under the box
	// (or above it when there's no room), like a native select, so opening it never
	// pushes a form down. Items are grouped by cold or dry storage and sorted A–Z,
	// and typing filters them by any part of the name. Focus stays in the search box;
	// one highlight follows both the arrow keys and the pointer. `onchoose(id)`
	// reports the picked item's ID.
	let {
		items = [],
		value = '',
		labelId,
		disabled = false,
		placeholder = 'Choose an item',
		onchoose
	} = $props();

	const uid = $props.id();

	let open = $state(false);
	let query = $state('');
	let activeIndex = $state(0);
	let triggerEl = $state();
	let searchEl = $state();
	let listEl = $state();

	const fadeOut = $derived({ duration: prefersReducedMotion.current ? 0 : 120 });
	const needle = $derived(query.trim().toLowerCase());
	const groups = $derived(pickerGroups(items, query));
	const ordered = $derived(groups.flatMap((group) => group.rows));
	const active = $derived(ordered[activeIndex] ?? null);
	const selected = $derived.by(() => {
		const item = items.find((row) => row.id === value);
		return item ? { name: item.name, storage: itemStorage(item) } : null;
	});

	const optionId = (id) => `${uid}-item-${id}`;

	async function openList(initial = '') {
		if (disabled || open) return;
		query = initial;
		open = true;
		// Start on the chosen item, or on the first match when a search began.
		activeIndex = initial
			? 0
			: Math.max(
					0,
					ordered.findIndex((row) => row.id === value)
				);
		await tick();
		searchEl?.focus();
		revealActive();
	}

	function closeList(refocus = true) {
		// Flushed now, so a Tab handled after this already sees the list closing.
		flushSync(() => (open = false));
		if (refocus) triggerEl?.focus();
	}

	function choose(id) {
		onchoose?.(id);
		closeList();
	}

	// Scroll only the list, keeping the active row clear of its sticky heading.
	function revealActive() {
		const option = listEl?.querySelector(`[data-index="${activeIndex}"]`);
		if (!option) return;
		const heading = option.closest('[role="group"]')?.querySelector('.group-label');
		const top = option.offsetTop - (heading?.offsetHeight ?? 0);
		const bottom = option.offsetTop + option.offsetHeight;
		if (top < listEl.scrollTop) listEl.scrollTop = top;
		else if (bottom > listEl.scrollTop + listEl.clientHeight)
			listEl.scrollTop = bottom - listEl.clientHeight;
	}

	function isTyping(event) {
		return event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;
	}

	function onTriggerKey(event) {
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			openList();
		} else if (isTyping(event) && event.key !== ' ') {
			// Typing on the closed box starts a search with that letter.
			event.preventDefault();
			openList(event.key);
		}
	}

	function onSearchInput() {
		activeIndex = 0;
		if (listEl) listEl.scrollTop = 0;
	}

	function onSearchKey(event) {
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			if (!ordered.length) return;
			const step = event.key === 'ArrowDown' ? 1 : -1;
			activeIndex = (activeIndex + step + ordered.length) % ordered.length;
			revealActive();
		} else if (event.key === 'Enter') {
			// Never submit the dialog's form from the search box.
			event.preventDefault();
			if (active) choose(active.id);
		} else if (event.key === 'Escape') {
			// Close only the list; the dialog around it stays open.
			event.preventDefault();
			event.stopPropagation();
			closeList();
		} else if (event.key === 'Tab') {
			// Leave from the box, so Tab carries on to the next field and Shift+Tab
			// lands back on the box.
			if (event.shiftKey) event.preventDefault();
			closeList();
		}
	}

	function closeOnOutsidePress(node) {
		const handler = (event) => {
			if (open && !node.contains(event.target)) closeList(false);
		};
		document.addEventListener('pointerdown', handler, true);
		return () => document.removeEventListener('pointerdown', handler, true);
	}
</script>

{#snippet highlighted(name)}
	{@const at = needle ? name.toLowerCase().indexOf(needle) : -1}
	{#if at < 0}
		{name}
	{:else}
		{name.slice(0, at)}<mark>{name.slice(at, at + needle.length)}</mark>{name.slice(
			at + needle.length
		)}
	{/if}
{/snippet}

<div class="picker" {@attach closeOnOutsidePress}>
	<button
		type="button"
		id="{uid}-trigger"
		bind:this={triggerEl}
		class={['trigger', open && 'open', !selected && 'placeholder']}
		data-location={selected?.storage ?? 'none'}
		aria-haspopup="listbox"
		aria-expanded={open}
		aria-labelledby="{labelId} {uid}-trigger"
		{disabled}
		onclick={() => (open ? closeList() : openList())}
		onkeydown={onTriggerKey}
	>
		<span class="trigger-value">
			{#if selected}
				<span class="trigger-icon" aria-hidden="true">
					<Icon name={getStorageTypeIcon(selected.storage)} size={14} />
				</span>
				<span class="trigger-text">{selected.name}</span>
			{:else}
				<span class="trigger-text">{placeholder}</span>
			{/if}
		</span>
		<i class={['fas fa-chevron-down', 'chevron', open && 'open']} aria-hidden="true"></i>
	</button>

	{#if open}
		<div
			class="panel"
			popover="manual"
			{@attach floatingList(() => triggerEl, { maxHeight: 320, scroller: '.list' })}
			out:fade={fadeOut}
		>
			<div class="search">
				<i class="fas fa-magnifying-glass" aria-hidden="true"></i>
				<input
					bind:this={searchEl}
					type="text"
					role="combobox"
					aria-expanded="true"
					aria-controls="{uid}-list"
					aria-autocomplete="list"
					aria-activedescendant={active ? optionId(active.id) : undefined}
					aria-label="Search items"
					placeholder="Search items"
					autocomplete="off"
					spellcheck="false"
					bind:value={query}
					oninput={onSearchInput}
					onkeydown={onSearchKey}
				/>
			</div>
			<div class="list" id="{uid}-list" role="listbox" aria-labelledby={labelId} bind:this={listEl}>
				{#each groups as group (group.key)}
					<div role="group" aria-labelledby="{uid}-{group.key}">
						<div class="group-label" id="{uid}-{group.key}">{group.label}</div>
						{#each group.rows as row (row.id)}
							<button
								type="button"
								role="option"
								tabindex="-1"
								id={optionId(row.id)}
								class={['option', row.index === activeIndex && 'active']}
								data-index={row.index}
								data-location={row.storage ?? 'none'}
								aria-selected={row.id === value}
								onmousedown={(event) => event.preventDefault()}
								onpointermove={() => (activeIndex = row.index)}
								onclick={() => choose(row.id)}
							>
								<span class="option-icon" aria-hidden="true">
									<Icon name={getStorageTypeIcon(row.storage)} size={15} />
								</span>
								<span class="option-name">{@render highlighted(row.name)}</span>
								{#if row.id === value}
									<i class="fas fa-check check" aria-hidden="true"></i>
								{/if}
							</button>
						{/each}
					</div>
				{:else}
					<p class="empty">
						{needle ? `No items match "${query.trim()}".` : 'No items yet.'}
					</p>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.picker {
		--picker-soft: color-mix(in srgb, var(--text-color) 8%, transparent);
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	/* Storage colours, as on the storage chips and filters. */
	[data-location='Freezer'] {
		--opt: var(--location-freezer);
	}

	[data-location='Refrigerator'] {
		--opt: var(--location-fridge);
	}

	[data-location='Dry Storage'] {
		--opt: var(--location-dry);
	}

	[data-location='none'] {
		--opt: var(--text-color-dimmed);
	}

	.trigger {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		width: 100%;
		min-height: 2.5rem;
		padding: 0.45rem 0.75rem;
		border: 1.5px solid var(--input-border-color, var(--table-border-color));
		border-radius: var(--border-radius);
		color: var(--text-color);
		background: var(--input-bg, var(--container-bg));
		font: inherit;
		font-size: 0.95rem;
		font-weight: 600;
		text-align: left;
		cursor: pointer;
		transition:
			border-color 0.15s ease-out,
			box-shadow 0.15s ease-out;
	}

	.trigger:hover:not(:disabled):not(.open) {
		border-color: var(--input-hover-border-color);
	}

	/* The accent border and ring below replace the global button outline. */
	.trigger:focus {
		outline: none;
	}

	.trigger:focus-visible,
	.trigger.open {
		border-color: var(--add-item-color);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--add-item-color) 30%, transparent);
	}

	.trigger.placeholder {
		color: var(--placeholder-text);
		font-weight: 500;
	}

	.trigger:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.trigger-value {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
	}

	.trigger-icon {
		display: grid;
		place-items: center;
		flex-shrink: 0;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 0.4rem;
		color: var(--opt);
		background: color-mix(in srgb, var(--opt) 18%, transparent);
	}

	.trigger-text {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.chevron {
		flex-shrink: 0;
		font-size: 0.75rem;
		color: var(--text-color-dimmed);
		transition: transform 0.2s ease-out;
	}

	.chevron.open {
		transform: rotate(180deg);
	}

	/* Floats over the page (floatingList places it); drops in toward the box. */
	.panel {
		z-index: 50;
		display: flex;
		flex-direction: column;
		padding: 0;
		border: 1px solid var(--table-border-color);
		border-radius: var(--border-radius);
		color: var(--text-color);
		background: var(--container-bg);
		box-shadow: var(--nav-dropdown-shadow);
		overflow: hidden;
		animation: list-drop 0.15s ease-out;
	}

	@keyframes list-drop {
		from {
			opacity: 0;
			translate: 0 var(--list-from, -6px);
		}
	}

	.search {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0 0.75rem;
		border-bottom: 1px solid var(--table-border-color);
		color: var(--text-color-dimmed);
		transition: border-color 0.15s ease-out;
	}

	.search:focus-within {
		border-bottom-color: var(--add-item-color);
	}

	.search i {
		font-size: 0.8rem;
	}

	.search input {
		flex: 1;
		min-width: 0;
		min-height: 2.5rem;
		padding: 0.4rem 0;
		border: 0;
		color: var(--text-color);
		background: transparent;
		font: inherit;
		font-size: 0.92rem;
		font-weight: 500;
	}

	/* The underline on .search shows focus; no ring inside the panel. */
	.search input:focus {
		outline: none;
		box-shadow: none;
	}

	.search input::placeholder {
		color: var(--placeholder-text);
	}

	/* Fills whatever height the panel is given, scrolling the rest. */
	.list {
		position: relative;
		flex: 1;
		min-height: 0;
		padding: 0 0.3rem 0.3rem;
		overflow-y: auto;
		overscroll-behavior: contain;
	}

	/* Headings stay in view while their group scrolls past. */
	.group-label {
		position: sticky;
		top: 0;
		z-index: 1;
		padding: 0.55rem 0.5rem 0.3rem;
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--text-color-dimmed);
		background: var(--container-bg);
	}

	.option {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		width: 100%;
		min-height: 2.4rem;
		padding: 0.35rem 0.55rem;
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
		background: var(--picker-soft);
	}

	.option[aria-selected='true'] {
		font-weight: 700;
		background: color-mix(in srgb, var(--opt) 14%, transparent);
	}

	.option[aria-selected='true'].active {
		background: color-mix(in srgb, var(--opt) 22%, transparent);
	}

	.option-icon {
		display: inline-grid;
		flex-shrink: 0;
		color: var(--opt);
	}

	.option-name {
		flex: 1;
		min-width: 0;
		overflow-wrap: anywhere;
	}

	mark {
		border-radius: 2px;
		color: inherit;
		background: color-mix(in srgb, var(--add-item-color) 30%, transparent);
	}

	.check {
		flex-shrink: 0;
		font-size: 0.8rem;
		color: var(--opt);
	}

	.empty {
		margin: 0;
		padding: 0.75rem 0.5rem 0.45rem;
		font-size: 0.85rem;
		color: var(--text-color-dimmed);
	}

	@media (pointer: coarse) {
		.trigger,
		.option {
			min-height: 2.75rem;
		}

		/* 16px keeps phones from zooming in when the search box takes focus. */
		.search input {
			font-size: 1rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.chevron {
			transition: none;
		}

		.panel {
			animation: none;
		}
	}
</style>
