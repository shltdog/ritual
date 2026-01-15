// Ritual V3 — store.js (RC1 FOUNDATION)
// Offline-first IndexedDB data layer + backup/import + custom holidays + debug log.
// This file is designed to be the single source of truth for data APIs used by all screens.

// ===============================
// Constants
// ===============================
export const APP_NAME = "Ritual";
export const APP_VERSION = "V3";
export const SCHEMA_VERSION = 2;

export const ACTIVE_DATE_KEY = "ritual_active_date"; // used by calendar/day-detail

export const STORES = {
  TASKS: "tasks",
  TEMPLATES: "templates",
  SETTINGS: "settings",
  HOLIDAYS: "holidays", // custom holidays
  META: "meta",         // lastPromptDate, etc
  DEBUG: "debug"        // debug log + flags
};

const DB_NAME = "ritual_v3";

// ===============================
// Date helpers
// ===============================
export function dateKeyFromDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayKey() {
  return dateKeyFromDate(new Date());
}

export function isValidDateKey(k) {
  return /^\d{4}-\d{2}-\d{2}$/.test(k);
}

export function cmpDateKey(a, b) {
  return new Date(a + "T12:00:00").getTime() - new Date(b + "T12:00:00").getTime();
}

// ===============================
// IndexedDB core
// ===============================
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, SCHEMA_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;

      // TASKS
      if (!db.objectStoreNames.contains(STORES.TASKS)) {
        const s = db.createObjectStore(STORES.TASKS, { keyPath: "id" });
        s.createIndex("by_date", "dateKey", { unique: false });
        s.createIndex("by_date_sort", ["dateKey", "sort"], { unique: false });
      } else {
        const s = req.transaction.objectStore(STORES.TASKS);
        if (!s.indexNames.contains("by_date")) s.createIndex("by_date", "dateKey", { unique: false });
        if (!s.indexNames.contains("by_date_sort")) s.createIndex("by_date_sort", ["dateKey", "sort"], { unique: false });
      }

      // TEMPLATES
      if (!db.objectStoreNames.contains(STORES.TEMPLATES)) {
        const s = db.createObjectStore(STORES.TEMPLATES, { keyPath: "id" });
        s.createIndex("by_enabled", "enabled", { unique: false });
      }

      // SETTINGS (single doc, keyPath = id)
      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        db.createObjectStore(STORES.SETTINGS, { keyPath: "id" });
      }

      // HOLIDAYS (custom)
      if (!db.objectStoreNames.contains(STORES.HOLIDAYS)) {
        const s = db.createObjectStore(STORES.HOLIDAYS, { keyPath: "id" });
        s.createIndex("by_date", "dateKey", { unique: false });
      }

      // META
      if (!db.objectStoreNames.contains(STORES.META)) {
        db.createObjectStore(STORES.META, { keyPath: "id" });
      }

      // DEBUG
      if (!db.objectStoreNames.contains(STORES.DEBUG)) {
        db.createObjectStore(STORES.DEBUG, { keyPath: "id" });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, storeName, mode = "readonly") {
  return db.transaction(storeName, mode).objectStore(storeName);
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withDB(fn) {
  const db = await openDB();
  try {
    return await fn(db);
  } finally {
    db.close();
  }
}

function uid() {
  return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}

// ===============================
// Task model helpers
// ===============================
function normalizeTitle(t) {
  return String(t || "").trim().replace(/\s+/g, " ");
}

async function nextSortForDate(db, dateKey) {
  // Find max sort for dateKey, then +1
  const store = tx(db, STORES.TASKS, "readonly");
  const idx = store.index("by_date_sort");
  const range = IDBKeyRange.bound([dateKey, -Infinity], [dateKey, Infinity]);
  const all = await reqToPromise(idx.getAll(range));
  let max = -1;
  for (const t of all) max = Math.max(max, Number(t.sort ?? 0));
  return max + 1;
}

function sinkDone(list) {
  const undone = list.filter(t => !t.done);
  const done = list.filter(t => t.done);
  return [...undone, ...done];
}

// ===============================
// TASKS API
// ===============================
export async function getTasksForDate(dateKey) {
  if (!isValidDateKey(dateKey)) return [];
  return withDB(async (db) => {
    const store = tx(db, STORES.TASKS, "readonly");
    const idx = store.index("by_date_sort");
    const range = IDBKeyRange.bound([dateKey, -Infinity], [dateKey, Infinity]);
    const rows = await reqToPromise(idx.getAll(range));
    // Always present in “sink done” order for UI consistency
    return sinkDone(rows).map(cleanTask);
  });
}

export async function addTask(dateKey, title) {
  if (!isValidDateKey(dateKey)) throw new Error("Invalid dateKey");
  const t = normalizeTitle(title);
  if (!t) return null;

  return withDB(async (db) => {
    const sort = await nextSortForDate(db, dateKey);
    const task = {
      id: uid(),
      dateKey,
      title: t,
      done: false,
      sort,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    const store = tx(db, STORES.TASKS, "readwrite");
    await reqToPromise(store.put(task));
    await debugLog(`addTask ${dateKey} "${t}"`);
    return cleanTask(task);
  });
}

export async function toggleTaskDone(taskId) {
  return withDB(async (db) => {
    const store = tx(db, STORES.TASKS, "readwrite");
    const task = await reqToPromise(store.get(taskId));
    if (!task) return null;
    task.done = !task.done;
    task.updatedAt = Date.now();
    await reqToPromise(store.put(task));
    await debugLog(`toggleDone ${task.id} -> ${task.done}`);
    return cleanTask(task);
  });
}

export async function setTaskDone(taskId, done) {
  return withDB(async (db) => {
    const store = tx(db, STORES.TASKS, "readwrite");
    const task = await reqToPromise(store.get(taskId));
    if (!task) return null;
    task.done = !!done;
    task.updatedAt = Date.now();
    await reqToPromise(store.put(task));
    await debugLog(`setDone ${task.id} -> ${task.done}`);
    return cleanTask(task);
  });
}

export async function updateTaskTitle(taskId, newTitle) {
  const t = normalizeTitle(newTitle);
  if (!t) return null;

  return withDB(async (db) => {
    const store = tx(db, STORES.TASKS, "readwrite");
    const task = await reqToPromise(store.get(taskId));
    if (!task) return null;
    task.title = t;
    task.updatedAt = Date.now();
    await reqToPromise(store.put(task));
    await debugLog(`editTitle ${task.id}`);
    return cleanTask(task);
  });
}

export async function deleteTask(taskId) {
  return withDB(async (db) => {
    const store = tx(db, STORES.TASKS, "readwrite");
    await reqToPromise(store.delete(taskId));
    await debugLog(`deleteTask ${taskId}`);
    return true;
  });
}

// Duplicate within same day OR to today
export async function duplicateTask(taskId, targetDateKey = null) {
  return withDB(async (db) => {
    const store = tx(db, STORES.TASKS, "readwrite");
    const task = await reqToPromise(store.get(taskId));
    if (!task) return null;

    const dateKey = targetDateKey && isValidDateKey(targetDateKey) ? targetDateKey : task.dateKey;
    const sort = await nextSortForDate(db, dateKey);

    const clone = {
      ...task,
      id: uid(),
      dateKey,
      done: false,
      sort,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await reqToPromise(store.put(clone));
    await debugLog(`duplicateTask ${taskId} -> ${clone.id} (${dateKey})`);
    return cleanTask(clone);
  });
}

// Reorder: orderedIds is an array of task IDs (for that date only)
// We preserve relative order; done-sink is applied in UI layer by default.
export async function reorderTasks(dateKey, orderedIds) {
  if (!isValidDateKey(dateKey)) return false;
  return withDB(async (db) => {
    const store = tx(db, STORES.TASKS, "readwrite");
    const existing = await getTasksForDate(dateKey);
    const map = new Map(existing.map(t => [t.id, t]));
    let sort = 0;

    for (const id of orderedIds) {
      const t = map.get(id);
      if (!t) continue;
      const raw = await reqToPromise(store.get(id));
      if (!raw) continue;
      raw.sort = sort++;
      raw.updatedAt = Date.now();
      await reqToPromise(store.put(raw));
    }

    // Any tasks not included keep their previous order after the list
    for (const t of existing) {
      if (orderedIds.includes(t.id)) continue;
      const raw = await reqToPromise(store.get(t.id));
      if (!raw) continue;
      raw.sort = sort++;
      raw.updatedAt = Date.now();
      await reqToPromise(store.put(raw));
    }

    await debugLog(`reorderTasks ${dateKey}`);
    return true;
  });
}

function cleanTask(t) {
  return {
    id: t.id,
    dateKey: t.dateKey,
    title: t.title,
    done: !!t.done,
    sort: Number(t.sort ?? 0),
    createdAt: t.createdAt,
    updatedAt: t.updatedAt
  };
}

// ===============================
// TEMPLATES API (Recurring)
// recurrence:
// { type:"daily" } OR { type:"weekly", weekday:0..6 } (0=Sun)
export async function getTemplates() {
  return withDB(async (db) => {
    const store = tx(db, STORES.TEMPLATES, "readonly");
    const rows = await reqToPromise(store.getAll());
    return rows.map(t => ({
      id: t.id,
      title: t.title,
      enabled: !!t.enabled,
      recurrence: t.recurrence
    }));
  });
}

export async function addTemplate({ title, recurrence, enabled = true }) {
  const t = normalizeTitle(title);
  if (!t) return null;
  const rec = normalizeRecurrence(recurrence);

  return withDB(async (db) => {
    const store = tx(db, STORES.TEMPLATES, "readwrite");
    const row = { id: uid(), title: t, enabled: !!enabled, recurrence: rec, createdAt: Date.now(), updatedAt: Date.now() };
    await reqToPromise(store.put(row));
    await debugLog(`addTemplate "${t}"`);
    return row;
  });
}

export async function updateTemplate(id, patch) {
  return withDB(async (db) => {
    const store = tx(db, STORES.TEMPLATES, "readwrite");
    const row = await reqToPromise(store.get(id));
    if (!row) return null;

    if (patch.title != null) row.title = normalizeTitle(patch.title);
    if (patch.enabled != null) row.enabled = !!patch.enabled;
    if (patch.recurrence != null) row.recurrence = normalizeRecurrence(patch.recurrence);

    row.updatedAt = Date.now();
    await reqToPromise(store.put(row));
    await debugLog(`updateTemplate ${id}`);
    return row;
  });
}

export async function deleteTemplate(id) {
  return withDB(async (db) => {
    const store = tx(db, STORES.TEMPLATES, "readwrite");
    await reqToPromise(store.delete(id));
    await debugLog(`deleteTemplate ${id}`);
    return true;
  });
}

function normalizeRecurrence(r) {
  if (!r || typeof r !== "object") return { type: "daily" };
  if (r.type === "weekly") {
    const wd = Number(r.weekday);
    return { type: "weekly", weekday: Number.isFinite(wd) ? Math.max(0, Math.min(6, wd)) : 0 };
  }
  return { type: "daily" };
}

// Apply templates to dateKey (idempotent by title match)
export async function applyTemplatesToDate(dateKey) {
  if (!isValidDateKey(dateKey)) return { added: 0 };

  const templates = await getTemplates();
  const enabled = templates.filter(t => t.enabled);

  const d = new Date(dateKey + "T12:00:00");
  const weekday = d.getDay(); // 0..6

  const existing = await getTasksForDate(dateKey);
  const existingNorm = new Set(existing.map(t => normalizeTitle(t.title).toLowerCase()));

  let added = 0;
  for (const tpl of enabled) {
    const rec = tpl.recurrence || { type: "daily" };
    const applies =
      rec.type === "daily" ||
      (rec.type === "weekly" && Number(rec.weekday) === weekday);

    if (!applies) continue;

    const norm = normalizeTitle(tpl.title).toLowerCase();
    if (!norm) continue;
    if (existingNorm.has(norm)) continue;

    await addTask(dateKey, tpl.title);
    added++;
  }

  return { added };
}

// daily prompt meta
export async function getLastRecurringPromptDate() {
  return withDB(async (db) => {
    const store = tx(db, STORES.META, "readonly");
    const row = await reqToPromise(store.get("lastRecurringPromptDate"));
    return row?.value || "";
  });
}

export async function setLastRecurringPromptDate(dateKey) {
  return withDB(async (db) => {
    const store = tx(db, STORES.META, "readwrite");
    await reqToPromise(store.put({ id: "lastRecurringPromptDate", value: dateKey, updatedAt: Date.now() }));
    return true;
  });
}

// ===============================
// SETTINGS API (accent color + flags)
// ===============================
const DEFAULT_SETTINGS = {
  accent: "red",          // string key; UI maps to actual color
  debugEnabled: false
};

export async function getSettings() {
  return withDB(async (db) => {
    const store = tx(db, STORES.SETTINGS, "readonly");
    const row = await reqToPromise(store.get("settings"));
    return { ...DEFAULT_SETTINGS, ...(row?.value || {}) };
  });
}

export async function setSettings(patch) {
  return withDB(async (db) => {
    const store = tx(db, STORES.SETTINGS, "readwrite");
    const current = await getSettings();
    const next = { ...current, ...(patch || {}) };
    await reqToPromise(store.put({ id: "settings", value: next, updatedAt: Date.now() }));
    await debugLog(`setSettings`);
    return next;
  });
}

export async function setAccent(accentKey) {
  return setSettings({ accent: String(accentKey || "red") });
}

export async function setDebugEnabled(on) {
  return setSettings({ debugEnabled: !!on });
}

// ===============================
// CUSTOM HOLIDAYS API (pink dot)
// ===============================
// holiday: {id, dateKey, name}
export async function getCustomHolidays() {
  return withDB(async (db) => {
    const store = tx(db, STORES.HOLIDAYS, "readonly");
    const rows = await reqToPromise(store.getAll());
    return rows.map(h => ({ id: h.id, dateKey: h.dateKey, name: h.name }));
  });
}

export async function getCustomHolidaysForYear(year) {
  const all = await getCustomHolidays();
  return all.filter(h => h.dateKey.startsWith(String(year) + "-"));
}

export async function addCustomHoliday(dateKey, name) {
  if (!isValidDateKey(dateKey)) return null;
  const n = normalizeTitle(name);
  if (!n) return null;

  return withDB(async (db) => {
    const store = tx(db, STORES.HOLIDAYS, "readwrite");
    const row = { id: uid(), dateKey, name: n, createdAt: Date.now(), updatedAt: Date.now() };
    await reqToPromise(store.put(row));
    await debugLog(`addCustomHoliday ${dateKey} "${n}"`);
    return row;
  });
}

export async function deleteCustomHoliday(id) {
  return withDB(async (db) => {
    const store = tx(db, STORES.HOLIDAYS, "readwrite");
    await reqToPromise(store.delete(id));
    await debugLog(`deleteCustomHoliday ${id}`);
    return true;
  });
}

export async function updateCustomHoliday(id, patch) {
  return withDB(async (db) => {
    const store = tx(db, STORES.HOLIDAYS, "readwrite");
    const row = await reqToPromise(store.get(id));
    if (!row) return null;

    if (patch.dateKey != null && isValidDateKey(patch.dateKey)) row.dateKey = patch.dateKey;
    if (patch.name != null) row.name = normalizeTitle(patch.name);

    row.updatedAt = Date.now();
    await reqToPromise(store.put(row));
    await debugLog(`updateCustomHoliday ${id}`);
    return row;
  });
}

// ===============================
// BACKUP EXPORT / IMPORT (R1 replace)
// ===============================
export async function exportBackupJSON() {
  const settings = await getSettings();
  const tasks = await withDB(async (db) => reqToPromise(tx(db, STORES.TASKS, "readonly").getAll()));
  const templates = await withDB(async (db) => reqToPromise(tx(db, STORES.TEMPLATES, "readonly").getAll()));
  const holidays = await withDB(async (db) => reqToPromise(tx(db, STORES.HOLIDAYS, "readonly").getAll()));
  const meta = await withDB(async (db) => reqToPromise(tx(db, STORES.META, "readonly").getAll()));

  const payload = {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    app: { name: APP_NAME, version: APP_VERSION },
    settings,
    tasks,
    templates,
    holidays,
    meta
  };

  return JSON.stringify(payload, null, 2);
}

export async function importBackupJSON(jsonText) {
  let data;
  try {
    data = JSON.parse(jsonText);
  } catch {
    throw new Error("Invalid JSON");
  }

  if (!data || typeof data !== "object") throw new Error("Invalid backup format");
  if (!data.tasks || !data.templates || !data.settings) throw new Error("Backup missing required sections");

  // Preview info returned to UI
  const preview = {
    exportedAt: data.exportedAt || "",
    taskCount: Array.isArray(data.tasks) ? data.tasks.length : 0,
    templateCount: Array.isArray(data.templates) ? data.templates.length : 0,
    holidayCount: Array.isArray(data.holidays) ? data.holidays.length : 0,
    schemaVersion: data.schemaVersion || 0
  };

  // R1: FULL REPLACE
  await withDB(async (db) => {
    // Clear all stores
    await Promise.all([
      clearStore(db, STORES.TASKS),
      clearStore(db, STORES.TEMPLATES),
      clearStore(db, STORES.SETTINGS),
      clearStore(db, STORES.HOLIDAYS),
      clearStore(db, STORES.META),
      clearStore(db, STORES.DEBUG)
    ]);

    // Restore settings
    await reqToPromise(tx(db, STORES.SETTINGS, "readwrite").put({ id: "settings", value: data.settings, updatedAt: Date.now() }));

    // Restore tasks/templates/holidays/meta
    if (Array.isArray(data.tasks)) {
      const s = tx(db, STORES.TASKS, "readwrite");
      for (const row of data.tasks) await reqToPromise(s.put(row));
    }

    if (Array.isArray(data.templates)) {
      const s = tx(db, STORES.TEMPLATES, "readwrite");
      for (const row of data.templates) await reqToPromise(s.put(row));
    }

    if (Array.isArray(data.holidays)) {
      const s = tx(db, STORES.HOLIDAYS, "readwrite");
      for (const row of data.holidays) await reqToPromise(s.put(row));
    }

    if (Array.isArray(data.meta)) {
      const s = tx(db, STORES.META, "readwrite");
      for (const row of data.meta) await reqToPromise(s.put(row));
    }

    // Restore debug flag if present
    await reqToPromise(tx(db, STORES.DEBUG, "readwrite").put({
      id: "debugEnabled",
      value: !!(data.settings && data.settings.debugEnabled),
      updatedAt: Date.now()
    }));

    // log
    await reqToPromise(tx(db, STORES.DEBUG, "readwrite").put({
      id: "log",
      value: [`[RESTORE] ${new Date().toISOString()} restored backup`],
      updatedAt: Date.now()
    }));
  });

  return preview;
}

async function clearStore(db, storeName) {
  const store = tx(db, storeName, "readwrite");
  await reqToPromise(store.clear());
}

// ===============================
// DEBUG LOG
// ===============================
export async function debugLog(msg) {
  const s = await getSettings();
  if (!s.debugEnabled) return;

  return withDB(async (db) => {
    const store = tx(db, STORES.DEBUG, "readwrite");
    const row = await reqToPromise(store.get("log"));
    const arr = Array.isArray(row?.value) ? row.value : [];
    arr.push(`[${new Date().toISOString()}] ${msg}`);
    // keep last 200 lines
    const trimmed = arr.slice(-200);
    await reqToPromise(store.put({ id: "log", value: trimmed, updatedAt: Date.now() }));
    return true;
  });
}

export async function getDebugLog() {
  return withDB(async (db) => {
    const store = tx(db, STORES.DEBUG, "readonly");
    const row = await reqToPromise(store.get("log"));
    return Array.isArray(row?.value) ? row.value : [];
  });
}

export async function clearDebugLog() {
  return withDB(async (db) => {
    const store = tx(db, STORES.DEBUG, "readwrite");
    await reqToPromise(store.put({ id: "log", value: [], updatedAt: Date.now() }));
    return true;
  });
}