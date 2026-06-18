<script>
	import { fade } from 'svelte/transition';
	import { authStore } from '../stores/authStore.js';
	import ThreeScene from '../components/ThreeScene.svelte';
	import ScrollReveal from '../components/ScrollReveal.svelte';
	import { createGestureTracker, nextTarget, normalizeWheelDelta } from '../lib/sectionPager.js';

	const authUser = $derived($authStore);

	const features = [
		{
			name: 'Real-time Tracking',
			icon: 'fa-chart-line',
			description:
				'Watch stock levels update the moment they change. Every movement across your warehouse is reflected instantly, so you always act on live data.'
		},
		{
			name: 'Smart Analytics',
			icon: 'fa-brain',
			description:
				'AI-powered demand forecasting and trend analysis turn your transaction history into actionable restocking decisions.'
		},
		{
			name: 'Easy Management',
			icon: 'fa-tasks',
			description:
				'Add, edit, and organize items in seconds with a streamlined interface built for speed.'
		},
		{
			name: 'Secure Data',
			icon: 'fa-shield-alt',
			description:
				'Enterprise-grade authentication and encrypted storage keep your inventory data protected around the clock.'
		}
	];

	const steps = [
		{
			icon: 'fa-box-open',
			title: 'Add Your Inventory',
			text: 'Import existing items or add them manually. Categories, quantities, and details are set up in minutes.'
		},
		{
			icon: 'fa-sync-alt',
			title: 'Track in Real Time',
			text: 'Record transactions as they happen. Stock levels, history, and alerts stay perfectly in sync.'
		},
		{
			icon: 'fa-lightbulb',
			title: 'Act on Insights',
			text: 'AI-driven predictions tell you what to reorder and when — before you run out.'
		}
	];

	const testimonials = [
		{
			name: 'John Doe',
			role: 'Inventory Manager',
			text: "StockSense has revolutionized our inventory management process. It's intuitive and powerful!"
		},
		{
			name: 'Jane Smith',
			role: 'Small Business Owner',
			text: "As a small business owner, StockSense has been a game-changer. It's affordable and easy to use."
		},
		{
			name: 'Mike Johnson',
			role: 'Warehouse Supervisor',
			text: 'The real-time tracking feature has significantly improved our efficiency. Highly recommended!'
		}
	];

	const sections = $derived([
		{ id: 'intro', label: 'Intro' },
		{ id: 'features', label: 'Features' },
		{ id: 'process', label: 'Process' },
		{ id: 'voices', label: 'Voices' },
		...(authUser ? [] : [{ id: 'begin', label: 'Begin' }])
	]);

	let activeSection = $state('intro');

	function scrollToSection(sectionId) {
		const section = document.getElementById(sectionId);
		if (section) {
			section.scrollIntoView({ behavior: 'smooth' });
		}
	}

	// Scope section-snap scrolling to the home page only: the class lives on <html>
	// (the document scroller) and is removed when navigating away.
	$effect(() => {
		document.documentElement.classList.add('home-snap');
		return () => document.documentElement.classList.remove('home-snap');
	});

	// Full paging: one wheel gesture moves exactly one section, fullPage-style.
	// Mandatory CSS snap (below) covers touch swipes and keyboard scrolling;
	// this handler gives mouse/trackpad the deliberate one-section-per-gesture
	// feel. The navbar height is MEASURED (not hardcoded) and the intro's snap
	// point is pinned to the absolute top, so scrolling up never bounces.
	$effect(() => {
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

		const navEl = document.querySelector('nav');
		const tracker = createGestureTracker();
		let animating = false;

		function navHeight() {
			return navEl?.offsetHeight ?? 0;
		}

		function setOffsets() {
			document.documentElement.style.setProperty('--snap-top', `${navHeight()}px`);
			const intro = document.getElementById('intro');
			if (intro) {
				// Snap point for the first section is the very top of the page
				intro.style.scrollMarginTop = `${intro.getBoundingClientRect().top + window.scrollY}px`;
			}
		}

		function targets() {
			// Clamp every target to the real maximum scroll position: the last
			// section's ideal target can exceed it, which would otherwise leave
			// the pager waiting for an unreachable position (and then skipping
			// sections on the way back up).
			const maxScroll = Math.max(
				0,
				(document.scrollingElement?.scrollHeight ?? 0) - window.innerHeight
			);
			return sections
				.map((s) => document.getElementById(s.id))
				.filter(Boolean)
				.map((el) =>
					el.id === 'intro'
						? 0
						: Math.min(
								Math.round(el.getBoundingClientRect().top + window.scrollY - navHeight()),
								maxScroll
							)
				);
		}

		function pageTo(y) {
			animating = true;
			window.scrollTo({ top: y, behavior: 'smooth' });
			const start = performance.now();
			function check() {
				if (Math.abs(window.scrollY - y) < 4 || performance.now() - start > 900) {
					// Trailing inertia is handled by gesture tracking in onWheel,
					// so the pager can re-arm immediately.
					animating = false;
				} else {
					requestAnimationFrame(check);
				}
			}
			requestAnimationFrame(check);
		}

		// Direction/inertia rules live in src/lib/sectionPager.js (unit tested):
		// gestures are tracked by direction so reversing always pages the
		// reversed way, trailing trackpad inertia never re-triggers, and the
		// target is the next snap point strictly in the gesture's direction.
		function onWheel(e) {
			if (e.ctrlKey || window.innerHeight <= 540) return; // zoom / short viewports
			e.preventDefault();
			const delta = normalizeWheelDelta(e.deltaY, e.deltaMode, window.innerHeight);
			const dir = tracker.feed(delta, performance.now(), animating);
			if (dir === 0) return;
			const target = nextTarget(targets(), window.scrollY, dir);
			if (target !== undefined) pageTo(target);
		}

		setOffsets();
		window.addEventListener('resize', setOffsets);
		window.addEventListener('wheel', onWheel, { passive: false });
		return () => {
			window.removeEventListener('resize', setOffsets);
			window.removeEventListener('wheel', onWheel);
		};
	});

	// Track which panel occupies the viewport so the rail can mirror it
	$effect(() => {
		const ids = sections.map((s) => s.id);
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						activeSection = entry.target.id;
					}
				}
			},
			{ threshold: 0.45 }
		);
		for (const id of ids) {
			const el = document.getElementById(id);
			if (el) observer.observe(el);
		}
		return () => observer.disconnect();
	});
</script>

<svelte:head>
	<title>StockSense — Intelligent Inventory Management</title>
</svelte:head>

<ThreeScene />

<nav class="rail" aria-label="Page sections">
	{#each sections as s (s.id)}
		<button
			class="rail-stop"
			class:active={activeSection === s.id}
			onclick={() => scrollToSection(s.id)}
			aria-label="Go to {s.label}"
			aria-current={activeSection === s.id ? 'true' : undefined}
		>
			<span class="rail-label">{s.label}</span>
			<span class="rail-dot" aria-hidden="true"></span>
		</button>
	{/each}
</nav>

<main class="page">
	<!-- =================== INTRO: centered monolith hero =================== -->
	<section id="intro" class="panel hero" aria-labelledby="intro-heading">
		<p class="kicker">Live inventory intelligence</p>
		<h1 id="intro-heading" class="wordmark">Stock<span class="accent">Sense</span></h1>
		<p class="lede">
			Tracking, analysis, and AI-assisted stock predictions — one calm place for everything your
			inventory does.
		</p>
		<div class="actions">
			{#if !authUser}
				<a href="/login" class="btn" aria-label="Get started with StockSense">Get Started</a>
			{:else}
				<a href="/manageItems" class="btn" aria-label="Go to your inventory">Open Your Inventory</a>
			{/if}
		</div>
		{#if activeSection === 'intro'}
			<button
				class="scroll-hint"
				transition:fade={{ duration: 300 }}
				onclick={() => scrollToSection('features')}
				aria-label="Scroll to features"
			>
				<i class="fas fa-chevron-down" aria-hidden="true"></i>
			</button>
		{/if}
	</section>

	<!-- =================== FEATURES: ghost-numeral stack =================== -->
	<section id="features" class="panel" aria-labelledby="features-heading">
		<ScrollReveal blur>
			<h2 id="features-heading" class="panel-title">What it does</h2>
		</ScrollReveal>
		<div class="feature-stack">
			{#each features as feature, i (feature.name)}
				<ScrollReveal delay={100}>
					<article class="feature" aria-labelledby="feature-heading-{i}">
						<div class="feature-icon" aria-hidden="true"><i class="fas {feature.icon}"></i></div>
						<h3 id="feature-heading-{i}">{feature.name}</h3>
						<p>{feature.description}</p>
					</article>
				</ScrollReveal>
			{/each}
		</div>
	</section>

	<!-- =================== PROCESS: center-spine timeline =================== -->
	<section id="process" class="panel" aria-labelledby="process-heading">
		<ScrollReveal blur>
			<h2 id="process-heading" class="panel-title">How it works</h2>
		</ScrollReveal>
		<ol class="timeline">
			{#each steps as step, i (step.title)}
				<li class="tl-item">
					<ScrollReveal delay={120}>
						<div class="tl-row" class:flip={i % 2 === 1}>
							<div class="tl-node" aria-hidden="true"><i class="fas {step.icon}"></i></div>
							<div class="tl-body">
								<span class="tl-step">Step {i + 1}</span>
								<h3>{step.title}</h3>
								<p>{step.text}</p>
							</div>
						</div>
					</ScrollReveal>
				</li>
			{/each}
		</ol>
	</section>

	<!-- =================== VOICES: stacked quotes =================== -->
	<section id="voices" class="panel" aria-labelledby="voices-heading">
		<ScrollReveal blur>
			<h2 id="voices-heading" class="panel-title">In their words</h2>
		</ScrollReveal>
		<div class="quotes">
			{#each testimonials as t, i (t.name)}
				<ScrollReveal delay={100}>
					<figure class="quote" class:flip={i % 2 === 1}>
						<span class="quote-mark" aria-hidden="true">“</span>
						<blockquote>{t.text}</blockquote>
						<figcaption>{t.name} — {t.role}</figcaption>
					</figure>
				</ScrollReveal>
			{/each}
		</div>
	</section>

	<!-- =================== BEGIN: full-viewport finale =================== -->
	{#if !authUser}
		<section id="begin" class="panel finale" aria-labelledby="begin-heading">
			<ScrollReveal blur>
				<h2 id="begin-heading" class="finale-title">Begin.</h2>
			</ScrollReveal>
			<ScrollReveal delay={150}>
				<p class="lede">
					Join thousands of businesses running calmer, smarter inventory on StockSense.
				</p>
			</ScrollReveal>
			<ScrollReveal delay={250}>
				<a href="/login" class="btn" aria-label="Start your free trial of StockSense">
					Start Your Free Trial
				</a>
			</ScrollReveal>
		</section>
	{/if}
</main>

<style>
	.page {
		position: relative;
		z-index: 1;
		width: 100%;
		max-width: 880px;
		margin: 0 auto;
		padding: 0 1.25rem;
		cursor: default;
		text-align: center;
	}

	/* =================== SIDE RAIL =================== */
	.rail {
		position: fixed;
		right: 2rem;
		top: 50%;
		transform: translateY(-50%);
		z-index: 5;
		display: none;
		flex-direction: column;
		gap: 1.4rem;
	}

	@media (min-width: 1024px) {
		.rail {
			display: flex;
		}
	}

	.rail-stop {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.75rem;
		background: transparent;
		border: none;
		padding: 0.35rem 0.5rem;
		border-radius: 9999px;
		color: var(--tech-label);
	}

	/* Replace the browser's blue focus ring with a theme-accent ring,
	   and only show it for keyboard focus — not mouse clicks. */
	.rail-stop:focus,
	.btn:focus,
	.scroll-hint:focus {
		outline: none;
	}

	.rail-stop:focus-visible,
	.btn:focus-visible,
	.scroll-hint:focus-visible {
		outline: 2px solid rgba(var(--tech-accent-rgb), 0.7);
		outline-offset: 3px;
	}

	.rail-label {
		font-size: 0.68rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		opacity: 0;
		transform: translateX(6px);
		transition:
			opacity 0.35s ease,
			transform 0.35s ease;
	}

	.rail-stop:hover .rail-label,
	.rail-stop.active .rail-label {
		opacity: 1;
		transform: translateX(0);
	}

	.rail-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--tech-label);
		opacity: 0.45;
		transition:
			opacity 0.35s ease,
			transform 0.35s ease,
			background 0.35s ease;
	}

	.rail-stop.active .rail-dot {
		background: var(--tech-accent);
		opacity: 1;
		transform: scale(1.5);
	}

	/* =================== SECTION-SNAP SCROLLING =================== */
	/* Mandatory snapping backs up the wheel pager for touch and keyboard:
	   scrolling always ends on a section boundary. --snap-top is set from
	   the measured navbar height at runtime. */
	:global(html.home-snap) {
		scroll-snap-type: y mandatory;
		scroll-behavior: smooth;
	}

	/* Snapping off when it would fight the user: reduced motion, or short
	   viewports where sections are taller than the screen. */
	@media (prefers-reduced-motion: reduce), (max-height: 540px) {
		:global(html.home-snap) {
			scroll-snap-type: none;
			scroll-behavior: auto;
		}
	}

	/* =================== PANELS =================== */
	.panel {
		/* Fill the viewport below the sticky navbar so each section reads
		   as one complete screen after snapping. */
		min-height: max(560px, calc(100vh - var(--snap-top, 84px)));
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 3rem 0;
		scroll-snap-align: start;
		scroll-margin-top: var(--snap-top, 84px);
	}

	.panel-title {
		font-size: 0.8rem;
		font-weight: 500;
		letter-spacing: 0.34em;
		text-transform: uppercase;
		color: var(--tech-label);
		margin: 0 0 2.25rem;
	}

	/* =================== HERO =================== */
	.hero {
		position: relative;
		/* The layout's main padding sits below the hero; subtract it so the
		   scroll hint is never pushed past the viewport edge. */
		min-height: max(560px, calc(100vh - var(--snap-top, 84px) - 1.5rem));
	}

	.kicker {
		font-size: 0.75rem;
		font-weight: 500;
		letter-spacing: 0.34em;
		text-transform: uppercase;
		color: var(--tech-label);
		margin: 0 0 1.5rem;
	}

	.wordmark {
		font-size: clamp(3.25rem, 13vw, 8rem);
		font-weight: 200;
		line-height: 1;
		letter-spacing: -0.03em;
		color: var(--tech-title);
		margin: 0;
	}

	.accent {
		color: var(--tech-accent);
		font-weight: 400;
	}

	.lede {
		font-size: clamp(1rem, 1.8vw, 1.2rem);
		font-weight: 400;
		line-height: 1.8;
		color: var(--input-text);
		max-width: 44ch;
		margin: 2rem auto 0;
	}

	.actions {
		margin-top: 3rem;
	}

	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 52px;
		padding: 0 2.75rem;
		border: 1px solid var(--tech-accent);
		border-radius: 9999px;
		color: var(--tech-accent);
		background: transparent;
		font-size: 0.9rem;
		font-weight: 500;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		transition:
			background 0.4s ease,
			color 0.4s ease;
	}

	.btn:hover {
		background: var(--tech-accent);
		color: var(--tech-bg-end);
	}

	.scroll-hint {
		position: absolute;
		bottom: 2.25rem;
		left: 50%;
		transform: translateX(-50%);
		width: 48px;
		height: 48px;
		min-height: 48px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		color: var(--tech-label);
		font-size: 1rem;
		animation: drift 2.8s ease-in-out infinite;
		transition: color 0.4s ease;
	}

	.scroll-hint:hover {
		color: var(--tech-accent);
	}

	@keyframes drift {
		0%,
		100% {
			transform: translate(-50%, 0);
		}
		50% {
			transform: translate(-50%, 7px);
		}
	}

	/* =================== FEATURES =================== */
	.feature-stack {
		display: grid;
		grid-template-columns: 1fr;
		gap: 3.5rem;
		width: 100%;
	}

	@media (min-width: 768px) {
		.feature-stack {
			grid-template-columns: repeat(2, 1fr);
			gap: 4.5rem 4rem;
		}
	}

	.feature {
		position: relative;
	}

	.feature-icon {
		width: 48px;
		height: 48px;
		margin: 0 auto 1.25rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		background: rgba(var(--tech-accent-rgb), 0.1);
		color: var(--tech-accent);
		font-size: 1.05rem;
	}

	.feature h3 {
		font-size: 1.45rem;
		font-weight: 400;
		letter-spacing: -0.01em;
		color: var(--tech-title);
		margin: 0 0 0.75rem;
	}

	.feature p {
		font-weight: 400;
		font-size: 0.97rem;
		line-height: 1.75;
		color: var(--input-text);
		max-width: 40ch;
		margin: 0 auto;
	}

	/* =================== PROCESS: timeline =================== */
	.timeline {
		position: relative;
		list-style: none;
		margin: 0;
		padding: 0;
		width: 100%;
	}

	/* The spine is desktop-only: on narrow screens it would run through the text */
	@media (min-width: 768px) {
		.timeline::before {
			content: '';
			position: absolute;
			top: 0;
			bottom: 0;
			left: 50%;
			width: 1px;
			background: linear-gradient(
				to bottom,
				transparent,
				rgba(var(--tech-accent-rgb), 0.3) 12%,
				rgba(var(--tech-accent-rgb), 0.3) 88%,
				transparent
			);
		}
	}

	.tl-item {
		position: relative;
		padding: 1.25rem 0;
	}

	.tl-row {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
	}

	.tl-node {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--tech-glass-bg);
		border: 1px solid rgba(var(--tech-accent-rgb), 0.4);
		color: var(--tech-accent);
		font-size: 1rem;
		flex-shrink: 0;
	}

	.tl-body {
		text-align: center;
	}

	.tl-step {
		display: block;
		font-size: 0.7rem;
		font-weight: 500;
		letter-spacing: 0.3em;
		text-transform: uppercase;
		color: var(--tech-label);
		margin-bottom: 0.5rem;
	}

	.tl-body h3 {
		font-size: 1.3rem;
		font-weight: 400;
		color: var(--tech-title);
		margin: 0 0 0.5rem;
	}

	.tl-body p {
		font-weight: 400;
		font-size: 0.95rem;
		line-height: 1.7;
		color: var(--input-text);
		max-width: 42ch;
		margin: 0 auto;
	}

	@media (min-width: 768px) {
		.tl-row {
			flex-direction: row;
			align-items: flex-start;
			gap: 2.25rem;
			width: 50%;
			margin-left: 50%;
			transform: translateX(-24px);
		}

		.tl-row.flip {
			flex-direction: row-reverse;
			margin-left: 0;
			margin-right: 50%;
			transform: translateX(24px);
		}

		.tl-body {
			text-align: left;
			padding-top: 0.4rem;
		}

		.tl-row.flip .tl-body {
			text-align: right;
		}

		.tl-body p {
			margin: 0;
		}

		.tl-row.flip .tl-body p {
			margin-left: auto;
		}
	}

	/* =================== VOICES =================== */
	.quotes {
		display: flex;
		flex-direction: column;
		gap: 2.5rem;
		width: 100%;
	}

	.quote {
		position: relative;
		margin: 0 auto;
		max-width: 38rem;
	}

	@media (min-width: 768px) {
		.quote {
			text-align: left;
			margin: 0;
		}

		.quote.flip {
			text-align: right;
			margin-left: auto;
		}
	}

	.quote-mark {
		display: block;
		font-family: Georgia, 'Times New Roman', serif;
		font-size: 3.25rem;
		font-weight: 400;
		line-height: 1;
		height: 0.55em;
		color: rgba(var(--tech-accent-rgb), 0.45);
		margin-bottom: 0.5rem;
	}

	.quote blockquote {
		font-size: clamp(1.05rem, 2vw, 1.35rem);
		font-weight: 300;
		line-height: 1.6;
		color: var(--tech-title);
		margin: 0 0 0.9rem;
	}

	.quote figcaption {
		font-size: 0.78rem;
		font-weight: 500;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--tech-label);
	}

	/* =================== FINALE =================== */
	.finale-title {
		font-size: clamp(3rem, 10vw, 6.5rem);
		font-weight: 200;
		letter-spacing: -0.02em;
		color: var(--tech-title);
		margin: 0;
	}

	.finale .lede {
		margin-top: 1.75rem;
	}

	.finale :global(.btn) {
		margin-top: 3rem;
	}

	/* =================== MOTION =================== */
	@media (prefers-reduced-motion: reduce) {
		.scroll-hint {
			animation: none;
		}

		.btn,
		.rail-label,
		.rail-dot,
		.scroll-hint {
			transition: none;
		}
	}
</style>
