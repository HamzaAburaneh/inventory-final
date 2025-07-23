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

	async function handleDelete(id) {
		deletingItemId = id;
		await onDelete(id);
		deletingItemId = null;
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
					{#each ['name', 'barcode', 'count', 'lowCount', 'cost', 'storageType', ''] as column, i}
						<th class="{column}-col" onclick={() => column && sortBy(column)}>
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
										onclick={() => onEdit(item.id, 'name', item.name)}
										onmouseenter={showTooltip}
										onmouseleave={hideTooltip}
									>
										<i class="fas fa-edit"></i>
									</button>
								</div>
							</td>
							<td class="barcode-col" data-label="Barcode">
								<div class="cell-content">
									<span>{item.barcode}</span>
									<button
										class="icon-button"
										data-tooltip="Edit Barcode"
										aria-label="Edit Barcode"
										onclick={() => onEdit(item.id, 'barcode', item.barcode)}
										onmouseenter={showTooltip}
										onmouseleave={hideTooltip}
									>
										<i class="fas fa-edit"></i>
									</button>
								</div>
							</td>
							<td class="count-col" data-label="Count">{item.count}</td>
							<td class="lowcount-col" data-label="Low Count">
								<div class="cell-content">
									<span>{item.lowCount != null ? item.lowCount : ''}</span>
									<button
										class="icon-button"
										data-tooltip="Edit Low Count"
										aria-label="Edit Low Count"
										onclick={() => onEdit(item.id, 'lowCount', item.lowCount)}
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
										onclick={() => onEdit(item.id, 'cost', item.cost)}
										onmouseenter={showTooltip}
										onmouseleave={hideTooltip}
									>
										<i class="fas fa-edit"></i>
									</button>
								</div>
							</td>
							<td class="storage-col" data-label="Storage Type">
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
										onclick={() => onEdit(item.id, 'storageType', item.storageType)}
										onmouseenter={showTooltip}
										onmouseleave={hideTooltip}
									>
										<i class="fas fa-edit"></i>
									</button>
								</div>
							</td>
							<td class="action-col" data-label="Actions">
								<button
									class="delete-button"
									data-tooltip="Delete Item"
									aria-label="Delete Item"
									onclick={() => handleDelete(item.id)}
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
		background-color: var(--container-bg);
		z-index: 10;
		box-shadow: 0 2px 2px -1px rgba(0, 0, 0, 0.4);
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
		transition: color 0.3s ease;
	}

	.header i {
		margin-left: 0.5rem;
		font-size: 0.8em;
		transition: transform 0.3s ease;
	}

	.header:hover {
		color: var(--icon-hover-color);
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

	/* Fixed column widths */
	.name-col {
		width: 20%;
		min-width: min(180px, 25vw);
	}
	.barcode-col {
		width: 15%;
		min-width: min(150px, 20vw);
	}
	.count-col {
		width: 8%;
		min-width: min(80px, 15vw);
	}
	.lowcount-col {
		width: 8%;
		min-width: min(100px, 15vw);
	}
	.cost-col {
		width: 12%;
		min-width: min(100px, 18vw);
	}
	.storage-col {
		width: 12%;
		min-width: min(150px, 20vw);
	}
	.action-col {
		width: 15%;
		min-width: min(120px, 20vw);
	}

	.tooltip {
		position: fixed;
		background-color: #333;
		color: white;
		padding: 8px 12px;
		border-radius: 6px;
		font-size: 14px;
		z-index: 1000;
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
		}

		.custom-table td {
			text-align: right;
			padding-left: 50%;
			position: relative;
			border-bottom: 1px solid var(--table-border-color);
		}

		.custom-table td:last-child {
			border-bottom: none;
		}

		.custom-table td::before {
			content: attr(data-label);
			position: absolute;
			left: 0;
			width: 45%;
			padding-left: 1rem;
			font-weight: bold;
			text-align: left;
			white-space: nowrap;
		}

		.action-col {
			text-align: center;
			padding: 1rem;
		}

		.cell-content {
			justify-content: flex-end;
		}

		.icon-button,
		.delete-button {
			opacity: 1;
		}
	}
</style>
