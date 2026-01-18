<script>
	import Navbar from '../components/Navbar.svelte';
	import '../styles/global.css';
	import { authStore } from '../stores/authStore.js';
	import { page } from '$app/stores';

	let { children } = $props();

	// Initialize auth listener on mount
	// Using $effect for initialization that needs cleanup
	$effect(() => {
		authStore.init();
	});

	// Use Svelte's $ prefix for auto-subscription to stores
	// This is cleaner than manual subscribe/unsubscribe in $effect
	const user = $derived($authStore);

	// Get current route for keying page transitions
	const currentRoute = $derived($page.url.pathname);
</script>

<Navbar {user} />

<main class="main-container">
	{#key currentRoute}
		{@render children()}
	{/key}
</main>

<style>
	main {
		padding: 1rem;
		display: flex;
		justify-content: center;
		width: 100%;
		min-height: calc(100vh - 80px);
		overflow-x: auto; /* Changed from hidden to auto to allow scrolling if needed */
		overflow-y: visible;
	}

	@media (max-width: 480px) {
		main {
			padding: 0.5rem;
		}
	}

	@media (min-width: 1024px) {
		main {
			padding: 1.5rem;
		}
	}

	@media (orientation: landscape) and (max-height: 500px) {
		main {
			padding-top: 0.25rem;
			padding-bottom: 0.25rem;
		}
	}
</style>
