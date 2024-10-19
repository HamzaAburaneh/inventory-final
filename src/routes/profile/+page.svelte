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

<div class="container mx-auto mt-8 p-4">
	<h1 class="text-2xl font-bold mb-4">Profile</h1>
	{#if user}
		<form on:submit|preventDefault={handleSubmit} class="max-w-md">
			<div class="mb-4">
				<label for="name" class="block mb-2">Name</label>
				<input type="text" id="name" bind:value={name} class="w-full p-2 border rounded" />
			</div>
			<div class="mb-4">
				<label for="email" class="block mb-2">Email</label>
				<input
					type="email"
					id="email"
					bind:value={email}
					class="w-full p-2 border rounded"
					disabled
				/>
			</div>
			<div class="mb-4">
				<label for="phone" class="block mb-2">Phone</label>
				<input type="tel" id="phone" bind:value={phone} class="w-full p-2 border rounded" />
			</div>
			{#if errorMessage}
				<p class="text-red-500 mb-4">{errorMessage}</p>
			{/if}
			{#if successMessage}
				<p class="text-green-500 mb-4">{successMessage}</p>
			{/if}
			<button
				type="submit"
				class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
				disabled={isUpdating}
			>
				{isUpdating ? 'Updating...' : 'Update Profile'}
			</button>
		</form>
	{:else}
		<p>Please log in to view your profile.</p>
	{/if}
</div>

<style>
	/* Add any additional styles here */
</style>
