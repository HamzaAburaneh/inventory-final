<script>
	const { paginatedItems = [], sortBy, currentSortColumn, sortAscending } = $props();

	function capitalizeWords(str) {
		return str
			.split(' ')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');
	}

	const columns = [
		'itemName',
		'previousCount',
		'changedAmount',
		'newCount',
		'timestamp',
		'user'
	];

	function getChangedAmountStyle(changedAmount) {
		if (changedAmount > 0) {
			return { color: 'positive-change', icon: 'fas fa-arrow-up' };
		} else if (changedAmount < 0) {
			return { color: 'negative-change', icon: 'fas fa-arrow-down' };
		}
		return { color: '', icon: '' };
	}

	function formatTimestamp(timestamp) {
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
						<th class="{column}-col" onclick={() => sortBy(column)}>
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
						<td class="itemname-col" data-label="Item Name">{transaction.itemName}</td>
						<td class="previouscount-col" data-label="Previous Count">{transaction.previousCount}</td>
						<td class="changedamount-col" data-label="Changed Amount">
							<span class={style.color}>
								<i class="{style.icon} mr-1"></i>
								{changedAmount > 0 ? '+' : ''}{changedAmount}
							</span>
						</td>
						<td class="newcount-col highlighted" data-label="New Count">{transaction.newCount}</td>
						<td class="timestamp-col dimmed-text" data-label="Timestamp">{formatTimestamp(transaction.timestamp)}</td>
						<td class="user-col dimmed-text" data-label="User">{transaction.user}</td>
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
		min-height: 300px; /* A more flexible min-height */
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
		transition: background-color 0.3s ease;
	}

	.custom-table tbody tr:hover {
		background-color: var(--table-row-hover-bg);
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
		min-width: min(150px, 25vw);
	}
	.previouscount-col,
	.changedamount-col,
	.newcount-col {
		width: 12%;
		text-align: right;
		min-width: min(100px, 15vw);
	}
	.user-col {
		width: 15%;
		min-width: min(120px, 20vw);
	}
	.timestamp-col {
		width: 24%;
		min-width: min(180px, 30vw);
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
		color: var(--text-color-dimmed);
		font-size: 0.9em;
	}
	@media (max-width: 768px) {
		.custom-table thead {
			display: none;
		}

		.custom-table,
		.custom-table tbody,
		.custom-table tr,
		.custom-table td {
			display: block;
			width: 100%;
		}

		.custom-table tr {
			display: flex;
			flex-direction: column;
			margin-bottom: 1rem;
			border: 1px solid var(--table-border-color);
			border-radius: 8px;
			overflow: hidden;
			background-color: var(--container-bg);
		}

		.custom-table td {
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding: 0.75rem 1rem;
			text-align: right;
			position: relative;
			border-bottom: 2px solid rgba(255, 255, 255, 0.1);
			white-space: normal;
		}

		.custom-table td:last-child {
			border-bottom: none;
		}

		.custom-table td::before {
			content: attr(data-label);
			font-weight: bold;
			text-align: left;
			white-space: nowrap;
		}

		.custom-table tr:hover td {
			border-bottom-color: rgba(255, 255, 255, 0.2);
		}

		/* Special styling for highlighted cells */
		.highlighted {
			background-color: rgba(255, 255, 255, 0.08);
		}

		/* Ensure change amount styling is preserved */
		.changedamount-col span {
			display: flex;
			align-items: center;
		}
	}
</style>
