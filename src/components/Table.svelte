<script lang="ts">
	export let paginatedItems = [];
	export let onEdit;
	export let onDelete;
	export let sortBy;
	export let sortIcon;
</script>

<table class="custom-table table-auto w-full border-collapse">
	<thead>
		<tr class="table-header">
			<th class="px-4 py-2 text-left" on:click={() => sortBy('name')}>
				Name <span>{sortIcon('name')}</span>
			</th>
			<th class="px-4 py-2 text-left" on:click={() => sortBy('barcode')}>
				Barcode <span>{sortIcon('barcode')}</span>
			</th>
			<th class="px-4 py-2 text-left" on:click={() => sortBy('count')}>
				Count <span>{sortIcon('count')}</span>
			</th>
			<th class="px-4 py-2 text-left" on:click={() => sortBy('lowCount')}>
				Low Count <span>{sortIcon('lowCount')}</span>
			</th>
			<th class="px-4 py-2 text-left" on:click={() => sortBy('cost')}>
				Cost <span>{sortIcon('cost')}</span>
			</th>
			<th class="px-4 py-2 text-left" on:click={() => sortBy('storageType')}>
				Storage Type <span>{sortIcon('storageType')}</span>
			</th>
			<th class="px-4 py-2"></th>
		</tr>
	</thead>
	<tbody>
		{#each paginatedItems as item (item.id)}
			<tr class="table-row">
				<td class="px-4 py-2">
					<div class="cell-content">
						<span>{item.name}</span>
						<button
							class="icon-button"
							title="Edit Name"
							on:click={() => onEdit(item.id, 'name', item.name)}
							aria-label="Edit Name"
						>
							<i class="fas fa-edit"></i>
						</button>
					</div>
				</td>
				<td class="px-4 py-2">
					<div class="cell-content">
						<span>{item.barcode}</span>
						<button
							class="icon-button"
							title="Edit Barcode"
							on:click={() => onEdit(item.id, 'barcode', item.barcode)}
							aria-label="Edit Barcode"
						>
							<i class="fas fa-edit"></i>
						</button>
					</div>
				</td>
				<td class="px-4 py-2">{item.count}</td>
				<td class="px-4 py-2">
					<div class="cell-content">
						<span>{item.lowCount != null ? item.lowCount : ''}</span>
						<button
							class="icon-button"
							title="Edit Low Count"
							on:click={() => onEdit(item.id, 'lowCount', item.lowCount)}
							aria-label="Edit Low Count"
						>
							<i class="fas fa-edit"></i>
						</button>
					</div>
				</td>
				<td class="px-4 py-2">
					<div class="cell-content">
						<span>{item.cost != null ? item.cost : ''}</span>
						<button
							class="icon-button"
							title="Edit Cost"
							on:click={() => onEdit(item.id, 'cost', item.cost)}
							aria-label="Edit Cost"
						>
							<i class="fas fa-edit"></i>
						</button>
					</div>
				</td>
				<td class="px-4 py-2">
					<div class="cell-content">
						<span>{item.storageType}</span>
						<button
							class="icon-button"
							title="Edit Storage Type"
							on:click={() => onEdit(item.id, 'storageType', item.storageType)}
							aria-label="Edit Storage Type"
						>
							<i class="fas fa-edit"></i>
						</button>
					</div>
				</td>
				<td class="px-4 py-2 text-center">
					<button
						class="delete-button"
						title="Delete Item"
						on:click={() => onDelete(item.id)}
						aria-label="Delete Item"
					>
						<i class="fas fa-trash-alt"></i>
					</button>
				</td>
			</tr>
		{/each}
	</tbody>
</table>

<style>
	.custom-table th,
	.custom-table td {
		padding: 0.75rem;
		text-align: left;
	}

	.custom-table th {
		border-bottom: 2px solid var(--table-border-color);
	}

	.custom-table td {
		border-bottom: 1px solid var(--table-border-color);
	}

	.cell-content {
		display: flex;
		justify-content: space-between;
		align-items: center;
		position: relative;
	}

	/* Initially hide the icons */
	.icon-button,
	.delete-button {
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		display: flex;
		align-items: center;
		color: var(--icon-color);
		transition: transform 0.2s ease-in-out;
		opacity: 0; /* Hide icons by default */
		pointer-events: none; /* Prevent interaction with hidden icons */
	}

	/* Visual indication for row hover */
	.table-row:hover {
		background-color: var(--hover-bg-color); /* Add row hover background color */
		transition: background-color 0.3s ease;
	}

	/* Show icons on row hover */
	.table-row:hover .icon-button,
	.table-row:hover .delete-button {
		opacity: 1;
		pointer-events: all; /* Allow interaction when visible */
	}

	/* Icon and button hover effect */
	.icon-button:hover,
	.delete-button:hover {
		color: var(--icon-hover-color);
		transform: scale(1.1);
	}

	.delete-button {
		color: darkred;
	}

	.delete-button:hover {
		color: red;
	}

	/* Tooltip styling for icons */
	.icon-button[title]::after,
	.delete-button[title]::after {
		content: attr(title);
		position: absolute;
		font-size: 0.75rem;
		left: 50%;
		bottom: 100%;
		transform: translateX(-50%);
		background: rgba(0, 0, 0, 0.75);
		color: #fff;
		padding: 0.5rem;
		border-radius: 0.25rem;
		white-space: nowrap;
		opacity: 0;
		transition: opacity 0.2s ease-in-out;
		pointer-events: none;
	}

	.icon-button:hover[title]::after,
	.delete-button:hover[title]::after {
		opacity: 1;
	}

	/* Fixed height table styles */
	.fixed-height-table {
		height: 35rem;
		overflow-y: auto;
		display: block;
	}

	.fixed-height-table table {
		width: 100%;
		border-collapse: collapse;
	}
</style>
