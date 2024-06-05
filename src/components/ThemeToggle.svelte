<!-- src/components/ThemeToggle.svelte -->
<script lang="ts">
	import { theme } from '../themes';
	import { get } from 'svelte/store';
	import { onMount } from 'svelte';

	let currentTheme = get(theme);

	// Function to toggle the theme
	function toggleTheme() {
		currentTheme = currentTheme === 'light' ? 'dark' : 'light';
		theme.set(currentTheme);
		if (typeof window !== 'undefined') {
			localStorage.setItem('theme', currentTheme);
		}
	}

	// Reactive statement to update the data-theme attribute
	$: {
		if (typeof document !== 'undefined') {
			document.documentElement.setAttribute('data-theme', currentTheme);
		}
	}

	// Ensure the correct theme is set on mount
	onMount(() => {
		if (typeof document !== 'undefined') {
			document.documentElement.setAttribute('data-theme', currentTheme);
		}
	});
</script>

<button on:click={toggleTheme}>
	{currentTheme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
</button>
