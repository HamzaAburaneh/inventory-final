<script>
	import { TABLE_COLUMNS, getColumnDisplayName } from '../lib/tableUtils.js';
	import Icon from './Icon.svelte';

	let { sortBy, currentSortColumn, sortAscending } = $props();

	function handleSort(columnName) {
		if (columnName) {
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
		{#each TABLE_COLUMNS as column (column.name)}
			<th
				class="{column.name}-col"
				style="width: {column.width}; min-width: {column.minWidth}; max-width: {column.name === ''
					? '2.2rem'
					: 'none'};"
				onclick={() => handleSort(column.name)}
			>
				<div class="header">
					{#if column.name}
						{#if column.icon}
							<Icon name={column.icon} size={14} class="header-col-icon shrink-0" />
						{/if}
						<span class="header-label">{getColumnDisplayName(column.name)}</span>
						<span
							class="sort-icon"
							class:active={currentSortColumn === column.name}
							class:asc={currentSortColumn === column.name && sortAscending}
							class:desc={currentSortColumn === column.name && !sortAscending}
						>
							<svg width="10" height="14" viewBox="0 0 10 14" fill="none">
								<path
									d="M5 1L9 6H1L5 1Z"
									fill="currentColor"
									opacity={currentSortColumn === column.name ? (sortAscending ? 1 : 0.3) : 0.2}
								/>
								<path
									d="M5 13L1 8H9L5 13Z"
									fill="currentColor"
									opacity={currentSortColumn === column.name ? (sortAscending ? 0.3 : 1) : 0.2}
								/>
							</svg>
						</span>
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
		box-shadow: 0 0.063rem 0.188rem rgba(0, 0, 0, 0.15);
		color: var(--text-color);
		font-weight: 700;
		will-change: transform;
		transform: translateZ(0);
		overflow: visible !important;
		text-overflow: unset !important;
		white-space: nowrap !important;
		padding: 0.625rem 0.5rem;
		text-align: left;
		border-bottom: 0.063rem solid var(--table-border-color);
		font-size: 0.7rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.header {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		cursor: pointer;
		transition: color 0.15s ease-out;
		overflow: visible !important;
		white-space: nowrap !important;
		min-width: max-content;
	}

	.header:hover {
		color: var(--icon-hover-color);
	}

	.header :global(.header-col-icon) {
		color: var(--icon-color);
		transition: color 0.15s ease-out;
	}

	.header:hover :global(.header-col-icon) {
		color: var(--icon-hover-color);
	}

	.sort-icon {
		display: inline-flex;
		align-items: center;
		flex-shrink: 0;
		line-height: 1;
	}

	.sort-icon svg {
		display: block;
	}
</style>
