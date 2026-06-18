<script>
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import ThemeToggle from './ThemeToggle.svelte';
	import { authStore } from '../stores/authStore.js';
	import { goto } from '$app/navigation';
	import { slide } from 'svelte/transition';
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

	const userInitials = $derived(
		user
			? user.displayName
				? user.displayName
						.split(' ')
						.map((w) => w[0] ?? '')
						.slice(0, 2)
						.join('')
						.toUpperCase()
				: (user.email?.[0] ?? '?').toUpperCase()
			: ''
	);

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

	$effect(() => {
		if (!browser) return;
		function handleResize() {
			const wasMobile = isMobile;
			isMobile = window.innerWidth < 768;
			if (wasMobile && !isMobile && isOpen) closeMenu();
			if (wasMobile !== isMobile) closeDropdown();
		}
		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
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
		return () => document.removeEventListener('click', handleClickOutside, true);
	});
</script>

<nav class="navbar" aria-label="Main navigation">
	<div class="nav-inner">
		<!-- ── Logo (original, untouched) ── -->
		<a href="/" class="brand">
			<i class="fas fa-layer-group mr-2" aria-hidden="true"></i>
			<span class="brand-text">Stock<span class="brand-accent">Sense</span></span>
		</a>

		<!-- ── Desktop nav links ── -->
		<ul class="nav-links" role="list" aria-label="Site navigation">
			{#if user}
				<li>
					<a
						href="/manageItems"
						class="nav-link"
						class:active={currentPath === '/manageItems'}
						aria-current={currentPath === '/manageItems' ? 'page' : undefined}
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="13"
							height="13"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
							><path
								d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
							></path></svg
						>
						Items
					</a>
				</li>
				<li>
					<a
						href="/manageTransactions"
						class="nav-link"
						class:active={currentPath === '/manageTransactions'}
						aria-current={currentPath === '/manageTransactions' ? 'page' : undefined}
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="13"
							height="13"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
							><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"
							></path><polyline points="7 23 3 19 7 15"></polyline><path
								d="M21 13v2a4 4 0 0 1-4 4H3"
							></path></svg
						>
						Ledger
					</a>
				</li>
				<li>
					<a
						href="/transactionHistory"
						class="nav-link"
						class:active={currentPath === '/transactionHistory'}
						aria-current={currentPath === '/transactionHistory' ? 'page' : undefined}
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="13"
							height="13"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
							><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"
							></polyline></svg
						>
						History
					</a>
				</li>
				<li>
					<a
						href="/transactionAnalysis"
						class="nav-link"
						class:active={currentPath === '/transactionAnalysis'}
						aria-current={currentPath === '/transactionAnalysis' ? 'page' : undefined}
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="13"
							height="13"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
							><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"
							></line><line x1="6" y1="20" x2="6" y2="14"></line></svg
						>
						Analytics
					</a>
				</li>
				<li>
					<a
						href="/inventoryPredictions"
						class="nav-link"
						class:active={currentPath === '/inventoryPredictions'}
						aria-current={currentPath === '/inventoryPredictions' ? 'page' : undefined}
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="13"
							height="13"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
							><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline
								points="17 6 23 6 23 12"
							></polyline></svg
						>
						Forecast
					</a>
				</li>
			{:else}
				<li>
					<a
						href="/login"
						class="nav-link"
						class:active={currentPath === '/login'}
						aria-current={currentPath === '/login' ? 'page' : undefined}
					>
						Login
					</a>
				</li>
			{/if}
		</ul>

		<!-- Flex spacer -->
		<div class="flex-1" aria-hidden="true"></div>

		<!-- ── Theme toggle — standalone utility, far from the avatar ── -->
		<div class="desktop-theme-toggle">
			<ThemeToggle />
		</div>

		<!-- ── Divider: separates the utility cluster from the account ── -->
		{#if user}
			<span class="nav-divider" aria-hidden="true"></span>
		{/if}

		<!-- ── Desktop right controls — account avatar only ── -->
		<div class="nav-controls">
			{#if user}
				<div
					class="profile-wrap"
					role="presentation"
					use:handleClickOutside
					bind:this={userMenuNode}
					onmouseenter={handleMouseEnter}
					onmouseleave={handleMouseLeave}
				>
					<button
						class="profile-btn"
						onclick={toggleDropdown}
						aria-expanded={isDropdownOpen}
						aria-haspopup="menu"
						aria-label="User menu"
					>
						<span class="avatar" aria-hidden="true">{userInitials}</span>
					</button>

					{#if isDropdownOpen}
						<div
							class="dropdown"
							role="presentation"
							transition:slide={{ duration: 160, easing: cubicOut }}
							bind:this={dropdownNode}
							onmouseenter={handleMouseEnter}
							onmouseleave={handleMouseLeave}
						>
							<div class="drop-header">
								<span class="drop-avatar" aria-hidden="true">{userInitials}</span>
								<div class="drop-id">
									<p class="drop-name">{user.displayName || 'Account'}</p>
									<p class="drop-email">{user.email ?? ''}</p>
								</div>
							</div>

							<div class="drop-divider"></div>

							<ul class="drop-list" role="menu" aria-label="User menu">
								<li role="none">
									<a href="/profile" class="drop-item" role="menuitem" onclick={handleProfileClick}>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											width="13"
											height="13"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
											aria-hidden="true"
											><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle
												cx="12"
												cy="7"
												r="4"
											></circle></svg
										>
										Profile
									</a>
								</li>
								<li role="none">
									<button class="drop-item drop-signout" role="menuitem" onclick={handleLogout}>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											width="13"
											height="13"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
											aria-hidden="true"
											><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline
												points="16 17 21 12 16 7"
											></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg
										>
										Sign out
									</button>
								</li>
							</ul>
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<!-- ── Mobile hamburger ── -->
		<button
			class="burger"
			type="button"
			onclick={toggleMenu}
			bind:this={menuToggleRef}
			aria-expanded={isOpen}
			aria-controls="mobile-nav"
			aria-label={isOpen ? 'Close menu' : 'Open menu'}
		>
			<span class="burger-bars" class:open={isOpen} aria-hidden="true">
				<span></span>
				<span></span>
				<span></span>
			</span>
		</button>
	</div>

	<!-- ── Mobile panel ── -->
	{#if isOpen}
		<div
			class="mobile-panel"
			id="mobile-nav"
			transition:slide|local={{ duration: 260, easing: cubicOut }}
			bind:this={mobileMenuRef}
		>
			{#if user}
				<div class="mob-user-row">
					<span class="mob-avatar" aria-hidden="true">{userInitials}</span>
					<div>
						<p class="mob-name">{user.displayName || ''}</p>
						<p class="mob-email">{user.email ?? ''}</p>
					</div>
				</div>
				<div class="mob-divider"></div>
				<a
					href="/manageItems"
					class="mob-link"
					class:active={currentPath === '/manageItems'}
					aria-current={currentPath === '/manageItems' ? 'page' : undefined}
					onclick={closeMenu}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="15"
						height="15"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
						><path
							d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
						></path></svg
					>
					Item Manager
				</a>
				<a
					href="/manageTransactions"
					class="mob-link"
					class:active={currentPath === '/manageTransactions'}
					aria-current={currentPath === '/manageTransactions' ? 'page' : undefined}
					onclick={closeMenu}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="15"
						height="15"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
						><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"
						></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"
						></path></svg
					>
					Manage Transactions
				</a>
				<a
					href="/transactionHistory"
					class="mob-link"
					class:active={currentPath === '/transactionHistory'}
					aria-current={currentPath === '/transactionHistory' ? 'page' : undefined}
					onclick={closeMenu}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="15"
						height="15"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
						><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"
						></polyline></svg
					>
					Transaction History
				</a>
				<a
					href="/transactionAnalysis"
					class="mob-link"
					class:active={currentPath === '/transactionAnalysis'}
					aria-current={currentPath === '/transactionAnalysis' ? 'page' : undefined}
					onclick={closeMenu}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="15"
						height="15"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
						><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"
						></line><line x1="6" y1="20" x2="6" y2="14"></line></svg
					>
					Transaction Analysis
				</a>
				<a
					href="/inventoryPredictions"
					class="mob-link"
					class:active={currentPath === '/inventoryPredictions'}
					aria-current={currentPath === '/inventoryPredictions' ? 'page' : undefined}
					onclick={closeMenu}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="15"
						height="15"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
						><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline
							points="17 6 23 6 23 12"
						></polyline></svg
					>
					Inventory Forecast
				</a>
				<div class="mob-divider"></div>
				<a
					href="/profile"
					class="mob-link"
					onclick={(e) => {
						closeMenu();
						handleProfileClick(e);
					}}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="15"
						height="15"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
						><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"
						></circle></svg
					>
					Profile
				</a>
				<button class="mob-link mob-signout" onclick={handleLogout}>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="15"
						height="15"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
						><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline
							points="16 17 21 12 16 7"
						></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg
					>
					Sign out
				</button>
			{:else}
				<a
					href="/login"
					class="mob-link"
					class:active={currentPath === '/login'}
					onclick={closeMenu}>Login</a
				>
			{/if}

			<div class="mob-footer">
				<span class="mob-footer-label">Appearance</span>
				<ThemeToggle />
			</div>
		</div>
	{/if}
</nav>

<style>
	/* ── Surface tokens ────────────────────────── */
	.navbar {
		--nb-surface: var(--nav-color);
		--nb-border: var(--nav-border-color);
		--nb-text: var(--nav-text-color);
		--nb-muted: color-mix(in srgb, var(--nav-text-color) 45%, transparent);
		--nb-hover-bg: var(--nav-hover-bg);
		--nb-accent: var(--tech-accent);
		--nb-accent-rgb: var(--tech-accent-rgb);
		/* Avatar fg: white on blue (light), dark on yellow (dark) */
		--nb-avatar-fg: #fff;
	}

	:global([data-theme='dark']) .navbar {
		--nb-avatar-fg: #0a0a0a;
	}

	/* ── Shell ─────────────────────────────────── */
	.navbar {
		position: sticky;
		top: 0;
		z-index: 1000;
		background: var(--nb-surface);
		border-bottom: 1px solid var(--nb-border);
		overflow: visible;
		/* No shadow — intentional */
	}

	/* ── Inner container ───────────────────────── */
	.nav-inner {
		max-width: 1280px;
		margin: 0 auto;
		padding: 0 1.75rem;
		height: 56px;
		display: flex;
		align-items: center;
		gap: 0;
	}

	/* ── Original logo — markup + styles untouched ── */
	.brand {
		color: var(--tech-title);
		font-size: 1.3rem;
		font-weight: 300;
		letter-spacing: -0.01em;
		line-height: 1;
		text-decoration: none;
		transition: opacity 0.4s ease;
		display: flex;
		align-items: center;
		flex-shrink: 0;
		margin-right: 2rem;
	}

	.brand:hover {
		opacity: 0.75;
	}

	.brand:focus-visible {
		outline: 2px solid var(--nb-accent);
		outline-offset: 4px;
		border-radius: 4px;
	}

	.brand :global(i) {
		font-size: 1rem;
		line-height: 1;
		color: var(--nb-accent);
		transform: translateY(1px);
	}

	.brand-text {
		position: relative;
	}
	.brand-accent {
		color: var(--nb-accent);
		font-weight: 400;
	}

	/* ── Nav links ─────────────────────────────── */
	.nav-links {
		display: none;
		align-items: center;
		gap: 0;
		list-style: none;
		margin: 0;
		padding: 0;
		height: 100%;
	}

	.nav-link {
		/* Sit at full nav height so the indicator can reach the bottom edge */
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 56px;
		padding: 0 13px;
		font-size: 0.8125rem;
		font-weight: 500;
		letter-spacing: 0.01em;
		color: var(--nb-muted);
		text-decoration: none;
		white-space: nowrap;
		position: relative;
		transition: color 0.2s ease;
	}

	.nav-link svg {
		opacity: 0.6;
		transition: opacity 0.2s ease;
		flex-shrink: 0;
	}

	/* Hover */
	.nav-link:hover {
		color: var(--nb-text);
	}

	.nav-link:hover svg {
		opacity: 0.85;
	}

	/* Focus ring */
	.nav-link:focus-visible {
		outline: 2px solid var(--nb-accent);
		outline-offset: -4px;
		border-radius: 4px;
	}

	/*
	 * Active indicator — a glowing accent dot that sits flush on
	 * the bottom border of the navbar, centred under the link text.
	 * The dot + its bloom create a "lit" status-light feel.
	 */
	.nav-link.active {
		color: var(--nb-accent);
	}

	.nav-link.active svg {
		opacity: 1;
		color: var(--nb-accent);
	}

	.nav-link.active::after {
		content: '';
		position: absolute;
		bottom: -1px;
		left: 50%;
		transform: translateX(-50%);
		width: 4px;
		height: 4px;
		border-radius: 50%;
		background: var(--nb-accent);
		/* softer: single tight glow, no wide bloom */
		box-shadow: 0 0 5px 1px rgba(var(--nb-accent-rgb), 0.3);
	}

	/* ── Spacer ────────────────────────────────── */
	.flex-1 {
		flex: 1;
	}

	/* ── Theme toggle — standalone utility, set apart from the avatar ── */
	.desktop-theme-toggle {
		display: none;
		align-items: center;
	}

	/* Vertical hairline that visually splits the toggle from the account */
	.nav-divider {
		display: none;
		width: 1px;
		height: 22px;
		margin: 0 1.5rem;
		background: color-mix(in srgb, var(--nb-text) 18%, transparent);
		flex-shrink: 0;
	}

	/* ── Right controls ────────────────────────── */
	.nav-controls {
		display: none;
		align-items: center;
		gap: 6px;
	}

	/* ── Profile button — bare avatar, Monday.com style ─── */
	.profile-wrap {
		position: relative;
	}

	.profile-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		padding: 0;
		border-radius: 50%;
		border: none;
		background: transparent;
		cursor: pointer;
		outline: none;
		-webkit-tap-highlight-color: transparent;
		transition:
			opacity 0.15s ease,
			transform 0.15s ease;
	}

	.profile-btn:hover {
		opacity: 0.85;
		transform: scale(1.06);
	}

	/* No ring on click — keyboard focus only, and it's a soft accent halo */
	.profile-btn:focus {
		outline: none;
	}

	.profile-btn:focus-visible {
		outline: none;
		box-shadow:
			0 0 0 2px var(--nb-surface),
			0 0 0 4px rgba(var(--nb-accent-rgb), 0.55);
	}

	/* Avatar — solid pill, no outer ring */
	.avatar {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: var(--nb-accent);
		color: var(--nb-avatar-fg);
		font-size: 0.65rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		user-select: none;
	}

	/* ── Dropdown ──────────────────────────────── */
	.dropdown {
		position: absolute;
		top: calc(100% + 10px);
		right: 0;
		min-width: 220px;
		border-radius: 12px;
		padding: 6px;
		margin: 0;
		overflow: hidden;
		z-index: 100;
		background: var(--nb-surface);
		border: 1px solid var(--nb-border);
		box-shadow:
			0 4px 12px rgba(0, 0, 0, 0.12),
			0 12px 32px rgba(0, 0, 0, 0.16);
	}

	/* Account header — name + email, like Linear / Notion */
	.drop-header {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 10px 10px;
	}

	.drop-avatar {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 34px;
		height: 34px;
		border-radius: 50%;
		background: var(--nb-accent);
		color: var(--nb-avatar-fg);
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		flex-shrink: 0;
		user-select: none;
	}

	.drop-id {
		min-width: 0;
	}

	.drop-name {
		margin: 0;
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--nb-text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.drop-email {
		margin: 0;
		font-size: 0.75rem;
		color: var(--nb-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.drop-divider {
		height: 1px;
		margin: 0 4px 6px;
		background: var(--nb-border);
	}

	.drop-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.drop-item {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 8px 10px;
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--nb-text);
		text-decoration: none;
		background: none;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		text-align: left;
		transition:
			background-color 0.12s ease,
			color 0.12s ease;
	}

	.drop-item:hover {
		background: var(--nb-hover-bg);
		color: var(--nb-text);
	}

	.drop-item:focus-visible {
		outline: 2px solid var(--nb-accent);
		outline-offset: -2px;
	}

	.drop-signout:hover {
		background: rgba(239, 68, 68, 0.08);
		color: #ef4444;
	}

	/* ── Burger ────────────────────────────────── */
	.burger {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 34px;
		height: 34px;
		border-radius: 8px;
		border: 1px solid var(--nb-border);
		background: transparent;
		cursor: pointer;
		flex-shrink: 0;
		margin-left: auto;
		transition:
			background-color 0.18s ease,
			border-color 0.18s ease;
	}

	.burger:hover {
		background: var(--nb-hover-bg);
		border-color: color-mix(in srgb, var(--nb-accent) 35%, var(--nb-border));
	}

	.burger:focus-visible {
		outline: 2px solid var(--nb-accent);
		outline-offset: 2px;
	}

	.burger-bars {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		width: 15px;
		height: 11px;
		position: relative;
	}

	.burger-bars span {
		display: block;
		height: 1.5px;
		background: var(--nb-muted);
		border-radius: 2px;
		transition: all 0.22s ease;
		transform-origin: center;
	}

	/* Third bar is shorter — gives a "stack" feel */
	.burger-bars span:nth-child(3) {
		width: 10px;
		align-self: flex-end;
	}

	.burger-bars.open span:nth-child(1) {
		transform: rotate(45deg) translate(4px, 4px);
		width: 15px;
	}

	.burger-bars.open span:nth-child(2) {
		opacity: 0;
		transform: scaleX(0);
	}

	.burger-bars.open span:nth-child(3) {
		width: 15px;
		transform: rotate(-45deg) translate(4px, -4px);
	}

	/* ── Mobile panel ──────────────────────────── */
	.mobile-panel {
		background: var(--nb-surface);
		border-top: 1px solid var(--nb-border);
		padding: 8px 12px 4px;
		/* No extra shadow — the bottom border is enough */
	}

	.mob-user-row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 4px 12px;
	}

	.mob-avatar {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 34px;
		height: 34px;
		border-radius: 50%;
		background: var(--nb-accent);
		color: var(--nb-avatar-fg);
		font-size: 0.75rem;
		font-weight: 700;
		flex-shrink: 0;
	}

	.mob-name {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--nb-text);
		margin: 0;
	}

	.mob-email {
		font-size: 0.75rem;
		color: var(--nb-muted);
		margin: 0;
	}

	.mob-divider {
		height: 1px;
		background: var(--nb-border);
		margin: 4px 0 8px;
	}

	.mob-link {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		padding: 0 10px;
		height: 42px;
		border-radius: 7px;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--nb-muted);
		text-decoration: none;
		background: none;
		border: none;
		cursor: pointer;
		text-align: left;
		transition:
			background-color 0.15s ease,
			color 0.15s ease;
	}

	.mob-link:hover {
		background: var(--nb-hover-bg);
		color: var(--nb-text);
	}

	.mob-link.active {
		color: var(--nb-accent);
		background: rgba(var(--nb-accent-rgb), 0.08);
	}

	.mob-link:focus-visible {
		outline: 2px solid var(--nb-accent);
		outline-offset: 2px;
	}

	.mob-signout:hover {
		background: rgba(239, 68, 68, 0.08);
		color: #ef4444;
	}

	.mob-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 10px;
		margin-top: 4px;
		border-top: 1px solid var(--nb-border);
	}

	.mob-footer-label {
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--nb-muted);
	}

	/* ── Responsive ────────────────────────────── */
	@media (min-width: 768px) {
		.nav-links {
			display: flex;
		}
		.nav-controls {
			display: flex;
		}
		.desktop-theme-toggle {
			display: flex;
		}
		.nav-divider {
			display: block;
		}
		.burger {
			display: none;
		}
		.mobile-panel {
			display: none !important;
		}
	}

	@media (max-width: 767px) {
		.nav-inner {
			padding: 0 1rem;
		}
	}

	@media (orientation: landscape) and (max-height: 500px) {
		.nav-inner {
			height: 46px;
		}
		.nav-link {
			height: 46px;
		}
		.mobile-panel {
			max-height: calc(100dvh - 46px);
			overflow-y: auto;
		}
	}
</style>
