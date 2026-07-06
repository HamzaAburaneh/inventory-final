<script>
	import { onMount } from 'svelte';
	import { groupStore } from '../stores/groupStore.js';
	import {
		getGroup,
		listMembers,
		removeMember,
		leaveGroup,
		regenerateInviteCode
	} from '../lib/groups.js';
	import { notificationStore } from '../stores/notificationStore.js';
	import { goto } from '$app/navigation';

	/** @type {{ user: import('firebase/auth').User | null }} */
	let { user } = $props();

	const group = $derived($groupStore);
	const isOwner = $derived(group.role === 'owner');

	let loading = $state(true);
	let groupDoc = $state(null);
	let members = $state([]);
	let busy = $state(false);

	const inviteCode = $derived(groupDoc?.inviteCode || '');
	const inviteLink = $derived(
		inviteCode && typeof window !== 'undefined'
			? `${window.location.origin}/onboarding?code=${inviteCode}`
			: ''
	);

	async function load() {
		if (group.status !== 'ready' || !group.groupId) return;
		loading = true;
		try {
			groupDoc = await getGroup(group.groupId);
			members = await listMembers(group.groupId);
		} catch (error) {
			console.error('Failed to load group:', error);
		} finally {
			loading = false;
		}
	}

	onMount(load);

	// Reload if the active group changes (e.g. after join elsewhere).
	$effect(() => {
		if (group.status === 'ready') load();
	});

	async function copy(text, label) {
		try {
			await navigator.clipboard.writeText(text);
			notificationStore.showNotification(`${label} copied`, 'success');
		} catch {
			notificationStore.showNotification('Could not copy — copy it manually', 'warning');
		}
	}

	async function handleRegenerate() {
		if (!isOwner || busy) return;
		busy = true;
		try {
			const code = await regenerateInviteCode(user, group.groupId, inviteCode);
			groupDoc = { ...groupDoc, inviteCode: code };
			notificationStore.showNotification('New invite code generated', 'success');
		} catch (error) {
			console.error('Regenerate code failed:', error);
			notificationStore.showNotification('Could not regenerate the code', 'error');
		} finally {
			busy = false;
		}
	}

	async function handleRemove(uid) {
		if (!isOwner || busy) return;
		busy = true;
		try {
			await removeMember(group.groupId, uid);
			members = members.filter((m) => m.uid !== uid);
			notificationStore.showNotification('Member removed', 'success');
		} catch (error) {
			console.error('Remove member failed:', error);
			notificationStore.showNotification('Could not remove the member', 'error');
		} finally {
			busy = false;
		}
	}

	async function handleLeave() {
		if (busy) return;
		busy = true;
		try {
			await leaveGroup(user, group.groupId);
			groupStore.clear();
			notificationStore.showNotification('You left the group', 'success');
			goto('/onboarding');
		} catch (error) {
			console.error('Leave group failed:', error);
			notificationStore.showNotification('Could not leave the group', 'error');
		} finally {
			busy = false;
		}
	}

	function memberInitials(member) {
		const source = member.displayName || member.email || '?';
		return source.slice(0, 2).toUpperCase();
	}
</script>

<section class="group-card" aria-label="Your group">
	<header class="card-header">
		<div>
			<h2 class="card-title">Your group</h2>
			<p class="card-subtitle">
				Everyone in this group shares the same inventory, ledger and analytics.
			</p>
		</div>
	</header>

	{#if loading}
		<div class="skeleton-rows">
			<div class="sk"></div>
			<div class="sk"></div>
		</div>
	{:else if groupDoc}
		<div class="group-head">
			<div class="group-name">{groupDoc.name}</div>
			<span class="role-pill" class:owner={isOwner}>{isOwner ? 'Owner' : 'Member'}</span>
		</div>

		<div class="invite">
			<div class="invite-label">Invite code</div>
			<div class="invite-row">
				<code class="code">{inviteCode || '—'}</code>
				<button class="chip" onclick={() => copy(inviteCode, 'Code')} disabled={!inviteCode}>
					Copy code
				</button>
				<button class="chip" onclick={() => copy(inviteLink, 'Invite link')} disabled={!inviteLink}>
					Copy link
				</button>
				{#if isOwner}
					<button class="chip subtle" onclick={handleRegenerate} disabled={busy}>New code</button>
				{/if}
			</div>
			<p class="invite-hint">
				Share this with someone to add them to your group. Anyone with the code can join.
			</p>
		</div>

		<div class="members">
			<div class="members-label">Members · {members.length}</div>
			<ul class="member-list">
				{#each members as member (member.uid)}
					<li class="member">
						<span class="avatar">{memberInitials(member)}</span>
						<span class="member-id">
							<span class="member-name">{member.displayName || member.email}</span>
							<span class="member-role">{member.role}</span>
						</span>
						{#if isOwner && member.uid !== user?.uid}
							<button class="chip danger" onclick={() => handleRemove(member.uid)} disabled={busy}>
								Remove
							</button>
						{/if}
					</li>
				{/each}
			</ul>
		</div>

		{#if !isOwner}
			<div class="leave-row">
				<button class="chip danger" onclick={handleLeave} disabled={busy}>Leave group</button>
			</div>
		{/if}
	{:else}
		<p class="empty">Group details are unavailable right now.</p>
	{/if}
</section>

<style>
	.group-card {
		background: var(--container-bg);
		border: 1px solid var(--table-border-color);
		border-radius: 16px;
		padding: 1.75rem;
		box-shadow:
			0 1px 2px rgba(0, 0, 0, 0.04),
			0 8px 24px rgba(0, 0, 0, 0.04);
	}

	.card-header {
		margin-bottom: 1.25rem;
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

	.group-head {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 1.25rem;
	}

	.group-name {
		font-size: 1.15rem;
		font-weight: 600;
		color: var(--text-color);
	}

	.role-pill {
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		padding: 0.2rem 0.55rem;
		border-radius: 999px;
		background: var(--background-color);
		color: var(--text-color-dimmed);
	}

	.role-pill.owner {
		background: var(--add-item-color);
		color: var(--add-item-on);
	}

	.invite {
		padding: 1rem;
		background: var(--background-color);
		border-radius: 12px;
		margin-bottom: 1.25rem;
	}

	.invite-label,
	.members-label {
		font-size: 0.72rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-color-dimmed);
		margin-bottom: 0.6rem;
	}

	.invite-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}

	.code {
		font-family: var(--font-mono, monospace);
		font-size: 1.1rem;
		font-weight: 700;
		letter-spacing: 0.28em;
		padding: 0.4rem 0.8rem;
		background: var(--container-bg);
		border: 1px solid var(--table-border-color);
		border-radius: 8px;
		color: var(--text-color);
	}

	.invite-hint {
		margin: 0.7rem 0 0;
		font-size: 0.78rem;
		color: var(--text-color-dimmed);
	}

	.chip {
		border: 1px solid var(--table-border-color);
		background: var(--container-bg);
		color: var(--text-color);
		border-radius: 8px;
		padding: 0.45rem 0.75rem;
		font-size: 0.8rem;
		font-weight: 500;
		cursor: pointer;
		font-family: inherit;
		transition: all 0.15s ease;
	}

	.chip:hover:not(:disabled) {
		border-color: var(--add-item-color);
	}

	.chip:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.chip.subtle {
		color: var(--text-color-dimmed);
	}

	.chip.danger {
		color: #e0483b;
		border-color: rgba(224, 72, 59, 0.35);
	}

	.chip.danger:hover:not(:disabled) {
		background: rgba(224, 72, 59, 0.08);
		border-color: rgba(224, 72, 59, 0.6);
	}

	:global([data-theme='dark']) .chip.danger {
		color: #f87171;
		border-color: rgba(248, 113, 113, 0.4);
	}

	:global([data-theme='dark']) .chip.danger:hover:not(:disabled) {
		background: rgba(248, 113, 113, 0.12);
		border-color: rgba(248, 113, 113, 0.6);
	}

	.member-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.member {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.6rem 0.75rem;
		border: 1px solid var(--table-border-color);
		border-radius: 10px;
	}

	.avatar {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		display: grid;
		place-items: center;
		background: var(--add-item-color);
		color: var(--add-item-on);
		font-size: 0.72rem;
		font-weight: 700;
		flex-shrink: 0;
	}

	.member-id {
		display: flex;
		flex-direction: column;
		min-width: 0;
		flex: 1;
	}

	.member-name {
		font-size: 0.9rem;
		font-weight: 500;
		color: var(--text-color);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.member-role {
		font-size: 0.72rem;
		color: var(--text-color-dimmed);
		text-transform: capitalize;
	}

	.leave-row {
		margin-top: 1.25rem;
	}

	.skeleton-rows {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.sk {
		height: 2.5rem;
		border-radius: 10px;
		background: var(--background-color);
	}

	.empty {
		font-size: 0.85rem;
		color: var(--text-color-dimmed);
	}
</style>
