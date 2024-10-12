<script lang="ts">
	import { fade, fly } from 'svelte/transition';

	export let searchValue = '';
	export let onSearch: (value: string) => void;
	export let onClear: () => void;

	function handleInput(event: Event) {
		const value = (event.target as HTMLInputElement).value;
		searchValue = value;
		onSearch(value);
	}

	function clearSearch() {
		searchValue = '';
		onClear();
	}
</script>

<div class="search-container" in:fly={{ y: -20, duration: 300 }} out:fade={{ duration: 200 }}>
	<div class="search-wrapper">
		<input
			id="search"
			class="search-input"
			bind:value={searchValue}
			placeholder="Search Items"
			on:input={handleInput}
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
			<button class="clear-button" on:click={clearSearch} transition:fade={{ duration: 200 }}>
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
		padding: 1rem 0;
	}

	.search-wrapper {
		position: relative;
		width: 100%;
	}

	.search-input {
		width: 100%;
		padding: 0.75rem 2.5rem 0.75rem 2.5rem;
		border: 2px solid var(--table-border-color);
		border-radius: var(--border-radius);
		background-color: var(--table-cell-bg);
		color: var(--text-color);
		font-size: 1rem;
		transition: all 0.3s ease;
	}

	.search-input:hover {
		border-color: var(--icon-color);
	}

	.search-input:focus {
		outline: none;
		border-color: var(--icon-hover-color);
		box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.25);
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
		transition: color 0.3s ease;
	}

	.search-icon svg {
		width: 1.25rem;
		height: 1.25rem;
	}

	.search-input:focus + .search-icon {
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
		transition: color 0.3s ease;
	}

	.clear-button:hover {
		color: var(--icon-hover-color);
	}

	.clear-button svg {
		width: 1.25rem;
		height: 1.25rem;
	}

	@media (max-width: 640px) {
		.search-container {
			padding: 0.5rem 0;
		}

		.search-input {
			font-size: 0.875rem;
		}
	}
</style>
