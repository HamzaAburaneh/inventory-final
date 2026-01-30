<script>
	import { authStore } from '../stores/authStore.js';
	import { fly } from 'svelte/transition';
	import ThreeScene from '../components/ThreeScene.svelte';

	let showFeatures = $state(false);
	let activeTestimonial = $state(0);
	let showBackToTop = $state(false);
	let hoveredCard = $state(-1);

	// Store values as reactive state
	let authUser = $state(null);

	// Subscribe to stores
	$effect(() => {
		const unsubscribeAuth = authStore.subscribe((value) => {
			authUser = value;
		});

		return () => {
			unsubscribeAuth();
		};
	});

	const features = [
		{ 
			name: 'Real-time Tracking', 
			icon: 'fa-chart-line',
			description: 'Monitor your inventory in real-time with advanced tracking capabilities and instant updates.'
		},
		{ 
			name: 'Smart Analytics', 
			icon: 'fa-brain',
			description: 'Leverage AI-powered insights to optimize stock levels and predict future demand patterns.'
		},
		{ 
			name: 'Easy Management', 
			icon: 'fa-tasks',
			description: 'Streamline operations with intuitive interfaces and automated workflow management.'
		},
		{ 
			name: 'Secure Data', 
			icon: 'fa-shield-alt',
			description: 'Enterprise-grade security ensures your inventory data is protected at all times.'
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

	function nextTestimonial() {
		activeTestimonial = (activeTestimonial + 1) % testimonials.length;
	}

	function prevTestimonial() {
		activeTestimonial = (activeTestimonial - 1 + testimonials.length) % testimonials.length;
	}

	function scrollToSection(sectionId) {
		const section = document.getElementById(sectionId);
		if (section) {
			section.scrollIntoView({ behavior: 'smooth' });
		}
	}

	function scrollToTop() {
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	function handleScroll() {
		showBackToTop = window.pageYOffset > 300;
	}

	$effect(() => {
		const links = document.querySelectorAll('a[href^="#"]');
		links.forEach((link) => {
			link.addEventListener('click', (e) => {
				e.preventDefault();
				const href = link.getAttribute('href');
				if (href) {
					scrollToSection(href.slice(1));
				}
			});
		});

		window.addEventListener('scroll', handleScroll);

		return () => {
			window.removeEventListener('scroll', handleScroll);
		};
	});
</script>

<svelte:head>
	<title>StockSense | Intelligent Inventory Management</title>
</svelte:head>

<div class="page-viewport">
	<ThreeScene />
	<div class="glow-layer"></div>

	<main class="content-container">
		<!-- Hero Section -->
		<section id="hero" class="hero-section">
			<div class="hero-content">
				<div class="status-badge">
					<span class="status-dot"></span>
					<span class="status-text">SYSTEM ONLINE</span>
				</div>
				
				<h1 class="hero-title">
					Welcome to <span class="highlight">StockSense</span>
				</h1>
				
				<p class="hero-subtitle">
					Your intelligent inventory management solution
				</p>
				
				{#if !authUser}
					<div class="hero-cta">
						<a href="/login" class="cta-button primary">
							<i class="fas fa-rocket"></i>
							<span>Get Started</span>
						</a>
						<a href="#features" class="cta-button secondary">
							<i class="fas fa-info-circle"></i>
							<span>Learn More</span>
						</a>
					</div>
				{/if}
			</div>
		</section>

		<!-- Features Section -->
		<section id="features" class="features-section">
			<div class="section-header">
				<h2 class="section-title">Key Features</h2>
				<div class="title-underline"></div>
			</div>
			
			<div class="features-grid">
				{#each features as feature, i (feature.name)}
					<div
						class="feature-card"
						role="article"
						onmouseenter={() => (hoveredCard = i)}
						onmouseleave={() => (hoveredCard = -1)}
						style="transform: {hoveredCard === i ? 'translateY(-8px)' : 'translateY(0)'};"
					>
						<div class="feature-icon">
							<i class="fas {feature.icon}"></i>
						</div>
						<h3 class="feature-title">{feature.name}</h3>
						<p class="feature-description">{feature.description}</p>
						<div class="feature-glow"></div>
					</div>
				{/each}
			</div>
		</section>

		<!-- Testimonials Section -->
		<section id="testimonials" class="testimonials-section">
			<div class="section-header">
				<h2 class="section-title">What Our Users Say</h2>
				<div class="title-underline"></div>
			</div>
			
			<div class="testimonials-grid">
				{#each testimonials as testimonial, i (testimonial.name)}
					<div class="testimonial-card-new">
						<div class="card-top">
							<div class="stars" aria-label="5 star rating">
								{#each Array(5) as _, starIdx (starIdx)}
									<i class="fas fa-star" aria-hidden="true"></i>
								{/each}
							</div>
							<div class="quote-mark">
								<i class="fas fa-quote-right"></i>
							</div>
						</div>
						<p class="testimonial-text-new">{testimonial.text}</p>
						<div class="testimonial-footer">
							<div class="author-avatar-new">
								<i class="fas fa-user"></i>
							</div>
							<div class="author-details">
								<p class="author-name-new">{testimonial.name}</p>
								<p class="author-role-new">{testimonial.role}</p>
							</div>
						</div>
					</div>
				{/each}
			</div>
		</section>

		<!-- CTA Section -->
		{#if !authUser}
			<section id="cta" class="cta-section">
				<div class="cta-card">
					<div class="cta-content">
						<h2 class="cta-title">Ready to optimize your inventory?</h2>
						<p class="cta-text">
							Join thousands of businesses already using StockSense to streamline their operations.
						</p>
						<a href="/login" class="cta-button large primary">
							<i class="fas fa-rocket"></i>
							<span>Start Your Free Trial</span>
						</a>
					</div>
					<div class="cta-glow"></div>
				</div>
			</section>
		{/if}
	</main>
</div>

{#if showBackToTop}
	<button onclick={scrollToTop} class="back-to-top" aria-label="Back to top" transition:fly={{ y: 20, duration: 300 }}>
		<i class="fas fa-arrow-up" aria-hidden="true"></i>
	</button>
{/if}

<style>
	:global(body) {
		background-color: var(--tech-bg-end) !important;
		background-image: radial-gradient(circle at 50% -10%, var(--tech-bg-start) 0%, var(--tech-bg-end) 100%) !important;
		background-attachment: fixed !important;
		margin: 0;
		padding: 0;
		overflow-x: hidden;
	}

	.page-viewport {
		position: relative;
		min-height: 100vh;
		width: 100%;
	}

	.glow-layer {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100vh;
		background: radial-gradient(circle at 50% 0%, var(--tech-accent-muted) 0%, transparent 50%);
		pointer-events: none;
		z-index: 0;
	}


	.content-container {
		position: relative;
		z-index: 2;
		max-width: 1400px;
		margin: 0 auto;
		padding: 2rem 1.5rem;
	}

	/* Hero Section */
	.hero-section {
		position: relative;
		min-height: 50vh;
		display: flex;
		align-items: center;
		justify-content: center;
		text-align: center;
		margin-bottom: 4rem;
		overflow: hidden;
	}

	.hero-content {
		max-width: 900px;
	}

	.status-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		background: rgba(255, 255, 255, 0.02);
		border: 1px solid var(--tech-glass-border);
		border-radius: 20px;
		margin-bottom: 2rem;
	}

	.status-dot {
		width: 6px;
		height: 6px;
		background: var(--tech-accent);
		border-radius: 50%;
		box-shadow: 0 0 10px var(--tech-accent-muted);
		animation: pulse-soft 3s ease-in-out infinite;
	}

	@keyframes pulse-soft {
		0%, 100% { opacity: 0.4; transform: scale(0.9); }
		50% { opacity: 1; transform: scale(1.1); }
	}


	.status-text {
		font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		font-size: 0.65rem;
		color: var(--tech-status-text);
		letter-spacing: 0.2em;
		font-weight: 800;
	}

	.hero-title {
		font-size: clamp(2rem, 5vw, 3.5rem);
		font-weight: 800;
		color: var(--tech-title);
		margin: 0 0 1rem 0;
		letter-spacing: -0.02em;
		line-height: 1.1;
	}

	.highlight {
		color: var(--tech-accent);
		text-shadow: 0 0 30px var(--tech-accent-muted);
	}

	.hero-subtitle {
		font-size: clamp(1rem, 2vw, 1.25rem);
		color: var(--tech-label);
		margin: 0 0 2rem 0;
		opacity: 0.9;
	}

	.hero-cta {
		display: flex;
		gap: 1rem;
		justify-content: center;
		flex-wrap: wrap;
	}

	.cta-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.625rem;
		padding: 0.875rem 1.75rem;
		font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		font-size: 0.85rem;
		font-weight: 800;
		letter-spacing: 0.05em;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.3s;
		text-decoration: none;
		border: 1px solid transparent;
	}

	.cta-button i {
		display: flex;
		align-items: center;
		justify-content: center;
		line-height: 1;
		transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.cta-button.primary {
		background: var(--tech-accent);
		color: #000;
		box-shadow: 0 0 20px var(--tech-accent-muted);
	}

	.cta-button.primary:hover {
		transform: translateY(-3px);
		box-shadow: 0 5px 30px var(--tech-accent-muted);
	}

	.cta-button.primary:hover i {
		transform: translate(4px, -4px) scale(1.1);
	}

	.cta-button.secondary {
		background: transparent;
		color: var(--tech-accent);
		border-color: var(--tech-accent);
	}

	.cta-button.secondary:hover {
		background: var(--tech-accent-muted);
		transform: translateY(-3px);
	}

	.cta-button.large {
		padding: 1rem 2rem;
		font-size: 0.9rem;
	}

	/* Section Headers */
	.section-header {
		text-align: center;
		margin-bottom: 2.5rem;
	}

	.section-title {
		font-size: clamp(1.75rem, 3.5vw, 2.5rem);
		font-weight: 800;
		color: var(--tech-title);
		margin: 0 0 0.75rem 0;
		letter-spacing: 0.02em;
	}

	.title-underline {
		width: 80px;
		height: 3px;
		background: var(--tech-accent);
		margin: 0 auto;
		box-shadow: 0 0 15px var(--tech-accent-muted);
	}

	/* Features Section */
	.features-section {
		margin-bottom: 5rem;
	}

	.features-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: 1.5rem;
	}

	.feature-card {
		position: relative;
		background: var(--tech-glass-bg);
		border: 1px solid var(--tech-glass-border);
		border-radius: 12px;
		padding: 2rem 1.5rem;
		transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
		overflow: hidden;
	}

	.feature-card:hover {
		border-color: var(--tech-accent);
		box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
	}

	.feature-icon {
		width: 60px;
		height: 60px;
		background: var(--tech-accent-muted);
		border: 2px solid var(--tech-accent);
		border-radius: 10px;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 1.25rem;
		font-size: 1.75rem;
		color: var(--tech-accent);
		transition: all 0.3s;
	}

	.feature-card:hover .feature-icon {
		transform: scale(1.1) rotate(5deg);
		box-shadow: 0 0 25px var(--tech-accent-muted);
	}

	.feature-title {
		font-size: 1.2rem;
		font-weight: 700;
		color: var(--tech-title);
		margin: 0 0 0.75rem 0;
		letter-spacing: 0.02em;
	}

	.feature-description {
		font-size: 0.9rem;
		color: var(--tech-label);
		line-height: 1.6;
		margin: 0;
	}

	.feature-glow {
		position: absolute;
		bottom: -50%;
		left: -50%;
		width: 200%;
		height: 200%;
		background: radial-gradient(circle, var(--tech-accent-muted) 0%, transparent 70%);
		opacity: 0;
		transition: opacity 0.4s;
		pointer-events: none;
	}

	.feature-card:hover .feature-glow {
		opacity: 0.15;
	}

	/* Testimonials Section */
	.testimonials-section {
		margin-bottom: 5rem;
	}

	.testimonials-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 1.5rem;
		max-width: 1200px;
		margin: 0 auto;
	}

	.testimonial-card-new {
		background: var(--tech-glass-bg);
		border: 1px solid var(--tech-glass-border);
		border-radius: 12px;
		padding: 1.75rem;
		transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
		position: relative;
		overflow: hidden;
	}

	.testimonial-card-new:hover {
		transform: translateY(-5px);
		border-color: var(--tech-accent);
		box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
	}

	.card-top {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 1rem;
	}

	.stars {
		display: flex;
		gap: 0.2rem;
	}

	.stars i {
		color: var(--tech-accent);
		font-size: 0.75rem;
	}

	.quote-mark {
		font-size: 1.5rem;
		color: var(--tech-accent);
		opacity: 0.2;
		line-height: 1;
	}

	.testimonial-text-new {
		font-size: 0.95rem;
		color: var(--tech-value);
		line-height: 1.6;
		margin: 0 0 1.5rem 0;
		min-height: 80px;
	}

	.testimonial-footer {
		display: flex;
		align-items: center;
		gap: 0.875rem;
		padding-top: 1.25rem;
		border-top: 1px solid var(--tech-cell-border);
	}

	.author-avatar-new {
		width: 40px;
		height: 40px;
		background: var(--tech-accent-muted);
		border: 2px solid var(--tech-accent);
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--tech-accent);
		font-size: 1rem;
		flex-shrink: 0;
	}

	.author-details {
		flex: 1;
	}

	.author-name-new {
		font-size: 0.95rem;
		font-weight: 700;
		color: var(--tech-title);
		margin: 0 0 0.2rem 0;
	}

	.author-role-new {
		font-size: 0.75rem;
		color: var(--tech-label);
		margin: 0;
		font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		letter-spacing: 0.02em;
	}

	/* CTA Section */
	.cta-section {
		margin-bottom: 3rem;
	}

	.cta-card {
		position: relative;
		background: var(--tech-glass-bg);
		border: 1px solid var(--tech-glass-border);
		border-radius: 12px;
		padding: 3rem 2.5rem;
		text-align: center;
		overflow: hidden;
		transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.cta-card:hover {
		transform: translateY(-5px);
		border-color: var(--tech-accent);
		box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
	}

	.cta-content {
		position: relative;
		z-index: 2;
	}

	.cta-title {
		font-size: clamp(1.5rem, 3.5vw, 2rem);
		font-weight: 800;
		color: var(--tech-title);
		margin: 0 0 0.75rem 0;
	}

	.cta-text {
		font-size: 1rem;
		color: var(--tech-label);
		margin: 0 0 2rem 0;
		max-width: 600px;
		margin-left: auto;
		margin-right: auto;
	}

	.cta-glow {
		position: absolute;
		top: -50%;
		left: -50%;
		width: 200%;
		height: 200%;
		background: radial-gradient(circle, var(--tech-accent-muted) 0%, transparent 70%);
		opacity: 0.1;
		pointer-events: none;
		transition: all 0.6s ease;
	}

	.cta-card:hover .cta-glow {
		opacity: 0.2;
		transform: scale(1.1);
	}

	/* Back to Top */
	.back-to-top {
		position: fixed;
		bottom: 2rem;
		right: 2rem;
		width: 50px;
		height: 50px;
		background: var(--tech-accent);
		color: #000;
		border: none;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.3s;
		box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
		z-index: 100;
		padding: 0;
	}

	.back-to-top i {
		display: flex;
		align-items: center;
		justify-content: center;
		line-height: 1;
		font-size: 1.1rem;
	}

	.back-to-top:hover {
		transform: translateY(-5px);
		box-shadow: 0 8px 25px var(--tech-accent-muted);
	}

	/* ===== MOBILE RESPONSIVENESS ===== */

	/* Extra small devices (320px - 374px) - iPhone SE, older phones */
	@media (max-width: 374px) {
		.content-container {
			padding: 1rem 0.75rem;
			padding-top: max(1rem, env(safe-area-inset-top));
			padding-bottom: max(1rem, env(safe-area-inset-bottom));
		}

		.hero-section {
			min-height: 45vh;
			margin-bottom: 2.5rem;
		}

		.status-badge {
			padding: 0.4rem 0.75rem;
			margin-bottom: 1.5rem;
		}

		.status-text {
			font-size: 0.6rem;
		}

		.hero-title {
			font-size: 1.75rem;
			margin-bottom: 0.75rem;
		}

		.hero-subtitle {
			font-size: 0.9rem;
			margin-bottom: 1.5rem;
		}

		.hero-cta {
			flex-direction: column;
			gap: 0.75rem;
		}

		.cta-button {
			width: 100%;
			padding: 0.875rem 1.25rem;
			font-size: 0.8rem;
			min-height: 48px;
		}

		.cta-button.large {
			padding: 1rem 1.5rem;
			font-size: 0.85rem;
		}

		.section-header {
			margin-bottom: 1.75rem;
		}

		.section-title {
			font-size: 1.5rem;
		}

		.title-underline {
			width: 60px;
			height: 2px;
		}

		.features-section,
		.testimonials-section {
			margin-bottom: 3rem;
		}

		.features-grid {
			grid-template-columns: 1fr;
			gap: 1rem;
		}

		.feature-card {
			padding: 1.5rem 1.25rem;
		}

		.feature-icon {
			width: 50px;
			height: 50px;
			font-size: 1.5rem;
			margin-bottom: 1rem;
		}

		.feature-title {
			font-size: 1.1rem;
		}

		.feature-description {
			font-size: 0.85rem;
		}

		.testimonials-grid {
			grid-template-columns: 1fr;
			gap: 1rem;
		}

		.testimonial-card-new {
			padding: 1.25rem;
		}

		.testimonial-text-new {
			font-size: 0.9rem;
			min-height: auto;
			margin-bottom: 1.25rem;
		}

		.testimonial-footer {
			padding-top: 1rem;
		}

		.author-avatar-new {
			width: 36px;
			height: 36px;
			font-size: 0.9rem;
		}

		.author-name-new {
			font-size: 0.9rem;
		}

		.author-role-new {
			font-size: 0.7rem;
		}

		.cta-section {
			margin-bottom: 2rem;
		}

		.cta-card {
			padding: 2rem 1.25rem;
		}

		.cta-title {
			font-size: 1.25rem;
		}

		.cta-text {
			font-size: 0.9rem;
			margin-bottom: 1.5rem;
		}

		.back-to-top {
			bottom: max(1rem, env(safe-area-inset-bottom));
			right: 1rem;
			width: 44px;
			height: 44px;
		}

		.back-to-top i {
			font-size: 0.95rem;
		}
	}

	/* Small devices (375px - 479px) - iPhone 12/13/14, standard phones */
	@media (min-width: 375px) and (max-width: 479px) {
		.content-container {
			padding: 1.25rem 1rem;
			padding-top: max(1.25rem, env(safe-area-inset-top));
			padding-bottom: max(1.25rem, env(safe-area-inset-bottom));
		}

		.hero-section {
			min-height: 50vh;
			margin-bottom: 3rem;
		}

		.status-badge {
			margin-bottom: 1.75rem;
		}

		.hero-title {
			font-size: 2rem;
		}

		.hero-subtitle {
			font-size: 1rem;
		}

		.hero-cta {
			flex-direction: column;
			gap: 0.875rem;
		}

		.cta-button {
			width: 100%;
			padding: 0.875rem 1.5rem;
			min-height: 50px;
		}

		.section-title {
			font-size: 1.6rem;
		}

		.features-section,
		.testimonials-section {
			margin-bottom: 3.5rem;
		}

		.features-grid {
			grid-template-columns: 1fr;
			gap: 1.25rem;
		}

		.feature-card {
			padding: 1.75rem 1.5rem;
		}

		.testimonials-grid {
			grid-template-columns: 1fr;
			gap: 1.25rem;
		}

		.testimonial-card-new {
			padding: 1.5rem;
		}

		.testimonial-text-new {
			min-height: auto;
		}

		.cta-card {
			padding: 2.5rem 1.5rem;
		}

		.cta-title {
			font-size: 1.4rem;
		}

		.back-to-top {
			bottom: max(1.25rem, env(safe-area-inset-bottom));
			right: 1.25rem;
			width: 46px;
			height: 46px;
		}
	}

	/* Medium devices (480px - 639px) - Large phones, phablets */
	@media (min-width: 480px) and (max-width: 639px) {
		.content-container {
			padding: 1.5rem 1.25rem;
			padding-top: max(1.5rem, env(safe-area-inset-top));
			padding-bottom: max(1.5rem, env(safe-area-inset-bottom));
		}

		.hero-section {
			min-height: 55vh;
			margin-bottom: 3.5rem;
		}

		.hero-cta {
			flex-direction: row;
			justify-content: center;
		}

		.cta-button {
			width: auto;
			min-width: 160px;
			min-height: 50px;
		}

		.features-section,
		.testimonials-section {
			margin-bottom: 4rem;
		}

		.features-grid {
			grid-template-columns: 1fr;
			gap: 1.25rem;
		}

		.testimonials-grid {
			grid-template-columns: 1fr;
			gap: 1.25rem;
		}

		.testimonial-text-new {
			min-height: auto;
		}

		.cta-card {
			padding: 2.5rem 2rem;
		}

		.back-to-top {
			bottom: max(1.5rem, env(safe-area-inset-bottom));
			right: 1.5rem;
			width: 48px;
			height: 48px;
		}
	}

	/* Small tablets (640px - 767px) */
	@media (min-width: 640px) and (max-width: 767px) {
		.content-container {
			padding: 1.75rem 1.5rem;
		}

		.hero-section {
			min-height: 50vh;
			margin-bottom: 4rem;
		}

		.features-section,
		.testimonials-section {
			margin-bottom: 4.5rem;
		}

		.features-grid {
			grid-template-columns: repeat(2, 1fr);
			gap: 1.25rem;
		}

		.feature-card {
			padding: 1.75rem 1.5rem;
		}

		.testimonials-grid {
			grid-template-columns: 1fr;
			gap: 1.25rem;
		}

		.testimonial-text-new {
			min-height: auto;
		}

		.cta-card {
			padding: 2.75rem 2rem;
		}

		.back-to-top {
			bottom: 1.5rem;
			right: 1.5rem;
			width: 48px;
			height: 48px;
		}
	}

	/* Tablets (768px - 1023px) */
	@media (min-width: 768px) and (max-width: 1023px) {
		.content-container {
			padding: 2rem 1.5rem;
		}

		.hero-section {
			margin-bottom: 4rem;
		}

		.features-section,
		.testimonials-section {
			margin-bottom: 4.5rem;
		}

		.features-grid {
			grid-template-columns: repeat(2, 1fr);
			gap: 1.5rem;
		}

		.testimonials-grid {
			grid-template-columns: repeat(2, 1fr);
			gap: 1.5rem;
		}

		.testimonial-text-new {
			min-height: 90px;
		}

		.cta-card {
			padding: 3rem 2rem;
		}
	}

	/* Large tablets / small desktops (1024px - 1279px) */
	@media (min-width: 1024px) and (max-width: 1279px) {
		.features-grid {
			grid-template-columns: repeat(4, 1fr);
			gap: 1.25rem;
		}

		.feature-card {
			padding: 1.75rem 1.25rem;
		}

		.testimonials-grid {
			grid-template-columns: repeat(3, 1fr);
			gap: 1.5rem;
		}
	}

	/* Landscape mode for phones */
	@media (max-height: 500px) and (orientation: landscape) {
		.content-container {
			padding: 1rem 2rem;
			padding-left: max(2rem, env(safe-area-inset-left));
			padding-right: max(2rem, env(safe-area-inset-right));
		}

		.hero-section {
			min-height: auto;
			padding: 2rem 0;
			margin-bottom: 2rem;
		}

		.status-badge {
			margin-bottom: 1rem;
		}

		.hero-title {
			font-size: 1.75rem;
			margin-bottom: 0.5rem;
		}

		.hero-subtitle {
			margin-bottom: 1rem;
		}

		.hero-cta {
			flex-direction: row;
		}

		.cta-button {
			padding: 0.75rem 1.25rem;
		}

		.section-header {
			margin-bottom: 1.5rem;
		}

		.features-section,
		.testimonials-section {
			margin-bottom: 2.5rem;
		}

		.features-grid {
			grid-template-columns: repeat(2, 1fr);
			gap: 1rem;
		}

		.feature-card {
			padding: 1.25rem 1rem;
		}

		.feature-icon {
			width: 45px;
			height: 45px;
			font-size: 1.25rem;
			margin-bottom: 0.75rem;
		}

		.testimonials-grid {
			grid-template-columns: repeat(2, 1fr);
			gap: 1rem;
		}

		.testimonial-card-new {
			padding: 1.25rem;
		}

		.testimonial-text-new {
			min-height: auto;
			margin-bottom: 1rem;
		}

		.cta-section {
			margin-bottom: 1.5rem;
		}

		.cta-card {
			padding: 1.5rem;
		}

		.cta-text {
			margin-bottom: 1rem;
		}

		.back-to-top {
			bottom: 0.75rem;
			right: max(0.75rem, env(safe-area-inset-right));
			width: 40px;
			height: 40px;
		}

		.back-to-top i {
			font-size: 0.9rem;
		}
	}

	/* Touch interaction improvements */
	@media (hover: none) and (pointer: coarse) {
		.cta-button {
			-webkit-tap-highlight-color: transparent;
			min-height: 48px;
		}

		.cta-button:active {
			transform: scale(0.98);
			transition: transform 0.1s;
		}

		.cta-button.primary:active {
			box-shadow: 0 2px 15px var(--tech-accent-muted);
		}

		.feature-card {
			-webkit-tap-highlight-color: transparent;
		}

		.feature-card:active {
			transform: scale(0.99);
			transition: transform 0.15s;
		}

		.testimonial-card-new {
			-webkit-tap-highlight-color: transparent;
		}

		.testimonial-card-new:active {
			transform: scale(0.99);
		}

		.back-to-top {
			-webkit-tap-highlight-color: transparent;
			min-width: 48px;
			min-height: 48px;
		}

		.back-to-top:active {
			transform: scale(0.95);
			transition: transform 0.1s;
		}

		/* Disable hover effects on touch devices */
		.feature-card:hover {
			transform: none;
		}

		.feature-card:hover .feature-icon {
			transform: none;
		}

		.testimonial-card-new:hover {
			transform: none;
		}

		.cta-card:hover {
			transform: none;
		}

		.back-to-top:hover {
			transform: none;
		}
	}

	/* Reduced motion for accessibility */
	@media (prefers-reduced-motion: reduce) {
		.status-dot {
			animation: none;
		}

		.cta-button,
		.feature-card,
		.feature-icon,
		.testimonial-card-new,
		.cta-card,
		.cta-glow,
		.feature-glow,
		.back-to-top {
			transition: none;
		}

		.cta-button:hover,
		.feature-card:hover,
		.testimonial-card-new:hover,
		.cta-card:hover,
		.back-to-top:hover {
			transform: none;
		}

		.feature-card:hover .feature-icon {
			transform: none;
		}

		.cta-button.primary:hover i,
		.cta-button.secondary:hover i {
			transform: none;
		}
	}

	/* High contrast mode support */
	@media (prefers-contrast: high) {
		.feature-card,
		.testimonial-card-new,
		.cta-card,
		.status-badge {
			border-width: 2px;
		}

		.cta-button {
			border-width: 2px;
		}

		.cta-button:focus-visible {
			outline: 3px solid var(--tech-accent);
			outline-offset: 2px;
		}

		.back-to-top:focus-visible {
			outline: 3px solid var(--tech-accent);
			outline-offset: 2px;
		}

		.title-underline {
			height: 4px;
		}
	}

	/* Dark mode enhancements for OLED screens */
	@media (prefers-color-scheme: dark) {
		.feature-card,
		.testimonial-card-new,
		.cta-card {
			box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
		}
	}
</style>
