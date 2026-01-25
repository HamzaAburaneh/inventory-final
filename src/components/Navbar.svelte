<script>
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
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
		>
			<div class="hamburger" class:open={isOpen}>
				<span></span>
				<span></span>
				<span></span>
			</div>
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

		{#if isOpen}
			<div class="mobile-overlay" onclick={closeMenu}></div>
			<div class="nav-list mobile" id="mobile-menu" bind:this={mobileMenuRef}>
				<div class="mobile-header">
					<span class="mobile-title">Navigation</span>
					<button class="close-btn" onclick={closeMenu}>
						<i class="fas fa-times"></i>
					</button>
				</div>
				{#if user}
					<div class="mobile-user-info">
						<div class="avatar-circle large">
							<i class="fas fa-user"></i>
						</div>
						<div class="user-details">
							<span class="user-name-large">{user.displayName || user.email}</span>
							<span class="user-status">System Authorized</span>
						</div>
					</div>
					<div class="mobile-links">
						<a href="/manageItems" class="mobile-link" class:active={currentPath === '/manageItems'} onclick={closeMenu}>
							<i class="fas fa-boxes"></i>
							<span>Item Manager</span>
						</a>
						<a href="/manageTransactions" class="mobile-link" class:active={currentPath === '/manageTransactions'} onclick={closeMenu}>
							<i class="fas fa-exchange-alt"></i>
							<span>Manage Transactions</span>
						</a>
						<a href="/transactionHistory" class="mobile-link" class:active={currentPath === '/transactionHistory'} onclick={closeMenu}>
							<i class="fas fa-history"></i>
							<span>Transaction History</span>
						</a>
						<a href="/transactionAnalysis" class="mobile-link" class:active={currentPath === '/transactionAnalysis'} onclick={closeMenu}>
							<i class="fas fa-chart-line"></i>
							<span>Transaction Analysis</span>
						</a>
						<a href="/inventoryPredictions" class="mobile-link" class:active={currentPath === '/inventoryPredictions'} onclick={closeMenu}>
							<i class="fas fa-magic"></i>
							<span>Inventory Predictions</span>
						</a>
						<div class="divider"></div>
						<a href="/profile" class="mobile-link" onclick={handleProfileClick}>
							<i class="fas fa-user-cog"></i>
							<span>Profile Settings</span>
						</a>
						<button onclick={handleLogout} class="mobile-link logout">
							<i class="fas fa-power-off"></i>
							<span>Logout System</span>
						</button>
					</div>
				{:else}
					<div class="mobile-links">
						<a href="/login" class="mobile-link" class:active={currentPath === '/login'} onclick={closeMenu}>
							<i class="fas fa-sign-in-alt"></i>
							<span>Login</span>
						</a>
					</div>
				{/if}
				<div class="mobile-footer">
					<ThemeToggle />
				</div>
			</div>
		{/if}
	</div>
</nav>

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

	/* Mobile Styles */
	.menu-toggle {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		background: var(--tech-badge-bg);
		border: 1px solid var(--tech-badge-border);
		border-radius: 8px;
		cursor: pointer;
		z-index: 1001;
	}

	.hamburger {
		width: 20px;
		height: 14px;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
	}

	.hamburger span {
		display: block;
		height: 2px;
		width: 100%;
		background: var(--tech-label);
		border-radius: 2px;
		transition: all 0.3s ease;
	}

	.hamburger.open span:nth-child(1) { transform: translateY(6px) rotate(45deg); }
	.hamburger.open span:nth-child(2) { opacity: 0; }
	.hamburger.open span:nth-child(3) { transform: translateY(-6px) rotate(-45deg); }

	.mobile-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.4);
		backdrop-filter: blur(4px);
		z-index: 998;
	}

	.nav-list.mobile {
		position: fixed;
		top: 0;
		right: 0;
		bottom: 0;
		width: 300px;
		background: var(--tech-glass-bg);
		border-left: 1px solid var(--tech-glass-border);
		display: flex;
		flex-direction: column;
		z-index: 999;
		padding: 1.5rem;
		box-shadow: -10px 0 30px rgba(0, 0, 0, 0.1);
		animation: slide-left 0.3s cubic-bezier(0.16, 1, 0.3, 1);
	}

	@keyframes slide-left {
		from { transform: translateX(100%); }
		to { transform: translateX(0); }
	}

	.mobile-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 2rem;
	}

	.mobile-title {
		font-size: 0.7rem;
		font-weight: 800;
		color: var(--tech-label);
		text-transform: uppercase;
		letter-spacing: 0.2em;
	}

	.close-btn {
		background: transparent;
		border: none;
		color: var(--tech-label);
		font-size: 1.2rem;
		cursor: pointer;
	}

	.mobile-user-info {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1rem;
		background: var(--tech-badge-bg);
		border-radius: 12px;
		margin-bottom: 2rem;
	}

	.avatar-circle.large {
		width: 48px;
		height: 48px;
		font-size: 1.2rem;
	}

	.user-details {
		display: flex;
		flex-direction: column;
	}

	.user-name-large {
		font-weight: 800;
		color: var(--tech-value);
		font-size: 0.9rem;
	}

	.user-status {
		font-size: 0.6rem;
		color: var(--tech-accent);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.mobile-links {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		flex: 1;
	}

	.mobile-link {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1rem;
		text-decoration: none;
		color: var(--tech-value);
		font-weight: 700;
		font-size: 0.9rem;
		border-radius: 8px;
		transition: all 0.2s;
	}

	.mobile-link i {
		width: 20px;
		color: var(--tech-label);
		font-size: 1rem;
	}

	.mobile-link:hover, .mobile-link.active {
		background: var(--tech-accent-muted);
		color: var(--tech-accent);
	}

	.mobile-link:hover i, .mobile-link.active i {
		color: var(--tech-accent);
	}

	.mobile-link.logout {
		margin-top: auto;
		color: #ef4444;
	}

	.mobile-link.logout i {
		color: #ef4444;
	}

	.mobile-footer {
		margin-top: 2rem;
		padding-top: 1.5rem;
		border-top: 1px solid var(--tech-glass-border);
		display: flex;
		justify-content: center;
	}

	@media (min-width: 768px) {
		.menu-toggle { display: none; }
		.nav-content.desktop { display: flex; }
	}
</style>
