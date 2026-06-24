export const load = async () => {
	// Analysis data is fetched client-side in the page's onMount, so there is nothing
	// to load here. SSR stays enabled (as on the other protected pages) so the navbar +
	// auth shell render on the first paint instead of the whole page blanking until the
	// JS bundle hydrates.
	return {};
};
