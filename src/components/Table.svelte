<script>
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import { flip } from 'svelte/animate';
	import { cubicIn, cubicOut } from 'svelte/easing';
	import { prefersReducedMotion } from 'svelte/motion';
	import { motionDuration, rowExitDuration, isLowStock } from '../lib/tableUtils.js';
	import TableHeader from './TableHeader.svelte';
	import TableCell from './TableCell.svelte';
	import ItemCardMobile from './ItemCardMobile.svelte';
	import DeleteModal from './DeleteModal.svelte';
	import Tooltip from './Tooltip.svelte';

	let {
		paginatedItems = [],
		onEdit,
		onDelete,
		boothsById = {},
		sortBy,
		currentSortColumn,
		sortAscending
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

	// Stagger the 10px-rise entrance only on the initial mount; rows entering
	// later (search matches, page flips) crossfade in place instead (see the
	// {#each} comment).
	let mounted = $state(false);
	onMount(() => {
		mounted = true;
	});

	function handleTooltipShow(event) {
		// Hover tooltips don't make sense on touch screens — mouseenter fires on
		// tap but mouseleave never comes, leaving the tooltip stuck on screen.
		if (window.matchMedia('(hover: none)').matches) return;
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
					Rows persist across searches — the each is keyed by item id only, so a
					row that keeps matching never re-renders or re-animates while you type:
					it either stays perfectly still or glides to its new position via
					animate:flip. Rows that stop matching leave in 0ms (rowExitDuration —
					a visible exit would make Svelte pin the outroing <tr> with
					position: absolute, blockifying it and collapsing its columns mid-flip)
					and new matches fade in place. Sorting reorders via the same flip.
					Deletes are the only animated exit (sink + fade, ease-in).

					Motion system: "soft rise" — on first load rows fade in while rising
					10px into place (ease-out), staggered 45ms apart (capped at 450ms).
					After mount, entering rows crossfade in place (y: 0, 150ms) so each
					keystroke reads as a calm incremental change. |global is required so
					the entrance plays on initial load, when the rows are created together
					with the parent {#if itemsLoaded} block (a local transition stays
					silent on a parent's creation).
				-->
				{#each visibleItems as item, i (item.id)}
					<tr
						class="table-row"
						class:is-low={isLowStock(item)}
						in:fly|global={{
							y: mounted ? 0 : 10,
							duration: motionDuration(mounted ? 150 : 260, prefersReducedMotion.current),
							delay: mounted || prefersReducedMotion.current ? 0 : Math.min(i * 45, 450)
						}}
						out:fly={{
							y: 10,
							duration: rowExitDuration(isDeleting, prefersReducedMotion.current),
							easing: cubicIn
						}}
						animate:flip={{
							duration: (d) =>
								prefersReducedMotion.current ? 0 : Math.min(Math.sqrt(d) * 30, 300),
							easing: cubicOut
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
							{boothsById}
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
			</tbody>
		</table>
	</div>

	<!--
		Mobile card list (shown below the 48rem breakpoint; the table above is
		hidden there). Same keyed `visibleItems` and motion system as the desktop
		rows — soft rise on first mount, crossfade for later matches, flip on
		reorder, animated sink only on delete.
	-->
	<div class="mobile-cards">
		{#each visibleItems as item, i (item.id)}
			<div
				class="mobile-card-wrap"
				in:fly|global={{
					y: mounted ? 0 : 10,
					duration: motionDuration(mounted ? 150 : 260, prefersReducedMotion.current),
					delay: mounted || prefersReducedMotion.current ? 0 : Math.min(i * 45, 450)
				}}
				out:fly={{
					y: 10,
					duration: rowExitDuration(isDeleting, prefersReducedMotion.current),
					easing: cubicIn
				}}
				animate:flip={{
					duration: (d) => (prefersReducedMotion.current ? 0 : Math.min(Math.sqrt(d) * 30, 300)),
					easing: cubicOut
				}}
			>
				<ItemCardMobile {item} {boothsById} onEdit={handleEdit} onDelete={handleDelete} />
			</div>
		{/each}
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
		/* Keep row-glide repaints contained to the scroller instead of the page. */
		contain: paint;
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

	/* Low-stock rows get a red left accent + subtle tint. */
	.custom-table tbody tr.is-low {
		background-color: color-mix(in srgb, #ef4444 7%, var(--container-bg));
	}

	.custom-table tbody tr.is-low:hover {
		background-color: color-mix(in srgb, #ef4444 12%, var(--container-bg));
	}

	.custom-table tbody tr.is-low :global(td:first-child) {
		box-shadow: inset 3px 0 0 #ef4444;
	}

	:global([data-theme='dark']) .custom-table tbody tr.is-low {
		background-color: color-mix(in srgb, #f87171 7%, var(--container-bg));
	}

	:global([data-theme='dark']) .custom-table tbody tr.is-low:hover {
		background-color: color-mix(in srgb, #f87171 12%, var(--container-bg));
	}

	:global([data-theme='dark']) .custom-table tbody tr.is-low :global(td:first-child) {
		box-shadow: inset 3px 0 0 #f87171;
	}

	/* Mobile card list — hidden on desktop, where the table above is used. */
	.mobile-cards {
		display: none;
	}

	@media (max-width: 48rem) {
		.table-scroll {
			display: none;
		}

		.mobile-cards {
			display: flex;
			flex-direction: column;
			gap: 0.75rem;
			padding: 0.75rem;
		}
	}
</style>
