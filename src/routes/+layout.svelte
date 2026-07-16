<script>
	import Navbar from '../components/Navbar.svelte';
	import OfflineIndicator from '../components/OfflineIndicator.svelte';
	import VerifyEmailBanner from '../components/VerifyEmailBanner.svelte';
	import Notification from '../components/Notification.svelte';
	import '../styles/global.css';
	import { authStore, authReady } from '../stores/authStore.js';
	import { groupStore } from '../stores/groupStore.js';
	import { onMount } from 'svelte';
	import { onNavigate, goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';

	let { children, data } = $props();
	const user = $derived($authStore);
	const ready = $derived($authReady);
	const group = $derived($groupStore);
	const pathname = $derived($page.url.pathname);

	// Until Firebase confirms the session (authReady), drive the navbar from the
	// server-provided hint cookie. This makes SSR and the first client render
	// produce the same navbar (no hydration mismatch) and shows the signed-in
	// shell on the first paint — no logged-out flash. Once ready, the real
	// authStore user takes over and a stale hint self-corrects.
	const navUser = $derived(ready ? user : (data?.hintedUser ?? null));

	// Routes that require an authenticated user. A logged-out visitor reaching one
	// of these by direct URL is redirected to /login; until Firebase has reported
	// the initial auth state we hold content back so protected data never flashes.
	const PROTECTED = [
		'/manageItems',
		'/manageTransactions',
		'/transactionHistory',
		'/transactionAnalysis',
		'/inventoryPredictions',
		'/profile'
	];
	const isProtected = $derived(
		PROTECTED.some((p) => pathname === p || pathname.startsWith(p + '/'))
	);

	// Resolve the signed-in user's group once Firebase reports auth state. This
	// sets the active-group singleton the data layer reads (and clears it on
	// logout), so protected pages have a group before they query Firestore.
	$effect(() => {
		if (!ready) return;
		groupStore.resolve(user);
	});

	// A protected page must not mount until its group is resolved, or its
	// group-scoped Firestore reads would throw for lack of an active group.
	const showContent = $derived(!isProtected || (ready && !!user && group.status === 'ready'));

	$effect(() => {
		if (!ready) return;
		if (isProtected && !user) {
			goto(resolve('/login'));
		} else if (isProtected && user && group.status === 'none') {
			// Signed in but not in a group yet — send them to onboarding to
			// create or join one before any inventory page can load.
			goto(resolve('/onboarding'));
		}
	});

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

<a class="skip-link" href="#main-content">Skip to main content</a>
<Navbar user={navUser} />
<OfflineIndicator />
<Notification />
{#if ready}
	<VerifyEmailBanner />
{/if}

<main id="main-content" class="main-container" tabindex="-1">
	<!-- Keyed on the route so the wrapper is recreated on every client-side
	     navigation, which replays the CSS fade-in below. CSS animations (not
	     Svelte JS transitions) are used so the fade runs on the compositor rather
	     than rAF, and opacity-only keeps the home/login `position:fixed`
	     ThreeScene canvas correctly positioned (transform/filter would not). -->
	{#key pathname}
		<div class="route" class:animate={navigated}>
			{#if showContent}
				{@render children()}
			{:else}
				<div class="auth-gate" aria-busy="true" aria-live="polite">
					<div class="auth-spinner"></div>
					<span class="sr-only">Checking your session…</span>
				</div>
			{/if}
		</div>
	{/key}
</main>

<style>
	.skip-link {
		position: fixed;
		top: 0.5rem;
		left: 0.5rem;
		z-index: 2000;
		padding: 0.65rem 1rem;
		border: 2px solid var(--input-focus-border);
		border-radius: var(--border-radius);
		background: var(--container-bg);
		color: var(--text-color);
		font-weight: 700;
		text-decoration: none;
		transform: translateY(calc(-100% - 1rem));
		transition: transform 160ms ease;
	}

	.skip-link:focus-visible {
		outline: 3px solid var(--input-focus-border);
		outline-offset: 2px;
		transform: translateY(0);
	}

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

	/* Shown on protected routes until Firebase reports the initial auth state. */
	.auth-gate {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: calc(100vh - 160px);
		width: 100%;
	}

	.auth-spinner {
		width: 2.5rem;
		height: 2.5rem;
		border-radius: 50%;
		border: 3px solid var(--table-border-color);
		border-top-color: var(--tech-accent);
		animation: auth-spin 0.8s linear infinite;
	}

	@keyframes auth-spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.auth-spinner {
			animation-duration: 2s;
		}
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
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
