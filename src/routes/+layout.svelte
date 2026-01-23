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
	/* Navigation Progress Indicator */
	.nav-progress {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		height: 3px;
		z-index: 9999;
		pointer-events: none;
		opacity: 0;
		transition: opacity 0.15s ease;
	}

	.nav-progress.active {
		opacity: 1;
	}

	.nav-progress-bar {
		height: 100%;
		background: linear-gradient(
			90deg,
			transparent 0%,
			var(--nav-logo-color) 15%,
			var(--nav-logo-hover-color) 50%,
			var(--nav-logo-color) 85%,
			transparent 100%
		);
		transform: translateX(-100%);
		animation: none;
	}

	.nav-progress.active .nav-progress-bar {
		animation: progress-sweep 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
	}

	@keyframes progress-sweep {
		0% {
			transform: translateX(-100%);
		}
		100% {
			transform: translateX(100%);
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

	/* View Transition Animations - Subtle Sass Edition */

	/* Old page: graceful exit with depth */
	@keyframes -global-page-exit {
		0% {
			opacity: 1;
			transform: translateX(0) scale(1);
			filter: blur(0);
		}
		100% {
			opacity: 0;
			transform: translateX(-3%) scale(0.98);
			filter: blur(2px);
		}
	}

	/* New page: confident entrance with spring */
	@keyframes -global-page-enter {
		0% {
			opacity: 0;
			transform: translateX(5%) scale(1.01);
			filter: blur(3px);
		}
		60% {
			opacity: 1;
			transform: translateX(-0.5%) scale(0.995);
			filter: blur(0);
		}
		100% {
			opacity: 1;
			transform: translateX(0) scale(1);
			filter: blur(0);
		}
	}

	/* Subtle glow pulse on the transition group */
	@keyframes -global-transition-glow {
		0%,
		100% {
			box-shadow: none;
		}
		50% {
			box-shadow: 0 0 40px rgba(255, 226, 96, 0.08);
		}
	}

	/* Custom view transition styles */
	:root::view-transition-old(root) {
		animation: 180ms cubic-bezier(0.4, 0, 0.6, 1) both page-exit;
		transform-origin: left center;
	}

	:root::view-transition-new(root) {
		animation: 280ms cubic-bezier(0.22, 1, 0.36, 1) both page-enter;
		transform-origin: right center;
	}

	:root::view-transition-group(root) {
		animation: 300ms ease-out transition-glow;
	}

	/* Keep navbar crisp during transitions */
	:root::view-transition-old(navbar),
	:root::view-transition-new(navbar) {
		animation: none;
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
