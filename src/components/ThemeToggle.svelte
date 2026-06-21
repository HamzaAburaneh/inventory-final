<script>
	import { themeStore } from '../stores/themes.js';

	const currentTheme = $derived($themeStore);

	function toggleTheme() {
		themeStore.setTheme(currentTheme === 'light' ? 'dark' : 'light');
	}

	$effect(() => {
		document.documentElement.setAttribute('data-theme', currentTheme);
	});

	const isDark = $derived(currentTheme === 'dark');
</script>

<button
	onclick={toggleTheme}
	class="theme-toggle"
	aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
	role="switch"
	aria-checked={isDark}
>
	<!-- Sun icon -->
	<svg
		class="toggle-icon sun-icon"
		xmlns="http://www.w3.org/2000/svg"
		width="13"
		height="13"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2.25"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<circle cx="12" cy="12" r="5" />
		<line x1="12" y1="1" x2="12" y2="3" />
		<line x1="12" y1="21" x2="12" y2="23" />
		<line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
		<line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
		<line x1="1" y1="12" x2="3" y2="12" />
		<line x1="21" y1="12" x2="23" y2="12" />
		<line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
		<line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
	</svg>

	<!-- Track + thumb -->
	<div class="track">
		<div class="thumb"></div>
	</div>

	<!-- Moon icon -->
	<svg
		class="toggle-icon moon-icon"
		xmlns="http://www.w3.org/2000/svg"
		width="13"
		height="13"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2.25"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
	</svg>
</button>

<style>
	.theme-toggle {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		outline: none;
	}

	.theme-toggle:focus-visible .track {
		box-shadow: 0 0 0 2px var(--tech-accent);
	}

	/* ── Icons ─────────────────────────────────── */
	.toggle-icon {
		color: var(--nav-text-color);
		opacity: 0.3;
		transition:
			opacity 0.25s ease,
			color 0.25s ease;
		flex-shrink: 0;
	}

	/*
	 * The lit/dim state is driven by the [data-theme] attribute on <html> — which
	 * the inline script in app.html sets before first paint — NOT by the JS theme
	 * store. Binding to the store would render the light state during SSR and the
	 * first client frame (the store can't read localStorage on the server), then
	 * flip to dark after hydration: a split-second toggle flash. Sourcing it from
	 * [data-theme] keeps the toggle correct from the very first paint.
	 */
	.sun-icon {
		opacity: 0.75;
		color: var(--tech-accent);
	}

	:global([data-theme='dark']) .sun-icon {
		opacity: 0.3;
		color: var(--nav-text-color);
	}

	:global([data-theme='dark']) .moon-icon {
		opacity: 0.75;
		color: var(--tech-accent);
	}

	/* ── Track ─────────────────────────────────── */
	.track {
		position: relative;
		width: 36px;
		height: 20px;
		border-radius: 999px;
		background: rgba(128, 128, 128, 0.18);
		border: 1px solid var(--nav-border-color);
		transition:
			background 0.25s ease,
			border-color 0.25s ease;
		flex-shrink: 0;
	}

	:global([data-theme='dark']) .track {
		background: rgba(var(--tech-accent-rgb), 0.15);
		border-color: rgba(var(--tech-accent-rgb), 0.3);
	}

	.theme-toggle:hover .track {
		border-color: rgba(var(--tech-accent-rgb), 0.45);
	}

	/* ── Thumb ─────────────────────────────────── */
	.thumb {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: var(--nav-text-color);
		transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
	}

	:global([data-theme='dark']) .thumb {
		transform: translateX(16px);
		background: var(--tech-accent);
	}
</style>
