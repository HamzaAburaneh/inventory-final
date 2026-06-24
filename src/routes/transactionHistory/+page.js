export const load = async () => {
	// Transactions are loaded client-side via a realtime onSnapshot subscription in
	// the page component, so there is no data to fetch here. SSR stays enabled (as on
	// the other protected pages) so the navbar + auth shell render on the first paint
	// instead of the whole page blanking until the JS bundle hydrates.
	return {};
};
