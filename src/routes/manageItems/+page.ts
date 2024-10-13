import { requireAuth } from '$lib/auth';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ url }) => {
	requireAuth(url.pathname);
	// You can add any additional data loading logic here if needed
	return {};
};
