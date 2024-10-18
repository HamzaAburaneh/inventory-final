<script lang="ts">
	import { page } from '$app/stores';
	import ThemeToggle from './ThemeToggle.svelte';
	import { authStore } from '../stores/authStore';
	import type { User } from 'firebase/auth';
	import { goto } from '$app/navigation';

	export let user: User | null;

	let isOpen = false;

	function toggleMenu() {
		isOpen = !isOpen;
	}

	async function handleLogout() {
		await authStore.logout();
		goto('/login');
	}
</script>

<nav class="navbar">
	<div class="container mx-auto flex justify-between items-center">
		<a href="/" class="brand">
			<i class="fas fa-box mr-2"></i>
			StockSense
		</a>
		<button class="menu-toggle" on:click={toggleMenu}>
			<span class="sr-only">Toggle menu</span>
			<div class="hamburger">
				<span></span>
				<span></span>
				<span></span>
			</div>
		</button>
		<ul class="nav-list desktop">
			{#if user}
				<li>
					<a
						href="/manageItems"
						class="nav-link"
						class:active={$page.url.pathname === '/manageItems'}>Item Manager</a
					>
				</li>
				<li>
					<a
						href="/manageTransactions"
						class="nav-link"
						class:active={$page.url.pathname === '/manageTransactions'}>Manage Transactions</a
					>
				</li>
				<li>
					<a
						href="/transactionHistory"
						class="nav-link"
						class:active={$page.url.pathname === '/transactionHistory'}>Transaction History</a
					>
				</li>
				<li>
					<button on:click={handleLogout} class="nav-link">Logout</button>
				</li>
			{:else}
				<li>
					<a href="/login" class="nav-link" class:active={$page.url.pathname === '/login'}>Login</a>
				</li>
			{/if}
			<li><ThemeToggle /></li>
		</ul>
		<ul class="nav-list mobile {isOpen ? 'open' : ''}">
			{#if user}
				<li>
					<a
						href="/manageItems"
						class="nav-link"
						class:active={$page.url.pathname === '/manageItems'}>Item Manager</a
					>
				</li>
				<li>
					<a
						href="/manageTransactions"
						class="nav-link"
						class:active={$page.url.pathname === '/manageTransactions'}>Manage Transactions</a
					>
				</li>
				<li>
					<a
						href="/transactionHistory"
						class="nav-link"
						class:active={$page.url.pathname === '/transactionHistory'}>Transaction History</a
					>
				</li>
				<li>
					<button on:click={handleLogout} class="nav-link">Logout</button>
				</li>
			{:else}
				<li>
					<a href="/login" class="nav-link" class:active={$page.url.pathname === '/login'}>Login</a>
				</li>
			{/if}
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
		color: var(--nav-logo-color);
		font-size: 1.5rem;
		font-weight: 600;
		text-decoration: none;
		transition: all 0.3s ease;
		display: flex;
		align-items: center;
	}

	.brand:hover {
		color: var(--nav-logo-hover-color); /* Adjust hover color as needed */
		transform: scale(1.1); /* Slightly increases the size */
		text-shadow: 2px 2px 5px rgba(0, 0, 0, 0.2); /* Adds a subtle shadow effect */
	}

	.brand i {
		font-size: 1.5rem;
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
		color: var(--nav-text-color);
		text-decoration: none;
		font-size: 1rem;
		padding: 0.5rem 0;
		position: relative;
		transition: color 0.3s ease;
		background: none;
		border: none;
		cursor: pointer;
	}

	.nav-link::after {
		content: '';
		position: absolute;
		width: 100%;
		height: 2px;
		bottom: -16px;
		left: 0;
		background-color: var(--nav-text-color);
		transform: scaleX(0);
		transform-origin: bottom right;
		transition: transform 0.3s ease;
	}

	.nav-link:hover,
	.nav-link.active {
		color: var(--nav-text-color);
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
		background-color: var(--nav-text-color);
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
