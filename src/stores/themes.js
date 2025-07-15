import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const themes = {
	light: {
		name: 'Light',
		colors: {
			primary: '#3b82f6',
			secondary: '#64748b',
			accent: '#06b6d4',
			background: '#ffffff',
			surface: '#f8fafc',
			text: '#1e293b',
			textSecondary: '#64748b',
			border: '#e2e8f0',
			success: '#10b981',
			warning: '#f59e0b',
			error: '#ef4444',
			info: '#3b82f6'
		}
	},
	dark: {
		name: 'Dark',
		colors: {
			primary: '#60a5fa',
			secondary: '#94a3b8',
			accent: '#22d3ee',
			background: '#0f172a',
			surface: '#1e293b',
			text: '#f1f5f9',
			textSecondary: '#94a3b8',
			border: '#334155',
			success: '#34d399',
			warning: '#fbbf24',
			error: '#f87171',
			info: '#60a5fa'
		}
	},
	blue: {
		name: 'Blue',
		colors: {
			primary: '#2563eb',
			secondary: '#475569',
			accent: '#0ea5e9',
			background: '#f8fafc',
			surface: '#f1f5f9',
			text: '#1e293b',
			textSecondary: '#475569',
			border: '#cbd5e1',
			success: '#059669',
			warning: '#d97706',
			error: '#dc2626',
			info: '#2563eb'
		}
	},
	green: {
		name: 'Green',
		colors: {
			primary: '#16a34a',
			secondary: '#6b7280',
			accent: '#059669',
			background: '#f9fafb',
			surface: '#f3f4f6',
			text: '#111827',
			textSecondary: '#6b7280',
			border: '#d1d5db',
			success: '#16a34a',
			warning: '#d97706',
			error: '#dc2626',
			info: '#2563eb'
		}
	}
};

function createThemeStore() {
	// Get initial theme from localStorage or default to 'light'
	const getInitialTheme = () => {
		if (browser) {
			const stored = localStorage.getItem('theme');
			return stored && themes[stored] ? stored : 'light';
		}
		return 'light';
	};

	const currentTheme = writable(getInitialTheme());

	function setTheme(themeName) {
		if (themes[themeName]) {
			currentTheme.set(themeName);
			if (browser) {
				localStorage.setItem('theme', themeName);
				applyThemeToDocument(themes[themeName]);
			}
		}
	}

	function applyThemeToDocument(theme) {
		if (!browser) return;
		
		const root = document.documentElement;
		Object.entries(theme.colors).forEach(([key, value]) => {
			root.style.setProperty(`--color-${key}`, value);
		});
	}

	function getTheme(themeName) {
		return themes[themeName] || themes.light;
	}

	function getAllThemes() {
		return themes;
	}

	function getThemeNames() {
		return Object.keys(themes);
	}

	// Initialize theme on store creation
	if (browser) {
		const initialTheme = getInitialTheme();
		applyThemeToDocument(themes[initialTheme]);
	}

	return {
		subscribe: currentTheme.subscribe,
		setTheme,
		getTheme,
		getAllThemes,
		getThemeNames,
		applyThemeToDocument
	};
}

export const themeStore = createThemeStore();
export { themes };