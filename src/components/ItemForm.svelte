<script>
	import { fade, fly, slide } from 'svelte/transition';
	import { prefersReducedMotion } from 'svelte/motion';
	import { tick } from 'svelte';
	import Swal from 'sweetalert2';

	let { onAdd, collapsed = $bindable(true) } = $props();

	const slideParams = $derived({ duration: prefersReducedMotion.current ? 0 : 250 });
	const menuParams = $derived({ y: -6, duration: prefersReducedMotion.current ? 0 : 150 });

	const boothOptions = [
		{ value: 'freshly', label: 'Freshly', color: '#10B981' },
		{ value: 'b1', label: 'B1', color: '#3B82F6' },
		{ value: 'b2', label: 'B2', color: '#8B5CF6' },
		{ value: 'jakes', label: 'Jakes', color: '#F59E0B' },
		{ value: 'epic', label: 'Epic', color: '#EF4444' },
		{ value: 'pulled', label: 'Pulled', color: '#6B7280' }
	];

	const storageTypes = [
		{ value: 'Freezer', color: '#3B82F6' },
		{ value: 'Refrigerator', color: '#10B981' },
		{ value: 'Dry Storage', color: '#F59E0B' }
	];

	const selectedStorage = $derived(
		storageTypes.find((option) => option.value === formData.storageType)
	);

	let formData = $state({
		name: '',
		count: '',
		lowCount: '',
		cost: '',
		storageType: '',
		booths: []
	});

	let errors = $state({});

	// Custom storage-type dropdown state.
	let storageOpen = $state(false);
	let triggerEl = $state();
	let menuEl = $state();

	function openMenu(focusFirst = false) {
		storageOpen = true;
		if (focusFirst) {
			tick().then(() => menuEl?.querySelector('.select-option')?.focus());
		}
	}

	function closeMenu(refocus = false) {
		storageOpen = false;
		if (refocus) triggerEl?.focus();
	}

	function chooseStorage(value) {
		formData.storageType = value;
		closeMenu(true);
	}

	function onTriggerKey(event) {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			openMenu(true);
		} else if (event.key === 'Escape') {
			closeMenu();
		}
	}

	function onMenuKey(event) {
		const options = [...menuEl.querySelectorAll('.select-option')];
		const index = options.indexOf(document.activeElement);
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			options[Math.min(index + 1, options.length - 1)]?.focus();
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			options[Math.max(index - 1, 0)]?.focus();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			closeMenu(true);
		} else if (event.key === 'Tab') {
			closeMenu();
		}
	}

	/** Close the dropdown when clicking anywhere outside the select. */
	function clickOutside(node, onOutside) {
		const handler = (event) => {
			if (!node.contains(event.target)) onOutside();
		};
		document.addEventListener('click', handler, true);
		return {
			destroy() {
				document.removeEventListener('click', handler, true);
			}
		};
	}

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

	const handleAdd = async () => {
		if (formData.name.trim() === '') {
			const scrollPos = window.pageYOffset || document.documentElement.scrollTop;

			await Swal.fire({
				icon: 'error',
				title: 'Empty Item Name',
				text: 'Item name cannot be empty.',
				background: 'var(--container-bg)',
				color: 'var(--text-color)',
				scrollbarPadding: false,
				heightAuto: false
			});

			setTimeout(() => {
				window.scrollTo(0, scrollPos);
			}, 50);
			return;
		}

		onAdd({ formData });
		formData = { name: '', count: '', lowCount: '', cost: '', storageType: '', booths: [] };
		errors = {};
	};
</script>

{#snippet storageIcon(value)}
	{#if value === 'Freezer'}
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<line x1="12" y1="3" x2="12" y2="21"></line>
			<line x1="3" y1="12" x2="21" y2="12"></line>
			<line x1="5.6" y1="5.6" x2="18.4" y2="18.4"></line>
			<line x1="18.4" y1="5.6" x2="5.6" y2="18.4"></line>
		</svg>
	{:else if value === 'Refrigerator'}
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<rect x="6" y="2.5" width="12" height="19" rx="2"></rect>
			<line x1="6" y1="10" x2="18" y2="10"></line>
			<line x1="9" y1="5" x2="9" y2="7.5"></line>
			<line x1="9" y1="12.5" x2="9" y2="15.5"></line>
		</svg>
	{:else}
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<path
				d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
			></path>
			<polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
			<line x1="12" y1="22.08" x2="12" y2="12"></line>
		</svg>
	{/if}
{/snippet}

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
							<div class="select" use:clickOutside={() => closeMenu()}>
								<button
									type="button"
									bind:this={triggerEl}
									class="select-trigger"
									class:open={storageOpen}
									class:placeholder={!formData.storageType}
									aria-haspopup="listbox"
									aria-expanded={storageOpen}
									aria-labelledby="storage-label"
									onclick={() => (storageOpen ? closeMenu() : openMenu())}
									onkeydown={onTriggerKey}
								>
									<span class="select-value">
										{#if selectedStorage}
											<span class="opt-icon" style="--opt-color: {selectedStorage.color}">
												{@render storageIcon(selectedStorage.value)}
											</span>
											<span class="select-value-text">{selectedStorage.value}</span>
										{:else}
											<span class="select-value-text">Select storage type...</span>
										{/if}
									</span>
									<span class="select-chevron" class:open={storageOpen} aria-hidden="true">
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
											<polyline points="6 9 12 15 18 9"></polyline>
										</svg>
									</span>
								</button>

								{#if storageOpen}
									<div
										class="select-menu"
										role="listbox"
										tabindex="-1"
										aria-labelledby="storage-label"
										bind:this={menuEl}
										onkeydown={onMenuKey}
										transition:fly={menuParams}
									>
										{#each storageTypes as option (option.value)}
											<button
												type="button"
												role="option"
												aria-selected={formData.storageType === option.value}
												class="select-option"
												class:selected={formData.storageType === option.value}
												style="--opt-color: {option.color}"
												onclick={() => chooseStorage(option.value)}
											>
												<span class="select-option-main">
													<span class="opt-glyph">
														{@render storageIcon(option.value)}
													</span>
													<span>{option.value}</span>
												</span>
												{#if formData.storageType === option.value}
													<span class="select-check" aria-hidden="true">
														<svg
															viewBox="0 0 24 24"
															fill="none"
															stroke="currentColor"
															stroke-width="3"
														>
															<polyline points="20 6 9 17 4 12"></polyline>
														</svg>
													</span>
												{/if}
											</button>
										{/each}
									</div>
								{/if}
							</div>
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
						{#each boothOptions as booth (booth.value)}
							<label class="booth-chip-label">
								<input
									type="checkbox"
									value={booth.value}
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
						{/each}
					</div>

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
				</section>
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

	/* Custom storage-type dropdown. */
	.select {
		position: relative;
	}

	.select-trigger {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.45rem 0.7rem;
		border: 1.5px solid var(--input-border-color);
		border-radius: var(--border-radius);
		background-color: var(--input-bg);
		color: var(--input-text);
		font-size: 0.82rem;
		font-weight: 500;
		text-align: left;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
		transition:
			border-color 0.15s ease-out,
			box-shadow 0.15s ease-out,
			background-color 0.15s ease-out;
	}

	.select-trigger:hover:not(.open) {
		border-color: var(--input-hover-border-color);
		background-color: var(--input-hover-bg);
	}

	/* Suppress the global button:focus blue outline; keep the accent ring below. */
	.select-trigger:focus {
		outline: none;
	}

	.select-trigger.open,
	.select-trigger:focus-visible {
		outline: none;
		border-color: var(--add-item-color);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--add-item-color) 30%, transparent);
	}

	.select-trigger.placeholder {
		color: var(--placeholder-text);
		font-weight: 400;
	}

	.select-value {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		min-width: 0;
		overflow: hidden;
	}

	.select-value-text {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.opt-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 1.4rem;
		height: 1.4rem;
		border-radius: calc(var(--border-radius) - 3px);
		background: color-mix(in srgb, var(--opt-color) 18%, transparent);
		color: var(--opt-color);
	}

	.opt-icon svg {
		width: 0.82rem;
		height: 0.82rem;
		display: block;
	}

	/* Plain colored glyph used in the dropdown rows (the trigger keeps .opt-icon). */
	.opt-glyph {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 1.05rem;
		height: 1.05rem;
		color: var(--opt-color);
	}

	.opt-glyph svg {
		width: 100%;
		height: 100%;
		display: block;
	}

	.select-chevron {
		display: inline-flex;
		flex-shrink: 0;
		color: var(--text-color-dimmed);
		transition: transform 0.2s ease-out;
	}

	.select-chevron.open {
		transform: rotate(180deg);
	}

	.select-chevron svg {
		width: 0.85rem;
		height: 0.85rem;
		display: block;
	}

	.select-menu {
		position: absolute;
		top: calc(100% + 0.35rem);
		left: 0;
		right: 0;
		z-index: 50;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		padding: 0.3rem;
		background: var(--container-bg);
		border: 1px solid var(--table-border-color);
		border-radius: var(--border-radius);
		box-shadow: 0 10px 28px rgba(0, 0, 0, 0.22);
	}

	.select-option {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		width: 100%;
		padding: 0.4rem 0.5rem 0.4rem 0.6rem;
		border: none;
		/* Colored accent rule down the left of each row; single-sided border so
		   the corners on that edge stay square. */
		border-left: 3px solid var(--opt-color);
		border-radius: 0 calc(var(--border-radius) - 2px) calc(var(--border-radius) - 2px) 0;
		background: transparent;
		color: var(--text-color);
		font-size: 0.82rem;
		font-weight: 500;
		text-align: left;
		cursor: pointer;
		transition:
			background-color 0.12s ease-out,
			color 0.12s ease-out;
	}

	.select-option:hover:not(.selected),
	.select-option:focus-visible {
		outline: none;
		background: var(--hover-bg-color);
	}

	.select-option-main {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
	}

	.select-option.selected {
		background: color-mix(in srgb, var(--opt-color) 16%, transparent);
	}

	.select-check {
		display: inline-flex;
		flex-shrink: 0;
		color: var(--opt-color);
	}

	.select-check svg {
		width: 0.85rem;
		height: 0.85rem;
		display: block;
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

	.add-button {
		margin-top: 0.9rem;
		width: 100%;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.55rem 1.25rem;
		background: var(--add-item-color);
		color: var(--add-item-on);
		border: none;
		border-radius: var(--border-radius);
		font-size: 0.84rem;
		font-weight: 600;
		cursor: pointer;
		box-shadow: 0 4px 15px rgba(0, 0, 0, 0.12);
		letter-spacing: 0.015em;
		user-select: none;
		-webkit-tap-highlight-color: transparent;
	}

	.add-button:hover {
		transform: translateY(-2px);
		box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
		filter: brightness(1.25);
	}

	.add-button:focus-visible {
		outline: 2px solid var(--add-item-color);
		outline-offset: 3px;
	}

	.add-button:active {
		transform: translateY(0);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
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

		/* On wide screens push Add to the bottom so all three columns bottom-align. */
		.booth-col {
			justify-content: flex-start;
		}

		.add-button {
			margin-top: auto;
		}

		.form-title {
			font-size: 1rem;
		}
	}
</style>
