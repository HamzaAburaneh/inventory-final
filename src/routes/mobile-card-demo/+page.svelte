<script>
	import InventoryMobileCard from '../../components/InventoryMobileCard.svelte';

	// Sample data showcasing different scenarios
	const sampleItems = [
		{
			id: 1,
			name: "Premium Widget Pro",
			count: 94,
			lowCount: 10,
			cost: 106.80,
			storageType: "Dry Storage",
			booths: ["freshly", "b1", "jakes"]
		},
		{
			id: 2,
			name: "Frozen Deluxe Item",
			count: 45,
			lowCount: 5,
			cost: 25.50,
			storageType: "Freezer",
			booths: ["b2", "epic"]
		},
		{
			id: 3,
			name: "Fresh Produce",
			count: 120,
			lowCount: 20,
			cost: 3.99,
			storageType: "Refrigerator",
			booths: ["freshly", "jakes", "pulled"]
		},
		{
			id: 4,
			name: "Bulk Item with Very Long Name That Should Truncate",
			count: 500,
			lowCount: 50,
			cost: 1.25,
			storageType: "Dry Storage",
			booths: ["b1"]
		},
		{
			id: 5,
			name: "Low Stock Alert",
			count: 3,
			lowCount: 10,
			cost: 89.99,
			storageType: "Refrigerator",
			booths: ["epic", "pulled"]
		}
	];

	function handleEdit(id, field, value, position) {
		console.log('Edit triggered:', { id, field, value, position });
		alert(`Edit ${field} for item ${id}\nCurrent value: ${value}`);
	}

	function handleDelete(id, name, position) {
		console.log('Delete triggered:', { id, name, position });
		if (confirm(`Delete "${name}"?`)) {
			alert(`Item ${id} would be deleted`);
		}
	}

	function handleTooltipShow(event) {
		console.log('Tooltip show:', event.currentTarget.dataset.tooltip);
	}

	function handleTooltipHide() {
		console.log('Tooltip hide');
	}
</script>

<svelte:head>
	<title>Mobile Card Design Demo | Inventory</title>
	<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
</svelte:head>

<div class="demo-container">
	<header class="demo-header">
		<h1 class="demo-title">Mobile Card Design System</h1>
		<p class="demo-subtitle">Clean Industrial Aesthetic - Dark Mode</p>
	</header>

	<section class="design-principles">
		<h2 class="section-title">Design Principles</h2>
		<div class="principles-grid">
			<div class="principle-card">
				<div class="principle-icon">✨</div>
				<h3>Minimalism</h3>
				<p>Whitespace over borders. Spacing defines relationships.</p>
			</div>
			<div class="principle-card">
				<div class="principle-icon">📐</div>
				<h3>Uniformity</h3>
				<p>Strict 4px/8px grid. 12px border-radius throughout.</p>
			</div>
			<div class="principle-card">
				<div class="principle-icon">👁️</div>
				<h3>Visual Hierarchy</h3>
				<p>Scannable in under 1 second. Clear priority levels.</p>
			</div>
		</div>
	</section>

	<section class="cards-showcase">
		<h2 class="section-title">Card Examples</h2>
		<div class="cards-container">
			{#each sampleItems as item (item.id)}
				<InventoryMobileCard
					{item}
					onEdit={handleEdit}
					onDelete={handleDelete}
					onTooltipShow={handleTooltipShow}
					onTooltipHide={handleTooltipHide}
				/>
			{/each}
		</div>
	</section>

	<section class="specifications">
		<h2 class="section-title">Technical Specifications</h2>
		
		<div class="spec-grid">
			<div class="spec-card">
				<h3>Layout Structure</h3>
				<ul>
					<li><strong>Header:</strong> Item Name + Actions (Flexbox)</li>
					<li><strong>Body:</strong> 2-Column CSS Grid for metrics</li>
					<li><strong>Footer:</strong> Flexbox for tags</li>
				</ul>
			</div>

			<div class="spec-card">
				<h3>Spacing System</h3>
				<ul>
					<li><strong>4px:</strong> Small gaps (tags)</li>
					<li><strong>8px:</strong> Medium gaps (grid cells)</li>
					<li><strong>12px:</strong> Large gaps (card padding)</li>
					<li><strong>16px:</strong> Extra large (responsive)</li>
				</ul>
			</div>

			<div class="spec-card">
				<h3>Touch Targets</h3>
				<ul>
					<li><strong>44px:</strong> Primary actions (Edit/Delete)</li>
					<li><strong>32px:</strong> Secondary actions (Inline edits)</li>
					<li><strong>WCAG 2.1:</strong> Level AAA compliant</li>
				</ul>
			</div>

			<div class="spec-card">
				<h3>Typography</h3>
				<ul>
					<li><strong>1.25rem:</strong> Item name, values (Primary)</li>
					<li><strong>0.65rem:</strong> Labels (Tertiary)</li>
					<li><strong>Geist Mono:</strong> Numbers</li>
					<li><strong>Geist:</strong> Text</li>
				</ul>
			</div>
		</div>
	</section>

	<section class="color-system">
		<h2 class="section-title">Color System</h2>
		<div class="color-grid">
			<div class="color-swatch" style="--swatch-color: #ffe260;">
				<div class="swatch-preview"></div>
				<div class="swatch-info">
					<strong>Accent</strong>
					<code>#ffe260</code>
				</div>
			</div>
			<div class="color-swatch" style="--swatch-color: #e2e2e7;">
				<div class="swatch-preview"></div>
				<div class="swatch-info">
					<strong>Value</strong>
					<code>#e2e2e7</code>
				</div>
			</div>
			<div class="color-swatch" style="--swatch-color: #55555e;">
				<div class="swatch-preview"></div>
				<div class="swatch-info">
					<strong>Label</strong>
					<code>#55555e</code>
				</div>
			</div>
			<div class="color-swatch" style="--swatch-color: #0e0f11;">
				<div class="swatch-preview"></div>
				<div class="swatch-info">
					<strong>Glass BG</strong>
					<code>#0e0f11</code>
				</div>
			</div>
		</div>
	</section>
</div>

<style>
	.demo-container {
		min-height: 100vh;
		background: var(--tech-bg-end);
		background-image: radial-gradient(circle at 50% -10%, var(--tech-bg-start) 0%, var(--tech-bg-end) 100%);
		padding: 2rem 1rem;
		max-width: 600px;
		margin: 0 auto;
	}

	.demo-header {
		text-align: center;
		margin-bottom: 3rem;
	}

	.demo-title {
		font-size: 2rem;
		font-weight: 800;
		color: var(--tech-title);
		margin: 0 0 0.5rem 0;
		letter-spacing: -0.02em;
	}

	.demo-subtitle {
		font-size: 0.9rem;
		color: var(--tech-label);
		margin: 0;
		font-weight: 600;
	}

	.section-title {
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--tech-value);
		margin: 0 0 1.5rem 0;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-size: 0.9rem;
	}

	.design-principles {
		margin-bottom: 3rem;
	}

	.principles-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1rem;
	}

	.principle-card {
		background: var(--tech-glass-bg);
		border: 1px solid var(--tech-glass-border);
		border-radius: 12px;
		padding: 1.5rem;
		text-align: center;
	}

	.principle-icon {
		font-size: 2rem;
		margin-bottom: 0.5rem;
	}

	.principle-card h3 {
		font-size: 1rem;
		font-weight: 700;
		color: var(--tech-value);
		margin: 0 0 0.5rem 0;
	}

	.principle-card p {
		font-size: 0.85rem;
		color: var(--tech-label);
		margin: 0;
		line-height: 1.5;
	}

	.cards-showcase {
		margin-bottom: 3rem;
	}

	.cards-container {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.specifications {
		margin-bottom: 3rem;
	}

	.spec-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1rem;
	}

	.spec-card {
		background: var(--tech-glass-bg);
		border: 1px solid var(--tech-glass-border);
		border-radius: 12px;
		padding: 1.5rem;
	}

	.spec-card h3 {
		font-size: 0.9rem;
		font-weight: 700;
		color: var(--tech-accent);
		margin: 0 0 1rem 0;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.spec-card ul {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.spec-card li {
		font-size: 0.85rem;
		color: var(--tech-label);
		margin-bottom: 0.5rem;
		line-height: 1.5;
	}

	.spec-card li:last-child {
		margin-bottom: 0;
	}

	.spec-card strong {
		color: var(--tech-value);
		font-weight: 700;
	}

	.color-system {
		margin-bottom: 3rem;
	}

	.color-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1rem;
	}

	.color-swatch {
		background: var(--tech-glass-bg);
		border: 1px solid var(--tech-glass-border);
		border-radius: 12px;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.swatch-preview {
		width: 100%;
		height: 60px;
		background: var(--swatch-color);
		border-radius: 8px;
		border: 1px solid rgba(255, 255, 255, 0.1);
	}

	.swatch-info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.swatch-info strong {
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--tech-value);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.swatch-info code {
		font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		font-size: 0.7rem;
		color: var(--tech-label);
		background: rgba(255, 255, 255, 0.05);
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
	}

	@media (min-width: 480px) {
		.demo-container {
			padding: 3rem 2rem;
		}

		.principles-grid {
			grid-template-columns: repeat(3, 1fr);
		}

		.spec-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}
</style>
