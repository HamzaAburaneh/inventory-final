<script>
	import { onMount } from 'svelte';
	import { itemStore } from '../../stores/itemStore';
	import { isOnline } from '../../stores/connectivityStore';
	import { notificationStore } from '../../stores/notificationStore';
	import {
		getVendorLoanEntries,
		recordVendorAction,
		subscribeToVendorLoans
	} from '../../lib/vendorLoans';
	import {
		formatCents,
		groupLoans,
		loanBalance,
		outstandingTotals,
		vendorSuggestions,
		vendorSummaries
	} from '../../lib/vendorBalances';
	import { locationLabel } from '../../lib/stockLocations';
	import TableSkeleton from '../../components/TableSkeleton.svelte';
	import VendorLoanDialog from '../../components/VendorLoanDialog.svelte';
	import VendorSettleDialog from '../../components/VendorSettleDialog.svelte';

	// Loans are reassigned wholesale from each snapshot, never mutated.
	let loans = $state.raw([]);
	let ready = $state(false);
	let received = $state(false);
	/** @type {boolean | 'denied'} */
	let loadFailed = $state(false);
	let tab = $state('owedToUs');
	let search = $state('');
	let recording = $state(false);
	/** @type {{ loan: object, mode: string } | null} */
	let settling = $state(null);
	/** @type {string | null} */
	let expandedId = $state(null);
	// Audit trails keyed by loan ID and its last entry, so a new entry refetches.
	let entries = $state.raw({});

	const items = $derived($itemStore);
	const groups = $derived(groupLoans(loans));
	const summaries = $derived(vendorSummaries(loans));
	const vendorNames = $derived(vendorSuggestions(loans));

	const tabs = [
		{ value: 'owedToUs', label: 'Owed to us' },
		{ value: 'weOwe', label: 'We owe' },
		{ value: 'needsReview', label: 'Needs review' },
		{ value: 'settled', label: 'Settled' },
		{ value: 'vendors', label: 'By vendor' }
	];

	const owedToUs = $derived(outstandingTotals(groups.owedToUs));
	const weOwe = $derived(outstandingTotals(groups.weOwe));
	// The net and the bar can only weigh priced loans, so the unpriced ones are named
	// beside them rather than silently left out.
	const netCents = $derived(owedToUs.cents - weOwe.cents);
	const unpriced = $derived(owedToUs.unpriced + weOwe.unpriced);

	const needle = $derived(search.trim().toLowerCase());
	const matches = (text) => !needle || text.toLowerCase().includes(needle);
	const visibleLoans = $derived(
		tab === 'vendors'
			? []
			: [...groups[tab]]
					.filter((loan) => matches(loan.vendorName) || matches(loan.productName))
					.sort((a, b) => (b.updatedAt?.getTime?.() ?? 0) - (a.updatedAt?.getTime?.() ?? 0))
	);
	const visibleVendors = $derived(
		summaries.filter(
			(vendor) =>
				matches(vendor.vendorName) || vendor.lines.some((line) => matches(line.productName))
		)
	);

	onMount(() => {
		let stop = () => {};
		try {
			itemStore.loadItems();
			stop = subscribeToVendorLoans(
				(rows) => {
					loans = rows;
					received = true;
					loadFailed = false;
				},
				(error) => {
					loadFailed = error?.code === 'permission-denied' ? 'denied' : true;
					received = true;
				}
			);
		} catch {
			// No active group yet — the layout guard will redirect.
		}
		ready = true;
		return () => stop();
	});

	async function save(details, operationId) {
		const result = await recordVendorAction(details, operationId);
		notificationStore.showNotification(
			result.status === 'duplicate' ? 'Already saved.' : 'Saved.',
			'success'
		);
		return result;
	}

	async function toggleHistory(loan) {
		if (expandedId === loan.id) {
			expandedId = null;
			return;
		}
		expandedId = loan.id;
		const key = `${loan.id}:${loan.lastEntryId}`;
		if (entries[key]) return;
		try {
			const rows = await getVendorLoanEntries(loan.id);
			entries = { ...entries, [key]: rows };
		} catch {
			entries = { ...entries, [key]: 'error' };
		}
	}

	function itemFor(loan) {
		return loan.itemId ? (items.find((row) => row.id === loan.itemId) ?? null) : null;
	}

	function loanCount(totals) {
		const text = `${totals.count} ${totals.count === 1 ? 'loan' : 'loans'}`;
		return totals.unpriced ? `${text} · ${totals.unpriced} without a value` : text;
	}

	function initials(name) {
		const words = name.trim().split(/\s+/).filter(Boolean);
		return (
			words
				.slice(0, 2)
				.map((word) => word[0].toUpperCase())
				.join('') || '?'
		);
	}

	function formatDate(date) {
		return date
			? date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
			: '';
	}

	function formatDateTime(date) {
		return date
			? date.toLocaleString('en-CA', {
					month: 'short',
					day: 'numeric',
					hour: 'numeric',
					minute: '2-digit'
				})
			: 'Saving…';
	}

	function entryLabel(entry, loan) {
		const lent = loan.direction === 'lent';
		switch (entry.kind) {
			case 'loan':
				return `${lent ? 'Lent' : 'Borrowed'} ${entry.quantity}${loan.opening ? ' (carried over)' : ''}`;
			case 'return':
				return `${entry.quantity} returned ${lent ? 'to us' : 'to them'}`;
			case 'cash':
				return `${formatCents(entry.amountCents)} ${lent ? 'received' : 'paid'} for ${entry.quantity}`;
			case 'correction':
				return `Owed corrected by ${entry.quantity > 0 ? '+' : ''}${entry.quantity}`;
			case 'review':
				return 'Marked reviewed';
			default:
				return entry.kind;
		}
	}

	const statusLabels = { open: 'Open', partial: 'Partly settled', settled: 'Settled' };
</script>

<svelte:head>
	<title>Vendor Balances</title>
</svelte:head>

{#snippet loanCard(loan)}
	{@const balance = loanBalance(loan)}
	{@const key = `${loan.id}:${loan.lastEntryId}`}
	{@const lent = loan.direction === 'lent'}
	<li class="loan" data-direction={loan.direction}>
		<div class="avatar" aria-hidden="true">
			{initials(loan.vendorName)}
			<span class="avatar-badge">
				<i class="fas {lent ? 'fa-arrow-right' : 'fa-arrow-left'}"></i>
			</span>
		</div>
		<div class="loan-main">
			<div class="loan-direction">{lent ? 'Owes us' : 'We owe'}</div>
			<strong class="vendor">{loan.vendorName}</strong>
			<div class="product">
				{loan.productName}
				{#if !loan.itemId}<span class="tag">Not in inventory</span>{/if}
				{#if loan.carriedOverFrom}<span class="tag"
						>Carried over from "{loan.carriedOverFrom.itemName.trim()}"</span
					>{:else if loan.opening}<span class="tag">Carried over</span>{/if}
			</div>
			<div class="meta">
				{#if loan.reviewStatus === 'reviewed'}
					<span class="reviewed">
						<i class="fas fa-check" aria-hidden="true"></i> Reviewed by {loan.reviewedBy}
					</span>
				{:else}
					<span class="needs-review"><span class="dot" aria-hidden="true"></span> Needs review</span
					>
				{/if}
				<span class="status" data-status={balance.status}>{statusLabels[balance.status]}</span>
				<span>{formatDate(loan.createdAt)} · {loan.createdBy}</span>
			</div>
			{#if loan.note}<p class="note">{loan.note}</p>{/if}
		</div>
		<div class="loan-balance">
			<div class="outstanding">
				<strong>{balance.outstanding}</strong><span> / {balance.owed}</span>
			</div>
			<div class="outstanding-label">{lent ? 'units they still owe' : 'units we still owe'}</div>
			{#if balance.outstandingCents !== null}
				<div class="value">{formatCents(balance.outstandingCents)}</div>
			{/if}
			{#if loan.cashPaidCents > 0}
				<div class="paid">
					{formatCents(loan.cashPaidCents)}
					{lent ? 'received' : 'paid'}
				</div>
			{/if}
		</div>
		<div class="loan-actions">
			{#if loan.reviewStatus !== 'reviewed'}
				<button
					type="button"
					class="action"
					data-kind="review"
					disabled={!$isOnline}
					onclick={() => (settling = { loan, mode: 'review' })}
				>
					<i class="fas fa-clipboard-check" aria-hidden="true"></i> Mark reviewed
				</button>
			{/if}
			{#if balance.outstanding > 0}
				<button
					type="button"
					class="action"
					data-kind="return"
					disabled={!$isOnline}
					onclick={() => (settling = { loan, mode: 'return' })}
				>
					<i class="fas fa-box-open" aria-hidden="true"></i> Returned
				</button>
				<button
					type="button"
					class="action"
					data-kind="cash"
					disabled={!$isOnline}
					onclick={() => (settling = { loan, mode: 'cash' })}
				>
					<i class="fas fa-coins" aria-hidden="true"></i> Cash
				</button>
			{/if}
			<button
				type="button"
				class="action"
				data-kind="correct"
				disabled={!$isOnline}
				onclick={() => (settling = { loan, mode: 'correction' })}
			>
				<i class="fas fa-pen-to-square" aria-hidden="true"></i> Correct
			</button>
			<button
				type="button"
				class="action"
				data-kind="history"
				aria-expanded={expandedId === loan.id}
				onclick={() => toggleHistory(loan)}
			>
				<i class="fas fa-clock-rotate-left" aria-hidden="true"></i> History
			</button>
		</div>
		{#if expandedId === loan.id}
			<div class="history">
				{#if entries[key] === 'error'}
					<p class="error">Couldn't load this loan's history.</p>
				{:else if !entries[key]}
					<p class="muted">Loading…</p>
				{:else}
					<ol>
						{#each entries[key] as entry (entry.id)}
							<li>
								<span class="entry-label">{entryLabel(entry, loan)}</span>
								{#if entry.location}<span class="muted">· {locationLabel(entry.location)}</span
									>{/if}
								{#if entry.note}<span class="muted">· {entry.note}</span>{/if}
								<span class="entry-meta">{formatDateTime(entry.timestamp)} · {entry.user}</span>
							</li>
						{/each}
					</ol>
				{/if}
			</div>
		{/if}
	</li>
{/snippet}

{#if !ready}
	<TableSkeleton />
{:else}
	<div class="page-container">
		<section class="vendor-section">
			<header class="vendor-header">
				<div>
					<h2 class="vendor-title">Vendor balances</h2>
					<p class="vendor-sub">
						Products lent to and borrowed from other vendors, and how they were paid back
					</p>
				</div>
				<button
					type="button"
					class="primary"
					disabled={!$isOnline}
					onclick={() => (recording = true)}
				>
					<i class="fas fa-plus" aria-hidden="true"></i> Record loan
				</button>
			</header>

			{#if !$isOnline}
				<p class="banner">
					<i class="fas fa-wifi" aria-hidden="true"></i>
					You're offline. Vendor balances can be viewed but not changed until you reconnect.
				</p>
			{/if}

			<div class="summary">
				<div class="summary-sides">
					<div class="summary-side" data-direction="lent">
						<div class="summary-label">
							<i class="fas fa-hand-holding-dollar" aria-hidden="true"></i> Owed to us
						</div>
						<div class="summary-value">{formatCents(owedToUs.cents)}</div>
						<div class="summary-note">{loanCount(owedToUs)}</div>
					</div>
					<div class="summary-net">
						<div class="summary-note">Net</div>
						<strong>
							{netCents > 0 ? '+' : netCents < 0 ? '−' : ''}{formatCents(Math.abs(netCents))}
						</strong>
						<div class="summary-note">
							{netCents > 0 ? 'in our favour' : netCents < 0 ? 'in their favour' : 'even'}
						</div>
						{#if unpriced}
							<div class="summary-note">
								{unpriced}
								{unpriced === 1 ? "loan without a value isn't" : "loans without a value aren't"} counted
							</div>
						{/if}
					</div>
					<div class="summary-side summary-side-end" data-direction="borrowed">
						<div class="summary-label">
							We owe <i class="fas fa-file-invoice-dollar" aria-hidden="true"></i>
						</div>
						<div class="summary-value">{formatCents(weOwe.cents)}</div>
						<div class="summary-note">{loanCount(weOwe)}</div>
					</div>
				</div>
				<div
					class={['balance-bar', owedToUs.cents + weOwe.cents === 0 && 'empty']}
					aria-hidden="true"
				>
					{#if owedToUs.cents > 0}
						<span class="owes-us" style:flex-grow={owedToUs.cents}></span>
					{/if}
					{#if weOwe.cents > 0}
						<span class="we-owe" style:flex-grow={weOwe.cents}></span>
					{/if}
				</div>
				<div class="summary-pills">
					<span class="pill review">
						<span class="dot" aria-hidden="true"></span>
						{groups.needsReview.length}
						{groups.needsReview.length === 1 ? 'needs' : 'need'} review
					</span>
					<span class="pill">
						<i class="fas fa-store" aria-hidden="true"></i>
						{summaries.length}
						{summaries.length === 1 ? 'vendor' : 'vendors'} with something outstanding
					</span>
				</div>
			</div>

			<div class="toolbar">
				<input
					class="search"
					type="search"
					placeholder="Search vendors or products"
					aria-label="Search vendors or products"
					bind:value={search}
				/>
				<div class="segmented" role="group" aria-label="View">
					{#each tabs as option (option.value)}
						<button
							type="button"
							class="segment"
							class:active={tab === option.value}
							aria-pressed={tab === option.value}
							onclick={() => (tab = option.value)}
						>
							{option.label}
							{#if option.value !== 'vendors'}
								<span class="count">{groups[option.value].length}</span>
							{/if}
						</button>
					{/each}
				</div>
			</div>

			<div class="content">
				{#if loadFailed === 'denied'}
					<p class="empty error">
						The database refused access to vendor balances. If this page is new, its Firestore rules
						may not be deployed yet.
					</p>
				{:else if loadFailed}
					<p class="empty error">Couldn't load vendor balances. Check your connection.</p>
				{:else if !received}
					<p class="empty muted">Loading…</p>
				{:else if tab === 'vendors'}
					{#if visibleVendors.length === 0}
						<p class="empty muted">Nothing outstanding with any vendor.</p>
					{:else}
						<ul class="vendors">
							{#each visibleVendors as vendor (vendor.vendorId)}
								<li class="vendor-card">
									<h3>{vendor.vendorName}</h3>
									<ul>
										{#each vendor.lines as line (`${line.direction}|${line.productName}`)}
											<li>
												<span class="direction-chip" data-direction={line.direction}>
													{line.direction === 'lent' ? 'Owes us' : 'We owe'}
												</span>
												<span class="line-product">{line.outstanding} × {line.productName}</span>
												<span class="line-value">{formatCents(line.outstandingCents)}</span>
											</li>
										{/each}
									</ul>
								</li>
							{/each}
						</ul>
					{/if}
				{:else if visibleLoans.length === 0}
					<p class="empty muted">
						{needle
							? 'No loans match your search.'
							: {
									owedToUs: 'Nobody owes us anything right now.',
									weOwe: "We don't owe anyone right now.",
									needsReview: 'Everything has been reviewed.',
									settled: 'No settled loans yet.'
								}[tab]}
					</p>
				{:else}
					<ul class="loans">
						{#each visibleLoans as loan (loan.id)}
							{@render loanCard(loan)}
						{/each}
					</ul>
				{/if}
			</div>
		</section>
	</div>
{/if}

{#if recording}
	<VendorLoanDialog {items} {vendorNames} onsave={save} onclose={() => (recording = false)} />
{/if}

{#if settling}
	<VendorSettleDialog
		loan={settling.loan}
		item={itemFor(settling.loan)}
		mode={settling.mode}
		onsave={save}
		onclose={() => (settling = null)}
	/>
{/if}

<style>
	.page-container {
		max-width: 95%;
		margin: 0 auto;
		padding: 1rem;
		min-height: 100vh;
		width: 100%;
	}

	.vendor-section {
		--soft: color-mix(in srgb, var(--text-color) 7%, transparent);
		background: var(--container-bg);
		border-radius: var(--border-radius);
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
		border: 1px solid var(--table-border-color);
		overflow: hidden;
	}

	/* One colour for "owes us" and one for "we owe", wherever direction appears. */
	[data-direction='lent'] {
		--dir: var(--vendor-owes-us);
		--dir-bg: var(--vendor-owes-us-bg);
	}

	[data-direction='borrowed'] {
		--dir: var(--vendor-we-owe);
		--dir-bg: var(--vendor-we-owe-bg);
	}

	/* Direction-coloured text leans toward the body colour so it stays readable in
	   both themes, including on its own tint. */
	[data-direction] {
		--dir-ink: color-mix(in srgb, var(--dir) 78%, var(--text-color));
	}

	.vendor-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.5rem 1rem;
		padding: 0.85rem 1.25rem;
		background: var(--table-header-bg);
		border-bottom: 1px solid var(--table-border-color);
	}

	.vendor-title {
		margin: 0;
		font-size: 1.15rem;
		font-weight: var(--font-weight-bold);
		letter-spacing: -0.025em;
		color: var(--text-color);
	}

	.vendor-sub {
		margin: 0.15rem 0 0;
		font-size: 0.78rem;
		color: var(--text-color-dimmed);
	}

	button {
		font: inherit;
		cursor: pointer;
	}

	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	button:focus-visible,
	.search:focus-visible {
		outline: 2px solid var(--add-item-color);
		outline-offset: 2px;
	}

	.primary {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		min-height: 2.5rem;
		padding: 0.5rem 1rem;
		border-radius: var(--border-radius);
		border: 1.5px solid var(--add-item-color);
		color: var(--add-item-on);
		background: var(--add-item-color);
		font-size: 0.88rem;
		font-weight: 700;
		transition: filter 0.15s ease-out;
	}

	.primary:hover:not(:disabled) {
		filter: brightness(1.08);
	}

	.banner {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0;
		padding: 0.6rem 1.25rem;
		font-size: 0.82rem;
		font-weight: 600;
		color: var(--danger-text);
		background: var(--nav-danger-surface);
		border-bottom: 1px solid var(--table-border-color);
	}

	/* Summary: what each side owes, the net, and a bar comparing the two. */

	.summary {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
		padding: 1rem 1.25rem;
		border-bottom: 1px solid var(--table-border-color);
	}

	.summary-sides {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
		align-items: end;
		gap: 1rem;
	}

	.summary-side {
		min-width: 0;
	}

	.summary-side-end {
		text-align: right;
	}

	.summary-label {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--dir-ink);
	}

	.summary-side-end .summary-label {
		justify-content: flex-end;
	}

	.summary-value {
		margin-top: 0.3rem;
		font-size: 1.5rem;
		font-weight: 800;
		letter-spacing: -0.02em;
		color: var(--text-color);
		font-variant-numeric: tabular-nums;
		overflow-wrap: anywhere;
	}

	.summary-note {
		font-size: 0.72rem;
		font-weight: 500;
		color: var(--text-color-dimmed);
	}

	.summary-net {
		text-align: center;
	}

	.summary-net strong {
		display: block;
		font-size: 1.05rem;
		color: var(--text-color);
		font-variant-numeric: tabular-nums;
	}

	.balance-bar {
		display: flex;
		gap: 3px;
		height: 10px;
	}

	.balance-bar.empty {
		border-radius: 999px;
		background: var(--soft);
	}

	.balance-bar span {
		flex: 1 1 0;
		border-radius: 999px;
	}

	.balance-bar .owes-us {
		background: var(--vendor-owes-us);
	}

	.balance-bar .we-owe {
		background: var(--vendor-we-owe);
	}

	.summary-pills {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.pill {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.2rem 0.65rem;
		border-radius: 999px;
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--text-color-dimmed);
		background: var(--soft);
	}

	.pill.review {
		color: var(--review-color);
		background: var(--review-bg);
	}

	.toolbar {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.625rem;
		padding: 0.75rem 1.25rem;
		border-bottom: 1px solid var(--table-border-color);
	}

	.search {
		flex: 1;
		min-width: 180px;
		min-height: 2.4rem;
		padding: 0.45rem 0.75rem;
		border: 1px solid var(--input-border-color, var(--table-border-color));
		border-radius: var(--border-radius);
		color: var(--text-color);
		background: var(--input-bg, var(--container-bg));
		font: inherit;
		font-size: 0.88rem;
	}

	.search::placeholder {
		color: var(--placeholder-text);
	}

	.segmented {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.segment {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.4rem 0.8rem;
		border: 1px solid var(--table-border-color);
		border-radius: var(--border-radius);
		color: var(--text-color);
		background: var(--container-bg);
		font-size: 0.78rem;
		font-weight: 500;
		transition:
			background-color 0.15s ease-out,
			border-color 0.15s ease-out,
			color 0.15s ease-out;
	}

	.segment:hover:not(.active) {
		background: var(--hover-bg-color);
		border-color: var(--hover-border-color);
	}

	.segment.active {
		color: var(--add-item-on);
		background: var(--add-item-color);
		border-color: var(--add-item-color);
	}

	.count {
		min-width: 1.3rem;
		padding: 0 0.3rem;
		border-radius: 999px;
		font-size: 0.7rem;
		font-weight: 700;
		text-align: center;
		background: color-mix(in srgb, currentColor 14%, transparent);
	}

	.content {
		padding: 1rem 1.25rem 1.25rem;
	}

	.empty {
		margin: 1.5rem 0;
		text-align: center;
		font-size: 0.9rem;
	}

	.muted {
		color: var(--text-color-dimmed);
	}

	.error {
		color: var(--danger-text);
	}

	.loans,
	.vendors {
		display: grid;
		gap: 0.6rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.loans {
		grid-template-columns: minmax(0, 1fr);
		/* Each card keeps its own height, so opening one card's history doesn't
		   stretch the card beside it. */
		align-items: start;
	}

	.vendors {
		grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
	}

	/* Loan cards */

	.loan {
		display: grid;
		grid-template-columns: 2.75rem minmax(0, 1fr) auto;
		gap: 0.35rem 1rem;
		padding: 0.85rem 1rem;
		border: 1px solid var(--table-border-color);
		border-radius: 12px;
		background: var(--container-bg);
	}

	.avatar {
		position: relative;
		display: grid;
		place-items: center;
		width: 2.75rem;
		height: 2.75rem;
		border-radius: 50%;
		font-size: 0.85rem;
		font-weight: 800;
		color: var(--dir-ink);
		background: var(--dir-bg);
	}

	.avatar-badge {
		position: absolute;
		right: -0.2rem;
		bottom: -0.2rem;
		display: grid;
		place-items: center;
		width: 1.2rem;
		height: 1.2rem;
		border-radius: 50%;
		font-size: 0.6rem;
		color: var(--container-bg);
		background: var(--dir);
		border: 2px solid var(--container-bg);
	}

	.loan-main {
		min-width: 0;
	}

	.loan-direction {
		font-size: 0.72rem;
		font-weight: 700;
		color: var(--dir-ink);
	}

	.vendor {
		font-size: 1rem;
		color: var(--text-color);
		overflow-wrap: anywhere;
	}

	.product {
		margin-top: 0.3rem;
		font-size: 0.92rem;
		font-weight: 600;
		color: var(--text-color);
		overflow-wrap: anywhere;
	}

	.tag {
		margin-left: 0.35rem;
		padding: 0.05rem 0.4rem;
		border-radius: 4px;
		font-size: 0.68rem;
		font-weight: 600;
		color: var(--text-color-dimmed);
		background: var(--soft);
	}

	.meta {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.4rem 0.6rem;
		margin-top: 0.45rem;
		font-size: 0.74rem;
		color: var(--text-color-dimmed);
	}

	.needs-review {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-weight: 700;
		color: var(--review-color);
	}

	.reviewed {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-weight: 600;
	}

	.status[data-status='settled'] {
		font-weight: 600;
		color: var(--event-add);
	}

	.dot {
		display: inline-block;
		width: 0.4rem;
		height: 0.4rem;
		border-radius: 50%;
		background: currentColor;
	}

	.note {
		margin: 0.45rem 0 0;
		font-size: 0.8rem;
		color: var(--text-color-dimmed);
		overflow-wrap: anywhere;
	}

	.loan-balance {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	.outstanding strong {
		font-size: 1.6rem;
		line-height: 1.1;
		color: var(--text-color);
	}

	.outstanding span {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--text-color-dimmed);
	}

	.outstanding-label,
	.paid {
		font-size: 0.72rem;
		color: var(--text-color-dimmed);
	}

	.outstanding-label {
		font-weight: 600;
	}

	.value {
		margin-top: 0.15rem;
		font-size: 0.9rem;
		font-weight: 700;
		color: var(--text-color);
	}

	.loan-actions {
		grid-column: 2 / -1;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
		margin-top: 0.4rem;
	}

	/* Each action has its own colour: a tint with coloured text and icon. */
	.action {
		--tone: var(--text-color);
		--tone-bg: var(--soft);
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		min-height: 2.1rem;
		padding: 0.3rem 0.7rem;
		border: 1px solid color-mix(in srgb, var(--tone) 28%, transparent);
		border-radius: var(--border-radius);
		color: color-mix(in srgb, var(--tone) 78%, var(--text-color));
		background: var(--tone-bg);
		font-size: 0.78rem;
		font-weight: 600;
		white-space: nowrap;
		transition:
			background-color 0.15s ease-out,
			border-color 0.15s ease-out,
			color 0.15s ease-out;
	}

	.action i {
		color: var(--tone);
	}

	.action:hover:not(:disabled) {
		background: color-mix(in srgb, var(--tone) 16%, var(--tone-bg));
		border-color: color-mix(in srgb, var(--tone) 55%, transparent);
	}

	.action[data-kind='review'] {
		--tone: var(--review-color);
		--tone-bg: var(--review-bg);
	}

	.action[data-kind='return'] {
		--tone: var(--event-create);
		--tone-bg: var(--event-create-bg);
	}

	.action[data-kind='cash'] {
		--tone: var(--event-add);
		--tone-bg: var(--event-add-bg);
	}

	.action[data-kind='correct'] {
		--tone: var(--event-delete);
		--tone-bg: var(--event-delete-bg);
	}

	.action[data-kind='history'] {
		margin-left: auto;
		color: var(--text-color-dimmed);
		border-color: transparent;
		background: transparent;
	}

	.action[data-kind='history'] i {
		color: inherit;
	}

	.action[data-kind='history']:hover:not(:disabled),
	.action[data-kind='history'][aria-expanded='true'] {
		color: var(--text-color);
		border-color: transparent;
		background: var(--hover-bg-color);
	}

	.history {
		grid-column: 2 / -1;
		padding: 0.6rem 0.75rem;
		border-radius: 8px;
		background: var(--table-header-bg);
		border: 1px solid var(--table-border-color);
		font-size: 0.8rem;
	}

	.history p {
		margin: 0;
	}

	.history ol {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		margin: 0;
		padding-left: 1.1rem;
	}

	.entry-label {
		font-weight: 600;
		color: var(--text-color);
	}

	.entry-meta {
		display: block;
		font-size: 0.72rem;
		color: var(--text-color-dimmed);
	}

	/* By vendor */

	.vendor-card {
		padding: 0.85rem 1rem;
		border: 1px solid var(--table-border-color);
		border-radius: 10px;
	}

	.vendor-card h3 {
		margin: 0 0 0.5rem;
		font-size: 1rem;
		color: var(--text-color);
	}

	.vendor-card ul {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.vendor-card li {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.84rem;
	}

	.direction-chip {
		padding: 0.1rem 0.5rem;
		border-radius: 999px;
		font-size: 0.72rem;
		font-weight: 700;
		white-space: nowrap;
		color: var(--dir-ink);
		background: var(--dir-bg);
	}

	.line-product {
		color: var(--text-color);
		overflow-wrap: anywhere;
	}

	.line-value {
		font-weight: 700;
		color: var(--text-color);
		font-variant-numeric: tabular-nums;
	}

	@media (pointer: coarse) {
		.action,
		.segment {
			min-height: 2.75rem;
		}
	}

	/* Two columns on wide screens, so cards don't stretch into empty space. */
	@media (min-width: 1280px) {
		.loans {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (max-width: 640px) {
		.page-container {
			max-width: 100%;
			padding: 0.5rem;
		}

		.vendor-header,
		.summary,
		.toolbar,
		.content {
			padding-left: 0.75rem;
			padding-right: 0.75rem;
		}

		.summary-sides {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		}

		.summary-net {
			grid-column: 1 / -1;
			order: 3;
		}

		.summary-value {
			font-size: 1.2rem;
		}

		.loan {
			grid-template-columns: 2.25rem minmax(0, 1fr) auto;
			gap: 0.35rem 0.7rem;
			padding: 0.75rem 0.8rem;
		}

		.avatar {
			width: 2.25rem;
			height: 2.25rem;
			font-size: 0.75rem;
		}

		.outstanding strong {
			font-size: 1.35rem;
		}

		.loan-actions,
		.history {
			grid-column: 1 / -1;
		}

		/* Buttons share each row instead of leaving a ragged edge. */
		.loan-actions .action {
			flex: 1 1 auto;
			justify-content: center;
		}

		.action[data-kind='history'] {
			margin-left: 0;
		}
	}
</style>
