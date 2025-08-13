<script>
	import { fade, fly } from 'svelte/transition';

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

	function showTooltip(event) {
		const button = event.currentTarget;
		hoveredButton = button;
		const rect = button.getBoundingClientRect();
		const left = rect.left + rect.width / 2;
		const top = rect.top - 8;
		tooltipStyle = `left: ${left}px; top: ${top}px;`;
	}

	function hideTooltip() {
		hoveredButton = null;
	}

	function handleDelete(id, itemName) {
		itemToDelete = { id, name: itemName };
		showDeleteConfirm = true;
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

	function capitalizeWords(str) {
		return str
			.split(' ')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');
	}

	function getStorageTypeStyle(storageType) {
		switch (storageType.toLowerCase()) {
			case 'freezer':
				return { backgroundColor: '#1E3A8A', color: '#BFDBFE' }; // Dark blue background, light blue text
			case 'dry storage':
				return { backgroundColor: '#92400E', color: '#FDE68A' }; // Brown background, light yellow text
			case 'refrigerator':
				return { backgroundColor: '#065F46', color: '#A7F3D0' }; // Dark green background, light green text
			default:
				return { backgroundColor: '#374151', color: '#E5E7EB' }; // Dark gray background, light gray text
		}
	}

	function formatCost(cost) {
		return cost != null ? `$ ${cost.toFixed(2)}` : '';
	}
</script>

<div class="table-wrapper">
	<div class="table-scroll">
		<table class="custom-table">
			<thead>
				<tr class="table-header">
					{#each ['name', 'count', 'lowCount', 'cost', 'storageType', ''] as column, i}
						<th class="{column}-col" onclick={() => {
							if (column) {
								// Preserve scroll position during sorting
								const scrollPos = window.pageYOffset || document.documentElement.scrollTop;
								sortBy(column);
								setTimeout(() => {
									window.scrollTo(0, scrollPos);
								}, 50);
							}
						}}>
							<div class="header">
								{#if column}
									{column.charAt(0).toUpperCase() + column.slice(1)}
									<i
										class="fas fa-sort{currentSortColumn === column
											? sortAscending
												? '-up'
												: '-down'
											: ''}"
									></i>
								{/if}
							</div>
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each paginatedItems as item (item.id)}
					{#if item.id !== deletingItemId}
						<tr class="table-row" in:fly={{ y: 20, duration: 300 }} out:fade={{ duration: 300 }}>
							<td class="name-col" data-label="Name">
								<div class="cell-content">
									<span>{item.name}</span>
									<button
										class="icon-button"
										data-tooltip="Edit Name"
										aria-label="Edit Name"
										onclick={(e) => {
											e.preventDefault();
											e.stopPropagation();
											onEdit(item.id, 'name', item.name);
										}}
										onmouseenter={showTooltip}
										onmouseleave={hideTooltip}
									>
										<i class="fas fa-edit"></i>
									</button>
								</div>
							</td>
							<td class="count-col" data-label="Count">
								<div class="cell-content">
									<span>{item.count}</span>
									<button class="icon-button" style="opacity: 0; pointer-events: none;" aria-hidden="true">
										<i class="fas fa-edit"></i>
									</button>
								</div>
							</td>
							<td class="lowcount-col" data-label="Low Count">
								<div class="cell-content">
									<span>{item.lowCount != null ? item.lowCount : ''}</span>
									<button
										class="icon-button"
										data-tooltip="Edit Low Count"
										aria-label="Edit Low Count"
										onclick={(e) => {
											e.preventDefault();
											e.stopPropagation();
											onEdit(item.id, 'lowCount', item.lowCount);
										}}
										onmouseenter={showTooltip}
										onmouseleave={hideTooltip}
									>
										<i class="fas fa-edit"></i>
									</button>
								</div>
							</td>
							<td class="cost-col" data-label="Cost">
								<div class="cell-content">
									<span>{formatCost(item.cost)}</span>
									<button
										class="icon-button"
										data-tooltip="Edit Cost"
										aria-label="Edit Cost"
										onclick={(e) => {
											e.preventDefault();
											e.stopPropagation();
											onEdit(item.id, 'cost', item.cost);
										}}
										onmouseenter={showTooltip}
										onmouseleave={hideTooltip}
									>
										<i class="fas fa-edit"></i>
									</button>
								</div>
							</td>
							<td class="storage-col" data-label="Type">
								<div class="cell-content">
									<span
										class="storage-type"
										style="background-color: {getStorageTypeStyle(item.storageType)
											.backgroundColor}; color: {getStorageTypeStyle(item.storageType).color};"
									>
										{capitalizeWords(item.storageType)}
									</span>
									<button
										class="icon-button"
										data-tooltip="Edit Storage Type"
										aria-label="Edit Storage Type"
										onclick={(e) => {
											e.preventDefault();
											e.stopPropagation();
											onEdit(item.id, 'storageType', item.storageType);
										}}
										onmouseenter={showTooltip}
										onmouseleave={hideTooltip}
									>
										<i class="fas fa-edit"></i>
									</button>
								</div>
							</td>
							<td class="action-col" data-label="">
								<button
									class="delete-button"
									data-tooltip="Delete Item"
									aria-label="Delete Item"
									onclick={() => handleDelete(item.id, item.name)}
									onmouseenter={showTooltip}
									onmouseleave={hideTooltip}
								>
									<i class="fas fa-trash-alt"></i>
								</button>
							</td>
						</tr>
					{/if}
				{/each}
			</tbody>
		</table>
	</div>
</div>

{#if hoveredButton}
	<div class="tooltip" style={tooltipStyle} in:fly={{ y: 10, duration: 200 }} out:fade={{ duration: 200 }}>
		{hoveredButton.dataset.tooltip}
	</div>
{/if}

{#if showDeleteConfirm}
	<div class="modal-overlay" in:fade={{ duration: 200 }} out:fade={{ duration: 200 }}>
		<div class="delete-modal" in:fly={{ y: 50, duration: 300 }} out:fly={{ y: 50, duration: 300 }}>
			<h3>Delete Item</h3>
			<p>Are you sure you want to delete <strong>"{itemToDelete?.name}"</strong>?</p>
			<p class="warning">This action cannot be undone.</p>
			<div class="modal-buttons">
				<button class="cancel-btn" onclick={cancelDelete}>Cancel</button>
				<button class="confirm-btn" onclick={confirmDelete}>Delete</button>
			</div>
		</div>
	</div>
{/if}

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
		max-height: 670px; /* Or a suitable max-height */
		min-height: 300px; /* A more flexible min-height */
	}

	.custom-table {
		border-collapse: separate;
		border-spacing: 0;
		width: 100%;
		table-layout: fixed;
	}

	.custom-table th,
	.custom-table td {
		padding: 0.75rem;
		text-align: left;
		border-bottom: 1px solid var(--table-border-color);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.custom-table th {
		position: sticky;
		top: 0;
		background-color: var(--table-header-bg);
		z-index: 10;
		box-shadow: 0 2px 2px -1px rgba(0, 0, 0, 0.4);
		color: var(--nav-logo-color);
		font-weight: 600;
	}

	.custom-table tbody tr {
		background-color: var(--container-bg);
		transition: background-color 0.3s ease;
	}

	.custom-table tbody tr:hover {
		background-color: var(--table-row-hover-bg);
	}

	.header {
		display: flex;
		align-items: center;
		cursor: pointer;
		transition: all 0.3s ease;
	}

	.header i {
		margin-left: 0.5rem;
		font-size: 0.8em;
		transition: transform 0.3s ease;
	}

	.header:hover {
		color: var(--icon-hover-color);
		transform: scale(1.05);
	}

	.header:hover i {
		transform: scale(1.2);
	}

	.cell-content {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.icon-button,
	.delete-button {
		background: none;
		border: none;
		cursor: pointer;
		opacity: 0;
		transition:
			opacity 0.2s ease-in-out,
			color 0.2s ease-in-out,
			transform 0.2s ease;
	}

	.table-row:hover .icon-button,
	.table-row:hover .delete-button {
		opacity: 1;
	}

	.icon-button:hover,
	.delete-button:hover {
		color: var(--icon-hover-color);
		transform: scale(1.2);
	}

	.delete-button {
		color: darkred;
	}

	.delete-button:hover {
		color: red;
	}

	/* Optimized column widths after barcode removal */
	.name-col {
		width: 30%;
		min-width: min(200px, 30vw);
	}
	.count-col {
		width: 12%;
		min-width: min(100px, 15vw);
	}
	.lowcount-col {
		width: 15%;
		min-width: min(120px, 18vw);
	}
	.cost-col {
		width: 15%;
		min-width: min(120px, 18vw);
	}
	.storage-col {
		width: 20%;
		min-width: min(160px, 22vw);
	}
	.action-col {
		width: 8%;
		min-width: min(80px, 12vw);
	}

	.tooltip {
		position: fixed;
		background-color: #333;
		color: white;
		padding: 8px 12px;
		border-radius: 6px;
		font-size: 14px;
		z-index: 2000;
		pointer-events: none;
		transform: translate(-50%, -100%);
		transition:
			opacity 0.2s,
			transform 0.2s;
		white-space: nowrap;
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
	}

	.storage-type {
		padding: 6px 14px;
		border-radius: 20px;
		font-size: 0.9rem;
		font-weight: 600;
		background-color: #f8f9fa; /* Light background for contrast */
		color: #333; /* Darker text for readability */
		box-shadow:
			0 4px 8px rgba(0, 0, 0, 0.15),
			0 1px 3px rgba(0, 0, 0, 0.1); /* Softer, layered shadow */
		border: 1px solid rgba(0, 0, 0, 0.1); /* Optional subtle border */
		transition: all 0.2s ease-in-out; /* Smooth hover effect */
	}
	@media (max-width: 768px) {
		.custom-table thead {
			display: none;
		}

		.custom-table,
		.custom-table tbody,
		.custom-table tr,
		.custom-table td {
			width: 100%;
		}

		.custom-table tr {
			display: flex;
			flex-direction: column;
			margin-bottom: 1rem;
			border: 1px solid var(--table-border-color);
			border-radius: 8px;
			overflow: hidden;
			padding: 0.75rem;
			gap: 0.5rem;
			background-color: var(--container-bg);
		}

		.custom-table td {
			display: grid;
			grid-template-columns: 80px 1fr 40px;
			align-items: center;
			gap: 0.5rem;
			padding: 0.25rem 0;
			border: none;
			border-bottom: 1px solid rgba(255, 255, 255, 0.1);
			font-size: 0.9rem;
		}

		.custom-table td:last-child {
			border-bottom: none;
		}

		.custom-table td::before {
			content: attr(data-label) ": ";
			font-weight: bold;
			color: var(--text-color);
			grid-column: 1;
		}

		.cell-content {
			grid-column: 2 / 4;
			display: flex;
			justify-content: space-between;
			align-items: center;
			gap: 0.5rem;
		}

		.cell-content span {
			text-align: center;
			flex: 1;
		}



		/* Special handling for action column - center delete button across all columns */
		.action-col {
			display: flex !important;
			justify-content: center;
			align-items: center;
			grid-template-columns: none;
		}

		.action-col::before {
			display: none;
		}

		.action-col .delete-button {
			font-size: 1.2rem;
			padding: 0.75rem;
			color: #ff4444;
			background-color: rgba(255, 68, 68, 0.1);
			border-radius: 8px;
			transition: all 0.2s ease;
		}

		.action-col .delete-button:hover {
			color: #ff0000;
			background-color: rgba(255, 68, 68, 0.2);
			transform: scale(1.1);
		}

		.icon-button,
		.delete-button {
			opacity: 1;
			font-size: 0.9rem;
			padding: 0.3rem;
			margin-left: 0.5rem;
		}

		.storage-type {
			font-size: 0.8rem;
			padding: 4px 10px;
		}

		/* Better visual separation */
		.custom-table td {
			position: relative;
		}
	}

	/* Mobile-friendly delete confirmation modal */
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background-color: rgba(0, 0, 0, 0.5);
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 5000;
	}

	.delete-modal {
		background-color: var(--container-bg);
		border-radius: 12px;
		padding: 2rem;
		margin: 1rem;
		max-width: 400px;
		width: 90%;
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
		border: 1px solid var(--table-border-color);
	}

	.delete-modal h3 {
		margin: 0 0 1rem 0;
		color: var(--text-color);
		font-size: 1.25rem;
	}

	.delete-modal p {
		margin: 0 0 1rem 0;
		color: var(--text-color);
		line-height: 1.5;
	}

	.delete-modal .warning {
		color: #ff6b6b;
		font-weight: 600;
		font-size: 0.9rem;
	}

	.modal-buttons {
		display: flex;
		gap: 1rem;
		margin-top: 1.5rem;
	}

	.modal-buttons button {
		flex: 1;
		padding: 0.75rem 1rem;
		border: none;
		border-radius: 8px;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.cancel-btn {
		background-color: var(--table-border-color);
		color: var(--text-color);
	}

	.cancel-btn:hover {
		background-color: var(--hover-bg-color);
	}

	.confirm-btn {
		background-color: #ff4444;
		color: white;
	}

	.confirm-btn:hover {
		background-color: #ff0000;
		transform: translateY(-1px);
	}
</style>
