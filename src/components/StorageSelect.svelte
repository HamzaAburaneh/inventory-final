<script>
	import { fly } from 'svelte/transition';
	import { prefersReducedMotion } from 'svelte/motion';
	import { tick } from 'svelte';

	// Shared custom storage-type dropdown used by the add-item form and the edit
	// modal so the two stay visually and behaviourally identical.
	let {
		value = $bindable(''),
		labelId = undefined,
		placeholder = 'Select storage type...'
	} = $props();

	const storageTypes = [
		{ value: 'Freezer', color: '#3B82F6' },
		{ value: 'Refrigerator', color: '#10B981' },
		{ value: 'Dry Storage', color: '#F59E0B' }
	];

	const selectedStorage = $derived(storageTypes.find((option) => option.value === value));
	const menuParams = $derived({ y: -6, duration: prefersReducedMotion.current ? 0 : 150 });

	let open = $state(false);
	let triggerEl = $state();
	let menuEl = $state();

	function openMenu(focusFirst = false) {
		open = true;
		if (focusFirst) {
			tick().then(() => menuEl?.querySelector('.select-option')?.focus());
		}
	}

	function closeMenu(refocus = false) {
		open = false;
		if (refocus) triggerEl?.focus();
	}

	function choose(next) {
		value = next;
		closeMenu(true);
	}

	function onTriggerKey(event) {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			openMenu(true);
		} else if (event.key === 'Escape') {
			closeMenu();
		}
	}

	function onMenuKey(event) {
		const options = [...menuEl.querySelectorAll('.select-option')];
		const index = options.indexOf(document.activeElement);
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			options[Math.min(index + 1, options.length - 1)]?.focus();
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			options[Math.max(index - 1, 0)]?.focus();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			closeMenu(true);
		} else if (event.key === 'Tab') {
			closeMenu();
		}
	}

	/** Close the dropdown when clicking anywhere outside the select. */
	function clickOutside(node, onOutside) {
		const handler = (event) => {
			if (!node.contains(event.target)) onOutside();
		};
		document.addEventListener('click', handler, true);
		return {
			destroy() {
				document.removeEventListener('click', handler, true);
			}
		};
	}
</script>

{#snippet storageIcon(type)}
	{#if type === 'Freezer'}
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<line x1="12" y1="3" x2="12" y2="21"></line>
			<line x1="3" y1="12" x2="21" y2="12"></line>
			<line x1="5.6" y1="5.6" x2="18.4" y2="18.4"></line>
			<line x1="18.4" y1="5.6" x2="5.6" y2="18.4"></line>
		</svg>
	{:else if type === 'Refrigerator'}
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<rect x="6" y="2.5" width="12" height="19" rx="2"></rect>
			<line x1="6" y1="10" x2="18" y2="10"></line>
			<line x1="9" y1="5" x2="9" y2="7.5"></line>
			<line x1="9" y1="12.5" x2="9" y2="15.5"></line>
		</svg>
	{:else}
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<path
				d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
			></path>
			<polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
			<line x1="12" y1="22.08" x2="12" y2="12"></line>
		</svg>
	{/if}
{/snippet}

<div class="select" use:clickOutside={() => closeMenu()}>
	<button
		type="button"
		bind:this={triggerEl}
		class="select-trigger"
		class:open
		class:placeholder={!value}
		aria-haspopup="listbox"
		aria-expanded={open}
		aria-labelledby={labelId}
		onclick={() => (open ? closeMenu() : openMenu())}
		onkeydown={onTriggerKey}
	>
		<span class="select-value">
			{#if selectedStorage}
				<span class="opt-icon" style="--opt-color: {selectedStorage.color}">
					{@render storageIcon(selectedStorage.value)}
				</span>
				<span class="select-value-text">{selectedStorage.value}</span>
			{:else}
				<span class="select-value-text">{placeholder}</span>
			{/if}
		</span>
		<span class="select-chevron" class:open aria-hidden="true">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<polyline points="6 9 12 15 18 9"></polyline>
			</svg>
		</span>
	</button>

	{#if open}
		<div
			class="select-menu"
			role="listbox"
			tabindex="-1"
			aria-labelledby={labelId}
			bind:this={menuEl}
			onkeydown={onMenuKey}
			transition:fly={menuParams}
		>
			{#each storageTypes as option (option.value)}
				<button
					type="button"
					role="option"
					aria-selected={value === option.value}
					class="select-option"
					class:selected={value === option.value}
					style="--opt-color: {option.color}"
					onclick={() => choose(option.value)}
				>
					<span class="select-option-main">
						<span class="opt-glyph">
							{@render storageIcon(option.value)}
						</span>
						<span>{option.value}</span>
					</span>
					{#if value === option.value}
						<span class="select-check" aria-hidden="true">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
								<polyline points="20 6 9 17 4 12"></polyline>
							</svg>
						</span>
					{/if}
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.select {
		position: relative;
	}

	.select-trigger {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.45rem 0.7rem;
		border: 1.5px solid var(--input-border-color);
		border-radius: var(--border-radius);
		background-color: var(--input-bg);
		color: var(--input-text);
		font-size: 0.82rem;
		font-weight: 500;
		text-align: left;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
		transition:
			border-color 0.15s ease-out,
			box-shadow 0.15s ease-out,
			background-color 0.15s ease-out;
	}

	.select-trigger:hover:not(.open) {
		border-color: var(--input-hover-border-color);
		background-color: var(--input-hover-bg);
	}

	/* Suppress the global button:focus blue outline; keep the accent ring below. */
	.select-trigger:focus {
		outline: none;
	}

	.select-trigger.open,
	.select-trigger:focus-visible {
		outline: none;
		border-color: var(--add-item-color);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--add-item-color) 30%, transparent);
	}

	.select-trigger.placeholder {
		color: var(--placeholder-text);
		font-weight: 400;
	}

	.select-value {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		min-width: 0;
		overflow: hidden;
	}

	.select-value-text {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.opt-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 1.4rem;
		height: 1.4rem;
		border-radius: calc(var(--border-radius) - 3px);
		background: color-mix(in srgb, var(--opt-color) 18%, transparent);
		color: var(--opt-color);
	}

	.opt-icon svg {
		width: 0.82rem;
		height: 0.82rem;
		display: block;
	}

	/* Plain colored glyph used in the dropdown rows (the trigger keeps .opt-icon). */
	.opt-glyph {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 1.05rem;
		height: 1.05rem;
		color: var(--opt-color);
	}

	.opt-glyph svg {
		width: 100%;
		height: 100%;
		display: block;
	}

	.select-chevron {
		display: inline-flex;
		flex-shrink: 0;
		color: var(--text-color-dimmed);
		transition: transform 0.2s ease-out;
	}

	.select-chevron.open {
		transform: rotate(180deg);
	}

	.select-chevron svg {
		width: 0.85rem;
		height: 0.85rem;
		display: block;
	}

	.select-menu {
		position: absolute;
		top: calc(100% + 0.35rem);
		left: 0;
		right: 0;
		z-index: 50;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		padding: 0.3rem;
		background: var(--container-bg);
		border: 1px solid var(--table-border-color);
		border-radius: var(--border-radius);
		box-shadow: 0 10px 28px rgba(0, 0, 0, 0.22);
	}

	.select-option {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		width: 100%;
		padding: 0.4rem 0.5rem 0.4rem 0.6rem;
		border: none;
		/* Colored accent rule down the left of each row; single-sided border so
		   the corners on that edge stay square. */
		border-left: 3px solid var(--opt-color);
		border-radius: 0 calc(var(--border-radius) - 2px) calc(var(--border-radius) - 2px) 0;
		background: transparent;
		color: var(--text-color);
		font-size: 0.82rem;
		font-weight: 500;
		text-align: left;
		cursor: pointer;
		transition:
			background-color 0.12s ease-out,
			color 0.12s ease-out;
	}

	.select-option:hover:not(.selected),
	.select-option:focus-visible {
		outline: none;
		background: var(--hover-bg-color);
	}

	.select-option-main {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
	}

	.select-option.selected {
		background: color-mix(in srgb, var(--opt-color) 16%, transparent);
	}

	.select-check {
		display: inline-flex;
		flex-shrink: 0;
		color: var(--opt-color);
	}

	.select-check svg {
		width: 0.85rem;
		height: 0.85rem;
		display: block;
	}
</style>
