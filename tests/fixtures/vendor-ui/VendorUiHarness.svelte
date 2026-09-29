<script>
	import VendorLoanDialog from '../../../src/components/VendorLoanDialog.svelte';
	import VendorSettleDialog from '../../../src/components/VendorSettleDialog.svelte';
	const items = [
		{
			id: 'fixture-tea',
			name: 'Fixture bubble tea',
			count: 10,
			lowCount: 0,
			cost: 2.5,
			storageType: 'Refrigerator',
			stockByStorage: { Freezer: 0, Refrigerator: 10, 'Dry Storage': 0 }
		}
	];
	// A free-text product with no agreed price, so no amount is suggested.
	const loan = {
		id: 'fixture-loan',
		vendorId: 'harveys',
		vendorName: "Harvey's",
		direction: 'lent',
		itemId: null,
		productName: 'Watermelon',
		unitPriceCents: null,
		quantity: 10,
		adjustedQuantity: 0,
		returnedQuantity: 0,
		cashSettledQuantity: 0,
		cashPaidCents: 0
	};
	/** @type {'loan' | 'cash' | null} */
	let open = $state(null);
	let saved = $state(null);
	async function save(details) {
		saved = details;
	}
</script>

<main>
	<h1>Vendor dialogs test fixture</h1>
	<div class="fixture-actions">
		<button onclick={() => (open = 'loan')}>Open loan dialog</button>
		<button onclick={() => (open = 'cash')}>Open cash dialog</button>
	</div>
	<pre aria-label="Saved">{JSON.stringify(saved)}</pre>
	{#if open === 'loan'}
		<VendorLoanDialog
			{items}
			vendorNames={["Harvey's"]}
			onsave={save}
			onclose={() => (open = null)}
		/>
	{:else if open === 'cash'}
		<VendorSettleDialog {loan} mode="cash" onsave={save} onclose={() => (open = null)} />
	{/if}
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
		gap: 0.5rem;
	}
	button {
		color: var(--text-color);
		background: var(--container-bg);
		border: 1px solid var(--table-border-color);
		min-height: 44px;
		padding: 0.5rem;
	}
</style>
