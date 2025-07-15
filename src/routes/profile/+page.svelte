<script>
	import { authStore } from '../../stores/authStore.js';
	import { fadeAndSlide } from '$lib/transitions';
	import { db } from '../../firebase.js';
	import { doc, getDoc, setDoc } from 'firebase/firestore';
	import { onMount } from 'svelte';

	let user = $state(null);
	let name = $state('');
	let email = $state('');
	let phone = $state('');
	let errorMessage = $state('');
	let successMessage = $state('');
	let isUpdating = $state(false);

	async function fetchPhoneNumber(userId) {
		try {
			const userProfileDoc = await getDoc(doc(db, 'userProfiles', userId));
			if (userProfileDoc.exists()) {
				return userProfileDoc.data().phoneNumber || '';
			}
		} catch (error) {
			console.error('Error fetching phone number:', error);
		}
		return '';
	}

	async function loadUserData(authUser) {
		if (authUser) {
			name = authUser.displayName || '';
			email = authUser.email || '';
			phone = await fetchPhoneNumber(authUser.uid);
		} else {
			// Reset form when no user
			name = '';
			email = '';
			phone = '';
		}
	}

	onMount(() => {
		const unsubscribe = authStore.subscribe(async (authUser) => {
			user = authUser;
			await loadUserData(authUser);
		});

		return unsubscribe;
	});

	async function handleSubmit() {
		errorMessage = '';
		successMessage = '';
		isUpdating = true;

		try {
			await authStore.updateProfile(name, phone);
			successMessage = 'Profile updated successfully!';
		} catch (error) {
			errorMessage = 'Failed to update profile. Please try again.';
		} finally {
			isUpdating = false;
		}
	}
</script>

<div class="container" in:fadeAndSlide={{ duration: 300, y: 75 }}>
	<h1 class="title">Profile</h1>
	{#if user}
		<div class="profile-card">
			<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="profile-form">
				<div class="form-group">
					<label for="name">Username</label>
					<input type="text" id="name" bind:value={name} required />
				</div>

				<div class="form-group">
					<label for="email">Email</label>
					<input type="email" id="email" bind:value={email} disabled />
				</div>

				<div class="form-group">
					<label for="phone">Phone</label>
					<input type="tel" id="phone" bind:value={phone} />
				</div>

				{#if errorMessage}
					<p class="error-message">{errorMessage}</p>
				{/if}
				{#if successMessage}
					<p class="success-message">{successMessage}</p>
				{/if}

				<button type="submit" class="submit-button" disabled={isUpdating}>
					{isUpdating ? 'Updating...' : 'Save Changes'}
				</button>
			</form>
		</div>
	{:else}
		<p class="login-message">Please log in to view your profile.</p>
	{/if}
</div>

<style>
	.container {
		max-width: 600px;
		margin: 0 auto;
		padding: 2rem;
		background-color: var(--container-bg);
		border-radius: var(--border-radius);
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	}

	.title {
		font-size: 2rem;
		color: var(--text-color);
		margin-bottom: 1.5rem;
	}

	.profile-card {
		background-color: var(--container-bg);
		padding: 1.5rem;
		border-radius: var(--border-radius);
		border: 1px solid var(--border-color);
	}

	.profile-form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.form-group {
		display: flex;
		flex-direction: column;
	}

	label {
		color: var(--text-color);
		margin-bottom: 0.5rem;
	}

	input {
		padding: 0.5rem;
		border: 1px solid var(--input-border);
		border-radius: var(--border-radius);
		background-color: var(--input-bg);
		color: var(--input-text);
	}

	input:hover {
		background-color: var(--input-hover-bg);
	}

	input:focus {
		border-color: var(--input-focus-border);
		outline: none;
	}

	input:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	.error-message {
		color: #ff4136;
	}

	.success-message {
		color: var(--add-item-color);
	}

	.submit-button {
		background-color: var(--add-item-color);
		color: var(--text-color);
		border: none;
		border-radius: var(--border-radius);
		padding: 0.75rem 1rem;
		font-weight: bold;
		cursor: pointer;
		transition: background-color 0.3s ease;
	}

	.submit-button:hover:not(:disabled) {
		opacity: 0.9;
	}

	.submit-button:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	.login-message {
		color: var(--text-color);
		text-align: center;
	}
</style>
