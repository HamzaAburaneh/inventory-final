import { writable, derived, get } from 'svelte/store';

function createPaginationStore() {
	const currentPage = writable(1);
	const itemsPerPage = writable(10);
	const totalItems = writable(0);

	const totalPages = derived(
		[totalItems, itemsPerPage],
		([$totalItems, $itemsPerPage]) => {
			if ($itemsPerPage === 'all') {
				return 1;
			}
			return Math.ceil($totalItems / $itemsPerPage);
		}
	);

	const startIndex = derived(
		[currentPage, itemsPerPage],
		([$currentPage, $itemsPerPage]) => {
			if ($itemsPerPage === 'all') {
				return 0;
			}
			return ($currentPage - 1) * $itemsPerPage;
		}
	);

	const endIndex = derived(
		[startIndex, itemsPerPage, totalItems],
		([$startIndex, $itemsPerPage, $totalItems]) => {
			if ($itemsPerPage === 'all') {
				return $totalItems;
			}
			return Math.min($startIndex + $itemsPerPage, $totalItems);
		}
	);

	function setCurrentPage(page) {
		currentPage.set(page);
	}

	function setItemsPerPage(items) {
		itemsPerPage.set(items);
		currentPage.set(1); // Reset to first page when changing items per page
	}

	function setTotalItems(total) {
		totalItems.set(total);
	}

	function nextPage() {
		currentPage.update(page => {
			const totalPagesValue = get(totalPages);
			return page < totalPagesValue ? page + 1 : page;
		});
	}

	function previousPage() {
		currentPage.update(page => page > 1 ? page - 1 : page);
	}

	function goToFirstPage() {
		currentPage.set(1);
	}

	function goToLastPage() {
		currentPage.set(get(totalPages));
	}

	function reset() {
		currentPage.set(1);
		itemsPerPage.set(10);
		totalItems.set(0);
	}

	return {
		// Stores
		currentPage,
		itemsPerPage,
		totalItems,
		totalPages,
		startIndex,
		endIndex,

		// Actions
		setCurrentPage,
		setItemsPerPage,
		setTotalItems,
		nextPage,
		previousPage,
		goToFirstPage,
		goToLastPage,
		reset
	};
}

const paginationStores = new Map();

export function getPaginationStore(key) {
	if (!paginationStores.has(key)) {
		paginationStores.set(key, createPaginationStore());
	}
	return paginationStores.get(key);
}

