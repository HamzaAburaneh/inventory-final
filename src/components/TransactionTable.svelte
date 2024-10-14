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

	$: {
		console.log('TransactionTable - paginatedItems:', paginatedItems);
	}
</script>

<div class="table-wrapper">
	<div class="table-scroll">
		{#if paginatedItems.length === 0}
			<p class="text-center my-4">No transactions to display.</p>
		{:else}
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
		{/if}
	</div>
</div>

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
		max-height: 600px;
		min-height: 600px;
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

	/* Fixed column widths */
	.itemname-col,
	.type-col,
	.previouscount-col,
	.changedamount-col,
	.newcount-col,
	.user-col,
	.timestamp-col {
		width: 14.28%; /* 100% / 7 columns */
	}
</style>
