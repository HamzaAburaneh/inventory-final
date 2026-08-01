<script>
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import { itemStore } from '../../stores/itemStore.js';
	import { notificationStore } from '../../stores/notificationStore.js';
	import { authStore } from '../../stores/authStore.js';
	import { fetchStockPredictions } from '../../lib/predictionsClient.js';
	import {
		classifyOrderUrgency,
		reorderByDate,
		stockOutDate,
		suggestedOrderQty
	} from '../../lib/predictionCore.js';
	import {
		coverageWindow,
		draftLines,
		filterRows,
		formatCount,
		formatMoney,
		isOpeningOrder,
		sameLines,
		savedByLabel,
		sortRows
	} from '../../lib/orderSheet.js';
	import { clearOrderDraft, saveOrderDraft, subscribeOrderDraft } from '../../lib/orders.js';
	import { dayFromKey, torontoDayKey } from '../../lib/cneCalendar.js';

	// The "coming up" window after today's order cutoff (see classifyOrderUrgency).
	const UPCOMING_LOOKAHEAD_DAYS = 3;
	const COVERAGE_MIN = 1;
	const COVERAGE_MAX = 7;
	const LEAD_MIN = 0;
	const LEAD_MAX = 3;
	// 14 days always covers the worst stepper case (lead 3 + coverage 7 = 10).
	const FORECAST_DAYS = 14;
	// Long enough that typing a 3-digit quantity is one write, short enough that
	// a teammate watching the same day sees it land while you're still looking.
	const SAVE_DEBOUNCE_MS = 700;

	let predictions = $state.raw({});
	let loading = $state(true);
	let error = $state('');
	let coverageDays = $state(2);
	let leadDays = $state(1);
	// Per-item user edits: { [itemId]: { qty?: number, included?: boolean } }.
	// This is the only thing persisted — never the computed suggestions, so a
	// reopened draft tracks a refreshed forecast (see lib/orders.js).
	let overrides = $state({});
	let copied = $state(false);
	let copyFallbackText = $state('');
	let search = $state('');
	let sortKey = $state('urgency');
	let sortDir = $state('asc');

	// Draft persistence state. Saving is blocked until the stored draft has been
	// read at least once, so a slow load can't overwrite a teammate's edits with
	// an empty local draft.
	let draftLoaded = $state(false);
	let saveState = $state('idle');
	let draftMeta = $state({ updatedAt: null, updatedBy: '' });
	let lastSavedLines = {};
	let saveTimer = null;

	// Realtime item counts — quantities and grouping recompute as the team logs
	// sales, without refetching the forecast.
	const items = $derived($itemStore);
	const userName = $derived($authStore?.displayName || $authStore?.email || '');

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
		// A quantity typed a moment before navigating away is still on the timer —
		// flush it rather than dropping it.
		return () => {
			if (saveTimer) {
				clearTimeout(saveTimer);
				flushSave();
			}
		};
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

	// The draft is keyed by the ORDER day (not the delivery day), so everyone
	// looking at the same day's order opens the same document.
	const orderDayKey = $derived(forecastDates.length > 0 ? forecastDates[0] : '');

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
			const qty = ov.qty ?? suggested;
			out.push({
				id: item.id,
				name: item.name,
				count,
				cost: Number(item.cost) || 0,
				suggested,
				qty,
				lineCost: qty * (Number(item.cost) || 0),
				edited: ov.qty !== undefined,
				included: ov.included ?? (group === 'urgent' || group === 'today'),
				group,
				reorderBy,
				runOut,
				confidence: normalizeConfidence(p.confidence)
			});
		}
		return out;
	});

	// Pre-fair, every shelf is empty so every item is trivially "at or below low
	// stock" and all three urgency bands collapse into one. That's an opening
	// buy, not a top-up, so the page drops the bands and shows a single list.
	const openingOrder = $derived(isOpeningOrder(rows, planStartsLater));

	// Search narrows what's DISPLAYED only. Totals below deliberately stay on the
	// full row set — the order total must not change while you look something up.
	const searched = $derived(filterRows(rows, search));
	const hiddenBySearch = $derived(rows.length - searched.length);

	const upcoming = $derived(rows.filter((r) => r.group === 'upcoming'));
	const healthy = $derived(rows.filter((r) => r.group === 'ok'));
	const missingForecast = $derived(Math.max(0, items.length - rows.length));

	// Pre-fair every item is "at/below low stock" but most have zero predicted
	// demand — so the actionable count is the rows that actually need cases.
	const todayActionable = $derived(
		rows.filter((r) => (r.group === 'urgent' || r.group === 'today') && r.qty > 0).length
	);
	// Zero-order rows are collapsed per section to keep the list short.
	let showZeros = $state({ urgent: false, today: false, upcoming: false, opening: false });

	/**
	 * Rows for one band, filtered by the search box and ordered by the active
	 * sort, split so the "nothing to order" tail can collapse.
	 */
	function bandParts(groupKeys) {
		const inBand = searched.filter((r) => groupKeys.includes(r.group));
		const ordered = sortRows(inBand, sortKey, sortDir);
		return {
			active: ordered.filter((r) => r.qty > 0),
			zeros: ordered.filter((r) => r.qty === 0)
		};
	}

	const checked = $derived(rows.filter((r) => r.included && r.qty > 0));
	const totalCases = $derived(checked.reduce((s, r) => s + r.qty, 0));
	const totalCost = $derived(checked.reduce((s, r) => s + r.lineCost, 0));

	const BAND_LABELS = {
		urgent: 'Urgent',
		today: 'Today',
		upcoming: 'Coming up',
		ok: 'Later'
	};

	// Cost split per urgency band, for the total card. Empty bands are dropped.
	const bandBreakdown = $derived.by(() => {
		if (openingOrder) return [];
		const out = [];
		for (const key of ['urgent', 'today', 'upcoming', 'ok']) {
			const band = checked.filter((r) => r.group === key);
			if (band.length === 0) continue;
			out.push({
				key,
				label: BAND_LABELS[key],
				cases: band.reduce((s, r) => s + r.qty, 0),
				cost: band.reduce((s, r) => s + r.lineCost, 0)
			});
		}
		return out;
	});

	const deliveryKey = $derived(
		forecastDates.length > 0 ? forecastDates[Math.min(leadDays, forecastDates.length - 1)] : ''
	);
	const nextDue = $derived(upcoming.length > 0 ? upcoming[0].reorderBy : null);

	// "2 days" and "2 days" mean different things — state what they resolve to.
	// Not named `window`: that shadows the global the reduced-motion check reads.
	const coverWindow = $derived(coverageWindow(forecastDates, leadDays, coverageDays));

	// ————————————————————————————————————————————————————————————————————
	// Draft persistence
	// ————————————————————————————————————————————————————————————————————

	// Watch the day's shared draft. Re-subscribes if the order day rolls over.
	$effect(() => {
		const key = orderDayKey;
		if (!key) return;
		let cancelled = false;
		draftLoaded = false;
		const unsubscribe = subscribeOrderDraft(
			key,
			(draft, meta) => {
				// Skip the optimistic echo of our own in-flight write; re-applying it
				// would fight the cursor of whatever is being typed right now.
				if (cancelled || meta.local) return;
				applyRemoteDraft(draft);
				draftLoaded = true;
			},
			() => {
				// Listener detached (offline, or rules denied). Let editing continue
				// locally rather than freezing the page behind a never-loaded draft.
				if (!cancelled) draftLoaded = true;
			}
		);
		return () => {
			cancelled = true;
			unsubscribe();
		};
	});

	function applyRemoteDraft(draft) {
		// The server confirming our own save arrives as a non-local snapshot too.
		// It carries the data we already have, so only refresh the stamp — taking
		// the whole payload would discard edits typed since the save fired.
		if (draftLoaded && sameLines(draft.lines, lastSavedLines)) {
			draftMeta = { updatedAt: draft.updatedAt, updatedBy: draft.updatedBy };
			return;
		}
		overrides = { ...draft.lines };
		lastSavedLines = draft.lines;
		if (draft.coverageDays !== null) coverageDays = draft.coverageDays;
		if (draft.leadDays !== null) leadDays = draft.leadDays;
		draftMeta = { updatedAt: draft.updatedAt, updatedBy: draft.updatedBy };
		saveState = 'idle';
	}

	// Saves are triggered explicitly from each edit handler rather than from an
	// effect on `overrides`, so applying a remote draft can never echo back out
	// as a fresh save and ping-pong between two open tabs.
	function scheduleSave() {
		if (!draftLoaded || !orderDayKey) return;
		clearTimeout(saveTimer);
		saveState = 'saving';
		saveTimer = setTimeout(() => {
			saveTimer = null;
			flushSave();
		}, SAVE_DEBOUNCE_MS);
	}

	async function flushSave() {
		if (!draftLoaded || !orderDayKey) return;
		const lines = draftLines(overrides);
		try {
			await saveOrderDraft(orderDayKey, {
				lines,
				coverageDays,
				leadDays,
				updatedBy: userName
			});
			lastSavedLines = lines;
			saveState = 'saved';
		} catch (err) {
			console.error('Failed to save the order draft:', err);
			saveState = 'error';
			notificationStore.showNotification(
				'Could not save the order — your edits are local.',
				'error'
			);
		}
	}

	async function resetDraft() {
		if (!orderDayKey) return;
		clearTimeout(saveTimer);
		saveTimer = null;
		overrides = {};
		lastSavedLines = {};
		try {
			await clearOrderDraft(orderDayKey);
			draftMeta = { updatedAt: null, updatedBy: '' };
			saveState = 'idle';
			notificationStore.showNotification('Order reset to the suggested quantities.', 'success');
		} catch (err) {
			console.error('Failed to clear the order draft:', err);
			saveState = 'error';
			notificationStore.showNotification('Could not clear the saved order.', 'error');
		}
	}

	const savedLabel = $derived(savedByLabel(draftMeta));
	const hasEdits = $derived(Object.keys(overrides).length > 0);

	// ————————————————————————————————————————————————————————————————————
	// Edit handlers
	// ————————————————————————————————————————————————————————————————————

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
		scheduleSave();
	}

	function stepLead(delta) {
		const next = Math.min(LEAD_MAX, Math.max(LEAD_MIN, leadDays + delta));
		if (next === leadDays) return;
		leadDays = next;
		clearQtyOverrides();
		scheduleSave();
	}

	function setQtyOverride(row, qty) {
		if (qty === row.suggested) {
			resetQty(row.id);
			return;
		}
		overrides[row.id] = { ...(overrides[row.id] ?? {}), qty };
		scheduleSave();
	}

	function resetQty(id) {
		if (overrides[id]?.qty !== undefined) {
			delete overrides[id].qty;
			// A line left with no fields is dead weight in the saved document.
			if (Object.keys(overrides[id]).length === 0) delete overrides[id];
			scheduleSave();
		}
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
		scheduleSave();
	}

	// Numeric columns read high-to-low first; name and dates read low-to-high.
	const DESC_FIRST = ['qty', 'value', 'count'];

	function toggleSort(key) {
		if (sortKey === key) {
			sortDir = sortDir === 'asc' ? 'desc' : 'asc';
			return;
		}
		sortKey = key;
		sortDir = DESC_FIRST.includes(key) ? 'desc' : 'asc';
	}

	// Spoken suffix for the sort buttons — the arrow glyph is decorative, so the
	// current sort state has to reach screen readers through the label.
	function sortLabel(key) {
		if (sortKey !== key) return '';
		return sortDir === 'asc' ? ', currently ascending' : ', currently descending';
	}

	function runOutLabel(row) {
		if (!row.runOut) return `> ${FORECAST_DAYS}d`;
		if (forecastDates.length > 0 && row.runOut.date === forecastDates[0]) return 'today';
		return formatDayKey(row.runOut.date);
	}

	function buildOrderSheet() {
		const lines = [];
		const heading = openingOrder ? 'GFS OPENING ORDER' : 'GFS ORDER';
		lines.push(
			`${heading} — ${formatDayKey(forecastDates[0])} (delivery ${formatDayKey(deliveryKey)})`
		);
		const groups = openingOrder
			? [['OPENING ORDER', ['urgent', 'today', 'upcoming', 'ok']]]
			: [
					['URGENT', ['urgent']],
					['TODAY', ['today']],
					['UPCOMING', ['upcoming']],
					['LATER', ['ok']]
				];
		for (const [label, keys] of groups) {
			const groupRows = sortRows(
				checked.filter((r) => keys.includes(r.group)),
				sortKey,
				sortDir
			);
			if (groupRows.length === 0) continue;
			lines.push('');
			lines.push(label);
			for (const r of groupRows) {
				const detail = openingOrder
					? `on hand ${r.count}`
					: `on hand ${r.count}, ${r.runOut ? `out ${runOutLabel(r)}` : 'no run-out forecast'}`;
				lines.push(`  ${String(r.qty).padStart(3)} x ${r.name.padEnd(24)} (${detail})`);
			}
		}
		lines.push('');
		lines.push(
			`${checked.length} items · ${formatCount(totalCases)} cases · est. ${formatMoney(totalCost)}`
		);
		if (savedLabel) lines.push(savedLabel);
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

	// In opening mode the three urgency bands carry no signal, so they collapse
	// into a single list (see `openingOrder`).
	const SECTIONS = $derived(
		openingOrder
			? [
					{
						key: 'opening',
						tone: 'tone-opening',
						title: 'Opening order',
						sub: 'Nothing on the shelves yet — this is the full buy to open with.',
						groups: ['urgent', 'today', 'upcoming', 'ok']
					}
				]
			: [
					{
						key: 'urgent',
						tone: 'tone-urgent',
						title: 'Urgent — top up now',
						sub: "At or below low stock — don't wait for the truck.",
						groups: ['urgent']
					},
					{
						key: 'today',
						tone: 'tone-today',
						title: "Today's GFS order",
						sub: `Order today — with a ${leadDays}-day lead, waiting means running short.`,
						groups: ['today']
					},
					{
						key: 'upcoming',
						tone: 'tone-upcoming',
						title: 'Coming up',
						sub: `Due within ${UPCOMING_LOOKAHEAD_DAYS} days after today's cutoff.`,
						groups: ['upcoming']
					}
				]
	);
</script>

<svelte:head>
	<title>{openingOrder ? 'Opening Order' : "Today's Order"} - StockSense</title>
</svelte:head>

{#snippet sortHead(key, label, extraClass = '')}
	<button
		class="sort-btn {extraClass}"
		class:sorted={sortKey === key}
		onclick={() => toggleSort(key)}
		aria-label={`Sort by ${label.toLowerCase()}${sortLabel(key)}`}
	>
		{label}
		<span class="sort-arrow" aria-hidden="true">
			{#if sortKey === key}{sortDir === 'asc' ? '▲' : '▼'}{/if}
		</span>
	</button>
{/snippet}

{#snippet colHead()}
	<div class="col-head">
		<span></span>
		<span>{@render sortHead('name', 'Item')}</span>
		<span class="num">{@render sortHead('count', 'On hand', 'num')}</span>
		<span class="num">{@render sortHead('qty', 'Order', 'num')}</span>
		<span class="num">{@render sortHead('value', 'Line cost', 'num')}</span>
		{#if !openingOrder}
			<span class="num">{@render sortHead('runOut', 'Runs out', 'num')}</span>
		{/if}
		<span class="conf-head" title="Forecast confidence">Conf.</span>
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
		</div>
		<div class="cell-onhand">
			<span class="cell-cap">On hand</span>
			<span class="cell-val">{row.count}</span>
		</div>
		<div class="cell-qty">
			<span class="cell-cap">Order</span>
			<div class="qty-wrap">
				{#if row.edited}
					<button
						class="qty-prev"
						onclick={() => resetQty(row.id)}
						aria-label={`Restore the suggested ${row.suggested} cases of ${row.name}`}
						title="Restore the suggested quantity"
					>
						{row.suggested}
					</button>
					<span class="qty-arrow" aria-hidden="true">&rarr;</span>
				{/if}
				<input
					type="number"
					min="0"
					step="1"
					inputmode="numeric"
					class:is-edited={row.edited}
					value={row.qty}
					disabled={!row.included}
					oninput={(e) => onQtyInput(row, e)}
					onblur={(e) => onQtyBlur(row, e)}
					aria-label={`Cases of ${row.name} to order`}
				/>
			</div>
		</div>
		<div class="cell-line">
			<span class="cell-cap">Line cost</span>
			<span class="cell-val">{row.cost > 0 ? formatMoney(row.lineCost) : '—'}</span>
		</div>
		<!-- Pre-fair every shelf reads "today", so 50 identical values would be
		     pure noise — the column is dropped entirely in opening mode. -->
		{#if !openingOrder}
			<div class="cell-runout">
				<span class="cell-cap">Runs out</span>
				<span class="cell-val" class:runout-now={row.group === 'urgent' && row.qty > 0}>
					{runOutLabel(row)}
				</span>
			</div>
		{/if}
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
	{@const parts = bandParts(cfg.groups)}
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
		<h1>{openingOrder ? 'Opening Order' : "Today's Order"}</h1>
		{#if forecastDates.length > 0}
			<p class="date-line">
				Order for <strong>{formatDayKey(forecastDates[0])}</strong>
				<span class="dot">&middot;</span> delivery {formatDayKey(deliveryKey)}
			</p>
			<!-- One line of context, not a third stacked card above the data. -->
			{#if planStartsLater}
				<p class="prefair-line">
					<span class="pf-icon" aria-hidden="true">◷</span>
					The fair hasn't opened yet — nothing here is a top-up.
				</p>
			{/if}
		{/if}
	</header>

	<div class="controls-card">
		<div class="stepper-group">
			<span class="control-label" id="coverage-label">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
					><rect x="4" y="5" width="16" height="16" rx="2"></rect><path d="M16 3v4M8 3v4M4 11h16"
					></path></svg
				>
				Buy enough for
			</span>
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
			<span class="control-label" id="lead-label">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
					><circle cx="7" cy="17" r="2"></circle><circle cx="17" cy="17" r="2"></circle><path
						d="M5 17H3v-4m-1-8h11v12m-4 0h6m4 0h2v-6h-8m0-5h5l3 5"
					></path></svg
				>
				Truck arrives in
			</span>
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

		<div class="search-group">
			<span class="control-label" id="search-label">Find</span>
			<input
				class="search-input"
				type="search"
				placeholder="Search items…"
				bind:value={search}
				aria-labelledby="search-label"
			/>
		</div>

		<button class="refresh-btn" onclick={loadData} disabled={loading}>
			{loading ? 'Refreshing…' : 'Refresh'}
		</button>

		<!-- Both steppers read "N days" but mean different things, so spell out
		     what the pair actually resolves to. Catches a lead that skips a
		     delivery day without the reader working it out from the header. -->
		{#if coverWindow}
			<p class="window-line" aria-live="polite">
				Arrives <strong>{formatDayKey(coverWindow.arrives)}</strong>
				{#if coverWindow.through === coverWindow.arrives}
					&mdash; covers that day only
				{:else}
					&mdash; covers through <strong>{formatDayKey(coverWindow.through)}</strong>
				{/if}
			</p>
		{/if}
	</div>

	{#if !loading && !error && rows.length > 0}
		<section class="total-card" in:fly={sectionIn}>
			<div class="total-main">
				<span class="total-label">Estimated order total</span>
				<span class="total-value">{formatMoney(totalCost)}</span>
				<span class="total-sub">
					{formatCount(totalCases)}
					{totalCases === 1 ? 'case' : 'cases'}
					<span class="dot">&middot;</span>
					{checked.length}
					{checked.length === 1 ? 'item' : 'items'}
				</span>
			</div>

			<!-- With a single band the chip restates the hero total verbatim, right
			     beside it — only worth showing once there's a split to see. -->
			{#if bandBreakdown.length > 1}
				<ul class="band-list">
					{#each bandBreakdown as band (band.key)}
						<li class="band-chip tone-{band.key}">
							<span class="band-dot" aria-hidden="true"></span>
							<span class="band-name">{band.label}</span>
							<span class="band-cost">{formatMoney(band.cost)}</span>
							<span class="band-meta">{formatCount(band.cases)} cases</span>
						</li>
					{/each}
				</ul>
			{/if}

			<div class="total-actions">
				<p class="save-line" class:is-error={saveState === 'error'} aria-live="polite">
					{#if saveState === 'saving'}
						Saving…
					{:else if saveState === 'error'}
						Not saved — edits are local only
					{:else if savedLabel}
						{savedLabel}
					{:else}
						Suggested quantities · not edited yet
					{/if}
				</p>
				<div class="btn-row">
					{#if hasEdits}
						<button class="reset-btn" onclick={resetDraft}>Reset to suggested</button>
					{/if}
					<button class="copy-btn" onclick={copyOrder} disabled={checked.length === 0}>
						{copied ? 'Copied ✓' : 'Copy order'}
					</button>
				</div>
			</div>
		</section>
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

		<div class="table-card" class:is-opening={openingOrder} in:fly={sectionIn}>
			<div class="table-scroll">
				{@render colHead()}
				{#each SECTIONS as cfg (cfg.key)}
					{@render group(cfg)}
				{/each}
				{#if searched.length === 0}
					<p class="no-match">No items match “{search}”.</p>
				{/if}
			</div>
		</div>

		<!-- Wrapped rather than relying on :empty — Svelte leaves whitespace text
		     nodes behind a false {#if}, so an "empty" <p> would still take space. -->
		{#if hiddenBySearch > 0 || (!openingOrder && healthy.length > 0) || missingForecast > 0}
			<p class="healthy-line">
				{#if hiddenBySearch > 0}
					{hiddenBySearch}
					{hiddenBySearch === 1 ? 'item is' : 'items are'} hidden by the search — totals above still cover
					the whole order.
				{/if}
				{#if !openingOrder && healthy.length > 0}
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
		margin-bottom: 0.85rem;
	}

	.page-header h1 {
		font-size: var(--text-2xl);
		font-weight: var(--font-weight-bold);
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

	/* --- Pre-fair note: a header line, not a third stacked card --- */
	.prefair-line {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		margin: 0.25rem 0 0;
		font-size: var(--text-xs);
		color: var(--ord-label);
	}

	.pf-icon {
		flex: none;
		color: var(--observatory-warn);
		font-size: 0.9rem;
		line-height: 1;
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

	.stepper-group,
	.search-group {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.search-group {
		flex: 1;
		min-width: 10rem;
	}

	/* Sentence case, not uppercase: these read as instructions ("Buy enough
	   for"), and shouting them made two unlike controls look interchangeable. */
	.control-label {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-size: var(--text-xs);
		font-weight: 500;
		color: var(--ord-label);
	}

	.control-label svg {
		flex: none;
		opacity: 0.85;
	}

	/* Full-width so it wraps below the controls rather than squeezing them. */
	.window-line {
		flex: 1 0 100%;
		margin: 0.15rem 0 0;
		padding-top: 0.6rem;
		border-top: 1px solid var(--ord-divider);
		font-size: var(--text-xs);
		color: var(--ord-label);
	}

	.window-line strong {
		color: var(--text-color);
		font-weight: 600;
	}

	.search-input {
		height: 2.4rem;
		padding: 0 0.7rem;
		background: var(--input-bg);
		color: var(--text-color);
		border: 1px solid var(--ord-border);
		border-radius: 0.5rem;
		font-size: var(--text-sm);
	}

	.search-input::placeholder {
		color: var(--ord-dim);
	}

	.search-input:focus {
		outline: none;
		border-color: var(--input-focus-border);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--input-focus-border) 30%, transparent);
	}

	/* The native clear "x" in WebKit is drawn from a fixed dark asset that
	   disappears on dark surfaces — recolor it via a mask so it follows the theme. */
	.search-input::-webkit-search-cancel-button {
		-webkit-appearance: none;
		appearance: none;
		height: 0.85rem;
		width: 0.85rem;
		cursor: pointer;
		background-color: var(--ord-label);
		mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M4 4l8 8M12 4l-8 8' stroke='black' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E")
			center / contain no-repeat;
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
	.retry-btn,
	.reset-btn {
		height: 2.4rem;
		padding: 0 1rem;
		border: 1px solid var(--ord-border);
		border-radius: 0.5rem;
		background: transparent;
		color: var(--text-color);
		font-size: var(--text-sm);
		cursor: pointer;
		white-space: nowrap;
		transition: background-color 0.15s ease-out;
	}

	.refresh-btn:hover:not(:disabled),
	.retry-btn:hover,
	.reset-btn:hover {
		background: var(--ord-hover);
	}

	.refresh-btn:disabled {
		opacity: 0.55;
		cursor: wait;
	}

	/* --- Total card (the number the order is judged on) --- */
	.total-card {
		display: grid;
		grid-template-columns: minmax(11rem, auto) 1fr auto;
		align-items: center;
		gap: 1.25rem;
		margin-bottom: 1.1rem;
		padding: 1rem 1.1rem;
		background: var(--container-bg);
		border: 1px solid var(--ord-border);
		border-radius: 0.75rem;
	}

	.total-main {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.total-label {
		font-size: var(--text-xs);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--ord-label);
	}

	.total-value {
		font-size: clamp(1.75rem, 4vw, 2.4rem);
		font-weight: 700;
		line-height: 1.1;
		font-variant-numeric: tabular-nums;
		color: var(--value-color);
	}

	.total-sub {
		font-size: var(--text-sm);
		color: var(--ord-label);
		font-variant-numeric: tabular-nums;
	}

	.band-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.band-chip {
		--tone: var(--ord-label);
		display: grid;
		grid-template-columns: auto auto;
		align-items: baseline;
		gap: 0 0.4rem;
		padding: 0.35rem 0.6rem;
		border-radius: 0.5rem;
		background: var(--ord-soft);
		border: 1px solid var(--ord-border);
	}

	.band-chip.tone-urgent {
		--tone: var(--observatory-remove);
	}

	.band-chip.tone-today {
		--tone: var(--observatory-warn);
	}

	.band-dot {
		width: 0.45rem;
		height: 0.45rem;
		border-radius: 50%;
		background: var(--tone);
	}

	.band-name {
		font-size: var(--text-xs);
		font-weight: 600;
		color: var(--tone);
	}

	.band-cost {
		grid-column: 1 / -1;
		font-size: var(--text-sm);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.band-meta {
		grid-column: 1 / -1;
		font-size: 0.68rem;
		color: var(--ord-label);
		font-variant-numeric: tabular-nums;
	}

	.total-actions {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.5rem;
	}

	.save-line {
		margin: 0;
		font-size: var(--text-xs);
		color: var(--ord-label);
		text-align: right;
	}

	.save-line.is-error {
		color: var(--observatory-remove);
		font-weight: 600;
	}

	.btn-row {
		display: flex;
		gap: 0.5rem;
	}

	.copy-btn {
		height: 2.4rem;
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
		/* Reserve the scrollbar gutter so the sticky header's last column can't
		   slide under the scrollbar. */
		scrollbar-gutter: stable;
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

	.tone-opening {
		--tone: var(--observatory-accent);
	}

	/* Tinted band rather than a solid accent fill: once the fair opens and three
	   bands stack, full-bleed colour blocks would out-shout the order total —
	   and keep red/amber meaningful for genuine urgency. */
	.group-head {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.9rem;
		background: color-mix(in srgb, var(--tone) 12%, var(--container-bg));
		border-top: 1px solid color-mix(in srgb, var(--tone) 35%, transparent);
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
		grid-template-columns: 1.5rem minmax(7rem, 2.6fr) 0.75fr 1.15fr 1fr 1fr 1.5rem;
		gap: 0.5rem;
		align-items: center;
	}

	/* Opening mode drops the run-out column, so the tracks drop with it. */
	.is-opening .col-head,
	.is-opening .order-row {
		grid-template-columns: 1.5rem minmax(7rem, 3fr) 0.85fr 1.3fr 1.1fr 1.5rem;
	}

	/* Ruled columns: a hairline before each numeric column keeps the figures
	   visually bound to their header across a wide row, instead of drifting in
	   open space. The name and the trailing confidence dot stay unruled. */
	.col-head > span:nth-child(n + 3):not(:last-child),
	.order-row > div:nth-child(n + 3):not(:last-child) {
		border-left: 1px solid var(--ord-divider);
		padding-left: 0.5rem;
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
		padding: 0.5rem 0.9rem;
		border-bottom: 1px solid var(--ord-border);
	}

	.sort-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		padding: 0.2rem 0.25rem;
		margin: -0.2rem -0.25rem;
		border: none;
		border-radius: 0.3rem;
		background: transparent;
		color: inherit;
		font: inherit;
		letter-spacing: inherit;
		text-transform: inherit;
		cursor: pointer;
		transition: background-color 0.12s ease-out;
	}

	.sort-btn.num {
		width: 100%;
		justify-content: flex-end;
	}

	.sort-btn:hover {
		background: color-mix(in srgb, var(--table-header-text) 12%, transparent);
	}

	.sort-btn:focus-visible {
		outline: 2px solid var(--input-focus-border);
		outline-offset: 1px;
	}

	.sort-btn.sorted {
		color: var(--value-color);
	}

	.sort-arrow {
		font-size: 0.55rem;
		line-height: 1;
	}

	.conf-head {
		font-size: 0.6rem;
		text-align: center;
		color: var(--table-header-text);
		cursor: help;
	}

	.order-row {
		padding: 0.45rem 0.9rem;
		border-bottom: 1px solid var(--ord-divider);
		transition: background-color 0.12s ease-out;
	}

	.order-row:hover {
		background: var(--ord-hover);
	}

	/* No per-row left stripe: with every item in one band it drew a solid bar
	   down the whole table. The tinted band header already marks the section. */

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

	.cell-onhand,
	.cell-runout,
	.cell-line {
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

	/* Row, not column: a stacked caption made edited rows taller than their
	   neighbours, which read as a detached tooltip. `19 → 21` states the change
	   on one line and leaves row height untouched. */
	.qty-wrap {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: flex-end;
		gap: 0.2rem;
		min-width: 0;
	}

	.qty-prev {
		border: none;
		background: transparent;
		padding: 0 0.1rem;
		color: var(--ord-dim);
		font-size: var(--text-xs);
		font-variant-numeric: tabular-nums;
		text-decoration: line-through;
		cursor: pointer;
	}

	.qty-prev:hover {
		color: var(--text-color);
	}

	.qty-arrow {
		flex: none;
		color: var(--ord-dim);
		font-size: 0.7rem;
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

	/* An edited quantity is what the boss most needs to spot — mark the field
	   itself, not just a pill beside it. */
	.cell-qty input.is-edited {
		border-color: var(--observatory-accent);
		box-shadow: inset 2px 0 0 var(--observatory-accent);
		font-weight: 700;
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

	.no-match {
		margin: 0;
		padding: 1.5rem 0.9rem;
		text-align: center;
		font-size: var(--text-sm);
		color: var(--ord-label);
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

	/* --- Tablet: the total card stacks before the table does --- */
	@media (max-width: 900px) {
		.total-card {
			grid-template-columns: 1fr;
			gap: 0.85rem;
		}

		.total-actions {
			align-items: stretch;
		}

		.save-line {
			text-align: left;
		}

		.btn-row {
			justify-content: flex-end;
		}
	}

	/* --- Mobile: rows become three-line compact cards, page scrolls (no inner cap) --- */
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

		.order-row,
		.is-opening .order-row {
			grid-template-columns: 1.4rem 1fr 1fr 1.4rem;
			grid-template-areas:
				'check name name conf'
				'onhand onhand order order'
				'line line runout runout';
			row-gap: 0.5rem;
			padding: 0.65rem 0.75rem;
		}

		/* Column rules belong to the desktop grid; the stacked card has none. */
		.order-row > div:nth-child(n + 3):not(:last-child) {
			border-left: none;
			padding-left: 0;
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
		.cell-line {
			grid-area: line;
		}
		.cell-runout {
			grid-area: runout;
		}

		.cell-onhand,
		.cell-runout,
		.cell-line,
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

		.qty-wrap {
			justify-content: flex-start;
			width: 100%;
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
			flex: 1;
		}

		.stepper-group {
			flex: 1;
		}

		.search-group {
			flex: 1 0 100%;
		}

		.stepper {
			justify-content: space-between;
		}

		.total-value {
			font-size: 2rem;
		}
	}
</style>
