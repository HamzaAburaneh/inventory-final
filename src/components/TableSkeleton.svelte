<script>
	import { prefersReducedMotion } from 'svelte/motion';

	// Placeholder rows shown while items load. Mirrors the real page chrome
	// (collapsed form bar + inventory section) so the layout doesn't jump in.
	let { rows = 8 } = $props();

	const rowList = $derived(Array.from({ length: rows }, (_, i) => i));
</script>

<div class="skeleton" class:reduced={prefersReducedMotion.current} aria-hidden="true">
	<!-- Collapsed "Add New Item" bar -->
	<div class="sk-formbar">
		<span class="sk sk-square"></span>
		<span class="sk sk-line" style="width: 9rem"></span>
	</div>

	<div class="sk-section">
		<!-- Inventory header -->
		<div class="sk-header">
			<span class="sk sk-line" style="width: 8rem"></span>
			<span class="sk sk-pill" style="width: 7rem"></span>
		</div>

		<!-- Search -->
		<div class="sk-search">
			<span class="sk sk-line" style="width: min(100%, 30rem); height: 1.6rem"></span>
		</div>

		<!-- Column head -->
		<div class="sk-row sk-row--head">
			{#each Array.from({ length: 6 }, (_, i) => i) as i (i)}
				<span class="sk sk-line"></span>
			{/each}
		</div>

		<!-- Body rows -->
		{#each rowList as i (i)}
			<div class="sk-row">
				<span class="sk sk-line col-name"></span>
				<span class="sk sk-line col-num"></span>
				<span class="sk sk-line col-num"></span>
				<span class="sk sk-line col-num"></span>
				<span class="sk sk-line col-num"></span>
				<span class="sk sk-pill col-badge"></span>
			</div>
		{/each}
	</div>
</div>

<style>
	.skeleton {
		max-width: 95%;
		width: 100%;
		margin: 0 auto;
		padding: 1rem;
	}

	.sk-formbar {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.7rem 1.25rem;
		margin-bottom: 1rem;
		background: var(--container-bg);
		border: 1px solid var(--table-border-color);
		border-radius: var(--border-radius);
	}

	.sk-section {
		background: var(--container-bg);
		border: 1px solid var(--table-border-color);
		border-radius: var(--border-radius);
		overflow: hidden;
	}

	.sk-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.85rem 1.25rem;
		background: var(--table-header-bg);
		border-bottom: 1px solid var(--table-border-color);
	}

	.sk-search {
		padding: 0.9rem 1.25rem;
		border-bottom: 1px solid var(--table-border-color);
	}

	.sk-row {
		display: grid;
		grid-template-columns: 2.4fr 1fr 1fr 1fr 1.2fr 1.4fr;
		align-items: center;
		gap: 1rem;
		padding: 0.65rem 1.25rem;
		border-bottom: 1px solid var(--table-border-color);
	}

	.sk-row--head {
		background: var(--table-header-bg);
	}

	.sk-row:last-child {
		border-bottom: none;
	}

	/* Base shimmer block */
	.sk {
		position: relative;
		overflow: hidden;
		border-radius: 6px;
		background: color-mix(in srgb, var(--text-color) 9%, transparent);
	}

	.sk-line {
		height: 0.85rem;
		width: 100%;
	}

	.sk-pill {
		height: 1.4rem;
		border-radius: 9999px;
	}

	.sk-square {
		width: 1.75rem;
		height: 1.75rem;
		border-radius: var(--border-radius);
		flex-shrink: 0;
	}

	.col-name {
		width: 70%;
	}
	.col-num {
		width: 45%;
	}
	.col-badge {
		width: 6rem;
	}

	.sk::after {
		content: '';
		position: absolute;
		inset: 0;
		transform: translateX(-100%);
		background: linear-gradient(
			90deg,
			transparent,
			color-mix(in srgb, var(--text-color) 12%, transparent),
			transparent
		);
		animation: sk-shimmer 1.4s ease-in-out infinite;
	}

	@keyframes sk-shimmer {
		100% {
			transform: translateX(100%);
		}
	}

	/* Respect reduced-motion: hold a static placeholder, no sweep. */
	.skeleton.reduced .sk::after {
		animation: none;
	}

	@media (prefers-reduced-motion: reduce) {
		.sk::after {
			animation: none;
		}
	}

	@media (min-width: 768px) {
		.skeleton {
			max-width: 96%;
			padding: 2rem;
		}
	}

	@media (max-width: 48rem) {
		.sk-row {
			grid-template-columns: 1.6fr 1fr 1.2fr;
		}

		.sk-row .col-num:nth-of-type(n + 4),
		.sk-row .col-badge {
			display: none;
		}
	}
</style>
