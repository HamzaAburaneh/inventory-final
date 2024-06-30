<script>
	import { page } from '$app/stores';
	import ThemeToggle from './ThemeToggle.svelte';

	let isOpen = false;

	function toggleMenu() {
		isOpen = !isOpen;
	}
</script>

<nav class="navbar">
	<div class="container mx-auto flex justify-between items-center">
		<a href="/" class="brand">Brand</a>
		<button class="menu-toggle" on:click={toggleMenu}>
			<span class="sr-only">Toggle menu</span>
			<div class="hamburger">
				<span></span>
				<span></span>
				<span></span>
			</div>
		</button>
		<ul class="nav-list desktop">
			<li><a href="/" class="nav-link" class:active={$page.url.pathname === '/'}>Home</a></li>
			<li>
				<a href="/manageItems" class="nav-link" class:active={$page.url.pathname === '/manageItems'}
					>Item Manager</a
				>
			</li>

			<li><ThemeToggle /></li>
		</ul>
		<ul class="nav-list mobile {isOpen ? 'open' : ''}">
			<li><a href="/" class="nav-link" class:active={$page.url.pathname === '/'}>Home</a></li>
			<li>
				<a href="/manageItems" class="nav-link" class:active={$page.url.pathname === '/manageItems'}
					>Item Manager</a
				>
			</li>

			<li><ThemeToggle /></li>
		</ul>
	</div>
</nav>

<style>
	.navbar {
		background-color: var(--nav-color);
		border-bottom: 2px solid var(--nav-border-color);
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
		padding: 1rem 2rem;
	}

	.brand {
		color: white;
		font-size: 1.5rem;
		font-weight: bold;
		text-decoration: none;
	}

	.nav-list {
		display: flex;
		align-items: center;
		gap: 2rem;
	}

	.nav-list.desktop {
		display: none;
	}

	.nav-link {
		color: white;
		text-decoration: none;
		font-size: 1rem;
		padding: 0.5rem 0;
		position: relative;
		transition: color 0.3s ease;
	}

	.nav-link::after {
		content: '';
		position: absolute;
		width: 100%;
		height: 2px;
		bottom: -16px; /* Adjust this value to place the underline exactly at the bottom */
		left: 0;
		background-color: white;
		transform: scaleX(0);
		transform-origin: bottom right;
		transition: transform 0.3s ease;
	}

	.nav-link:hover,
	.nav-link.active {
		color: #f0f0f0;
	}

	.nav-link:hover::after,
	.nav-link.active::after {
		transform: scaleX(1);
		transform-origin: bottom left;
	}

	.menu-toggle {
		display: block;
		background: none;
		border: none;
		cursor: pointer;
	}

	.hamburger {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		width: 30px;
		height: 21px;
	}

	.hamburger span {
		display: block;
		height: 3px;
		width: 100%;
		background-color: white;
		transition: all 0.3s ease;
	}

	.nav-list.mobile {
		display: none;
		flex-direction: column;
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		background-color: var(--nav-color);
		padding: 1rem;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	}

	.nav-list.mobile.open {
		display: flex;
	}

	@media (min-width: 768px) {
		.menu-toggle {
			display: none;
		}

		.nav-list.desktop {
			display: flex;
		}

		.nav-list.mobile {
			display: none !important;
		}
	}
</style>
