<script>
	export let searchValue = '';
	export let onSearch;
	export let onClear;

	const handleInput = (event) => {
		const value = event.target.value;
		onSearch(value);
	};
</script>

<div class="search-container mb-4 relative">
	<div class="search-wrapper relative flex">
		<input
			id="search"
			class="form-control search-input"
			bind:value={searchValue}
			placeholder="Search Items"
			on:input={handleInput}
		/>
		{#if searchValue}
			<button class="clear-button flex items-center justify-center" on:click={onClear}>
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
	.search-input:focus {
		transform: scale(1.02);
		outline: none;
		border-color: #007bff; /* Focus border color matching button */
		box-shadow: 0 0 0 1px #007bff;
	}

	/* Search styles */
	.search-container {
		display: flex;
		justify-content: center;
		width: 100%;
	}

	.search-input {
		width: 100%;
		padding: 0.75rem;
		border: 2px solid #333; /* Lightened border color */
		border-radius: 0.5rem;
		background-color: #222; /* Lightened background color */
		color: #fff;
		font-size: 1rem;
		transition:
			border-color 0.3s ease,
			box-shadow 0.3s ease,
			transform 0.2s ease;
		cursor: text;
		flex-grow: 1;
		min-width: 200px;
		padding: 0.75rem 1rem;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	}

	.search-input::placeholder {
		color: #888; /* Lightened placeholder color */
	}

	.search-wrapper:hover .search-input:not(:focus) {
		border-color: #555; /* Lightened hover border color */
		box-shadow: 0 0 0 1px #555;
		transform: scale(1.01);
	}

	.search-wrapper {
		width: 65%;
		display: flex;
		transition: width 0.3s ease;
		position: relative;
	}

	/* Clear button styles */
	.clear-button {
		background: none;
		border: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--icon-color);
		transition:
			color 0.3s ease,
			transform 0.3s ease;
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
		transition:
			transform 0.3s ease,
			fill 0.3s ease;
	}

	.clear-button:hover {
		color: var(--icon-hover-color); /* Change color on hover */
		transform: scale(1.2); /* Grow button on hover */
	}

	.clear-button:hover svg {
		transform: scale(1.2); /* Rotate the X on hover */
		color: rgb(196, 54, 54);
	}
</style>
