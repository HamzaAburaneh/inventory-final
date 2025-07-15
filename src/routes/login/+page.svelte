<script>
	import { authStore } from '../../stores/authStore';
	import { goto } from '$app/navigation';
	import { fadeAndSlide } from '$lib/transitions';
	import { fade } from 'svelte/transition';
	import { createUserWithEmailAndPassword } from 'firebase/auth';
	import { auth } from '../../firebase';

	let email = $state('');
	let password = $state('');
	let error = $state('');
	let isRegistering = $state(false);

	$effect(() => {
		const unsubscribe = authStore.subscribe((user) => {
			if (user) {
				goto('/'); // Redirect to home page if already logged in
			}
		});

		return unsubscribe;
	});

	async function handleAuth() {
		try {
			if (isRegistering) {
				await createUserWithEmailAndPassword(auth, email, password);
				goto('/'); // Redirect to home page after successful registration
			} else {
				await authStore.login(email, password);
				goto('/'); // Redirect to home page after successful login
			}
		} catch (err) {
			error = isRegistering
				? 'Registration failed. Please try again.'
				: 'Invalid email or password';
		}
	}

	function toggleMode() {
		isRegistering = !isRegistering;
		error = '';
	}
</script>

<div class="flex items-center justify-center min-h-screen bg-background-color">
	<div
		class="container mx-auto p-8 rounded-lg shadow-md bg-container mt-4 max-w-md"
		in:fadeAndSlide={{ duration: 300, y: 75 }}
		style="margin-top: -10vh;"
	>
		<h3 class="text-2xl font-bold text-center mb-6 text-text-color">
			{isRegistering ? 'Create an account' : 'Login to your account'}
		</h3>
		<form onsubmit={(e) => { e.preventDefault(); handleAuth(); }} class="space-y-6">
			<div>
				<label for="email" class="block mb-2 text-sm font-medium text-text-color">Email</label>
				<input
					type="email"
					id="email"
					placeholder="name@company.com"
					required
					bind:value={email}
					class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-input-bg text-input-text"
				/>
			</div>
			<div>
				<label for="password" class="block mb-2 text-sm font-medium text-text-color">Password</label>
				<input
					type="password"
					id="password"
					placeholder="••••••••"
					required
					bind:value={password}
					class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-input-bg text-input-text"
				/>
			</div>
			<button type="submit" class="w-full px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm transition-colors duration-200">
				<i class="fas fa-sign-in-alt mr-2"></i>
				{isRegistering ? 'Register' : 'Log in'}
			</button>
		</form>
		<div class="mt-4 text-center">
			<button onclick={toggleMode} class="text-blue-500 hover:underline">
				{isRegistering ? 'Already have an account? Log in' : 'Need an account? Register'}
			</button>
		</div>
		<div class="mt-4 text-center text-sm text-gray-500">
			<p>Test account: test@example.com / password123</p>
		</div>
	</div>
</div>

{#if error}
	<div class="notification" in:fade out:fade>
		{error}
	</div>
{/if}

<style>
	:global(body) {
		background-color: var(--background-color);
		color: var(--text-color);
	}

	.container {
		background-color: var(--container-bg);
		box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
	}

	:global(.bg-input-bg) {
		background-color: var(--input-bg);
	}

	:global(.text-input-text) {
		color: var(--input-text);
	}

	:global(.text-text-color) {
		color: var(--text-color);
	}

	.notification {
		position: fixed;
		top: 20px;
		left: 50%;
		transform: translateX(-50%);
		background-color: #e53e3e;
		color: white;
		padding: 1rem 2rem;
		border-radius: 0.5rem;
		z-index: 1000;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
	}
</style>
