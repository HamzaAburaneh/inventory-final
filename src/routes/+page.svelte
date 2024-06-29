<!-- src/routes/+page.svelte -->
<script>
	import { fadeAndSlide } from '$lib/transitions';
</script>

<main class="p-4" in:fadeAndSlide={{ duration: 300, y: 75 }}>
	<h1 class="text-4xl font-bold mb-4">Welcome to the Inventory App</h1>
	<!-- Rest of your app content -->
</main>

<style>
	/* Add any additional styles here */
</style>
