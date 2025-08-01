<script>
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import ThemeToggle from './ThemeToggle.svelte';
	import { authStore } from '../stores/authStore.js';
	import { goto } from '$app/navigation';
	import { fade, slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';

	let { user } = $props();

	let isOpen = $state(false);
	let isDropdownOpen = $state(false);
	let dropdownNode = $state();
	let userMenuNode = $state();
	let menuToggleRef = $state();
	let mobileMenuRef = $state();
	let isMobile = $state(browser ? window.innerWidth < 768 : false);

	const currentPath = $derived($page.url.pathname);

	function toggleMenu() {
		isOpen = !isOpen;
	}

	function closeMenu() {
		isOpen = false;
	}

	function toggleDropdown() {
		isDropdownOpen = !isDropdownOpen;
	}

	function openDropdown() {
		isDropdownOpen = true;
	}

	function closeDropdown() {
		isDropdownOpen = false;
	}

	async function handleLogout() {
		await authStore.logout();
		closeDropdown();
		closeMenu();
		goto('/login');
	}

	async function handleProfileClick(event) {
		event.preventDefault();
		closeDropdown();
		console.log('Profile button clicked, navigating to /profile');
		await goto('/profile');
	}

	function handleClickOutside(node) {
		const handleClick = (event) => {
			if (node && !node.contains(event.target) && !event.defaultPrevented) {
				closeDropdown();
			}
		};

		document.addEventListener('click', handleClick, true);

		return {
			destroy() {
				document.removeEventListener('click', handleClick, true);
			}
		};
	}

	let timeoutId;

	function handleMouseEnter() {
		clearTimeout(timeoutId);
		openDropdown();
	}

	function handleMouseLeave() {
		timeoutId = setTimeout(() => {
			closeDropdown();
		}, 150); // Reduced delay to prevent sticking
	}

	$effect(() => {
		return () => {
			closeDropdown();
			clearTimeout(timeoutId);
		};
	});
	
	// Handle viewport changes
	$effect(() => {
		if (!browser) return;

		function handleResize() {
			const wasMobile = isMobile;
			isMobile = window.innerWidth < 768;
			
			// Close mobile menu when switching from mobile to desktop
			if (wasMobile && !isMobile && isOpen) {
				closeMenu();
			}
			
			// Close dropdown when switching viewports
			if (wasMobile !== isMobile) {
				closeDropdown();
			}
		}

		window.addEventListener('resize', handleResize);
		
		return () => {
			window.removeEventListener('resize', handleResize);
		};
	});
	
	$effect(() => {
		if (!isOpen) return;

		const handleClickOutside = (event) => {
			if (
				mobileMenuRef &&
				!mobileMenuRef.contains(event.target) &&
				menuToggleRef &&
				!menuToggleRef.contains(event.target)
			) {
				closeMenu();
			}
		};

		document.addEventListener('click', handleClickOutside, true);

		return () => {
			document.removeEventListener('click', handleClickOutside, true);
		};
	});
</script>

<nav class="navbar">
	<div class="container mx-auto flex justify-between items-center relative">
		<a href="/" class="brand">
			<i class="fas fa-box mr-2"></i>
			<span class="brand-text">StockSense</span>
		</a>
		<button
			class="menu-toggle"
			onclick={toggleMenu}
			bind:this={menuToggleRef}
			type="button"
			aria-expanded={isOpen}
			aria-controls="mobile-menu"
		>
			<span class="sr-only">Toggle menu</span>
			<div class="hamburger" class:open={isOpen}>
				<span></span>
				<span></span>
				<span></span>
			</div>
		</button>
		<ul class="nav-list desktop">
			{#if user}
				<li>
					<a href="/manageItems" class="nav-link" class:active={currentPath === '/manageItems'}
						>Item Manager</a
					>
				</li>
				<li>
					<a
						href="/manageTransactions"
						class="nav-link"
						class:active={currentPath === '/manageTransactions'}>Manage Transactions</a
					>
				</li>
				<li>
					<a
						href="/transactionHistory"
						class="nav-link"
						class:active={currentPath === '/transactionHistory'}>Transaction History</a
					>
				</li>
				<li>
					<a
						href="/transactionAnalysis"
						class="nav-link"
						class:active={currentPath === '/transactionAnalysis'}>Transaction Analysis</a
					>
				</li>
				<li>
					<a
						href="/inventoryPredictions"
						class="nav-link"
						class:active={currentPath === '/inventoryPredictions'}>Inventory Predictions</a
					>
				</li>
				<li
					class="relative user-menu-container"
					use:handleClickOutside
					bind:this={userMenuNode}
					onmouseenter={handleMouseEnter}
					onmouseleave={handleMouseLeave}
				>
					<button onclick={toggleDropdown} class="nav-link user-menu profile-button">
						<i class="fas fa-user mr-2"></i>
						<span class="user-name">{user.displayName || user.email}</span>
						<i class="fas fa-caret-down ml-2"></i>
					</button>
					{#if isDropdownOpen}
						<ul
							class="dropdown-menu"
							transition:slide={{ duration: 200, easing: cubicOut }}
							bind:this={dropdownNode}
							onmouseenter={handleMouseEnter}
							onmouseleave={handleMouseLeave}
						>
							<li>
								<a href="/profile" class="dropdown-item" onclick={handleProfileClick}>Profile</a>
							</li>
							<li><button onclick={handleLogout} class="dropdown-item">Logout</button></li>
						</ul>
					{/if}
				</li>
			{:else}
				<li>
					<a href="/login" class="nav-link" class:active={currentPath === '/login'}>Login</a>
				</li>
			{/if}
			<li><ThemeToggle /></li>
		</ul>
		{#if isOpen}
			<ul
				class="nav-list mobile"
				id="mobile-menu"
				transition:slide|local={{ duration: 300, easing: cubicOut }}
				bind:this={mobileMenuRef}
			>
				{#if user}
					<li>
						<a
							href="/manageItems"
							class="nav-link"
							class:active={currentPath === '/manageItems'}
							onclick={closeMenu}>Item Manager</a
						>
					</li>
					<li>
						<a
							href="/manageTransactions"
							class="nav-link"
							class:active={currentPath === '/manageTransactions'}
							onclick={closeMenu}>Manage Transactions</a
						>
					</li>
					<li>
						<a
							href="/transactionHistory"
							class="nav-link"
							class:active={currentPath === '/transactionHistory'}
							onclick={closeMenu}>Transaction History</a
						>
					</li>
					<li>
						<a
							href="/transactionAnalysis"
							class="nav-link"
							class:active={currentPath === '/transactionAnalysis'}
							onclick={closeMenu}>Transaction Analysis</a
						>
					</li>
					<li>
						<a
							href="/inventoryPredictions"
							class="nav-link"
							class:active={currentPath === '/inventoryPredictions'}
							onclick={closeMenu}>Inventory Predictions</a
						>
					</li>
					<li>
						<a href="/profile" class="nav-link" onclick={() => { closeMenu(); handleProfileClick(event); }}>Profile</a>
					</li>
					<li>
						<button onclick={handleLogout} class="nav-link">Logout</button>
					</li>
				{:else}
					<li>
						<a href="/login" class="nav-link" class:active={currentPath === '/login'} onclick={closeMenu}>Login</a>
					</li>
				{/if}
				<li><ThemeToggle /></li>
			</ul>
		{/if}
	</div>
</nav>

<style>
	.navbar {
		background-color: var(--nav-color);
		border-bottom: 2px solid var(--nav-border-color);
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
		padding: 1rem 2rem;
		position: sticky;
		top: 0;
		z-index: 1000;
		overflow: visible; /* Changed from overflow-x: hidden to allow mobile menu to show */
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
		color: var(--nav-logo-hover-color);
	}

	.brand i {
		font-size: 1.5rem;
		transition: transform 0.3s ease;
	}

	.brand:hover i {
		transform: rotate(15deg);
	}

	.brand-text {
		position: relative;
		overflow: hidden;
	}

	.brand-text::after {
		content: '';
		position: absolute;
		bottom: 0;
		left: 0;
		width: 100%;
		height: 2px;
		background-color: var(--nav-logo-hover-color);
		transform: translateX(-100%);
		transition: transform 0.3s ease;
	}

	.brand:hover .brand-text::after {
		transform: translateX(0);
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
		padding: 0.5rem 1rem;
		min-height: 44px;
		position: relative;
		transition: color 0.3s ease;
		background: none;
		border: none;
		cursor: pointer;
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		touch-action: manipulation;
	}

	.nav-link::after {
		content: '';
		position: absolute;
		width: 100%;
		height: 2px;
		bottom: -4px;
		left: 0;
		background-color: var(--nav-text-color);
		transform: scaleX(0);
		transform-origin: bottom right;
		transition: transform 0.3s ease;
	}

	.nav-link:hover,
	.nav-link.active {
		color: var(--nav-text-hover-color);
		background-color: transparent !important; /* Ensure no background color */
	}

	.nav-link:hover::after,
	.nav-link.active::after {
		transform: scaleX(1);
		transform-origin: bottom left;
	}

	.profile-button {
		background-color: transparent;
		border: 2px solid var(--nav-text-color);
		border-radius: 20px;
		padding: 0.5rem 1rem;
		transition: all 0.3s ease;
		white-space: nowrap;
	}

	.profile-button:hover {
		background-color: var(--nav-text-color);
		color: var(--nav-color);
	}

	.profile-button::after {
		display: none;
	}

	.menu-toggle {
		display: block;
		background: none;
		border: none;
		cursor: pointer;
		min-height: 44px;
		min-width: 44px;
		padding: 0.5rem;
		border-radius: 4px;
		transition: background-color 0.3s ease;
		position: relative;
		z-index: 1001;
	}

	.menu-toggle:hover,
	.menu-toggle:focus {
		background-color: var(--nav-hover-bg);
		outline: 2px solid var(--input-focus-border);
		outline-offset: 2px;
	}

	.hamburger {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		width: 24px;
		height: 18px;
		position: relative;
	}

	.hamburger span {
		display: block;
		height: 3px;
		width: 100%;
		background-color: var(--nav-text-color);
		transition: all 0.3s ease;
		border-radius: 2px;
		transform-origin: center;
	}

	.hamburger.open span:nth-child(1) {
		transform: rotate(45deg) translate(6px, 6px);
	}

	.hamburger.open span:nth-child(2) {
		opacity: 0;
	}

	.hamburger.open span:nth-child(3) {
		transform: rotate(-45deg) translate(6px, -6px);
	}

	.nav-list.mobile {
		display: flex;
		flex-direction: column;
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		background-color: var(--nav-color);
		padding: 1rem;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
		gap: 0.5rem;
		overflow-x: hidden;
		overflow-y: auto;
		max-height: calc(100vh - 80px);
		z-index: 999;
		border-top: 1px solid var(--nav-border-color);
	}

	.user-menu {
		display: flex;
		align-items: center;
	}

	.user-menu-container {
		position: relative;
	}

	.user-name {
		display: inline-block;
		max-width: 150px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.profile-button .user-name {
		opacity: 1;
		transition: opacity 0.2s ease;
	}

	.dropdown-menu {
		position: absolute;
		top: calc(100% + 0.5rem);
		right: 0;
		background-color: var(--nav-color);
		border: 1px solid var(--nav-border-color);
		border-radius: 8px;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
		min-width: 180px;
		z-index: 1000;
		overflow: hidden;
	}

	.dropdown-item {
		display: block;
		padding: 0.75rem 1rem;
		color: var(--nav-text-color);
		text-decoration: none;
		transition: all 0.3s ease;
		font-weight: 500;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}

	.dropdown-item:last-child {
		border-bottom: none;
	}

	.dropdown-item:hover {
		background-color: var(--nav-hover-bg);
		color: var(--nav-drop-down-text-hover-color);
		padding-left: 1.5rem;
	}

	/* Responsive breakpoints */
	@media (max-width: 767px) {
		.navbar {
			padding: 0.75rem 1rem;
		}
		
		.brand {
			font-size: 1.25rem;
		}
		
		/* Ensure mobile menu is properly positioned */
		.nav-list.mobile {
			width: 100%;
			max-width: 100vw;
		}
	}

	@media (min-width: 768px) {
		.menu-toggle {
			display: none !important;
		}

		.nav-list.desktop {
			display: flex !important;
		}

		.nav-list.mobile {
			display: none !important;
		}
		
		.navbar {
			padding: 1rem 2rem;
		}
	}
	
	@media (orientation: landscape) and (max-height: 500px) {
		.navbar {
			padding-top: 0.5rem;
			padding-bottom: 0.5rem;
		}
		
		.nav-list.mobile {
			max-height: calc(100vh - 60px);
			padding: 0.75rem;
		}
	}
</style>
