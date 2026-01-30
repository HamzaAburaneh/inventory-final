<script>
	let { 
		searchValue = $bindable(''), 
		onSearch, 
		onClear,
		placeholder = "Search..."
	} = $props();

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
			{placeholder}
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
		background: var(--tech-badge-bg);
		border: 1px solid var(--tech-badge-border);
		border-radius: 4px;
		color: var(--tech-value);
		font-size: 0.85rem;
		font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		letter-spacing: 0.1em;
		transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
		box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.05);
	}

	.tech-search-input:focus {
		outline: none;
		border-color: var(--tech-accent);
		background: var(--tech-glass-bg);
		box-shadow: 0 0 20px var(--tech-accent-muted), inset 0 2px 4px rgba(0, 0, 0, 0.05);
	}

	.tech-search-input::placeholder {
		color: var(--tech-label);
		opacity: 0.6;
	}

	.tech-search-icon {
		position: absolute;
		left: 1.1rem;
		color: var(--tech-label);
		font-size: 0.9rem;
		pointer-events: none;
		transition: color 0.2s;
	}

	.tech-search-input:focus ~ .tech-search-icon,
	.tech-search-input:not(:placeholder-shown) ~ .tech-search-icon {
		color: var(--tech-accent);
	}

	/* Fix: use the input:focus class to color the icon if it's after the input or just use a sibling selector if possible */
	/* Re-ordering for better CSS control */
	
	.tech-clear-button {
		position: absolute;
		right: 0.8rem;
		background: none;
		border: none;
		color: var(--tech-label);
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

		.tech-search-input {
			padding: 1rem 1rem 1rem 3rem;
			font-size: 1rem;
			border-radius: 8px;
			background: var(--tech-glass-bg);
			border: 1px solid var(--tech-glass-border);
		}

		.tech-search-icon {
			left: 1.2rem;
			font-size: 1rem;
		}

		.tech-clear-button {
			right: 1rem;
			font-size: 1rem;
		}
	}
</style>
