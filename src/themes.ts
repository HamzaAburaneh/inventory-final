import { writable } from 'svelte/store';

export const theme = writable('dark');

type Theme = {
	[key: string]: string;
};

export const themes: Record<string, Theme> = {
	light: {
		'--background-color': '#ffffff',
		'--text-color': '#000000'
	},
	dark: {
		'--background-color': '#121212',
		'--text-color': '#ffffff'
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
