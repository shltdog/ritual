// Ritual V3 — Store (Tasks + Settings)
// Phase B: Today tasks only (per-date). Done sinks. Persistent via IndexedDB.

import { dbGet, dbPut, dbDelete, dbGetAllByIndex, STORES_CONST } from "./db.js";

const SCHEMA_VERSION = 3;
const POINTS_PER_TASK = 10;

function pad2(n) { return String(n).padStart(2, "0"); }
export function dateKeyFromDate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
export function todayKey() { return dateKeyFromDate(new Date()); }

export function uuid() {
  // simple UUID-ish (fine for personal use)
  return crypto.randomUUID ? crypto.randomUUID() :
    "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function nowISO() { return new Date().toISOString(); }

export async function loadSettings() {
  const row = await dbGet(STORES_CONST.settings, "app");
  if (row) return row.value;

  const defaults = {
    schemaVersion: SCHEMA_VERSION,
    themeId: "ember",
    lastExportAt: null,
    pointsPerTask: POINTS_PER_TASK,
  };
  await dbPut(STORES_CONST.settings, { key: "app", value: defaults });
  return defaults;
}

export async function saveSettings(partial) {
  const cur = await loadSettings();
  const next = { ...cur, ...partial, schemaVersion: SCHEMA_VERSION };
  await dbPut(STORES_CONST.settings, { key: "app", value: next });
  return next;
}

export async function getTasksForDate(dateKey) {
  const tasks = await dbGetAllByIndex(STORES_CONST.tasks, "dateKey", dateKey);
  // sort: unfinished first, then finished; within each by orderKey
  tasks.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return (a.orderKey || "").localeCompare(b.orderKey || "");
  });
  return tasks;
}

function nextOrderKey(existing) {
  // simple orderKey: base36 increment (works fine for now)
  // If empty list -> "0001"
  if (!existing.length) return "0001";
  const last = existing[existing.length - 1];
  const cur = parseInt(last.orderKey || "1", 36);
  const next = (cur + 1).toString(36);
  return next.padStart(4, "0");
}

export async function addTask(dateKey, title) {
  const t = title.trim();
  if (!t) return null;

  const existing = await getTasksForDate(dateKey);
  const orderKey = nextOrderKey(existing.filter(x => !x.done).concat(existing.filter(x => x.done)));

  const task = {
    id: uuid(),
    dateKey,
    title: t,
    done: false,
    orderKey,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  };

  await dbPut(STORES_CONST.tasks, task);
  return task;
}

export async function updateTaskTitle(id, newTitle) {
  const t = newTitle.trim();
  if (!t) return null;

  const task = await dbGet(STORES_CONST.tasks, id);
  if (!task) return null;

  task.title = t;
  task.updatedAt = nowISO();
  await dbPut(STORES_CONST.tasks, task);
  return task;
}

export async function toggleDone(id) {
  const task = await dbGet(STORES_CONST.tasks, id);
  if (!task) return null;

  task.done = !task.done;
  task.updatedAt = nowISO();
  await dbPut(STORES_CONST.tasks, task);
  return task;
}

export async function deleteTaskById(id) {
  await dbDelete(STORES_CONST.tasks, id);
  return true;
}

export async function duplicateTask(id) {
  const task = await dbGet(STORES_CONST.tasks, id);
  if (!task) return null;
  return addTask(task.dateKey, task.title);
}

// Reorder within the SAME done-status group only (Swift-like feel):
// - Undone tasks reorder among undone
// - Done tasks stay at bottom, reorder among done
export async function reorderTasks(dateKey, orderedIds) {
  const tasks = await getTasksForDate(dateKey);
  const byId = new Map(tasks.map(t => [t.id, t]));

  // build new order list based on orderedIds (only those present)
  let orderCounter = 1;
  for (const id of orderedIds) {
    const t = byId.get(id);
    if (!t) continue;
    t.orderKey = orderCounter.toString(36).padStart(4, "0");
    t.updatedAt = nowISO();
    orderCounter++;
    await dbPut(STORES_CONST.tasks, t);
  }
}

// Backup export (JSON download)
export async function exportBackup() {
  const settings = await loadSettings();

  // tasks: get all tasks by scanning dates is expensive; simplest: use getAll via index workaround
  // We'll open DB and read all records from tasks store using a cursor.
  const allTasks = await getAllTasks();

  const payload = {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: nowISO(),
    settings,
    tasks: allTasks,
    templates: [], // Phase C
  };

  return payload;
}

async function getAllTasks() {
  const db = await (await import("./db.js")).dbGetAllByIndex; // not used
  // Manual full scan via indexedDB
  const { STORES_CONST: S } = await import("./db.js");
  const open = (await import("./db.js")).default;
  // fallback: implement quick scan without depending on default exports
  // We'll just open directly here:
  const DB_NAME = "ritual_v3";
  const DB_VERSION = 1;

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onsuccess = () => {
      const dbi = req.result;
      const tx = dbi.transaction(S.tasks, "readonly");
      const store = tx.objectStore(S.tasks);
      const out = [];
      const cur = store.openCursor();
      cur.onsuccess = () => {
        const c = cur.result;
        if (c) {
          out.push(c.value);
          c.continue();
        } else {
          resolve(out);
        }
      };
      cur.onerror = () => reject(cur.error);
    };
    req.onerror = () => reject(req.error);
  });
}
