<script>
	import Navbar from '../components/Navbar.svelte';
	import '../styles/global.css';
</script>

<Navbar />

<main>
	<slot />
</main>

<style>
	main {
		padding: 1rem;
	}
</style>
