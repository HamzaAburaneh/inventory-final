<script>
	import { TABLE_COLUMNS, getColumnDisplayName } from '../lib/tableUtils.js';

	let { 
		sortBy, 
		currentSortColumn, 
		sortAscending 
	} = $props();

	function handleSort(columnName) {
		if (columnName) {
			// Preserve scroll position during sorting
			const scrollPos = window.pageYOffset || document.documentElement.scrollTop;
			sortBy(columnName);
			setTimeout(() => {
				window.scrollTo(0, scrollPos);
			}, 50);
		}
	}
</script>

<thead>
	<tr class="table-header">
		{#each TABLE_COLUMNS as column, i}
			<th
				class="{column.name}-col"
				style="width: {column.width}; min-width: {column.minWidth}; max-width: {column.name === '' ? '2.2rem' : 'none'};"
				onclick={() => handleSort(column.name)}
			>
				<div class="header">
					{#if column.name}
						{getColumnDisplayName(column.name)}
						<i
							class="fas fa-sort{currentSortColumn === column.name
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

<style>
	.table-header th {
		position: sticky;
		top: 0;
		background-color: var(--table-header-bg);
		z-index: 10;
		box-shadow: 0 0.063rem 0.188rem rgba(0, 0, 0, 0.2);
		color: var(--nav-logo-color);
		font-weight: 600;
		will-change: transform;
		transform: translateZ(0);
		overflow: visible !important;
		text-overflow: unset !important;
		white-space: nowrap !important;
		padding: 0.5rem;
		text-align: left;
		border-bottom: 0.063rem solid var(--table-border-color);
	}

	.header {
		display: flex;
		align-items: center;
		cursor: pointer;
		transition: all 0.3s ease;
		overflow: visible !important;
		white-space: nowrap !important;
		min-width: max-content;
	}

	.header i {
		margin-left: 0.5rem;
		font-size: 0.8em;
		transition: transform 0.3s ease;
		flex-shrink: 0;
		min-width: 1rem;
	}

	.header:hover {
		color: var(--icon-hover-color);
		transform: scale(1.05);
	}

	.header:hover i {
		transform: scale(1.2);
	}
</style>