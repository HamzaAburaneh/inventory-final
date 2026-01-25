<script>
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import { fly, fade } from 'svelte/transition';
	import ThemeToggle from './ThemeToggle.svelte';
	import { authStore } from '../stores/authStore.js';
	import { goto } from '$app/navigation';

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
		}, 150);
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

			if (wasMobile && !isMobile && isOpen) {
				closeMenu();
			}

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

	// Prevent body scroll when mobile menu is open
	$effect(() => {
		if (!browser) return;
		
		if (isOpen) {
			document.body.style.overflow = 'hidden';
		} else {
			document.body.style.overflow = '';
		}

		return () => {
			document.body.style.overflow = '';
		};
	});
</script>

<nav class="navbar">
	<div class="nav-container">
		<a href="/" class="brand">
			<div class="brand-icon">
				<i class="fas fa-box"></i>
			</div>
			<span class="brand-text">StockSense</span>
		</a>

		<button
			class="menu-toggle"
			onclick={toggleMenu}
			bind:this={menuToggleRef}
			type="button"
			aria-expanded={isOpen}
			aria-controls="mobile-menu"
			aria-label="Toggle navigation menu"
		>
			{#if isOpen}
				<svg class="menu-icon-svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
					<line x1="18" y1="6" x2="6" y2="18"></line>
					<line x1="6" y1="6" x2="18" y2="18"></line>
				</svg>
			{:else}
				<svg class="menu-icon-svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
					<line x1="3" y1="6" x2="21" y2="6"></line>
					<line x1="3" y1="12" x2="21" y2="12"></line>
					<line x1="3" y1="18" x2="21" y2="18"></line>
				</svg>
			{/if}
		</button>

		<div class="nav-content desktop">
			<ul class="nav-list">
				{#if user}
					<li>
						<a href="/manageItems" class="nav-link" class:active={currentPath === '/manageItems'}>
							<span class="link-text">Item Manager</span>
						</a>
					</li>
					<li>
						<a href="/manageTransactions" class="nav-link" class:active={currentPath === '/manageTransactions'}>
							<span class="link-text">Transactions</span>
						</a>
					</li>
					<li>
						<a href="/transactionHistory" class="nav-link" class:active={currentPath === '/transactionHistory'}>
							<span class="link-text">History</span>
						</a>
					</li>
					<li>
						<a href="/transactionAnalysis" class="nav-link" class:active={currentPath === '/transactionAnalysis'}>
							<span class="link-text">Analysis</span>
						</a>
					</li>
					<li>
						<a href="/inventoryPredictions" class="nav-link" class:active={currentPath === '/inventoryPredictions'}>
							<span class="link-text">Predictions</span>
						</a>
					</li>
				{/if}
			</ul>

			<div class="nav-actions">
				{#if user}
					<div
						class="user-menu-wrapper"
						use:handleClickOutside
						bind:this={userMenuNode}
						onmouseenter={handleMouseEnter}
						onmouseleave={handleMouseLeave}
					>
						<button onclick={toggleDropdown} class="profile-trigger">
							<div class="avatar-circle">
								<i class="fas fa-user"></i>
							</div>
							<span class="user-name">{user.displayName || user.email.split('@')[0]}</span>
							<i class="fas fa-chevron-down caret-icon" class:rotated={isDropdownOpen}></i>
						</button>
						
						{#if isDropdownOpen}
							<div class="dropdown-portal">
								<ul class="dropdown-menu" bind:this={dropdownNode}>
									<li>
										<a href="/profile" class="dropdown-item" onclick={handleProfileClick}>
											<i class="fas fa-id-card"></i>
											<span>Profile</span>
										</a>
									</li>
									<li class="divider"></li>
									<li>
										<button onclick={handleLogout} class="dropdown-item logout">
											<i class="fas fa-sign-out-alt"></i>
											<span>Logout</span>
										</button>
									</li>
								</ul>
							</div>
						{/if}
					</div>
				{:else}
					<a href="/login" class="login-btn">
						<i class="fas fa-sign-in-alt"></i>
						<span>Login</span>
					</a>
				{/if}
				<div class="theme-wrapper">
					<ThemeToggle />
				</div>
			</div>
		</div>

	</div>
</nav>

<!-- Mobile dropdown menu - slides down from under navbar -->
{#if isOpen}
	<div 
		class="mobile-menu-overlay" 
		onclick={closeMenu}
		transition:fade={{ duration: 200 }}
	></div>
	<div 
		class="mobile-dropdown"
		class:full-height={user}
		id="mobile-menu" 
		bind:this={mobileMenuRef}
		transition:fly={{ y: -300, duration: 300, easing: t => 1 - Math.pow(1 - t, 3) }}
	>
		<div class="mobile-nav-links">
			{#if user}
				<a href="/manageItems" class="mobile-link" class:active={currentPath === '/manageItems'} onclick={closeMenu}>
					Item Manager
				</a>
				<a href="/manageTransactions" class="mobile-link" class:active={currentPath === '/manageTransactions'} onclick={closeMenu}>
					Transactions
				</a>
				<a href="/transactionHistory" class="mobile-link" class:active={currentPath === '/transactionHistory'} onclick={closeMenu}>
					History
				</a>
				<a href="/transactionAnalysis" class="mobile-link" class:active={currentPath === '/transactionAnalysis'} onclick={closeMenu}>
					Analysis
				</a>
				<a href="/inventoryPredictions" class="mobile-link" class:active={currentPath === '/inventoryPredictions'} onclick={closeMenu}>
					Predictions
				</a>
				<a href="/profile" class="mobile-link" onclick={handleProfileClick}>
					Profile
				</a>
			{:else}
				<a href="/login" class="mobile-link" onclick={closeMenu}>
					Login
				</a>
			{/if}
		</div>
		
		<div class="mobile-footer">
			<div class="footer-row">
				<span class="footer-label">Theme</span>
				<ThemeToggle />
			</div>
			{#if user}
				<button class="mobile-logout" onclick={handleLogout}>
					Sign Out
				</button>
			{/if}
		</div>
	</div>
{/if}

<style>
	.navbar {
		background: rgba(255, 255, 255, 0.7);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border-bottom: 1px solid var(--tech-glass-border);
		position: sticky;
		top: 0;
		z-index: 1000;
		height: 70px;
		display: flex;
		align-items: center;
		view-transition-name: navbar;
	}

	:global([data-theme="dark"]) .navbar {
		background: rgba(0, 0, 0, 0.7);
	}

	.nav-container {
		max-width: 1400px;
		margin: 0 auto;
		width: 100%;
		padding: 0 1.5rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		text-decoration: none;
		transition: transform 0.2s ease;
	}

	.brand:hover {
		transform: translateY(-1px);
	}

	.brand-icon {
		width: 36px;
		height: 36px;
		background: var(--tech-accent);
		border: 1px solid var(--tech-accent);
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--tech-brand-icon-color);
		font-size: 1.1rem;
		box-shadow: 0 0 15px var(--tech-accent-muted);
		transition: all 0.3s ease;
	}

	.brand:hover .brand-icon {
		box-shadow: 0 0 15px var(--tech-accent);
		transform: rotate(10deg) scale(1.1);
	}

	.brand-text {
		font-size: 1.25rem;
		font-weight: 800;
		color: var(--tech-title);
		text-transform: uppercase;
		letter-spacing: -0.02em;
	}

	.nav-content.desktop {
		display: none;
		align-items: center;
		gap: 2.5rem;
		flex: 1;
		justify-content: flex-end;
	}

	.nav-list {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.nav-link {
		text-decoration: none;
		padding: 0.5rem 0.75rem;
		color: var(--tech-label);
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		transition: all 0.2s ease;
		border-radius: 4px;
		position: relative;
	}

	.nav-link:hover {
		color: var(--tech-accent);
		background: var(--tech-accent-muted);
	}

	.nav-link.active {
		color: var(--tech-accent);
	}

	.nav-link.active::after {
		content: '';
		position: absolute;
		bottom: -2px;
		left: 0.75rem;
		right: 0.75rem;
		height: 2px;
		background: var(--tech-accent);
		box-shadow: 0 0 8px var(--tech-accent-muted);
		border-radius: 2px;
		animation: link-glow 3s ease-in-out infinite;
	}

	@keyframes link-glow {
		0%, 100% { opacity: 0.4; box-shadow: 0 0 1px var(--tech-accent-muted); }
		50% { opacity: 0.8; box-shadow: 0 0 6px var(--tech-accent); }
	}

	.nav-actions {
		display: flex;
		align-items: center;
		gap: 1.5rem;
		padding-left: 1.5rem;
		border-left: 1px solid var(--tech-glass-border);
		position: relative;
	}

	.profile-trigger {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		background: transparent;
		border: none;
		cursor: pointer;
		padding: 0.4rem;
		border-radius: 50px;
		transition: all 0.2s ease;
		outline: none;
	}

	.profile-trigger:hover {
		background: var(--tech-badge-bg);
	}

	.profile-trigger:focus {
		outline: none;
		box-shadow: 0 0 0 2px var(--tech-accent-muted);
	}

	.avatar-circle {
		width: 32px;
		height: 32px;
		background: var(--tech-badge-bg);
		border: 1px solid var(--tech-glass-border);
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--tech-label);
		font-size: 0.8rem;
		transition: all 0.2s ease;
	}

	.profile-trigger:hover .avatar-circle {
		border-color: var(--tech-accent);
		color: var(--tech-accent);
	}

	.user-name {
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--tech-label);
		max-width: 100px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		transition: color 0.2s ease;
	}

	.profile-trigger:hover .user-name {
		color: var(--tech-value);
	}

	.caret-icon {
		font-size: 0.7rem;
		color: var(--tech-label);
		transition: transform 0.2s ease;
	}

	.caret-icon.rotated {
		transform: rotate(180deg);
	}

	.dropdown-portal {
		position: absolute;
		top: 100%;
		right: 0;
		padding-top: 0.5rem;
	}

	.dropdown-menu {
		background: var(--tech-glass-bg);
		border: 1px solid var(--tech-glass-border);
		border-radius: 12px;
		box-shadow: var(--tech-glass-shadow);
		min-width: 180px;
		list-style: none;
		padding: 0.5rem;
		margin: 0;
		animation: dropdown-slide 0.2s ease-out;
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
	}

	@keyframes dropdown-slide {
		from { opacity: 0; transform: translateY(-10px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.dropdown-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		text-decoration: none;
		color: var(--tech-value);
		font-size: 0.85rem;
		font-weight: 600;
		border-radius: 8px;
		transition: all 0.2s ease;
		width: 100%;
		background: transparent;
		border: none;
		cursor: pointer;
		text-align: left;
	}

	.dropdown-item:hover {
		background: var(--tech-badge-bg);
		color: var(--tech-accent);
	}

	.dropdown-item.logout:hover {
		color: #ef4444;
		background: rgba(239, 68, 68, 0.05);
	}

	.divider {
		height: 1px;
		background: var(--tech-glass-border);
		margin: 0.5rem;
	}

	.login-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		text-decoration: none;
		color: var(--tech-accent);
		font-weight: 700;
		font-size: 0.85rem;
		padding: 0.5rem 1rem;
		border: 1px solid var(--tech-accent);
		border-radius: 6px;
		transition: all 0.2s;
	}

	.login-btn:hover {
		background: var(--tech-accent);
		color: #fff;
		box-shadow: 0 0 15px var(--tech-accent-muted);
	}

	/* Mobile Styles - Clean minimal design */
	.menu-toggle {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		background: transparent;
		border: none;
		cursor: pointer;
		z-index: 10000;
		transition: all 0.2s ease;
		-webkit-tap-highlight-color: transparent;
		padding: 0;
	}

	.menu-toggle:hover {
		opacity: 0.7;
	}

	.menu-toggle:active {
		transform: scale(0.95);
	}

	.menu-icon-svg {
		color: var(--tech-title);
		stroke-linecap: round;
	}

	/* Mobile dropdown menu - slides down from navbar */
	.mobile-menu-overlay {
		position: fixed;
		top: 70px;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.3);
		z-index: 998;
	}

	.mobile-dropdown {
		position: fixed;
		top: 70px;
		left: 0;
		right: 0;
		background: var(--tech-glass-bg, #ffffff);
		border-bottom: 1px solid var(--tech-glass-border);
		box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
		z-index: 999;
		overflow-y: auto;
	}

	.mobile-dropdown.full-height {
		bottom: 0;
		display: flex;
		flex-direction: column;
		border-bottom: none;
		box-shadow: none;
	}

	/* Navigation links */
	.mobile-nav-links {
		padding: 1rem 0;
	}

	.mobile-link {
		display: block;
		padding: 1rem 1.5rem;
		text-decoration: none;
		color: var(--tech-title);
		font-size: 1rem;
		font-weight: 500;
		transition: all 0.15s ease;
		-webkit-tap-highlight-color: transparent;
	}

	.mobile-link:hover {
		background: var(--tech-badge-bg);
	}

	.mobile-link:active {
		background: var(--tech-accent-muted);
	}

	.mobile-link.active {
		color: var(--tech-accent);
		font-weight: 600;
	}

	/* Mobile footer */
	.mobile-footer {
		margin-top: auto;
		padding: 1.5rem;
		border-top: 1px solid var(--tech-glass-border);
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		background: var(--tech-glass-bg);
	}

	.footer-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.footer-label {
		font-size: 0.85rem;
		font-weight: 500;
		color: var(--tech-label);
	}

	.mobile-logout {
		width: 100%;
		padding: 0.875rem 1rem;
		background: transparent;
		color: var(--tech-label);
		border: 1px solid var(--tech-glass-border);
		border-radius: 50px;
		font-size: 0.9rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s ease;
		-webkit-tap-highlight-color: transparent;
	}

	.mobile-logout:hover {
		border-color: #ef4444;
		color: #ef4444;
	}

	.mobile-logout:active {
		transform: scale(0.98);
	}

	.mobile-login-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		padding: 0.875rem 1rem;
		background: var(--tech-accent);
		color: white;
		border: none;
		border-radius: 50px;
		font-size: 0.9rem;
		font-weight: 600;
		text-decoration: none;
		transition: all 0.15s ease;
		-webkit-tap-highlight-color: transparent;
	}

	.mobile-login-btn:hover {
		opacity: 0.9;
	}

	.mobile-login-btn:active {
		transform: scale(0.98);
	}

	@media (min-width: 768px) {
		.menu-toggle { display: none; }
		.nav-content.desktop { display: flex; }
		.mobile-dropdown { display: none; }
		.mobile-menu-overlay { display: none; }
	}
</style>
