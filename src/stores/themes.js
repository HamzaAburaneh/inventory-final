import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// The app themes via the `[data-theme]` attribute (see ThemeToggle.svelte + global.css).
// Only 'light' and 'dark' are reachable from the UI toggle.
const VALID_THEMES = ['light', 'dark'];

function createThemeStore() {
	// Get initial theme from localStorage or default to 'light'
	const getInitialTheme = () => {
		if (browser) {
			const stored = localStorage.getItem('theme');
			return stored && VALID_THEMES.includes(stored) ? stored : 'light';
		}
		return 'light';
	};

	const currentTheme = writable(getInitialTheme());

	function setTheme(themeName) {
		if (VALID_THEMES.includes(themeName)) {
			currentTheme.set(themeName);
			if (browser) {
				localStorage.setItem('theme', themeName);
			}
		}
	}

	return {
		subscribe: currentTheme.subscribe,
		setTheme
	};
}

export const themeStore = createThemeStore();
