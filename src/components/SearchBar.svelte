<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let searchValue = '';

	const dispatch = createEventDispatcher();

	const handleSearch = () => {
		dispatch('search', searchValue);
	};

	const clearSearch = () => {
		searchValue = '';
		dispatch('search', '');
	};
</script>

<div class="search-container mb-4 relative">
	<div class="search-wrapper relative flex">
		<input
			id="search"
			class="form-control search-input"
			bind:value={searchValue}
			placeholder="Search Items"
			on:input={handleSearch}
		/>
		{#if searchValue}
			<button class="clear-button flex items-center justify-center" on:click={clearSearch}>
				<svg
					class="h-5 w-5 text-gray-500"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M6 18L18 6M6 6l12 12"
					></path>
				</svg>
			</button>
		{/if}
	</div>
</div>

<style>
	.search-container {
		display: flex;
		justify-content: center;
		width: 100%;
	}
	.search-wrapper {
		width: 65%;
		display: flex;
		transition: width 0.3s ease;
		position: relative;
	}
	.search-input {
		flex-grow: 1;
		min-width: 200px;
		padding: 0.75rem 1rem;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
		border: 2px solid #333;
		border-radius: 0.5rem;
		background-color: #222;
		color: #fff;
		font-size: 1rem;
		transition:
			border-color 0.3s ease,
			box-shadow 0.3s ease,
			transform 0.2s ease;
	}
	.search-input::placeholder {
		color: #888;
	}
	.search-input:focus {
		transform: scale(1.02);
		outline: none;
		border-color: #007bff;
		box-shadow: 0 0 0 1px #007bff;
	}
	.clear-button {
		background: none;
		border: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--icon-color);
		transition: color 0.3s ease;
		width: 2rem;
		height: 100%;
		position: absolute;
		right: 0;
		top: 0;
		padding: 0;
	}
	.clear-button svg {
		width: 1rem;
		height: 1rem;
	}
	.clear-button:hover {
		color: var(--icon-hover-color);
	}
</style>
