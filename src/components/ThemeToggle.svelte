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

<button on:click={toggleTheme} class="text-white">
	{#if currentTheme === 'light'}
		<img src="/icons/moon.svg" alt="Switch to Light Mode" class="icon" />
	{:else}
		<img src="/icons/sun.svg" alt="Switch to Dark Mode" class="icon" />
	{/if}
</button>

<style>
	button {
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.icon {
		width: 24px;
		height: 24px;
		filter: var(--icon-filter);
	}
</style>
