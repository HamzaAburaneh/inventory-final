<script lang="ts">
	import { theme } from '../themes';
	import { get } from 'svelte/store';
	import { onMount } from 'svelte';

	let currentTheme = get(theme);

	function toggleTheme() {
		currentTheme = currentTheme === 'light' ? 'dark' : 'light';
		theme.set(currentTheme);
		if (typeof window !== 'undefined') {
			localStorage.setItem('theme', currentTheme);
		}
	}

	$: {
		if (typeof document !== 'undefined') {
			document.documentElement.setAttribute('data-theme', currentTheme);
		}
	}

	onMount(() => {
		if (typeof document !== 'undefined') {
			document.documentElement.setAttribute('data-theme', currentTheme);
		}
	});
</script>

<button
	on:click={toggleTheme}
	class="theme-toggle"
	aria-label={currentTheme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
>
	<div class="toggle-track">
		<div class="toggle-icon sun" aria-hidden="true">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line
					x1="12"
					y1="21"
					x2="12"
					y2="23"
				/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line
					x1="18.36"
					y1="18.36"
					x2="19.78"
					y2="19.78"
				/><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line
					x1="4.22"
					y1="19.78"
					x2="5.64"
					y2="18.36"
				/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg
			>
		</div>
		<div class="toggle-icon moon" aria-hidden="true">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg
			>
		</div>
	</div>
	<div class="toggle-thumb"></div>
</button>

<style>
	.theme-toggle {
		--toggle-width: 56px;
		--toggle-height: 28px;
		--thumb-size: 24px;

		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		touch-action: pan-x;
		position: relative;
		outline: none;
		width: var(--toggle-width);
		height: var(--toggle-height);
		display: flex;
		align-items: center;
	}

	.toggle-track {
		width: 100%;
		height: 100%;
		border-radius: 34px;
		background-color: var(--nav-color);
		border: 1px solid var(--nav-border-color);
		transition: all 0.2s ease;
		position: relative;
	}

	.toggle-icon {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		width: 16px;
		height: 16px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--icon-color);
		transition: color 0.2s ease;
	}

	.sun {
		left: 6px;
	}

	.moon {
		right: 6px;
	}

	.toggle-thumb {
		position: absolute;
		top: 2px;
		left: 2px;
		width: var(--thumb-size);
		height: var(--thumb-size);
		border-radius: 50%;
		background-color: var(--icon-color);
		transition: all 0.25s ease;
	}

	:global([data-theme='dark']) .toggle-thumb {
		transform: translateX(calc(var(--toggle-width) - var(--thumb-size) - 4px));
	}

	.theme-toggle:focus .toggle-track {
		box-shadow: 0 0 0 2px var(--focus-border-color);
	}

	.theme-toggle:hover .toggle-track {
		border-color: var(--hover-border-color);
	}

	.theme-toggle:hover .toggle-icon {
		color: var(--icon-hover-color);
	}
</style>
