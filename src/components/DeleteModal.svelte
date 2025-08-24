<script>
	import { fade, fly } from 'svelte/transition';

	let {
		visible = false,
		itemName = '',
		position = { x: 0, y: 0 },
		onConfirm,
		onCancel
	} = $props();
</script>

{#if visible}
	<div class="modal-backdrop" onclick={onCancel} in:fade={{ duration: 200 }} out:fade={{ duration: 200 }}></div>
	<div
		class="modal-overlay"
		style="left: 50%; top: {position.y}px;"
		in:fade={{ duration: 200 }}
		out:fade={{ duration: 200 }}
	>
		<div class="delete-modal" onclick={(e) => e.stopPropagation()} in:fly={{ y: 50, duration: 300 }} out:fly={{ y: 50, duration: 300 }}>
			<h3>Delete Item</h3>
			<p>Are you sure you want to delete <strong>"{itemName}"</strong>?</p>
			<p class="warning">This action cannot be undone.</p>
			<div class="modal-buttons">
				<button class="cancel-btn" onclick={onCancel}>Cancel</button>
				<button class="confirm-btn" onclick={onConfirm}>Delete</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background-color: rgba(0, 0, 0, 0.4);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		z-index: 4999;
	}

	.modal-overlay {
		position: fixed;
		transform: translate(-50%, -50%);
		z-index: 5000;
	}

	.delete-modal {
		background-color: var(--container-bg);
		border-radius: 0.75rem;
		padding: 2rem;
		max-width: 25rem;
		width: 300px;
		box-shadow: 0 0.625rem 1.875rem rgba(0, 0, 0, 0.4);
		border: 0.063rem solid var(--table-border-color);
		position: relative;
	}

	.delete-modal h3 {
		margin: 0 0 1rem 0;
		color: var(--text-color);
		font-size: 1.25rem;
	}

	.delete-modal p {
		margin: 0 0 1rem 0;
		color: var(--text-color);
		line-height: 1.5;
	}

	.delete-modal .warning {
		color: #ff6b6b;
		font-weight: 600;
		font-size: 0.9rem;
	}

	.modal-buttons {
		display: flex;
		gap: 1rem;
		margin-top: 1.5rem;
	}

	.modal-buttons button {
		flex: 1;
		padding: 0.75rem 1rem;
		border: none;
		border-radius: 0.5rem;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.cancel-btn {
		background-color: var(--table-border-color);
		color: var(--text-color);
	}

	.cancel-btn:hover {
		background-color: var(--hover-bg-color);
	}

	.confirm-btn {
		background-color: #ff4444;
		color: white;
	}

	.confirm-btn:hover {
		background-color: #ff0000;
		transform: translateY(-0.063rem);
	}
</style>