<script>
	import { fade, fly } from 'svelte/transition';
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
		sortAscending
	} = $props();

	let hoveredButton = $state(null);
	let deletingItemId = $state(null);
	let tooltipStyle = $state('');
	let showDeleteConfirm = $state(false);
	let itemToDelete = $state(null);
	let deleteButtonPosition = $state({ x: 0, y: 0 });
	let editButtonPosition = $state({ x: 0, y: 0 });
	let tooltipText = $state('');
	let tooltipX = $state(0);
	let tooltipY = $state(0);
	let showTooltip = $state(false);

	function handleTooltipShow(event) {
		const button = event.currentTarget;
		hoveredButton = button;
		const rect = button.getBoundingClientRect();
		const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
		const scrollY = window.pageYOffset || document.documentElement.scrollTop;
		
		tooltipX = rect.left + scrollX + rect.width / 2;
		tooltipY = rect.top + scrollY - 8;
		tooltipText = button.dataset.tooltip;
		showTooltip = true;
	}

	function handleTooltipHide() {
		hoveredButton = null;
		showTooltip = false;
	}

	function handleDelete(id, itemName, position) {
		itemToDelete = { id, name: itemName };
		deleteButtonPosition = position;
		showDeleteConfirm = true;
	}

	function handleEdit(id, field, oldValue, position) {
		editButtonPosition = position;
		onEdit(id, field, oldValue, position);
	}

	async function confirmDelete() {
		// Preserve scroll position during delete
		const scrollPos = window.pageYOffset || document.documentElement.scrollTop;
		
		if (itemToDelete) {
			deletingItemId = itemToDelete.id;
			await onDelete(itemToDelete.id);
			deletingItemId = null;
		}
		showDeleteConfirm = false;
		itemToDelete = null;
		
		// Restore scroll position after delete
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
				{#each paginatedItems as item (item.id)}
					{#if item.id !== deletingItemId}
						<tr class="table-row" in:fly={{ y: 20, duration: 300 }} out:fade={{ duration: 300 }}>
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
					{/if}
				{/each}
			</tbody>
		</table>
	</div>
</div>

<Tooltip
	text={tooltipText}
	x={tooltipX}
	y={tooltipY}
	visible={showTooltip}
/>

<DeleteModal
	visible={showDeleteConfirm}
	itemName={itemToDelete?.name || ''}
	position={deleteButtonPosition}
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
		table-layout: auto;
		min-width: 60rem;
	}

	.custom-table tbody tr {
		background-color: var(--container-bg);
		transition: background-color 0.3s ease;
	}

	.custom-table tbody tr:hover {
		background-color: var(--table-row-hover-bg);
	}

	/* Responsive adjustments for smaller screens */
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
