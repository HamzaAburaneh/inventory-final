<script>
	import { authStore } from '../../stores/authStore.js';
	import { db } from '../../firebase.js';
	import { doc, getDoc } from 'firebase/firestore';
	import { onMount } from 'svelte';
	import { slide } from 'svelte/transition';

	// Form state
	let name = $state('');
	let email = $state('');
	let phone = $state('');
	let errorMessage = $state('');
	let successMessage = $state('');
	let isUpdating = $state(false);

	// Use Svelte's $ prefix for auto-subscription
	const user = $derived($authStore);

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

	// Load user data when user changes
	$effect(() => {
		const authUser = user;
		if (authUser) {
			name = authUser.displayName || '';
			email = authUser.email || '';
			fetchPhoneNumber(authUser.uid).then((phoneNumber) => {
				phone = phoneNumber;
			});
		} else {
			name = '';
			email = '';
			phone = '';
		}
	});

	async function handleSubmit() {
		errorMessage = '';
		successMessage = '';
		isUpdating = true;

		try {
			await authStore.updateProfile(name, phone);
			successMessage = 'Profile updated successfully!';
			setTimeout(() => (successMessage = ''), 3000);
		} catch (error) {
			errorMessage = 'Failed to update profile. Please try again.';
		} finally {
			isUpdating = false;
		}
	}
</script>

<svelte:head>
	<title>User Profile</title>
</svelte:head>

<div class="page-viewport-wrapper">
	<div class="glow-layer"></div>
	<div class="content-container">
		<header class="page-header">
			<div class="title-group">
				<h1 class="main-title">User Profile</h1>
				<div class="system-status">
					<span class="status-dot"></span>
					<span class="status-text">IDENTITY_VERIFIED</span>
				</div>
			</div>
		</header>

		{#if user}
			<div class="profile-layout">
				<div class="profile-sidebar">
					<div class="avatar-section">
						<div class="avatar-glow"></div>
						<div class="avatar-main">
							<i class="fas fa-user"></i>
						</div>
						<div class="user-badge">AUTHORIZED_USER</div>
					</div>
					
					<div class="user-meta">
						<div class="meta-item">
							<span class="meta-label">ACCOUNT_STATUS</span>
							<span class="meta-value digital-font">ACTIVE_VERIFIED</span>
						</div>
						<div class="meta-item">
							<span class="meta-label">LAST_LOGIN</span>
							<span class="meta-value digital-font">{new Date().toLocaleDateString()}</span>
						</div>
					</div>
				</div>

				<div class="profile-main">
					<div class="tech-card">
						<div class="card-header">
							<i class="fas fa-id-card"></i>
							<span>IDENTITY_MANAGEMENT</span>
						</div>
						
						<form
							onsubmit={(e) => {
								e.preventDefault();
								handleSubmit();
							}}
							class="profile-form"
						>
							<div class="form-grid">
								<div class="input-group">
									<label for="name" class="tech-label">Display Name</label>
									<div class="tech-input-wrapper">
										<input type="text" id="name" bind:value={name} class="tech-input" placeholder="Enter name..." required />
										<i class="fas fa-user input-icon"></i>
									</div>
								</div>

								<div class="input-group">
									<label for="email" class="tech-label">Email Address</label>
									<div class="tech-input-wrapper">
										<input type="email" id="email" bind:value={email} class="tech-input disabled" disabled />
										<i class="fas fa-envelope input-icon"></i>
									</div>
								</div>

								<div class="input-group">
									<label for="phone" class="tech-label">Phone Number</label>
									<div class="tech-input-wrapper">
										<input type="tel" id="phone" bind:value={phone} class="tech-input" placeholder="+1 (555) 000-0000" />
										<i class="fas fa-phone input-icon"></i>
									</div>
								</div>
							</div>

							{#if errorMessage}
								<div class="status-message error" transition:slide={{ duration: 300 }}>
									<i class="fas fa-exclamation-circle"></i>
									<span>{errorMessage}</span>
								</div>
							{/if}
							
							{#if successMessage}
								<div class="status-message success" transition:slide={{ duration: 300 }}>
									<i class="fas fa-check-circle"></i>
									<span>{successMessage}</span>
								</div>
							{/if}

							<div class="form-footer">
								<button type="submit" class="submit-btn" disabled={isUpdating}>
									<i class="fas {isUpdating ? 'fa-sync fa-spin' : 'fa-save'}"></i>
									<span>{isUpdating ? 'SYNCHRONIZING...' : 'UPDATE_IDENTITY'}</span>
								</button>
							</div>
						</form>
					</div>

					<div class="tech-card security-card">
						<div class="card-header">
							<i class="fas fa-shield-alt"></i>
							<span>SECURITY_PROTOCOLS</span>
						</div>
						<div class="security-content">
							<div class="security-item">
								<div class="security-info">
									<span class="security-title">Multi-Factor Authentication</span>
									<span class="security-desc">Add an extra layer of security to your account.</span>
								</div>
								<button class="security-btn" disabled>CONFIGURE</button>
							</div>
						</div>
					</div>
				</div>
			</div>
		{:else}
			<div class="null-state">
				<i class="fas fa-user-lock"></i>
				<p>ACCESS_DENIED: PLEASE LOG IN</p>
			</div>
		{/if}
	</div>
</div>

<style>
	:global(body) {
		background-color: var(--tech-bg-end) !important;
		background-image: radial-gradient(circle at 50% -10%, var(--tech-bg-start) 0%, var(--tech-bg-end) 100%) !important;
		background-attachment: fixed !important;
		margin: 0;
		padding: 0;
		overflow-x: hidden;
	}

	.page-viewport-wrapper {
		position: relative;
		min-height: 100vh;
		width: 100%;
		display: flex;
		flex-direction: column;
		box-sizing: border-box;
	}

	.glow-layer {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100vh;
		background: radial-gradient(circle at 50% 0%, var(--tech-accent-muted) 0%, transparent 50%);
		pointer-events: none;
		z-index: 0;
	}

	.content-container {
		position: relative;
		z-index: 2;
		max-width: 1200px;
		margin: 0 auto;
		width: 100%;
		padding: 3rem 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 2.5rem;
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
	}

	.main-title {
		font-size: 2.5rem;
		font-weight: 800;
		color: var(--tech-title);
		margin: 0;
		letter-spacing: -0.05em;
		text-transform: uppercase;
		line-height: 1;
	}

	.system-status {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-top: 0.8rem;
		opacity: 0.8;
	}

	.status-dot {
		width: 6px;
		height: 6px;
		background: var(--tech-accent);
		border-radius: 50%;
		box-shadow: 0 0 10px var(--tech-accent-muted);
		animation: pulse-soft 3s ease-in-out infinite;
	}

	@keyframes pulse-soft {
		0%, 100% { opacity: 0.4; transform: scale(0.9); }
		50% { opacity: 1; transform: scale(1.1); }
	}

	.status-text {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.6rem;
		color: var(--tech-status-text);
		letter-spacing: 0.2em;
		font-weight: 800;
	}

	.profile-layout {
		display: grid;
		grid-template-columns: 300px 1fr;
		gap: 2.5rem;
		align-items: start;
	}

	.profile-sidebar {
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	.avatar-section {
		position: relative;
		background: var(--tech-glass-bg);
		border: 1px solid var(--tech-glass-border);
		border-radius: 20px;
		padding: 3rem 2rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.5rem;
		overflow: hidden;
	}

	.avatar-glow {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 150px;
		height: 150px;
		background: var(--tech-accent);
		filter: blur(60px);
		opacity: 0.1;
		pointer-events: none;
	}

	.avatar-main {
		width: 100px;
		height: 100px;
		background: var(--tech-badge-bg);
		border: 2px solid var(--tech-accent);
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 3rem;
		color: var(--tech-accent);
		box-shadow: 0 0 30px var(--tech-accent-muted);
		position: relative;
		z-index: 1;
	}

	.user-badge {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.6rem;
		font-weight: 800;
		color: var(--tech-accent);
		background: var(--tech-accent-muted);
		padding: 0.4rem 1rem;
		border-radius: 50px;
		border: 1px solid var(--tech-accent);
		letter-spacing: 0.1em;
	}

	.user-meta {
		background: var(--tech-glass-bg);
		border: 1px solid var(--tech-glass-border);
		border-radius: 12px;
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.meta-item {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.meta-label {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.55rem;
		font-weight: 800;
		color: var(--tech-label);
		letter-spacing: 0.1em;
	}

	.meta-value {
		font-size: 0.85rem;
		color: var(--tech-value);
		font-weight: 700;
	}

	.profile-main {
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	.tech-card {
		background: var(--tech-glass-bg);
		border: 1px solid var(--tech-glass-border);
		border-radius: 16px;
		overflow: hidden;
	}

	.card-header {
		background: var(--tech-header-bg);
		padding: 1.25rem 2rem;
		border-bottom: 1px solid var(--tech-glass-border);
		display: flex;
		align-items: center;
		gap: 1rem;
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.75rem;
		font-weight: 800;
		color: var(--tech-header-text);
		letter-spacing: 0.1em;
	}

	.card-header i {
		color: var(--tech-accent);
	}

	.profile-form {
		padding: 2rem;
	}

	.form-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 2rem;
		margin-bottom: 2.5rem;
	}

	.input-group {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.tech-label {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.65rem;
		font-weight: 800;
		color: var(--tech-label);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.tech-input-wrapper {
		position: relative;
		display: flex;
		align-items: center;
	}

	.tech-input {
		width: 100%;
		background: var(--tech-badge-bg);
		border: 1px solid var(--tech-glass-border);
		border-radius: 8px;
		padding: 0.85rem 1rem 0.85rem 3rem;
		color: var(--tech-value);
		font-family: 'Inter', sans-serif;
		font-size: 0.95rem;
		font-weight: 600;
		transition: all 0.2s;
	}

	.tech-input:focus {
		outline: none;
		border-color: var(--tech-accent);
		background: var(--tech-header-bg);
		box-shadow: 0 0 15px var(--tech-accent-muted);
	}

	.tech-input.disabled {
		opacity: 0.6;
		cursor: not-allowed;
		background: rgba(0, 0, 0, 0.05);
	}

	.input-icon {
		position: absolute;
		left: 1.25rem;
		color: var(--tech-label);
		opacity: 0.5;
		font-size: 0.9rem;
		transition: all 0.2s;
	}

	.tech-input:focus + .input-icon {
		color: var(--tech-accent);
		opacity: 1;
	}

	.status-message {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 1rem;
		border-radius: 8px;
		font-size: 0.85rem;
		font-weight: 700;
		margin-bottom: 2rem;
		animation: slide-up 0.3s ease-out;
	}

	@keyframes slide-up {
		from { transform: translateY(10px); opacity: 0; }
		to { transform: translateY(0); opacity: 1; }
	}

	.status-message.success {
		background: rgba(34, 197, 94, 0.1);
		color: #22c55e;
		border: 1px solid rgba(34, 197, 94, 0.2);
	}

	.status-message.error {
		background: rgba(239, 68, 68, 0.1);
		color: #ef4444;
		border: 1px solid rgba(239, 68, 68, 0.2);
	}

	.form-footer {
		display: flex;
		justify-content: flex-end;
	}

	.submit-btn {
		background: var(--tech-accent);
		color: #000;
		border: none;
		padding: 1rem 2.5rem;
		border-radius: 8px;
		font-family: 'JetBrains Mono', monospace;
		font-weight: 800;
		font-size: 0.8rem;
		letter-spacing: 0.1em;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 1rem;
		transition: all 0.3s;
	}

	.submit-btn:hover:not(:disabled) {
		transform: translateY(-2px);
		box-shadow: 0 5px 20px var(--tech-accent-muted);
		filter: brightness(1.1);
	}

	.submit-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.security-content {
		padding: 1.5rem 2rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.security-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 2rem;
	}

	.security-info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.security-title {
		font-weight: 700;
		color: var(--tech-value);
		font-size: 0.95rem;
	}

	.security-desc {
		font-size: 0.8rem;
		color: var(--tech-label);
	}

	.security-btn {
		background: var(--tech-badge-bg);
		border: 1px solid var(--tech-glass-border);
		color: var(--tech-label);
		padding: 0.6rem 1.2rem;
		border-radius: 6px;
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.65rem;
		font-weight: 800;
		cursor: not-allowed;
		opacity: 0.6;
	}

	.divider {
		height: 1px;
		background: var(--tech-cell-border);
	}

	.digital-font {
		font-family: 'JetBrains Mono', monospace;
	}

	.null-state {
		height: 400px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2rem;
		background: var(--tech-glass-bg);
		border: 1px solid var(--tech-glass-border);
		border-radius: 20px;
		color: var(--tech-label);
	}

	.null-state i { font-size: 4rem; opacity: 0.3; }
	.null-state p { font-family: 'JetBrains Mono', monospace; font-weight: 800; letter-spacing: 0.2em; }

	@media (max-width: 900px) {
		.profile-layout { grid-template-columns: 1fr; }
		.profile-sidebar { flex-direction: row; align-items: stretch; }
		.avatar-section { flex: 1; }
		.user-meta { flex: 1; justify-content: center; }
	}

	@media (max-width: 768px) {
		.content-container {
			padding: 1.25rem;
			gap: 1rem;
		}

		.main-title {
			font-size: 1.5rem;
			letter-spacing: -0.02em;
		}

		.system-status {
			display: none;
		}

		.page-header {
			gap: 1rem;
			margin-bottom: 0;
		}
	}

	@media (max-width: 600px) {
		.profile-sidebar { flex-direction: column; }
		.form-grid { grid-template-columns: 1fr; }
	}
</style>
