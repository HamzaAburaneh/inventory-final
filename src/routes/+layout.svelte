<script>
	import { fade } from 'svelte/transition';
	import { page } from '$app/stores';
	import Navbar from '../components/Navbar.svelte';
	import '../styles/global.css';
	import { authStore } from '../stores/authStore.js';

	let { children } = $props();

	// Get the current pathname from page store using $derived
	const pathname = $derived($page.url.pathname);

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
	{#key pathname}
		<div class="page-transition-wrapper" in:fade={{ duration: 200 }} out:fade={{ duration: 200 }}>
			{@render children()}
		</div>
	{/key}
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
		position: relative;
	}

	.page-transition-wrapper {
		width: 100%;
		position: absolute;
		top: 0;
		left: 0;
		padding: inherit;
		display: flex;
		flex-direction: column;
		align-items: center;
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
