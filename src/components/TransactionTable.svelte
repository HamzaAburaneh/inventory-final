<script>
	const {
		paginatedItems = [],
		sortBy,
		currentSortColumn,
		sortAscending,
		loading = false
	} = $props();

	function capitalizeWords(str) {
		return str
			.split(' ')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');
	}

	const columns = ['itemName', 'previousCount', 'changedAmount', 'newCount', 'timestamp', 'user'];

	function getChangedAmountStyle(changedAmount) {
		if (changedAmount > 0) {
			return { color: 'positive-tag', icon: 'fas fa-arrow-up' };
		} else if (changedAmount < 0) {
			return { color: 'negative-tag', icon: 'fas fa-arrow-down' };
		}
		return { color: 'neutral-tag', icon: 'fas fa-minus' };
	}

	function formatTimestamp(timestamp) {
		const date = new Date(timestamp);
		const time = date.toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });
		const formattedDate = date.toLocaleDateString('en-US', {
			month: 'short',
			day: '2-digit',
			year: 'numeric'
		});
		return { time, date: formattedDate };
	}
</script>

<div class="table-wrapper">
	<div class="table-scroll">
		<table class="tech-table">
			<thead>
				<tr>
					{#each columns as column}
						<th class="{column}-col" onclick={() => sortBy(column)}>
							<div class="header-content">
								<span>{capitalizeWords(column.replace(/([A-Z])/g, ' $1').trim())}</span>
								<i
									class="fas fa-sort{currentSortColumn === column
										? sortAscending
											? '-up'
											: '-down'
										: ''} sort-icon"
								></i>
							</div>
						</th>
					{/each}
				</tr>
			</thead>
			<tbody class="table-body-transition" class:loading-fade={loading}>
				{#each paginatedItems as transaction (transaction.id)}
					{@const changedAmount = transaction.newCount - transaction.previousCount}
					{@const style = getChangedAmountStyle(changedAmount)}
					{@const timeData = formatTimestamp(transaction.timestamp)}
					<tr class="table-row">
						<td class="itemname-col" data-label="Item Name">
							<div class="item-name-cell">
								<span class="name-text">{transaction.itemName}</span>
							</div>
						</td>
						<td class="previouscount-col" data-label="Previous Count">
							<span class="count-badge old">{transaction.previousCount}</span>
						</td>
						<td class="changedamount-col" data-label="Changed Amount">
							<div class="change-tag {style.color}">
								<i class={style.icon}></i>
								<span>{Math.abs(changedAmount)}</span>
							</div>
						</td>
						<td class="newcount-col" data-label="New Count">
							<span class="count-badge result">{transaction.newCount}</span>
						</td>
						<td class="timestamp-col" data-label="Timestamp">
							<div class="timestamp-cell">
								<span class="time">{timeData.time}</span>
								<span class="date">{timeData.date}</span>
							</div>
						</td>
						<td class="user-col" data-label="User">
							<div class="user-cell" data-timestamp="{timeData.time} {timeData.date}">
								<i class="fas fa-user-circle"></i>
								<span class="user-email" title={transaction.user}
									>{transaction.user.split('@')[0]}</span
								>
								<span class="timestamp-inline">{timeData.time} {timeData.date}</span>
							</div>
						</td>
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
		border-radius: 8px;
		background: var(--tech-glass-bg);
		border: 1px solid var(--tech-glass-border);
		overflow: hidden;
		box-shadow: var(--tech-glass-shadow);
	}

	.table-scroll {
		width: 100%;
		overflow-x: auto;
		overflow-y: auto;
		max-height: 700px;
		min-height: 400px;
		scrollbar-width: thin;
		scrollbar-color: var(--tech-scrollbar-thumb) transparent;
	}

	.table-scroll::-webkit-scrollbar {
		width: 6px;
		height: 6px;
	}

	.table-scroll::-webkit-scrollbar-thumb {
		background: var(--tech-scrollbar-thumb);
		border-radius: 0; /* Sharp industrial look */
	}

	.tech-table {
		width: 100%;
		border-collapse: collapse;
	}

	/* Header Styling */
	.tech-table th {
		position: sticky;
		top: 0;
		background: var(--tech-header-bg);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		z-index: 20;
		padding: 1.1rem 1.25rem;
		text-align: left;
		font-family:
			'Inter',
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			Roboto,
			sans-serif;
		font-weight: 700;
		color: var(--tech-header-text);
		text-transform: uppercase;
		font-size: 0.7rem;
		letter-spacing: 0.1em;
	}

	.tech-table th:hover {
		color: var(--tech-accent);
		cursor: pointer;
	}

	.header-content {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		white-space: nowrap;
	}

	.sort-icon {
		font-size: 0.75rem;
		color: var(--tech-accent);
		opacity: 0.4;
	}

	/* Row Styling */
	.table-row {
		transition: background-color 0.1s ease;
		background: transparent;
	}

	.table-body-transition {
		transition:
			opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1),
			filter 0.4s ease;
	}

	.loading-fade {
		opacity: 0.2;
		filter: blur(2px);
		pointer-events: none;
	}

	.table-row:nth-child(even) {
		background: var(--tech-row-stripe);
	}

	.table-row:hover {
		background: var(--tech-row-hover);
	}

	.tech-table td {
		padding: 0.85rem 1.25rem;
		vertical-align: middle;
		border-bottom: 1px solid var(--tech-cell-border);
		color: var(--tech-cell-text);
		font-size: 0.9rem;
	}

	.table-row:last-child td {
		border-bottom: none;
	}

	/* Item Name Cell */
	.name-text {
		font-weight: 700;
		color: var(--tech-value);
		font-size: 0.95rem;
	}

	/* Count Badges */
	.count-badge {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.9rem;
		color: var(--tech-label);
		display: inline-block;
		min-width: 45px;
		text-align: center;
		font-weight: 700;
		padding: 0.25rem;
	}

	.count-badge.result {
		color: var(--tech-accent);
		font-weight: 800;
		font-size: 1rem;
		text-shadow: 0 0 10px var(--tech-accent-muted);
	}

	/* Change Tags */
	.change-tag {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		padding: 0.35rem 0.8rem;
		border-radius: 4px;
		font-weight: 800;
		font-size: 0.75rem;
		min-width: 75px;
	}

	.positive-tag {
		background: rgba(34, 197, 94, 0.1);
		color: #22c55e;
		border: 1px solid rgba(34, 197, 94, 0.2);
	}

	.negative-tag {
		background: rgba(239, 68, 68, 0.1);
		color: #ef4444;
		border: 1px solid rgba(239, 68, 68, 0.2);
	}

	.neutral-tag {
		background: var(--tech-badge-bg);
		color: var(--tech-label);
		border: 1px solid var(--tech-cell-border);
	}

	/* Timestamp Cell */
	.timestamp-cell {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.time {
		color: var(--tech-cell-text);
		font-weight: 700;
		font-size: 0.85rem;
	}

	.date {
		font-size: 0.75rem;
		color: var(--tech-label);
		font-weight: 600;
	}

	/* User Cell */
	.user-cell {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		color: var(--tech-label);
	}

	.user-cell i {
		font-size: 1.1rem;
		color: var(--tech-accent);
		opacity: 0.6;
	}

	.user-email {
		max-width: 150px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.85rem;
		font-weight: 600;
	}

	/* Column Widths & Alignment */
	.itemname-col {
		width: 30%;
		text-align: left;
	}
	.previouscount-col,
	.newcount-col {
		width: 12%;
		text-align: center;
	}
	.changedamount-col {
		width: 14%;
		text-align: center;
	}
	.timestamp-col {
		width: 17%;
		text-align: left;
	}
	.user-col {
		width: 15%;
		text-align: left;
	}

	.tech-table th.previouscount-col .header-content,
	.tech-table th.newcount-col .header-content,
	.tech-table th.changedamount-col .header-content {
		justify-content: center;
	}

	/* Mobile Responsive Styles - Redesigned Card Layout */
	@media (max-width: 768px) {
		.table-scroll {
			max-height: none;
			min-height: auto;
			padding: 1rem 0.75rem;
		}

		.tech-table,
		.tech-table tbody,
		.tech-table thead,
		.tech-table th {
			display: block;
		}

		.tech-table thead {
			display: none;
		}

		.table-row {
			display: flex;
			flex-wrap: wrap;
			background: var(--tech-header-bg);
			border: 1px solid var(--tech-glass-border);
			border-radius: 12px;
			margin-bottom: 1rem;
			padding: 1.25rem 1rem;
			box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
			transition: all 0.2s ease;
			justify-content: center;
			gap: 0;
		}

		.tech-table td {
			display: block;
		}

		.table-row:hover {
			border-color: var(--tech-accent);
			box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
			transform: translateY(-2px);
		}

		.tech-table td {
			padding: 0;
			border-bottom: none;
		}

		/* Line 1: Item Name */
		.table-row .itemname-col {
			display: block !important;
			width: 100%;
			text-align: center;
			margin-bottom: 1.25rem;
			order: 1;
		}

		.item-name-cell {
			display: block;
		}

		.name-text {
			font-size: 1.2rem;
			font-weight: 800;
			color: var(--tech-accent);
			display: block;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}

		/* Line 2: The 3 Numbers Row */
		.table-row .previouscount-col,
		.table-row .changedamount-col,
		.table-row .newcount-col {
			display: flex !important;
			width: 33.33%;
			flex-direction: column;
			align-items: center;
			justify-content: flex-start;
			gap: 0.5rem;
			order: 2;
			margin-bottom: 1.25rem;
			flex-shrink: 0;
		}

		/* Labels */
		.previouscount-col::before {
			content: 'PREVIOUS';
		}
		.changedamount-col::before {
			content: 'CHANGE';
		}
		.newcount-col::before {
			content: 'NEW TOTAL';
		}

		.previouscount-col::before,
		.changedamount-col::before,
		.newcount-col::before {
			font-family: 'JetBrains Mono', monospace;
			font-size: 0.65rem;
			font-weight: 700;
			color: var(--tech-label);
			letter-spacing: 0.05em;
			text-transform: uppercase;
			opacity: 0.7;
		}

		.count-badge {
			font-size: 1.1rem;
			font-weight: 700;
			color: var(--tech-value);
		}

		.count-badge.result {
			font-size: 1.2rem;
			color: var(--tech-accent);
			text-shadow: 0 0 10px var(--tech-accent-muted);
		}

		.change-tag {
			min-width: auto;
			padding: 0.3rem 0.7rem;
			font-size: 0.9rem;
			border-radius: 6px;
		}

		/* Line 3: Combined Timestamp and User - Modern Footer */
		.table-row .user-col {
			display: flex !important;
			order: 3;
			width: calc(100% + 2rem);
			margin-left: -1rem;
			margin-right: -1rem;
			margin-bottom: -1.25rem;
			align-items: center;
			justify-content: center;
			padding: 0;
			margin-top: 1rem;
			padding-top: 0.85rem;
			padding-bottom: 0.85rem;
			border-top: 1px solid var(--tech-cell-border);
			background: rgba(0, 0, 0, 0.15);
			border-bottom-left-radius: 12px;
			border-bottom-right-radius: 12px;
		}

		.table-row .timestamp-col {
			display: none !important;
		}

		.user-cell {
			display: flex;
			flex-direction: row;
			align-items: center;
			gap: 0.4rem;
			flex-wrap: wrap;
			justify-content: center;
			width: 100%;
			font-size: 0.85rem;
			line-height: 1.6;
		}

		.user-cell::before {
			content: '';
			display: none;
		}

		.user-cell i {
			display: inline-flex !important;
			font-size: 1rem;
			color: var(--tech-accent);
			opacity: 0.6;
			margin-left: 0.2rem;
		}

		.user-email {
			font-size: 0.85rem;
			font-weight: 600;
			color: var(--tech-accent);
			max-width: none;
		}

		.timestamp-inline {
			display: none;
		}

		.user-email::after {
			content: '';
			display: none;
		}

		.user-cell .timestamp-inline {
			display: inline;
			font-size: 0.85rem;
			font-weight: 500;
			color: var(--tech-label);
			opacity: 0.8;
		}
	}

	@media (max-width: 480px) {
		.table-row {
			padding: 1rem 0.75rem;
		}

		.name-text {
			font-size: 1.1rem;
		}

		.count-badge {
			font-size: 1rem;
		}

		.count-badge.result {
			font-size: 1.1rem;
		}

		.user-cell::before,
		.user-email,
		.timestamp-inline {
			font-size: 0.75rem;
		}

		.user-cell {
			font-size: 0.75rem;
		}
	}
</style>
