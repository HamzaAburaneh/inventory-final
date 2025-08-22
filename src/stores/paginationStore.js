import { writable, derived, get } from 'svelte/store';

function createPaginationStore(key) {
	const currentPage = writable(1);
	
	// Get saved itemsPerPage from localStorage or default to 10
	const getInitialItemsPerPage = () => {
		if (typeof window !== 'undefined') {
			const saved = localStorage.getItem(`pagination_${key}_itemsPerPage`);
			if (saved) {
				const parsed = saved === 'all' ? 'all' : parseInt(saved);
				return !isNaN(parsed) || parsed === 'all' ? parsed : 10;
			}
		}
		return 10;
	};
	
	const itemsPerPage = writable(getInitialItemsPerPage());
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
		
		// Save to localStorage
		if (typeof window !== 'undefined') {
			localStorage.setItem(`pagination_${key}_itemsPerPage`, items.toString());
		}
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
		paginationStores.set(key, createPaginationStore(key));
	}
	return paginationStores.get(key);
}

