<script>
	import Navbar from '../components/Navbar.svelte';
	import '../styles/global.css';
	import { authStore } from '../stores/authStore.js';
	import { onMount } from 'svelte';
	import { onNavigate } from '$app/navigation';
	import { page } from '$app/stores';

	let { children } = $props();
	const user = $derived($authStore);
	const pathname = $derived($page.url.pathname);

	// Enter animation runs only after the first client-side navigation — never on
	// the initial cold page load (which should appear immediately, no fade).
	let navigated = $state(false);

	onMount(() => {
		authStore.init();
	});

	// Coordinated page transition. We fade the OUTGOING page out before committing
	// the navigation, then let the incoming page fade in.
	//
	// Why fade the outgoing page (and delay the swap) rather than just fade the
	// incoming one: right after a navigation the main thread is busy mounting the
	// new page (ThreeScene/WebGL, Chart.js, effects). An enter animation has
	// nothing painted to fade yet, so it finishes before the content appears and
	// looks instant. The outgoing page, by contrast, is already painted and the
	// main thread is idle, so its fade-out renders smoothly. Delaying the swap
	// until it finishes also guarantees the two pages never overlap (the old
	// "landing flash").
	onNavigate((navigation) => {
		if (navigation.to?.url?.pathname === navigation.from?.url?.pathname) return;
		navigated = true;

		const main = document.querySelector('main.main-container');
		const current = main?.firstElementChild;
		if (!current) return;

		// Reduced motion: skip the fade, but still remove the outgoing page from
		// layout so the two pages can't overlap (the "landing flash").
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			current.style.display = 'none';
			return;
		}

		current.classList.add('route-leaving');
		return new Promise((resolve) => {
			let done = false;
			const finish = () => {
				if (done) return;
				done = true;
				// Remove the faded-out page from layout so it can't overlap the
				// incoming page while its outro transitions finish unmounting.
				current.style.display = 'none';
				resolve();
			};
			current.addEventListener('animationend', finish, { once: true });
			setTimeout(finish, 220); // fallback if animationend doesn't fire
		});
	});
</script>

<Navbar {user} />

<main class="main-container">
	<!-- Keyed on the route so the wrapper is recreated on every client-side
	     navigation, which replays the CSS fade-in below. CSS animations (not
	     Svelte JS transitions) are used so the fade runs on the compositor rather
	     than rAF, and opacity-only keeps the home/login `position:fixed`
	     ThreeScene canvas correctly positioned (transform/filter would not). -->
	{#key pathname}
		<div class="route" class:animate={navigated}>
			{@render children()}
		</div>
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

	/* Mirrors <main>'s flex centering so wrapping the page in this element does
	   not change any page's layout. */
	.route {
		width: 100%;
		display: flex;
		justify-content: center;
	}

	/* Enter fade — only on client-side navigations (see `navigated`). */
	.route.animate {
		animation: route-fade-in 360ms cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	/* Applied to the outgoing page in onNavigate. `route-leaving` is added via JS,
	   so it must be :global or Svelte prunes the rule as "unused". Defined after
	   `.route.animate` so it wins the `animation` cascade (the outgoing page may
	   still carry `.animate` from its own entrance). */
	.route:global(.route-leaving) {
		animation: route-fade-out 160ms ease forwards;
	}

	@keyframes route-fade-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes route-fade-out {
		from {
			opacity: 1;
		}
		to {
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.route.animate,
		.route:global(.route-leaving) {
			animation: none;
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
