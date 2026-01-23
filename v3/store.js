// store.js

const DB_NAME = 'ritual_v3';
const DB_VERSION = 1;
let db;

const POINTS_PER_TASK = 10;

const LEVELS = [
  { name: 'Rookie', threshold: 0 },
  { name: 'Runner', threshold: 200 },
  { name: 'Striver', threshold: 600 },
  { name: 'Knight', threshold: 1200 },
  { name: 'Legend', threshold: 2000 }
];

function openDB() {
  return new Promise((resolve, reject) => {
    if (db) return resolve(db);

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('tasks')) db.createObjectStore('tasks', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('templates')) db.createObjectStore('templates', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');
      if (!db.objectStoreNames.contains('holidays')) db.createObjectStore('holidays', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
      if (!db.objectStoreNames.contains('debug')) db.createObjectStore('debug', { autoIncrement: true });
    };
  });
}

function tx(storeName, mode = 'readonly') {
  return openDB().then(db => db.transaction(storeName, mode).objectStore(storeName));
}

// SETTINGS

async function getSettings() {
  const store = await tx('settings');
  return new Promise(resolve => {
    const req = store.get('main');
    req.onsuccess = () => resolve(req.result || {});
    req.onerror = () => resolve({});
  });
}

async function setSettings(settings) {
  const store = await tx('settings', 'readwrite');
  return new Promise(resolve => {
    const req = store.put(settings, 'main');
    req.onsuccess = () => resolve();
  });
}

async function getAccent() {
  const settings = await getSettings();
  return settings.accent || '#e34242';
}

async function setAccent(color) {
  const settings = await getSettings();
  settings.accent = color;
  await setSettings(settings);
}

async function getDebugEnabled() {
  const settings = await getSettings();
  return !!settings.debug;
}

async function setDebugEnabled(enabled) {
  const settings = await getSettings();
  settings.debug = !!enabled;
  await setSettings(settings);
}

async function debugLog(message) {
  const store = await tx('debug', 'readwrite');
  store.add({ timestamp: Date.now(), message });
}

async function getDebugLog() {
  const store = await tx('debug');
  return new Promise(resolve => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });
}

async function clearDebugLog() {
  const store = await tx('debug', 'readwrite');
  store.clear();
}

// TASKS

async function getTasksForDate(dateKey) {
  const store = await tx('tasks');
  return new Promise(resolve => {
    const req = store.getAll();
    req.onsuccess = () => {
      const all = req.result || [];
      const list = all.filter(t => t.date === dateKey);
      list.sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        return (a.order || 0) - (b.order || 0);
      });
      resolve(list);
    };
  });
}

async function addTask(dateKey, title) {
  const store = await tx('tasks', 'readwrite');
  const id = crypto.randomUUID();
  const task = { id, date: dateKey, title, done: false, order: Date.now() };
  store.put(task);
  return id;
}

async function updateTaskTitle(id, newTitle) {
  const store = await tx('tasks', 'readwrite');
  const taskReq = store.get(id);
  return new Promise(resolve => {
    taskReq.onsuccess = () => {
      const task = taskReq.result;
      if (task) {
        task.title = newTitle;
        store.put(task);
      }
      resolve();
    };
  });
}

async function deleteTask(id) {
  const store = await tx('tasks', 'readwrite');
  store.delete(id);
}

async function toggleTaskDone(id) {
  const store = await tx('tasks', 'readwrite');
  const taskReq = store.get(id);
  return new Promise(resolve => {
    taskReq.onsuccess = () => {
      const task = taskReq.result;
      if (task) {
        task.done = !task.done;
        store.put(task);
      }
      resolve();
    };
  });
}

async function reorderTasks(dateKey, newOrder) {
  const store = await tx('tasks', 'readwrite');
  const allReq = store.getAll();
  allReq.onsuccess = () => {
    const tasks = allReq.result.filter(t => t.date === dateKey);
    newOrder.forEach((id, index) => {
      const task = tasks.find(t => t.id === id);
      if (task) {
        task.order = index;
        store.put(task);
      }
    });
  };
}

// RECURRING TEMPLATES

async function getTemplates() {
  const store = await tx('templates');
  return new Promise(resolve => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
  });
}

async function addTemplate(template) {
  const store = await tx('templates', 'readwrite');
  const id = crypto.randomUUID();
  store.put({ ...template, id });
  return id;
}

async function updateTemplate(id, updatedFields) {
  const store = await tx('templates', 'readwrite');
  const req = store.get(id);
  req.onsuccess = () => {
    const template = req.result;
    if (template) {
      Object.assign(template, updatedFields);
      store.put(template);
    }
  };
}

async function deleteTemplate(id) {
  const store = await tx('templates', 'readwrite');
  store.delete(id);
}

async function templatesForDate(dateKey) {
  const store = await tx('templates');
  const templates = await new Promise(resolve => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
  });

  const day = new Date(dateKey).getDay();
  return templates.filter(t => t.days && t.days.includes(day));
}

async function getStartOfDayCandidates(todayKey) {
  const yesterday = new Date(new Date(todayKey).getTime() - 86400000)
    .toISOString()
    .slice(0, 10);
  const [yesterdayTasks, recurring] = await Promise.all([
    getTasksForDate(yesterday),
    templatesForDate(todayKey)
  ]);

  const unfinished = yesterdayTasks.filter(t => !t.done);
  return {
    fromYesterday: unfinished,
    recurringTemplates: recurring
  };
}

// CUSTOM HOLIDAYS

async function getCustomHolidays() {
  const store = await tx('holidays');
  return new Promise(resolve => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
  });
}

async function addCustomHoliday(mmdd, name) {
  const store = await tx('holidays', 'readwrite');
  const id = crypto.randomUUID();
  store.put({ id, mmdd, name });
  return id;
}

async function updateCustomHoliday(id, fields) {
  const store = await tx('holidays', 'readwrite');
  const req = store.get(id);
  req.onsuccess = () => {
    const holiday = req.result;
    if (holiday) {
      Object.assign(holiday, fields);
      store.put(holiday);
    }
  };
}

async function deleteCustomHoliday(id) {
  const store = await tx('holidays', 'readwrite');
  store.delete(id);
}

// BACKUP / IMPORT

async function exportBackupJSON() {
  const dbInstance = await openDB();
  const result = {};

  const stores = ['tasks', 'templates', 'settings', 'holidays', 'meta', 'debug'];

  await Promise.all(
    stores.map(storeName => {
      return new Promise(resolve => {
        const store = dbInstance.transaction(storeName).objectStore(storeName);
        const req = store.getAll();
        req.onsuccess = () => {
          result[storeName] = req.result;
          resolve();
        };
        req.onerror = () => {
          result[storeName] = [];
          resolve();
        };
      });
    })
  );

  return JSON.stringify(result, null, 2);
}

async function importBackupJSON(json) {
  let data;
  try {
    data = typeof json === 'string' ? JSON.parse(json) : json;
    if (typeof data !== 'object') throw new Error();
  } catch {
    throw new Error('Invalid backup file');
  }

  const dbInstance = await openDB();
  const stores = ['tasks', 'templates', 'settings', 'holidays', 'meta', 'debug'];

  await Promise.all(
    stores.map(storeName => {
      return new Promise(resolve => {
        const tx = dbInstance.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        store.clear().onsuccess = () => {
          const entries = data[storeName] || [];
          entries.forEach(entry => store.put(entry));
          resolve();
        };
      });
    })
  );
}

export {
  POINTS_PER_TASK,
  LEVELS,
  getSettings,
  setSettings,
  getAccent,
  setAccent,
  getDebugEnabled,
  setDebugEnabled,
  debugLog,
  getDebugLog,
  clearDebugLog,
  getTasksForDate,
  addTask,
  updateTaskTitle,
  deleteTask,
  toggleTaskDone,
  reorderTasks,
  getTemplates,
  addTemplate,
  updateTemplate,
  deleteTemplate,
  templatesForDate,
  getStartOfDayCandidates,
  getCustomHolidays,
  addCustomHoliday,
  updateCustomHoliday,
  deleteCustomHoliday,
  exportBackupJSON,
  importBackupJSON
};
