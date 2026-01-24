<script>
	let { searchValue = $bindable(''), onSearch, onClear } = $props();

	function handleInput(event) {
		const value = event.target.value;
		searchValue = value;
		onSearch(value);
	}

	function clearSearch() {
		searchValue = '';
		onClear();
	}
</script>

<div class="tech-search-container">
	<div class="tech-search-wrapper">
		<i class="fas fa-search tech-search-icon"></i>
		<input
			id="search"
			class="tech-search-input"
			bind:value={searchValue}
			placeholder="Search transactions..."
			oninput={handleInput}
		/>
		{#if searchValue}
			<button class="tech-clear-button" onclick={clearSearch} aria-label="Clear search">
				<i class="fas fa-times"></i>
			</button>
		{/if}
	</div>
</div>

<style>
	.tech-search-container {
		width: 100%;
		display: flex;
		justify-content: flex-end;
	}

	.tech-search-wrapper {
		position: relative;
		width: 100%;
		max-width: 600px;
		display: flex;
		align-items: center;
	}

	.tech-search-input {
		width: 100%;
		padding: 0.7rem 1rem 0.7rem 2.8rem;
		background: #000000;
		border: 1px solid #222222;
		border-radius: 4px;
		color: #ffffff;
		font-size: 0.85rem;
		font-family: 'JetBrains Mono', monospace;
		letter-spacing: 0.1em;
		transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
		box-shadow: inset 0 2px 10px rgba(0, 0, 0, 0.5);
	}

	.tech-search-input:focus {
		outline: none;
		border-color: #ffe260;
		background: #050505;
		box-shadow: 0 0 20px rgba(255, 226, 96, 0.05), inset 0 2px 10px rgba(0, 0, 0, 0.5);
	}

	.tech-search-input::placeholder {
		color: #444444;
	}

	.tech-search-icon {
		position: absolute;
		left: 1.1rem;
		color: #444444;
		font-size: 0.9rem;
		pointer-events: none;
		transition: color 0.2s;
	}

	.tech-search-input:focus ~ .tech-search-icon,
	.tech-search-input:not(:placeholder-shown) ~ .tech-search-icon {
		color: #ffe260;
	}

	/* Fix: use the input:focus class to color the icon if it's after the input or just use a sibling selector if possible */
	/* Re-ordering for better CSS control */
	
	.tech-clear-button {
		position: absolute;
		right: 0.8rem;
		background: none;
		border: none;
		color: #444444;
		cursor: pointer;
		font-size: 0.9rem;
		transition: all 0.2s;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.tech-clear-button:hover {
		color: #ff4757;
	}

	@media (max-width: 768px) {
		.tech-search-wrapper {
			max-width: 100%;
		}
	}
</style>
