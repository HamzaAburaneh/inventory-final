<script>
	import { fly, fade } from 'svelte/transition';
	import Swal from 'sweetalert2';

	let { onAdd } = $props();

	let formData = $state({
		name: '',
		barcode: '',
		count: '',
		lowCount: '',
		cost: '',
		storageType: ''
	});

	let errors = $state({});

	const validateField = (field, value) => {
		const validations = {
			name: () => (value.trim().length < 3 ? 'Name must be at least 3 characters' : ''),
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
			await Swal.fire({
				icon: 'error',
				title: 'Empty Item Name',
				text: 'Item name cannot be empty.',
				background: 'var(--container-bg)',
				color: 'var(--text-color)'
			});
			return;
		}

		onAdd({ formData });
		formData = { name: '', barcode: '', count: '', lowCount: '', cost: '', storageType: '' };
		errors = {};
	};
</script>

<div class="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-4 mb-4">
	<!-- Name Field -->
	<div class="form-group col-span-1 sm:col-span-1 lg:col-span-1">
		<label for="name" class="form-label"><span>Name</span></label>
		<div class="input-wrapper">
			<input
				id="name"
				class="form-control-input {errors.name ? 'is-invalid' : ''}"
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

	<!-- Barcode Field -->
	<div class="form-group col-span-1 sm:col-span-1 lg:col-span-1">
		<label for="barcode" class="form-label"><span>Barcode</span></label>
		<div class="input-wrapper">
			<input
				id="barcode"
				class="form-control-input {errors.barcode ? 'is-invalid' : ''}"
				bind:value={formData.barcode}
				placeholder="Enter barcode"
			/>
		</div>
	</div>

	<!-- Count Field -->
	<div class="form-group col-span-1">
		<label for="count" class="form-label"><span>Count</span></label>
		<div class="input-wrapper">
			<input
				id="count"
				class="form-control-input {errors.count ? 'is-invalid' : ''}"
				type="text"
				bind:value={formData.count}
				pattern="^[0-9]*$"
				placeholder="Enter count"
				oninput={(event) => handleInput(event, 'count')}
			/>
			{#if errors.count}
				<div class="error-message" in:fly={{ y: -10, duration: 200 }} out:fade={{ duration: 100 }}>
					{errors.count}
				</div>
			{/if}
		</div>
	</div>

	<!-- Low Count Field -->
	<div class="form-group col-span-1">
		<label for="lowCount" class="form-label"><span>Low Item</span></label>
		<div class="input-wrapper">
			<input
				id="lowCount"
				class="form-control-input {errors.lowCount ? 'is-invalid' : ''}"
				type="text"
				bind:value={formData.lowCount}
				pattern="^[0-9]*$"
				placeholder="Enter low stock"
				oninput={(event) => handleInput(event, 'lowCount')}
			/>
			{#if errors.lowCount}
				<div class="error-message" in:fly={{ y: -10, duration: 200 }} out:fade={{ duration: 100 }}>
					{errors.lowCount}
				</div>
			{/if}
		</div>
	</div>

	<!-- Cost Field -->
	<div class="form-group col-span-1">
		<label for="cost" class="form-label"><span>Cost</span></label>
		<div class="input-wrapper">
			<input
				id="cost"
				class="form-control-input {errors.cost ? 'is-invalid' : ''}"
				type="text"
				bind:value={formData.cost}
				placeholder="Enter cost"
				oninput={(event) => handleInput(event, 'cost', true)}
			/>
			{#if errors.cost}
				<div class="error-message" in:fly={{ y: -10, duration: 200 }} out:fade={{ duration: 100 }}>
					{errors.cost}
				</div>
			{/if}
		</div>
	</div>

	<!-- Storage Type Field -->
	<div class="form-group col-span-1">
		<label for="storageType" class="form-label"><span>Storage</span></label>
		<div class="input-wrapper">
			<select
				id="storageType"
				class="form-control-input {errors.storageType ? 'is-invalid' : ''}"
				bind:value={formData.storageType}
				class:placeholder-selected={!formData.storageType}
			>
				<option value="" disabled>Select type...</option>
				<option value="Freezer">Freezer</option>
				<option value="Refrigerator">Refrigerator</option>
				<option value="Dry Storage">Dry Storage</option>
			</select>
		</div>
	</div>

	<!-- Add Item Button -->
	<div class="form-group col-span-2 sm:col-span-2 lg:col-span-3">
		<button class="btn btn-primary w-full" id="add-item" onclick={handleAdd}>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				fill="currentColor"
				class="bi bi-plus"
				viewBox="0 0 16 16"
			>
				<path d="M8 7V1a1 1 0 0 1 2 0v6h6a1 1 0 0 1 0 2H10v6a1 1 0 0 1-2 0V9H2a1 1 0 0 1 0-2h6z" />
			</svg>Add Item</button
		>
	</div>
</div>

<style>
	.form-group {
		position: relative;
		display: flex;
		flex-direction: column;
		margin-bottom: 0;
	}

	.placeholder-selected {
		color: var(--placeholder-text) !important;
	}

	.form-label {
		margin-bottom: 0.5rem;
		font-weight: 600;
		color: var(--text-color);
		font-size: 0.875rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.form-label span {
		cursor: pointer;
	}

	.input-wrapper {
		position: relative;
		width: 100%;
	}

	.form-control-input {
		width: 100%;
		padding: 0.75rem;
		border: 2px solid var(--input-border-color);
		border-radius: var(--border-radius);
		background-color: var(--input-bg);
		color: var(--input-text);
		font-size: 1rem;
		transition:
			border-color 0.3s ease,
			box-shadow 0.3s ease,
			transform 0.2s ease;
	}

	.is-invalid {
		border-color: #ff0019 !important;
	}

	.form-control-input::placeholder {
		color: var(--placeholder-text);
	}

	.input-wrapper:hover .form-control-input:not(:focus) {
		border-color: var(--input-hover-border-color);
		box-shadow: 0 0 0 1px var(--input-hover-border-color);
		transform: scale(1.02);
	}

	.form-control-input:focus {
		transform: scale(1.02);
		outline: none;
		border-color: var(--focus-border-color);
		box-shadow: 0 0 0 1px var(--focus-border-color);
	}

	.form-control-input.is-invalid:focus,
	.form-control-input.is-invalid:hover {
		border-color: #ff0019 !important;
		box-shadow: 0 0 0 1px #ff0019 !important;
	}

	.error-message {
		border: 1px solid #ff0019;
		padding: 0.75rem;
		position: absolute;
		top: 100%;
		left: 0;
		margin-top: 0.25rem;
		padding: 0.5rem;
		color: #fff;
		background-color: #ff0019;
		border-radius: var(--border-radius);
		font-size: 0.875rem;
		width: 100%;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	}

	#add-item {
		background-color: var(--add-item-color);
		color: var(--background-color);
		font-weight: 700;
		border-radius: var(--border-radius);
		padding: 0.5rem 1rem;
		border: none;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
		cursor: pointer;
		text-align: center;
		font-size: 0.875rem;
		max-width: 100%; /* Full width on smaller screens */
		margin: 2rem auto 0 auto;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		text-transform: uppercase;
		transition:
			all 0.3s ease,
			transform 0.2s ease;
	}

	#add-item svg {
		fill: currentColor;
	}

	#add-item:hover {
		transform: translateY(-4px) scale(1.05);
		box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
		background-color: var(--icon-hover-color);
	}

	#add-item:active {
		transform: translateY(0);
	}

	@media (min-width: 640px) {
		#add-item {
			max-width: 50%; /* Adjust as needed for sm screens */
		}
	}

	@media (min-width: 1024px) {
		#add-item {
			max-width: 25%; /* Original width for larger screens */
		}
	}
</style>
