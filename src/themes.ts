import { writable } from 'svelte/store';

export const theme = writable('dark');

type Theme = {
	[key: string]: string;
};

export const themes: Record<string, Theme> = {
	light: {
		'--icon-filter':
			'invert(0%) sepia(100%) saturate(1000%) hue-rotate(30deg) brightness(100%) contrast(100%)' // Filter for light mode
	},
	dark: {
		'--icon-filter':
			'invert(100%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(100%) contrast(100%)' // Filter for dark mode
	}
};

theme.subscribe((value) => {
	if (typeof document !== 'undefined') {
		const currentTheme = themes[value];
		if (currentTheme) {
			for (const [key, val] of Object.entries(currentTheme)) {
				(document.documentElement as HTMLElement).style.setProperty(key, val);
			}
		}
	}
});
