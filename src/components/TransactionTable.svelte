<script>
	const { paginatedItems = [], sortBy, currentSortColumn, sortAscending, loading = false } = $props();

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
								<i class="{style.icon}"></i>
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
							<div class="user-cell">
								<i class="fas fa-user-circle"></i>
								<span class="user-email" title={transaction.user}>{transaction.user.split('@')[0]}</span>
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
		background: #0e0f11;
		border: 1px solid #1c1d21;
		overflow: hidden;
		box-shadow: 0 15px 40px rgba(0, 0, 0, 0.4);
	}

	.table-scroll {
		width: 100%;
		overflow-x: auto;
		overflow-y: auto;
		max-height: 700px;
		min-height: 400px;
		scrollbar-width: thin;
		scrollbar-color: #ffe260 transparent;
	}

	.table-scroll::-webkit-scrollbar {
		width: 4px;
		height: 4px;
	}

	.table-scroll::-webkit-scrollbar-thumb {
		background: #333338; /* More subtle scrollbar */
		border-radius: 0;
	}

	.tech-table {
		width: 100%;
		border-collapse: collapse;
	}

	/* Header Styling */
	.tech-table th {
		position: sticky;
		top: 0;
		background: rgba(14, 15, 17, 0.98); /* Almost opaque for clean scrolling */
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
		z-index: 20;
		padding: 1rem 1.25rem;
		text-align: left;
		font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		font-weight: 700;
		color: #94949b; /* Refined steel gray */
		text-transform: uppercase;
		font-size: 0.7rem;
		letter-spacing: 0.1em;
		box-shadow: inset 0 -1px 0 rgba(255, 226, 96, 0.2); 
		transition: all 0.2s ease;
	}

	.tech-table th:hover {
		color: #ffffff;
		background: rgba(26, 27, 30, 1);
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
		color: #ffe260;
		opacity: 0.4;
	}

	/* Row Styling */
	.table-row {
		transition: background-color 0.1s ease;
		background: transparent;
	}

	.table-body-transition {
		transition: opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1), filter 0.4s ease;
	}

	.loading-fade { 
		opacity: 0.2; 
		filter: blur(2px);
		pointer-events: none;
	}

	.table-row:nth-child(even) {
		background: rgba(255, 255, 255, 0.01); /* Subtle zebra striping */
	}

	.table-row:hover {
		background: rgba(255, 226, 96, 0.03);
	}

	.tech-table td {
		padding: 0.85rem 1.25rem; /* Significantly reduced vertical padding */
		vertical-align: middle;
		border-bottom: 1px solid #18191c;
		color: #b1b1b6; /* Softer text color */
		font-size: 0.9rem;
	}

	.table-row:last-child td {
		border-bottom: none;
	}

	/* Item Name Cell */
	.name-text {
		font-weight: 700;
		color: #e2e2e7; /* Not pure white */
		font-size: 0.95rem;
	}

	/* Count Badges */
	.count-badge {
		padding: 0.35rem 0.75rem;
		border-radius: 4px;
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.85rem;
		background: #141518;
		border: 1px solid #222328;
		display: inline-block;
		min-width: 45px;
		text-align: center;
		color: #66666e; /* Muted counts */
	}

	.count-badge.result {
		background: rgba(255, 226, 96, 0.05);
		color: #ffe260;
		border: 1px solid rgba(255, 226, 96, 0.2);
		font-weight: 800;
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
		background: rgba(34, 197, 94, 0.08); /* More subtle green */
		color: #4ade80;
		border: 1px solid rgba(34, 197, 94, 0.2);
	}

	.negative-tag {
		background: rgba(239, 68, 68, 0.08); /* More subtle red */
		color: #f87171;
		border: 1px solid rgba(239, 68, 68, 0.2);
	}

	.neutral-tag {
		background: rgba(255, 255, 255, 0.03);
		color: #55555e;
		border: 1px solid #1c1d21;
	}

	/* Timestamp Cell */
	.timestamp-cell {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.time {
		color: #a1a1aa;
		font-weight: 700;
		font-size: 0.85rem;
	}

	.date {
		font-size: 0.75rem;
		color: #55555a;
		font-weight: 600;
	}

	/* User Cell */
	.user-cell {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		color: #71717a;
	}

	.user-cell i {
		font-size: 1.1rem;
		color: #ffe260;
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
	.itemname-col { width: 30%; text-align: left; }
	.previouscount-col, .newcount-col { width: 12%; text-align: center; }
	.changedamount-col { width: 14%; text-align: center; }
	.timestamp-col { width: 17%; text-align: left; }
	.user-col { width: 15%; text-align: left; }

	.tech-table th.previouscount-col .header-content,
	.tech-table th.newcount-col .header-content,
	.tech-table th.changedamount-col .header-content {
		justify-content: center;
	}

	/* Mobile Responsive Styles */
	@media (max-width: 768px) {
		.tech-table thead {
			display: none;
		}

		.tech-table td {
			padding: 0.75rem 1rem;
			border-bottom: 1px solid #18191c;
		}

		.tech-table td::before {
			font-weight: 800;
			font-size: 0.65rem;
			color: #55555e;
			letter-spacing: 0.1em;
		}
	}
</style>

