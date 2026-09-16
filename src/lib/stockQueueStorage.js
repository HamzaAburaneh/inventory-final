let database;

function openDatabase() {
	if (!globalThis.indexedDB)
		return Promise.reject(
			new Error('Durable storage is unavailable. This stock action was not saved.')
		);
	if (!database)
		database = new Promise((resolve, reject) => {
			const request = indexedDB.open('stocksense-stock-actions', 1);
			request.onupgradeneeded = () => {
				const store = request.result.createObjectStore('actions', {
					keyPath: 'sequence',
					autoIncrement: true
				});
				store.createIndex('id', 'id', { unique: true });
			};
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => {
				database = null;
				reject(new Error('Cannot open durable stock storage. No action was queued.'));
			};
		});
	return database;
}

/** @param {function(object[], IDBObjectStore): void} callback Synchronous transaction body. @param {boolean} [write] Mutate records. @returns {Promise<object[]>} Transaction's original rows. */
export async function accessStockQueue(callback = () => {}, write = false) {
	const db = await openDatabase();
	return new Promise((resolve, reject) => {
		const transaction = db.transaction('actions', write ? 'readwrite' : 'readonly');
		const store = transaction.objectStore('actions');
		const request = store.getAll();
		let rows;
		let failure;
		request.onsuccess = () => {
			rows = request.result;
			try {
				callback(rows, store);
			} catch (error) {
				failure = error;
				transaction.abort();
			}
		};
		transaction.oncomplete = () => resolve(rows);
		transaction.onabort = transaction.onerror = () =>
			reject(
				failure ??
					new Error('The stock action could not be saved. Check device storage and try again.')
			);
	});
}
