<script>
	import { transactionDayKey } from '../lib/transactionHistory';
	import { locationLabel } from '../lib/stockLocations.js';
	import { vendorMovementLabel } from '../lib/vendorBalances.js';

	// `dayCounts` maps a day key to how many changes that day holds across the whole
	// filtered set. It has to come from the parent because this component only ever
	// receives one page: counting its own rows would report "10 changes" for a day
	// with 65. Optional — without it the header falls back to the rows on hand.
	let { transactions = [], dayCounts = null } = $props();

	function transactionEvent(transaction) {
		return transaction.event ?? 'countChange';
	}

	function presentation(transaction) {
		const event = transactionEvent(transaction);
		if (event === 'stockTransfer' || transaction.historicalTransfer) {
			return {
				icon: 'fa-arrows-left-right',
				iconClass: 'neutral',
				label: transaction.historicalTransfer
					? 'Confirmed historical transfer'
					: 'Stock transferred',
				deltaClass: 'neutral'
			};
		}
		if (event === 'vendorMovement') {
			return {
				icon: 'fa-handshake',
				iconClass: 'neutral',
				label: vendorMovementLabel(transaction),
				deltaClass: 'neutral'
			};
		}
		if (event === 'itemMerged') {
			return {
				icon: 'fa-object-group',
				iconClass: 'neutral',
				label: 'Item merged',
				deltaClass: 'neutral'
			};
		}
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
			label: positive ? 'Stock added' : 'Stock removed / issued',
			deltaClass: positive ? 'pos' : 'neg'
		};
	}

	const dayKey = transactionDayKey;

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
		{@const total = dayCounts?.get(group.key) ?? group.items.length}
		<div class="day-group">
			<div class="day-header">
				<b>{group.label}</b>
				<span>{total.toLocaleString()} {total === 1 ? 'change' : 'changes'}</span>
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
						class:neutral={card.iconClass === 'neutral'}
					>
						<i class="fas {card.icon}"></i>
					</div>
					<div class="row-main">
						<div class="row-name">{transaction.itemName}</div>
						<div class="row-meta">
							<span><i class="fas fa-tag"></i>{card.label}</span>
							{#if transaction.location}<span>{locationLabel(transaction.location)}</span>{/if}
							{#if transaction.event === 'stockTransfer'}<span
									>{transaction.quantity}{#if transaction.fromLocation && transaction.toLocation}
										· {locationLabel(transaction.fromLocation)} → {locationLabel(
											transaction.toLocation
										)}{/if}</span
								>{/if}
							{#if transaction.event === 'itemMerged' && transaction.relatedItemId}<span
									>Related item: {transaction.relatedItemId}</span
								>{/if}
							<span><i class="fas fa-clock"></i>{formatTime(transaction.timestamp)}</span>
							<span class="row-user"><i class="fas fa-user"></i>{transaction.user}</span>
						</div>
					</div>
					<div class="row-change">
						{#if transaction.previousCount != null}
							<div class="counts">
								<span>{transaction.previousCount}</span>
								<i class="fas fa-arrow-right"></i>
								<span class="new">{transaction.newCount}</span>
							</div>
						{/if}
						<span
							class="delta"
							class:pos={card.deltaClass === 'pos'}
							class:neg={card.deltaClass === 'neg'}
							class:create={card.deltaClass === 'create'}
							class:delete={card.deltaClass === 'delete'}
						>
							{#if transaction.event === 'stockTransfer'}Total unchanged{:else}{delta > 0
									? '+'
									: delta < 0
										? '−'
										: ''}{Math.abs(delta)}{/if}
						</span>
					</div>
				</div>
			{/each}
		</div>
	{/each}
</div>

<style>
	.timeline {
		/* Aliases onto the shared event tokens in global.css — the same colours now
		   drive the history page's stat cards and filter chips. */
		--pos: var(--event-add);
		--pos-bg: var(--event-add-bg);
		--neg: var(--event-remove);
		--neg-bg: var(--event-remove-bg);
		--create: var(--event-create);
		--create-bg: var(--event-create-bg);
		--delete: var(--event-delete);
		--delete-bg: var(--event-delete-bg);
		display: flex;
		flex-direction: column;
		max-height: 670px;
		min-height: 300px;
		overflow-y: auto;
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

	.row-ic.neutral {
		color: var(--text-color);
		background: var(--hover-bg-color);
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
		flex-wrap: wrap;
		gap: 0.1rem 0.7rem;
		min-width: 0;
	}

	/* Each fact stays on one line — without this the labels break mid-word
	   ("Stock / removed") as soon as the row gets narrow. */
	.row-meta > span {
		white-space: nowrap;
		min-width: 0;
	}

	/* The user is an email address: one unbreakable token that would otherwise
	   push the row wider than the card and force the timeline to scroll
	   sideways. It's the least important fact here, so it's the one that gives. */
	.row-user {
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 100%;
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

	@media (max-width: 640px) {
		.counts {
			display: none;
		}

		.row {
			gap: 0.7rem;
			padding: 0.7rem 1rem;
			align-items: flex-start;
		}

		.row-ic {
			/* Aligned to the item name now that the row can be two lines tall. */
			margin-top: 0.1rem;
		}

		.day-header {
			padding: 0.5rem 1rem;
		}
	}
</style>
