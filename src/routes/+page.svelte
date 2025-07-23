<script>
	import { fade, fly } from 'svelte/transition';
	import { fadeAndSlide } from '$lib/transitions';
	import { authStore } from '../stores/authStore.js';

	let showFeatures = $state(false);
	let activeTestimonial = $state(0);
	let showBackToTop = $state(false);
	let hoveredCard = $state(-1);
	
	// Store values as reactive state
	let authUser = $state(null);
	
	// Subscribe to stores
	$effect(() => {
		const unsubscribeAuth = authStore.subscribe(value => {
			authUser = value;
		});
		
		return () => {
			unsubscribeAuth();
		};
	});

	const features = [
		{ name: 'Real-time Tracking', icon: 'fa-chart-line' },
		{ name: 'Smart Analytics', icon: 'fa-brain' },
		{ name: 'Easy Management', icon: 'fa-tasks' },
		{ name: 'Secure Data', icon: 'fa-shield-alt' }
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

<main class="container mx-auto px-4 sm:px-6 lg:px-8 py-12" in:fadeAndSlide={{ duration: 300, y: 75 }}>
	<section id="hero" class="hero mb-16 md:mb-24" in:fade={{ duration: 300 }}>
		<h1
			class="text-4xl md:text-6xl font-bold mb-6 md:mb-8 text-center logo-text"
		>
			Welcome to StockSense
		</h1>
		<p class="text-lg md:text-2xl mb-10 md:mb-12 text-center text-secondary">
			Your intelligent inventory management solution
		</p>
		{#if !authUser}
			<div class="text-center">
				<a href="#cta" class="btn-primary" aria-label="Get started with StockSense">
					Get Started
				</a>
			</div>
		{/if}
	</section>

	<section id="features" class="features mb-24" aria-labelledby="features-heading">
		<h2 id="features-heading" class="text-4xl font-semibold mb-12 text-center logo-text">
			Key Features
		</h2>
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
			{#each features as feature, i}
				<div
					class="feature-card"
					role="article"
					aria-labelledby="feature-heading-{i}"
					onmouseenter={() => (hoveredCard = i)}
					onmouseleave={() => (hoveredCard = -1)}
					style="transform: {hoveredCard === i
						? 'scale(1.05) translateY(-5px)'
						: 'scale(1) translateY(0)'}; transition: transform 0.3s ease;"
				>
					<div class="flex items-center mb-4">
						<i class="fas {feature.icon} text-4xl text-logo mr-6" aria-hidden="true"></i>
						<h3 id="feature-heading-{i}" class="text-2xl font-semibold">{feature.name}</h3>
					</div>
					<p class="text-secondary text-lg">
						Streamline your inventory processes with our advanced {feature.name.toLowerCase()} capabilities.
					</p>
				</div>
			{/each}
		</div>
	</section>

	<section id="testimonials" class="testimonials mb-24" aria-labelledby="testimonials-heading">
		<h2 id="testimonials-heading" class="text-4xl font-semibold mb-12 text-center logo-text">
			What Our Users Say
		</h2>
		<div class="relative testimonial-container">
			{#each [testimonials[activeTestimonial]] as testimonial (activeTestimonial)}
				<div in:fade={{ duration: 300 }} role="region" aria-live="polite" class="p-8">
					<p class="text-xl mb-6 italic">"{testimonial.text}"</p>
					<p class="font-semibold text-lg">{testimonial.name}</p>
					<p class="text-secondary">{testimonial.role}</p>
				</div>
			{/each}
			<button
				class="testimonial-nav testimonial-prev"
				onclick={prevTestimonial}
				aria-label="Previous testimonial"
			>
				<i class="fas fa-chevron-left" aria-hidden="true"></i>
			</button>
			<button
				class="testimonial-nav testimonial-next"
				onclick={nextTestimonial}
				aria-label="Next testimonial"
			>
				<i class="fas fa-chevron-right" aria-hidden="true"></i>
			</button>
		</div>
	</section>

	{#if !authUser}
		<section id="cta" class="cta mb-24" in:fade={{ duration: 300 }} aria-labelledby="cta-heading">
			<div class="cta-container">
				<h2 id="cta-heading" class="text-4xl font-semibold mb-6 logo-text">
					Ready to optimize your inventory?
				</h2>
				<p class="text-xl mb-8 text-secondary">
					Join thousands of businesses already using StockSense to streamline their operations.
				</p>
				<a href="/login" class="btn-primary" aria-label="Start your free trial of StockSense">
					Start Your Free Trial
				</a>
			</div>
		</section>
	{/if}
</main>

{#if showBackToTop}
	<button
		onclick={scrollToTop}
		class="back-to-top"
		transition:fade
		aria-label="Scroll to top of page"
	>
		<i class="fas fa-arrow-up" aria-hidden="true"></i>
	</button>
{/if}

<style>
	main {
		max-width: 1200px;
	}

	.logo-text {
		color: var(--nav-logo-color);
		text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.1);
	}

	.text-secondary {
		color: var(--input-text);
		opacity: 0.8;
	}

	.text-logo {
		color: var(--nav-logo-color);
	}

	.feature-card {
		background-color: var(--container-bg);
		padding: 1.5rem;
		border-radius: var(--border-radius);
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08);
	}

	.btn-primary {
		background-color: var(--nav-logo-color);
		color: var(--text-color);
		font-weight: bold;
		padding: 0.75rem 1.5rem;
		border-radius: 9999px;
		font-size: 1.125rem;
		transition: all 0.3s ease;
		display: inline-block;
	}

	.btn-primary:hover {
		background-color: var(--nav-logo-hover-color);
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08);
		transform: translateY(-2px);
	}

	.testimonial-container {
		background-color: var(--container-bg);
		padding: 1.5rem;
		border-radius: var(--border-radius);
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08);
		position: relative;
	}

	.testimonial-nav {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		background-color: var(--nav-logo-color);
		color: var(--text-color);
		border: none;
		border-radius: 9999px;
		padding: 0.5rem;
		font-size: 1rem;
		transition: all 0.3s ease;
		opacity: 0.8;
	}

	.testimonial-nav:hover {
		background-color: var(--nav-logo-hover-color);
		opacity: 1;
	}

	.testimonial-prev {
		left: 1rem;
	}

	.testimonial-next {
		right: 1rem;
	}

	.cta-container {
		background-color: var(--container-bg);
		padding: 2rem;
		border-radius: var(--border-radius);
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08);
		text-align: center;
	}

	.back-to-top {
		position: fixed;
		bottom: 2rem;
		right: 2rem;
		background-color: var(--nav-logo-color);
		color: var(--text-color);
		border-radius: 9999px;
		padding: 0.75rem;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08);
		transition: all 0.3s ease;
		opacity: 0.8;
	}

	.back-to-top:hover {
		background-color: var(--nav-logo-hover-color);
		opacity: 1;
		transform: translateY(-2px);
	}
	@media (min-width: 768px) {
		.feature-card {
			padding: 2rem;
		}
		.btn-primary {
			padding: 1rem 2rem;
			font-size: 1.125rem;
		}
		.testimonial-container {
			padding: 2rem;
		}
		.testimonial-nav {
			padding: 0.75rem;
		}
		.cta-container {
			padding: 3rem;
		}
		.back-to-top {
			padding: 1rem;
		}
	}
</style>
