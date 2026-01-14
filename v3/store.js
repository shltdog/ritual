// Ritual V3 — Store (Tasks + Settings)
// Fixed: uses idb* functions + DB.stores from db.js (no STORES_CONST needed)

import { DB, idbGet, idbPut, idbDelete, idbGetAll, idbGetAllByIndex } from "./db.js";

export const SCHEMA_VERSION = 3;
export const POINTS_PER_TASK = 10;

function pad2(n) { return String(n).padStart(2, "0"); }

export function dateKeyFromDate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
export function todayKey() { return dateKeyFromDate(new Date()); }

export function uuid() {
  return crypto.randomUUID ? crypto.randomUUID()
    : "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function nowISO() { return new Date().toISOString(); }

// -------------------- SETTINGS --------------------

export async function getSettings() {
  const row = await idbGet(DB.stores.settings, "app");
  if (row?.value) return row.value;

  const defaults = {
    schemaVersion: SCHEMA_VERSION,
    themeId: "ember",
    lastExportAt: null,
    pointsPerTask: POINTS_PER_TASK,
  };
  await idbPut(DB.stores.settings, { key: "app", value: defaults });
  return defaults;
}

export async function setSettings(partial) {
  const cur = await getSettings();
  const next = { ...cur, ...partial, schemaVersion: SCHEMA_VERSION };
  await idbPut(DB.stores.settings, { key: "app", value: next });
  return next;
}

// -------------------- TASKS --------------------

export async function getTasksForDate(dateKey) {
  const tasks = await idbGetAllByIndex(DB.stores.tasks, "dateKey", dateKey);

  // sort: undone first, then done; within group by orderKey
  tasks.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return (a.orderKey || "").localeCompare(b.orderKey || "");
  });

  return tasks;
}

function nextOrderKey(existing) {
  if (!existing.length) return "0001";
  const last = existing[existing.length - 1];
  const cur = parseInt(last.orderKey || "1", 36);
  const next = (cur + 1).toString(36);
  return next.padStart(4, "0");
}

export async function addTask(dateKey, title) {
  const t = (title || "").trim();
  if (!t) return null;

  const existing = await getTasksForDate(dateKey);
  const orderKey = nextOrderKey(existing);

  const task = {
    id: uuid(),
    dateKey,
    title: t,
    done: false,
    orderKey,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  };

  await idbPut(DB.stores.tasks, task);
  return task;
}

export async function updateTaskTitle(id, newTitle) {
  const t = (newTitle || "").trim();
  if (!t) return null;

  const task = await idbGet(DB.stores.tasks, id);
  if (!task) return null;

  task.title = t;
  task.updatedAt = nowISO();
  await idbPut(DB.stores.tasks, task);
  return task;
}

export async function toggleTaskDone(id) {
  const task = await idbGet(DB.stores.tasks, id);
  if (!task) return null;

  task.done = !task.done;
  task.updatedAt = nowISO();
  await idbPut(DB.stores.tasks, task);
  return task;
}

export async function deleteTask(id) {
  await idbDelete(DB.stores.tasks, id);
  return true;
}

export async function duplicateTask(id) {
  const task = await idbGet(DB.stores.tasks, id);
  if (!task) return null;
  return addTask(task.dateKey, task.title);
}

export async function reorderTasks(dateKey, orderedIds) {
  const tasks = await getTasksForDate(dateKey);
  const byId = new Map(tasks.map(t => [t.id, t]));

  let orderCounter = 1;
  for (const id of orderedIds) {
    const t = byId.get(id);
    if (!t) continue;
    t.orderKey = orderCounter.toString(36).padStart(4, "0");
    t.updatedAt = nowISO();
    orderCounter++;
    await idbPut(DB.stores.tasks, t);
  }
}

// -------------------- BACKUP --------------------

export async function buildBackupPayload() {
  const settings = await getSettings();
  const tasks = await idbGetAll(DB.stores.tasks);
  const templates = await idbGetAll(DB.stores.templates);

  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: nowISO(),
    settings,
    tasks,
    templates,
  };
}

export function downloadJSON(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}
