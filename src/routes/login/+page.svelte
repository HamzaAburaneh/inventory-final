<script>
	import { authStore } from '../../stores/authStore';
	import { goto } from '$app/navigation';
	import { fadeAndSlide } from '$lib/transitions';
	import { fade } from 'svelte/transition';
	import { createUserWithEmailAndPassword } from 'firebase/auth';
	import { auth } from '../../firebase';
	import ThreeScene from '../../components/ThreeScene.svelte';

	let email = $state('');
	let password = $state('');
	let error = $state('');
	let isRegistering = $state(false);
	let loading = $state(false);
	let showPassword = $state(false);

	// Redirect to home page if already logged in
	$effect(() => {
		if ($authStore) {
			goto('/');
		}
	});

	async function handleAuth() {
		error = '';
		loading = true;
		try {
			if (isRegistering) {
				await createUserWithEmailAndPassword(auth, email, password);
				goto('/');
			} else {
				await authStore.login(email, password);
				goto('/');
			}
		} catch {
			error = isRegistering
				? 'Registration failed. Please try again.'
				: 'Invalid email or password';
		} finally {
			loading = false;
		}
	}

	function toggleMode() {
		isRegistering = !isRegistering;
		error = '';
	}
</script>

<svelte:head>
	<title>{isRegistering ? 'Register' : 'Log in'} — StockSense</title>
</svelte:head>

<ThreeScene />

<div class="login-wrap">
	<div class="login-card" in:fadeAndSlide={{ duration: 300, y: 50 }}>
		<div class="brand" aria-hidden="true">
			<div class="brand-icon"><i class="fas fa-box-open"></i></div>
		</div>

		<h1>{isRegistering ? 'Create an account' : 'Welcome back'}</h1>
		<p class="sub">
			{isRegistering
				? 'Start managing your inventory intelligently'
				: 'Log in to your StockSense dashboard'}
		</p>

		{#if error}
			<div class="error-banner" role="alert" in:fade={{ duration: 200 }}>
				<i class="fas fa-circle-exclamation" aria-hidden="true"></i>
				{error}
			</div>
		{/if}

		<form
			onsubmit={(e) => {
				e.preventDefault();
				handleAuth();
			}}
		>
			<div class="field">
				<label for="email">Email</label>
				<div class="input-wrap">
					<i class="fas fa-envelope" aria-hidden="true"></i>
					<input
						type="email"
						id="email"
						placeholder="name@company.com"
						required
						autocomplete="email"
						bind:value={email}
					/>
				</div>
			</div>

			<div class="field">
				<label for="password">Password</label>
				<div class="input-wrap">
					<i class="fas fa-lock" aria-hidden="true"></i>
					<input
						type={showPassword ? 'text' : 'password'}
						id="password"
						placeholder="••••••••"
						required
						autocomplete={isRegistering ? 'new-password' : 'current-password'}
						bind:value={password}
					/>
					<button
						type="button"
						class="eye"
						onclick={() => (showPassword = !showPassword)}
						aria-label={showPassword ? 'Hide password' : 'Show password'}
					>
						<i class="fas {showPassword ? 'fa-eye-slash' : 'fa-eye'}" aria-hidden="true"></i>
					</button>
				</div>
			</div>

			<button type="submit" class="submit" disabled={loading}>
				{#if loading}
					<i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i>
					{isRegistering ? 'Creating account…' : 'Signing in…'}
				{:else}
					<i class="fas fa-sign-in-alt" aria-hidden="true"></i>
					{isRegistering ? 'Register' : 'Log in'}
				{/if}
			</button>
		</form>

		<button class="switch-mode" onclick={toggleMode}>
			{isRegistering ? 'Already have an account? Log in' : 'Need an account? Register'}
		</button>

		<p class="hint">Test account: test@example.com / password123</p>
	</div>
</div>

<style>
	.login-wrap {
		position: relative;
		z-index: 1;
		width: 100%;
		min-height: calc(100vh - 160px);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		cursor: default;
	}

	.login-card {
		width: 100%;
		max-width: 440px;
		background: var(--tech-glass-bg);
		border: 1px solid var(--tech-glass-border);
		border-radius: 24px;
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
		box-shadow: 0 24px 64px -32px rgba(0, 0, 0, 0.35);
		padding: 2.5rem 1.75rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
	}

	.brand-icon {
		width: 56px;
		height: 56px;
		border-radius: 16px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(var(--tech-accent-rgb), 0.12);
		border: 1px solid rgba(var(--tech-accent-rgb), 0.3);
		color: var(--tech-accent);
		font-size: 1.5rem;
		margin-bottom: 1.25rem;
	}

	h1 {
		font-size: 1.75rem;
		font-weight: 700;
		color: var(--tech-title);
		margin: 0 0 0.4rem;
	}

	.sub {
		color: var(--tech-label);
		margin: 0 0 1.75rem;
		font-size: 0.98rem;
	}

	.error-banner {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		background: rgba(229, 62, 62, 0.12);
		border: 1px solid rgba(229, 62, 62, 0.4);
		color: #e53e3e;
		border-radius: 12px;
		padding: 0.7rem 1rem;
		font-size: 0.92rem;
		margin-bottom: 1.25rem;
	}

	form {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 1.15rem;
	}

	.field {
		text-align: left;
	}

	label {
		display: block;
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--tech-title);
		margin-bottom: 0.45rem;
	}

	.input-wrap {
		position: relative;
		display: flex;
		align-items: center;
	}

	.input-wrap > i {
		position: absolute;
		left: 1rem;
		color: var(--tech-label);
		font-size: 0.9rem;
		pointer-events: none;
		transition: color 0.2s ease;
	}

	.input-wrap:focus-within > i {
		color: var(--tech-accent);
	}

	.input-wrap input {
		width: 100%;
		min-height: 48px;
		padding: 0.75rem 3rem 0.75rem 2.6rem;
		background: var(--input-bg);
		color: var(--input-text);
		border: 1px solid var(--tech-glass-border);
		border-radius: 12px;
		font-size: 1rem;
		transition:
			border-color 0.2s ease,
			box-shadow 0.2s ease;
	}

	.input-wrap input:hover {
		border-color: rgba(var(--tech-accent-rgb), 0.4);
	}

	.input-wrap input:focus {
		outline: none;
		border-color: var(--tech-accent);
		box-shadow: 0 0 0 3px rgba(var(--tech-accent-rgb), 0.18);
	}

	.eye {
		position: absolute;
		right: 0.4rem;
		width: 40px;
		height: 40px;
		min-height: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		color: var(--tech-label);
		padding: 0;
		border-radius: 10px;
		transition: color 0.2s ease;
	}

	.eye:hover {
		color: var(--tech-accent);
	}

	.submit {
		width: 100%;
		min-height: 50px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.6rem;
		background: var(--tech-accent);
		color: var(--tech-bg-end);
		font-weight: 700;
		font-size: 1.05rem;
		border: none;
		border-radius: 9999px;
		margin-top: 0.35rem;
		box-shadow: 0 8px 24px -8px rgba(var(--tech-accent-rgb), 0.55);
		transition:
			transform 0.25s ease,
			filter 0.25s ease,
			box-shadow 0.25s ease;
	}

	.submit:hover:not(:disabled) {
		transform: translateY(-2px);
		filter: brightness(1.08);
		box-shadow: 0 14px 32px -10px rgba(var(--tech-accent-rgb), 0.65);
	}

	.submit:disabled {
		opacity: 0.75;
	}

	.switch-mode {
		margin-top: 1.4rem;
		background: transparent;
		border: none;
		color: var(--tech-accent);
		font-size: 0.95rem;
		font-weight: 600;
		padding: 0.5rem;
		min-height: 44px;
	}

	.switch-mode:hover {
		text-decoration: underline;
	}

	.hint {
		margin: 1rem 0 0;
		font-size: 0.82rem;
		color: var(--tech-label);
	}

	@media (min-width: 640px) {
		.login-card {
			padding: 3rem 2.75rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.submit,
		.input-wrap input,
		.eye {
			transition: none;
		}

		.submit:hover:not(:disabled) {
			transform: none;
		}
	}
</style>
