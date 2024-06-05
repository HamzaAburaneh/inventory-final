<script>
	import ThemeToggle from '../components/ThemeToggle.svelte';
	import Navbar from '../components/Navbar.svelte';
	import '../styles/global.css';
	import { onMount } from 'svelte';
	import { theme } from '../themes';
	import { get } from 'svelte/store';

	let currentTheme = get(theme);

	onMount(() => {
		if (typeof document !== 'undefined') {
			document.documentElement.setAttribute('data-theme', currentTheme);
		}
	});
</script>

<Navbar />

<main>
	<ThemeToggle />
	<slot />
</main>

<style>
	main {
		padding: 1rem;
	}
</style>
