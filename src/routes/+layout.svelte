<script lang="ts">
	import { onMount } from 'svelte';
	import Navbar from '../components/Navbar.svelte';
	import '../styles/global.css';
	import { authStore } from '../stores/authStore';
	import type { User } from 'firebase/auth';

	let user: User | null = null;

	onMount(() => {
		authStore.init();
		const unsubscribe = authStore.subscribe((value) => {
			user = value;
		});

		return unsubscribe;
	});
</script>

<Navbar {user} />

<main class="main-container">
	<slot />
</main>

<style>
	main {
		padding: 1rem;
		display: flex;
		justify-content: center;
		/* align-items: center; */
		/* min-height: 80vh; */
	}
</style>
