<!-- src/components/ThemeToggle.svelte -->
<script lang="ts">
	import { theme } from '../themes';
	import { get } from 'svelte/store';

	let currentTheme = get(theme);

	function toggleTheme() {
		currentTheme = currentTheme === 'light' ? 'dark' : 'light';
		theme.set(currentTheme);
	}
</script>

<button on:click={toggleTheme}>
	{currentTheme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
</button>
