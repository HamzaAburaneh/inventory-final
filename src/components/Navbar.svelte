<script>
	import ThemeToggle from './ThemeToggle.svelte';

	let isOpen = false;

	function toggleMenu() {
		isOpen = !isOpen;
	}
</script>

<nav class="p-4" style="background-color: var(--nav-color);">
	<div class="container mx-auto flex justify-between items-center">
		<a href="/" class="text-white text-xl">Brand</a>
		<button class="text-white md:hidden" on:click={toggleMenu}> ☰ </button>
		<ul class="hidden md:flex space-x-4">
			<li><a href="/" class="text-white">Home</a></li>
			<li><a href="/manageItems" class="text-white">Item Manager</a></li>
			<li><a href="/contact" class="text-white">Contact</a></li>
			<li><ThemeToggle /></li>
		</ul>
		<ul class={`md:hidden ${isOpen ? 'block' : 'hidden'} space-y-4 mt-4`}>
			<li><a href="/" class="text-white">Home</a></li>
			<li><a href="/about" class="text-white">About</a></li>
			<li><a href="/contact" class="text-white">Contact</a></li>
			<li><ThemeToggle /></li>
		</ul>
	</div>
</nav>
