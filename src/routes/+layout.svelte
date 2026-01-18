<script>
	import Navbar from '../components/Navbar.svelte';
	import '../styles/global.css';
	import { authStore } from '../stores/authStore.js';

	let { children } = $props();

	// Initialize auth listener on mount
	// Using $effect for initialization that needs cleanup
	$effect(() => {
		authStore.init();
	});

	// Use Svelte's $ prefix for auto-subscription to stores
	// This is cleaner than manual subscribe/unsubscribe in $effect
	const user = $derived($authStore);
</script>

<Navbar {user} />

<main class="main-container">
	{@render children()}
</main>

<style>
	main {
		padding: 1rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		width: 100%;
		min-height: calc(100vh - 80px);
		overflow-x: hidden;
		overflow-y: visible;
	}

	/* Ensure page content takes full width and prevents side-by-side rendering */
	main > :global(*) {
		width: 100%;
		max-width: 100%;
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
