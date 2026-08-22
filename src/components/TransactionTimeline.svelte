<script>
	let { transactions = [] } = $props();

	function transactionEvent(transaction) {
		if (transaction.event) return transaction.event;
		if (transaction.type === 'add' && transaction.previousCount === 0) return 'itemCreated';
		if (transaction.type === 'remove' && transaction.newCount === 0) return 'itemDeleted';
		return 'countChange';
	}

	function presentation(transaction) {
		const event = transactionEvent(transaction);
		if (event === 'itemCreated') {
			return {
				icon: 'fa-box-open',
				iconClass: 'create',
				label: 'Item created',
				deltaClass: 'create'
			};
		}
		if (event === 'itemDeleted') {
			return {
				icon: 'fa-trash-can',
				iconClass: 'delete',
				label: 'Item deleted',
				deltaClass: 'delete'
			};
		}
		const delta = transaction.newCount - transaction.previousCount;
		const positive = delta >= 0;
		return {
			icon: positive ? 'fa-arrow-up' : 'fa-arrow-down',
			iconClass: positive ? 'add' : 'rem',
			label: positive ? 'Stock added' : 'Stock removed',
			deltaClass: positive ? 'pos' : 'neg'
		};
	}

	function dayKey(date) {
		const d = new Date(date);
		return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
	}

	function dayLabel(date) {
		const d = new Date(date);
		const today = new Date();
		const yesterday = new Date();
		yesterday.setDate(today.getDate() - 1);
		if (dayKey(d) === dayKey(today)) return 'Today';
		if (dayKey(d) === dayKey(yesterday)) return 'Yesterday';
		return d.toLocaleDateString('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function formatTime(date) {
		return new Date(date).toLocaleString('en-US', {
			hour: 'numeric',
			minute: '2-digit',
			hour12: true
		});
	}

	// Group the (already sorted + paginated) transactions by calendar day. Input order is
	// preserved, so the day groups come out in the same order the page sorted them.
	const groups = $derived.by(() => {
		const out = [];
		const map = new Map();
		for (const transaction of transactions) {
			const key = dayKey(transaction.timestamp);
			let group = map.get(key);
			if (!group) {
				group = { key, label: dayLabel(transaction.timestamp), items: [] };
				map.set(key, group);
				out.push(group);
			}
			group.items.push(transaction);
		}
		return out;
	});
</script>

<div class="timeline">
	{#each groups as group (group.key)}
		<div class="day-group">
			<div class="day-header">
				<b>{group.label}</b>
				<span>{group.items.length} {group.items.length === 1 ? 'change' : 'changes'}</span>
			</div>
			{#each group.items as transaction (transaction.id)}
				{@const delta = transaction.newCount - transaction.previousCount}
				{@const card = presentation(transaction)}
				<div class="row">
					<div
						class="row-ic"
						class:add={card.iconClass === 'add'}
						class:rem={card.iconClass === 'rem'}
						class:create={card.iconClass === 'create'}
						class:delete={card.iconClass === 'delete'}
					>
						<i class="fas {card.icon}"></i>
					</div>
					<div class="row-main">
						<div class="row-name">{transaction.itemName}</div>
						<div class="row-meta">
							<span><i class="fas fa-tag"></i>{card.label}</span>
							<span><i class="fas fa-clock"></i>{formatTime(transaction.timestamp)}</span>
							<span><i class="fas fa-user"></i>{transaction.user}</span>
						</div>
					</div>
					<div class="row-change">
						<div class="counts">
							<span>{transaction.previousCount}</span>
							<i class="fas fa-arrow-right"></i>
							<span class="new">{transaction.newCount}</span>
						</div>
						<span
							class="delta"
							class:pos={card.deltaClass === 'pos'}
							class:neg={card.deltaClass === 'neg'}
							class:create={card.deltaClass === 'create'}
							class:delete={card.deltaClass === 'delete'}
						>
							{delta > 0 ? '+' : delta < 0 ? '−' : ''}{Math.abs(delta)}
						</span>
					</div>
				</div>
			{/each}
		</div>
	{/each}
</div>

<style>
	.timeline {
		--pos: #1f9d4d;
		--pos-bg: #e7f6ec;
		--neg: #d83a32;
		--neg-bg: #fdeceb;
		--create: #1d7fe3;
		--create-bg: #e4f0ff;
		--delete: #9b2eb6;
		--delete-bg: #f5e5fb;
		display: flex;
		flex-direction: column;
		max-height: 670px;
		min-height: 300px;
		overflow-y: auto;
	}

	:global([data-theme='dark']) .timeline {
		--pos: #5bcf7e;
		--pos-bg: #16301f;
		--neg: #f06a62;
		--neg-bg: #341715;
		--create: #7ab4ff;
		--create-bg: #142742;
		--delete: #d88af2;
		--delete-bg: #32163d;
	}

	.day-header {
		position: sticky;
		top: 0;
		z-index: 5;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 1.25rem;
		background: var(--table-header-bg);
		border-bottom: 1px solid var(--table-border-color);
	}

	.day-header b {
		font-size: 0.8rem;
		font-weight: 600;
		letter-spacing: 0.01em;
		color: var(--text-color);
	}

	.day-header span {
		font-size: 0.72rem;
		font-weight: 500;
		color: var(--text-color-dimmed);
	}

	.row {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		padding: 0.75rem 1.25rem;
		border-bottom: 1px solid var(--table-border-color);
		transition: background-color 0.15s ease-out;
	}

	.row:hover {
		background: var(--table-row-hover-bg);
	}

	.row-ic {
		flex: none;
		width: 34px;
		height: 34px;
		border-radius: 9px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.85rem;
	}

	.row-ic.add {
		background: var(--pos-bg);
		color: var(--pos);
	}

	.row-ic.rem {
		background: var(--neg-bg);
		color: var(--neg);
	}

	.row-ic.create {
		background: var(--create-bg);
		color: var(--create);
	}

	.row-ic.delete {
		background: var(--delete-bg);
		color: var(--delete);
	}

	.row-main {
		flex: 1;
		min-width: 0;
	}

	.row-name {
		font-size: 0.92rem;
		font-weight: 600;
		letter-spacing: -0.01em;
		color: var(--text-color);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.row-meta {
		margin-top: 0.15rem;
		font-size: 0.75rem;
		color: var(--text-color-dimmed);
		display: flex;
		align-items: center;
		gap: 0.7rem;
	}

	.row-meta i {
		margin-right: 0.3rem;
	}

	.row-change {
		flex: none;
		display: flex;
		align-items: center;
		gap: 0.7rem;
	}

	.counts {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		font-size: 0.85rem;
		color: var(--text-color-dimmed);
		font-variant-numeric: tabular-nums;
	}

	.counts i {
		font-size: 0.72rem;
	}

	.counts .new {
		color: var(--text-color);
		font-weight: 600;
	}

	.delta {
		font-size: 0.78rem;
		font-weight: 600;
		padding: 0.25rem 0.55rem;
		border-radius: 7px;
		min-width: 46px;
		text-align: center;
		font-variant-numeric: tabular-nums;
	}

	.delta.pos {
		background: var(--pos-bg);
		color: var(--pos);
	}

	.delta.neg {
		background: var(--neg-bg);
		color: var(--neg);
	}

	.delta.create {
		background: var(--create-bg);
		color: var(--create);
	}

	.delta.delete {
		background: var(--delete-bg);
		color: var(--delete);
	}

	@media (max-width: 520px) {
		.counts {
			display: none;
		}

		.row {
			gap: 0.7rem;
		}
	}
</style>
