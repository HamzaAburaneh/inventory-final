<script>
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import { itemStore } from '../../stores/itemStore.js';
	import { notificationStore } from '../../stores/notificationStore.js';
	import { fetchStockPredictions } from '../../lib/predictionsClient.js';
	import {
		classifyOrderUrgency,
		reorderByDate,
		stockOutDate,
		suggestedOrderQty
	} from '../../lib/predictionCore.js';
	import { dayFromKey, torontoDayKey } from '../../lib/cneCalendar.js';

	// The "coming up" window after today's order cutoff (see classifyOrderUrgency).
	const UPCOMING_LOOKAHEAD_DAYS = 3;
	const COVERAGE_MIN = 1;
	const COVERAGE_MAX = 7;
	const LEAD_MIN = 0;
	const LEAD_MAX = 3;
	// 14 days always covers the worst stepper case (lead 3 + coverage 7 = 10).
	const FORECAST_DAYS = 14;

	let predictions = $state.raw({});
	let loading = $state(true);
	let error = $state('');
	let coverageDays = $state(2);
	let leadDays = $state(1);
	// Per-item user edits: { [itemId]: { qty?: number, included?: boolean } }.
	let overrides = $state({});
	let copied = $state(false);
	let copyFallbackText = $state('');

	// Realtime item counts — quantities and grouping recompute as the team logs
	// sales, without refetching the forecast.
	const items = $derived($itemStore);

	async function loadData() {
		try {
			loading = true;
			const [, fetched] = await Promise.all([
				itemStore.fetchItems(),
				fetchStockPredictions({ forecastDays: FORECAST_DAYS, useAI: false })
			]);
			predictions = fetched;
			error = '';
		} catch (err) {
			console.error('Error loading order data:', err);
			error = 'Failed to load the order plan. Please try again.';
			notificationStore.showNotification('Failed to load the order plan.', 'error');
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		loadData();
	});

	const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const MONTHS = [
		'Jan',
		'Feb',
		'Mar',
		'Apr',
		'May',
		'Jun',
		'Jul',
		'Aug',
		'Sep',
		'Oct',
		'Nov',
		'Dec'
	];

	// e.g. "Fri Aug 21" — parse day keys as LOCAL dates (never `new Date(key)`,
	// which is UTC and shifts the weekday in Toronto's negative offset).
	function formatDayKey(key) {
		if (typeof key !== 'string' || !key) return '';
		const d = dayFromKey(key);
		return `${WEEKDAYS[d.getDay()]} ${MONTHS[d.getMonth()]} ${d.getDate()}`;
	}

	// Confidence arrives as { score, level, basis }; tolerate a bare legacy number.
	function normalizeConfidence(raw) {
		if (raw && typeof raw === 'object' && raw.level) return raw;
		if (typeof raw === 'number') {
			const level = raw >= 0.65 ? 'high' : raw >= 0.4 ? 'medium' : 'low';
			return { score: raw, level, basis: '' };
		}
		return { score: 0, level: 'low', basis: '' };
	}

	const CONFIDENCE_META = {
		high: { label: 'High confidence', cls: 'conf-high' },
		medium: { label: 'Medium confidence', cls: 'conf-medium' },
		low: { label: 'Low confidence', cls: 'conf-low' }
	};

	// The forecast window's day keys are shared by every item — grab any entry's.
	const forecastDates = $derived.by(() => {
		for (const p of Object.values(predictions)) {
			if (Array.isArray(p?.forecastDates) && p.forecastDates.length > 0) return p.forecastDates;
		}
		return [];
	});

	// Pre-fair the server anchors the window at opening day, not today.
	const planStartsLater = $derived(
		forecastDates.length > 0 && forecastDates[0] > torontoDayKey(new Date())
	);

	// One row per item that has a forecast. reorderBy/stockOut are recomputed
	// here from the LIVE count (the server baked in the count at fetch time),
	// so grouping, run-out dates and quantities all agree with current stock.
	const rows = $derived.by(() => {
		const out = [];
		for (const item of items) {
			const p = predictions[item.id];
			if (!p || !Array.isArray(p.prediction)) continue;
			const count = Math.max(0, Number(item.count) || 0);
			const reorderBy = reorderByDate(count, item.lowCount, p.prediction, p.forecastDates);
			const runOut = stockOutDate(count, p.prediction, p.forecastDates);
			const group = classifyOrderUrgency(reorderBy, {
				leadDays,
				lookaheadDays: UPCOMING_LOOKAHEAD_DAYS
			});
			const suggested = suggestedOrderQty(count, item.lowCount, p.prediction, {
				coverageDays,
				leadDays
			});
			const ov = overrides[item.id] ?? {};
			out.push({
				id: item.id,
				name: item.name,
				count,
				cost: Number(item.cost) || 0,
				suggested,
				qty: ov.qty ?? suggested,
				edited: ov.qty !== undefined,
				included: ov.included ?? (group === 'urgent' || group === 'today'),
				group,
				reorderBy,
				runOut,
				confidence: normalizeConfidence(p.confidence)
			});
		}
		return out.sort((a, b) => {
			const ai = a.reorderBy ? a.reorderBy.dayIndex : Infinity;
			const bi = b.reorderBy ? b.reorderBy.dayIndex : Infinity;
			return ai - bi || a.name.localeCompare(b.name);
		});
	});

	const urgent = $derived(rows.filter((r) => r.group === 'urgent'));
	const todays = $derived(rows.filter((r) => r.group === 'today'));
	const upcoming = $derived(rows.filter((r) => r.group === 'upcoming'));
	const healthy = $derived(rows.filter((r) => r.group === 'ok'));
	const missingForecast = $derived(Math.max(0, items.length - rows.length));

	// Pre-fair every item is "at/below low stock" but most have zero predicted
	// demand — so the actionable count is the rows that actually need cases.
	const todayActionable = $derived(
		urgent.filter((r) => r.qty > 0).length + todays.filter((r) => r.qty > 0).length
	);
	// Zero-order rows are collapsed per section to keep the list short.
	let showZeros = $state({ urgent: false, today: false, upcoming: false });

	function splitRows(groupRows) {
		const active = groupRows
			.filter((r) => r.qty > 0)
			.sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name));
		const zeros = groupRows.filter((r) => r.qty === 0);
		return { active, zeros };
	}

	const checked = $derived(rows.filter((r) => r.included && r.qty > 0));
	const totalCases = $derived(checked.reduce((s, r) => s + r.qty, 0));
	const totalCost = $derived(checked.reduce((s, r) => s + r.qty * r.cost, 0));

	const deliveryKey = $derived(
		forecastDates.length > 0 ? forecastDates[Math.min(leadDays, forecastDates.length - 1)] : ''
	);
	const nextDue = $derived(upcoming.length > 0 ? upcoming[0].reorderBy : null);

	// An edited quantity was reasoned under the old lead/coverage assumptions —
	// silently keeping it would misstate the totals, so stepper changes drop the
	// qty edits (checkbox choices survive).
	function clearQtyOverrides() {
		for (const key of Object.keys(overrides)) {
			if (overrides[key].qty !== undefined) delete overrides[key].qty;
		}
	}

	function stepCoverage(delta) {
		const next = Math.min(COVERAGE_MAX, Math.max(COVERAGE_MIN, coverageDays + delta));
		if (next === coverageDays) return;
		coverageDays = next;
		clearQtyOverrides();
	}

	function stepLead(delta) {
		const next = Math.min(LEAD_MAX, Math.max(LEAD_MIN, leadDays + delta));
		if (next === leadDays) return;
		leadDays = next;
		clearQtyOverrides();
	}

	function setQtyOverride(row, qty) {
		if (qty === row.suggested) {
			resetQty(row.id);
			return;
		}
		overrides[row.id] = { ...(overrides[row.id] ?? {}), qty };
	}

	function resetQty(id) {
		if (overrides[id]?.qty !== undefined) delete overrides[id].qty;
	}

	function onQtyInput(row, event) {
		const parsed = parseInt(event.currentTarget.value, 10);
		if (Number.isFinite(parsed) && parsed >= 0) setQtyOverride(row, parsed);
	}

	// Invalid/empty input falls back to the suggestion; always renormalize the
	// field text so it matches the number actually counted in the totals.
	function onQtyBlur(row, event) {
		const parsed = parseInt(event.currentTarget.value, 10);
		if (!Number.isFinite(parsed) || parsed < 0) resetQty(row.id);
		const final = overrides[row.id]?.qty ?? row.suggested;
		event.currentTarget.value = String(final);
	}

	function toggleIncluded(row, event) {
		overrides[row.id] = { ...(overrides[row.id] ?? {}), included: event.currentTarget.checked };
	}

	function runOutLabel(row) {
		if (!row.runOut) return `> ${FORECAST_DAYS}d`;
		if (forecastDates.length > 0 && row.runOut.date === forecastDates[0]) return 'today';
		return formatDayKey(row.runOut.date);
	}

	function buildOrderSheet() {
		const lines = [];
		lines.push(
			`GFS ORDER — ${formatDayKey(forecastDates[0])} (delivery ${formatDayKey(deliveryKey)})`
		);
		const groups = [
			['URGENT', 'urgent'],
			['TODAY', 'today'],
			['UPCOMING', 'upcoming'],
			['LATER', 'ok']
		];
		for (const [label, key] of groups) {
			const groupRows = checked.filter((r) => r.group === key);
			if (groupRows.length === 0) continue;
			lines.push('');
			lines.push(label);
			for (const r of groupRows) {
				const runOut = r.runOut ? `out ${runOutLabel(r)}` : 'no run-out forecast';
				lines.push(
					`  ${String(r.qty).padStart(3)} x ${r.name.padEnd(24)} (on hand ${r.count}, ${runOut})`
				);
			}
		}
		lines.push('');
		lines.push(`${checked.length} items · ${totalCases} cases · est. $${totalCost.toFixed(2)}`);
		return lines.join('\n');
	}

	let copyTimer = null;

	async function copyOrder() {
		const sheet = buildOrderSheet();
		try {
			await navigator.clipboard.writeText(sheet);
			copied = true;
			copyFallbackText = '';
			clearTimeout(copyTimer);
			copyTimer = setTimeout(() => (copied = false), 1500);
		} catch (err) {
			console.error('Clipboard write failed:', err);
			copyFallbackText = sheet;
			notificationStore.showNotification(
				'Copy failed — select the text below and copy manually.',
				'error'
			);
		}
	}

	// Entrances are fade+lift; skip them entirely for reduced-motion users.
	const reduceMotion =
		typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const sectionIn = $derived({ y: 12, duration: reduceMotion ? 0 : 300 });

	const SECTIONS = $derived([
		{
			key: 'urgent',
			tone: 'tone-urgent',
			title: 'Urgent — top up now',
			sub: "At or below low stock — don't wait for the truck.",
			rows: urgent
		},
		{
			key: 'today',
			tone: 'tone-today',
			title: "Today's GFS order",
			sub: `Order today — with a ${leadDays}-day lead, waiting means running short.`,
			rows: todays
		},
		{
			key: 'upcoming',
			tone: 'tone-upcoming',
			title: 'Coming up',
			sub: `Due within ${UPCOMING_LOOKAHEAD_DAYS} days after today's cutoff.`,
			rows: upcoming
		}
	]);
</script>

<svelte:head>
	<title>Today's Order - StockSense</title>
</svelte:head>

{#snippet colHead()}
	<div class="col-head" aria-hidden="true">
		<span></span>
		<span>Item</span>
		<span class="num">On hand</span>
		<span class="num">Order</span>
		<span class="num">Runs out</span>
		<span></span>
	</div>
{/snippet}

{#snippet orderRow(row)}
	<div class="order-row" class:skipped={!row.included} class:is-zero={row.qty === 0}>
		<label class="cell-check">
			<input
				type="checkbox"
				checked={row.included}
				onchange={(e) => toggleIncluded(row, e)}
				aria-label={`Include ${row.name} in the order`}
			/>
		</label>
		<div class="cell-name">
			<span class="item-name">{row.name}</span>
			{#if row.edited}
				<button class="reset-qty" onclick={() => resetQty(row.id)} title="Reset to suggested">
					edited
					<span aria-hidden="true">&times;</span>
				</button>
			{/if}
		</div>
		<div class="cell-onhand">
			<span class="cell-cap">On hand</span>
			<span class="cell-val">{row.count}</span>
		</div>
		<div class="cell-qty">
			<span class="cell-cap">Order</span>
			<input
				type="number"
				min="0"
				step="1"
				inputmode="numeric"
				value={row.qty}
				disabled={!row.included}
				oninput={(e) => onQtyInput(row, e)}
				onblur={(e) => onQtyBlur(row, e)}
				aria-label={`Cases of ${row.name} to order`}
			/>
		</div>
		<div class="cell-runout">
			<span class="cell-cap">Runs out</span>
			<span class="cell-val" class:runout-now={row.group === 'urgent' && row.qty > 0}>
				{runOutLabel(row)}
			</span>
		</div>
		<div class="cell-conf">
			<span
				class="conf-dot {CONFIDENCE_META[row.confidence.level].cls}"
				title={row.confidence.basis || CONFIDENCE_META[row.confidence.level].label}
			></span>
			<span class="sr-only">{CONFIDENCE_META[row.confidence.level].label}</span>
		</div>
	</div>
{/snippet}

{#snippet group(cfg)}
	{@const parts = splitRows(cfg.rows)}
	{#if parts.active.length > 0 || parts.zeros.length > 0}
		<div class="group {cfg.tone}">
			<div class="group-head">
				<span class="sec-dot" aria-hidden="true"></span>
				<span class="group-title">{cfg.title}</span>
				<span class="sec-count">{parts.active.length}</span>
				<span class="group-sub">{cfg.sub}</span>
			</div>

			{#each parts.active as row (row.id)}
				{@render orderRow(row)}
			{/each}

			{#if parts.zeros.length > 0}
				<button
					class="zero-toggle"
					onclick={() => (showZeros[cfg.key] = !showZeros[cfg.key])}
					aria-expanded={showZeros[cfg.key]}
				>
					<span class="chev" class:open={showZeros[cfg.key]} aria-hidden="true">&#9656;</span>
					{showZeros[cfg.key] ? 'Hide' : 'Show'}
					{parts.zeros.length}
					{parts.zeros.length === 1 ? 'item' : 'items'} with nothing to order
				</button>
				{#if showZeros[cfg.key]}
					{#each parts.zeros as row (row.id)}
						{@render orderRow(row)}
					{/each}
				{/if}
			{/if}
		</div>
	{/if}
{/snippet}

<div class="orders-page">
	<header class="page-header">
		<h1>Today's Order</h1>
		{#if forecastDates.length > 0}
			<p class="date-line">
				Order for <strong>{formatDayKey(forecastDates[0])}</strong>
				<span class="dot">&middot;</span> delivery {formatDayKey(deliveryKey)}
			</p>
			{#if planStartsLater}
				<p class="prefair-note">
					Plan starts {formatDayKey(forecastDates[0])} — fair hasn't opened yet.
				</p>
			{/if}
		{/if}
	</header>

	<div class="controls-card">
		<div class="stepper-group">
			<span class="control-label" id="coverage-label">Coverage</span>
			<div class="stepper" role="group" aria-labelledby="coverage-label">
				<button
					aria-label="Decrease coverage days"
					onclick={() => stepCoverage(-1)}
					disabled={coverageDays <= COVERAGE_MIN}>&minus;</button
				>
				<span class="stepper-value" aria-live="polite">
					<strong>{coverageDays}</strong>
					<span class="stepper-unit">{coverageDays === 1 ? 'day' : 'days'}</span>
				</span>
				<button
					aria-label="Increase coverage days"
					onclick={() => stepCoverage(1)}
					disabled={coverageDays >= COVERAGE_MAX}>+</button
				>
			</div>
		</div>
		<div class="stepper-group">
			<span class="control-label" id="lead-label">Delivery lead</span>
			<div class="stepper" role="group" aria-labelledby="lead-label">
				<button
					aria-label="Decrease lead days"
					onclick={() => stepLead(-1)}
					disabled={leadDays <= LEAD_MIN}>&minus;</button
				>
				<span class="stepper-value" aria-live="polite">
					<strong>{leadDays}</strong>
					<span class="stepper-unit">{leadDays === 1 ? 'day' : 'days'}</span>
				</span>
				<button
					aria-label="Increase lead days"
					onclick={() => stepLead(1)}
					disabled={leadDays >= LEAD_MAX}>+</button
				>
			</div>
		</div>
		<button class="refresh-btn" onclick={loadData} disabled={loading}>
			{loading ? 'Refreshing…' : 'Refresh'}
		</button>
	</div>

	{#if !loading && !error && rows.length > 0}
		<div class="summary-bar">
			<p class="totals">
				<strong>{checked.length}</strong>
				{checked.length === 1 ? 'item' : 'items'}
				<span class="dot">&middot;</span>
				<strong>{totalCases}</strong>
				{totalCases === 1 ? 'case' : 'cases'}
				<span class="dot">&middot;</span>
				est. <span class="est-cost">${totalCost.toFixed(2)}</span>
			</p>
			<button class="copy-btn" onclick={copyOrder} disabled={checked.length === 0}>
				{copied ? 'Copied ✓' : 'Copy order'}
			</button>
		</div>
	{/if}

	{#if loading}
		<div class="skeleton-list">
			{#each Array(5) as _, i (i)}
				<div class="skeleton-row animate-pulse">
					<div class="skeleton-bar w-40"></div>
					<div class="skeleton-bar w-10"></div>
					<div class="skeleton-bar w-14"></div>
				</div>
			{/each}
		</div>
	{:else if error}
		<div class="error-box">
			<p>{error}</p>
			<button class="retry-btn" onclick={loadData}>Retry</button>
		</div>
	{:else if rows.length === 0}
		<p class="no-data">No forecast data yet — add items and log some sales first.</p>
	{:else}
		{#if todayActionable === 0}
			<div class="all-clear" in:fly={sectionIn}>
				<span class="ac-check" aria-hidden="true">✓</span>
				<p>
					<strong>Nothing needs ordering today.</strong>
					{#if nextDue}
						Next item due {formatDayKey(nextDue.date)}.
					{/if}
				</p>
			</div>
		{/if}

		<div class="table-card" in:fly={sectionIn}>
			<div class="table-scroll">
				{@render colHead()}
				{#each SECTIONS as cfg (cfg.key)}
					{@render group(cfg)}
				{/each}
			</div>
		</div>

		{#if healthy.length > 0 || missingForecast > 0}
			<p class="healthy-line">
				{#if healthy.length > 0}
					{healthy.length}
					{healthy.length === 1 ? 'item is' : 'items are'} stocked past the next
					{leadDays + UPCOMING_LOOKAHEAD_DAYS} days.
				{/if}
				{#if missingForecast > 0}
					{missingForecast}
					{missingForecast === 1 ? 'item has' : 'items have'} no forecast yet.
				{/if}
			</p>
		{/if}

		{#if copyFallbackText}
			<textarea class="copy-fallback" readonly rows="8">{copyFallbackText}</textarea>
		{/if}
	{/if}
</div>

<style>
	/* Palette mirrors ItemCardMobile: hairline outlined surfaces in light, filled
	   in dark, with proper muted-label colors. Local props default to light and
	   flip under [data-theme='dark'] — no pure-black borders, no #727272 text. */
	.orders-page {
		--ord-border: #e4e7eb;
		--ord-divider: #eef0f3;
		--ord-label: #6b7280;
		--ord-dim: #9aa1ac;
		--ord-hover: #f5f7f9;
		--ord-soft: #f3f5f7;

		/* The layout centers pages in a flex row, where items shrink to content
		   width — so width:100% is required to fill out to max-width. Capped at a
		   comfortable reading width (a full-bleed table with few columns just
		   spreads the columns apart). */
		width: 100%;
		max-width: 1180px;
		margin: 0 auto;
		padding: 1.25rem 0 3rem;
		color: var(--text-color);
	}

	:global([data-theme='dark']) .orders-page {
		--ord-border: #343434;
		--ord-divider: #2b2b2b;
		--ord-label: #a8adb5;
		--ord-dim: #6f757d;
		--ord-hover: #1d1d1d;
		--ord-soft: #242424;
	}

	/* --- Header --- */
	.page-header {
		margin-bottom: 1.1rem;
	}

	.page-header h1 {
		font-size: var(--text-2xl);
		font-weight: 700;
		margin: 0 0 0.15rem;
	}

	.date-line {
		font-size: var(--text-sm);
		color: var(--ord-label);
		margin: 0;
	}

	.date-line strong {
		color: var(--text-color);
		font-weight: 600;
	}

	.dot {
		color: var(--ord-dim);
		margin: 0 0.15rem;
	}

	.prefair-note {
		margin: 0.3rem 0 0;
		font-size: var(--text-xs);
		color: var(--ord-dim);
		font-style: italic;
	}

	/* --- Controls --- */
	.controls-card {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 0.85rem;
		margin-bottom: 0.85rem;
		padding: 0.85rem 0.9rem;
		background: var(--container-bg);
		border: 1px solid var(--ord-border);
		border-radius: 0.75rem;
	}

	.stepper-group {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.control-label {
		font-size: var(--text-xs);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--ord-label);
	}

	.stepper {
		display: flex;
		align-items: center;
		background: var(--ord-soft);
		border: 1px solid var(--ord-border);
		border-radius: 0.6rem;
		padding: 2px;
	}

	.stepper button {
		min-width: 2.2rem;
		height: 2.2rem;
		border: none;
		border-radius: 0.45rem;
		background: transparent;
		color: var(--text-color);
		font-size: 1.2rem;
		line-height: 1;
		cursor: pointer;
		transition: background-color 0.15s ease-out;
	}

	.stepper button:hover:not(:disabled) {
		background: var(--ord-hover);
	}

	.stepper button:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}

	.stepper-value {
		min-width: 4.2rem;
		text-align: center;
		font-variant-numeric: tabular-nums;
	}

	.stepper-value strong {
		font-size: 1.05rem;
		font-weight: 700;
	}

	.stepper-unit {
		font-size: var(--text-xs);
		color: var(--ord-label);
		margin-left: 0.25rem;
	}

	.refresh-btn,
	.retry-btn {
		margin-left: auto;
		height: 2.4rem;
		padding: 0 1rem;
		border: 1px solid var(--ord-border);
		border-radius: 0.5rem;
		background: transparent;
		color: var(--text-color);
		font-size: var(--text-sm);
		cursor: pointer;
		transition: background-color 0.15s ease-out;
	}

	.refresh-btn:hover:not(:disabled),
	.retry-btn:hover {
		background: var(--ord-hover);
	}

	.refresh-btn:disabled {
		opacity: 0.55;
		cursor: wait;
	}

	/* --- Summary bar --- */
	.summary-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1.1rem;
		padding: 0.7rem 0.9rem;
		background: var(--container-bg);
		border: 1px solid var(--ord-border);
		border-radius: 0.75rem;
	}

	.totals {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--ord-label);
	}

	.totals strong {
		color: var(--text-color);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.est-cost {
		color: var(--value-color);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.copy-btn {
		height: 2.3rem;
		padding: 0 1.15rem;
		border: none;
		border-radius: 0.5rem;
		background: var(--add-item-color);
		color: var(--add-item-on);
		font-size: var(--text-sm);
		font-weight: 600;
		cursor: pointer;
		white-space: nowrap;
		transition: filter 0.15s ease-out;
	}

	.copy-btn:hover:not(:disabled) {
		filter: brightness(1.08);
	}

	.copy-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* --- Scrollable table (mirrors Table.svelte: bounded height, sticky head) --- */
	.table-card {
		background: var(--container-bg);
		border: 1px solid var(--ord-border);
		border-radius: 0.75rem;
		overflow: hidden;
	}

	.table-scroll {
		max-height: min(62vh, 40rem);
		overflow-y: auto;
		overflow-x: hidden;
		-webkit-overflow-scrolling: touch;
	}

	/* --- Group band (urgency section header inside the table) --- */
	.group {
		--tone: var(--ord-label);
	}

	.tone-urgent {
		--tone: var(--observatory-remove);
	}

	.tone-today {
		--tone: var(--observatory-warn);
	}

	.group-head {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.9rem;
		background: color-mix(in srgb, var(--tone) 9%, var(--container-bg));
		border-top: 1px solid var(--ord-border);
		border-bottom: 1px solid var(--ord-divider);
	}

	.sec-dot {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		background: var(--tone);
		flex: none;
	}

	.group-title {
		font-size: var(--text-sm);
		font-weight: 700;
		color: var(--tone);
	}

	.sec-count {
		font-size: var(--text-xs);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		color: var(--tone);
		background: color-mix(in srgb, var(--tone) 16%, transparent);
		border-radius: 9999px;
		padding: 0.05rem 0.5rem;
	}

	.group-sub {
		margin-left: 0.5rem;
		font-size: var(--text-xs);
		color: var(--ord-label);
	}

	/* --- Rows (dense grid; cards on mobile) --- */
	.col-head,
	.order-row {
		display: grid;
		grid-template-columns: 1.6rem minmax(9rem, 2.4fr) 0.9fr 0.9fr 1.1fr 1.6rem;
		gap: 0.75rem;
		align-items: center;
	}

	.col-head {
		position: sticky;
		top: 0;
		z-index: 2;
		font-size: 0.68rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--table-header-text);
		background: var(--table-header-bg);
		padding: 0.7rem 0.9rem;
		border-bottom: 1px solid var(--ord-border);
	}

	.col-head .num {
		text-align: right;
	}

	.order-row {
		padding: 0.55rem 0.9rem;
		border-bottom: 1px solid var(--ord-divider);
		transition: background-color 0.12s ease-out;
	}

	.order-row:hover {
		background: var(--ord-hover);
	}

	.tone-urgent .order-row {
		box-shadow: inset 3px 0 0 var(--observatory-remove);
	}

	.tone-today .order-row {
		box-shadow: inset 3px 0 0 var(--observatory-warn);
	}

	.order-row.skipped {
		opacity: 0.5;
	}

	.order-row.is-zero .item-name,
	.order-row.is-zero .cell-val {
		color: var(--ord-dim);
		font-weight: 400;
	}

	.cell-check {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.cell-check input {
		width: 17px;
		height: 17px;
		accent-color: var(--add-item-color);
		cursor: pointer;
	}

	.cell-name {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
	}

	.item-name {
		font-weight: 600;
		font-size: var(--text-sm);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.reset-qty {
		flex: none;
		border: none;
		background: color-mix(in srgb, var(--text-color) 9%, transparent);
		color: var(--ord-label);
		font-size: 0.64rem;
		border-radius: 0.25rem;
		padding: 0.08rem 0.35rem;
		cursor: pointer;
	}

	.reset-qty:hover {
		color: var(--text-color);
	}

	.cell-onhand,
	.cell-runout {
		text-align: right;
	}

	.cell-cap {
		display: none;
		font-size: 0.62rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--ord-dim);
	}

	.cell-val {
		font-size: var(--text-sm);
		font-variant-numeric: tabular-nums;
	}

	.runout-now {
		color: var(--observatory-remove);
		font-weight: 600;
	}

	.cell-qty {
		display: flex;
		justify-content: flex-end;
	}

	.cell-qty input {
		width: 4rem;
		height: 2rem;
		text-align: right;
		font-variant-numeric: tabular-nums;
		font-size: var(--text-sm);
		background: var(--input-bg);
		color: var(--text-color);
		border: 1px solid var(--ord-border);
		border-radius: 0.4rem;
		padding: 0 0.5rem;
	}

	.cell-qty input:focus {
		outline: none;
		border-color: var(--input-focus-border);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--input-focus-border) 30%, transparent);
	}

	.cell-qty input:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.cell-conf {
		display: flex;
		justify-content: center;
	}

	.conf-dot {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		cursor: help;
	}

	.conf-high {
		background: var(--observatory-add);
	}

	.conf-medium {
		background: var(--observatory-warn);
	}

	.conf-low {
		background: var(--observatory-remove);
	}

	/* --- Zero-order collapse toggle --- */
	.zero-toggle {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		width: 100%;
		padding: 0.55rem 0.9rem;
		border: none;
		border-bottom: 1px solid var(--ord-divider);
		background: transparent;
		color: var(--ord-label);
		font-size: var(--text-xs);
		cursor: pointer;
		text-align: left;
	}

	.zero-toggle:hover {
		color: var(--text-color);
	}

	.chev {
		display: inline-block;
		font-size: 0.7rem;
		transition: transform 0.15s ease-out;
	}

	.chev.open {
		transform: rotate(90deg);
	}

	@media (prefers-reduced-motion: reduce) {
		.chev {
			transition: none;
		}
	}

	/* --- All-clear / states --- */
	.all-clear {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-bottom: 0.85rem;
		padding: 0.85rem 0.9rem;
		border-radius: 0.75rem;
		background: var(--observatory-add-soft);
		border: 1px solid var(--observatory-add-border);
	}

	.all-clear p {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--text-color);
	}

	.all-clear strong {
		color: var(--observatory-add);
	}

	.ac-check {
		flex: none;
		width: 1.5rem;
		height: 1.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		background: color-mix(in srgb, var(--observatory-add) 18%, transparent);
		color: var(--observatory-add);
		font-weight: 700;
	}

	.error-box {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.9rem;
		border-radius: 0.75rem;
		background: var(--observatory-remove-soft);
		border: 1px solid var(--observatory-remove-border);
	}

	.error-box p {
		margin: 0;
		color: var(--observatory-remove);
	}

	.no-data {
		padding: 2rem 0;
		text-align: center;
		color: var(--ord-label);
	}

	.healthy-line {
		margin: 0.6rem 0.1rem 0;
		font-size: var(--text-xs);
		color: var(--ord-dim);
	}

	/* --- Skeleton --- */
	.skeleton-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.skeleton-row {
		display: flex;
		gap: 1rem;
		padding: 0.85rem;
		background: var(--container-bg);
		border: 1px solid var(--ord-border);
		border-radius: 0.75rem;
	}

	.skeleton-bar {
		height: 0.9rem;
		border-radius: 0.25rem;
		background: color-mix(in srgb, var(--text-color) 10%, transparent);
	}

	.skeleton-bar.w-40 {
		flex: 1;
	}
	.skeleton-bar.w-10 {
		width: 2.5rem;
	}
	.skeleton-bar.w-14 {
		width: 4rem;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}

	.animate-pulse {
		animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
	}

	@media (prefers-reduced-motion: reduce) {
		.animate-pulse {
			animation: none;
		}
	}

	.copy-fallback {
		width: 100%;
		margin-top: 1rem;
		font-family: monospace;
		font-size: var(--text-sm);
		background: var(--input-bg);
		color: var(--text-color);
		border: 1px solid var(--ord-border);
		border-radius: 0.5rem;
		padding: 0.6rem;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	/* --- Mobile: rows become two-line compact cards, page scrolls (no inner cap) --- */
	@media (max-width: 640px) {
		.orders-page {
			max-width: 100%;
			padding-left: 0.75rem;
			padding-right: 0.75rem;
		}

		.table-scroll {
			max-height: none;
			overflow: visible;
		}

		.col-head {
			display: none;
		}

		.group-sub {
			display: none;
		}

		.order-row {
			grid-template-columns: 1.4rem 1fr 1fr 1fr;
			grid-template-areas:
				'check name name conf'
				'onhand order runout runout';
			row-gap: 0.5rem;
			padding: 0.65rem 0.75rem;
		}

		.tone-urgent .order-row,
		.tone-today .order-row {
			box-shadow: none;
		}

		.cell-check {
			grid-area: check;
		}
		.cell-name {
			grid-area: name;
		}
		.cell-conf {
			grid-area: conf;
		}
		.cell-onhand {
			grid-area: onhand;
		}
		.cell-qty {
			grid-area: order;
		}
		.cell-runout {
			grid-area: runout;
		}

		.cell-onhand,
		.cell-runout,
		.cell-qty {
			display: flex;
			flex-direction: column;
			align-items: flex-start;
			gap: 0.15rem;
			text-align: left;
		}

		.cell-cap {
			display: block;
		}

		.cell-qty input {
			width: 100%;
			max-width: 5rem;
			height: var(--touch-target-min);
		}

		.cell-check input {
			width: 20px;
			height: 20px;
		}

		.controls-card {
			gap: 0.6rem;
		}

		.refresh-btn {
			margin-left: 0;
			flex: 1;
		}

		.stepper-group {
			flex: 1;
		}

		.stepper {
			justify-content: space-between;
		}
	}
</style>
