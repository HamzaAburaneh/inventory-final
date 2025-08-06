<script>
	import Navbar from '../components/Navbar.svelte';
	import '../styles/global.css';
	import { authStore } from '../stores/authStore.js';
	import { browser } from '$app/environment';

	let { children } = $props();
	let user = $state(null);
	let viewportWidth = $state(browser ? window.innerWidth : 0);
	let viewportHeight = $state(browser ? window.innerHeight : 0);

	$effect(() => {
		authStore.init();
		const unsubscribe = authStore.subscribe((value) => {
			user = value;
		});

		return unsubscribe;
	});

	// Monitor viewport changes
	$effect(() => {
		if (!browser) return;

		let resizeTimer;
		
		function handleResize() {
			clearTimeout(resizeTimer);
			resizeTimer = setTimeout(() => {
				const newWidth = window.innerWidth;
				const newHeight = window.innerHeight;
				
				// Only update if there's a significant change to avoid unnecessary updates
				if (Math.abs(newWidth - viewportWidth) > 10 || Math.abs(newHeight - viewportHeight) > 10) {
					console.log(`Viewport changed: ${viewportWidth}x${viewportHeight} -> ${newWidth}x${newHeight}`);
					
					viewportWidth = newWidth;
					viewportHeight = newHeight;
					
					// Log current device type
					const deviceType = newWidth < 768 ? 'mobile' : newWidth < 1024 ? 'tablet' : 'desktop';
					console.log(`Device type: ${deviceType}`);
				}
			}, 100);
		}

		window.addEventListener('resize', handleResize);
		window.addEventListener('orientationchange', handleResize);
		
		// Initial log
		console.log(`Initial viewport: ${viewportWidth}x${viewportHeight}`);

		return () => {
			window.removeEventListener('resize', handleResize);
			window.removeEventListener('orientationchange', handleResize);
			clearTimeout(resizeTimer);
		};
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
