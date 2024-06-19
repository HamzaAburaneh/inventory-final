<script>
	import Navbar from '../components/Navbar.svelte';
	import '../styles/global.css';
</script>

<Navbar />

<main class="main-container">
	<slot />
</main>

<style>
	main {
		padding: 1rem;
		display: flex;
		justify-content: center;
		/* align-items: center; */
		/* min-height: 80vh; */
	}
</style>
