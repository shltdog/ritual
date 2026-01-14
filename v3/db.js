// Ritual V3 — IndexedDB helper (schemaVersion 3)

const DB_NAME = "ritual_v3";
const DB_VERSION = 1;

const STORES = {
  tasks: "tasks",
  templates: "templates",
  settings: "settings",
};

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = req.result;

      // Tasks store
      if (!db.objectStoreNames.contains(STORES.tasks)) {
        const s = db.createObjectStore(STORES.tasks, { keyPath: "id" });
        s.createIndex("dateKey", "dateKey", { unique: false });
        s.createIndex("updatedAt", "updatedAt", { unique: false });
      }

      // Templates store (Phase C)
      if (!db.objectStoreNames.contains(STORES.templates)) {
        db.createObjectStore(STORES.templates, { keyPath: "id" });
      }

      // Settings store (single row with key="app")
      if (!db.objectStoreNames.contains(STORES.settings)) {
        db.createObjectStore(STORES.settings, { keyPath: "key" });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, storeName, mode = "readonly") {
  return db.transaction(storeName, mode).objectStore(storeName);
}

export async function dbGet(storeName, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = tx(db, storeName, "readonly");
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function dbPut(storeName, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = tx(db, storeName, "readwrite");
    const req = store.put(value);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

export async function dbDelete(storeName, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = tx(db, storeName, "readwrite");
    const req = store.delete(key);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

export async function dbGetAllByIndex(storeName, indexName, matchValue) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = tx(db, storeName, "readonly");
    const idx = store.index(indexName);
    const req = idx.getAll(matchValue);
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror = () => reject(req.error);
  });
}

export const STORES_CONST = STORES;
