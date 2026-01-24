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
				onclick={() => handleSort(column.name)}
			>
				<div class="header-content {column.name === '' ? 'justify-center' : ''}">
					{#if column.name}
						<span class="header-text">{getColumnDisplayName(column.name)}</span>
						<i
							class="fas fa-sort{currentSortColumn === column.name
								? sortAscending
									? '-up'
									: '-down'
								: ''} sort-icon"
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
		background: var(--tech-header-bg);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		z-index: 20;
		padding: 1.1rem 1.25rem;
		text-align: left;
		font-family: 'Inter', sans-serif;
		font-weight: 700;
		color: var(--tech-header-text);
		text-transform: uppercase;
		font-size: 0.7rem;
		letter-spacing: 0.1em;
		cursor: pointer;
		border-bottom: 1px solid var(--tech-cell-border);
		transition: color 0.2s;
	}

	.table-header th:hover {
		color: var(--tech-accent);
	}

	.header-content {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		white-space: nowrap;
		position: relative;
	}

	.header-text {
		position: relative;
		z-index: 1;
	}

	.sort-icon {
		font-size: 0.75rem;
		color: var(--tech-accent);
		opacity: 0.4;
		transition: all 0.2s;
	}

	.table-header th:hover .sort-icon {
		opacity: 1;
	}

	.justify-center {
		justify-content: center;
	}

	/* Specific column styles */
	.count-col, .lowCount-col, .cost-col, .totalValue-col {
		text-align: center;
	}

	.count-col .header-content,
	.lowCount-col .header-content,
	.cost-col .header-content,
	.totalValue-col .header-content {
		justify-content: center;
	}
</style>