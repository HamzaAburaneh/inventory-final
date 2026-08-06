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
		adjustOrderQuantity,
		coverageWindow,
		draftLines,
		editSummary,
		filterRows,
		formatCount,
		formatMoney,
		isEditedRow,
		isOpeningOrder,
		sameLines,
		savedByLabel,
		sortRows
	} from '../../lib/orderSheet.js';
	import Tooltip from '../../components/Tooltip.svelte';
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
	// Temporary per-row adjustment amounts. These are input intent, not order
	// state, so they are never persisted and clear after each +/- action.
	let adjustments = $state({});
	let copied = $state(false);
	let copyFallbackText = $state('');
	let search = $state('');
	let sortKey = $state('urgency');
	let sortDir = $state('asc');
	// "Show only what was changed" — the review lens for whoever opens the draft
	// after someone else has been through it.
	let editsOnly = $state(false);

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

	// `short` is the visible in-row tag. Only medium/low ever render one: tagging
	// all three would put a badge on every line of a 49-row table and say nothing,
	// so "no tag" means high and the legend under the table spells that out.
	const CONFIDENCE_META = {
		high: { label: 'High confidence', short: 'High', cls: 'conf-high' },
		medium: { label: 'Medium confidence', short: 'Fair', cls: 'conf-medium' },
		low: { label: 'Low confidence', short: 'Low', cls: 'conf-low' }
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
			// What the page would have picked with an empty draft. Kept on the row so
			// an include/exclude can be told apart from an untouched default — that
			// difference is what the edit summary and the review filter run on.
			const defaultIncluded = group === 'urgent' || group === 'today';
			out.push({
				id: item.id,
				name: item.name,
				count,
				cost: Number(item.cost) || 0,
				suggested,
				qty,
				lineCost: qty * (Number(item.cost) || 0),
				edited: ov.qty !== undefined,
				included: ov.included ?? defaultIncluded,
				defaultIncluded,
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

	// How far the edited order sits from the one the forecast alone would have
	// produced — the number the owner reviewing a draft actually needs.
	const edits = $derived(editSummary(rows));
	// Resetting the draft empties the edit list; deriving this rather than
	// clearing the flag in an effect keeps the filter from stranding the reader
	// on an empty table.
	const reviewingEdits = $derived(editsOnly && edits.editedCount > 0);

	// Search narrows what's DISPLAYED only. Totals below deliberately stay on the
	// full row set — the order total must not change while you look something up.
	// The review filter stacks on top of it for the same reason.
	const bySearch = $derived(filterRows(rows, search));
	const searched = $derived(reviewingEdits ? bySearch.filter(isEditedRow) : bySearch);
	const hiddenBySearch = $derived(rows.length - bySearch.length);

	// Pre-fair every shelf reads 0, so the column is 49 identical zeros wide.
	// Keyed on the data rather than on opening mode: a few items can still carry
	// stock from last year, and hiding a real count would be a lie.
	const showOnHand = $derived(!openingOrder || rows.some((r) => r.count > 0));
	// The space On hand gives up goes to the per-case price, which varies per row
	// and is the only thing that explains the line cost beside it.
	const showCaseCost = $derived(openingOrder);

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
		// In review mode every changed line has to be visible: a quantity someone
		// deliberately zeroed is exactly the change worth seeing, and folding it
		// into the collapsed "nothing to order" tail would show fewer lines than
		// the "N lines changed" count promises.
		if (reviewingEdits) return { active: ordered, zeros: [] };
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

	/**
	 * Cost impact of the edits in plain words. "+$56.09 vs suggested" left the
	 * comparison unstated — suggested by whom, and is more good or bad? — so this
	 * spells out both sides of it.
	 * @param {number} value - Current total minus the suggested total
	 * @returns {string}
	 */
	function deltaLabel(value) {
		// Below half a cent the formatted figure rounds to $0.00, and "$0.00 more"
		// beside 6 changed lines reads as a bug rather than a wash.
		if (Math.abs(value) < 0.005) return 'same total as the app suggested';
		const amount = formatMoney(Math.abs(value));
		return value > 0
			? `${amount} more than the app suggested`
			: `${amount} less than the app suggested`;
	}

	/**
	 * Signed short form for the docked mobile bar, where the sentence above would
	 * wrap onto three lines.
	 * @param {number} value - Current total minus the suggested total
	 * @returns {string}
	 */
	function deltaShort(value) {
		if (Math.abs(value) < 0.005) return 'no change';
		return `${value > 0 ? '+' : '−'}${formatMoney(Math.abs(value))}`;
	}

	// ————————————————————————————————————————————————————————————————————
	// Edit handlers
	// ————————————————————————————————————————————————————————————————————

	// An edited quantity was reasoned under the old lead/coverage assumptions —
	// silently keeping it would misstate the totals, so stepper changes drop the
	// qty edits (checkbox choices survive).
	function clearQtyOverrides() {
		let cleared = 0;
		for (const key of Object.keys(overrides)) {
			if (overrides[key].qty === undefined) continue;
			delete overrides[key].qty;
			cleared += 1;
			// A line left with no fields is dead weight in the saved document.
			if (Object.keys(overrides[key]).length === 0) delete overrides[key];
		}
		// Dropping typed quantities on a stepper click is deliberate, but doing it
		// silently reads as the page losing work — say what happened.
		if (cleared > 0) {
			const noun = cleared === 1 ? 'quantity' : 'quantities';
			notificationStore.showNotification(
				`Resized the order — ${cleared} edited ${noun} went back to the suggestion.`,
				'info'
			);
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

	function onAdjustmentInput(id, event) {
		const digits = event.currentTarget.value.replace(/[^0-9]/g, '');
		const amount = digits === '' ? 0 : parseInt(digits, 10);
		adjustments[id] = amount;
		event.currentTarget.value = amount === 0 ? '' : String(amount);
	}

	function applyQtyAdjustment(row, direction) {
		const amount = adjustments[row.id] ?? 0;
		if (!Number.isFinite(amount) || amount <= 0) return;
		const next = adjustOrderQuantity(row.qty, amount, direction);
		if (next !== row.qty) setQtyOverride(row, next);
		adjustments[row.id] = 0;
	}

	function toggleIncluded(row, event) {
		overrides[row.id] = { ...(overrides[row.id] ?? {}), included: event.currentTarget.checked };
		scheduleSave();
	}

	// Numeric columns read high-to-low first; name and dates read low-to-high.
	const DESC_FIRST = ['qty', 'value', 'count', 'cost'];

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

	// ————————————————————————————————————————————————————————————————————
	// Tooltips
	//
	// The shared Tooltip component rather than a native `title`: a title is OS
	// chrome that never follows the theme, waits a second to appear, and is
	// unreachable by keyboard or touch.
	// ————————————————————————————————————————————————————————————————————

	let tooltip = $state({ text: '', x: 0, y: 0, visible: false });
	const TOOLTIP_VIEWPORT_GUTTER = 16;
	const TOOLTIP_MAX_WIDTH = 288;

	/**
	 * @param {{currentTarget: HTMLElement}} event - Pointer or focus event
	 * @param {boolean} [fromHover=false] - True when triggered by the mouse
	 */
	function showTip(event, fromHover = false) {
		// Touch screens fire mouseenter on tap but never mouseleave, which would
		// leave the tooltip stranded on screen. Focus still reaches these controls
		// on touch, so tapping one shows it and tapping away dismisses it.
		if (fromHover && window.matchMedia('(hover: none)').matches) return;
		const el = event.currentTarget;
		const text = el.dataset.tooltip;
		if (!text) return;
		const rect = el.getBoundingClientRect();
		const halfWidth = Math.min(
			TOOLTIP_MAX_WIDTH / 2,
			(window.innerWidth - TOOLTIP_VIEWPORT_GUTTER * 2) / 2
		);
		const center = rect.left + rect.width / 2;
		const safeCenter = Math.min(
			window.innerWidth - halfWidth - TOOLTIP_VIEWPORT_GUTTER,
			Math.max(halfWidth + TOOLTIP_VIEWPORT_GUTTER, center)
		);
		tooltip = {
			text,
			x: safeCenter + window.scrollX,
			y: rect.top + window.scrollY - 8,
			visible: true
		};
	}

	function hideTip() {
		tooltip = { ...tooltip, visible: false };
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
				// Mirrors the on-screen columns: printing "on hand 0" against every
				// line of an opening buy is the same dead figure the table drops.
				let detail;
				if (!openingOrder) {
					detail = `on hand ${r.count}, ${r.runOut ? `out ${runOutLabel(r)}` : 'no run-out forecast'}`;
				} else if (showOnHand) {
					detail = `on hand ${r.count}`;
				} else {
					detail = r.cost > 0 ? `${formatMoney(r.cost)}/case` : 'no case cost on file';
				}
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
		<!-- Keep the checkbox column named for assistive technology without adding
		     another visible label beside the clearer Item heading. -->
		<span class="check-head"><span class="sr-only">Include in order</span></span>
		<span>{@render sortHead('name', 'Item')}</span>
		{#if showOnHand}
			<span class="num">{@render sortHead('count', 'On hand', 'num')}</span>
		{/if}
		{#if showCaseCost}
			<span class="num">{@render sortHead('cost', 'Case cost', 'num')}</span>
		{/if}
		<span class="num">{@render sortHead('qty', 'Order qty', 'num')}</span>
		<span class="num adjust-head">Adjust</span>
		<!-- "Line cost" named the concept, not the figure. Sitting after Case cost
		     and Order it's simply their product, and "Total" reads as that. -->
		<span class="num">{@render sortHead('value', 'Total', 'num')}</span>
		{#if !openingOrder}
			<span class="num">{@render sortHead('runOut', 'Runs out', 'num')}</span>
		{/if}
	</div>
{/snippet}

{#snippet orderRow(row)}
	<div
		class="order-row"
		class:skipped={!row.included}
		class:is-zero={row.qty === 0}
		class:row-edited={isEditedRow(row)}
	>
		<label class="cell-check">
			<input
				type="checkbox"
				checked={row.included}
				onchange={(e) => toggleIncluded(row, e)}
				aria-label={`Include ${row.name} in the order`}
				data-tooltip={row.included
					? 'Untick to leave this item off the order'
					: 'Tick to put this item back on the order'}
				onmouseenter={(e) => showTip(e, true)}
				onmouseleave={hideTip}
				onfocus={(e) => showTip(e)}
				onblur={hideTip}
			/>
		</label>
		<div class="cell-name">
			<span class="item-name">{row.name}</span>
			<!-- Dimming an unticked row said "something is different here" but not
			     what. Naming the state is what makes the tick's job obvious. -->
			{#if !row.included}
				<span class="skip-tag">Not ordering</span>
			{/if}
			<!-- Only medium/low tag themselves; an unmarked row is a confident one,
			     which the legend under the table states. A button rather than a span
			     so the *basis* behind the rating is reachable by keyboard and by tap,
			     not just by hovering a mouse over a `title`. -->
			{#if row.confidence.level !== 'high'}
				<button
					type="button"
					class="conf-tag {CONFIDENCE_META[row.confidence.level].cls}"
					data-tooltip={row.confidence.basis || CONFIDENCE_META[row.confidence.level].label}
					onmouseenter={(e) => showTip(e, true)}
					onmouseleave={hideTip}
					onfocus={(e) => showTip(e)}
					onblur={hideTip}
				>
					<span aria-hidden="true">{CONFIDENCE_META[row.confidence.level].short}</span>
					<span class="sr-only">{CONFIDENCE_META[row.confidence.level].label}</span>
				</button>
			{/if}
		</div>
		{#if showOnHand}
			<div class="cell-onhand">
				<span class="cell-cap">On hand</span>
				<span class="cell-val">{row.count}</span>
			</div>
		{/if}
		{#if showCaseCost}
			<div class="cell-cost">
				<span class="cell-cap">Case cost</span>
				<span class="cell-val">{row.cost > 0 ? formatMoney(row.cost) : '—'}</span>
			</div>
		{/if}
		<div class="cell-qty">
			<span class="cell-cap">Order qty</span>
			<span class="order-qty" class:is-edited={row.edited}>{row.qty}</span>
		</div>
		<div class="cell-adjust">
			<span class="cell-cap">Adjust</span>
			<div class="qty-stepper" class:is-edited={row.edited}>
				<button
					type="button"
					class="qty-step qty-step-decrease"
					onclick={() => applyQtyAdjustment(row, -1)}
					disabled={!row.included || row.qty === 0 || !adjustments[row.id]}
					aria-label={`Subtract ${adjustments[row.id] || 0} cases from ${row.name}`}
				>
					<span aria-hidden="true">&minus;</span>
				</button>
				<input
					type="number"
					min="0"
					inputmode="numeric"
					pattern="[0-9]*"
					placeholder="0"
					value={adjustments[row.id] || ''}
					disabled={!row.included}
					oninput={(e) => onAdjustmentInput(row.id, e)}
					aria-label={`Adjustment amount for ${row.name}`}
				/>
				<button
					type="button"
					class="qty-step qty-step-increase"
					onclick={() => applyQtyAdjustment(row, 1)}
					disabled={!row.included || !adjustments[row.id]}
					aria-label={`Add ${adjustments[row.id] || 0} cases to ${row.name}`}
				>
					<span aria-hidden="true">+</span>
				</button>
				<button
					type="button"
					class="qty-restore"
					onclick={() => {
						hideTip();
						adjustments[row.id] = 0;
						resetQty(row.id);
					}}
					disabled={!row.edited}
					aria-label={row.edited
						? `Restore the suggested ${row.suggested} cases of ${row.name}`
						: `${row.name} is already at the suggested ${row.suggested} cases`}
					data-tooltip="Restore suggested quantity"
					onmouseenter={(e) => showTip(e, true)}
					onmouseleave={hideTip}
					onfocus={(e) => showTip(e)}
					onblur={hideTip}
				>
					<span aria-hidden="true">&#8634;</span>
					<span>{row.suggested}</span>
				</button>
			</div>
		</div>
		<div class="cell-line">
			<span class="cell-cap">Total</span>
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

			<div class="total-mid">
				<!-- The number whoever reviews this draft is actually after: not what
				     the order costs, but how far someone moved it from the forecast. -->
				{#if edits.editedCount > 0}
					<div class="edit-summary" class:is-up={edits.delta > 0} class:is-down={edits.delta < 0}>
						<span class="edit-count">
							{edits.editedCount}
							{edits.editedCount === 1 ? 'line' : 'lines'} changed
						</span>
						<span class="edit-delta">{deltaLabel(edits.delta)}</span>
						<button
							class="review-btn"
							class:on={reviewingEdits}
							onclick={() => (editsOnly = !editsOnly)}
							aria-pressed={reviewingEdits}
						>
							{reviewingEdits ? 'Show all items' : 'Show only changes'}
						</button>
					</div>
				{/if}

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
			</div>

			<div class="total-actions">
				<p class="save-line" class:is-error={saveState === 'error'} aria-live="polite">
					<span class="shared-icon" aria-hidden="true">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="13"
							height="13"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle
								cx="9"
								cy="7"
								r="4"
							></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"></path></svg
						>
					</span>
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
				<!-- Nothing else on the page says this document is shared, so a change
				     appearing from another device reads as a glitch. -->
				<p class="shared-hint">Shared order — your group sees these edits live</p>
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

		<div
			class="table-card"
			class:is-opening={openingOrder}
			class:show-onhand={showOnHand}
			class:show-cost={showCaseCost}
			in:fly={sectionIn}
		>
			{#if reviewingEdits}
				<p class="review-strip">
					Showing only the {edits.editedCount}
					changed {edits.editedCount === 1 ? 'line' : 'lines'}.
					<button class="link-btn" onclick={() => (editsOnly = false)}>Show all items</button>
				</p>
			{/if}
			<!-- The tooltip is placed in page coordinates, so a row scrolling inside
		     this box would slide out from under it. -->
			<div class="table-scroll" onscroll={hideTip}>
				{@render colHead()}
				{#each SECTIONS as cfg (cfg.key)}
					{@render group(cfg)}
				{/each}
				{#if searched.length === 0}
					<p class="no-match">
						{#if search}
							No {reviewingEdits ? 'changed items' : 'items'} match “{search}”.
						{:else}
							Nothing to show here.
						{/if}
					</p>
				{/if}
			</div>
			<div class="table-legend">
				<p>
					<strong>Included items</strong> — checked items with a quantity above 0 are included when you
					copy the order. Untick an item to leave it out.
				</p>
				<p>
					<strong>Adjust</strong> — enter an amount, then use − or +. Order qty shows the updated total.
				</p>
				<!-- The in-row tags only mark medium and low, so say what an unmarked row
				     means rather than leaving it to be inferred. -->
				<p>
					<span class="conf-tag conf-medium">Fair</span>
					<span class="conf-tag conf-low">Low</span>
					mark a forecast built on thin sales history — worth a check before you order. Unmarked items
					are high confidence.
				</p>
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

		<!-- Mobile only (display:none above 640px, so it stays out of the tab order
		     on desktop). The desktop table has its own inner scroll, which keeps the
		     total card on screen; below 640px that cap is lifted and the page
		     scrolls, so the total would be several screens away exactly while you're
		     typing quantities. -->
		<div class="mobile-bar">
			<div class="mb-figures">
				<span class="mb-total">{formatMoney(totalCost)}</span>
				<span class="mb-sub">
					{formatCount(totalCases)}
					{totalCases === 1 ? 'case' : 'cases'}
					<span class="dot">&middot;</span>
					{checked.length}
					{checked.length === 1 ? 'item' : 'items'}
					{#if edits.editedCount > 0}
						<span class="dot">&middot;</span>
						<span class="mb-delta" class:is-up={edits.delta > 0} class:is-down={edits.delta < 0}>
							{deltaShort(edits.delta)}
						</span>
					{/if}
				</span>
			</div>
			<button class="copy-btn" onclick={copyOrder} disabled={checked.length === 0}>
				{copied ? 'Copied ✓' : 'Copy'}
			</button>
		</div>
	{/if}

	<Tooltip text={tooltip.text} x={tooltip.x} y={tooltip.y} visible={tooltip.visible} />
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

		/* Same page box as /manageItems and /manageTransactions — the layout centers
		   pages in a flex row, where items shrink to content width, so width:100%
		   is required to fill out to max-width. */
		width: 100%;
		max-width: 95%;
		margin: 0 auto;
		padding: 1.25rem;
		min-height: 100vh;
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

	.total-mid {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 0;
	}

	/* --- Edit impact: what someone's adjustments did to the forecast's number ---
	   The container stays neutral and the sign carries the colour: a warm plate
	   around every edited order would read as a warning about ordering at all. */
	.edit-summary {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.2rem 0.5rem;
		padding: 0.5rem 0.7rem;
		border-radius: 0.6rem;
		background: color-mix(in srgb, var(--observatory-accent) 9%, transparent);
		border: 1px solid color-mix(in srgb, var(--observatory-accent) 30%, transparent);
	}

	.edit-count {
		font-size: var(--text-xs);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--ord-label);
	}

	.edit-delta {
		font-size: var(--text-sm);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		color: var(--text-color);
	}

	.edit-summary.is-up .edit-delta {
		color: var(--observatory-warn);
	}

	.edit-summary.is-down .edit-delta {
		color: var(--observatory-add);
	}

	.review-btn {
		flex: 1 0 100%;
		margin-top: 0.15rem;
		padding: 0.32rem 0.6rem;
		border: 1px solid var(--ord-border);
		border-radius: 0.4rem;
		background: var(--container-bg);
		color: var(--text-color);
		font-size: var(--text-xs);
		font-weight: 600;
		cursor: pointer;
		transition: background-color 0.15s ease-out;
	}

	.review-btn:hover {
		background: var(--ord-hover);
	}

	.review-btn:focus-visible {
		outline: 2px solid var(--input-focus-border);
		outline-offset: 1px;
	}

	/* Tinted plate + weight rather than a filled accent: the accent is #007bff in
	   light, and small bold text on it lands under 4.5:1. */
	.review-btn.on {
		background: var(--observatory-accent-soft);
		border-color: var(--observatory-accent-border);
		font-weight: 700;
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
		display: flex;
		align-items: center;
		gap: 0.3rem;
		margin: 0;
		font-size: var(--text-xs);
		color: var(--ord-label);
		text-align: right;
	}

	.save-line.is-error {
		color: var(--observatory-remove);
		font-weight: 600;
	}

	.shared-icon {
		display: inline-flex;
		flex: none;
		opacity: 0.8;
	}

	/* The draft has always been a shared document; nothing on the page said so,
	   which made a teammate's change appear as if the page had lost your work. */
	.shared-hint {
		margin: 0;
		font-size: 0.68rem;
		color: var(--ord-dim);
		text-align: right;
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

	/* Sits above the sticky column head and outside the scroll box, so the reader
	   can't scroll into a filtered list and forget it's filtered. */
	.review-strip {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
		margin: 0;
		padding: 0.5rem 0.9rem;
		background: color-mix(in srgb, var(--observatory-accent) 9%, transparent);
		border-bottom: 1px solid color-mix(in srgb, var(--observatory-accent) 30%, transparent);
		font-size: var(--text-xs);
		color: var(--text-color);
	}

	.link-btn {
		padding: 0;
		border: none;
		background: none;
		color: var(--text-color);
		font: inherit;
		font-weight: 700;
		text-decoration: underline;
		cursor: pointer;
	}

	.link-btn:focus-visible {
		outline: 2px solid var(--input-focus-border);
		outline-offset: 2px;
	}

	.table-scroll {
		/* Capped so the total card above stays on screen while the rows scroll
		   inside — on desktop that cap *is* the persistent total. */
		max-height: min(58vh, 36rem);
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

	/* --- Rows (dense grid; cards on mobile) ---
	   Order quantity and adjustment are deliberately separate columns: the first
	   is the current total, while the second applies the entered +/- amount. */
	.col-head,
	.order-row {
		display: grid;
		grid-template-columns:
			2.4rem minmax(7rem, 2.6fr) 0.75fr 0.65fr minmax(11.2rem, 1.6fr) 1.05fr
			1.05fr;
		gap: 0.5rem;
		align-items: center;
	}

	.is-opening .col-head,
	.is-opening .order-row {
		grid-template-columns: 2.4rem minmax(7rem, 3fr) 1fr 0.65fr minmax(11.2rem, 1.6fr) 1.15fr;
	}

	.is-opening.show-onhand .col-head,
	.is-opening.show-onhand .order-row {
		grid-template-columns:
			2.4rem minmax(7rem, 2.6fr) 0.75fr 0.9fr 0.65fr minmax(11.2rem, 1.6fr)
			1.1fr;
	}

	.check-head {
		text-align: center;
	}

	.adjust-head {
		text-align: center;
	}

	/* Ruled columns: a hairline before each numeric column keeps the figures
	   visually bound to their header across a wide row, instead of drifting in
	   open space. Only the name column stays unruled. */
	.col-head > span:nth-child(n + 3),
	.order-row > div:nth-child(n + 3) {
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

	/* Centred to sit directly over the figures below, which were drifting to the
	   right of their own headings when both were flush-right (the sort arrow's
	   slot pushed the label off the column's true right edge). */
	.sort-btn.num {
		width: 100%;
		justify-content: center;
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

	.order-row {
		padding: 0.45rem 0.9rem;
		border-bottom: 1px solid var(--ord-divider);
		transition: background-color 0.12s ease-out;
	}

	.order-row:hover {
		background: var(--ord-hover);
	}

	/* Changed rows use the same neutral surfaces as the table instead of borrowing
	   the yellow/blue forecast accent. The slim label-colour rule remains visible
	   in either theme without making the whole row look like a warning. */
	.order-row.row-edited {
		background: color-mix(in srgb, var(--ord-label) 7%, transparent);
		box-shadow: inset 2px 0 0 var(--ord-label);
	}

	.order-row.row-edited:hover {
		background: color-mix(in srgb, var(--ord-label) 11%, transparent);
	}

	/* Excluding a line mutes its reference details, but not the checkbox or order
	   controls: re-including and restoring remain available actions. */
	.order-row.skipped > :not(.cell-check):not(.cell-qty):not(.cell-adjust) {
		opacity: 0.5;
	}

	.order-row.is-zero .item-name,
	.order-row.is-zero .cell-val,
	.order-row.is-zero .order-qty {
		color: var(--ord-dim);
		font-weight: 400;
	}

	.cell-check {
		display: flex;
		align-items: center;
		justify-content: center;
		align-self: stretch;
		cursor: pointer;
	}

	.cell-check input {
		width: 18px;
		height: 18px;
		min-height: 0;
		margin: 0;
		padding: 0;
		appearance: auto;
		accent-color: var(--add-item-color);
		border: none;
		border-radius: 0;
		background: transparent;
		cursor: pointer;
	}

	.cell-check input:focus {
		outline: none;
		box-shadow: none;
	}

	.cell-check input:focus-visible {
		outline: 2px solid var(--input-focus-border);
		outline-offset: 2px;
	}

	.cell-check input:disabled {
		opacity: 0.45;
		cursor: not-allowed;
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

	/* Names the excluded state instead of only dimming it — dimming said
	   "something differs here" without saying what the tick had done. */
	.skip-tag {
		flex: none;
		padding: 0.22rem 0.35rem;
		border-radius: 0.3rem;
		font-size: 0.62rem;
		font-weight: 600;
		line-height: 1;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		color: var(--ord-label);
		border: 1px solid var(--ord-border);
	}

	.cell-onhand,
	.cell-runout,
	.cell-cost,
	.cell-line {
		text-align: center;
	}

	/* --- Weight carries the hierarchy across the row ---
	   Order and Line cost are the two figures being decided; On hand and Case
	   cost are reference. Muting the reference pair is what makes the other two
	   read as primary — bolding everything would flatten the row again. */
	.cell-onhand .cell-val,
	.cell-cost .cell-val {
		color: var(--ord-label);
	}

	/* Matches the Total Value column in the items table, which is the house
	   treatment for the money figure in a row. */
	.cell-line .cell-val {
		font-weight: 700;
		color: var(--value-color);
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

	.cell-qty,
	.cell-adjust {
		display: flex;
		justify-content: center;
	}

	.order-qty {
		font-size: var(--text-sm);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.order-qty.is-edited {
		color: var(--text-color);
	}

	.qty-stepper {
		--qty-segment-size: 2.8rem;
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		align-items: center;
		width: calc(var(--qty-segment-size) * 4);
		min-width: 0;
		background: var(--container-bg);
		border: 1px solid var(--ord-border);
		border-radius: 0.4rem;
		overflow: hidden;
	}

	.qty-step {
		flex: none;
		display: grid;
		place-items: center;
		box-sizing: border-box;
		width: 100%;
		min-width: 0;
		height: 2rem;
		padding: 0;
		border: none;
		border-radius: 0;
		background: transparent;
		color: var(--text-color);
		font-size: 1rem;
		line-height: 1;
		text-align: center;
		cursor: pointer;
		transition: background-color 0.12s ease-out;
	}

	.qty-step-decrease:hover:not(:disabled) {
		background: var(--observatory-remove-soft);
		color: var(--observatory-remove);
	}

	.qty-step-increase:hover:not(:disabled) {
		background: var(--observatory-add-soft);
		color: var(--observatory-add);
	}

	.qty-step-decrease:active:not(:disabled) {
		background: color-mix(in srgb, var(--observatory-remove) 18%, var(--container-bg));
	}

	.qty-step-increase:active:not(:disabled) {
		background: color-mix(in srgb, var(--observatory-add) 18%, var(--container-bg));
	}

	/* Suppress the app-wide button focus ring on pointer clicks. Keyboard focus
	   gets a quiet inset underline that stays inside its segmented control. */
	.qty-step:focus,
	.qty-restore:focus {
		outline: none;
	}

	.qty-step:focus-visible,
	.qty-restore:focus-visible {
		position: relative;
		z-index: 1;
		background: var(--ord-hover);
		box-shadow: inset 0 -2px 0 var(--input-focus-border);
	}

	.qty-step:disabled {
		color: var(--ord-dim);
		cursor: not-allowed;
	}

	/* The spin buttons occupy the right of the content box, so a "centred" value
	   was really centred in what the spinners left over — visibly off to the
	   left. Removing them lets text-align: center actually centre. */
	.cell-adjust input::-webkit-outer-spin-button,
	.cell-adjust input::-webkit-inner-spin-button {
		-webkit-appearance: none;
		appearance: none;
		margin: 0;
	}

	.cell-adjust input {
		-moz-appearance: textfield;
		appearance: textfield;
		box-sizing: border-box;
		width: 100%;
		min-width: 0;
		height: 2rem;
		text-align: center;
		font-variant-numeric: tabular-nums;
		font-size: var(--text-sm);
		font-weight: 700;
		background: var(--input-bg);
		color: var(--text-color);
		border: none;
		border-right: 1px solid var(--ord-divider);
		border-left: 1px solid var(--ord-divider);
		border-radius: 0;
		padding: 0 0.25rem;
	}

	.qty-stepper.is-edited {
		border-color: var(--ord-label);
	}

	.cell-adjust input::placeholder {
		color: var(--ord-dim);
		font-weight: 400;
	}

	.cell-adjust input:focus {
		position: relative;
		z-index: 1;
		outline: none;
		box-shadow: none;
	}

	.cell-adjust input:focus-visible {
		background: var(--ord-hover);
		box-shadow: inset 0 -2px 0 var(--input-focus-border);
	}

	.cell-adjust input:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.qty-restore {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.2rem;
		height: 2rem;
		box-sizing: border-box;
		width: 100%;
		min-width: 0;
		padding: 0;
		border: none;
		border-left: 1px solid var(--ord-divider);
		border-radius: 0;
		background: transparent;
		color: var(--ord-label);
		font-family: inherit;
		font-size: var(--text-xs);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		line-height: 1;
		white-space: nowrap;
		cursor: pointer;
	}

	.qty-restore:hover:not(:disabled) {
		background: color-mix(in srgb, var(--observatory-accent) 14%, var(--container-bg));
		color: var(--observatory-accent);
	}

	.qty-restore:active:not(:disabled) {
		background: color-mix(in srgb, var(--observatory-accent) 20%, var(--container-bg));
	}

	.qty-restore:not(:disabled) {
		background: color-mix(in srgb, var(--observatory-accent) 8%, var(--container-bg));
		color: var(--observatory-accent);
	}

	.qty-restore:disabled {
		opacity: 0.45;
		cursor: default;
	}

	/* Confidence reads as a tag beside the name rather than an unlabelled dot in
	   a column of its own: the dot's only affordance was a `title` tooltip, which
	   a phone can't show at all. `--tag-tone` is deliberately not the band's
	   `--tone` — a low-confidence tag must not repaint itself red just because it
	   happens to sit in the urgent band. */
	/* Shared by the in-row button and the legend's plain spans, so the font has to
	   be stated rather than inherited — a button won't take the page's. */
	.conf-tag {
		--tag-tone: var(--ord-label);
		flex: none;
		/* Pushed to the right edge of the name column so the tags line up down the
		   table instead of raggedly tracking the end of each item name. */
		margin-left: auto;
		padding: 0.22rem 0.35rem;
		border-radius: 0.3rem;
		font-family: inherit;
		font-size: 0.62rem;
		font-weight: 600;
		/* Fits the word rather than the row: the tag box was inheriting a tall
		   line box and reading as a control the height of the whole cell. */
		line-height: 1;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		cursor: pointer;
		color: var(--tag-tone);
		/* Outline only, no fill. Pre-fair a tag lands on nearly every row, and a
		   filled amber plate on all 49 of them was the same colour and weight as
		   the money column — with both shouting, neither read as the primary
		   figure. The tag is an aside; Total is the number being decided. */
		background: transparent;
		border: 1px solid color-mix(in srgb, var(--tag-tone) 45%, transparent);
	}

	.conf-tag:focus-visible {
		outline: 2px solid var(--input-focus-border);
		outline-offset: 1px;
	}

	.conf-tag.conf-high {
		--tag-tone: var(--observatory-add);
	}

	/* Neutral, not amber. "Fair" is the unremarkable middle state and lands on
	   nearly every row pre-fair — 49 amber tags drowned out the one amber that
	   matters (Total) and made a genuine "Low" impossible to pick out. Colour is
	   reserved for the level that actually wants a second look. */
	.conf-tag.conf-medium {
		--tag-tone: var(--ord-label);
	}

	.conf-tag.conf-low {
		--tag-tone: var(--observatory-remove);
	}

	/* --- Legend: what the tick does, and what an *unmarked* row means --- */
	.table-legend {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.55rem 0.9rem;
		border-top: 1px solid var(--ord-divider);
		background: var(--ord-soft);
		font-size: var(--text-xs);
		color: var(--ord-label);
	}

	/* The legend's copies sit in a sentence, not at the end of a flex row. */
	.table-legend .conf-tag {
		margin-left: 0;
	}

	.table-legend p {
		margin: 0;
	}

	.table-legend strong {
		color: var(--text-color);
	}

	/* The legend's copies are plain spans with nothing to reveal. */
	.table-legend .conf-tag {
		cursor: default;
		vertical-align: middle;
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

	/* --- Mobile total bar (hidden entirely on desktop, so it stays out of the
	   tab order and the a11y tree there rather than needing aria-hidden) --- */
	.mobile-bar {
		display: none;
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
			padding: 0.75rem;
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

		/* In-fair card: name row, then the two figures you act on, then the two
		   you check against. The confidence tag rides in the name cell now, so it
		   no longer needs a grid area of its own. */
		.order-row {
			grid-template-columns: 1.4rem 1fr 1fr;
			grid-template-areas:
				'check name name'
				'onhand order order'
				'adjust adjust adjust'
				'line line runout';
			row-gap: 0.5rem;
			padding: 0.65rem 0.75rem;
		}

		.is-opening .order-row,
		.is-opening.show-onhand .order-row {
			grid-template-columns: 1.4rem 1fr 1fr;
		}

		/* Opening drops Runs out and gains the per-case price. */
		.is-opening .order-row {
			grid-template-areas:
				'check name name'
				'cost order order'
				'adjust adjust adjust'
				'line line line';
		}

		.is-opening.show-onhand .order-row {
			grid-template-areas:
				'check name name'
				'onhand cost cost'
				'order order order'
				'adjust adjust adjust'
				'line line line';
		}

		/* Column rules belong to the desktop grid; the stacked card has none. */
		.order-row > div:nth-child(n + 3) {
			border-left: none;
			padding-left: 0;
		}

		.cell-check {
			grid-area: check;
		}
		.cell-name {
			grid-area: name;
		}
		.cell-onhand {
			grid-area: onhand;
		}
		.cell-cost {
			grid-area: cost;
		}
		.cell-qty {
			grid-area: order;
		}
		.cell-adjust {
			grid-area: adjust;
		}
		.cell-line {
			grid-area: line;
		}
		.cell-runout {
			grid-area: runout;
		}

		.cell-onhand,
		.cell-runout,
		.cell-cost,
		.cell-line,
		.cell-qty,
		.cell-adjust {
			display: flex;
			flex-direction: column;
			align-items: flex-start;
			gap: 0.15rem;
			text-align: left;
		}

		.cell-cap {
			display: block;
		}

		.qty-step {
			height: var(--touch-target-min);
		}

		.qty-stepper {
			width: 100%;
		}

		.qty-restore {
			height: var(--touch-target-min);
		}

		.cell-adjust input {
			height: var(--touch-target-min);
		}

		.cell-adjust {
			align-items: stretch;
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

		.save-line,
		.shared-hint {
			text-align: left;
		}

		/* The inner scroll cap is lifted here, so the page scrolls and the total
		   card ends up several screens above the row you're editing. Dock the
		   figure and the one action that consumes it. */
		.mobile-bar {
			position: fixed;
			left: 0;
			right: 0;
			bottom: 0;
			z-index: 900;
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 0.75rem;
			padding: 0.6rem 0.85rem;
			padding-bottom: calc(0.6rem + env(safe-area-inset-bottom));
			background: var(--container-bg);
			border-top: 1px solid var(--ord-border);
			box-shadow: 0 -2px 10px color-mix(in srgb, var(--text-color) 12%, transparent);
		}

		/* Clear the docked bar so the last row and the legend stay reachable. */
		.orders-page {
			padding-bottom: 5.5rem;
		}

		.mb-figures {
			display: flex;
			flex-direction: column;
			min-width: 0;
		}

		.mb-total {
			font-size: 1.15rem;
			font-weight: 700;
			line-height: 1.2;
			font-variant-numeric: tabular-nums;
			color: var(--value-color);
		}

		.mb-sub {
			font-size: 0.68rem;
			color: var(--ord-label);
			font-variant-numeric: tabular-nums;
		}

		.mb-delta.is-up {
			color: var(--observatory-warn);
			font-weight: 700;
		}

		.mb-delta.is-down {
			color: var(--observatory-add);
			font-weight: 700;
		}

		.mobile-bar .copy-btn {
			flex: none;
			height: var(--touch-target-min);
		}
	}
</style>
