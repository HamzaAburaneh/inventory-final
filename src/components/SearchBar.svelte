<script>
	import { fade, fly } from 'svelte/transition';

	let { searchValue = $bindable(''), onSearch, onClear } = $props();

	function handleInput(event) {
		onSearch(event.target.value);
	}

	function clearSearch() {
		searchValue = '';
		onClear();
	}
</script>

<div class="search-container" in:fly={{ y: -15, duration: 200 }} out:fade={{ duration: 150 }}>
	<div class="search-wrapper">
		<input
			id="search"
			class="search-input"
			bind:value={searchValue}
			placeholder="Search Items"
			oninput={handleInput}
		/>
		<label for="search" class="search-icon">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<circle cx="11" cy="11" r="8"></circle>
				<line x1="21" y1="21" x2="16.65" y2="16.65"></line>
			</svg>
		</label>
		{#if searchValue}
			<button
				class="clear-button"
				onclick={clearSearch}
				transition:fade={{ duration: 150 }}
				aria-label="Clear search"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<line x1="18" y1="6" x2="6" y2="18"></line>
					<line x1="6" y1="6" x2="18" y2="18"></line>
				</svg>
			</button>
		{/if}
	</div>
</div>

<style>
	.search-container {
		width: 100%;
		max-width: 600px;
		margin: 0 auto;
		padding: 0;
	}

	.search-wrapper {
		position: relative;
		width: 100%;
	}

	.search-input {
		width: 100%;
		padding: 0.45rem 2.25rem;
		border: 1.5px solid var(--table-border-color);
		border-radius: var(--border-radius);
		background-color: var(--table-cell-bg);
		color: var(--text-color);
		font-size: 0.85rem;
		transition:
			border-color 0.15s ease-out,
			box-shadow 0.15s ease-out;
	}

	.search-input:hover {
		border-color: var(--icon-color);
	}

	.search-input:focus {
		outline: none;
		border-color: var(--icon-hover-color);
		box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.2);
	}

	.search-input::placeholder {
		color: var(--placeholder-text);
	}

	.search-icon {
		position: absolute;
		left: 0.75rem;
		top: 50%;
		transform: translateY(-50%);
		color: var(--icon-color);
		pointer-events: none;
		transition: color 0.15s ease-out;
	}

	.search-icon svg {
		width: 1.05rem;
		height: 1.05rem;
	}

	.search-input:focus ~ .search-icon {
		color: var(--icon-hover-color);
	}

	.clear-button {
		position: absolute;
		right: 0.75rem;
		top: 50%;
		transform: translateY(-50%);
		background: none;
		border: none;
		cursor: pointer;
		color: var(--icon-color);
		transition: color 0.15s ease-out;
		min-height: 0;
		padding: 0.25rem;
	}

	.clear-button:hover {
		color: var(--icon-hover-color);
	}

	.clear-button svg {
		width: 1.05rem;
		height: 1.05rem;
	}

	@media (max-width: 640px) {
		.search-input {
			font-size: 0.875rem;
		}
	}
</style>
