<script>
	import { authStore } from '../stores/authStore.js';
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';
	import ThreeScene from '../components/ThreeScene.svelte';
	import ScrollReveal from '../components/ScrollReveal.svelte';
	import { createGestureTracker, nextTarget, normalizeWheelDelta } from '../lib/sectionPager.js';

	const authUser = $derived($authStore);

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

	function scrollToSection(sectionId) {
		const section = document.getElementById(sectionId);
		if (!section) return;
		const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		section.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
	}

	// Scope section-snap scrolling to the homepage document scroller.
	$effect(() => {
		document.documentElement.classList.add('home-snap');
		return () => document.documentElement.classList.remove('home-snap');
	});

	// Keep the established one-section-per-wheel-gesture behavior. Direction and
	// inertia decisions remain in sectionPager.js so the tested rules stay pure.
	$effect(() => {
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

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

		setOffsets();
		window.addEventListener('resize', setOffsets);
		window.addEventListener('wheel', onWheel, { passive: false });
		return () => {
			window.removeEventListener('resize', setOffsets);
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

<ThreeScene />

<nav class="rail" aria-label="Homepage panels">
	{#each sections as section (section.id)}
		<button
			type="button"
			class="rail-stop"
			class:active={activeSection === section.id}
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
	<section id="intro" class="panel hero" aria-labelledby="intro-heading">
		<div class="hero-layout">
			<div class="hero-copy">
				<p class="eyebrow">Inventory intelligence, in focus</p>
				<h1 id="intro-heading">
					<span class="headline-line">Know what’s in stock.</span>
					<span class="headline-line">Know what happens next.</span>
				</h1>
				<p class="hero-lede">
					StockSense brings inventory counts, transaction history, and predictive insights into one
					clear operational view.
				</p>
				<div class="actions" aria-label="StockSense actions">
					{#if authUser}
						<a href={resolve('/manageItems')} class="action action-primary">Open inventory</a>
						<a href={resolve('/inventoryPredictions')} class="action action-secondary"
							>Explore predictions</a
						>
					{:else}
						<a href={resolve('/login')} class="action action-primary">Open inventory</a>
						<a href={resolve('/login')} class="action action-secondary">Explore predictions</a>
					{/if}
				</div>
			</div>

			<div class="signal-strip" aria-label="StockSense operational capabilities">
				<p><span>Live inventory visibility</span></p>
				<p><span>Traceable count changes</span></p>
				<p><span>Forecast-ready insights</span></p>
			</div>
		</div>
	</section>

	<section id="inventory" class="panel" aria-labelledby="inventory-heading">
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

	<section id="traceability" class="panel" aria-labelledby="traceability-heading">
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

	<section id="predictions" class="panel" aria-labelledby="predictions-heading">
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

	<section id="closing" class="panel finale" aria-labelledby="closing-heading">
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
		transition:
			width 180ms ease,
			height 180ms ease,
			border-color 180ms ease,
			background-color 180ms ease,
			transform 180ms ease;
	}

	.rail-stop.active .rail-dot {
		width: 12px;
		height: 12px;
		border-color: var(--observatory-accent);
		background: var(--observatory-accent);
	}

	:global(html.home-snap) {
		scroll-snap-type: y proximity;
		scroll-behavior: smooth;
	}

	.panel {
		min-height: max(620px, calc(100dvh - var(--snap-top, 56px) - 1rem));
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2.25rem 0;
		scroll-snap-align: start;
		scroll-snap-stop: always;
		scroll-margin-top: var(--snap-top, 56px);
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
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		animation: hero-enter 700ms cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	.hero-copy {
		max-width: 58rem;
	}

	.eyebrow {
		margin: 0 0 1.15rem;
		font-size: 0.76rem;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--observatory-accent);
	}

	.hero h1 {
		max-width: 16ch;
		margin: 0;
		font-size: clamp(2.4rem, 10.5vw, 5.9rem);
		font-weight: 680;
		line-height: 0.98;
		letter-spacing: -0.055em;
		color: var(--observatory-text);
		text-wrap: balance;
	}

	.headline-line {
		display: inline;
	}

	.hero-lede {
		max-width: 52ch;
		margin: 1.5rem 0 0;
		font-size: clamp(1rem, 2.1vw, 1.16rem);
		line-height: 1.65;
		color: var(--observatory-text-muted);
		text-wrap: pretty;
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
		border-radius: 999px;
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

	.action-primary {
		background: var(--observatory-accent);
		color: var(--observatory-on-accent);
	}

	.action-secondary {
		background: var(--observatory-surface);
		color: var(--observatory-accent);
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

	.signal-strip {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		width: 100%;
		margin-top: 2.4rem;
		border-top: 1px solid var(--observatory-border);
		border-bottom: 1px solid var(--observatory-border);
	}

	.signal-strip p {
		position: relative;
		isolation: isolate;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 68px;
		margin: 0;
		padding: 0.65rem 0.35rem;
		font-size: 0.75rem;
		font-weight: 650;
		line-height: 1.35;
		letter-spacing: 0.01em;
		text-align: center;
		text-wrap: balance;
		color: var(--observatory-text-muted);
		transition:
			background-color 180ms ease,
			color 180ms ease;
	}

	.signal-strip p::after {
		content: '';
		position: absolute;
		right: 0;
		bottom: 0;
		left: 0;
		height: 2px;
		background: var(--observatory-accent);
		transform: scaleX(0);
		transform-origin: left;
		transition: transform 260ms cubic-bezier(0.22, 1, 0.36, 1);
	}

	.signal-strip p span {
		position: relative;
		z-index: 1;
		display: inline-block;
		transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
	}

	.signal-strip p + p {
		border-left: 1px solid var(--observatory-border);
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
		transition:
			transform 240ms cubic-bezier(0.22, 1, 0.36, 1),
			border-color 180ms ease,
			box-shadow 240ms ease;
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
		border-color: var(--observatory-add-border);
		background: var(--observatory-add-soft);
		color: var(--observatory-add);
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
		color: var(--observatory-add);
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
		transition:
			transform 200ms cubic-bezier(0.22, 1, 0.36, 1),
			background-color 180ms ease,
			border-color 180ms ease;
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
		transition:
			transform 180ms ease,
			background-color 180ms ease,
			border-color 180ms ease,
			color 180ms ease;
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
		transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
	}

	.event-body {
		padding: 1rem;
		border: 1px solid var(--observatory-border);
		border-radius: 12px;
		background: var(--observatory-surface);
		transition:
			transform 220ms cubic-bezier(0.22, 1, 0.36, 1),
			background-color 180ms ease,
			border-color 180ms ease,
			box-shadow 220ms ease;
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
		transition: opacity 240ms ease;
	}

	.history-line,
	.forecast-line {
		fill: none;
		stroke-width: 3;
		stroke-linecap: round;
		stroke-linejoin: round;
		transition:
			filter 220ms ease,
			stroke-width 220ms ease;
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

	@media (hover: hover) {
		.signal-strip p:hover {
			background: var(--observatory-accent-soft);
			color: var(--observatory-text);
		}

		.signal-strip p:hover::after {
			transform: scaleX(1);
		}

		.signal-strip p:hover span {
			transform: translateY(-2px);
		}

		.inventory-demo:hover,
		.forecast-demo:hover {
			border-color: var(--observatory-accent-border);
			box-shadow:
				var(--observatory-shadow),
				0 0 0 1px var(--observatory-accent-border);
			transform: translateY(-4px);
		}

		.inventory-counts > div:hover {
			border-color: var(--observatory-accent-border);
			background: var(--observatory-surface-solid);
			transform: translateY(-3px);
		}

		.booth-tags span:hover {
			border-color: var(--observatory-accent-border);
			background: var(--observatory-accent-soft);
			color: var(--observatory-text);
			transform: translateY(-2px);
		}

		.transaction-event:hover .event-marker {
			transform: scale(1.08);
		}

		.transaction-event:hover .event-body {
			border-color: var(--observatory-accent-border);
			background: var(--observatory-surface-solid);
			box-shadow: 0 0 0 1px var(--observatory-accent-border);
			transform: translateX(4px);
		}

		.forecast-demo:hover .confidence-area {
			opacity: 1;
		}

		.forecast-demo:hover .forecast-line {
			filter: drop-shadow(0 0 3px var(--observatory-accent));
			stroke-width: 4;
		}

		.rail button.rail-stop:hover {
			background: var(--observatory-surface-soft);
			color: var(--observatory-text);
		}

		.rail button.rail-stop:hover .rail-dot {
			transform: scale(1.16);
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
	}

	@media (min-width: 480px) {
		.actions {
			display: flex;
			flex-wrap: wrap;
			width: auto;
		}

		.action {
			min-width: 10.5rem;
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

		.headline-line {
			display: block;
		}

		.signal-strip {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}

		.signal-strip p {
			min-height: 0;
			padding: 0.9rem 1rem;
			font-size: 0.82rem;
			text-align: center;
		}

		.signal-strip p + p {
			border-left: 1px solid var(--observatory-border);
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

	@media (min-width: 768px) {
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

		.rail-stop:hover .rail-label,
		.rail-stop:focus-visible .rail-label {
			opacity: 1;
			transform: translateX(0);
		}

		.hero-layout {
			grid-template-columns: repeat(12, minmax(0, 1fr));
		}

		.hero-copy {
			grid-column: 1 / 12;
			padding-left: clamp(1rem, 4vw, 3.5rem);
		}

		.hero h1 {
			max-width: none;
			font-size: clamp(3.5rem, 5.4vw, 5.1rem);
		}

		.headline-line {
			white-space: nowrap;
		}

		.signal-strip {
			grid-column: 2 / 12;
			margin-top: 3rem;
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

	@media (min-width: 1200px) {
		.page {
			padding-right: 5.5rem;
			padding-left: 2.5rem;
		}

		.rail {
			right: max(1.5rem, var(--safe-area-inset-right));
		}
	}

	@media (prefers-reduced-motion: reduce), (max-height: 540px) {
		:global(html.home-snap) {
			scroll-snap-type: none;
			scroll-behavior: auto;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.hero-layout {
			animation: none;
		}

		.action,
		.rail button.rail-stop,
		.rail-label,
		.rail-dot,
		.signal-strip p,
		.signal-strip p::after,
		.signal-strip p span,
		.inventory-demo,
		.forecast-demo,
		.inventory-counts > div,
		.booth-tags span,
		.event-marker,
		.event-body,
		.confidence-area,
		.history-line,
		.forecast-line {
			transition: none;
		}

		.signal-strip p:hover span,
		.inventory-demo:hover,
		.forecast-demo:hover,
		.inventory-counts > div:hover,
		.booth-tags span:hover,
		.transaction-event:hover .event-marker,
		.transaction-event:hover .event-body,
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

		.eyebrow {
			margin-bottom: 0.55rem;
		}

		.hero h1 {
			max-width: none;
			font-size: clamp(2.4rem, 6vw, 3.25rem);
			line-height: 0.94;
		}

		.headline-line {
			white-space: nowrap;
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

		.signal-strip {
			margin-top: 0.85rem;
		}

		.signal-strip p {
			min-height: 44px;
			padding: 0.4rem 0.45rem;
			font-size: 0.75rem;
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
		.inventory-counts > div {
			border-width: 2px;
		}

		.rail-dot {
			border-width: 3px;
		}
	}
</style>
