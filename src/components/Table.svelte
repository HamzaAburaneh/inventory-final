<script>
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
		loading = false
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
		<table class="tech-table">
			<TableHeader {sortBy} {currentSortColumn} {sortAscending} />
			<tbody class="table-body-transition" class:loading-fade={loading}>
				{#each paginatedItems as item (item.id)}
					{#if item.id !== deletingItemId}
						<tr class="table-row">
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

<Tooltip text={tooltipText} x={tooltipX} y={tooltipY} visible={showTooltip} />

<DeleteModal
	visible={showDeleteConfirm}
	itemName={itemToDelete?.name || ''}
	position={deleteButtonPosition}
	onConfirm={confirmDelete}
	onCancel={cancelDelete}
/>

<style>
	.table-wrapper {
		width: 100%;
	}

	.table-scroll {
		width: 100%;
		overflow-x: auto;
		overflow-y: auto;
		max-height: 70vh;
		min-height: 400px;
		scrollbar-width: thin;
		scrollbar-color: var(--tech-scrollbar-thumb) transparent;
	}

	.table-scroll::-webkit-scrollbar {
		width: 6px;
		height: 6px;
	}

	.table-scroll::-webkit-scrollbar-thumb {
		background: var(--tech-scrollbar-thumb);
	}

	.tech-table {
		width: 100%;
		border-collapse: collapse;
	}

	.table-body-transition {
		transition: opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1), filter 0.4s ease;
	}

	.loading-fade {
		opacity: 0.2;
		filter: blur(2px);
		pointer-events: none;
	}

	.table-row {
		background: transparent;
		transition: background-color 0.2s ease;
	}

	.table-row:nth-child(even) {
		background: var(--tech-row-stripe);
	}

	.table-row:hover {
		background: var(--tech-row-hover);
	}

	@media (max-width: 768px) {
		.tech-table thead {
			display: none;
		}
	}
</style>
