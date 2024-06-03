<!-- src/routes/+layout.svelte -->
<script>
	import ThemeToggle from '../components/ThemeToggle.svelte';
	import '../styles/global.css';
</script>

<main>
	<ThemeToggle />
	<slot />
</main>

<style>
	main {
		padding: 1rem;
	}
</style>
