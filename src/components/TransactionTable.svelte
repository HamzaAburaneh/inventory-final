<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import type { Transaction } from '../types';

	export let paginatedItems: Transaction[] = [];
	export let sortBy: (column: keyof Transaction | 'changedAmount') => void;
	export let currentSortColumn: keyof Transaction | 'changedAmount';
	export let sortAscending: boolean;

	function capitalizeWords(str: string): string {
		return str
			.split(' ')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');
	}

	const columns: (keyof Transaction | 'changedAmount')[] = [
		'itemName',
		'type',
		'previousCount',
		'changedAmount',
		'newCount',
		'user',
		'timestamp'
	];
</script>

<div class="table-wrapper">
	<table class="custom-table">
		<thead>
			<tr class="table-header">
				{#each columns as column}
					<th class="{column}-col" on:click={() => sortBy(column)}>
						<div class="header">
							{capitalizeWords(column.replace(/([A-Z])/g, ' $1').trim())}
							<i
								class="fas fa-sort{currentSortColumn === column
									? sortAscending
										? '-up'
										: '-down'
									: ''}"
							></i>
						</div>
					</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each paginatedItems as transaction (transaction.id)}
				<tr class="table-row" in:fly={{ y: 20, duration: 300 }} out:fade={{ duration: 300 }}>
					<td class="itemname-col">{transaction.itemName}</td>
					<td class="type-col">{capitalizeWords(transaction.type)}</td>
					<td class="previouscount-col">{transaction.previousCount}</td>
					<td class="changedamount-col">{transaction.newCount - transaction.previousCount}</td>
					<td class="newcount-col">{transaction.newCount}</td>
					<td class="user-col">{transaction.user}</td>
					<td class="timestamp-col">{new Date(transaction.timestamp).toLocaleString()}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.table-wrapper {
		overflow-x: auto;
		max-width: 100%;
	}

	.custom-table {
		width: 100%;
		border-collapse: separate;
		border-spacing: 0;
	}

	.custom-table th,
	.custom-table td {
		padding: 0.6rem;
		text-align: left;
		border-bottom: 1px solid var(--table-border-color);
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
		background-color: var(--zinc-800);
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

	/* Adjusted column widths */
	.itemname-col {
		width: 20%;
	}
	.type-col {
		width: 10%;
	}
	.previouscount-col {
		width: 12%;
	}
	.changedamount-col {
		width: 12%;
	}
	.newcount-col {
		width: 12%;
	}
	.user-col {
		width: 15%;
	}
	.timestamp-col {
		width: 19%;
	}

	@media (max-width: 768px) {
		.custom-table th,
		.custom-table td {
			padding: 0.5rem;
			font-size: 0.9rem;
		}
	}
</style>
