<script>
	import { authStore } from '../stores/authStore.js';
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';
	import { fly } from 'svelte/transition';
	import ScrollReveal from '../components/ScrollReveal.svelte';
	import ThreeScene from '../components/ThreeScene.svelte';
	import {
		createGestureTracker,
		keyToPageIntent,
		nextTarget,
		normalizeWheelDelta
	} from '../lib/sectionPager.js';

	const authUser = $derived($authStore);

	// Hero headline: the final word rotates through a short list. The static copy
	// in the visually-hidden span keeps the heading readable for screen readers.
	const rotatingWords = ['precision', 'foresight', 'clarity', 'confidence'];
	let wordIndex = $state(0);
	let reduceMotion = $state(false);

	$effect(() => {
		const query = window.matchMedia('(prefers-reduced-motion: reduce)');
		reduceMotion = query.matches;
		const onChange = () => (reduceMotion = query.matches);
		query.addEventListener('change', onChange);
		return () => query.removeEventListener('change', onChange);
	});

	// Cycle the headline word; honour reduced-motion and the pause-motion
	// control (WCAG 2.2.2) by never starting the timer while either is active.
	$effect(() => {
		if (reduceMotion) return;
		const id = setInterval(() => {
			wordIndex = (wordIndex + 1) % rotatingWords.length;
		}, 2600);
		return () => clearInterval(id);
	});

	const sections = [
		{ id: 'intro', label: 'Overview' },
		{ id: 'inventory', label: 'Inventory control' },
		{ id: 'traceability', label: 'Transaction traceability' },
		{ id: 'predictions', label: 'Inventory predictions' },
		{ id: 'closing', label: 'Get started' }
	];
	const firstSectionId = sections[0].id;
	const canonicalHref = $derived(`${$page.url.origin}${$page.url.pathname}`);
	const sampleTimeFormatter = new Intl.DateTimeFormat('en-CA', {
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
		timeZone: 'UTC'
	});
	const sampleAddedTime = sampleTimeFormatter.format(new Date('2026-01-15T09:42:00Z'));
	const sampleRemovedTime = sampleTimeFormatter.format(new Date('2026-01-15T14:18:00Z'));

	let activeSection = $state(firstSectionId);
	// Index of the active panel; dots at or before it read as "done" (see the rail).
	const activeIndex = $derived(
		Math.max(
			0,
			sections.findIndex((section) => section.id === activeSection)
		)
	);
	// Drives the rail's progress track: 0 at the first panel, 1 at the last.
	const railProgress = $derived(activeIndex / (sections.length - 1));

	function scrollToSection(sectionId) {
		const section = document.getElementById(sectionId);
		if (!section) return;
		const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		section.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
		// Keep focus in sync with the visual position: screen-reader and keyboard
		// users land on the section instead of staying on the rail stop they used.
		section.focus({ preventScroll: true });
	}

	// Scope section-snap scrolling to the homepage document scroller.
	$effect(() => {
		document.documentElement.classList.add('home-snap');
		return () => document.documentElement.classList.remove('home-snap');
	});

	// Keep the established one-section-per-wheel-gesture behavior. Direction and
	// inertia decisions remain in sectionPager.js so the tested rules stay pure.
	// Keyboard paging (arrows/PageUp/PageDown/Home/End, the fullPage.js convention)
	// shares the same snap targets and focus sync; the wheel hijack stays off under
	// reduced motion, while keys keep working there (scrollToSection jumps instantly).
	$effect(() => {
		const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
		const navEl = document.querySelector('nav.navbar');
		const tracker = createGestureTracker();
		let animating = false;
		let animationId = 0;

		function navHeight() {
			return navEl?.offsetHeight ?? 0;
		}

		function setOffsets() {
			document.documentElement.style.setProperty('--snap-top', `${navHeight()}px`);
			const firstSection = document.getElementById(firstSectionId);
			if (firstSection) {
				firstSection.style.scrollMarginTop = `${
					firstSection.getBoundingClientRect().top + window.scrollY
				}px`;
			}
		}

		function targets() {
			const maxScroll = Math.max(
				0,
				(document.scrollingElement?.scrollHeight ?? 0) - window.innerHeight
			);
			return sections
				.map((section) => document.getElementById(section.id))
				.filter(Boolean)
				.map((element) =>
					element.id === firstSectionId
						? 0
						: Math.min(
								Math.round(element.getBoundingClientRect().top + window.scrollY - navHeight()),
								maxScroll
							)
				);
		}

		function pageTo(targetY) {
			const currentAnimationId = ++animationId;
			animating = true;
			window.scrollTo({ top: targetY, behavior: 'smooth' });
			const start = performance.now();

			function checkPosition() {
				if (currentAnimationId !== animationId) return;
				if (Math.abs(window.scrollY - targetY) < 4 || performance.now() - start > 900) {
					animating = false;
					return;
				}
				requestAnimationFrame(checkPosition);
			}

			requestAnimationFrame(checkPosition);
		}

		function onWheel(event) {
			if (event.ctrlKey || window.innerHeight <= 540) return;
			event.preventDefault();
			const delta = normalizeWheelDelta(event.deltaY, event.deltaMode, window.innerHeight);
			const direction = tracker.feed(delta, performance.now(), animating);
			if (direction === 0) return;
			const target = nextTarget(targets(), window.scrollY, direction);
			if (target !== undefined) {
				pageTo(target);
			} else if (animating) {
				animationId += 1;
				window.scrollTo({ top: window.scrollY, behavior: 'instant' });
				animating = false;
			}
		}

		function onKeydown(event) {
			if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey) return;
			const target = event.target;
			// Never hijack keys from form fields or editable regions (WCAG 2.1.2).
			if (
				target instanceof HTMLElement &&
				(target.isContentEditable || target.closest('input, textarea, select'))
			) {
				return;
			}
			const intent = keyToPageIntent(event.key);
			if (!intent) return;
			let sectionId;
			if ('jump' in intent) {
				sectionId = intent.jump === 'first' ? firstSectionId : sections[sections.length - 1].id;
			} else {
				const list = targets();
				const position = nextTarget(list, window.scrollY, intent.dir);
				// Duplicated clamped targets (short docs) resolve toward the travel direction.
				const index = intent.dir > 0 ? list.indexOf(position) : list.lastIndexOf(position);
				sectionId = index === -1 ? undefined : sections[index]?.id;
			}
			// At either end there is no target: leave the key's native behavior alone.
			if (!sectionId) return;
			event.preventDefault();
			if (animating) {
				animationId += 1;
				animating = false;
			}
			scrollToSection(sectionId);
		}

		setOffsets();
		window.addEventListener('resize', setOffsets);
		window.addEventListener('keydown', onKeydown);
		if (!reduceMotionQuery.matches) {
			window.addEventListener('wheel', onWheel, { passive: false });
		}
		return () => {
			window.removeEventListener('resize', setOffsets);
			window.removeEventListener('keydown', onKeydown);
			window.removeEventListener('wheel', onWheel);
			document.documentElement.style.removeProperty('--snap-top');
		};
	});

	// Mirror the panel crossing the viewport center in the fixed navigation rail.
	$effect(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) activeSection = entry.target.id;
				}
			},
			{ rootMargin: '-42% 0px -42% 0px', threshold: 0 }
		);

		for (const section of sections) {
			const element = document.getElementById(section.id);
			if (element) observer.observe(element);
		}

		return () => observer.disconnect();
	});
</script>

<svelte:head>
	<title>StockSense | Inventory intelligence in focus</title>
	<meta
		name="description"
		content="StockSense brings inventory counts, traceable transaction history, low-stock thresholds, storage details, and resilient predictions into one clear operational view."
	/>
	<link rel="canonical" href={canonicalHref} />
	<meta property="og:title" content="StockSense | Inventory intelligence in focus" />
	<meta
		property="og:description"
		content="A clear operational view for inventory counts, transaction history, and predictive insights."
	/>
	<meta property="og:type" content="website" />
	<meta property="og:url" content={canonicalHref} />
</svelte:head>

<!-- Landing backdrop: the same breathing wireframe terrain that backs /login, so
     the two public pages share one scene. The canvas is fixed, alpha, z-index 0
     and pointer-events: none, which is the slot the old flat CSS wash occupied —
     the page content above it (z-index 1) is unaffected. ThreeScene reads the
     --scene-* variables, so it follows the theme toggle on its own. -->
<ThreeScene />

<nav class="rail" aria-label="Homepage panels" style:--rail-progress={railProgress}>
	{#each sections as section, index (section.id)}
		<button
			type="button"
			class="rail-stop"
			class:active={activeSection === section.id}
			class:done={index < activeIndex}
			onclick={() => scrollToSection(section.id)}
			aria-label="Go to {section.label}"
			aria-controls={section.id}
			aria-current={activeSection === section.id ? 'location' : undefined}
		>
			<span class="rail-label">{section.label}</span>
			<span class="rail-dot" aria-hidden="true"></span>
		</button>
	{/each}
</nav>

<div class="page">
	<section id="intro" class="panel hero" aria-labelledby="intro-heading" tabindex="-1">
		<div class="hero-layout">
			<div class="hero-copy">
				<p class="hero-badge">
					<span class="badge-shine-mask" aria-hidden="true">
						<span class="badge-shine-wedge"></span>
					</span>
					<span class="badge-shine-backdrop" aria-hidden="true"></span>
					<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
						<path
							fill-rule="evenodd"
							clip-rule="evenodd"
							d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z"
						/>
						<path
							fill-rule="evenodd"
							clip-rule="evenodd"
							d="M18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z"
						/>
						<path
							fill-rule="evenodd"
							clip-rule="evenodd"
							d="M16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"
						/>
					</svg>
					<span class="hero-badge-text">Smarter inventory. Better decisions.</span>
				</p>

				<h1 id="intro-heading">
					<span class="sr-only">Run your inventory with precision.</span>
					<span class="headline-visual" aria-hidden="true">
						<span class="headline-line headline-static">Run your inventory</span>
						<span class="headline-line headline-word">
							with <span class="rotator">
								{#each rotatingWords as ghost (ghost)}
									<span class="rotator-ghost">{ghost}</span>
								{/each}
								{#key wordIndex}
									<span
										class="rotator-word"
										in:fly={{ y: 18, duration: reduceMotion ? 0 : 460 }}
										out:fly={{ y: -18, duration: reduceMotion ? 0 : 300 }}
										>{rotatingWords[wordIndex]}</span
									>
								{/key}
							</span>
						</span>
					</span>
				</h1>
				<p class="hero-lede">
					StockSense brings inventory counts, transaction history, and predictive insights into one
					clear operational view.
				</p>
				<div class="actions" aria-label="StockSense actions">
					{#if authUser}
						<a href={resolve('/manageItems')} class="action action-primary">
							Open inventory
							<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
								<path
									d="M5 12h14M13 6l6 6-6 6"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								/>
							</svg>
						</a>
						<a href={resolve('/inventoryPredictions')} class="action-link">
							<span>Explore predictions</span>
							<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
								<path
									d="M4 17l5-5 4 4 7-8M15 8h5v5"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								/>
							</svg>
						</a>
					{:else}
						<a href={resolve('/login')} class="action action-primary">
							Open inventory
							<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
								<path
									d="M5 12h14M13 6l6 6-6 6"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								/>
							</svg>
						</a>
						<a href={resolve('/login')} class="action-link">
							<span>Explore predictions</span>
							<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
								<path
									d="M4 17l5-5 4 4 7-8M15 8h5v5"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								/>
							</svg>
						</a>
					{/if}
				</div>

				<ul class="hero-promises" aria-label="StockSense strengths">
					<li>
						<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
							<path
								stroke="currentColor"
								stroke-width="1.75"
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"
							/>
						</svg>
						<span class="promise-copy">
							<span class="promise-title">Accurate counts</span>
							<small>you can trust</small>
						</span>
					</li>
					<li>
						<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
							<path
								stroke="currentColor"
								stroke-width="1.75"
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
							/>
						</svg>
						<span class="promise-copy">
							<span class="promise-title">Real-time updates</span>
							<small>and visibility</small>
						</span>
					</li>
					<li>
						<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
							<path
								stroke="currentColor"
								stroke-width="1.75"
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941"
							/>
						</svg>
						<span class="promise-copy">
							<span class="promise-title">Predictive insights</span>
							<small>that drive action</small>
						</span>
					</li>
				</ul>
			</div>

			<div class="hero-stage" aria-hidden="true">
				<span class="hero-glow"></span>
				<div class="dashboard-shell glow-host">
					<span class="glow-bloom" aria-hidden="true"><i></i></span>
					<header class="dashboard-header">
						<div>
							<p>Overview</p>
							<span>Your inventory at a glance</span>
						</div>
						<span class="dashboard-period">
							<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
								<rect
									x="3"
									y="5"
									width="18"
									height="16"
									rx="2"
									stroke="currentColor"
									stroke-width="1.8"
								/>
								<path
									d="M3 10h18M8 3v4M16 3v4"
									stroke="currentColor"
									stroke-width="1.8"
									stroke-linecap="round"
								/>
							</svg>
							<span>This week</span>
							<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
								<path
									d="M7 10l5 5 5-5"
									stroke="currentColor"
									stroke-width="1.8"
									stroke-linecap="round"
									stroke-linejoin="round"
								/>
							</svg>
						</span>
					</header>

					<div class="dashboard-grid">
						<article class="float-card card-movement" style="--enter-delay: 60ms;">
							<div class="float-body">
								<div class="fc-head">
									<span class="fc-icon fc-icon-accent">
										<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
											<path
												d="M3 8l9-5 9 5v8l-9 5-9-5V8z"
												stroke="currentColor"
												stroke-width="1.8"
												stroke-linejoin="round"
											/>
											<path d="M3 8l9 5 9-5M12 13v8" stroke="currentColor" stroke-width="1.8" />
										</svg>
									</span>
									<span class="fc-label">Items counted today</span>
								</div>
								<div class="fc-metric-row">
									<p class="fc-metric">1,284</p>
									<span class="fc-pill fc-pill-add">+12%</span>
								</div>
								<div class="fc-bars">
									<span style="--h: 42%"></span>
									<span style="--h: 58%"></span>
									<span style="--h: 48%"></span>
									<span style="--h: 70%"></span>
									<span style="--h: 60%"></span>
									<span style="--h: 82%"></span>
									<span class="fc-bar-lead" style="--h: 100%"></span>
								</div>
								<span class="fc-caption">vs yesterday</span>
							</div>
						</article>

						<article class="float-card card-updated" style="--enter-delay: 240ms;">
							<div class="float-body fc-row">
								<span class="fc-avatar">
									<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
										<path
											d="M3 8l9-5 9 5v8l-9 5-9-5V8z"
											stroke="currentColor"
											stroke-width="1.8"
											stroke-linejoin="round"
										/>
										<path d="M3 8l9 5 9-5M12 13v8" stroke="currentColor" stroke-width="1.8" />
									</svg>
								</span>
								<div class="fc-row-main">
									<p class="fc-row-title">Count updated</p>
									<p class="fc-row-sub">Cold brew concentrate</p>
									<p class="fc-flow">
										<span>12</span>
										<span class="fc-arrow">→</span>
										<span>18</span>
										<span class="fc-tag-add">+6</span>
									</p>
									<p class="fc-row-meta">Just now · Mira P.</p>
								</div>
							</div>
						</article>

						<article class="float-card card-forecast" style="--enter-delay: 160ms;">
							<div class="float-body">
								<div class="fc-head">
									<span class="fc-icon fc-icon-accent">
										<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
											<rect
												x="3"
												y="4"
												width="18"
												height="17"
												rx="2"
												stroke="currentColor"
												stroke-width="1.8"
											/>
											<path
												d="M3 9h18M8 2v4M16 2v4"
												stroke="currentColor"
												stroke-width="1.8"
												stroke-linecap="round"
											/>
										</svg>
									</span>
									<span class="fc-label">Weekly forecast</span>
								</div>
								<dl class="fc-rows">
									<div>
										<dt>Projected demand</dt>
										<dd>320</dd>
									</div>
									<div>
										<dt>On hand</dt>
										<dd>180</dd>
									</div>
									<div class="fc-rows-total">
										<dt>Reorder by</dt>
										<dd class="fc-accent">Friday</dd>
									</div>
								</dl>
							</div>
						</article>

						<article class="float-card card-lowstock" style="--enter-delay: 340ms;">
							<div class="float-body fc-row">
								<span class="fc-avatar fc-avatar-warn">
									<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
										<path
											d="M12 3l9 16H3l9-16z"
											stroke="currentColor"
											stroke-width="1.8"
											stroke-linejoin="round"
										/>
										<path
											d="M12 10v4M12 17.5v.5"
											stroke="currentColor"
											stroke-width="1.8"
											stroke-linecap="round"
										/>
									</svg>
								</span>
								<div class="fc-lowstock-main">
									<div class="fc-lowstock-head">
										<p class="fc-row-title">Low stock alert</p>
										<span class="fc-lowstock-count">4 left</span>
									</div>
									<p class="fc-row-sub fc-row-sub-strong">Oat milk 1L</p>
									<div class="fc-progress"><span style="width: 16%"></span></div>
								</div>
							</div>
						</article>
					</div>

					<div class="dashboard-callout">
						<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
							<path
								fill-rule="evenodd"
								clip-rule="evenodd"
								d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z"
							/>
							<path
								fill-rule="evenodd"
								clip-rule="evenodd"
								d="M18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z"
							/>
							<path
								fill-rule="evenodd"
								clip-rule="evenodd"
								d="M16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"
							/>
						</svg>
						<span>
							<strong>Stay ahead with AI-powered demand forecasting.</strong>
							<small>Reduce stockouts and make every reorder count.</small>
						</span>
						<span class="dashboard-callout-link">
							<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
								<path
									d="M4 17l5-5 4 4 7-8M15 8h5v5"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								/>
							</svg>
							Explore forecast
						</span>
					</div>
				</div>
			</div>

			<!-- Illustrative customer row. The marks and names are placeholders for a
			     future real customer list, in the same spirit as the data-free demo
			     cards above; swap the <li> contents when real logos exist. -->
			<div class="operations-strip" aria-label="Trusted by modern operations">
				<p>Trusted by modern operations</p>
				<ul>
					<li>
						<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
							<path
								d="M7 4h7a4 4 0 0 1 0 8H7V4zM7 12h8a4 4 0 0 1 0 8H7v-8z"
								stroke="currentColor"
								stroke-width="1.7"
								stroke-linejoin="round"
							/>
						</svg>
						<span>BrewHub</span>
					</li>
					<li>
						<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
							<circle cx="12" cy="12" r="8.4" stroke="currentColor" stroke-width="1.7" />
							<path
								d="M12 6.6a5.4 5.4 0 1 0 3.9 9.1"
								stroke="currentColor"
								stroke-width="1.7"
								stroke-linecap="round"
							/>
						</svg>
						<span>Café Collective</span>
					</li>
					<li>
						<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
							<path
								d="M4.5 9.5h12v5a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5v-5z"
								stroke="currentColor"
								stroke-width="1.7"
								stroke-linejoin="round"
							/>
							<path
								d="M16.5 11h1.6a2.4 2.4 0 0 1 0 4.8h-1.6M8 3v3M12 3v3"
								stroke="currentColor"
								stroke-width="1.7"
								stroke-linecap="round"
							/>
						</svg>
						<span>Daily Grind</span>
					</li>
					<li>
						<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
							<circle cx="12" cy="12" r="8.4" stroke="currentColor" stroke-width="1.7" />
							<circle cx="12" cy="12" r="3.4" stroke="currentColor" stroke-width="1.7" />
						</svg>
						<span>Luna Eats</span>
					</li>
					<li>
						<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
							<path
								d="M2.5 18.5l5.2-8.4 3.4 4.6 2.3-3.2 5.1 7H2.5z"
								stroke="currentColor"
								stroke-width="1.7"
								stroke-linejoin="round"
							/>
							<path d="M13.4 11.5l2-2.8 2 2.8" stroke="currentColor" stroke-width="1.7" />
						</svg>
						<span>Peak Supplies</span>
					</li>
				</ul>
			</div>
		</div>
	</section>

	<section id="inventory" class="panel" aria-labelledby="inventory-heading" tabindex="-1">
		<ScrollReveal>
			<div class="panel-layout inventory-layout">
				<div class="section-copy">
					<h2 id="inventory-heading">One inventory. Zero guesswork.</h2>
					<p>
						See quantities, storage requirements, booth assignments, and low-stock thresholds
						without hunting through disconnected records.
					</p>
				</div>

				<article class="inventory-demo" aria-labelledby="inventory-demo-title">
					<header class="demo-header">
						<p>Example inventory record</p>
						<span class="status status-ok">In stock</span>
					</header>

					<div class="inventory-primary">
						<div class="item-identity">
							<span class="field-label">Item name</span>
							<h3 id="inventory-demo-title">Cold brew concentrate</h3>
							<p>Stock status: above the low-count threshold</p>
						</div>

						<dl class="inventory-counts">
							<div>
								<dt>Current count</dt>
								<dd>18</dd>
							</div>
							<div>
								<dt>Low-count threshold</dt>
								<dd>12</dd>
							</div>
						</dl>
					</div>

					<dl class="record-details">
						<div>
							<dt>Storage type</dt>
							<dd>Refrigerator</dd>
						</div>
						<div>
							<dt>Booth tags</dt>
							<dd class="booth-tags">
								<span>North bar</span>
								<span>Garden kiosk</span>
							</dd>
						</div>
					</dl>
				</article>
			</div>
		</ScrollReveal>
	</section>

	<section id="traceability" class="panel" aria-labelledby="traceability-heading" tabindex="-1">
		<ScrollReveal>
			<div class="panel-layout trace-layout">
				<div class="section-copy trace-copy">
					<h2 id="traceability-heading">Every count has a story.</h2>
					<p>
						StockSense records each addition and removal with the previous count, new count,
						timestamp, and responsible user.
					</p>
				</div>

				<article class="transaction-demo" aria-labelledby="transaction-demo-title">
					<header class="sequence-header">
						<h3 id="transaction-demo-title">Example transaction sequence</h3>
						<p>Each event preserves the complete count change.</p>
					</header>

					<ol class="transaction-list">
						<li class="transaction-event event-add">
							<span class="event-marker" aria-hidden="true">+</span>
							<div class="event-body">
								<div class="event-meta">
									<span class="action-label">Added 6</span>
									<time datetime="2026-01-15T09:42:00Z">Sample timestamp: {sampleAddedTime}</time>
								</div>
								<div class="count-flow" aria-label="Count changed from 12 to 18">
									<div>
										<span>Previous count</span>
										<strong>12</strong>
									</div>
									<span class="flow-word" aria-hidden="true">to</span>
									<div>
										<span>New count</span>
										<strong>18</strong>
									</div>
								</div>
								<p class="event-user">Recorded by <strong>Mira Patel</strong></p>
							</div>
						</li>

						<li class="transaction-event event-remove">
							<span class="event-marker" aria-hidden="true">−</span>
							<div class="event-body">
								<div class="event-meta">
									<span class="action-label">Removed 4</span>
									<time datetime="2026-01-15T14:18:00Z">Sample timestamp: {sampleRemovedTime}</time>
								</div>
								<div class="count-flow" aria-label="Count changed from 18 to 14">
									<div>
										<span>Previous count</span>
										<strong>18</strong>
									</div>
									<span class="flow-word" aria-hidden="true">to</span>
									<div>
										<span>New count</span>
										<strong>14</strong>
									</div>
								</div>
								<p class="event-user">Recorded by <strong>Sam Okafor</strong></p>
							</div>
						</li>
					</ol>
				</article>
			</div>
		</ScrollReveal>
	</section>

	<section id="predictions" class="panel" aria-labelledby="predictions-heading" tabindex="-1">
		<ScrollReveal>
			<div class="forecast-layout">
				<div class="section-copy forecast-copy">
					<h2 id="predictions-heading">Plan before stock runs low.</h2>
					<p>
						StockSense combines historical movement with resilient forecasting so teams can prepare
						for demand, even when the AI layer is unavailable.
					</p>
				</div>

				<figure class="forecast-demo">
					<figcaption>
						<strong>Illustrative forecast example</strong>
						<span>Example values show how the forecast view communicates uncertainty.</span>
					</figcaption>

					<div class="chart-wrap">
						<svg
							class="forecast-chart forecast-chart-desktop"
							viewBox="0 0 760 240"
							role="img"
							aria-labelledby="forecast-chart-title forecast-chart-description"
							preserveAspectRatio="xMidYMid meet"
						>
							<title id="forecast-chart-title">Illustrative inventory forecast</title>
							<desc id="forecast-chart-description">
								A historical inventory line transitions into a forecast with an uncertainty band and
								approaches a low-stock threshold.
							</desc>

							<rect class="forecast-zone" x="430" y="28" width="290" height="206" rx="10" />
							<line class="chart-grid" x1="40" y1="72" x2="720" y2="72" />
							<line class="chart-grid" x1="40" y1="126" x2="720" y2="126" />
							<line class="chart-grid" x1="40" y1="180" x2="720" y2="180" />
							<line class="threshold-line" x1="40" y1="211" x2="720" y2="211" />
							<line class="today-line" x1="430" y1="28" x2="430" y2="234" />

							<path
								class="confidence-area"
								d="M430 139 C510 137 596 151 720 169 L720 224 C600 205 510 177 430 159 Z"
							/>
							<path
								class="history-line"
								d="M40 72 C90 82 124 68 170 91 C218 115 250 93 298 122 C340 147 384 130 430 149"
							/>
							<path class="forecast-line" d="M430 149 C510 151 598 171 720 198" />

							<circle class="today-point" cx="430" cy="149" r="5" />
							<text class="chart-label" x="40" y="230">Historical movement</text>
							<text class="chart-label" x="632" y="230">Forecast region</text>
							<text class="threshold-label" x="48" y="204">Low-stock threshold</text>
							<text class="today-label" x="442" y="46">Today</text>
						</svg>

						<svg
							class="forecast-chart forecast-chart-mobile"
							viewBox="0 0 320 210"
							role="img"
							aria-labelledby="forecast-chart-title-mobile forecast-chart-description-mobile"
							preserveAspectRatio="xMidYMid meet"
						>
							<title id="forecast-chart-title-mobile">Illustrative inventory forecast</title>
							<desc id="forecast-chart-description-mobile">
								A historical inventory line transitions into a forecast with an uncertainty band and
								approaches a low-stock threshold.
							</desc>

							<rect class="forecast-zone" x="170" y="20" width="130" height="150" rx="8" />
							<line class="chart-grid" x1="20" y1="56" x2="300" y2="56" />
							<line class="chart-grid" x1="20" y1="96" x2="300" y2="96" />
							<line class="chart-grid" x1="20" y1="136" x2="300" y2="136" />
							<line class="threshold-line" x1="20" y1="154" x2="300" y2="154" />
							<line class="today-line" x1="170" y1="20" x2="170" y2="170" />

							<path
								class="confidence-area"
								d="M170 101 C208 103 252 114 300 128 L300 163 C252 151 207 130 170 116 Z"
							/>
							<path
								class="history-line"
								d="M20 47 C48 52 66 45 88 64 C110 81 132 70 151 92 C158 99 164 102 170 106"
							/>
							<path class="forecast-line" d="M170 106 C208 109 252 126 300 146" />

							<circle class="today-point" cx="170" cy="106" r="4" />
							<text class="chart-label" x="20" y="192">Historical movement</text>
							<text class="chart-label" x="224" y="192">Forecast region</text>
							<text class="threshold-label" x="24" y="149">Low-stock threshold</text>
							<text class="today-label" x="180" y="38">Today</text>
						</svg>
					</div>

					<div class="forecast-legend" aria-label="Forecast chart legend">
						<span><i class="legend-line legend-history" aria-hidden="true"></i>History</span>
						<span><i class="legend-line legend-forecast" aria-hidden="true"></i>Forecast</span>
						<span><i class="legend-band" aria-hidden="true"></i>Uncertainty range</span>
						<span><i class="legend-line legend-threshold" aria-hidden="true"></i>Threshold</span>
					</div>

					<div class="recommendation">
						<strong>Recommendation</strong>
						<p>Review replenishment before the forecast approaches the low-stock threshold.</p>
					</div>
				</figure>
			</div>
		</ScrollReveal>
	</section>

	<section id="closing" class="panel finale" aria-labelledby="closing-heading" tabindex="-1">
		<ScrollReveal>
			<div class="finale-content">
				<h2 id="closing-heading">Run inventory with foresight.</h2>
				<p>Move from reactive stock checks to a clear, traceable, prediction-ready workflow.</p>
				<div class="actions finale-actions">
					{#if authUser}
						<a href={resolve('/manageItems')} class="action action-primary">Open inventory</a>
						<a href={resolve('/inventoryPredictions')} class="action action-secondary"
							>View predictions</a
						>
					{:else}
						<a href={resolve('/login?mode=register')} class="action action-primary">Get started</a>
						<a href={resolve('/login')} class="action action-secondary">Sign in</a>
					{/if}
				</div>
			</div>
		</ScrollReveal>
	</section>
</div>

<style>
	/* ── Travelling edge highlight (badge + dashboard shell) ── */
	.glow-host {
		position: relative;
		/* Traps the bloom's negative z-index inside the host; without a stacking
		   context here it drops behind the page backdrop. */
		isolation: isolate;
	}

	/* Panel: rotating conic ring, two lobes 180deg apart. */
	.glow-host {
		position: relative;
		isolation: isolate;
	}

	.glow-host::before {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		padding: 1.5px;
		pointer-events: none;
		background: conic-gradient(
			from var(--ring-angle),
			var(--home-ring-rest) 0deg,
			var(--home-ring-trail) 52deg,
			var(--home-ring-lead) 90deg,
			var(--home-ring-trail) 128deg,
			var(--home-ring-rest) 180deg,
			var(--home-ring-trail) 232deg,
			var(--home-ring-lead) 270deg,
			var(--home-ring-trail) 308deg,
			var(--home-ring-rest) 360deg
		);
		-webkit-mask:
			linear-gradient(#000 0 0) content-box,
			linear-gradient(#000 0 0);
		-webkit-mask-composite: xor;
		mask:
			linear-gradient(#000 0 0) content-box,
			linear-gradient(#000 0 0);
		mask-composite: exclude;
		animation: ring-spin var(--ring-dur, 12s) linear infinite;
	}

	/* Bloom, behind the host's contents so the light washes the panel surface
	   and spills past the edge with the cards on top. Blur on the wrapper and
	   gradient on the child: `filter` applies before `mask`, so blurring a
	   masked ring on one element re-cuts hard edges out of the blurred result. */
	.glow-bloom {
		position: absolute;
		inset: calc(-1 * var(--bloom-spread, 10px));
		z-index: -1;
		border-radius: var(--bloom-radius, 30px);
		filter: blur(var(--bloom-blur, 14px));
		opacity: var(--bloom-alpha, 0.9);
		pointer-events: none;
	}

	.glow-bloom i {
		position: absolute;
		inset: 0;
		border-radius: inherit;
		padding: var(--bloom-thick, 9px);
		background: conic-gradient(
			from var(--ring-angle),
			var(--home-ring-zero) 0deg,
			var(--home-ring-trail) 56deg,
			var(--home-ring-lead) 90deg,
			var(--home-ring-trail) 124deg,
			var(--home-ring-zero) 180deg,
			var(--home-ring-trail) 236deg,
			var(--home-ring-lead) 270deg,
			var(--home-ring-trail) 304deg,
			var(--home-ring-zero) 360deg
		);
		-webkit-mask:
			linear-gradient(#000 0 0) content-box,
			linear-gradient(#000 0 0);
		-webkit-mask-composite: xor;
		mask:
			linear-gradient(#000 0 0) content-box,
			linear-gradient(#000 0 0);
		mask-composite: exclude;
		animation: ring-spin var(--ring-dur, 12s) linear infinite;
	}

	@keyframes ring-spin {
		to {
			--ring-angle: 360deg;
		}
	}

	.page {
		position: relative;
		z-index: 1;
		width: 100%;
		max-width: 1280px;
		margin: 0 auto;
		padding-right: calc(3.25rem + var(--safe-area-inset-right));
		padding-left: max(0.75rem, var(--safe-area-inset-left));
		color: var(--observatory-text);
		cursor: default;
	}

	/* The rail remains a side control on phones; content reserves its 48px lane. */
	.rail {
		position: fixed;
		right: max(0.125rem, var(--safe-area-inset-right));
		top: 50%;
		transform: translateY(-50%);
		z-index: 5;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0;
	}

	/* Track line behind the dots; the accent-filled share follows the active
	   section, doubling as a discrete progress indicator. */
	.rail::before {
		content: '';
		position: absolute;
		left: 50%;
		top: 24px;
		bottom: 24px;
		width: 2px;
		transform: translateX(-50%);
		border-radius: 999px;
		background: linear-gradient(
			to bottom,
			var(--observatory-accent) calc(var(--rail-progress, 0) * 100%),
			var(--observatory-border-strong) calc(var(--rail-progress, 0) * 100%)
		);
		transition: background 240ms ease;
	}

	.rail button.rail-stop {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 48px;
		height: 48px;
		min-width: 48px;
		min-height: 48px;
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: none;
		color: var(--observatory-text-muted);
		touch-action: manipulation;
		-webkit-tap-highlight-color: var(--observatory-accent-soft);
		transition:
			background-color 180ms ease,
			color 180ms ease;
	}

	.rail button.rail-stop:focus {
		outline: 0;
	}

	.rail button.rail-stop:focus-visible {
		outline: 3px solid var(--observatory-focus);
		outline-offset: -5px;
	}

	.rail-label {
		display: none;
	}

	.rail-dot {
		width: 9px;
		height: 9px;
		border: 2px solid var(--observatory-border-strong);
		border-radius: 50%;
		background: var(--observatory-rail-surface);
		/* Gap ring in the backdrop color masks the connecting line right at each
		   dot, so dots read as distinct beads instead of merging into the line. */
		box-shadow: 0 0 0 3px var(--observatory-rail-surface);
		transition:
			width 180ms ease,
			height 180ms ease,
			border-color 180ms ease,
			background-color 180ms ease,
			box-shadow 180ms ease,
			transform 180ms ease;
	}

	/* Panels already scrolled past read as completed steps: gold fill, but at the
	   resting size and with no ring, so the active dot still stands out. */
	.rail-stop.done .rail-dot {
		border-color: var(--observatory-accent);
		background: var(--observatory-accent);
	}

	/* Active state differs on three channels (size + fill + halo ring) so it
	   never relies on the subtle size change alone. */
	.rail-stop.active .rail-dot {
		width: 12px;
		height: 12px;
		border-color: var(--observatory-accent);
		background: var(--observatory-accent);
		box-shadow:
			0 0 0 3px var(--observatory-rail-surface),
			0 0 0 5px var(--observatory-accent-soft);
	}

	:global(html.home-snap) {
		scroll-snap-type: y proximity;
		scroll-behavior: smooth;
	}

	.panel {
		position: relative;
		min-height: max(620px, calc(100dvh - var(--snap-top, 56px) - 1rem));
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2.25rem 0;
		scroll-snap-align: start;
		scroll-snap-stop: always;
		scroll-margin-top: var(--snap-top, 56px);
	}

	/* Sections receive programmatic focus after rail/keyboard jumps. Mouse clicks
	   must never show a ring; scripted focus after a key press matches
	   :focus-visible, so keyboard users get a quiet confirmation of where they landed. */
	.panel:focus {
		outline: none;
	}

	.panel:focus-visible {
		outline: 2px solid var(--observatory-focus);
		outline-offset: -2px;
	}

	.panel > :global(.scroll-reveal) {
		width: 100%;
	}

	.panel-layout,
	.forecast-layout {
		width: 100%;
	}

	.section-copy {
		max-width: 42rem;
	}

	.section-copy h2,
	.finale-content h2 {
		margin: 0;
		font-size: clamp(2.25rem, 8.5vw, 4.6rem);
		font-weight: 650;
		line-height: 1.02;
		letter-spacing: -0.045em;
		color: var(--observatory-text);
		text-wrap: balance;
	}

	.section-copy p,
	.finale-content > p {
		max-width: 57ch;
		margin: 1.35rem 0 0;
		font-size: clamp(1rem, 2.2vw, 1.12rem);
		line-height: 1.7;
		color: var(--observatory-text-muted);
		text-wrap: pretty;
	}

	.hero {
		min-height: max(620px, calc(100dvh - var(--snap-top, 56px) - 1rem));
		padding-top: 3.25rem;
		padding-bottom: 3.25rem;
	}

	.hero-layout {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 2.75rem;
		align-items: stretch;
	}

	.hero-copy {
		position: relative;
		z-index: 1;
		isolation: isolate;
		max-width: 58rem;
		animation: hero-enter 700ms cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	/* The legibility plate that used to sit behind the copy is gone: the WebGL
	   terrain it was compensating for has been replaced by a calm gradient
	   backdrop, so the copy now sits directly on the page. */

	/* Explicit height rather than vertical padding, so the pill radius is a known
	   half of it and the shine's geometry below can match exactly. Both are in
	   whole pixels (not rem) on purpose: `.badge-shine-mask` flips 180deg to swap
	   which edge shows the travelling highlight, and that rotation only lands
	   pixel-for-pixel identical to the unrotated copy when its center sits on a
	   device-pixel boundary. A rem-based height (e.g. 1.9rem = 30.390625px at a
	   16px root) puts that center at a fractional pixel, so the flipped copy gets
	   anti-aliased slightly differently and one edge reads dimmer — worse at some
	   viewport sizes than others, since the page's vertical centering shifts which
	   sub-pixel row the badge lands on. */
	.hero-badge {
		position: relative;
		isolation: isolate;
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
		width: fit-content;
		height: 30px;
		margin: 0 0 1.65rem;
		padding: 0 0.85rem;
		border: 0;
		border-radius: 15px;
		overflow: hidden;
		/* The pill's own background IS the border colour; `.badge-shine-backdrop`
		   sits 1px inset with the true surface colour on top, revealing only a
		   1px ring — see the shine layers below for why. */
		background: var(--home-ring-rest);
		color: var(--observatory-text-muted);
		font-size: 0.72rem;
		font-weight: 650;
		line-height: 1;
		letter-spacing: 0.01em;
	}

	/* A "spotlight card" shine rather than a travelling ring: `.badge-shine-mask`
	   fades its content from opaque to transparent at the vertical midpoint, so
	   only the top half of whatever's inside it is ever visible. Nested inside
	   it, `.badge-shine-wedge` is a huge square (200% of the badge's width)
	   holding a narrow conic-gradient sliver, parked mostly above the badge and
	   centred horizontally, so only a small arc of it ever crosses into the
	   visible top half; a slow rotation sweeps that arc across the top edge,
	   and a periodic 180deg flip of the whole masked layer swaps which edge is
	   visible. Because `.badge-shine-backdrop` covers everything but the outer
	   1px, the sweep only ever reads as a highlight travelling along the
	   border. */
	.badge-shine-mask {
		position: absolute;
		inset: 0;
		overflow: hidden;
		border-radius: inherit;
		-webkit-mask: linear-gradient(#000, transparent 50%);
		mask: linear-gradient(#000, transparent 50%);
		animation: badge-shine-flip 6s steps(2, end) infinite;
	}

	.badge-shine-wedge {
		position: absolute;
		inset: 0 auto auto 50%;
		width: 200%;
		aspect-ratio: 1;
		translate: -50% -15%;
		rotate: -90deg;
		background: conic-gradient(
			from 0deg,
			var(--home-ring-zero) 0deg,
			var(--home-ring-zero) 336deg,
			var(--home-ring-trail) 348deg,
			var(--home-ring-lead) 356deg,
			var(--home-ring-lead) 4deg,
			var(--home-ring-trail) 12deg,
			var(--home-ring-zero) 24deg,
			var(--home-ring-zero) 360deg
		);
		animation: badge-shine-sweep 3s linear infinite;
	}

	.badge-shine-backdrop {
		position: absolute;
		inset: 1px;
		border-radius: 14px;
		background: var(--home-badge-surface);
	}

	/* Sits above the two absolutely-positioned shine layers, which would
	   otherwise paint over the in-flow icon/text within the same stacking
	   context — `.badge-shine-backdrop` is a solid fill, unlike the old
	   masked-ring `::before` it replaced, which never needed this because its
	   own mask kept the whole content-box area transparent. */
	.hero-badge svg,
	.hero-badge-text {
		position: relative;
		z-index: 1;
	}

	@keyframes badge-shine-sweep {
		from {
			rotate: -90deg;
		}
		to {
			rotate: 90deg;
		}
	}

	@keyframes badge-shine-flip {
		to {
			transform: rotate(360deg);
		}
	}

	.hero-badge svg {
		width: 1.125rem;
		height: 1.125rem;
		color: var(--observatory-accent);
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: -1px;
		padding: 0;
		border: 0;
		clip: rect(0 0 0 0);
		clip-path: inset(50%);
		overflow: hidden;
		white-space: nowrap;
	}

	.hero h1 {
		max-width: none;
		margin: 0;
		font-size: clamp(2.3rem, 8.5vw, 3.9rem);
		font-weight: 680;
		line-height: 1;
		letter-spacing: -0.05em;
		color: var(--observatory-text);
		/* Line breaks are controlled explicitly via .headline-line spans; balancing
		   would re-break the heading each time the rotating word resizes. */
		text-wrap: wrap;
	}

	.headline-visual {
		display: block;
	}

	.headline-line {
		display: block;
	}

	/* The static phrase leads; the rotating word sits on the line beneath it. On wide
	   screens the phrase is pinned to one line (see the >=1024 block); on phones it
	   wraps naturally so it never overflows. */
	.headline-word {
		display: block;
		margin-top: 0.22em;
	}

	.rotator {
		position: relative;
		display: inline-grid;
	}

	.rotator-ghost,
	.rotator-word {
		grid-area: 1 / 1;
		white-space: nowrap;
	}

	/* Invisible copies of every word reserve the widest word's width, so the line
	   never re-wraps — nothing below the heading shifts when the word changes. */
	.rotator-ghost {
		visibility: hidden;
		pointer-events: none;
	}

	.rotator-word {
		color: var(--observatory-accent);
	}

	.hero-lede {
		max-width: 52ch;
		margin: 1.5rem 0 0;
		font-size: clamp(1rem, 2.1vw, 1.16rem);
		line-height: 1.65;
		color: var(--observatory-text-muted);
		text-wrap: pretty;
	}

	.hero-lede::before {
		content: '';
		display: block;
		width: 2.2rem;
		height: 3px;
		margin-bottom: 1.2rem;
		border-radius: 999px;
		background: var(--observatory-accent);
	}

	.actions {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 0.75rem;
		width: 100%;
		margin-top: 1.8rem;
	}

	.action {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 50px;
		padding: 0.7rem 1.5rem;
		border: 1px solid var(--observatory-accent);
		border-radius: 12px;
		font-size: 0.95rem;
		font-weight: 700;
		line-height: 1;
		text-align: center;
		text-decoration: none;
		white-space: nowrap;
		touch-action: manipulation;
		-webkit-tap-highlight-color: var(--observatory-accent-soft);
		transition:
			transform 180ms ease,
			background-color 180ms ease,
			border-color 180ms ease,
			color 180ms ease;
	}

	.action svg,
	.action-link svg {
		flex-shrink: 0;
		width: 1.1rem;
		height: 1.1rem;
	}

	.action {
		gap: 0.65rem;
	}

	.action-primary {
		background: var(--observatory-accent);
		color: var(--observatory-on-accent);
	}

	.action-secondary {
		background: var(--observatory-surface);
		color: var(--observatory-accent);
	}

	/* Editorial CTA: a text link with a sliding arrow beside the primary button. */
	.action-link {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		min-height: 50px;
		padding: 0.7rem 1.25rem;
		border: 1px solid var(--observatory-accent-border);
		border-radius: 12px;
		background: var(--observatory-cta-link-surface);
		color: var(--observatory-accent);
		font-size: 0.95rem;
		font-weight: 700;
		line-height: 1;
		text-decoration: none;
		white-space: nowrap;
		-webkit-tap-highlight-color: var(--observatory-accent-soft);
	}

	.action-link svg {
		transition: transform 180ms ease;
	}

	.action-link:focus {
		outline: 0;
	}

	.action-link:focus-visible {
		outline: 3px solid var(--observatory-focus);
		outline-offset: 3px;
		border-radius: 8px;
	}

	/* Shine sweep: a diagonal gleam crosses the button on hover. */
	.action-link {
		position: relative;
		z-index: 0;
		overflow: hidden;
	}

	.action-link > span,
	.action-link > svg {
		position: relative;
		z-index: 1;
	}

	.action-link::after {
		content: '';
		position: absolute;
		top: -50%;
		left: -60%;
		z-index: 0;
		width: 40%;
		height: 200%;
		background: linear-gradient(120deg, transparent, var(--observatory-accent-soft), transparent);
		transform: translateX(-20%) rotate(20deg);
		transition: transform 550ms ease;
	}

	.action:focus {
		outline: 0;
	}

	.action:focus-visible {
		outline: 3px solid var(--observatory-focus);
		outline-offset: 3px;
	}

	.action:active {
		transform: scale(0.98);
	}

	.hero-promises {
		display: none;
		margin: 2.2rem 0 0;
		padding: 0;
		list-style: none;
	}

	/* Icon and its two-line label share one centered baseline block, so the icons
	   line up with each other and sit centred against the dividers rather than
	   hanging off the top of a label that wrapped to a different height. */
	.hero-promises li {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		min-width: 0;
		min-height: 2.1rem;
		padding-right: 0.65rem;
		color: var(--observatory-text-muted);
	}

	.hero-promises li + li {
		padding-left: 0.65rem;
		border-left: 1px solid var(--observatory-border-strong);
	}

	.hero-promises svg {
		flex-shrink: 0;
		width: 1.5rem;
		height: 1.5rem;
		color: var(--observatory-accent);
	}

	/* Two fixed rows: the strength on top, its qualifier under it. Sized to fit
	   the longest label ("Real-time updates") on one line in the copy column. */
	.hero-promises .promise-copy {
		display: grid;
		gap: 0.1rem;
		min-width: 0;
		font-size: 0.62rem;
		font-weight: 700;
		line-height: 1.32;
		letter-spacing: -0.005em;
	}

	.hero-promises small {
		color: var(--observatory-text-soft);
		font-size: inherit;
		font-weight: 500;
	}

	/* Dashboard: a bento grid. Single column on phones; a KPI-anchored bento with a
	   full-width footer on tablet/desktop (see the >=640 and >=1024 blocks). */
	.hero-stage {
		position: relative;
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 0.85rem;
		width: 100%;
		max-width: 26rem;
		margin: 0 auto;
	}

	.hero-glow {
		position: absolute;
		inset: -8% -6% -6%;
		z-index: 0;
		background: radial-gradient(
			70% 60% at 55% 38%,
			var(--observatory-accent-soft) 0%,
			transparent 72%
		);
		opacity: 0.7;
		pointer-events: none;
	}

	.float-card {
		position: relative;
		z-index: 1;
		min-width: 0;
		animation: card-enter 720ms cubic-bezier(0.22, 1, 0.36, 1) both;
		animation-delay: var(--enter-delay, 0ms);
	}

	.float-body {
		display: flex;
		flex-direction: column;
		height: 100%;
		border: 1px solid var(--observatory-border);
		border-radius: 18px;
		background: var(--observatory-surface-solid);
		box-shadow: var(--observatory-shadow);
		padding: 1.15rem 1.25rem;
		/* All cards share one rhythm so they hover in sync, not at staggered times. */
		animation: card-float 6s ease-in-out infinite;
	}

	.fc-head {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.fc-label {
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--observatory-accent);
	}

	.fc-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		border-radius: 10px;
		background: var(--observatory-surface-soft);
		color: var(--observatory-text-muted);
	}

	.fc-icon-accent {
		background: var(--observatory-accent-soft);
		color: var(--observatory-accent);
	}

	.fc-icon svg {
		width: 1.1rem;
		height: 1.1rem;
	}

	.fc-metric-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
		margin: 0.85rem 0 0;
	}

	.fc-metric {
		margin: 0;
		font-size: clamp(1.9rem, 6vw, 2.35rem);
		font-weight: 730;
		line-height: 1;
		letter-spacing: -0.03em;
		font-variant-numeric: tabular-nums;
		color: var(--observatory-text);
	}

	.fc-bars {
		display: flex;
		align-items: flex-end;
		gap: 0.4rem;
		height: 3.25rem;
		margin: 1rem 0 0.9rem;
	}

	.fc-bars span {
		flex: 1;
		height: var(--h, 50%);
		border-radius: 5px 5px 3px 3px;
		background: var(--observatory-bar);
	}

	.fc-bars .fc-bar-lead {
		background: var(--observatory-accent);
	}

	.fc-caption {
		margin: 0.7rem 0 0;
		display: block;
		font-size: 0.72rem;
		color: var(--observatory-text-soft);
	}

	.fc-metric-row .fc-pill {
		align-self: center;
	}

	.fc-pill {
		display: inline-flex;
		align-self: flex-start;
		align-items: center;
		padding: 0.28rem 0.6rem;
		border: 1px solid;
		border-radius: 999px;
		font-size: 0.72rem;
		font-weight: 700;
	}

	/* KPI is the focal card: its chart grows to fill the tall cell, but capped so
	   the bars stay a modest height rather than stretching the whole card. */
	.card-movement .fc-bars {
		flex: 1;
		height: auto;
		min-height: 2.5rem;
		max-height: 3.5rem;
		margin-bottom: 1.1rem;
	}

	/* "+12% vs yesterday" is a trend badge, not a count addition — use the brand
	   accent (blue in light, gold in dark), not the add-green. */
	.fc-pill-add {
		border-color: var(--observatory-accent-border);
		background: var(--observatory-accent-soft);
		color: var(--observatory-accent);
	}

	.fc-row {
		flex-direction: row;
		align-items: flex-start;
		gap: 0.85rem;
		padding: 1rem 1.1rem;
	}

	.card-lowstock .float-body {
		align-items: stretch;
	}

	.card-lowstock .fc-lowstock-main {
		display: flex;
		flex: 1;
		flex-direction: column;
		justify-content: space-between;
	}

	.fc-lowstock-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
	}

	.fc-avatar {
		display: inline-flex;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
		width: 2.4rem;
		height: 2.4rem;
		border-radius: 12px;
		background: var(--observatory-accent-soft);
		color: var(--observatory-accent);
	}

	.fc-avatar svg {
		width: 1.3rem;
		height: 1.3rem;
	}

	.fc-avatar-warn {
		background: var(--observatory-accent-soft);
		color: var(--observatory-accent);
	}

	.fc-row-main,
	.fc-lowstock-main {
		min-width: 0;
	}

	.fc-row-title {
		margin: 0;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--observatory-accent);
	}

	.fc-row-sub {
		margin: 0.15rem 0 0;
		font-size: 0.78rem;
		color: var(--observatory-text-soft);
	}

	.fc-row-sub-strong {
		font-weight: 700;
		color: var(--observatory-text);
	}

	.fc-flow {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin: 0.6rem 0 0;
		font-size: 1.1rem;
		font-weight: 720;
		font-variant-numeric: tabular-nums;
		color: var(--observatory-text);
	}

	.fc-arrow {
		color: var(--observatory-text-soft);
	}

	.fc-tag-add {
		padding: 0.1rem 0.45rem;
		border-radius: 999px;
		background: var(--observatory-accent-soft);
		font-size: 0.72rem;
		font-weight: 700;
		color: var(--observatory-accent);
	}

	.fc-row-meta {
		margin: 0.5rem 0 0;
		font-size: 0.72rem;
		color: var(--observatory-text-soft);
	}

	.fc-rows {
		display: grid;
		gap: 0.55rem;
		margin: 0.95rem 0 0;
	}

	.fc-rows > div {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
	}

	.fc-rows dt {
		margin: 0;
		font-size: 0.8rem;
		color: var(--observatory-text-soft);
	}

	.fc-rows dd {
		margin: 0;
		font-size: 0.9rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		color: var(--observatory-text);
	}

	.fc-rows-total {
		margin-top: 0.35rem;
		padding-top: 0.6rem;
		border-top: 1px solid var(--observatory-border);
	}

	.fc-accent {
		color: var(--observatory-accent);
	}

	.fc-lowstock-count {
		flex-shrink: 0;
		font-size: 0.9rem;
		font-weight: 750;
		color: var(--observatory-accent);
	}

	.fc-progress {
		height: 6px;
		margin-top: 0.7rem;
		border-radius: 999px;
		background: var(--observatory-surface-soft);
		overflow: hidden;
	}

	.fc-progress span {
		display: block;
		height: 100%;
		border-radius: 999px;
		background: var(--observatory-accent);
	}

	.card-updated,
	.card-forecast,
	.card-lowstock {
		display: none;
	}

	/* The reference dashboard reads as one instrument panel rather than four
	   unrelated floating cards. The existing illustrative cards remain inert and
	   data-free, but now sit inside this shared overview shell. */
	.hero-stage {
		display: block;
		max-width: 30rem;
	}

	/* Same rotating edge highlight as the hero badge, just slower — it drifts
	   around the panel rather than spinning. The `glowRing` stroke draws the
	   border, so the shell itself has none. */
	.dashboard-shell {
		--ring-dur: 7s;
		--bloom-spread: 0px;
		--bloom-radius: 30px;
		--bloom-thick: 2px;
		--bloom-blur: 7px;
		position: relative;
		z-index: 1;
		padding: calc(0.9rem + 1px);
		border: 0;
		border-radius: 20px;
		background: var(--home-shell-surface);
	}

	.dashboard-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.15rem 0.2rem 0.85rem;
	}

	.dashboard-header p {
		margin: 0;
		color: var(--observatory-text);
		font-size: 0.92rem;
		font-weight: 750;
		line-height: 1.2;
	}

	.dashboard-header div > span {
		display: block;
		margin-top: 0.16rem;
		color: var(--observatory-text-soft);
		font-size: 0.7rem;
		line-height: 1.2;
	}

	.dashboard-period {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		flex-shrink: 0;
		min-height: 36px;
		padding: 0.45rem 0.65rem;
		border: 1px solid var(--observatory-border);
		border-radius: 10px;
		background: var(--observatory-surface-soft);
		color: var(--observatory-text-muted);
		font-size: 0.7rem;
		font-weight: 650;
	}

	.dashboard-period svg {
		width: 1rem;
		height: 1rem;
	}

	.dashboard-period svg:last-child {
		width: 0.8rem;
	}

	.dashboard-grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 0.7rem;
	}

	.dashboard-shell .float-body {
		border-radius: 14px;
		background: var(--observatory-surface);
		box-shadow: none;
	}

	.card-forecast .float-body {
		justify-content: space-between;
	}

	.dashboard-callout {
		display: none;
		align-items: center;
		gap: 0.75rem;
		margin-top: 0.7rem;
		padding: 0.7rem 0.8rem;
		border: 1px solid var(--observatory-callout-border);
		border-radius: 12px;
		background: var(--observatory-accent-soft);
		color: var(--observatory-accent);
	}

	.dashboard-callout > svg {
		flex-shrink: 0;
		width: 1.875rem;
		height: 1.875rem;
	}

	.dashboard-callout > span:not(.dashboard-callout-link) {
		display: grid;
		gap: 0.14rem;
		min-width: 0;
		margin-right: auto;
	}

	.dashboard-callout strong {
		color: var(--observatory-text);
		font-size: 0.68rem;
		line-height: 1.3;
	}

	.dashboard-callout small {
		color: var(--observatory-text-soft);
		font-size: 0.62rem;
		line-height: 1.3;
	}

	.dashboard-callout-link {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		flex-shrink: 0;
		padding: 0.45rem 0.55rem;
		border: 1px solid var(--observatory-callout-border);
		border-radius: 9px;
		background: var(--observatory-surface);
		font-size: 0.64rem;
		font-weight: 750;
	}

	.dashboard-callout-link svg {
		width: 0.875rem;
		height: 0.875rem;
	}

	.operations-strip {
		display: none;
		width: 100%;
		text-align: center;
	}

	.operations-strip p {
		margin: 0 0 1.1rem;
		color: var(--observatory-text-soft);
		font-size: 0.62rem;
		font-weight: 750;
		letter-spacing: 0.34em;
		text-transform: uppercase;
	}

	.operations-strip ul {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 0.9rem clamp(1.5rem, 4vw, 3.4rem);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	/* Mark + wordmark pairs, held back to a quiet tint so the row reads as a
	   supporting proof strip rather than competing with the hero. */
	.operations-strip li {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--observatory-text-soft);
		font-size: 0.88rem;
		font-weight: 650;
		letter-spacing: -0.005em;
		opacity: 0.78;
		transition:
			opacity 200ms ease,
			color 200ms ease;
	}

	.operations-strip li:hover {
		color: var(--observatory-text-muted);
		opacity: 1;
	}

	.operations-strip li svg {
		flex-shrink: 0;
		width: 1.35rem;
		height: 1.35rem;
	}

	@keyframes card-enter {
		from {
			opacity: 0;
			transform: translateY(24px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* Gentle hover: the inner body drifts while its grid cell stays pinned, so the
	   bento stays aligned but the cards feel alive — all in unison. */
	@keyframes card-float {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-6px);
		}
	}

	.inventory-layout,
	.trace-layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 1.75rem;
		align-items: center;
	}

	/* Radius system: primary surfaces 18px, nested controls 12px, actions pill-shaped. */
	.inventory-demo,
	.forecast-demo {
		border: 1px solid var(--observatory-border);
		border-radius: 18px;
		background: var(--observatory-surface);
		box-shadow: var(--observatory-shadow);
		overflow: hidden;
	}

	.forecast-demo {
		width: 100%;
		max-width: 64rem;
		margin: 0 auto;
	}

	.demo-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1rem;
		border-bottom: 1px solid var(--observatory-border);
	}

	.demo-header p {
		margin: 0;
		font-size: 0.82rem;
		font-weight: 700;
		color: var(--observatory-text-muted);
	}

	.status,
	.action-label {
		display: inline-flex;
		align-items: center;
		min-height: 30px;
		padding: 0.25rem 0.7rem;
		border: 1px solid;
		border-radius: 999px;
		font-size: 0.76rem;
		font-weight: 750;
		line-height: 1;
		white-space: nowrap;
	}

	.status-ok {
		border-color: var(--observatory-accent-border);
		background: var(--observatory-accent-soft);
		color: var(--observatory-accent);
	}

	.inventory-primary {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 1.75rem;
		padding: 1.4rem 1rem;
	}

	.field-label,
	.inventory-counts dt,
	.record-details dt,
	.count-flow span,
	.event-meta time {
		font-size: 0.74rem;
		font-weight: 650;
		line-height: 1.4;
		color: var(--observatory-text-soft);
	}

	.item-identity h3 {
		margin: 0.35rem 0 0;
		font-size: clamp(1.35rem, 5vw, 2rem);
		font-weight: 700;
		line-height: 1.15;
		letter-spacing: -0.025em;
		color: var(--observatory-text);
	}

	.item-identity p {
		margin: 0.65rem 0 0;
		font-size: 0.84rem;
		line-height: 1.5;
		color: var(--observatory-accent);
	}

	.inventory-counts {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.75rem;
		margin: 0;
	}

	.inventory-counts > div {
		padding: 0.85rem;
		border: 1px solid var(--observatory-border);
		border-radius: 12px;
		background: var(--observatory-surface-soft);
	}

	.inventory-counts dt,
	.inventory-counts dd,
	.record-details dt,
	.record-details dd {
		margin: 0;
	}

	.inventory-counts dd {
		margin-top: 0.25rem;
		font-size: clamp(1.55rem, 6vw, 2.3rem);
		font-weight: 720;
		line-height: 1;
		font-variant-numeric: tabular-nums;
		color: var(--observatory-text);
	}

	.record-details {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 1.25rem;
		margin: 0;
		padding: 1.15rem 1rem 1.25rem;
		border-top: 1px solid var(--observatory-border);
	}

	.record-details dd {
		margin-top: 0.4rem;
		font-size: 0.95rem;
		font-weight: 650;
		color: var(--observatory-text);
	}

	.booth-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.booth-tags span {
		display: inline-flex;
		align-items: center;
		min-height: 30px;
		padding: 0.25rem 0.7rem;
		border: 1px solid var(--observatory-border);
		border-radius: 999px;
		background: var(--observatory-surface-soft);
		font-size: 0.78rem;
		color: var(--observatory-text-muted);
	}

	.transaction-demo {
		position: relative;
		width: 100%;
	}

	.sequence-header {
		margin-bottom: 1.25rem;
		padding-left: 0.2rem;
	}

	.sequence-header h3 {
		margin: 0;
		font-size: 0.9rem;
		font-weight: 750;
		color: var(--observatory-text);
	}

	.sequence-header p {
		margin: 0.35rem 0 0;
		font-size: 0.82rem;
		color: var(--observatory-text-soft);
	}

	.transaction-list {
		position: relative;
		display: grid;
		gap: 1rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.transaction-list::before {
		content: '';
		position: absolute;
		top: 1.25rem;
		bottom: 1.25rem;
		left: 1.25rem;
		width: 1px;
		background: var(--observatory-border-strong);
	}

	.transaction-event {
		position: relative;
		display: grid;
		grid-template-columns: 2.5rem minmax(0, 1fr);
		gap: 0.8rem;
		align-items: start;
	}

	.event-marker {
		position: relative;
		z-index: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2.5rem;
		height: 2.5rem;
		border: 1px solid;
		border-radius: 12px;
		font-size: 1.2rem;
		font-weight: 800;
		line-height: 1;
	}

	.event-body {
		padding: 1rem;
		border: 1px solid var(--observatory-border);
		border-radius: 12px;
		background: var(--observatory-surface);
	}

	.event-add .event-marker,
	.event-add .action-label {
		border-color: var(--observatory-add-border);
		background: var(--observatory-add-soft);
		color: var(--observatory-add);
	}

	.event-remove .event-marker,
	.event-remove .action-label {
		border-color: var(--observatory-remove-border);
		background: var(--observatory-remove-soft);
		color: var(--observatory-remove);
	}

	.event-meta {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.5rem;
	}

	.count-flow {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
		gap: 0.55rem;
		align-items: end;
		margin-top: 1rem;
	}

	.count-flow > div {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.count-flow strong {
		font-size: 1.45rem;
		font-weight: 720;
		line-height: 1;
		font-variant-numeric: tabular-nums;
		color: var(--observatory-text);
	}

	.flow-word {
		padding-bottom: 0.15rem;
	}

	.event-user {
		margin: 0.9rem 0 0;
		padding-top: 0.75rem;
		border-top: 1px solid var(--observatory-border);
		font-size: 0.78rem;
		color: var(--observatory-text-soft);
	}

	.event-user strong {
		font-weight: 700;
		color: var(--observatory-text-muted);
	}

	.forecast-layout {
		display: grid;
		gap: 1.75rem;
	}

	.forecast-copy {
		max-width: 56rem;
	}

	.forecast-demo figcaption {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 1rem;
		border-bottom: 1px solid var(--observatory-border);
	}

	.forecast-demo figcaption strong {
		font-size: 0.86rem;
		color: var(--observatory-text);
	}

	.forecast-demo figcaption span {
		font-size: 0.78rem;
		line-height: 1.5;
		color: var(--observatory-text-soft);
	}

	.chart-wrap {
		width: 100%;
		padding: 0.4rem 0.3rem 0;
		overflow: hidden;
	}

	.forecast-chart {
		display: block;
		width: 100%;
		height: auto;
	}

	.forecast-chart-desktop {
		display: none;
	}

	.forecast-chart-mobile {
		display: block;
	}

	.forecast-zone {
		fill: var(--observatory-accent-soft);
		opacity: 0.6;
	}

	.chart-grid,
	.threshold-line,
	.today-line,
	.history-line,
	.forecast-line {
		vector-effect: non-scaling-stroke;
	}

	.chart-grid {
		stroke: var(--observatory-chart-grid);
		stroke-width: 1;
	}

	.threshold-line {
		stroke: var(--observatory-chart-threshold);
		stroke-width: 1.5;
		stroke-dasharray: 3 6;
	}

	.today-line {
		stroke: var(--observatory-accent-border);
		stroke-width: 1;
		stroke-dasharray: 2 5;
	}

	.confidence-area {
		fill: var(--observatory-chart-confidence);
		opacity: 0.78;
	}

	.history-line,
	.forecast-line {
		fill: none;
		stroke-width: 3;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.history-line {
		stroke: var(--observatory-chart-history);
	}

	.forecast-line {
		stroke: var(--observatory-accent);
		stroke-dasharray: 8 7;
	}

	.today-point {
		fill: var(--observatory-accent);
		stroke: var(--observatory-surface-solid);
		stroke-width: 3;
		vector-effect: non-scaling-stroke;
	}

	.chart-label,
	.threshold-label,
	.today-label {
		font-family: inherit;
		font-size: 12px;
		font-weight: 650;
	}

	.chart-label,
	.threshold-label {
		fill: var(--observatory-text-soft);
	}

	.today-label {
		fill: var(--observatory-accent);
	}

	.forecast-legend {
		display: flex;
		flex-wrap: wrap;
		gap: 0.65rem 1rem;
		padding: 0.5rem 1rem 1rem;
	}

	.forecast-legend span {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.72rem;
		font-weight: 650;
		color: var(--observatory-text-muted);
	}

	.legend-line {
		display: inline-block;
		width: 1.35rem;
		height: 0;
		border-top: 2px solid;
	}

	.legend-history {
		border-color: var(--observatory-chart-history);
	}

	.legend-forecast {
		border-color: var(--observatory-accent);
		border-top-style: dashed;
	}

	.legend-threshold {
		border-color: var(--observatory-chart-threshold);
		border-top-style: dotted;
	}

	.legend-band {
		display: inline-block;
		width: 1.35rem;
		height: 0.65rem;
		border: 1px solid var(--observatory-accent-border);
		border-radius: 3px;
		background: var(--observatory-chart-confidence);
	}

	.recommendation {
		display: grid;
		gap: 0.35rem;
		padding: 1rem;
		border-top: 1px solid var(--observatory-border);
		background: var(--observatory-surface-soft);
	}

	.recommendation strong {
		font-size: 0.76rem;
		font-weight: 800;
		color: var(--observatory-accent);
	}

	.recommendation p {
		margin: 0;
		font-size: 0.86rem;
		line-height: 1.55;
		color: var(--observatory-text-muted);
	}

	.finale {
		min-height: max(620px, calc(100dvh - var(--snap-top, 56px) - 1rem));
		text-align: center;
	}

	.finale-content {
		width: 100%;
		max-width: 52rem;
		margin: 0 auto;
	}

	.finale-content > p {
		margin-right: auto;
		margin-left: auto;
	}

	.finale-actions {
		max-width: 30rem;
		margin-right: auto;
		margin-left: auto;
	}

	@keyframes hero-enter {
		from {
			opacity: 0;
			transform: translateY(18px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* Nothing on this page hovers unless it is genuinely operable. The float
	   cards, demo panels, count tiles, booth chips and transaction rows are
	   illustrations — they take no click, so they promise no click. Hover lives
	   only on the rail, the motion toggle, the scroll cue and the actions. */
	@media (hover: hover) {
		/* Hover emphasizes the small dot itself — no full-button disc (which read as
		   a messy blob around the dot). */
		.rail button.rail-stop:hover .rail-dot {
			border-color: var(--observatory-accent);
			transform: scale(1.3);
		}

		.rail-stop.active:hover .rail-dot {
			transform: scale(1.15);
		}

		.action:not(:active):hover {
			transform: translateY(-2px);
		}

		.action-primary:hover {
			border-color: var(--observatory-accent-hover);
			background: var(--observatory-accent-hover);
		}

		.action-secondary:hover {
			background: var(--observatory-accent-soft);
		}

		.action-link:hover svg {
			transform: translateX(3px);
		}

		.action-link:hover::after {
			transform: translateX(420%) rotate(20deg);
		}
	}

	/* Phones stack the hero copy above the card stage, so the desktop vertical
	   rhythm adds up to more than one screen. Tighten the whitespace — not the
	   content — so the intro panel still fits below the fixed nav. */
	@media (max-width: 767px) {
		.hero {
			padding-top: 1rem;
			padding-bottom: 1rem;
		}

		.hero-layout {
			gap: 1.25rem;
		}

		.hero-copy .actions {
			margin-top: 1.25rem;
		}

		.hero-badge {
			margin-bottom: 1rem;
		}
	}

	@media (min-width: 480px) {
		.actions {
			display: flex;
			flex-wrap: wrap;
			align-items: center;
			width: auto;
		}

		.action {
			min-width: 9.5rem;
		}

		.inventory-primary {
			padding: 1.5rem;
		}

		.demo-header,
		.record-details,
		.forecast-demo figcaption,
		.forecast-legend,
		.recommendation {
			padding-right: 1.5rem;
			padding-left: 1.5rem;
		}

		.record-details {
			grid-template-columns: 0.8fr 1.2fr;
		}

		.event-meta {
			flex-direction: row;
			align-items: center;
			justify-content: space-between;
		}
	}

	@media (min-width: 640px) {
		.page {
			padding-left: 1.5rem;
		}

		/* Tablet/desktop: "twin towers" bento — the KPI and the forecast stand tall
		   side by side (each spanning two rows), with activity + alert sharing the
		   base row beneath them. */
		.card-updated,
		.card-forecast,
		.card-lowstock {
			display: block;
		}

		.hero-stage {
			max-width: 40rem;
		}

		.dashboard-grid {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
			grid-auto-rows: auto;
		}

		.dashboard-shell {
			padding: 1rem;
		}

		.dashboard-callout {
			display: flex;
		}

		.card-movement {
			grid-column: 1;
			grid-row: 1 / span 2;
		}

		.card-forecast {
			grid-column: 2;
			grid-row: 1 / span 2;
		}

		.card-updated {
			grid-column: 1;
			grid-row: 3;
		}

		.card-lowstock {
			grid-column: 2;
			grid-row: 3;
		}

		.inventory-counts {
			min-width: 15.5rem;
		}

		.forecast-chart-desktop {
			display: block;
		}

		.forecast-chart-mobile {
			display: none;
		}
	}

	/* Mandatory snapping only where every panel comfortably fits the viewport;
	   shorter/zoomed screens keep proximity so no content can be trapped
	   between snap points. */
	@media (min-width: 768px) and (min-height: 620px) {
		:global(html.home-snap) {
			scroll-snap-type: y mandatory;
		}

		.page {
			padding-right: 4.5rem;
		}

		.panel {
			padding-top: 5.5rem;
			padding-bottom: 5.5rem;
		}

		#predictions {
			padding-top: 2.75rem;
			padding-bottom: 2.75rem;
		}

		.section-copy h2,
		.finale-content h2 {
			font-size: clamp(3rem, 5.7vw, 4.8rem);
		}

		.inventory-primary {
			grid-template-columns: minmax(0, 1fr) auto;
			align-items: end;
		}

		.forecast-demo figcaption {
			flex-direction: row;
			align-items: center;
			justify-content: space-between;
			gap: 2rem;
		}

		.forecast-demo figcaption span {
			max-width: 31rem;
			text-align: right;
		}

		.recommendation {
			grid-template-columns: auto minmax(0, 1fr);
			align-items: baseline;
			gap: 1.25rem;
		}
	}

	@media (min-width: 960px) {
		.rail {
			right: max(0.75rem, var(--safe-area-inset-right));
		}

		.rail-label {
			position: absolute;
			right: 2.65rem;
			display: block;
			min-width: max-content;
			padding: 0.35rem 0.55rem;
			border: 1px solid var(--observatory-border);
			border-radius: 8px;
			background: var(--observatory-rail-surface);
			box-shadow: var(--observatory-shadow);
			font-size: 0.7rem;
			font-weight: 700;
			color: var(--observatory-text-muted);
			opacity: 0;
			pointer-events: none;
			transform: translateX(5px);
			transition:
				opacity 180ms ease,
				transform 180ms ease;
		}

		/* Label appears only on keyboard focus, not mouse hover — the hover pill
		   was unwanted. Screen readers still get each stop's name via aria-label. */
		.rail-stop:focus-visible .rail-label {
			opacity: 1;
			transform: translateX(0);
		}

		.inventory-layout {
			grid-template-columns: minmax(16rem, 0.78fr) minmax(0, 1.35fr);
			gap: clamp(3rem, 7vw, 6.5rem);
		}

		.trace-layout {
			grid-template-columns: minmax(0, 1.25fr) minmax(16rem, 0.72fr);
			gap: clamp(3rem, 7vw, 6.5rem);
		}

		.trace-copy {
			grid-column: 2;
			grid-row: 1;
		}

		.transaction-demo {
			grid-column: 1;
			grid-row: 1;
		}

		.forecast-layout {
			gap: 2.8rem;
		}
	}

	/* Desktop: headline in the left column, the bento dashboard fills the right. */
	@media (min-width: 1024px) {
		.hero {
			padding-top: 1rem;
			padding-bottom: 2.75rem;
		}

		.hero-layout {
			display: grid;
			grid-template-columns: minmax(0, 0.82fr) minmax(0, 1.18fr);
			gap: clamp(1.5rem, 3vw, 2.75rem);
			row-gap: 1rem;
			align-items: center;
		}

		.hero-copy {
			padding-left: clamp(0.5rem, 1.5vw, 1.5rem);
			container-type: inline-size;
		}

		.hero h1 {
			max-width: none;
			/* Sized to the copy column (cqi), not the viewport, so the one-line phrase
			   never overflows into the cards on wide screens where the page is capped. */
			font-size: clamp(2.3rem, 11cqi, 3.65rem);
		}

		.headline-static {
			white-space: nowrap;
		}

		.hero-stage {
			max-width: none;
			margin: 0;
		}

		.hero-promises {
			display: grid;
			grid-template-columns: repeat(3, minmax(0, 1fr));
			align-items: stretch;
		}

		.operations-strip {
			display: block;
			grid-column: 1 / -1;
			margin-top: 2.25rem;
			padding: 0 4rem;
		}
	}

	@media (min-width: 1200px) {
		.page {
			padding-right: 5.5rem;
			padding-left: 2.5rem;
		}

		.rail {
			right: max(1.5rem, var(--safe-area-inset-right));
		}

		/* Wide enough for each strength to hold one line; below this the title is
		   allowed to wrap and the centred icon keeps the row aligned regardless. */
		.hero-promises .promise-title {
			white-space: nowrap;
		}
	}

	@media (prefers-reduced-motion: reduce), (max-height: 540px) {
		:global(html.home-snap) {
			scroll-snap-type: none;
			scroll-behavior: auto;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.hero-copy {
			animation: none;
		}

		.float-card {
			animation: none;
			opacity: 1;
		}

		.float-body {
			animation: none;
		}

		/* The beam parks wherever it started; the constant base ring still draws
		   the edge, so the border does not disappear. */
		.glow-host::before,
		.glow-bloom i {
			animation: none;
		}

		/* The mask parks on whichever half it stopped on and the wedge holds its
		   last angle; the badge's outer 1px ring (its own background colour)
		   still reads as a border either way. */
		.badge-shine-mask,
		.badge-shine-wedge {
			animation: none;
		}

		.action,
		.action-link,
		.rail button.rail-stop,
		.rail-label,
		.rail-dot,
		.rail::before {
			transition: none;
		}

		.rail button.rail-stop:hover .rail-dot,
		.action:not(:active):hover {
			transform: none;
		}
	}

	@media (max-height: 540px) {
		.rail {
			top: calc(50% + var(--snap-top, 56px) / 2);
		}

		.page {
			padding-right: calc(3.25rem + var(--safe-area-inset-right));
		}

		.panel,
		.hero,
		.finale {
			min-height: calc(100dvh - var(--snap-top, 56px) - 0.25rem);
			padding-top: 1.5rem;
			padding-bottom: 1.5rem;
		}

		#predictions {
			padding-top: 1.5rem;
			padding-bottom: 1.5rem;
		}
	}

	@media (max-height: 540px) and (orientation: landscape) and (max-width: 959px) {
		.hero {
			min-height: calc(100dvh - var(--snap-top, 56px) - 0.25rem);
			padding-top: 1rem;
			padding-bottom: 1rem;
		}

		.hero-copy {
			max-width: none;
		}

		.hero-badge,
		.hero-promises,
		.operations-strip {
			display: none;
		}

		.hero h1 {
			max-width: none;
			font-size: clamp(2.4rem, 6vw, 3.25rem);
			line-height: 0.94;
		}

		.hero-lede {
			max-width: 60ch;
			margin-top: 0.75rem;
			font-size: 0.95rem;
			line-height: 1.45;
		}

		.actions {
			gap: 0.6rem;
			margin-top: 0.85rem;
		}

		.action {
			min-height: 48px;
			padding: 0.55rem 1.1rem;
		}

		.hero-layout {
			gap: 1rem;
		}

		/* Short landscape phones have room for the headline, the lede and the
		   actions — and nothing else. The card stage is decorative (aria-hidden),
		   so it yields rather than push the real content off-screen; the
		   ThreeScene backdrop still carries the panel. */
		.hero-stage {
			display: none;
		}

		.inventory-layout,
		.trace-layout,
		.forecast-layout {
			gap: 1.25rem;
		}

		.section-copy h2,
		.finale-content h2 {
			font-size: clamp(2rem, 5vw, 2.75rem);
		}

		.section-copy p,
		.finale-content > p {
			margin-top: 0.75rem;
			line-height: 1.5;
		}
	}

	@media (prefers-contrast: more) {
		.inventory-demo,
		.forecast-demo,
		.event-body,
		.inventory-counts > div,
		.float-body {
			border-width: 2px;
		}

		.rail-dot {
			border-width: 3px;
		}
	}
</style>
