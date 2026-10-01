<script>
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import ThemeToggle from './ThemeToggle.svelte';
	import { authStore } from '../stores/authStore.js';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { fly, slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { prefersReducedMotion } from 'svelte/motion';
	import { slidingIndicator } from '../lib/slidingIndicator.js';

	// `user` is the user to render the navbar for. The layout passes the SSR hint
	// during the brief window before Firebase confirms the session, then the real
	// authStore user — so this is correct from the first paint with no flash.
	let { user } = $props();

	// The signed-in pages, in bar order. The bar uses the short label, the mobile
	// menu the long one.
	const LINKS = [
		{ path: '/manageItems', label: 'Items', mobileLabel: 'Item Manager', icon: 'items' },
		{
			path: '/manageTransactions',
			label: 'Ledger',
			mobileLabel: 'Manage Transactions',
			icon: 'ledger'
		},
		{
			path: '/transactionHistory',
			label: 'History',
			mobileLabel: 'Transaction History',
			icon: 'history'
		},
		{
			path: '/transactionAnalysis',
			label: 'Analytics',
			mobileLabel: 'Transaction Analysis',
			icon: 'analytics'
		},
		{
			path: '/inventoryPredictions',
			label: 'Forecast',
			mobileLabel: 'Inventory Forecast',
			icon: 'forecast'
		},
		{ path: '/orders', label: 'Orders', mobileLabel: 'Order Sheet', icon: 'orders' },
		{ path: '/vendorBalances', label: 'Vendors', mobileLabel: 'Vendor Balances', icon: 'vendors' }
	];

	let isOpen = $state(false);
	let isDropdownOpen = $state(false);
	let dropdownNode = $state();
	let userMenuNode = $state();
	let profileBtnNode = $state();
	let menuToggleRef = $state();
	let mobileMenuRef = $state();
	let isMobile = $state(browser ? window.innerWidth < 768 : false);
	let pointerScrollY = null;

	const currentPath = $derived($page.url.pathname);

	// Menus drop in toward the bar; reduced motion shows them at once.
	const motion = $derived(prefersReducedMotion.current ? 0 : 1);
	const panelDrop = $derived({ y: -6, duration: 180 * motion, easing: cubicOut });
	const menuSlide = $derived({ duration: 160 * motion, easing: cubicOut });

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
		const scrollY = pointerScrollY;
		pointerScrollY = null;
		isOpen = !isOpen;
		if (scrollY !== null) {
			requestAnimationFrame(() => window.scrollTo({ top: scrollY, behavior: 'instant' }));
		}
	}

	function focusWithoutScroll(event) {
		pointerScrollY = window.scrollY;
		event.preventDefault();
		event.currentTarget.focus({ preventScroll: true });
	}

	function closeMenu() {
		isOpen = false;
	}

	function openDropdown() {
		isDropdownOpen = true;
	}

	function closeDropdown() {
		isDropdownOpen = false;
	}

	// Close on Escape from anywhere in the menu and return focus to the avatar.
	function handleMenuKeydown(event) {
		if (event.key === 'Escape' && isDropdownOpen) {
			closeDropdown();
			profileBtnNode?.focus();
		}
	}

	async function handleLogout() {
		await authStore.logout();
		closeDropdown();
		closeMenu();
		goto(resolve('/login'));
	}

	async function handleProfileClick(event) {
		event.preventDefault();
		closeDropdown();
		await goto(resolve('/profile'));
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

{#snippet navIcon(name, size)}
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		{#if name === 'items'}
			<path
				d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
			></path>
		{:else if name === 'ledger'}
			<polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"
			></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"
			></path>
		{:else if name === 'history'}
			<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>
		{:else if name === 'analytics'}
			<line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line
				x1="6"
				y1="20"
				x2="6"
				y2="14"
			></line>
		{:else if name === 'forecast'}
			<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"
			></polyline>
		{:else if name === 'orders'}
			<circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path
				d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"
			></path>
		{:else if name === 'vendors'}
			<path d="M3 9 4.5 4h15L21 9"></path><path d="M3 9h18"></path><path d="M5 9v11h14V9"
			></path><path d="M10 20v-5h4v5"></path>
		{:else if name === 'profile'}
			<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"
			></circle>
		{:else if name === 'signout'}
			<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"
			></polyline><line x1="21" y1="12" x2="9" y2="12"></line>
		{/if}
	</svg>
{/snippet}

<nav class="navbar" aria-label="Main navigation">
	<div class="nav-inner">
		<!-- ── Logo ── -->
		<a href={resolve('/')} class="brand">
			<svg class="brand-mark" viewBox="0 0 24 24" fill="none" aria-hidden="true">
				<path d="M12 2.9 21.2 7.5 12 12.1 2.8 7.5 12 2.9Z" fill="currentColor" />
				<path
					d="m3.4 12 8.6 4.3 8.6-4.3"
					stroke="currentColor"
					stroke-width="2.1"
					stroke-linecap="round"
					stroke-linejoin="round"
					opacity="0.7"
				/>
				<path
					d="m3.4 16.4 8.6 4.3 8.6-4.3"
					stroke="currentColor"
					stroke-width="2.1"
					stroke-linecap="round"
					stroke-linejoin="round"
					opacity="0.42"
				/>
			</svg>
			<span class="brand-text">Stock<span class="brand-accent">Sense</span></span>
		</a>

		<!-- ── Desktop links: the accent pill glides to the current page ── -->
		<div class="nav-links-wrap" {@attach slidingIndicator('.nav-link.active', currentPath)}>
			<span class="nav-indicator" data-sliding-indicator aria-hidden="true"></span>
			<ul class="nav-links" role="list" aria-label="Site navigation">
				{#if user}
					{#each LINKS as link (link.path)}
						<li>
							<a
								href={resolve(link.path)}
								class={['nav-link', currentPath === link.path && 'active']}
								aria-current={currentPath === link.path ? 'page' : undefined}
							>
								{@render navIcon(link.icon, 15)}
								{link.label}
							</a>
						</li>
					{/each}
				{:else}
					<li>
						<a
							href={resolve('/login')}
							class={['nav-link', currentPath === '/login' && 'active']}
							aria-current={currentPath === '/login' ? 'page' : undefined}
						>
							Login
						</a>
					</li>
				{/if}
			</ul>
		</div>

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
					onkeydown={handleMenuKeydown}
				>
					<button
						class="profile-btn"
						bind:this={profileBtnNode}
						onclick={openDropdown}
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
							transition:slide={menuSlide}
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
									<a
										href={resolve('/profile')}
										class="drop-item"
										role="menuitem"
										onclick={handleProfileClick}
									>
										{@render navIcon('profile', 13)}
										Profile
									</a>
								</li>
								<li role="none">
									<button class="drop-item drop-signout" role="menuitem" onclick={handleLogout}>
										{@render navIcon('signout', 13)}
										Sign out
									</button>
								</li>
							</ul>
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<!-- ── Mobile: avatar (to the profile) and the menu button ── -->
		{#if user}
			<a
				href={resolve('/profile')}
				class="mob-bar-avatar"
				aria-label="Profile"
				onclick={handleProfileClick}
			>
				<span class="avatar" aria-hidden="true">{userInitials}</span>
			</a>
		{/if}

		<button
			class="burger"
			type="button"
			onclick={toggleMenu}
			bind:this={menuToggleRef}
			aria-expanded={isOpen}
			aria-controls="mobile-nav"
			aria-label={isOpen ? 'Close menu' : 'Open menu'}
			onpointerdown={focusWithoutScroll}
		>
			<span class="burger-bars" class:open={isOpen} aria-hidden="true">
				<span></span>
				<span></span>
				<span></span>
			</span>
		</button>
	</div>

	<!-- ── Mobile panel: floats over the page and drops in toward the bar ── -->
	{#if isOpen}
		<div class="mobile-panel" id="mobile-nav" transition:fly={panelDrop} bind:this={mobileMenuRef}>
			{#if user}
				<div class="mob-user-row">
					<span class="mob-avatar" aria-hidden="true">{userInitials}</span>
					<div class="mob-id">
						<p class="mob-name">{user.displayName || ''}</p>
						<p class="mob-email">{user.email ?? ''}</p>
					</div>
				</div>

				<div class="mob-tiles" {@attach slidingIndicator('.mob-tile.active', currentPath)}>
					<span class="mob-tile-indicator" data-sliding-indicator aria-hidden="true"></span>
					{#each LINKS as link (link.path)}
						<a
							href={resolve(link.path)}
							class={['mob-tile', currentPath === link.path && 'active']}
							aria-current={currentPath === link.path ? 'page' : undefined}
							onclick={closeMenu}
						>
							{@render navIcon(link.icon, 18)}
							<span>{link.mobileLabel}</span>
						</a>
					{/each}
				</div>

				<div class="mob-account">
					<a
						href={resolve('/profile')}
						class="mob-action"
						onclick={(e) => {
							closeMenu();
							handleProfileClick(e);
						}}
					>
						{@render navIcon('profile', 16)}
						Profile
					</a>
					<button type="button" class="mob-action mob-signout" onclick={handleLogout}>
						{@render navIcon('signout', 16)}
						Sign out
					</button>
				</div>
			{:else}
				<a
					href={resolve('/login')}
					class={['mob-login', currentPath === '/login' && 'active']}
					aria-current={currentPath === '/login' ? 'page' : undefined}
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
		--nb-glass: var(--nav-glass);
		--nb-border: var(--nav-border-color);
		--nb-text: var(--nav-text-color);
		--nb-muted: var(--nav-text-muted);
		--nb-hover-bg: var(--nav-hover-bg);
		--nb-accent: var(--tech-accent);
		--nb-accent-rgb: var(--tech-accent-rgb);
		--nb-on-accent: var(--nav-on-accent);
		--nb-raised: var(--nav-raised);
		--nb-avatar-fg: var(--nav-avatar-text);
		--nb-danger: var(--nav-danger-text);
		--nb-danger-bg: var(--nav-danger-surface);
		--nb-dropdown-shadow: var(--nav-dropdown-shadow);
	}

	/* ── Shell: a flat, translucent bar along the top ── */
	.navbar {
		position: sticky;
		top: 0;
		z-index: 1000;
		background: var(--nb-glass);
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
		border-bottom: 1px solid var(--nb-border);
		overflow: visible;
		/* No shadow — intentional */
	}

	/* Translucency is a stylistic choice, not one worth spending contrast on:
	   under a high-contrast preference the bar is solid with an edge. */
	@media (prefers-contrast: more), (prefers-contrast: high) {
		.navbar {
			background: var(--nb-surface);
			border-bottom-color: var(--nb-border);
			backdrop-filter: none;
			-webkit-backdrop-filter: none;
		}
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

	/* ── Logo ── */
	.brand {
		color: var(--tech-title);
		font-size: 1.35rem;
		/* Was 300 — too light to hold up against the dark hero backdrop. */
		font-weight: 600;
		letter-spacing: -0.025em;
		line-height: 1;
		text-decoration: none;
		transition: opacity 0.4s ease;
		display: flex;
		align-items: center;
		gap: 0.55rem;
		min-height: 48px;
		flex-shrink: 0;
		margin-right: 1.5rem;
	}

	.brand-mark {
		width: 1.5rem;
		height: 1.5rem;
		flex-shrink: 0;
		color: var(--nb-accent);
	}

	.brand:hover {
		opacity: 0.75;
	}

	.brand:focus-visible {
		outline: 2px solid var(--nb-accent);
		outline-offset: 4px;
		border-radius: 4px;
	}

	.brand-text {
		position: relative;
	}
	.brand-accent {
		color: var(--nb-accent);
		font-weight: 600;
	}

	/* ── Nav links ─────────────────────────────── */
	.nav-links-wrap {
		position: relative;
		display: none;
		align-items: center;
	}

	.nav-links {
		display: flex;
		align-items: center;
		gap: 2px;
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.nav-link {
		position: relative;
		z-index: 1;
		display: inline-flex;
		align-items: center;
		gap: 7px;
		height: 38px;
		padding: 0 15px;
		border-radius: 999px;
		font-size: 0.8125rem;
		font-weight: 600;
		letter-spacing: 0.01em;
		color: var(--nb-muted);
		text-decoration: none;
		white-space: nowrap;
		transition:
			color 0.18s ease,
			background-color 0.18s ease;
	}

	.nav-link :global(svg) {
		flex-shrink: 0;
	}

	.nav-link:hover:not(.active) {
		color: var(--nb-text);
		background: var(--nb-hover-bg);
	}

	/* The current page is a filled accent pill. The sliding indicator draws it once
	   it has landed ([data-gliding]); until then the link fills itself, so it is
	   never invisible (on-accent text over the glass). */
	.nav-link.active {
		color: var(--nb-on-accent);
		background: var(--nb-accent);
	}

	/* `data-gliding` is set at runtime by slidingIndicator, hence :global. */
	.nav-links-wrap:global([data-gliding]) .nav-link.active {
		background: transparent;
	}

	.nav-link:focus-visible {
		outline: 2px solid var(--nb-accent);
		outline-offset: 2px;
	}

	.nav-indicator,
	.mob-tile-indicator {
		position: absolute;
		top: 0;
		left: 0;
		z-index: 0;
		opacity: 0;
		pointer-events: none;
		transition:
			transform 340ms cubic-bezier(0.2, 0.8, 0.2, 1),
			width 340ms cubic-bezier(0.2, 0.8, 0.2, 1),
			height 340ms cubic-bezier(0.2, 0.8, 0.2, 1),
			opacity 160ms ease;
	}

	/* Appearing (first placement, coming back from a page with no link, or after
	   being hidden) fades in where it lands; it only slides once data-ready is set. */
	.nav-indicator:not([data-ready]),
	.mob-tile-indicator:not([data-ready]) {
		transition: opacity 160ms ease;
	}

	.nav-indicator {
		background: var(--nb-accent);
		border-radius: 999px;
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
		margin: 0 1.25rem;
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
		line-height: 1;
		user-select: none;
	}

	/* ── Dropdown ──────────────────────────────── */
	.dropdown {
		position: absolute;
		top: calc(100% + 10px);
		right: 0;
		min-width: 220px;
		border-radius: 14px;
		padding: 6px;
		margin: 0;
		overflow: hidden;
		z-index: 100;
		background: var(--nb-surface);
		border: 1px solid var(--nb-border);
		box-shadow: var(--nb-dropdown-shadow);
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
		border-radius: 8px;
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
		background: var(--nb-danger-bg);
		color: var(--nb-danger);
	}

	/* ── Mobile bar: avatar and menu button ────── */
	.mob-bar-avatar {
		display: flex;
		margin-right: 10px;
		border-radius: 50%;
		text-decoration: none;
		-webkit-tap-highlight-color: transparent;
	}

	.mob-bar-avatar:focus-visible {
		outline: 2px solid var(--nb-accent);
		outline-offset: 2px;
	}

	.burger {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		/* Override global button touch-target rules (min-height 44px + big
		   padding) that otherwise crush the icon's content box to 0 width. */
		padding: 0;
		min-height: 0;
		min-width: 0;
		border-radius: 12px;
		border: 1px solid var(--nb-border);
		background: transparent;
		cursor: pointer;
		flex-shrink: 0;
		transition:
			background-color 0.18s ease,
			border-color 0.18s ease;
	}

	/* Global button:focus draws a ring on every tap; keep the ring for
	   keyboard focus only. */
	.burger:focus {
		outline: none;
	}

	/* Hover-capable devices only — on touch, :hover sticks after a tap and
	   leaves the button with a stuck accent border. */
	@media (hover: hover) {
		.burger:hover {
			background: var(--nb-hover-bg);
			border-color: color-mix(in srgb, var(--nb-accent) 35%, var(--nb-border));
		}
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

	/* 2px bars at ~75% text color so they stay crisp and visible on
	   high-DPR phone screens (1.5px muted bars read as a single faint dash). */
	.burger-bars span {
		display: block;
		height: 2px;
		width: 100%;
		background: color-mix(in srgb, var(--nb-text) 75%, transparent);
		border-radius: 2px;
		transition:
			transform 0.22s ease,
			opacity 0.22s ease;
		transform-origin: center;
	}

	/* Open state: outer bars translate to the middle FIRST, then rotate into a
	   symmetric X (translate-before-rotate keeps the math exact). */
	.burger-bars.open span:nth-child(1) {
		transform: translateY(4.5px) rotate(45deg);
	}

	.burger-bars.open span:nth-child(2) {
		opacity: 0;
		transform: scaleX(0);
	}

	.burger-bars.open span:nth-child(3) {
		transform: translateY(-4.5px) rotate(-45deg);
	}

	/* ── Mobile panel ──────────────────────────── */
	.mobile-panel {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		z-index: 100;
		background: var(--nb-surface);
		border-bottom: 1px solid var(--nb-border);
		padding: 10px 12px 4px;
		max-height: calc(100dvh - 56px);
		overflow-y: auto;
		overscroll-behavior: contain;
	}

	.mob-user-row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 4px 4px 12px;
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

	.mob-id {
		min-width: 0;
	}

	.mob-name {
		font-size: 0.875rem;
		font-weight: 700;
		color: var(--nb-text);
		margin: 0;
	}

	.mob-email {
		font-size: 0.75rem;
		color: var(--nb-muted);
		margin: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* Page tiles; the raised, accent-edged tile glides to the current page. */
	.mob-tiles {
		position: relative;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}

	.mob-tile {
		position: relative;
		z-index: 1;
		display: flex;
		align-items: center;
		gap: 9px;
		min-height: 50px;
		padding: 6px 11px;
		border: 1px solid var(--nb-border);
		border-radius: 12px;
		font-size: 0.8125rem;
		font-weight: 600;
		line-height: 1.25;
		color: var(--nb-text);
		text-decoration: none;
		-webkit-tap-highlight-color: transparent;
		transition:
			background-color 0.15s ease,
			border-color 0.15s ease;
	}

	.mob-tile :global(svg) {
		flex-shrink: 0;
		color: var(--nb-muted);
		transition: color 0.15s ease;
	}

	@media (hover: hover) {
		.mob-tile:hover:not(.active) {
			background: var(--nb-hover-bg);
		}
	}

	.mob-tile.active {
		background: var(--nb-raised);
		border-color: color-mix(in srgb, var(--nb-accent) 60%, transparent);
	}

	.mob-tiles:global([data-gliding]) .mob-tile.active {
		background: transparent;
		border-color: transparent;
	}

	.mob-tile.active :global(svg) {
		color: var(--nb-accent);
	}

	.mob-tile:focus-visible {
		outline: 2px solid var(--nb-accent);
		outline-offset: 2px;
	}

	.mob-tile-indicator {
		background: var(--nb-raised);
		border: 1px solid color-mix(in srgb, var(--nb-accent) 60%, transparent);
		border-radius: 12px;
	}

	/* Profile and sign out, side by side under the tiles */
	.mob-account {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
		margin-top: 10px;
		padding-top: 10px;
		border-top: 1px solid var(--nb-border);
	}

	.mob-action {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		height: 44px;
		min-height: 0;
		padding: 0 12px;
		margin: 0;
		font: inherit;
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--nb-muted);
		text-decoration: none;
		background: transparent;
		border: none;
		border-radius: 12px;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
		transition:
			background-color 0.15s ease,
			color 0.15s ease;
	}

	@media (hover: hover) {
		.mob-action:hover {
			background: var(--nb-hover-bg);
			color: var(--nb-text);
		}

		.mob-signout:hover {
			background: var(--nb-danger-bg);
			color: var(--nb-danger);
		}
	}

	.mob-action:focus {
		outline: none;
	}

	.mob-action:focus-visible {
		outline: 2px solid var(--nb-accent);
		outline-offset: 2px;
	}

	.mob-login {
		display: flex;
		align-items: center;
		height: 48px;
		padding: 0 14px;
		border: 1px solid var(--nb-border);
		border-radius: 12px;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--nb-text);
		text-decoration: none;
	}

	.mob-login.active {
		background: var(--nb-raised);
		border-color: color-mix(in srgb, var(--nb-accent) 60%, transparent);
	}

	.mob-login:focus-visible {
		outline: 2px solid var(--nb-accent);
		outline-offset: 2px;
	}

	.mob-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 10px;
		margin-top: 10px;
		border-top: 1px solid var(--nb-border);
	}

	.mob-footer-label {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--nb-muted);
	}

	/* ── Responsive ────────────────────────────── */
	@media (min-width: 768px) {
		.nav-links-wrap {
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
		.mob-bar-avatar,
		.burger {
			display: none;
		}
		.mobile-panel {
			display: none !important;
		}
	}

	/* Seven links need the full desktop width; on small tablets tighten them
	   rather than hiding any. */
	@media (min-width: 768px) and (max-width: 1099px) {
		.brand {
			margin-right: 0.75rem;
		}
		.nav-link {
			gap: 4px;
			height: 34px;
			padding: 0 8px;
			font-size: 0.75rem;
		}
		.nav-link :global(svg) {
			width: 13px;
			height: 13px;
		}
		.nav-divider {
			margin: 0 0.75rem;
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
			height: 32px;
		}
		.mobile-panel {
			max-height: calc(100dvh - 46px);
			overflow-y: auto;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.nav-indicator,
		.mob-tile-indicator {
			transition: none;
		}
	}
</style>
