<script>
	// Lightweight inline-SVG icon set for the inventory table. Stroke-based icons
	// inherit `currentColor`, so they adapt to every theme (light/dark/blue/green)
	// without extra styling. Pass `name` to pick an icon; size/class are optional.
	let { name, size = 16, class: className = '' } = $props();
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="2"
	stroke-linecap="round"
	stroke-linejoin="round"
	class={className}
	aria-hidden="true"
>
	{#if name === 'tag'}
		<path d="M20.59 13.41 13.42 20.59a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z" />
		<circle cx="7" cy="7" r="1.5" />
	{:else if name === 'hash'}
		<line x1="4" x2="20" y1="9" y2="9" />
		<line x1="4" x2="20" y1="15" y2="15" />
		<line x1="10" x2="8" y1="3" y2="21" />
		<line x1="16" x2="14" y1="3" y2="21" />
	{:else if name === 'alert'}
		<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
		<line x1="12" x2="12" y1="9" y2="13" />
		<line x1="12" x2="12.01" y1="17" y2="17" />
	{:else if name === 'dollar'}
		<line x1="12" x2="12" y1="2" y2="22" />
		<path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
	{:else if name === 'coins'}
		<circle cx="8" cy="8" r="6" />
		<path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
		<path d="M7 6h1v4" />
		<path d="m16.71 13.88.7.71-2.82 2.82" />
	{:else if name === 'thermometer'}
		<path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z" />
	{:else if name === 'store'}
		<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
		<circle cx="12" cy="10" r="3" />
	{:else if name === 'snowflake'}
		<line x1="2" x2="22" y1="12" y2="12" />
		<line x1="12" x2="12" y1="2" y2="22" />
		<path d="m20 16-4-4 4-4" />
		<path d="m4 8 4 4-4 4" />
		<path d="m16 4-4 4-4-4" />
		<path d="m8 20 4-4 4 4" />
	{:else if name === 'refrigerator'}
		<rect x="6" y="2" width="12" height="20" rx="2" />
		<line x1="6" x2="18" y1="10" y2="10" />
		<line x1="9" x2="9" y1="5" y2="7" />
		<line x1="9" x2="9" y1="13" y2="15" />
	{:else if name === 'package'}
		<path
			d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"
		/>
		<path d="m3.3 7 8.7 5 8.7-5" />
		<path d="M12 22V12" />
	{/if}
</svg>
