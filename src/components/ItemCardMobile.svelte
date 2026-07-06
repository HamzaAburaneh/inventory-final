<script>
	import {
		formatCost,
		formatTotalValue,
		formatBooths,
		capitalizeWords,
		getStorageTypeClass,
		getStorageTypeIcon,
		getBoothStyle,
		isLowStock
	} from '../lib/tableUtils.js';
	import Icon from './Icon.svelte';

	let { item, onEdit, onDelete } = $props();

	const low = $derived(isLowStock(item));
	const countIsZero = $derived((parseFloat(item.count) || 0) === 0);
	const totalIsZero = $derived((parseFloat(item.count) || 0) * (parseFloat(item.cost) || 0) === 0);
	const costIsZero = $derived(!item.cost || (parseFloat(item.cost) || 0) === 0);
	const lowIsZero = $derived(!item.lowCount || (parseFloat(item.lowCount) || 0) === 0);
	const boothList = $derived(formatBooths(item.booths));

	function edit(field, value) {
		onEdit(item.id, field, value);
	}
</script>

<div class="item-card" class:is-low={low}>
	<!-- Read-only summary -->
	<button class="name-btn" onclick={() => edit('name', item.name)} aria-label="Edit name">
		<span class="name-text">{item.name}</span>
		{#if low}
			<span class="low-pill"><Icon name="alert" size={11} /> Low</span>
		{/if}
		<span class="name-pencil"><Icon name="pencil" size={15} /></span>
	</button>

	<div class="stat-row">
		<div class="stat">
			<span class="stat-label">Count</span>
			<span class="stat-value" class:is-zero={countIsZero}>{item.count}</span>
		</div>
		<div class="stat total-tile">
			<span class="stat-label">Total value</span>
			<span class="stat-value total" class:is-zero={totalIsZero}
				>{formatTotalValue(item.count, item.cost)}</span
			>
		</div>
	</div>

	<!-- Editable fields -->
	<span class="edit-hint">Tap to edit</span>
	<div class="edit-panel">
		<button class="edit-row" onclick={() => edit('lowCount', item.lowCount)}>
			<span class="row-label">Low count</span>
			<span class="row-value">
				<span class="row-text" class:is-zero={lowIsZero}
					>{item.lowCount != null ? item.lowCount : ''}</span
				>
				<span class="chev"><Icon name="chevron" size={16} /></span>
			</span>
		</button>

		<button class="edit-row" onclick={() => edit('cost', item.cost)}>
			<span class="row-label">Cost</span>
			<span class="row-value">
				<span class="row-text" class:is-zero={costIsZero}>{formatCost(item.cost)}</span>
				<span class="chev"><Icon name="chevron" size={16} /></span>
			</span>
		</button>

		<button class="edit-row" onclick={() => edit('storageType', item.storageType)}>
			<span class="row-label">Type</span>
			<span class="row-value">
				<span class="storage-type {getStorageTypeClass(item.storageType)}">
					{#if item.storageType}
						<Icon name={getStorageTypeIcon(item.storageType)} size={13} class="shrink-0" />
					{/if}
					{item.storageType ? capitalizeWords(item.storageType) : 'Not set'}
				</span>
				<span class="chev"><Icon name="chevron" size={16} /></span>
			</span>
		</button>

		<button class="edit-row" onclick={() => edit('booths', item.booths)}>
			<span class="row-label">Booths</span>
			<span class="row-value">
				{#if boothList.length}
					<span class="booths-tags">
						{#each boothList as booth (booth)}
							<span
								class="booth-tag"
								style="background-color: {getBoothStyle(booth)
									.backgroundColor}; color: {getBoothStyle(booth).color};"
							>
								{booth}
							</span>
						{/each}
					</span>
				{:else}
					<span class="row-text is-zero">None</span>
				{/if}
				<span class="chev"><Icon name="chevron" size={16} /></span>
			</span>
		</button>
	</div>

	<div class="card-foot">
		<button
			class="delete-btn"
			onclick={() => onDelete(item.id, item.name)}
			aria-label="Delete item"
		>
			<svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<polyline points="3 6 5 6 21 6"></polyline>
				<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
				></path>
				<line x1="10" y1="11" x2="10" y2="17"></line>
				<line x1="14" y1="11" x2="14" y2="17"></line>
			</svg>
			Delete
		</button>
	</div>
</div>

<style>
	/* Card palette. Light mode uses outlined (white + hairline) surfaces so the
	   card doesn't read as a stack of grey boxes; dark mode fills the tiles/panel
	   so they separate from the near-black card. Both are driven by these local
	   custom properties (default = light, overridden under [data-theme='dark']). */
	.item-card {
		--mc-card-border: #e4e7eb;
		--mc-tile-bg: transparent;
		--mc-tile-border: #e4e7eb;
		--mc-panel-bg: transparent;
		--mc-panel-border: #e4e7eb;
		--mc-divider: #eef0f3;
		--mc-total-bg: #e8f1ff;
		--mc-total-border: #cfe2fb;
		--mc-label: #6b7280;
		--mc-dim: #9aa1ac;
		--mc-icon: #aab0b8;
		--mc-del-text: #dc2626;
		--mc-del-border: #ef4444;
		--mc-del-bg: rgba(239, 68, 68, 0.06);

		background: var(--container-bg);
		border: 1px solid var(--mc-card-border);
		border-radius: 0.75rem;
		padding: 0.85rem 0.9rem;
	}

	:global([data-theme='dark']) .item-card {
		--mc-card-border: #343434;
		--mc-tile-bg: transparent;
		--mc-tile-border: #343434;
		--mc-panel-bg: transparent;
		--mc-panel-border: #343434;
		--mc-divider: #2b2b2b;
		--mc-total-bg: #2a2410;
		--mc-total-border: #403714;
		--mc-label: #a8adb5;
		--mc-dim: #6f757d;
		--mc-icon: #7c828b;
		--mc-del-text: #f87171;
		--mc-del-border: #f87171;
		--mc-del-bg: rgba(248, 113, 113, 0.1);
	}

	.item-card.is-low {
		border-left: 3px solid var(--mc-del-border);
	}

	/* Header — item name doubles as the "edit name" control. */
	.name-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		color: var(--text-color);
		text-align: left;
	}

	.name-text {
		font-size: 1.05rem;
		font-weight: 700;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}

	.name-pencil {
		margin-left: auto;
		display: inline-flex;
		flex-shrink: 0;
		color: var(--mc-icon);
	}

	.low-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		flex-shrink: 0;
		padding: 0.08rem 0.4rem;
		border-radius: 9999px;
		font-size: 0.62rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		line-height: 1.4;
		color: var(--mc-del-border);
		background: color-mix(in srgb, var(--mc-del-border) 14%, transparent);
	}

	/* Read-only stat tiles. */
	.stat-row {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.75rem;
	}

	.stat {
		flex: 1;
		min-width: 0;
		background: var(--mc-tile-bg);
		border: 1px solid var(--mc-tile-border);
		border-radius: 0.6rem;
		padding: 0.5rem 0.65rem;
	}

	.stat.total-tile {
		background: var(--mc-total-bg);
		border-color: var(--mc-total-border);
	}

	.stat-label {
		display: block;
		font-size: 0.7rem;
		color: var(--mc-label);
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.stat-value {
		display: block;
		margin-top: 0.15rem;
		font-size: 1.05rem;
		font-weight: 700;
		color: var(--text-color);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.stat-value.total {
		color: var(--value-color);
	}

	/* De-emphasize empty / zero values so real numbers stand out. */
	.is-zero {
		color: var(--text-color-dimmed);
		opacity: 0.55;
		font-weight: 400;
	}

	.stat-value.total.is-zero {
		color: var(--text-color-dimmed);
	}

	.edit-hint {
		display: block;
		margin: 0.9rem 0 0.4rem;
		font-size: 0.68rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--mc-dim);
	}

	/* "Tap to edit" panel — outlined in light, filled in dark. */
	.edit-panel {
		background: var(--mc-panel-bg);
		border: 1px solid var(--mc-panel-border);
		border-radius: 0.7rem;
		overflow: hidden;
	}

	.edit-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		width: 100%;
		background: none;
		border: none;
		border-bottom: 1px solid var(--mc-divider);
		padding: 0.7rem 0.75rem;
		cursor: pointer;
		color: var(--text-color);
		text-align: left;
		transition: background-color 0.15s ease-out;
	}

	.edit-row:last-child {
		border-bottom: none;
	}

	.edit-row:active {
		background: var(--table-row-hover-bg);
	}

	.row-label {
		flex-shrink: 0;
		font-size: 0.85rem;
		color: var(--mc-label);
	}

	.row-value {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.55rem;
		flex: 1;
		min-width: 0;
		font-size: 0.9rem;
	}

	.row-text {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}

	.chev {
		display: inline-flex;
		flex-shrink: 0;
		color: var(--mc-icon);
	}

	/* Storage type badge — soft-tint palette matching the desktop table. */
	.storage-type {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.2rem 0.6rem;
		border-radius: 9999px;
		font-size: 0.75rem;
		font-weight: 600;
		white-space: nowrap;
	}

	.storage-type.freezer {
		background: #dbeafe;
		color: #1e40af;
	}
	.storage-type.refrigerator {
		background: #e0f2fe;
		color: #075985;
	}
	.storage-type.dry-storage {
		background: #fef3c7;
		color: #92400e;
	}
	.storage-type.unset {
		background: #e2e8f0;
		color: #334155;
	}

	:global([data-theme='dark']) .storage-type.freezer {
		background: #16294a;
		color: #93c5fd;
	}
	:global([data-theme='dark']) .storage-type.refrigerator {
		background: #0c3148;
		color: #7dd3fc;
	}
	:global([data-theme='dark']) .storage-type.dry-storage {
		background: #3a2a0e;
		color: #fcd34d;
	}
	:global([data-theme='dark']) .storage-type.unset {
		background: #1e293b;
		color: #cbd5e1;
	}

	/* Booth tags. */
	.booths-tags {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 0.3rem;
		min-width: 0;
	}

	.booth-tag {
		padding: 0.15rem 0.45rem;
		border-radius: 9999px;
		font-size: 0.7rem;
		font-weight: 600;
		white-space: nowrap;
		line-height: 1.2;
		box-shadow: 0 0.063rem 0.125rem rgba(0, 0, 0, 0.1);
		border: 0.063rem solid rgba(0, 0, 0, 0.1);
	}

	/* Delete footer. */
	.card-foot {
		display: flex;
		justify-content: center;
		margin-top: 0.85rem;
	}

	.delete-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.55rem 1.4rem;
		border: 1px solid var(--mc-del-border);
		border-radius: 0.5rem;
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--mc-del-text);
		background: var(--mc-del-bg);
		cursor: pointer;
		transition:
			transform 0.12s ease-out,
			background-color 0.15s ease-out;
	}

	.delete-btn:hover {
		background: color-mix(in srgb, var(--mc-del-border) 14%, transparent);
	}

	.delete-btn svg {
		width: 1.1rem;
		height: 1.1rem;
	}

	.delete-btn:active {
		transform: scale(0.97);
	}

	@media (prefers-reduced-motion: reduce) {
		.delete-btn:active {
			transform: none;
		}
	}
</style>
