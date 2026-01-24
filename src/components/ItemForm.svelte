<script>
	import { slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { notificationStore } from '../stores/notificationStore';
	import ConfirmModal from './ConfirmModal.svelte';

	let { onAdd } = $props();
	let isCollapsed = $state(true);
	let showValidationModal = $state(false);

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
			// Remove all non-digits
			let digits = value.replace(/\D/g, '');
			if (digits === '') {
				value = '';
			} else {
				// Convert to number and format as currency
				let amount = parseInt(digits, 10) / 100;
				value = amount.toLocaleString('en-CA', {
					minimumFractionDigits: 2,
					maximumFractionDigits: 2
				});
			}
		} else {
			value = value.replace(/\D/g, '');
		}
		formData[field] = value;
		validateField(field, value);
	};

	const handleAdd = async () => {
		if (formData.name.trim() === '' || !formData.storageType) {
			showValidationModal = true;
			return;
		}

		onAdd({ formData });
		formData = { name: '', count: '', lowCount: '', cost: '', storageType: '', booths: [] };
		errors = {};
	};
</script>

<div class="tech-form-frame" class:is-collapsed={isCollapsed}>
	<button 
		type="button" 
		class="form-toggle-header" 
		onclick={() => (isCollapsed = !isCollapsed)}
		aria-expanded={!isCollapsed}
	>
		<div class="header-main">
			<i class="fas fa-plus-square toggle-icon"></i>
			<h3 class="form-title">Add New Item</h3>
			<div class="form-separator"></div>
		</div>
		<div class="header-action">
			<span class="action-hint">{isCollapsed ? 'EXPAND FORM' : 'COLLAPSE'}</span>
			<i class="fas fa-chevron-down chevron" class:rotated={!isCollapsed}></i>
		</div>
	</button>

	{#if !isCollapsed}
		<div transition:slide={{ duration: 400, easing: cubicOut }}>
			<div class="form-content-inner">
				<div class="form-grid">
					<div class="input-group name-group">
						<label for="name" class="tech-label">Item Name</label>
						<div class="tech-input-wrapper">
							<input
								id="name"
								class="tech-input"
								bind:value={formData.name}
								placeholder="Enter item name..."
							/>
						</div>
					</div>

					<div class="input-group storage-group">
						<label class="tech-label">Storage Type</label>
						<div class="storage-type-grid">
							{#each ['Freezer', 'Refrigerator', 'Dry Storage'] as type}
								<label class="storage-node">
									<input
										type="radio"
										name="storageType"
										value={type}
										bind:group={formData.storageType}
										class="hidden-radio"
									/>
									<div class="node-card">
										<div class="node-indicator" style="--type-color: {type === 'Freezer' ? '#3B82F6' : type === 'Refrigerator' ? '#10B981' : '#F59E0B'}"></div>
										<span class="node-label">{type}</span>
										<i class="fas fa-check node-check"></i>
									</div>
								</label>
							{/each}
						</div>
					</div>

					<div class="input-group count-group">
						<label for="count" class="tech-label">Current Count</label>
						<div class="tech-input-wrapper">
							<input
								id="count"
								class="tech-input"
								type="text"
								bind:value={formData.count}
								placeholder="0"
								oninput={(event) => handleInput(event, 'count')}
							/>
						</div>
					</div>

					<div class="input-group full-width">
						<label class="tech-label">Booths</label>
						<div class="booth-selection-grid">
							{#each [{ value: 'freshly', label: 'Freshly', color: '#10B981' }, { value: 'b1', label: 'B1', color: '#3B82F6' }, { value: 'b2', label: 'B2', color: '#8B5CF6' }, { value: 'jakes', label: 'Jakes', color: '#F59E0B' }, { value: 'epic', label: 'Epic', color: '#EF4444' }, { value: 'pulled', label: 'Pulled', color: '#6B7280' }] as booth}
								<label class="booth-node">
									<input
										type="checkbox"
										value={booth.value}
										bind:group={formData.booths}
										class="hidden-check"
									/>
									<div class="node-card" style="--node-color: {booth.color}">
										<div class="node-indicator"></div>
										<span class="node-label">{booth.label}</span>
										<i class="fas fa-check node-check"></i>
									</div>
								</label>
							{/each}
						</div>
					</div>

					<div class="input-group alert-group">
						<label for="lowCount" class="tech-label">Low Count Alert</label>
						<div class="tech-input-wrapper">
							<input
								id="lowCount"
								class="tech-input"
								type="text"
								bind:value={formData.lowCount}
								placeholder="0"
								oninput={(event) => handleInput(event, 'lowCount')}
							/>
						</div>
					</div>

					<div class="input-group cost-group">
						<label for="cost" class="tech-label">Unit Cost ($)</label>
						<div class="tech-input-wrapper">
							<input
								id="cost"
								class="tech-input"
								type="text"
								bind:value={formData.cost}
								placeholder="0.00"
								oninput={(event) => handleInput(event, 'cost', true)}
								style="text-align: right; padding-right: 1.5rem;"
							/>
						</div>
					</div>
				</div>

				<div class="form-footer centered">
					<button class="tech-add-btn primary-action" onclick={handleAdd}>
						<i class="fas fa-plus-circle"></i>
						<span>Add New Item</span>
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>

<ConfirmModal
	bind:show={showValidationModal}
	title="Required Fields"
	message={`<div style="display: flex; flex-direction: column; gap: 1.5rem; padding: 0.5rem 0;">
		<div style="display: flex; flex-direction: column; gap: 1rem;">
			${formData.name.trim() === '' ? `
				<div style="display: flex; align-items: flex-start; gap: 1rem; background: rgba(239, 68, 68, 0.08); border-left: 3px solid #ef4444; padding: 1rem; border-radius: 0 8px 8px 0;">
					<div style="color: #ef4444; margin-top: 0.1rem;"><i class="fas fa-tag"></i></div>
					<div style="display: flex; flex-direction: column; gap: 0.25rem;">
						<span style="color: #ef4444; font-weight: 800; font-size: 0.7rem; letter-spacing: 0.1em; text-transform: uppercase;">Item Name</span>
						<span style="color: var(--tech-label); font-size: 0.85rem;">This field is required to identify the item.</span>
					</div>
				</div>
			` : ''}
			${!formData.storageType ? `
				<div style="display: flex; align-items: flex-start; gap: 1rem; background: rgba(239, 68, 68, 0.08); border-left: 3px solid #ef4444; padding: 1rem; border-radius: 0 8px 8px 0;">
					<div style="color: #ef4444; margin-top: 0.1rem;"><i class="fas fa-warehouse"></i></div>
					<div style="display: flex; flex-direction: column; gap: 0.25rem;">
						<span style="color: #ef4444; font-weight: 800; font-size: 0.7rem; letter-spacing: 0.1em; text-transform: uppercase;">Storage Type</span>
						<span style="color: var(--tech-label); font-size: 0.85rem;">Please select where this item will be stored.</span>
					</div>
				</div>
			` : ''}
		</div>
		<p style="margin: 0; color: var(--tech-label); font-size: 0.75rem; font-style: italic; text-align: center;">All highlighted fields must be completed before proceeding.</p>
	</div>`}
	type="warning"
	confirmText="Understood"
	cancelText=""
	onConfirm={() => showValidationModal = false}
/>

<style>
	.tech-form-frame {
		background: var(--tech-glass-bg);
		border: 1px solid var(--tech-glass-border);
		border-radius: 12px;
		padding: 0;
		overflow: hidden;
		box-shadow: var(--tech-glass-shadow);
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.tech-form-frame.is-collapsed {
		border-color: var(--tech-glass-border);
		opacity: 0.9;
	}

	.tech-form-frame.is-collapsed:hover {
		opacity: 1;
		border-color: var(--tech-accent-muted);
	}

	.form-toggle-header {
		width: 100%;
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.25rem 2rem;
		background: transparent;
		border: none;
		cursor: pointer;
		outline: none;
		transition: background-color 0.2s;
	}

	.form-toggle-header:hover {
		background: rgba(255, 255, 255, 0.02);
	}

	.header-main {
		display: flex;
		align-items: center;
		gap: 1.25rem;
	}

	.toggle-icon {
		color: var(--tech-accent);
		font-size: 1.2rem;
		opacity: 0.8;
	}

	.form-title {
		margin: 0;
		font-size: 1rem;
		font-weight: 800;
		color: var(--tech-title);
		text-transform: uppercase;
		letter-spacing: 0.15em;
	}

	.form-separator {
		height: 2px;
		width: 30px;
		background: var(--tech-accent);
		box-shadow: 0 0 10px var(--tech-accent-muted);
		opacity: 0.5;
	}

	.header-action {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.action-hint {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.65rem;
		font-weight: 800;
		color: var(--tech-label);
		letter-spacing: 0.1em;
		opacity: 0.6;
	}

	.chevron {
		color: var(--tech-label);
		font-size: 0.9rem;
		transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
		opacity: 0.5;
	}

	.chevron.rotated {
		transform: rotate(-180deg);
	}

	.form-content-inner {
		padding: 0 2rem 2rem 2rem;
	}

	.form-grid {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: 1.25rem;
		margin-bottom: 2rem;
	}

	.name-group { grid-column: span 6; }
	.storage-group { grid-column: span 6; }
	.count-group { grid-column: span 2; }
	.alert-group { grid-column: span 2; }
	.cost-group { grid-column: span 2; }
	.booths-group { grid-column: span 6; }

	.full-width {
		grid-column: 1 / -1;
	}

	.input-group {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.tech-label {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.65rem;
		font-weight: 800;
		color: var(--tech-label);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.tech-input-wrapper {
		position: relative;
	}

	.tech-input {
		width: 100%;
		background: var(--tech-badge-bg);
		border: 1px solid var(--tech-glass-border);
		border-radius: 4px;
		padding: 0.75rem 1rem;
		color: var(--tech-value);
		font-family: 'Inter', sans-serif;
		font-size: 0.9rem;
		font-weight: 500;
		transition: all 0.2s;
	}

	.tech-input:focus {
		outline: none;
		border-color: var(--tech-accent);
		background: var(--tech-header-bg);
		box-shadow: 0 0 10px var(--tech-accent-muted);
	}

	.storage-type-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.75rem;
	}

	.storage-node {
		cursor: pointer;
	}

	.hidden-radio {
		position: absolute;
		opacity: 0;
	}

	.storage-node .node-card {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.6rem 0.8rem;
		background: var(--tech-badge-bg);
		border: 1px solid var(--tech-glass-border);
		border-radius: 4px;
		transition: all 0.2s;
	}

	.storage-node .node-indicator {
		width: 3px;
		height: 14px;
		background: var(--type-color);
		border-radius: 2px;
	}

	.storage-node .node-label {
		font-size: 0.7rem;
		font-weight: 800;
		color: var(--tech-label);
		text-transform: uppercase;
		margin-left: 0.5rem;
		flex: 1;
	}

	.storage-node .node-check {
		font-size: 0.7rem;
		color: var(--tech-accent);
		opacity: 0;
		transition: all 0.2s;
	}

	.hidden-radio:checked + .node-card {
		border-color: var(--tech-accent);
		background: var(--tech-accent-muted);
	}

	.hidden-radio:checked + .node-card .node-label {
		color: var(--tech-value);
	}

	.hidden-radio:checked + .node-card .node-check {
		opacity: 1;
	}

	.tech-input.error {
		border-color: #ef4444;
		box-shadow: 0 0 10px rgba(239, 68, 68, 0.2);
	}

	.tech-input::placeholder {
		color: var(--tech-label);
		opacity: 0.4;
	}

	.tech-error-message {
		position: absolute;
		top: calc(100% + 5px);
		left: 0;
		color: #ef4444;
		font-size: 0.65rem;
		font-weight: 700;
		display: flex;
		align-items: center;
		gap: 0.4rem;
		z-index: 5;
	}

	.booth-selection-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
		gap: 0.75rem;
	}

	.booth-node {
		cursor: pointer;
	}

	.hidden-check {
		position: absolute;
		opacity: 0;
	}

	.node-card {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.6rem 0.8rem;
		background: var(--tech-badge-bg);
		border: 1px solid var(--tech-glass-border);
		border-radius: 4px;
		transition: all 0.2s;
	}

	.node-indicator {
		width: 3px;
		height: 14px;
		background: var(--node-color);
		border-radius: 2px;
	}

	.node-label {
		font-size: 0.7rem;
		font-weight: 800;
		color: var(--tech-label);
		text-transform: uppercase;
		margin-left: -0.5rem;
	}

	.node-check {
		font-size: 0.7rem;
		color: var(--node-color);
		opacity: 0;
		transition: all 0.2s;
	}

	.hidden-check:checked + .node-card {
		border-color: var(--node-color);
		background: rgba(255, 255, 255, 0.05);
	}

	.hidden-check:checked + .node-card .node-label {
		color: var(--tech-value);
	}

	.hidden-check:checked + .node-card .node-check {
		opacity: 1;
	}

	.form-footer {
		display: flex;
		justify-content: center;
		padding-top: 1rem;
		border-top: 1px solid var(--tech-glass-border);
		margin-top: 1rem;
	}

	.tech-add-btn.primary-action {
		padding: 1.25rem 5rem;
		min-width: 350px;
		font-size: 1rem;
		border-radius: 8px;
		background: var(--tech-accent-muted);
		color: var(--tech-accent);
		border-color: var(--tech-accent-muted);
	}

	.tech-add-btn.primary-action i {
		font-size: 1.2rem;
	}

	.tech-add-btn {
		background: var(--tech-accent-muted);
		color: var(--tech-accent);
		border: 1px solid var(--tech-accent-muted);
		padding: 0.85rem 2.5rem;
		border-radius: 4px;
		font-family: 'JetBrains Mono', monospace;
		font-weight: 800;
		font-size: 0.75rem;
		letter-spacing: 0.15em;
		text-transform: uppercase;
		display: flex;
		align-items: center;
		gap: 1rem;
		transition: all 0.3s;
		cursor: pointer;
	}

	.tech-add-btn:hover {
		background: var(--tech-accent);
		color: var(--tech-bg-start);
		box-shadow: 0 0 20px var(--tech-accent-muted);
		transform: translateY(-2px);
		outline: none;
	}

	.tech-add-btn:focus {
		outline: none;
		box-shadow: 0 0 20px var(--tech-accent-muted);
	}

	.tech-add-btn:active {
		outline: none;
		transform: translateY(0);
	}

	.tech-add-btn i {
		font-size: 1rem;
	}

	@media (max-width: 768px) {
		.form-grid { grid-template-columns: 1fr; }
		.booth-selection-grid { grid-template-columns: repeat(2, 1fr); }
	}
</style>
