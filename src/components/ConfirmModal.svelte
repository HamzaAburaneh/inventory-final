<script>
	import { fade, scale } from 'svelte/transition';

	let { 
		show = $bindable(false), 
		title = 'Are you sure?', 
		message = '', 
		confirmText = 'Confirm', 
		cancelText = 'Cancel', 
		type = 'warning',
		onConfirm,
		onCancel
	} = $props();

	function handleConfirm() {
		if (onConfirm) onConfirm();
		show = false;
	}

	function handleCancel() {
		if (onCancel) onCancel();
		show = false;
	}

	function handleKeydown(e) {
		if (!show) return;
		if (e.key === 'Escape') handleCancel();
		if (e.key === 'Enter') handleConfirm();
	}
</script>

<svelte:window on:keydown={handleKeydown} />

{#if show}
	<div class="modal-backdrop" on:click={handleCancel} transition:fade={{ duration: 150 }}></div>
	<div class="modal-container">
		<div class="confirm-modal" transition:scale={{ duration: 200, start: 0.95 }}>
			<div class="modal-header">
				<div class="header-icon" class:danger={type === 'danger'}>
					{#if type === 'danger'}
						<i class="fas fa-exclamation-triangle"></i>
					{:else}
						<i class="fas fa-exclamation-circle"></i>
					{/if}
				</div>
				<h2 class="modal-title">{title}</h2>
			</div>

			<div class="modal-body">
				<p class="modal-message">{@html message}</p>
			</div>

			<div class="modal-footer" class:centered={!cancelText}>
				{#if cancelText}
					<button class="modal-btn cancel-btn" on:click={handleCancel}>
						{cancelText}
					</button>
				{/if}
				<button class="modal-btn confirm-btn" class:danger={type === 'danger'} on:click={handleConfirm}>
					{confirmText}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(2px);
		-webkit-backdrop-filter: blur(2px);
		z-index: 10000;
	}

	.modal-container {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 10001;
		pointer-events: none;
	}

	.confirm-modal {
		position: relative;
		background: #0d0d0d;
		border: 1px solid #1a1a1a;
		border-radius: 4px;
		width: 90%;
		max-width: 400px;
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
		pointer-events: auto;
		overflow: hidden;
	}

	.modal-header {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 16px 20px;
		border-bottom: 1px solid #1a1a1a;
	}

	.header-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		color: #eab308;
		font-size: 1.1rem;
		flex-shrink: 0;
	}

	.header-icon.danger {
		color: #ef4444;
	}

	.modal-title {
		margin: 0;
		color: #e5e7eb;
		font-size: 1.1rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.025em;
	}

	.modal-body {
		padding: 20px;
	}

	.modal-message {
		margin: 0;
		color: #9ca3af;
		font-size: 0.95rem;
		line-height: 1.5;
	}

	.modal-message :global(strong) {
		color: #eab308;
		font-weight: 700;
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		padding: 12px 20px;
		background: #080808;
		border-top: 1px solid #1a1a1a;
	}

	.modal-footer.centered {
		justify-content: center;
	}

	.modal-btn {
		padding: 8px 16px;
		border-radius: 2px;
		font-family: inherit;
		font-size: 0.75rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s ease;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		outline: none;
	}

	.modal-btn:focus-visible {
		box-shadow: 0 0 0 2px rgba(234, 179, 8, 0.4);
	}

	.cancel-btn {
		background: transparent;
		border: 1px solid #262626;
		color: #737373;
	}

	.cancel-btn:hover {
		border-color: #404040;
		color: #a3a3a3;
	}

	.cancel-btn:focus-visible {
		border-color: #404040;
		box-shadow: 0 0 0 2px rgba(115, 115, 115, 0.3);
	}

	.confirm-btn {
		background: #171717;
		border: 1px solid #eab308;
		color: #eab308;
	}

	.confirm-btn:hover {
		background: #eab308;
		color: #000000;
	}

	.confirm-btn.danger {
		border-color: #ef4444;
		color: #ef4444;
	}

	.confirm-btn.danger:hover {
		background: #ef4444;
		color: #ffffff;
	}

	@media (max-width: 768px) {
		.confirm-modal {
			width: 95%;
		}
	}
</style>
