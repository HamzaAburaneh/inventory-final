<script>
	import { fade, fly, slide } from 'svelte/transition';
	import { prefersReducedMotion } from 'svelte/motion';
	import StorageSelect from './StorageSelect.svelte';

	let { onAdd, booths = [], collapsed = $bindable(true) } = $props();

	const slideParams = $derived({ duration: prefersReducedMotion.current ? 0 : 250 });

	let formData = $state({
		name: '',
		count: '',
		lowCount: '',
		cost: '',
		storageType: '',
		booths: []
	});

	let errors = $state({});

	const validateField = (field, value) => {
		const validations = {
			name: () => (value.trim().length < 2 ? 'Name must be at least 2 characters' : ''),
			count: () =>
				isNaN(parseInt(value)) || parseInt(value) < 0 ? 'Must be a positive number' : '',
			lowCount: () =>
				isNaN(parseInt(value)) || parseInt(value) < 0 ? 'Must be a positive number' : '',
			cost: () =>
				isNaN(parseFloat(value)) || parseFloat(value) < 0 ? 'Must be a non-negative number' : ''
		};
		errors[field] = validations[field] ? validations[field]() : '';
	};

	const handleInput = (event, field, allowDecimal = false) => {
		let value = event.target.value;
		if (allowDecimal) {
			value = value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
			const [integer, decimal] = value.split('.');
			value = decimal ? `${integer}.${decimal.slice(0, 2)}` : value;
		} else {
			value = value.replace(/\D/g, '');
		}
		formData[field] = value;
		validateField(field, value);
	};

	const handleAdd = () => {
		if (formData.name.trim() === '') {
			// Surface the problem inline in the field's error slot rather than a dialog.
			errors.name = 'Item name cannot be empty';
			return;
		}

		onAdd({ formData });
		formData = { name: '', count: '', lowCount: '', cost: '', storageType: '', booths: [] };
		errors = {};
	};
</script>

<div class="form-card" class:collapsed>
	<button
		type="button"
		class="form-header"
		onclick={() => (collapsed = !collapsed)}
		aria-expanded={!collapsed}
		aria-controls="add-item-form"
	>
		<span class="form-header-icon" aria-hidden="true">
			<svg
				width="20"
				height="20"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<line x1="12" y1="5" x2="12" y2="19"></line>
				<line x1="5" y1="12" x2="19" y2="12"></line>
			</svg>
		</span>
		<div class="form-header-text">
			<h3 class="form-title">Add New Item</h3>
			<span class="form-subtitle">Enter item details</span>
		</div>
		<span class="collapse-chevron" class:open={!collapsed} aria-hidden="true">
			<svg
				width="20"
				height="20"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<polyline points="6 9 12 15 18 9"></polyline>
			</svg>
		</span>
	</button>

	{#if !collapsed}
		<div id="add-item-form" class="form-content" transition:slide={slideParams}>
			<div class="form-grid">
				<!-- Identity -->
				<section class="form-col">
					<div class="section-label">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path
								d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"
							></path>
							<line x1="7" y1="7" x2="7.01" y2="7"></line>
						</svg>
						<span>Identity</span>
					</div>
					<div class="col-fields">
						<div class="form-group">
							<label for="name" class="form-label">Item Name</label>
							<div class="input-wrapper">
								<input
									id="name"
									class="form-input transition-shadow duration-150 ease-out {errors.name
										? 'error'
										: ''}"
									bind:value={formData.name}
									placeholder="Enter item name"
									oninput={() => validateField('name', formData.name)}
								/>
							</div>
							<div class="error-slot">
								{#if errors.name}
									<div
										class="error-message"
										in:fly={{ y: -8, duration: 200 }}
										out:fade={{ duration: 100 }}
										title={errors.name}
									>
										{errors.name}
									</div>
								{/if}
							</div>
						</div>

						<div class="form-group">
							<span class="form-label" id="storage-label">Storage Type</span>
							<StorageSelect bind:value={formData.storageType} labelId="storage-label" />
						</div>
					</div>
				</section>

				<!-- Stock -->
				<section class="form-col">
					<div class="section-label">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
							<polyline points="2 17 12 22 22 17"></polyline>
							<polyline points="2 12 12 17 22 12"></polyline>
						</svg>
						<span>Stock</span>
					</div>
					<div class="col-fields">
						<div class="form-group">
							<label for="count" class="form-label">Current Stock</label>
							<div class="input-wrapper">
								<input
									id="count"
									class="form-input transition-shadow duration-150 ease-out {errors.count
										? 'error'
										: ''}"
									type="text"
									bind:value={formData.count}
									pattern="^[0-9]*$"
									placeholder="0"
									oninput={(event) => handleInput(event, 'count')}
								/>
							</div>
							<div class="error-slot">
								{#if errors.count}
									<div
										class="error-message"
										in:fly={{ y: -8, duration: 200 }}
										out:fade={{ duration: 100 }}
										title={errors.count}
									>
										{errors.count}
									</div>
								{/if}
							</div>
						</div>

						<div class="stock-pair">
							<div class="form-group">
								<label for="lowCount" class="form-label">Low Alert</label>
								<div class="input-wrapper">
									<input
										id="lowCount"
										class="form-input transition-shadow duration-150 ease-out {errors.lowCount
											? 'error'
											: ''}"
										type="text"
										bind:value={formData.lowCount}
										pattern="^[0-9]*$"
										placeholder="0"
										oninput={(event) => handleInput(event, 'lowCount')}
									/>
								</div>
								<div class="error-slot">
									{#if errors.lowCount}
										<div
											class="error-message"
											in:fly={{ y: -8, duration: 200 }}
											out:fade={{ duration: 100 }}
											title={errors.lowCount}
										>
											{errors.lowCount}
										</div>
									{/if}
								</div>
							</div>

							<div class="form-group">
								<label for="cost" class="form-label">Unit Cost ($)</label>
								<div class="input-wrapper">
									<input
										id="cost"
										class="form-input transition-shadow duration-150 ease-out {errors.cost
											? 'error'
											: ''}"
										type="text"
										bind:value={formData.cost}
										placeholder="0.00"
										oninput={(event) => handleInput(event, 'cost', true)}
									/>
								</div>
								<div class="error-slot">
									{#if errors.cost}
										<div
											class="error-message"
											in:fly={{ y: -8, duration: 200 }}
											out:fade={{ duration: 100 }}
											title={errors.cost}
										>
											{errors.cost}
										</div>
									{/if}
								</div>
							</div>
						</div>
					</div>
				</section>

				<!-- Booths -->
				<section class="form-col booth-col">
					<div class="section-label">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
							<circle cx="12" cy="10" r="3"></circle>
						</svg>
						<span>Booths</span>
					</div>
					<div class="booths-container">
						{#each booths as booth (booth.id)}
							<label class="booth-chip-label">
								<input
									type="checkbox"
									value={booth.id}
									bind:group={formData.booths}
									class="booth-checkbox"
								/>
								<span class="booth-chip" style="--booth-color: {booth.color}">
									<span class="booth-dot"></span>
									<span class="booth-check" aria-hidden="true">
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
											<polyline points="20 6 9 17 4 12"></polyline>
										</svg>
									</span>
									<span class="booth-chip-name">{booth.label}</span>
								</span>
							</label>
						{:else}
							<p class="booths-empty">
								No booths yet — a group owner can add some from the profile page.
							</p>
						{/each}
					</div>
				</section>
			</div>

			<div class="form-footer">
				<button
					class="add-button transition-all duration-150 ease-out active:scale-[0.98]"
					onclick={handleAdd}
				>
					<svg
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<line x1="12" y1="5" x2="12" y2="19"></line>
						<line x1="5" y1="12" x2="19" y2="12"></line>
					</svg>
					Add Item
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.form-card {
		background: var(--container-bg);
		border-radius: var(--border-radius);
		padding: 0;
		margin-bottom: 2rem;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
		border: 1px solid var(--table-border-color);
		/* No overflow:hidden — the custom dropdown popup needs to escape the card. */
	}

	.form-header {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		text-align: left;
		background: var(--table-header-bg);
		padding: 0.5rem 1rem;
		border: none;
		border-bottom: 1px solid var(--table-border-color);
		border-radius: var(--border-radius) var(--border-radius) 0 0;
		cursor: pointer;
		min-height: 0;
		color: var(--text-color);
		transition: background-color 0.15s ease-out;
		-webkit-tap-highlight-color: transparent;
	}

	.form-card.collapsed .form-header {
		border-bottom: none;
		border-radius: var(--border-radius);
	}

	.form-header:hover {
		background: var(--hover-bg-color);
	}

	/* Suppress the global button:focus outline on click (it draws a line under the
	   collapsed form); keep a keyboard-only ring for accessibility. */
	.form-header:focus {
		outline: none;
	}

	.form-header:focus-visible {
		outline: 2px solid var(--add-item-color);
		outline-offset: -2px;
	}

	.form-header-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: var(--border-radius);
		background: var(--add-item-color);
		color: var(--add-item-on);
	}

	.form-header-icon svg {
		width: 0.85rem;
		height: 0.85rem;
	}

	.form-header-text {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
	}

	.collapse-chevron {
		display: inline-flex;
		align-items: center;
		flex-shrink: 0;
		color: var(--text-color-dimmed);
		transition: transform 0.2s ease-out;
	}

	.collapse-chevron.open {
		transform: rotate(180deg);
	}

	.form-title {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 700;
		color: var(--text-color);
		letter-spacing: -0.025em;
		white-space: nowrap;
	}

	.form-subtitle {
		margin: 0;
		font-size: 0.72rem;
		color: var(--text-color-dimmed);
		font-weight: 400;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
	}

	@media (max-width: 520px) {
		.form-subtitle {
			display: none;
		}
	}

	.form-content {
		padding: 0;
	}

	/* Triptych: Identity / Stock / Booths. Columns stack on mobile, sit side by side
	   on wider screens. Add Item lives at the bottom of the Booths column. */
	.form-grid {
		display: flex;
		flex-direction: column;
	}

	.form-col {
		display: flex;
		flex-direction: column;
		padding: 0.85rem 1rem;
		border-bottom: 1px solid var(--table-border-color);
	}

	.form-col:last-child {
		border-bottom: none;
	}

	.section-label {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin-bottom: 0.65rem;
		font-size: 0.64rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		font-weight: 600;
		color: var(--text-color-dimmed);
	}

	.section-label svg {
		width: 0.8rem;
		height: 0.8rem;
		flex-shrink: 0;
	}

	.col-fields {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.stock-pair {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.55rem;
	}

	.form-group {
		position: relative;
	}

	.form-label {
		display: block;
		margin-bottom: 0.3rem;
		font-size: 0.72rem;
		font-weight: 600;
		color: var(--text-color);
		letter-spacing: 0.01em;
	}

	.input-wrapper {
		position: relative;
	}

	.form-input {
		width: 100%;
		padding: 0.45rem 0.7rem;
		border: 1.5px solid var(--input-border-color);
		border-radius: var(--border-radius);
		background-color: var(--input-bg);
		color: var(--input-text);
		font-size: 0.82rem;
		font-weight: 500;
	}

	.form-input::placeholder {
		color: var(--placeholder-text);
		font-weight: 400;
	}

	.form-input:focus {
		outline: none;
		border-color: var(--add-item-color);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--add-item-color) 30%, transparent);
	}

	.form-input:hover:not(:focus) {
		border-color: var(--input-hover-border-color);
		background-color: var(--input-hover-bg);
	}

	.form-input.error {
		border-color: #dc3545;
		box-shadow: 0 0 0 2px rgba(220, 53, 69, 0.2);
	}

	:global([data-theme='dark']) .form-input.error {
		border-color: #f87171;
		box-shadow: 0 0 0 2px rgba(248, 113, 113, 0.25);
	}

	/* Reserved slot under each validated field: the error renders here without
	   shifting the layout or covering the field below. */
	.error-slot {
		min-height: 1.55rem;
		margin-top: 0.3rem;
	}

	.error-message {
		padding: 0.3rem 0.6rem;
		background: #dc3545;
		color: white;
		border-radius: var(--border-radius);
		font-size: 0.72rem;
		font-weight: 500;
		line-height: 1.3;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		box-shadow: 0 4px 6px -1px rgba(220, 53, 69, 0.3);
	}

	/* Booth chips — compact pills that wrap inside the column. */
	.booths-container {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.booths-empty {
		margin: 0;
		font-size: 0.8rem;
		color: var(--text-color-dimmed);
	}

	.booth-chip-label {
		position: relative;
		display: inline-flex;
		cursor: pointer;
	}

	.booth-checkbox {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}

	.booth-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.32rem;
		height: 1.5rem;
		padding: 0 0.55rem;
		border: 1.5px solid var(--input-border-color);
		border-radius: var(--border-radius);
		background: var(--input-bg);
		font-size: 0.72rem;
		font-weight: 600;
		color: var(--text-color);
		white-space: nowrap;
		transition: all 0.15s ease-out;
	}

	.booth-chip:hover {
		border-color: var(--input-hover-border-color);
	}

	.booth-dot {
		width: 0.45rem;
		height: 0.45rem;
		border-radius: 50%;
		background: var(--booth-color);
		flex-shrink: 0;
	}

	.booth-check {
		display: none;
		align-items: center;
		flex-shrink: 0;
		color: #fff;
	}

	.booth-check svg {
		width: 0.72rem;
		height: 0.72rem;
		display: block;
	}

	/* Selected booth fills solid with its colour (matches the table's booth badges). */
	.booth-checkbox:checked + .booth-chip {
		border-color: var(--booth-color);
		background: var(--booth-color);
		color: #fff;
	}

	.booth-checkbox:checked + .booth-chip .booth-dot {
		display: none;
	}

	.booth-checkbox:checked + .booth-chip .booth-check {
		display: inline-flex;
	}

	.booth-checkbox:focus-visible + .booth-chip {
		outline: 2px solid var(--focus-border-color);
		outline-offset: 2px;
	}

	/* Action bar: centered, soft-tinted Add button below all three columns. */
	.form-footer {
		display: flex;
		justify-content: center;
		padding: 0.85rem 1rem;
		border-top: 1px solid var(--table-border-color);
	}

	.add-button {
		width: 280px;
		max-width: 100%;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.55rem 1.25rem;
		/* Soft tint of the accent rather than a solid fill — keeps the same hue in
		   both themes; hover just deepens the tint (no brightness/hue shift). */
		background: color-mix(in srgb, var(--add-item-color) 16%, transparent);
		color: var(--add-item-color);
		border: none;
		border-radius: 8px;
		font-size: 0.84rem;
		font-weight: 600;
		cursor: pointer;
		letter-spacing: 0.015em;
		user-select: none;
		transition:
			background-color 0.15s ease-out,
			color 0.15s ease-out;
		-webkit-tap-highlight-color: transparent;
	}

	/* Match the app's themed-button convention: tinted at rest, fills with the
	   solid accent on hover/press (same hue in both themes, no brightness shift). */
	.add-button:hover,
	.add-button:active {
		background: var(--add-item-color);
		color: var(--add-item-on);
	}

	.add-button:focus-visible {
		outline: 2px solid var(--add-item-color);
		outline-offset: 3px;
	}

	.add-button svg {
		width: 15px;
		height: 15px;
	}

	@media (min-width: 900px) {
		.form-header {
			padding: 0.55rem 1.5rem;
		}

		.form-grid {
			flex-direction: row;
			align-items: stretch;
		}

		.form-col {
			flex: 1;
			min-width: 0;
			padding: 1rem 1.25rem;
			border-bottom: none;
			border-right: 1px solid var(--table-border-color);
		}

		.form-col:last-child {
			border-right: none;
		}

		.form-footer {
			padding: 1rem 1.25rem;
		}

		.form-title {
			font-size: 1rem;
		}
	}
</style>
