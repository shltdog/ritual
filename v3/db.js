// Ritual V3 — db.js (canonical)
// Exports: DB, idbGet, idbPut, idbDelete, idbGetAll, idbGetAllByIndex

export const STORES_CONST = {
  TASKS: "tasks",
  SETTINGS: "settings",
  TEMPLATES: "templates"
};

export const DB = {
  name: "ritual_v3",
  version: 1,
  stores: {
    tasks: "tasks",
    templates: "templates",
    settings: "settings",
  },
};

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB.name, DB.version);

    req.onupgradeneeded = () => {
      const db = req.result;

      if (!db.objectStoreNames.contains(DB.stores.tasks)) {
        const s = db.createObjectStore(DB.stores.tasks, { keyPath: "id" });
        s.createIndex("dateKey", "dateKey", { unique: false });
        s.createIndex("updatedAt", "updatedAt", { unique: false });
      }

      if (!db.objectStoreNames.contains(DB.stores.templates)) {
        const s = db.createObjectStore(DB.stores.templates, { keyPath: "id" });
        s.createIndex("updatedAt", "updatedAt", { unique: false });
      }

      if (!db.objectStoreNames.contains(DB.stores.settings)) {
        db.createObjectStore(DB.stores.settings, { keyPath: "key" });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore(storeName, mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);

    Promise.resolve(fn(store))
      .then((result) => {
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      })
      .catch(reject);
  });
}

export async function idbGet(storeName, key) {
  return withStore(storeName, "readonly", (s) => new Promise((res, rej) => {
    const req = s.get(key);
    req.onsuccess = () => res(req.result ?? null);
    req.onerror = () => rej(req.error);
  }));
}

export async function idbPut(storeName, value) {
  return withStore(storeName, "readwrite", (s) => new Promise((res, rej) => {
    const req = s.put(value);
    req.onsuccess = () => res(true);
    req.onerror = () => rej(req.error);
  }));
}

export async function idbDelete(storeName, key) {
  return withStore(storeName, "readwrite", (s) => new Promise((res, rej) => {
    const req = s.delete(key);
    req.onsuccess = () => res(true);
    req.onerror = () => rej(req.error);
  }));
}

export async function idbGetAll(storeName) {
  return withStore(storeName, "readonly", (s) => new Promise((res, rej) => {
    const req = s.getAll();
    req.onsuccess = () => res(req.result ?? []);
    req.onerror = () => rej(req.error);
  }));
}

export async function idbGetAllByIndex(storeName, indexName, matchValue) {
  return withStore(storeName, "readonly", (s) => new Promise((res, rej) => {
    const idx = s.index(indexName);
    const req = idx.getAll(matchValue);
    req.onsuccess = () => res(req.result ?? []);
    req.onerror = () => rej(req.error);
  }));
}
