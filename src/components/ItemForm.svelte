<script>
	import { fly, fade } from 'svelte/transition';
	import Swal from 'sweetalert2';

	let { onAdd } = $props();

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
			// Preserve scroll position before showing alert
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
			
			// Restore scroll position after alert
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

<div class="form-card">
	<div class="form-header">
		<h3 class="form-title">Add New Item</h3>
		<p class="form-subtitle">Enter item details to add to your inventory</p>
	</div>
	
	<div class="form-content">
		<div class="form-row primary-row">
			<div class="form-group">
				<label for="name" class="form-label">Item Name</label>
				<div class="input-wrapper">
					<input
						id="name"
						class="form-input {errors.name ? 'error' : ''}"
						bind:value={formData.name}
						placeholder="Enter item name"
						oninput={() => validateField('name', formData.name)}
					/>
					{#if errors.name}
						<div class="error-message" in:fly={{ y: -10, duration: 200 }} out:fade={{ duration: 100 }}>
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
				<label class="form-label">Booths</label>
				<div class="input-wrapper">
					<div class="booths-container">
						{#each [
							{ value: 'freshly', label: 'Freshly', color: '#10B981' },
							{ value: 'b1', label: 'B1', color: '#3B82F6' },
							{ value: 'b2', label: 'B2', color: '#8B5CF6' },
							{ value: 'jakes', label: 'Jakes', color: '#F59E0B' },
							{ value: 'epic', label: 'Epic', color: '#EF4444' },
							{ value: 'pulled', label: 'Pulled', color: '#6B7280' }
						] as booth}
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
										<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
											<polyline points="20,6 9,17 4,12"></polyline>
										</svg>
									</div>
								</div>
							</label>
						{/each}
					</div>
					{#if errors.booths}
						<div class="error-message" in:fly={{ y: -10, duration: 200 }} out:fade={{ duration: 100 }}>
							{errors.booths}
						</div>
					{/if}
				</div>
			</div>
		</div>

		<div class="form-row secondary-row">
			<div class="form-group">
				<label for="count" class="form-label">Current Stock</label>
				<div class="input-wrapper">
					<input
						id="count"
						class="form-input {errors.count ? 'error' : ''}"
						type="text"
						bind:value={formData.count}
						pattern="^[0-9]*$"
						placeholder="0"
						oninput={(event) => handleInput(event, 'count')}
					/>
					{#if errors.count}
						<div class="error-message" in:fly={{ y: -10, duration: 200 }} out:fade={{ duration: 100 }}>
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
						class="form-input {errors.lowCount ? 'error' : ''}"
						type="text"
						bind:value={formData.lowCount}
						pattern="^[0-9]*$"
						placeholder="0"
						oninput={(event) => handleInput(event, 'lowCount')}
					/>
					{#if errors.lowCount}
						<div class="error-message" in:fly={{ y: -10, duration: 200 }} out:fade={{ duration: 100 }}>
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
						class="form-input {errors.cost ? 'error' : ''}"
						type="text"
						bind:value={formData.cost}
						placeholder="0.00"
						oninput={(event) => handleInput(event, 'cost', true)}
					/>
					{#if errors.cost}
						<div class="error-message" in:fly={{ y: -10, duration: 200 }} out:fade={{ duration: 100 }}>
							{errors.cost}
						</div>
					{/if}
				</div>
			</div>
		</div>

		<div class="form-actions">
			<button class="add-button" onclick={handleAdd}>
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<line x1="12" y1="5" x2="12" y2="19"></line>
					<line x1="5" y1="12" x2="19" y2="12"></line>
				</svg>
				Add Item
			</button>
		</div>
	</div>
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
		background: var(--table-header-bg);
		padding: 1.5rem 2rem;
		border-bottom: 1px solid var(--table-border-color);
	}

	.form-title {
		margin: 0 0 0.25rem 0;
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--text-color);
		letter-spacing: -0.025em;
	}

	.form-subtitle {
		margin: 0;
		font-size: 0.875rem;
		color: var(--text-color-dimmed);
		font-weight: 400;
	}

	.form-content {
		padding: 2rem;
	}

	.form-row {
		display: grid;
		gap: 1.5rem;
		margin-bottom: 1.5rem;
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
		padding: 0.875rem 1rem;
		border: 2px solid var(--input-border-color);
		border-radius: var(--border-radius);
		background-color: var(--input-bg);
		color: var(--input-text);
		font-size: 0.95rem;
		font-weight: 500;
		transition: all 0.2s ease;
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
		margin-top: 2rem;
		display: flex;
		justify-content: center;
	}

	.add-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		padding: 1rem 2.5rem;
		background: var(--add-item-color);
		color: black;
		border: none;
		border-radius: var(--border-radius);
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		box-shadow:
			0 4px 15px rgba(0, 0, 0, 0.12),
			0 2px 6px rgba(0, 0, 0, 0.08);
		letter-spacing: 0.025em;
		text-transform: uppercase;
		position: relative;
		overflow: hidden;
		user-select: none;
		-webkit-tap-highlight-color: transparent;
	}

	.add-button::before {
		content: '';
		position: absolute;
		top: 0;
		left: -100%;
		width: 100%;
		height: 100%;
		background: linear-gradient(
			90deg,
			transparent,
			rgba(255, 255, 255, 0.3),
			transparent
		);
		transition: left 0.5s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.add-button:hover {
		transform: translateY(-2px);
		box-shadow:
			0 8px 25px rgba(0, 0, 0, 0.15),
			0 4px 12px rgba(0, 0, 0, 0.1);
		filter: brightness(1.25);
	}

	.add-button:hover::before {
		left: 100%;
	}

	.add-button:active {
		transform: translateY(0);
		transition-duration: 0.1s;
		box-shadow:
			0 2px 8px rgba(0, 0, 0, 0.15),
			0 1px 4px rgba(0, 0, 0, 0.1);
	}

	.add-button:focus-visible {
		outline: 2px solid var(--add-item-color);
		outline-offset: 3px;
	}

	.add-button:active {
		transform: translateY(0);
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
	}

	.add-button svg {
		width: 18px;
		height: 18px;
	}

	/* Responsive Design */
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
			padding: 2rem 2.5rem;
		}
		
		.form-content {
			padding: 2.5rem;
		}
		
		.form-title {
			font-size: 1.375rem;
		}
	}

	@media (min-width: 1024px) {
		.form-row {
			gap: 2rem;
		}
		
		.form-input {
			padding: 1rem 1.25rem;
			font-size: 1rem;
		}
		
		.add-button {
			padding: 1rem 2.5rem;
			font-size: 1rem;
		}
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

	/* Mobile responsiveness */
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
		transition: all 0.2s ease;
		min-height: 50px;
		overflow: hidden;
		width: 100%;
		box-sizing: border-box;
	}

	/* Mobile adjustments */
	@media (max-width: 640px) {
		.booth-card {
			padding: 0.5rem;
			min-height: 45px;
		}
	}

	.booth-card:hover {
		border-color: var(--input-hover-border-color);
		background: var(--input-hover-bg);
		transform: translateY(-2px);
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
		transition: all 0.2s ease;
	}

	.booth-name {
		flex: 1;
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--text-color);
		margin-left: 0.75rem;
	}

	.checkmark {
		opacity: 0;
		color: var(--booth-color);
		transition: all 0.2s ease;
		transform: scale(0.8);
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

	/* Dark mode improvements */
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
</style>
