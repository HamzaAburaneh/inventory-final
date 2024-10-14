<script lang="ts">
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
		'previousCount',
		'changedAmount',
		'newCount',
		'timestamp',
		'user'
	];

	function getChangedAmountStyle(changedAmount: number): { color: string; icon: string } {
		if (changedAmount > 0) {
			return { color: 'positive-change', icon: 'fas fa-arrow-up' };
		} else if (changedAmount < 0) {
			return { color: 'negative-change', icon: 'fas fa-arrow-down' };
		}
		return { color: '', icon: '' };
	}

	function formatTimestamp(timestamp: Date): string {
		const date = new Date(timestamp);
		const time = date.toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });
		const formattedDate = date.toLocaleDateString('en-US', {
			month: '2-digit',
			day: '2-digit',
			year: 'numeric'
		});
		return `${time} | ${formattedDate}`;
	}
</script>

<div class="table-wrapper">
	<div class="table-scroll">
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
					{@const changedAmount = transaction.newCount - transaction.previousCount}
					{@const style = getChangedAmountStyle(changedAmount)}
					<tr class="table-row">
						<td class="itemname-col">{transaction.itemName}</td>
						<td class="previouscount-col">{transaction.previousCount}</td>
						<td class="changedamount-col">
							<span class={style.color}>
								<i class="{style.icon} mr-1"></i>
								{changedAmount > 0 ? '+' : ''}{changedAmount}
							</span>
						</td>
						<td class="newcount-col highlighted">{transaction.newCount}</td>
						<td class="timestamp-col dimmed-text">{formatTimestamp(transaction.timestamp)}</td>
						<td class="user-col dimmed-text">{transaction.user}</td>
					</tr>
				{/each}
			</tbody>
		</table>
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
		max-height: 670px;
		min-height: 670px;
	}

	.custom-table {
		width: 100%;
		border-collapse: separate;
		border-spacing: 0;
		font-size: 1rem;
		max-height: 100%;
	}

	.custom-table th,
	.custom-table td {
		padding: 1rem 1.2rem;
		text-align: left;
		border-bottom: 1px solid var(--table-border-color);
		white-space: nowrap;
	}

	.custom-table th {
		position: sticky;
		top: 0;
		background-color: var(--container-bg);
		z-index: 10;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		font-weight: bold;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-size: 0.9rem;
	}

	.custom-table tbody tr {
		background-color: var(--container-bg);
	}

	.custom-table tbody tr:hover {
		background-color: var(--zinc-800);
	}

	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		cursor: pointer;
	}

	.header i {
		margin-left: 0.5rem;
		font-size: 0.8em;
	}

	.itemname-col {
		width: 25%;
	}
	.previouscount-col,
	.changedamount-col,
	.newcount-col {
		width: 12%;
		text-align: right;
	}
	.user-col {
		width: 15%;
	}
	.timestamp-col {
		width: 24%;
	}

	.positive-change {
		color: #4caf50;
		font-weight: bold;
	}
	.negative-change {
		color: #f44336;
		font-weight: bold;
	}

	.mr-1 {
		margin-right: 0.25rem;
	}
	.highlighted {
		background-color: rgba(255, 255, 255, 0.05);
		font-weight: bold;
	}
	.dimmed-text {
		color: rgba(255, 255, 255, 0.6);
		font-size: 0.9em;
	}
</style>
