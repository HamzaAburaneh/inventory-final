<script>
	import { onNavigate } from '$app/navigation';
	import Navbar from '../components/Navbar.svelte';
	import '../styles/global.css';
	import { authStore } from '../stores/authStore.js';

	let { children } = $props();

	// Initialize auth listener on mount
	$effect(() => {
		authStore.init();
	});

	// Use Svelte's $ prefix for auto-subscription to stores
	const user = $derived($authStore);

	// Enable View Transitions API for smooth page transitions
	onNavigate((navigation) => {
		// @ts-ignore - startViewTransition may not exist in all browsers
		if (!document.startViewTransition) return;

		return new Promise((resolve) => {
			// @ts-ignore
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});
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

	/* View Transition Animations */
	@keyframes -global-fade-in {
		from {
			opacity: 0;
		}
	}

	@keyframes -global-fade-out {
		to {
			opacity: 0;
		}
	}

	@keyframes -global-slide-from-right {
		from {
			transform: translateX(20px);
		}
	}

	@keyframes -global-slide-to-left {
		to {
			transform: translateX(-20px);
		}
	}

	/* Custom view transition styles - no crossfade to avoid flash */
	:root::view-transition-old(root) {
		animation: 150ms cubic-bezier(0.4, 0, 0.2, 1) both slide-to-left;
	}

	:root::view-transition-new(root) {
		animation: 150ms cubic-bezier(0.4, 0, 0.2, 1) both slide-from-right;
	}

	/* Respect reduced motion preferences */
	@media (prefers-reduced-motion: reduce) {
		:root::view-transition-group(*),
		:root::view-transition-old(*),
		:root::view-transition-new(*) {
			animation: none !important;
		}
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
