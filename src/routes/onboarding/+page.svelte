<script>
	import { authStore, authReady } from '../../stores/authStore.js';
	import { groupStore } from '../../stores/groupStore.js';
	import { createGroup, joinGroupByCode } from '../../lib/groups.js';
	import { notificationStore } from '../../stores/notificationStore.js';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	const user = $derived($authStore);
	const ready = $derived($authReady);
	const group = $derived($groupStore);

	// A shared invite link lands here as /onboarding?code=XXXXXX — prefill the
	// join tab so the recipient just confirms.
	const linkedCode = $derived($page.url.searchParams.get('code') || '');

	let mode = $state('create'); // 'create' | 'join'
	let groupName = $state('');
	let inviteCode = $state('');
	let busy = $state(false);
	let error = $state('');

	// Apply a code from the invite link once, switching to the join tab.
	$effect(() => {
		if (linkedCode && !inviteCode) {
			inviteCode = linkedCode.toUpperCase();
			mode = 'join';
		}
	});

	// Gate: bounce logged-out visitors to login, and users who already belong to
	// a group straight into the app.
	$effect(() => {
		if (!ready) return;
		if (!user) {
			goto('/login');
		} else if (group.status === 'ready') {
			goto('/manageItems');
		}
	});

	async function handleCreate(event) {
		event.preventDefault();
		error = '';
		if (!groupName.trim()) {
			error = 'Please enter a name for your group.';
			return;
		}
		busy = true;
		try {
			const { groupId } = await createGroup(user, groupName);
			groupStore.applyGroup(groupId, 'owner');
			notificationStore.showNotification('Group created', 'success');
			goto('/manageItems');
		} catch (err) {
			console.error('Create group failed:', err);
			error = err?.message || 'Could not create the group. Please try again.';
		} finally {
			busy = false;
		}
	}

	async function handleJoin(event) {
		event.preventDefault();
		error = '';
		if (!inviteCode.trim()) {
			error = 'Please enter an invite code.';
			return;
		}
		busy = true;
		try {
			const { groupId } = await joinGroupByCode(user, inviteCode);
			groupStore.applyGroup(groupId, 'member');
			notificationStore.showNotification('Joined group', 'success');
			goto('/manageItems');
		} catch (err) {
			console.error('Join group failed:', err);
			error = err?.message || 'Could not join. Check the code and try again.';
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head>
	<title>Set up your group - StockSense</title>
</svelte:head>

<div class="onboarding">
	<div class="card">
		<h1>Welcome to StockSense</h1>
		<p class="lead">
			Your inventory lives in a <strong>group</strong>. Create a new one, or join an existing group
			with an invite code your teammate shared.
		</p>

		<div class="tabs" role="tablist">
			<button
				role="tab"
				aria-selected={mode === 'create'}
				class="tab"
				class:active={mode === 'create'}
				onclick={() => {
					mode = 'create';
					error = '';
				}}
			>
				Create a group
			</button>
			<button
				role="tab"
				aria-selected={mode === 'join'}
				class="tab"
				class:active={mode === 'join'}
				onclick={() => {
					mode = 'join';
					error = '';
				}}
			>
				Join with a code
			</button>
		</div>

		{#if mode === 'create'}
			<form onsubmit={handleCreate}>
				<label for="group-name">Group name</label>
				<input
					id="group-name"
					type="text"
					bind:value={groupName}
					placeholder="e.g. CNE Booth Inventory"
					maxlength="60"
					autocomplete="off"
					disabled={busy}
				/>
				<button class="primary" type="submit" disabled={busy}>
					{busy ? 'Creating…' : 'Create group'}
				</button>
			</form>
		{:else}
			<form onsubmit={handleJoin}>
				<label for="invite-code">Invite code</label>
				<input
					id="invite-code"
					type="text"
					bind:value={inviteCode}
					placeholder="e.g. K7P2QX"
					maxlength="6"
					autocomplete="off"
					autocapitalize="characters"
					spellcheck="false"
					class="code-input"
					disabled={busy}
				/>
				<button class="primary" type="submit" disabled={busy}>
					{busy ? 'Joining…' : 'Join group'}
				</button>
			</form>
		{/if}

		{#if error}
			<p class="error" role="alert">{error}</p>
		{/if}
	</div>
</div>

<style>
	.onboarding {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		min-height: calc(100vh - 160px);
		padding: 1rem;
	}

	.card {
		background: var(--container-bg);
		border: 1px solid var(--table-border-color);
		border-radius: 1rem;
		padding: 2rem;
		max-width: 440px;
		width: 100%;
		box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
	}

	h1 {
		font-size: var(--text-2xl);
		font-weight: var(--font-weight-bold);
		letter-spacing: -0.02em;
		margin-bottom: 0.5rem;
	}

	.lead {
		font-size: 0.9rem;
		color: var(--text-color-dimmed);
		line-height: 1.5;
		margin-bottom: 1.5rem;
	}

	.tabs {
		display: flex;
		gap: 0.5rem;
		background: var(--background-color);
		padding: 0.25rem;
		border-radius: 0.7rem;
		margin-bottom: 1.5rem;
	}

	.tab {
		flex: 1;
		border: none;
		background: transparent;
		color: var(--text-color-dimmed);
		padding: 0.55rem;
		font-size: 0.85rem;
		font-weight: 500;
		border-radius: 0.5rem;
		cursor: pointer;
		font-family: inherit;
		transition: all 0.18s ease;
	}

	.tab.active {
		background: var(--add-item-color);
		color: var(--add-item-on);
		font-weight: 600;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	label {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--text-color-dimmed);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	input {
		padding: 0.7rem 0.8rem;
		border: 1px solid var(--table-border-color);
		border-radius: 0.5rem;
		background: var(--background-color);
		color: var(--text-color);
		font-size: 0.95rem;
		font-family: inherit;
	}

	.code-input {
		text-transform: uppercase;
		letter-spacing: 0.3em;
		font-weight: 600;
		text-align: center;
	}

	.primary {
		margin-top: 0.75rem;
		padding: 0.75rem;
		background: var(--add-item-color);
		color: var(--add-item-on);
		border: none;
		border-radius: 0.5rem;
		font-size: 0.95rem;
		font-weight: 600;
		cursor: pointer;
		font-family: inherit;
		transition: transform 0.15s ease;
	}

	.primary:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.primary:not(:disabled):hover {
		transform: translateY(-1px);
	}

	.error {
		margin-top: 1rem;
		padding: 0.6rem 0.8rem;
		background: rgba(244, 67, 54, 0.1);
		border: 1px solid rgba(244, 67, 54, 0.3);
		border-radius: 0.5rem;
		color: #e0483b;
		font-size: 0.85rem;
	}

	:global([data-theme='dark']) .error {
		background: rgba(248, 113, 113, 0.14);
		border-color: rgba(248, 113, 113, 0.4);
		color: #f87171;
	}
</style>
