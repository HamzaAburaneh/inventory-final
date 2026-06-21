<script>
	import { fade } from 'svelte/transition';
	import { flip } from 'svelte/animate';
	import { sineOut } from 'svelte/easing';
	import { prefersReducedMotion } from 'svelte/motion';
	import { motionDuration, rowExitDuration } from '../lib/tableUtils.js';
	import TableHeader from './TableHeader.svelte';
	import TableCell from './TableCell.svelte';
	import DeleteModal from './DeleteModal.svelte';
	import Tooltip from './Tooltip.svelte';

	let {
		paginatedItems = [],
		onEdit,
		onDelete,
		sortBy,
		currentSortColumn,
		sortAscending,
		searchKey = ''
	} = $props();

	let deletingItemId = $state(null);
	let visibleItems = $derived(paginatedItems.filter((item) => item.id !== deletingItemId));
	let isDeleting = $derived(deletingItemId !== null);
	let showDeleteConfirm = $state(false);
	let itemToDelete = $state(null);
	let tooltipText = $state('');
	let tooltipX = $state(0);
	let tooltipY = $state(0);
	let showTooltip = $state(false);

	function handleTooltipShow(event) {
		const button = event.currentTarget;
		const rect = button.getBoundingClientRect();
		const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
		const scrollY = window.pageYOffset || document.documentElement.scrollTop;

		tooltipX = rect.left + scrollX + rect.width / 2;
		tooltipY = rect.top + scrollY - 8;
		tooltipText = button.dataset.tooltip;
		showTooltip = true;
	}

	function handleTooltipHide() {
		showTooltip = false;
	}

	function handleDelete(id, itemName) {
		itemToDelete = { id, name: itemName };
		showDeleteConfirm = true;
	}

	function handleEdit(id, field, oldValue) {
		onEdit(id, field, oldValue);
	}

	async function confirmDelete() {
		const scrollPos = window.pageYOffset || document.documentElement.scrollTop;

		if (itemToDelete) {
			deletingItemId = itemToDelete.id;
			await onDelete(itemToDelete.id);
			deletingItemId = null;
		}
		showDeleteConfirm = false;
		itemToDelete = null;

		setTimeout(() => {
			window.scrollTo(0, scrollPos);
		}, 100);
	}

	function cancelDelete() {
		showDeleteConfirm = false;
		itemToDelete = null;
	}
</script>

<div class="table-wrapper">
	<div class="table-scroll">
		<table class="custom-table">
			<TableHeader {sortBy} {currentSortColumn} {sortAscending} />
			<tbody>
				<!--
					Keying on the search term rebuilds the each wholesale when the filter
					changes, so animate:flip never runs across a search. Without this, a
					search both removes non-matching rows and reorders kept ones; to FLIP the
					kept rows, Svelte pins the outroing rows with position: absolute, which
					blockifies the <tr> and collapses its columns for the animation's
					duration. Sort and delete keep the same key, so their flip/fade stay.

					The result set fades in as one unit: a single, fast, opacity-only fade on
					every row (no per-row stagger, no movement) reads as one container
					crossfade and keeps the layout perfectly stable — restrained motion that
					avoids the "many competing animations" mess. |global is required so the
					fade plays when the parent {#key} rebuilds (a local transition stays silent
					on a parent's re-creation). Sorting keeps the same key, so it animates via
					flip, not this fade.
				-->
				{#key searchKey}
					{#each visibleItems as item (item.id)}
						<tr
							class="table-row"
							in:fade|global={{ duration: motionDuration(300, prefersReducedMotion.current) }}
							out:fade={{ duration: rowExitDuration(isDeleting, prefersReducedMotion.current) }}
							animate:flip={{
								duration: motionDuration(250, prefersReducedMotion.current),
								easing: sineOut
							}}
						>
							<TableCell
								type="name"
								value={item.name}
								{item}
								onEdit={handleEdit}
								onDelete={handleDelete}
								onTooltipShow={handleTooltipShow}
								onTooltipHide={handleTooltipHide}
							/>
							<TableCell
								type="count"
								value={item.count}
								{item}
								onEdit={handleEdit}
								onDelete={handleDelete}
								onTooltipShow={handleTooltipShow}
								onTooltipHide={handleTooltipHide}
							/>
							<TableCell
								type="lowCount"
								value={item.lowCount}
								{item}
								onEdit={handleEdit}
								onDelete={handleDelete}
								onTooltipShow={handleTooltipShow}
								onTooltipHide={handleTooltipHide}
							/>
							<TableCell
								type="cost"
								value={item.cost}
								{item}
								onEdit={handleEdit}
								onDelete={handleDelete}
								onTooltipShow={handleTooltipShow}
								onTooltipHide={handleTooltipHide}
							/>
							<TableCell
								type="totalValue"
								value={item.totalValue}
								{item}
								onEdit={handleEdit}
								onDelete={handleDelete}
								onTooltipShow={handleTooltipShow}
								onTooltipHide={handleTooltipHide}
							/>
							<TableCell
								type="storageType"
								value={item.storageType}
								{item}
								onEdit={handleEdit}
								onDelete={handleDelete}
								onTooltipShow={handleTooltipShow}
								onTooltipHide={handleTooltipHide}
							/>
							<TableCell
								type="booths"
								value={item.booths}
								{item}
								onEdit={handleEdit}
								onDelete={handleDelete}
								onTooltipShow={handleTooltipShow}
								onTooltipHide={handleTooltipHide}
							/>
							<TableCell
								type="action"
								value=""
								{item}
								onEdit={handleEdit}
								onDelete={handleDelete}
								onTooltipShow={handleTooltipShow}
								onTooltipHide={handleTooltipHide}
							/>
						</tr>
					{/each}
				{/key}
			</tbody>
		</table>
	</div>
</div>

<Tooltip text={tooltipText} x={tooltipX} y={tooltipY} visible={showTooltip} />

<DeleteModal
	visible={showDeleteConfirm}
	itemName={itemToDelete?.name || ''}
	onConfirm={confirmDelete}
	onCancel={cancelDelete}
/>

<style>
	.table-wrapper {
		position: relative;
		width: 100%;
		overflow: hidden;
	}

	.table-scroll {
		width: 100%;
		overflow-x: auto;
		overflow-y: scroll;
		max-height: 41.9rem;
		min-height: 18.8rem;
		will-change: scroll-position;
		transform: translateZ(0);
		-webkit-overflow-scrolling: touch;
		padding-right: 0;
	}

	.custom-table {
		border-collapse: separate;
		border-spacing: 0;
		width: 100%;
		table-layout: fixed;
		min-width: 60rem;
	}

	.custom-table tbody tr {
		background-color: var(--container-bg);
		transition: background-color 0.15s ease-out;
	}

	.custom-table tbody tr:hover {
		background-color: var(--table-row-hover-bg);
	}

	@media (max-width: 48rem) {
		.table-scroll {
			padding-right: 0;
		}

		.custom-table {
			min-width: auto;
		}

		.custom-table :global(thead) {
			display: none;
		}

		.custom-table,
		.custom-table :global(tbody),
		.custom-table :global(tr),
		.custom-table :global(td) {
			width: 100%;
		}

		.custom-table :global(tr) {
			display: flex;
			flex-direction: column;
			margin-bottom: 1rem;
			border: 0.063rem solid var(--table-border-color);
			border-radius: 0.5rem;
			overflow: hidden;
			padding: 0.75rem;
			gap: 0.5rem;
			background-color: var(--container-bg);
		}

		.custom-table :global(td:last-child) {
			border-bottom: none;
		}
	}
</style>
