<script>
	import TableHeader from './TableHeader.svelte';
	import TableCell from './TableCell.svelte';
	import Tooltip from './Tooltip.svelte';
	import InventoryMobileCard from './InventoryMobileCard.svelte';

	let {
		paginatedItems = [],
		onEdit,
		onDelete,
		sortBy,
		currentSortColumn,
		sortAscending,
		loading = false
	} = $props();

	let isMobile = $state(false);

	// Detect mobile viewport
	$effect(() => {
		const checkMobile = () => {
			isMobile = window.innerWidth <= 768;
		};
		
		checkMobile();
		window.addEventListener('resize', checkMobile);
		
		return () => {
			window.removeEventListener('resize', checkMobile);
		};
	});

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
		onDelete(id);
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
	{#if isMobile}
		<!-- Mobile Card View -->
		<div class="mobile-cards-container">
			{#each paginatedItems as item (item.id)}
				{#if item.id !== deletingItemId}
					<InventoryMobileCard
						{item}
						onEdit={handleEdit}
						onDelete={handleDelete}
						onTooltipShow={handleTooltipShow}
						onTooltipHide={handleTooltipHide}
					/>
				{/if}
			{/each}
		</div>
	{:else}
		<!-- Desktop Table View -->
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
	{/if}
</div>

<Tooltip text={tooltipText} x={tooltipX} y={tooltipY} visible={showTooltip} />


<style>
	.table-wrapper {
		width: 100%;
	}

	.mobile-cards-container {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 0;
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

	/* Fixed column widths to prevent layout shift */
	:global(.tech-table .name-col) {
		width: 18%;
		min-width: 150px;
	}

	:global(.tech-table .count-col) {
		width: 10%;
		min-width: 100px;
	}

	:global(.tech-table .lowCount-col) {
		width: 10%;
		min-width: 100px;
	}

	:global(.tech-table .cost-col) {
		width: 10%;
		min-width: 100px;
	}

	:global(.tech-table .totalValue-col) {
		width: 12%;
		min-width: 120px;
	}

	:global(.tech-table .storageType-col) {
		width: 14%;
		min-width: 130px;
	}

	:global(.tech-table .booths-col) {
		width: 16%;
		min-width: 140px;
	}

	:global(.tech-table .action-col) {
		width: 10%;
		min-width: 100px;
	}

	/* Mobile View - Hide desktop table */
	@media (max-width: 768px) {
		.table-scroll {
			display: none;
		}

		.mobile-cards-container {
			display: flex;
		}
	}

	/* Desktop View - Hide mobile cards */
	@media (min-width: 769px) {
		.mobile-cards-container {
			display: none;
		}
	}
</style>
