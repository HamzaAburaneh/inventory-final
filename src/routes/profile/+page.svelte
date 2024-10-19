<script lang="ts">
	import { onMount } from 'svelte';
	import { authStore } from '../../stores/authStore';
	import type { User } from 'firebase/auth';
	import { getFirestore, doc, getDoc } from 'firebase/firestore';

	const db = getFirestore();

	let user: User | null = null;
	let name = '';
	let email = '';
	let phone = '';
	let errorMessage = '';
	let successMessage = '';
	let isUpdating = false;

	async function fetchPhoneNumber(userId: string) {
		const userProfileDoc = await getDoc(doc(db, 'userProfiles', userId));
		if (userProfileDoc.exists()) {
			return userProfileDoc.data().phoneNumber || '';
		}
		return '';
	}

	onMount(() => {
		const unsubscribe = authStore.subscribe(async (value) => {
			user = value;
			if (user) {
				name = user.displayName || '';
				email = user.email || '';
				phone = await fetchPhoneNumber(user.uid);
			}
		});

		return unsubscribe;
	});

	async function handleSubmit(): Promise<void> {
		errorMessage = '';
		successMessage = '';
		isUpdating = true;

		try {
			await authStore.updateProfile(name, phone);
			successMessage = 'Profile updated successfully!';
		} catch (error) {
			console.error('Error updating profile:', error);
			errorMessage = 'Failed to update profile. Please try again.';
		} finally {
			isUpdating = false;
		}
	}
</script>

<div class="profile-container">
	<h1 class="profile-title">Profile</h1>
	{#if user}
		<div class="profile-card">
			<form on:submit|preventDefault={handleSubmit} class="profile-form">
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

				<button type="submit" class="save-button" disabled={isUpdating}>
					{isUpdating ? 'Updating...' : 'Save'}
				</button>
			</form>
		</div>
	{:else}
		<p class="login-message">Please log in to view your profile.</p>
	{/if}
</div>

<style>
	.profile-container {
		max-width: 600px;
		margin: 2rem auto;
		padding: 1rem;
	}

	.profile-title {
		font-size: 1.8rem;
		font-weight: bold;
		margin-bottom: 1rem;
		color: var(--text-color);
	}

	.profile-card {
		background-color: var(--nav-color);
		border: 2px solid var(--nav-border-color);
		border-radius: 8px;
		padding: 2rem;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	}

	.profile-form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	label {
		font-weight: 600;
		color: var(--text-color);
	}

	input {
		padding: 0.5rem;
		border: 1px solid var(--nav-border-color);
		border-radius: 4px;
		background-color: var(--background-color);
		color: var(--text-color);
	}

	input:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	.error-message {
		color: #ff4136;
	}

	.success-message {
		color: #2ecc40;
	}

	.save-button {
		background-color: var(--nav-text-color);
		color: var(--nav-color);
		border: none;
		border-radius: 4px;
		padding: 0.5rem 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: background-color 0.3s ease;
	}

	.save-button:hover:not(:disabled) {
		background-color: var(--nav-text-hover-color);
	}

	.save-button:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	.login-message {
		color: var(--text-color);
		text-align: center;
	}
</style>
