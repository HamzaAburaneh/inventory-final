import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

// Protected pages don't mount until this store reports 'ready', and resolving
// from scratch costs two SERIAL Firestore reads in front of every page's own
// query. These cover the cached fast path that removes them from the critical
// path — and, just as importantly, that the cache can never widen access.
const mocks = vi.hoisted(() => ({
	getDoc: vi.fn(),
	isGroupMember: vi.fn(),
	setActiveGroupId: vi.fn()
}));

vi.mock('../firebase', () => ({ db: {} }));
vi.mock('$app/environment', () => ({ browser: true }));
vi.mock('firebase/firestore', () => ({
	doc: vi.fn((_db, ...segments) => ({ path: segments.join('/') })),
	getDoc: mocks.getDoc
}));
vi.mock('../lib/groups', () => ({ isGroupMember: mocks.isGroupMember }));
vi.mock('../lib/activeGroup', () => ({ setActiveGroupId: mocks.setActiveGroupId }));

/** Minimal localStorage stand-in — the node test environment has none. */
function installLocalStorage() {
	const data = new Map();
	globalThis.localStorage = {
		getItem: (k) => (data.has(k) ? data.get(k) : null),
		setItem: (k, v) => data.set(k, String(v)),
		removeItem: (k) => data.delete(k),
		clear: () => data.clear()
	};
	return data;
}

const CACHE_KEY = 'ss_active_group';
const user = { uid: 'user-1' };
const profile = (groupId, role = 'owner') => ({
	exists: () => true,
	data: () => ({ groupId, role })
});

let store;
let storage;

beforeEach(async () => {
	vi.clearAllMocks();
	storage = installLocalStorage();
	// Fresh module per test — the store holds process-wide state.
	vi.resetModules();
	({ groupStore: store } = await import('./groupStore.js'));
});

describe('cold resolve (no cache)', () => {
	it('resolves through both reads and reports ready', async () => {
		mocks.getDoc.mockResolvedValue(profile('group-9'));
		mocks.isGroupMember.mockResolvedValue(true);

		await store.resolve(user);

		expect(get(store)).toEqual({ status: 'ready', groupId: 'group-9', role: 'owner' });
		expect(mocks.setActiveGroupId).toHaveBeenCalledWith('group-9');
	});

	it('caches the resolved membership for next time', async () => {
		mocks.getDoc.mockResolvedValue(profile('group-9'));
		mocks.isGroupMember.mockResolvedValue(true);

		await store.resolve(user);

		expect(JSON.parse(storage.get(CACHE_KEY))).toEqual({
			uid: 'user-1',
			groupId: 'group-9',
			role: 'owner'
		});
	});

	it('reports none when the user has no group', async () => {
		mocks.getDoc.mockResolvedValue({ exists: () => false, data: () => ({}) });

		await store.resolve(user);

		expect(get(store).status).toBe('none');
	});
});

describe('warm resolve (cached)', () => {
	beforeEach(() => {
		storage.set(CACHE_KEY, JSON.stringify({ uid: 'user-1', groupId: 'group-9', role: 'owner' }));
	});

	it('reports ready SYNCHRONOUSLY, before either read resolves', () => {
		// This is the whole point: the page can mount and issue its own query
		// without waiting on two serial round trips.
		let resolveProfile;
		mocks.getDoc.mockReturnValue(new Promise((r) => (resolveProfile = r)));

		store.resolve(user); // deliberately not awaited

		expect(get(store)).toEqual({ status: 'ready', groupId: 'group-9', role: 'owner' });
		expect(mocks.setActiveGroupId).toHaveBeenCalledWith('group-9');
		resolveProfile(profile('group-9'));
	});

	it('ignores a cache belonging to a different user', () => {
		mocks.getDoc.mockReturnValue(new Promise(() => {}));

		store.resolve({ uid: 'someone-else' });

		// No optimistic ready — a different account must never inherit this group.
		expect(get(store).status).toBe('loading');
		expect(mocks.setActiveGroupId).not.toHaveBeenCalledWith('group-9');
	});

	it('ignores a corrupt cache entry', () => {
		storage.set(CACHE_KEY, 'not json');
		mocks.getDoc.mockReturnValue(new Promise(() => {}));

		store.resolve(user);

		expect(get(store).status).toBe('loading');
	});

	it('corrects to none when revalidation finds the membership revoked', async () => {
		mocks.getDoc.mockResolvedValue(profile('group-9'));
		mocks.isGroupMember.mockResolvedValue(false);

		await store.resolve(user);

		expect(get(store).status).toBe('none');
		expect(mocks.setActiveGroupId).toHaveBeenLastCalledWith(null);
		expect(storage.has(CACHE_KEY)).toBe(false);
	});

	it('keeps the cached group when revalidation fails, so offline still works', async () => {
		// Firestore throwing (offline, transient) is not proof the membership is
		// gone. Dropping to 'none' here would bounce an offline member to onboarding.
		mocks.getDoc.mockRejectedValue(new Error('offline'));
		vi.spyOn(console, 'error').mockImplementation(() => {});

		await store.resolve(user);

		expect(get(store)).toEqual({ status: 'ready', groupId: 'group-9', role: 'owner' });
	});
});

describe('sign-out', () => {
	it('clears the cache so the next user cannot inherit the group', async () => {
		storage.set(CACHE_KEY, JSON.stringify({ uid: 'user-1', groupId: 'group-9', role: 'owner' }));

		await store.resolve(null);

		expect(storage.has(CACHE_KEY)).toBe(false);
		expect(get(store).status).toBe('none');
		expect(mocks.setActiveGroupId).toHaveBeenCalledWith(null);
	});

	it('clear() also drops the cache', () => {
		storage.set(CACHE_KEY, JSON.stringify({ uid: 'user-1', groupId: 'group-9', role: 'owner' }));

		store.clear();

		expect(storage.has(CACHE_KEY)).toBe(false);
	});
});

describe('applyGroup', () => {
	it('primes the cache after onboarding so the first real load is already warm', () => {
		store.applyGroup('group-42', 'owner', 'user-1');

		expect(JSON.parse(storage.get(CACHE_KEY))).toEqual({
			uid: 'user-1',
			groupId: 'group-42',
			role: 'owner'
		});
		expect(get(store)).toEqual({ status: 'ready', groupId: 'group-42', role: 'owner' });
	});
});
