<script>
	import { onMount } from 'svelte';
	import { groupStore } from '../stores/groupStore.js';
	import { listBooths, addBooth, renameBooth, deleteBooth, BOOTH_PALETTE } from '../lib/booths.js';
	import { notificationStore } from '../stores/notificationStore.js';
	import ConfirmModal from './ConfirmModal.svelte';

	const group = $derived($groupStore);
	const isOwner = $derived(group.role === 'owner');

	let loading = $state(true);
	let booths = $state([]);
	let busy = $state(false);

	let newLabel = $state('');
	let newColor = $state(BOOTH_PALETTE[0]);

	let renamingId = $state(null);
	let renameValue = $state('');

	let deleteTarget = $state(null);

	function sortByLabel(list) {
		return [...list].sort((a, b) => a.label.localeCompare(b.label));
	}

	async function load() {
		if (group.status !== 'ready') return;
		loading = true;
		try {
			booths = await listBooths();
		} catch (error) {
			console.error('Failed to load booths:', error);
		} finally {
			loading = false;
		}
	}

	onMount(load);

	// Reload if the active group changes (e.g. after join elsewhere).
	$effect(() => {
		if (group.status === 'ready') load();
	});

	async function handleAdd() {
		if (!isOwner || busy) return;
		const label = newLabel.trim();
		if (!label) return;
		busy = true;
		try {
			const booth = await addBooth(label, newColor);
			booths = sortByLabel([...booths, booth]);
			newLabel = '';
			notificationStore.showNotification('Booth added', 'success');
		} catch (error) {
			console.error('Add booth failed:', error);
			notificationStore.showNotification('Could not add the booth', 'error');
		} finally {
			busy = false;
		}
	}

	function startRename(booth) {
		if (!isOwner || busy) return;
		renamingId = booth.id;
		renameValue = booth.label;
	}

	function cancelRename() {
		renamingId = null;
		renameValue = '';
	}

	async function confirmRename(booth) {
		if (busy) return;
		const label = renameValue.trim();
		if (!label || label === booth.label) {
			cancelRename();
			return;
		}
		busy = true;
		try {
			await renameBooth(booth.id, label);
			booths = sortByLabel(booths.map((b) => (b.id === booth.id ? { ...b, label } : b)));
			notificationStore.showNotification('Booth renamed', 'success');
		} catch (error) {
			console.error('Rename booth failed:', error);
			notificationStore.showNotification('Could not rename the booth', 'error');
		} finally {
			busy = false;
			cancelRename();
		}
	}

	function askDelete(booth) {
		if (!isOwner || busy) return;
		deleteTarget = booth;
	}

	async function confirmDeleteBooth() {
		if (!deleteTarget || busy) return;
		busy = true;
		try {
			await deleteBooth(deleteTarget.id);
			booths = booths.filter((b) => b.id !== deleteTarget.id);
			notificationStore.showNotification('Booth deleted', 'success');
		} catch (error) {
			console.error('Delete booth failed:', error);
			notificationStore.showNotification('Could not delete the booth', 'error');
		} finally {
			busy = false;
			deleteTarget = null;
		}
	}
</script>

<section class="booth-card" aria-label="Booths">
	<header class="card-header">
		<div>
			<h2 class="card-title">Booths</h2>
			<p class="card-subtitle">
				Tag items by the booth or stand they belong to, so the table and add-item form can group
				them.
			</p>
		</div>
	</header>

	{#if loading}
		<div class="skeleton-rows">
			<div class="sk"></div>
			<div class="sk"></div>
		</div>
	{:else}
		{#if booths.length}
			<ul class="booth-list">
				{#each booths as booth (booth.id)}
					<li class="booth-row">
						<span class="swatch" style="background-color: {booth.color}"></span>
						{#if renamingId === booth.id}
							<input
								class="rename-input"
								type="text"
								bind:value={renameValue}
								onkeydown={(e) => {
									if (e.key === 'Enter') confirmRename(booth);
									if (e.key === 'Escape') cancelRename();
								}}
							/>
							<button class="chip" onclick={() => confirmRename(booth)} disabled={busy}>
								Save
							</button>
							<button class="chip subtle" onclick={cancelRename} disabled={busy}>Cancel</button>
						{:else}
							<span class="booth-label">{booth.label}</span>
							{#if isOwner}
								<button class="chip subtle" onclick={() => startRename(booth)} disabled={busy}>
									Rename
								</button>
								<button class="chip danger" onclick={() => askDelete(booth)} disabled={busy}>
									Delete
								</button>
							{/if}
						{/if}
					</li>
				{/each}
			</ul>
		{:else}
			<p class="empty">
				{isOwner
					? 'No booths yet — add one below.'
					: 'The group owner hasn’t added any booths yet.'}
			</p>
		{/if}

		{#if isOwner}
			<div class="add-booth">
				<div class="add-label">Add a booth</div>
				<div class="add-row">
					<input
						class="add-input"
						type="text"
						placeholder="Booth name"
						bind:value={newLabel}
						onkeydown={(e) => e.key === 'Enter' && handleAdd()}
					/>
					<button class="chip primary" onclick={handleAdd} disabled={busy || !newLabel.trim()}>
						Add
					</button>
				</div>
				<div class="palette" role="radiogroup" aria-label="Booth color">
					{#each BOOTH_PALETTE as color (color)}
						<button
							type="button"
							class="palette-swatch"
							class:selected={newColor === color}
							style="background-color: {color}"
							aria-label="Choose color {color}"
							aria-checked={newColor === color}
							role="radio"
							onclick={() => (newColor = color)}
						></button>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</section>

<ConfirmModal
	visible={deleteTarget !== null}
	title="Delete booth?"
	confirmText="Delete"
	cancelText="Cancel"
	variant="danger"
	chipIcon="ti-tag"
	chipLabel={deleteTarget?.label}
	onConfirm={confirmDeleteBooth}
	onCancel={() => (deleteTarget = null)}
>
	Items already tagged with "{deleteTarget?.label}" will keep showing it, just as an unmanaged tag,
	until you recreate a booth with the same name.
</ConfirmModal>

<style>
	.booth-card {
		background: var(--container-bg);
		border: 1px solid var(--table-border-color);
		border-radius: 16px;
		padding: 1.75rem;
		margin-top: 1.5rem;
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

	.booth-list {
		list-style: none;
		margin: 0 0 1.25rem;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.booth-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.55rem 0.75rem;
		border: 1px solid var(--table-border-color);
		border-radius: 10px;
	}

	.swatch {
		width: 18px;
		height: 18px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.booth-label {
		font-size: 0.9rem;
		font-weight: 500;
		color: var(--text-color);
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.rename-input {
		flex: 1;
		min-width: 0;
		padding: 0.4rem 0.6rem;
		font-size: 0.85rem;
		font-family: inherit;
		color: var(--input-text);
		background: var(--input-bg);
		border: 1px solid var(--input-border);
		border-radius: 8px;
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
		flex-shrink: 0;
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

	.chip.primary {
		background: var(--add-item-color);
		color: var(--add-item-on);
		border-color: transparent;
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

	.add-booth {
		padding: 1rem;
		background: var(--background-color);
		border-radius: 12px;
	}

	.add-label {
		font-size: 0.72rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-color-dimmed);
		margin-bottom: 0.6rem;
	}

	.add-row {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}

	.add-input {
		flex: 1;
		min-width: 0;
		padding: 0.5rem 0.7rem;
		font-size: 0.85rem;
		font-family: inherit;
		color: var(--input-text);
		background: var(--input-bg);
		border: 1px solid var(--input-border);
		border-radius: 8px;
	}

	.palette {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.palette-swatch {
		width: 26px;
		height: 26px;
		border-radius: 50%;
		border: 2px solid transparent;
		cursor: pointer;
		padding: 0;
	}

	.palette-swatch.selected {
		border-color: var(--text-color);
		box-shadow: 0 0 0 2px var(--background-color);
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
