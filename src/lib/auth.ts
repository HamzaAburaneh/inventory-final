import { goto } from '$app/navigation';
import { redirect } from '@sveltejs/kit';
import { get } from 'svelte/store';
import { authStore } from '../stores/authStore';

export function requireAuth(destination: string) {
	const user = get(authStore);
	if (!user) {
		if (typeof window === 'undefined') {
			// Server-side: use redirect
			throw redirect(302, '/login');
		} else {
			// Client-side: use goto
			goto('/login');
		}
		return false;
	}
	return true;
}
