const DB_NAME = 'daybook';
const DB_VERSION = 1;

/** @type {Promise<IDBDatabase> | undefined} */
let openPromise;

/** @returns {Promise<IDBDatabase>} */
function open() {
  if (!openPromise) {
    openPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const database = request.result;

        if (!database.objectStoreNames.contains('events')) {
          const events = database.createObjectStore('events', { keyPath: 'id' });
          events.createIndex('calendar_id', 'calendar_id');
          events.createIndex('dtstart_utc', 'dtstart_utc');
          events.createIndex('all_day_start', 'all_day_start');
          events.createIndex('uid', 'uid');
          events.createIndex('source_uid', 'source_uid');
        }

        if (!database.objectStoreNames.contains('calendars')) {
          const calendars = database.createObjectStore('calendars', { keyPath: 'id' });
          calendars.createIndex('order', 'order');
        }

        if (!database.objectStoreNames.contains('settings')) {
          database.createObjectStore('settings', { keyPath: 'key' });
        }

        if (!database.objectStoreNames.contains('push_queue')) {
          database.createObjectStore('push_queue', { keyPath: 'row_key' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onblocked = () => reject(new Error('IndexedDB open blocked by another tab'));
      request.onerror = () => reject(request.error);
    }).catch((error) => {
      openPromise = undefined;
      throw error;
    });
  }

  return openPromise;
}

export const db = {
  open,

  /**
   * @param {string} store
   * @param {IDBValidKey} key
   * @returns {Promise<any>}
   */
  async get(store, key) {
    const database = await open();
    return new Promise((resolve, reject) => {
      const request = database.transaction(store, 'readonly').objectStore(store).get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * @param {string} store
   * @param {string} [index]
   * @param {IDBValidKey | IDBKeyRange} [query]
   * @returns {Promise<any[]>}
   */
  async getAll(store, index, query) {
    const database = await open();
    return new Promise((resolve, reject) => {
      const source = database.transaction(store, 'readonly').objectStore(store);
      const request = index ? source.index(index).getAll(query) : source.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * @param {string} store
   * @param {any} value
   * @returns {Promise<void>}
   */
  async put(store, value) {
    const database = await open();
    return /** @type {Promise<void>} */ (
      new Promise((resolve, reject) => {
        const transaction = database.transaction(store, 'readwrite');
        transaction.objectStore(store).put(value);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      })
    );
  },

  /**
   * @param {string} store
   * @param {IDBValidKey} key
   * @returns {Promise<void>}
   */
  async delete(store, key) {
    const database = await open();
    return /** @type {Promise<void>} */ (
      new Promise((resolve, reject) => {
        const transaction = database.transaction(store, 'readwrite');
        transaction.objectStore(store).delete(key);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      })
    );
  },

  /**
   * @param {string} store
   * @returns {Promise<void>}
   */
  async clear(store) {
    const database = await open();
    return /** @type {Promise<void>} */ (
      new Promise((resolve, reject) => {
        const transaction = database.transaction(store, 'readwrite');
        transaction.objectStore(store).clear();
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      })
    );
  },

  /**
   * @template T
   * @param {string | string[]} stores
   * @param {IDBTransactionMode} mode
   * @param {(transaction: IDBTransaction) => T} fn
   * @returns {Promise<T>}
   */
  async transaction(stores, mode, fn) {
    const database = await open();
    return /** @type {Promise<T>} */ (
      new Promise((resolve, reject) => {
        const transaction = database.transaction(stores, mode);
        /** @type {any} */
        let result;

        transaction.oncomplete = () => resolve(result);
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () =>
          reject(transaction.error || new Error('Transaction aborted'));

        try {
          result = fn(transaction);
        } catch (error) {
          try {
            transaction.abort();
          } catch {
            // Already aborted.
          }
          reject(error);
        }
      })
    );
  },
};
