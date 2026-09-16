<script>
	import ItemForm from '../../../src/components/ItemForm.svelte';
	import StockLocationControls from '../../../src/components/StockLocationControls.svelte';
	import StockLocationChips from '../../../src/components/StockLocationChips.svelte';
	import StockLocationFilter from '../../../src/components/StockLocationFilter.svelte';
	import StockTransferDialog from '../../../src/components/StockTransferDialog.svelte';
	import { matchesStockLocation } from '../../../src/lib/stockLocations.js';
	let item = $state({
		id: 'fixture-fries',
		name: 'Fixture fries',
		count: 10,
		lowCount: 3,
		storageType: 'Freezer',
		stockByStorage: { Freezer: 10, Refrigerator: 0, 'Dry Storage': 0 }
	});
	let formResult = $state('attention');
	let submitted = $state(null);
	let requests = $state(0);
	let transferOpen = $state(false);
	let movement = $state(null);
	let filter = $state('all');
	let pendingAdd = null;
	let pendingAdjust = null;
	let delayAdjust = $state(false);
	async function add({ formData }) {
		requests += 1;
		submitted = formData;
		if (formResult === 'pending') return new Promise((resolve) => (pendingAdd = resolve));
		return { status: formResult, error: formResult === 'attention' ? 'Fixture save failed' : null };
	}
	async function adjust(product, delta, location) {
		movement = { itemId: product.id, delta, location };
		if (!delayAdjust) return { status: 'queued' };
		// Mimics the server round trip: the confirmed balance arrives with the result.
		return new Promise((resolve) => {
			pendingAdjust = () => {
				const stockByStorage = { ...item.stockByStorage };
				stockByStorage[location] += delta;
				item = { ...item, count: item.count + delta, stockByStorage };
				resolve({ status: 'applied' });
			};
		});
	}
	async function transfer(id, from, to, quantity) {
		movement = { itemId: id, from, to, quantity };
		return { status: 'queued' };
	}
</script>

<main>
	<h1>Stock UI test fixture</h1>
	<div class="fixture-actions">
		<button onclick={() => (document.documentElement.dataset.theme = 'light')}>Light theme</button>
		<button onclick={() => (document.documentElement.dataset.theme = 'dark')}>Dark theme</button>
		<button onclick={() => (formResult = 'attention')}>Fail next add</button>
		<button onclick={() => (formResult = 'queued')}>Queue next add</button>
		<button onclick={() => (formResult = 'pending')}>Delay next add</button>
		<button onclick={() => pendingAdd?.({ status: 'queued' })}>Complete delayed add</button>
		<button onclick={() => (delayAdjust = true)}>Delay adjustments</button>
		<button onclick={() => pendingAdjust?.()}>Complete delayed adjustment</button>
		<button
			onclick={() =>
				(item = { ...item, count: 12, stockByStorage: { ...item.stockByStorage, Freezer: 12 } })}
			>Receive fresh snapshot</button
		>
	</div>
	<ItemForm collapsed={false} onAdd={add} />
	<section aria-label="Stock fixture">
		<StockLocationFilter value={filter} onchange={(value) => (filter = value)} />
		{#if matchesStockLocation(item, filter)}<article>
				<h2>{item.name} · Total {item.count}</h2>
				<StockLocationChips {item} />
				<StockLocationControls
					{item}
					onchange={adjust}
					ontransfer={() => (transferOpen = true)}
					onreset={() => {}}
				/>
			</article>{:else}<p>No matching stock</p>{/if}
	</section>
	<pre aria-label="Submitted item">{JSON.stringify(submitted)}</pre>
	<pre aria-label="Movement">{JSON.stringify(movement)}</pre>
	<output aria-label="Add requests">{requests}</output>
	{#if transferOpen}<StockTransferDialog
			{item}
			ontransfer={transfer}
			onclose={() => (transferOpen = false)}
		/>{/if}
</main>

<style>
	main {
		max-width: 1100px;
		padding: 1rem;
		margin: auto;
		color: var(--text-color);
	}
	.fixture-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}
	button {
		color: var(--text-color);
		background: var(--container-bg);
		border: 1px solid var(--table-border-color);
		min-height: 44px;
		padding: 0.5rem;
	}
	article {
		max-width: 420px;
		padding: 1rem;
		background: var(--container-bg);
		border: 1px solid var(--table-border-color);
	}
	pre {
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
</style>
