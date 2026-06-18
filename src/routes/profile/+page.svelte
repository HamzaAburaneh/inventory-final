<script>
	import { authStore } from '../../stores/authStore.js';
	import { db } from '../../firebase.js';
	import { doc, getDoc } from 'firebase/firestore';
	import { goto } from '$app/navigation';
	import { fly, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { notificationStore } from '../../stores/notificationStore.js';

	const user = $derived($authStore);

	let name = $state('');
	let email = $state('');
	let phone = $state('');
	let isUpdating = $state(false);
	let initialName = $state('');
	let initialPhone = $state('');

	// Derived: true when the form differs from the persisted baseline.
	const dirty = $derived(name !== initialName || phone !== initialPhone);

	const initials = $derived(
		user
			? user.displayName
				? user.displayName
						.split(' ')
						.map((w) => w[0] ?? '')
						.filter(Boolean)
						.slice(0, 2)
						.join('')
						.toUpperCase()
				: (user.email?.[0] ?? '?').toUpperCase()
			: ''
	);

	// Format Firebase metadata timestamp ("2024-05-12T14:33:18Z") into a friendly
	// localized date. Returns null if no timestamp is available.
	function formatDate(value) {
		if (!value) return null;
		const d = value instanceof Date ? value : new Date(value);
		if (isNaN(d.getTime())) return null;
		return d.toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	const joinedDate = $derived(formatDate(user?.metadata?.creationTime));
	const lastSignIn = $derived(formatDate(user?.metadata?.lastSignInTime));

	async function fetchPhoneNumber(userId) {
		try {
			const userProfileDoc = await getDoc(doc(db, 'userProfiles', userId));
			if (userProfileDoc.exists()) {
				return userProfileDoc.data().phoneNumber || '';
			}
		} catch (error) {
			console.error('Error fetching phone number:', error);
		}
		return '';
	}

	async function loadUserData(authUser) {
		if (authUser) {
			initialName = authUser.displayName || '';
			initialPhone = await fetchPhoneNumber(authUser.uid);
			name = initialName;
			email = authUser.email || '';
			phone = initialPhone;
		} else {
			initialName = '';
			initialPhone = '';
			name = '';
			email = '';
			phone = '';
		}
	}

	// Reload form data whenever the authenticated user changes.
	$effect(() => {
		loadUserData(user);
	});

	async function handleSubmit() {
		isUpdating = true;
		try {
			await authStore.updateProfile(name, phone);
			// Re-sync baselines so the form goes back to a clean (non-dirty) state.
			initialName = name;
			initialPhone = phone;
			notificationStore.success('Profile updated successfully');
		} catch (error) {
			console.error('Profile update error:', error);
			notificationStore.error('Failed to update profile. Please try again.');
		} finally {
			isUpdating = false;
		}
	}

	function handleReset() {
		name = initialName;
		phone = initialPhone;
	}

	async function handleSignOut() {
		try {
			await authStore.logout();
			await goto('/login');
		} catch (error) {
			console.error('Sign out error:', error);
			notificationStore.error('Failed to sign out. Please try again.');
		}
	}
</script>

{#if user}
	<!-- `animate-in fade-in slide-in-from-bottom-4 duration-500` is Tailwind v4
	     shorthand for the page-level fade+slide entrance. -->
	<div class="profile-page animate-in fade-in slide-in-from-bottom-4 duration-500">
		<div class="profile-shell">
			<!-- ── Hero card ─────────────────────────────────────────────── -->
			<section
				class="hero-card"
				in:fly={{ y: 14, duration: 360, easing: cubicOut, delay: 40 }}
				aria-label="Account overview"
			>
				<div class="hero-top">
					<div class="avatar-ring transition-transform duration-300 ease-out hover:scale-105">
						<div class="avatar">
							{#if user.photoURL}
								<img src={user.photoURL} alt="" />
							{:else}
								<span>{initials}</span>
							{/if}
						</div>
					</div>

					<div class="hero-id">
						<p class="hero-label">Account</p>
						<h1 class="hero-name">{name || 'Unnamed user'}</h1>
						<p class="hero-email">{email}</p>
					</div>
				</div>

				<div class="hero-meta">
					<div class="meta-item">
						<span class="meta-label">Member since</span>
						<span class="meta-value">{joinedDate ?? '—'}</span>
					</div>
					<span class="meta-divider" aria-hidden="true"></span>
					<div class="meta-item">
						<span class="meta-label">Last sign-in</span>
						<span class="meta-value">{lastSignIn ?? '—'}</span>
					</div>
					<span class="meta-divider" aria-hidden="true"></span>
					<div class="meta-item">
						<span class="meta-label">Email</span>
						<span
							class="meta-pill"
							class:verified={user.emailVerified}
							class:unverified={!user.emailVerified}
						>
							<span class="meta-dot animate-pulse" aria-hidden="true"></span>
							{user.emailVerified ? 'Verified' : 'Unverified'}
						</span>
					</div>
				</div>
			</section>

			<!-- ── Edit form card ────────────────────────────────────────── -->
			<section
				class="form-card"
				in:fly={{ y: 14, duration: 360, easing: cubicOut, delay: 120 }}
				aria-label="Profile details"
			>
				<header class="card-header">
					<div>
						<h2 class="card-title">Profile details</h2>
						<p class="card-subtitle">Update how you appear across StockSense.</p>
					</div>
				</header>

				<form
					class="profile-form"
					onsubmit={(e) => {
						e.preventDefault();
						handleSubmit();
					}}
				>
					<div class="field">
						<label for="profile-name" class="field-label">Username</label>
						<div class="field-input-wrap">
							<svg
								class="field-icon"
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
							>
								<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
								<circle cx="12" cy="7" r="4"></circle>
							</svg>
							<input
								id="profile-name"
								type="text"
								class="field-input"
								bind:value={name}
								required
								autocomplete="name"
								placeholder="Your display name"
							/>
						</div>
					</div>

					<div class="field">
						<label for="profile-email" class="field-label">
							Email
							<span class="field-readonly">Read-only</span>
						</label>
						<div class="field-input-wrap">
							<svg
								class="field-icon"
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
							>
								<path
									d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
								></path>
								<polyline points="22,6 12,13 2,6"></polyline>
							</svg>
							<input
								id="profile-email"
								type="email"
								class="field-input"
								bind:value={email}
								disabled
								autocomplete="email"
							/>
						</div>
					</div>

					<div class="field">
						<label for="profile-phone" class="field-label">Phone</label>
						<div class="field-input-wrap">
							<svg
								class="field-icon"
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
							>
								<path
									d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
								></path>
							</svg>
							<input
								id="profile-phone"
								type="tel"
								class="field-input"
								bind:value={phone}
								autocomplete="tel"
								placeholder="Add a phone number"
							/>
						</div>
					</div>

					<div class="form-actions">
						<button
							type="button"
							class="btn btn-ghost"
							onclick={handleReset}
							disabled={!dirty || isUpdating}
						>
							Discard
						</button>
						<button type="submit" class="btn btn-primary" disabled={!dirty || isUpdating}>
							{#if isUpdating}
								<!-- `animate-spin` (Tailwind) replaces the bespoke keyframes. -->
								<span class="btn-spinner animate-spin" aria-hidden="true"></span>
								Saving…
							{:else}
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="15"
									height="15"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2.25"
									stroke-linecap="round"
									stroke-linejoin="round"
									aria-hidden="true"
								>
									<polyline points="20 6 9 17 4 12"></polyline>
								</svg>
								Save changes
							{/if}
						</button>
					</div>
				</form>
			</section>

			<!-- ── Sign out card ─────────────────────────────────────────── -->
			<section
				class="danger-card"
				in:fly={{ y: 14, duration: 360, easing: cubicOut, delay: 200 }}
				aria-label="Session"
			>
				<div class="danger-copy">
					<h3 class="danger-title">Sign out</h3>
					<p class="danger-sub">
						End your current session on this device. You can sign back in anytime.
					</p>
				</div>
				<button type="button" class="btn btn-danger" onclick={handleSignOut}>
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
					>
						<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
						<polyline points="16 17 21 12 16 7"></polyline>
						<line x1="21" y1="12" x2="9" y2="12"></line>
					</svg>
					Sign out
				</button>
			</section>
		</div>
	</div>
{:else}
	<div class="login-message animate-in fade-in duration-300" in:fade={{ duration: 200 }}>
		<p>Please log in to view your profile.</p>
	</div>
{/if}

<style>
	/* ── Theme-aware accent ───────────────────────────────────────── */
	/* This page tracks the app-wide accent (`--tech-accent`): blue in the light
	   theme, gold in the dark theme — the same tokens the login page and navbar
	   use, so the profile no longer reads as a separate indigo island. */

	/* ── Layout shell ───────────────────────────────────────────────── */
	.profile-page {
		width: 100%;
		display: flex;
		justify-content: center;
	}

	.profile-shell {
		width: 100%;
		max-width: 760px;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		padding: 1.25rem 0 2.5rem;
	}

	/* ── Hero card ──────────────────────────────────────────────────── */
	.hero-card {
		position: relative;
		overflow: hidden;
		background: var(--container-bg);
		border: 1px solid var(--table-border-color);
		border-radius: 16px;
		padding: 1.75rem;
		box-shadow:
			0 1px 2px rgba(0, 0, 0, 0.04),
			0 8px 24px rgba(0, 0, 0, 0.05);
	}

	.hero-top {
		position: relative;
		display: flex;
		align-items: center;
		gap: 1.25rem;
	}

	/* ── Avatar ─────────────────────────────────────────────────────── */
	.avatar-ring {
		position: relative;
		flex-shrink: 0;
		padding: 3px;
		border-radius: 50%;
		/* Solid app accent: blue in light mode, gold in dark mode. */
		background: var(--tech-accent);
	}

	.avatar {
		width: 72px;
		height: 72px;
		border-radius: 50%;
		background: var(--container-bg);
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		/* Initials take the app accent so they match the ring. */
		color: var(--tech-accent);
		font-size: 1.5rem;
		font-weight: 700;
		letter-spacing: 0.02em;
	}

	.avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.hero-id {
		min-width: 0;
		flex: 1;
	}

	.hero-label {
		margin: 0 0 0.25rem;
		font-size: 0.7rem;
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--text-color-dimmed);
	}

	.hero-name {
		margin: 0;
		font-size: 1.5rem;
		font-weight: 600;
		color: var(--text-color);
		letter-spacing: -0.015em;
		line-height: 1.2;
		word-break: break-word;
	}

	.hero-email {
		margin: 0.25rem 0 0;
		font-size: 0.875rem;
		color: var(--text-color-dimmed);
		word-break: break-all;
	}

	/* Meta strip */
	.hero-meta {
		position: relative;
		margin-top: 1.5rem;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem 1.25rem;
		padding-top: 1.25rem;
		border-top: 1px solid var(--table-border-color);
	}

	.meta-item {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		min-width: 0;
	}

	.meta-label {
		font-size: 0.7rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--text-color-dimmed);
	}

	.meta-value {
		font-size: 0.9rem;
		font-weight: 500;
		color: var(--text-color);
	}

	.meta-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.25rem 0.6rem;
		border-radius: 999px;
		font-size: 0.8rem;
		font-weight: 600;
		width: fit-content;
	}

	.meta-pill.verified {
		color: #16a34a;
		background: rgba(22, 163, 74, 0.12);
	}

	.meta-pill.unverified {
		color: #d97706;
		background: rgba(217, 119, 6, 0.14);
	}

	.meta-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: currentColor;
	}

	.meta-divider {
		width: 1px;
		height: 28px;
		background: var(--table-border-color);
	}

	/* ── Form card ─────────────────────────────────────────────────── */
	.form-card,
	.danger-card {
		background: var(--container-bg);
		border: 1px solid var(--table-border-color);
		border-radius: 16px;
		padding: 1.75rem;
		box-shadow:
			0 1px 2px rgba(0, 0, 0, 0.04),
			0 8px 24px rgba(0, 0, 0, 0.04);
	}

	.card-header {
		margin-bottom: 1.5rem;
	}

	.card-title {
		margin: 0 0 0.25rem;
		font-size: 1.1rem;
		font-weight: 600;
		color: var(--text-color);
		letter-spacing: -0.01em;
	}

	.card-subtitle {
		margin: 0;
		font-size: 0.875rem;
		color: var(--text-color-dimmed);
	}

	.profile-form {
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.field-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--text-color);
		letter-spacing: 0.02em;
	}

	.field-readonly {
		margin-left: auto;
		padding: 0.1rem 0.5rem;
		font-size: 0.65rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-color-dimmed);
		background: var(--table-header-bg);
		border-radius: 999px;
	}

	.field-input-wrap {
		position: relative;
		display: flex;
		align-items: center;
	}

	.field-icon {
		position: absolute;
		left: 0.9rem;
		color: var(--text-color-dimmed);
		pointer-events: none;
		flex-shrink: 0;
	}

	.field-input {
		width: 100%;
		padding: 0.75rem 0.9rem 0.75rem 2.6rem;
		font-size: 0.95rem;
		font-weight: 500;
		color: var(--text-color);
		background: var(--input-bg);
		border: 1px solid var(--input-border);
		border-radius: 10px;
		transition:
			border-color 0.2s ease,
			box-shadow 0.2s ease,
			background-color 0.2s ease;
	}

	.field-input::placeholder {
		color: var(--placeholder-text);
		font-weight: 400;
	}

	.field-input:hover:not(:disabled) {
		border-color: var(--input-hover-border-color);
	}

	.field-input:focus {
		outline: none;
		border-color: var(--tech-accent);
		box-shadow: 0 0 0 3px rgba(var(--tech-accent-rgb), 0.18);
	}

	.field-input:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	.form-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		margin-top: 0.5rem;
	}

	/* ── Buttons ───────────────────────────────────────────────────── */
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.7rem 1.2rem;
		font-size: 0.875rem;
		font-weight: 600;
		letter-spacing: 0.01em;
		border-radius: 10px;
		border: 1px solid transparent;
		cursor: pointer;
		min-height: var(--touch-target-min);
		transition:
			transform 0.18s ease,
			background-color 0.2s ease,
			border-color 0.2s ease,
			color 0.2s ease,
			box-shadow 0.2s ease;
	}

	.btn:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.btn:focus-visible {
		outline: 2px solid var(--tech-accent);
		outline-offset: 2px;
	}

	/* Primary: solid app accent (blue/gold) with the page background as the text
	   colour, mirroring the login submit button for cross-theme contrast. */
	.btn-primary {
		color: var(--tech-bg-end);
		background: var(--tech-accent);
		border-color: transparent;
		box-shadow:
			0 6px 18px -6px rgba(var(--tech-accent-rgb), 0.55),
			inset 0 1px 0 rgba(255, 255, 255, 0.15);
	}

	.btn-primary:hover:not(:disabled) {
		transform: translateY(-1px);
		filter: brightness(1.08);
		box-shadow:
			0 10px 26px -8px rgba(var(--tech-accent-rgb), 0.65),
			inset 0 1px 0 rgba(255, 255, 255, 0.18);
	}

	.btn-primary:active:not(:disabled) {
		transform: translateY(0);
	}

	.btn-ghost {
		color: var(--text-color);
		background: transparent;
		border-color: var(--table-border-color);
	}

	.btn-ghost:hover:not(:disabled) {
		background: var(--hover-bg-color);
		border-color: color-mix(in srgb, var(--tech-accent) 35%, var(--table-border-color));
	}

	.btn-danger {
		color: #ef4444;
		background: transparent;
		border-color: rgba(239, 68, 68, 0.35);
	}

	.btn-danger:hover:not(:disabled) {
		background: rgba(239, 68, 68, 0.08);
		border-color: rgba(239, 68, 68, 0.6);
	}

	/* Spinner border — `animate-spin` Tailwind utility drives the rotation.
	   Uses the button's text colour so it stays legible on the accent fill in
	   both themes (dark text on gold, light text on blue). */
	.btn-spinner {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		border: 2px solid color-mix(in srgb, currentColor 35%, transparent);
		border-top-color: currentColor;
	}

	/* ── Danger card ───────────────────────────────────────────────── */
	.danger-card {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.danger-copy {
		flex: 1;
		min-width: 220px;
	}

	.danger-title {
		margin: 0 0 0.25rem;
		font-size: 1rem;
		font-weight: 600;
		color: var(--text-color);
	}

	.danger-sub {
		margin: 0;
		font-size: 0.85rem;
		color: var(--text-color-dimmed);
	}

	/* ── Logged-out state ─────────────────────────────────────────── */
	.login-message {
		display: flex;
		justify-content: center;
		align-items: center;
		min-height: 60vh;
		width: 100%;
		color: var(--text-color);
		text-align: center;
		font-size: 1rem;
	}

	/* ── Responsive ───────────────────────────────────────────────── */
	@media (min-width: 640px) {
		.hero-card,
		.form-card,
		.danger-card {
			padding: 2rem;
		}
	}

	@media (min-width: 1024px) {
		.profile-shell {
			max-width: 820px;
			padding: 1.75rem 0 3rem;
			gap: 1.5rem;
		}

		.hero-name {
			font-size: 1.65rem;
		}
	}

	@media (max-width: 520px) {
		.hero-top {
			gap: 1rem;
		}

		.avatar {
			width: 60px;
			height: 60px;
			font-size: 1.25rem;
		}

		.hero-name {
			font-size: 1.25rem;
		}

		.hero-meta {
			gap: 0.75rem;
		}

		.meta-divider {
			display: none;
		}

		.form-actions {
			flex-direction: column-reverse;
		}

		.form-actions .btn {
			width: 100%;
		}
	}
</style>
