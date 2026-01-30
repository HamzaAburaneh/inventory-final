<script>
	import { authStore } from '../../stores/authStore';
	import { goto } from '$app/navigation';
	import { createUserWithEmailAndPassword } from 'firebase/auth';
	import { auth } from '../../firebase';
	import { get } from 'svelte/store';
	import { onMount } from 'svelte';
	import { blur } from 'svelte/transition';

	let email = $state('');
	let password = $state('');
	let error = $state('');
	let isRegistering = $state(false);
	let isLoading = $state(false);

	// Check auth status on mount and redirect if already logged in
	onMount(() => {
		const user = get(authStore);
		if (user) {
			goto('/');
		}
	});

	// Subscribe to auth changes for real-time redirect
	$effect(() => {
		const unsubscribe = authStore.subscribe((user) => {
			if (user) {
				// Use queueMicrotask to avoid synchronous navigation in effect
				queueMicrotask(() => goto('/'));
			}
		});
		return unsubscribe;
	});

	async function handleAuth() {
		isLoading = true;
		error = '';
		try {
			if (isRegistering) {
				await createUserWithEmailAndPassword(auth, email, password);
			} else {
				await authStore.login(email, password);
			}
			// Navigation will happen via the $effect subscription
		} catch (err) {
			error = isRegistering
				? 'Registration failed. Please try again.'
				: 'Invalid email or password';
		} finally {
			isLoading = false;
		}
	}

	function toggleMode() {
		isRegistering = !isRegistering;
		error = '';
	}
</script>

<svelte:head>
	<title>{isRegistering ? 'Register' : 'Login'} | StockSense</title>
</svelte:head>

<div class="login-viewport">
	<div class="glow-layer"></div>
	<div class="grid-overlay"></div>
	
	<div class="login-container">
		<div class="login-card" transition:blur={{ duration: 400 }}>
			<!-- Header -->
			<div class="card-header">
				<div class="logo-section">
					<div class="logo-icon">
						<i class="fas fa-box"></i>
					</div>
					<h1 class="logo-text">STOCKSENSE</h1>
				</div>
				<div class="status-indicator">
					<span class="status-dot"></span>
					<span class="status-text">SYSTEM ONLINE</span>
				</div>
			</div>

			<!-- Title -->
			<div class="title-section">
				<h2 class="main-title">
					{isRegistering ? 'CREATE ACCOUNT' : 'LOGIN TO YOUR ACCOUNT'}
				</h2>
				<div class="title-underline"></div>
			</div>

			<!-- Form -->
			<form
				onsubmit={(e) => {
					e.preventDefault();
					handleAuth();
				}}
				class="auth-form"
			>
				<div class="form-group">
					<label for="email" class="form-label">
						<i class="fas fa-envelope label-icon"></i>
						EMAIL
					</label>
					<input
						type="email"
						id="email"
						placeholder="test@example.com"
						required
						bind:value={email}
						class="tech-input"
						disabled={isLoading}
					/>
				</div>

				<div class="form-group">
					<label for="password" class="form-label">
						<i class="fas fa-lock label-icon"></i>
						PASSWORD
					</label>
					<input
						type="password"
						id="password"
						placeholder="••••••••••"
						required
						bind:value={password}
						class="tech-input"
						disabled={isLoading}
					/>
				</div>

				<button type="submit" class="submit-btn" disabled={isLoading}>
					{#if isLoading}
						<div class="spinner"></div>
						<span>PROCESSING...</span>
					{:else}
						<i class="fas fa-{isRegistering ? 'user-plus' : 'sign-in-alt'}"></i>
						<span>{isRegistering ? 'REGISTER' : 'LOG IN'}</span>
					{/if}
				</button>
			</form>

			<!-- Toggle Mode -->
			<div class="toggle-section">
				<button onclick={toggleMode} class="toggle-btn" disabled={isLoading}>
					{isRegistering ? 'Already have an account? Log in' : 'Need an account? Register'}
				</button>
			</div>

			<!-- Test Account Info -->
			<div class="test-info">
				<div class="info-badge">
					<i class="fas fa-info-circle"></i>
					<span>Test account: test@example.com / password123</span>
				</div>
			</div>
		</div>
	</div>
</div>

{#if error}
	<div class="error-notification" transition:blur={{ duration: 300 }}>
		<div class="error-content">
			<i class="fas fa-exclamation-triangle"></i>
			<span>{error}</span>
		</div>
	</div>
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

	.login-viewport {
		position: relative;
		min-height: 100vh;
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem;
		box-sizing: border-box;
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

	.grid-overlay {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100vh;
		background-image: 
			linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
			linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
		background-size: 50px 50px;
		pointer-events: none;
		z-index: 0;
		opacity: 0.3;
	}

	.login-container {
		position: relative;
		z-index: 2;
		width: 100%;
		max-width: 480px;
	}

	.login-card {
		background: var(--tech-glass-bg);
		border: 1px solid var(--tech-glass-border);
		border-radius: 12px;
		padding: 2.5rem;
		box-shadow: 
			0 4px 6px -1px rgba(0, 0, 0, 0.1),
			0 2px 4px -1px rgba(0, 0, 0, 0.06),
			inset 0 0 0 1px rgba(255, 255, 255, 0.02);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
	}

	.card-header {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		margin-bottom: 2rem;
	}

	.logo-section {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.logo-icon {
		width: 40px;
		height: 40px;
		background: var(--tech-accent);
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--tech-brand-icon-color);
		font-size: 1.25rem;
		box-shadow: 0 0 20px var(--tech-accent-muted);
	}

	.logo-text {
		font-size: 1.5rem;
		font-weight: 800;
		color: var(--tech-title);
		letter-spacing: 0.1em;
		margin: 0;
	}

	.status-indicator {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		opacity: 0.7;
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
		font-size: 0.6rem;
		color: var(--tech-status-text);
		letter-spacing: 0.2em;
		font-weight: 800;
	}

	.title-section {
		text-align: center;
		margin-bottom: 2rem;
	}

	.main-title {
		font-size: 1.25rem;
		font-weight: 800;
		color: var(--tech-title);
		letter-spacing: 0.05em;
		margin: 0 0 0.75rem 0;
	}

	.title-underline {
		width: 60px;
		height: 2px;
		background: var(--tech-accent);
		margin: 0 auto;
		box-shadow: 0 0 10px var(--tech-accent-muted);
	}

	.auth-form {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.form-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		font-size: 0.7rem;
		font-weight: 800;
		color: var(--tech-label);
		letter-spacing: 0.1em;
	}

	.label-icon {
		font-size: 0.75rem;
		color: var(--tech-accent);
	}

	.tech-input {
		width: 100%;
		background: var(--tech-badge-bg);
		border: 1px solid var(--tech-glass-border);
		border-radius: 6px;
		padding: 0.875rem 1rem;
		color: var(--tech-value);
		font-family: 'Geist', sans-serif;
		font-size: 0.95rem;
		font-weight: 500;
		transition: all 0.2s;
		box-sizing: border-box;
	}

	.tech-input::placeholder {
		color: var(--tech-label);
		opacity: 0.5;
	}

	.tech-input:focus {
		outline: none;
		border-color: var(--tech-accent);
		background: var(--tech-header-bg);
		box-shadow: 0 0 0 3px var(--tech-accent-muted);
	}

	.tech-input:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.submit-btn {
		width: 100%;
		background: var(--tech-accent);
		border: 1px solid var(--tech-accent);
		color: #000;
		padding: 1rem;
		font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		font-size: 0.85rem;
		font-weight: 800;
		letter-spacing: 0.1em;
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.3s;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		margin-top: 0.5rem;
		box-shadow: 0 0 20px var(--tech-accent-muted);
	}

	.submit-btn:hover:not(:disabled) {
		transform: translateY(-2px);
		box-shadow: 0 5px 25px var(--tech-accent-muted);
	}

	.submit-btn:active:not(:disabled) {
		transform: translateY(0);
	}

	.submit-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.spinner {
		width: 16px;
		height: 16px;
		border: 2px solid rgba(0, 0, 0, 0.2);
		border-top-color: #000;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.toggle-section {
		text-align: center;
		margin-top: 1.5rem;
		padding-top: 1.5rem;
		border-top: 1px solid var(--tech-cell-border);
	}

	.toggle-btn {
		background: transparent;
		border: none;
		color: var(--tech-accent);
		font-family: 'Geist', sans-serif;
		font-size: 0.9rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
		padding: 0.5rem;
	}

	.toggle-btn:hover:not(:disabled) {
		text-decoration: underline;
		text-shadow: 0 0 10px var(--tech-accent-muted);
	}

	.toggle-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.test-info {
		margin-top: 1.5rem;
		padding-top: 1.5rem;
		border-top: 1px solid var(--tech-cell-border);
	}

	.info-badge {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		background: rgba(255, 255, 255, 0.02);
		border: 1px solid var(--tech-cell-border);
		border-radius: 6px;
		font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		font-size: 0.7rem;
		color: var(--tech-label);
		letter-spacing: 0.02em;
	}

	.info-badge i {
		color: var(--tech-accent);
		font-size: 0.85rem;
	}

	.error-notification {
		position: fixed;
		top: 2rem;
		right: 2rem;
		z-index: 10000;
		background: var(--tech-glass-bg);
		border: 1px solid rgba(239, 68, 68, 0.3);
		border-left: 4px solid #ef4444;
		border-radius: 8px;
		padding: 1rem 1.5rem;
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
		max-width: 400px;
	}

	.error-content {
		display: flex;
		align-items: center;
		gap: 1rem;
		color: var(--tech-value);
		font-weight: 600;
		font-size: 0.9rem;
	}

	.error-content i {
		color: #ef4444;
		font-size: 1.1rem;
	}

	/* ===== MOBILE RESPONSIVENESS ===== */

	/* Extra small devices (320px - 374px) - iPhone SE, older phones */
	@media (max-width: 374px) {
		.login-viewport {
			padding: 0.75rem;
			padding-top: env(safe-area-inset-top, 0.75rem);
			padding-bottom: env(safe-area-inset-bottom, 0.75rem);
		}

		.login-card {
			padding: 1.5rem 1rem;
			border-radius: 10px;
		}

		.logo-icon {
			width: 36px;
			height: 36px;
			font-size: 1rem;
		}

		.logo-text {
			font-size: 1.1rem;
			letter-spacing: 0.05em;
		}

		.status-text {
			font-size: 0.65rem;
		}

		.main-title {
			font-size: 0.95rem;
		}

		.form-label {
			font-size: 0.75rem;
		}

		.tech-input {
			padding: 0.75rem;
			font-size: 16px; /* Prevents iOS zoom on focus */
		}

		.submit-btn {
			padding: 0.875rem;
			font-size: 0.8rem;
			min-height: 48px; /* Touch target minimum */
		}

		.toggle-btn {
			font-size: 0.85rem;
			padding: 0.75rem;
			min-height: 44px; /* Touch target minimum */
		}

		.info-badge {
			flex-direction: column;
			gap: 0.5rem;
			padding: 0.75rem;
			font-size: 0.7rem;
			text-align: center;
		}

		.error-notification {
			top: env(safe-area-inset-top, 0.5rem);
			right: 0.5rem;
			left: 0.5rem;
			padding: 0.75rem 1rem;
		}

		.error-content {
			font-size: 0.85rem;
			gap: 0.75rem;
		}
	}

	/* Small devices (375px - 479px) - iPhone 12/13/14, standard phones */
	@media (min-width: 375px) and (max-width: 479px) {
		.login-viewport {
			padding: 1rem;
			padding-top: max(1rem, env(safe-area-inset-top));
			padding-bottom: max(1rem, env(safe-area-inset-bottom));
		}

		.login-card {
			padding: 1.75rem 1.25rem;
		}

		.logo-text {
			font-size: 1.2rem;
		}

		.main-title {
			font-size: 1rem;
		}

		.status-text {
			font-size: 0.65rem;
		}

		.form-label {
			font-size: 0.75rem;
		}

		.tech-input {
			padding: 0.875rem 1rem;
			font-size: 16px; /* Prevents iOS zoom on focus */
		}

		.submit-btn {
			padding: 1rem;
			font-size: 0.8rem;
			min-height: 50px;
		}

		.toggle-btn {
			padding: 0.75rem;
			min-height: 44px;
		}

		.info-badge {
			font-size: 0.7rem;
			padding: 0.75rem;
		}

		.error-notification {
			top: max(1rem, env(safe-area-inset-top));
			right: 1rem;
			left: 1rem;
			max-width: none;
		}
	}

	/* Medium devices (480px - 639px) - Large phones, small tablets */
	@media (min-width: 480px) and (max-width: 639px) {
		.login-viewport {
			padding: 1.25rem;
			padding-top: max(1.25rem, env(safe-area-inset-top));
			padding-bottom: max(1.25rem, env(safe-area-inset-bottom));
		}

		.login-card {
			padding: 2rem 1.5rem;
		}

		.main-title {
			font-size: 1.1rem;
		}

		.tech-input {
			font-size: 16px; /* Prevents iOS zoom on focus */
		}

		.submit-btn {
			min-height: 52px;
		}

		.toggle-btn {
			min-height: 44px;
		}

		.error-notification {
			top: max(1rem, env(safe-area-inset-top));
			right: 1rem;
			left: 1rem;
			max-width: none;
		}
	}

	/* Tablets (640px - 767px) */
	@media (min-width: 640px) and (max-width: 767px) {
		.login-viewport {
			padding: 1.5rem;
		}

		.login-card {
			padding: 2rem;
		}

		.tech-input {
			font-size: 16px;
		}

		.error-notification {
			top: 1.5rem;
			right: 1.5rem;
			left: auto;
			max-width: 380px;
		}
	}

	/* Larger tablets (768px - 1023px) */
	@media (min-width: 768px) and (max-width: 1023px) {
		.login-container {
			max-width: 440px;
		}

		.login-card {
			padding: 2.25rem;
		}
	}

	/* Landscape mode adjustments for phones */
	@media (max-height: 500px) and (orientation: landscape) {
		.login-viewport {
			padding: 0.75rem 2rem;
			align-items: flex-start;
			overflow-y: auto;
		}

		.login-card {
			padding: 1.25rem 1.5rem;
			margin: 0.5rem 0;
		}

		.card-header {
			margin-bottom: 1rem;
		}

		.title-section {
			margin-bottom: 1rem;
		}

		.auth-form {
			gap: 1rem;
		}

		.toggle-section {
			margin-top: 1rem;
			padding-top: 1rem;
		}

		.test-info {
			margin-top: 1rem;
			padding-top: 1rem;
		}

		.error-notification {
			top: 0.5rem;
			right: 0.5rem;
		}
	}

	/* Touch interaction improvements */
	@media (hover: none) and (pointer: coarse) {
		.submit-btn {
			-webkit-tap-highlight-color: transparent;
		}

		.submit-btn:active:not(:disabled) {
			transform: scale(0.98);
			transition: transform 0.1s;
		}

		.toggle-btn {
			-webkit-tap-highlight-color: transparent;
		}

		.toggle-btn:active:not(:disabled) {
			opacity: 0.7;
		}

		.tech-input {
			-webkit-tap-highlight-color: transparent;
		}

		/* Larger touch targets for touch devices */
		.tech-input {
			min-height: 48px;
		}

		.submit-btn {
			min-height: 52px;
		}

		.toggle-btn {
			min-height: 48px;
			padding: 0.75rem 1rem;
		}
	}

	/* Reduced motion for accessibility */
	@media (prefers-reduced-motion: reduce) {
		.status-dot {
			animation: none;
		}

		.spinner {
			animation: spin 1.5s linear infinite;
		}

		.submit-btn,
		.toggle-btn,
		.tech-input {
			transition: none;
		}
	}

	/* High contrast mode support */
	@media (prefers-contrast: high) {
		.login-card {
			border-width: 2px;
		}

		.tech-input {
			border-width: 2px;
		}

		.tech-input:focus {
			outline: 3px solid var(--tech-accent);
			outline-offset: 2px;
		}

		.submit-btn:focus-visible {
			outline: 3px solid var(--tech-accent);
			outline-offset: 2px;
		}
	}
</style>
