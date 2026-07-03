/// <reference types="@sveltejs/kit" />
// StockSense service worker — the "pocket copy" of the app shell.
//
// Build assets and static files are precached on install; page navigations
// are network-first with a cache fallback, so the app still opens in a dead
// zone after the first online visit. Firestore/Google traffic is never
// intercepted — the Firebase SDK does its own offline queueing (see
// src/firebase.js persistentLocalCache and the offline paths in
// src/lib/items.js).
//
// SvelteKit only registers this worker in production builds (`npm run build`
// + preview/deploy) — `npm run dev` is unaffected.

import { build, files, version } from '$service-worker';

const CACHE = `stocksense-${version}`;

// Everything Vite emitted for this build, plus everything in static/.
const ASSETS = [...build, ...files];

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll(ASSETS))
			.then(() => self.skipWaiting())
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
			)
			.then(() => self.clients.claim())
	);
});

self.addEventListener('fetch', (event) => {
	const { request } = event;

	// Only handle same-origin GETs. Firestore/Auth/OpenRouter/CDN requests
	// pass through untouched (the Firebase SDK handles its own offline mode,
	// and caching POSTs or cross-origin opaque responses causes subtle bugs).
	if (request.method !== 'GET') return;
	const url = new URL(request.url);
	if (url.origin !== self.location.origin) return;

	event.respondWith(respond(request, url));
});

/**
 * Precached assets: cache-first (they are immutable per build version).
 * Pages and everything else: network-first, falling back to the last cached
 * copy — and for navigations, to the cached app shell — when offline.
 * @param {Request} request
 * @param {URL} url
 * @returns {Promise<Response>}
 */
async function respond(request, url) {
	const cache = await caches.open(CACHE);

	if (ASSETS.includes(url.pathname)) {
		const cached = await cache.match(url.pathname);
		if (cached) return cached;
	}

	try {
		const response = await fetch(request);
		// Runtime-cache successful page loads so previously visited routes
		// (and the shell) survive going offline.
		if (response.status === 200) {
			cache.put(request, response.clone());
		}
		return response;
	} catch (error) {
		const cached = await cache.match(request);
		if (cached) return cached;
		if (request.mode === 'navigate') {
			// Unvisited route while offline — serve the cached shell; the
			// client-side router takes over from there.
			const shell = await cache.match('/');
			if (shell) return shell;
		}
		throw error;
	}
}
