<script>
	import { onNavigate, beforeNavigate, afterNavigate } from '$app/navigation';
	import Navbar from '../components/Navbar.svelte';
	import '../styles/global.css';
	import { authStore } from '../stores/authStore.js';

	let { children } = $props();
	let isNavigating = $state(false);

	// Initialize auth listener on mount
	$effect(() => {
		authStore.init();
	});

	// Use Svelte's $ prefix for auto-subscription to stores
	const user = $derived($authStore);

	// Navigation progress indicator
	beforeNavigate(() => {
		isNavigating = true;
	});

	afterNavigate(() => {
		isNavigating = false;
	});

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

<!-- Navigation progress accent line -->
<div class="nav-progress" class:active={isNavigating}>
	<div class="nav-progress-bar"></div>
</div>

<Navbar {user} />

<main class="main-container">
	{@render children()}
</main>

<style>
	/* Navigation Progress Bar */
	.nav-progress {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		height: 2px;
		z-index: 9999;
		pointer-events: none;
		opacity: 0;
	}

	.nav-progress.active {
		opacity: 1;
	}

	.nav-progress-bar {
		height: 100%;
		background: var(--nav-logo-color);
		transform: scaleX(0);
		transform-origin: left;
	}

	.nav-progress.active .nav-progress-bar {
		animation: progress-load 250ms ease-out forwards;
	}

	@keyframes progress-load {
		to {
			transform: scaleX(1);
		}
	}

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

	/* Clean, fast page transition */
	:root::view-transition-old(root) {
		animation: 150ms ease-out both fade-out;
	}

	:root::view-transition-new(root) {
		animation: 150ms ease-out 100ms both fade-in;
	}

	@keyframes -global-fade-out {
		to {
			opacity: 0;
		}
	}

	@keyframes -global-fade-in {
		from {
			opacity: 0;
		}
	}

	/* Navbar stays fixed */
	:root::view-transition-old(navbar),
	:root::view-transition-new(navbar) {
		animation: none;
	}

	/* Respect reduced motion */
	@media (prefers-reduced-motion: reduce) {
		:root::view-transition-old(root),
		:root::view-transition-new(root) {
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
