import { writable, derived } from 'svelte/store';

type ItemsPerPage = number | 'all';

interface PaginationState {
	currentPage: number;
	itemsPerPage: ItemsPerPage;
	totalItems: number;
	itemsPerPageOptions: ItemsPerPage[];
}

function createPaginationStore() {
	const { subscribe, set, update } = writable<PaginationState>({
		currentPage: 1,
		itemsPerPage: 10,
		totalItems: 0,
		itemsPerPageOptions: [10, 25, 50, 'all']
	});

	return {
		subscribe,
		setCurrentPage: (page: number) => update((s) => ({ ...s, currentPage: page })),
		setItemsPerPage: (perPage: ItemsPerPage) =>
			update((s) => ({ ...s, itemsPerPage: perPage, currentPage: 1 })),
		setTotalItems: (total: number) => update((s) => ({ ...s, totalItems: total })),
		reset: () =>
			set({
				currentPage: 1,
				itemsPerPage: 10,
				totalItems: 0,
				itemsPerPageOptions: [10, 25, 50, 'all']
			})
	};
}

export const paginationStore = createPaginationStore();

export const totalPages = derived(paginationStore, ($pagination) =>
	$pagination.itemsPerPage === 'all'
		? 1
		: Math.ceil($pagination.totalItems / $pagination.itemsPerPage)
);

export const paginatedItems = derived(
	[paginationStore, totalPages],
	([$pagination, $totalPages]) =>
		(items: any[]) => {
			if ($pagination.itemsPerPage === 'all') return items;
			const start = ($pagination.currentPage - 1) * $pagination.itemsPerPage;
			const end = start + $pagination.itemsPerPage;
			return items.slice(start, end);
		}
);
