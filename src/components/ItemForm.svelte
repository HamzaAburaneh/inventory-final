<script>
	import { fade, fly, slide } from 'svelte/transition';
	import { prefersReducedMotion } from 'svelte/motion';
	import Swal from 'sweetalert2';

	let { onAdd, collapsed = $bindable(true) } = $props();

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
			<p class="form-subtitle">Enter item details to add to your inventory</p>
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
			<div class="form-row primary-row">
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
						{#if errors.name}
							<div
								class="error-message"
								in:fly={{ y: -8, duration: 200 }}
								out:fade={{ duration: 100 }}
							>
								{errors.name}
							</div>
						{/if}
					</div>
				</div>

				<div class="form-group">
					<label for="storageType" class="form-label">Storage Type</label>
					<div class="input-wrapper">
						<select
							id="storageType"
							class="form-input {errors.storageType ? 'error' : ''}"
							bind:value={formData.storageType}
							class:placeholder-selected={!formData.storageType}
						>
							<option value="" disabled>Select storage type...</option>
							<option value="Freezer">Freezer</option>
							<option value="Refrigerator">Refrigerator</option>
							<option value="Dry Storage">Dry Storage</option>
						</select>
					</div>
				</div>

				<div class="form-group booths-group">
					<span class="form-label">Booths</span>
					<div class="input-wrapper">
						<div class="booths-container">
							{#each [{ value: 'freshly', label: 'Freshly', color: '#10B981' }, { value: 'b1', label: 'B1', color: '#3B82F6' }, { value: 'b2', label: 'B2', color: '#8B5CF6' }, { value: 'jakes', label: 'Jakes', color: '#F59E0B' }, { value: 'epic', label: 'Epic', color: '#EF4444' }, { value: 'pulled', label: 'Pulled', color: '#6B7280' }] as booth (booth.value)}
								<label class="booth-option">
									<input
										type="checkbox"
										value={booth.value}
										bind:group={formData.booths}
										class="booth-checkbox"
									/>
									<div class="booth-card" style="--booth-color: {booth.color}">
										<div class="booth-indicator"></div>
										<span class="booth-name">{booth.label}</span>
										<div class="checkmark">
											<svg
												width="16"
												height="16"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="3"
											>
												<polyline points="20,6 9,17 4,12"></polyline>
											</svg>
										</div>
									</div>
								</label>
							{/each}
						</div>
					</div>
				</div>
			</div>

			<div class="form-row secondary-row">
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
						{#if errors.count}
							<div
								class="error-message"
								in:fly={{ y: -8, duration: 200 }}
								out:fade={{ duration: 100 }}
							>
								{errors.count}
							</div>
						{/if}
					</div>
				</div>

				<div class="form-group">
					<label for="lowCount" class="form-label">Low Stock Alert</label>
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
						{#if errors.lowCount}
							<div
								class="error-message"
								in:fly={{ y: -8, duration: 200 }}
								out:fade={{ duration: 100 }}
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
						{#if errors.cost}
							<div
								class="error-message"
								in:fly={{ y: -8, duration: 200 }}
								out:fade={{ duration: 100 }}
							>
								{errors.cost}
							</div>
						{/if}
					</div>
				</div>
			</div>

			<div class="form-actions">
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
		overflow: hidden;
	}

	.form-header {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		text-align: left;
		background: var(--table-header-bg);
		padding: 0.6rem 1.25rem;
		border: none;
		border-bottom: 1px solid var(--table-border-color);
		cursor: pointer;
		min-height: 0;
		color: var(--text-color);
		transition: background-color 0.15s ease-out;
		-webkit-tap-highlight-color: transparent;
	}

	.form-card.collapsed .form-header {
		border-bottom: none;
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
		outline: 2px solid var(--focus-border-color);
		outline-offset: -2px;
	}

	.form-header-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 1.75rem;
		height: 1.75rem;
		border-radius: var(--border-radius);
		background: var(--add-item-color);
		color: var(--add-item-on);
	}

	.form-header-icon svg {
		width: 1rem;
		height: 1rem;
	}

	.form-header-text {
		flex: 1;
		min-width: 0;
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
		font-size: 1.05rem;
		font-weight: 700;
		color: var(--text-color);
		letter-spacing: -0.025em;
	}

	.form-subtitle {
		margin: 0.1rem 0 0 0;
		font-size: 0.8rem;
		color: var(--text-color-dimmed);
		font-weight: 400;
	}

	.form-content {
		padding: 1.5rem 2rem;
	}

	.form-row {
		display: grid;
		gap: 1.25rem;
		margin-bottom: 1.25rem;
	}

	.primary-row {
		grid-template-columns: 1fr;
	}

	.secondary-row {
		grid-template-columns: 1fr;
	}

	.form-group {
		position: relative;
	}

	.form-label {
		display: block;
		margin-bottom: 0.5rem;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text-color);
		letter-spacing: 0.025em;
	}

	.input-wrapper {
		position: relative;
	}

	.form-input {
		width: 100%;
		padding: 0.75rem 1rem;
		border: 2px solid var(--input-border-color);
		border-radius: var(--border-radius);
		background-color: var(--input-bg);
		color: var(--input-text);
		font-size: 0.9rem;
		font-weight: 500;
	}

	.form-input::placeholder {
		color: var(--placeholder-text);
		font-weight: 400;
	}

	.form-input:focus {
		outline: none;
		border-color: var(--focus-border-color);
		box-shadow: 0 0 0 2px rgba(74, 144, 226, 0.2);
	}

	.form-input:hover:not(:focus) {
		border-color: var(--input-hover-border-color);
		background-color: var(--input-hover-bg);
	}

	.form-input.error {
		border-color: #dc3545;
		box-shadow: 0 0 0 2px rgba(220, 53, 69, 0.2);
	}

	.placeholder-selected {
		color: var(--placeholder-text) !important;
	}

	.error-message {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		margin-top: 0.5rem;
		padding: 0.75rem 1rem;
		background: #dc3545;
		color: white;
		border-radius: var(--border-radius);
		font-size: 0.8rem;
		font-weight: 500;
		box-shadow: 0 4px 6px -1px rgba(220, 53, 69, 0.3);
		z-index: 10;
	}

	.form-actions {
		margin-top: 1.5rem;
		display: flex;
		justify-content: center;
	}

	.add-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		padding: 0.875rem 2.5rem;
		background: var(--add-item-color);
		color: var(--add-item-on);
		border: none;
		border-radius: var(--border-radius);
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		box-shadow: 0 4px 15px rgba(0, 0, 0, 0.12);
		letter-spacing: 0.025em;
		text-transform: uppercase;
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
		width: 18px;
		height: 18px;
	}

	.booths-group {
		grid-column: 1 / -1;
	}

	.booths-container {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		gap: 0.75rem;
		margin-top: 0.75rem;
	}

	@media (max-width: 640px) {
		.booths-container {
			grid-template-columns: repeat(2, 1fr);
			gap: 0.5rem;
		}
	}

	@media (max-width: 480px) {
		.booths-container {
			grid-template-columns: 1fr;
			gap: 0.5rem;
		}
	}

	.booth-option {
		position: relative;
		cursor: pointer;
	}

	.booth-checkbox {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}

	.booth-card {
		position: relative;
		display: flex;
		align-items: center;
		padding: 0.75rem;
		background: var(--input-bg);
		border: 2px solid var(--input-border-color);
		border-radius: var(--border-radius);
		transition: all 0.15s ease-out;
		min-height: 50px;
		overflow: hidden;
		width: 100%;
		box-sizing: border-box;
	}

	@media (max-width: 640px) {
		.booth-card {
			padding: 0.5rem;
			min-height: 45px;
		}
	}

	.booth-card:hover {
		border-color: var(--input-hover-border-color);
		background: var(--input-hover-bg);
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
	}

	.booth-indicator {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 4px;
		background: var(--booth-color);
		opacity: 0.7;
		transition: all 0.15s ease-out;
	}

	.booth-name {
		flex: 1;
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--text-color);
		margin-left: 0.5rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
	}

	@media (max-width: 640px) {
		.booth-name {
			font-size: 0.8rem;
			margin-left: 0.4rem;
		}
	}

	.checkmark {
		opacity: 0;
		color: var(--booth-color);
		transition: all 0.15s ease-out;
		transform: scale(0.8);
		flex-shrink: 0;
		margin-left: 0.25rem;
	}

	.checkmark svg {
		width: 14px;
		height: 14px;
	}

	@media (max-width: 640px) {
		.checkmark svg {
			width: 12px;
			height: 12px;
		}
	}

	.booth-checkbox:checked + .booth-card {
		border-color: var(--booth-color);
		background: color-mix(in srgb, var(--booth-color) 10%, var(--input-bg));
	}

	.booth-checkbox:checked + .booth-card .booth-indicator {
		opacity: 1;
		width: 6px;
	}

	.booth-checkbox:checked + .booth-card .checkmark {
		opacity: 1;
		transform: scale(1);
	}

	.booth-checkbox:checked + .booth-card .booth-name {
		color: var(--booth-color);
	}

	@media (prefers-color-scheme: dark) {
		.booth-card {
			background: var(--container-bg);
			border-color: var(--table-border-color);
		}

		.booth-card:hover {
			background: var(--hover-bg-color);
			border-color: var(--input-hover-border-color);
		}

		.booth-checkbox:checked + .booth-card {
			background: color-mix(in srgb, var(--booth-color) 15%, var(--container-bg));
			border-color: var(--booth-color);
		}
	}

	@media (min-width: 640px) {
		.primary-row {
			grid-template-columns: 1fr 1fr;
		}

		.secondary-row {
			grid-template-columns: repeat(3, 1fr);
		}
	}

	@media (min-width: 768px) {
		.form-header {
			padding: 0.7rem 2rem;
		}

		.form-content {
			padding: 1.5rem 2rem;
		}

		.form-title {
			font-size: 1.1rem;
		}
	}
</style>
