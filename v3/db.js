// db.js

const DB_NAME = 'ritual_v3';
const DB_VERSION = 1;

const STORES = {
  tasks: 'tasks',
  templates: 'templates',
  settings: 'settings',
  holidays: 'holidays',
  meta: 'meta',
  debug: 'debug'
};

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(STORES.tasks)) {
        const store = db.createObjectStore(STORES.tasks, { keyPath: 'id' });
        store.createIndex('by_date', 'date', { unique: false });
        store.createIndex('by_date_order', ['date', 'order'], { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.templates)) {
        db.createObjectStore(STORES.templates, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(STORES.settings)) {
        db.createObjectStore(STORES.settings);
      }

      if (!db.objectStoreNames.contains(STORES.holidays)) {
        db.createObjectStore(STORES.holidays, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(STORES.meta)) {
        db.createObjectStore(STORES.meta);
      }

      if (!db.objectStoreNames.contains(STORES.debug)) {
        db.createObjectStore(STORES.debug, { autoIncrement: true });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

function tx(db, storeName, mode = 'readonly') {
  return db.transaction(storeName, mode).objectStore(storeName);
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export {
  DB_NAME,
  DB_VERSION,
  STORES,
  openDB,
  tx,
  reqToPromise
};
