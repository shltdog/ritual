// Ritual V3 — today.js (FINAL date-aware)
// - Renders selected date from localStorage (set by calendar)
// - Past: edit/delete allowed, NO complete toggle
// - Future: add/edit/reorder allowed, NO complete toggle
// - Today: full control
// - Long-press: Edit/Delete/Duplicate

import {
  todayKey,
  getTasksForDate,
  addTask,
  toggleTaskDone,
  deleteTask,
  duplicateTask,
  updateTaskTitle
} from "./store.js";

const ACTIVE_DATE_KEY = "ritual_active_date";

function getActiveDateKey() {
  return localStorage.getItem(ACTIVE_DATE_KEY) || todayKey();
}

function setActiveDateKey(k) {
  localStorage.setItem(ACTIVE_DATE_KEY, k);
}

function dateCmp(a, b) {
  return new Date(a + "T12:00:00").getTime() - new Date(b + "T12:00:00").getTime();
}

export async function renderToday(rootEl) {
  const key = getActiveDateKey();
  const tKey = todayKey();

  const mode =
    dateCmp(key, tKey) < 0 ? "past" :
    dateCmp(key, tKey) > 0 ? "future" :
    "today";

  const canComplete = (mode === "today");
  const canAdd = (mode !== "past");           // past: no adding
  const canEditDelete = true;                 // always allowed
  const tasks = await getTasksForDate(key);

  const doneCount = tasks.filter(t => t.done).length;

  rootEl.innerHTML = `
    <div class="card card--hero">
      <div class="row between">
        <div>
          <div class="h2">${mode === "today" ? "Today" : (mode === "future" ? "Future Day" : "Past Day")}</div>
          <div class="muted small">Date: <b>${key}</b> • ${doneCount}/${tasks.length} done</div>
        </div>
        <button class="iconbtn" id="btnBackToToday" type="button" title="Jump to today">↺</button>
      </div>

      <div class="divider"></div>

      <div class="row">
        <input class="input" id="tAddInput" placeholder="${canAdd ? "Add a task…" : "Past day (no adding)"}" ${canAdd ? "" : "disabled"} />
        <button class="btn btn--primary" id="tAddBtn" type="button" ${canAdd ? "" : "disabled"}>Add</button>
      </div>

      <div class="row" style="flex-wrap:wrap; gap:8px; margin-top:10px;">
        <span class="pill">${mode.toUpperCase()}</span>
        <span class="pill">${canComplete ? "Tap to complete" : "No completing"}</span>
        <span class="pill">Long-press: Edit/Delete/Dup</span>
      </div>
    </div>

    <div class="card grow">
      <div class="h2">Tasks</div>
      <div class="muted small">
        ${mode === "past"
          ? "Past day: edit/delete only."
          : (mode === "future" ? "Future day: plan tasks. No completing early." : "Tap a task to complete.")}
      </div>
      <div class="divider"></div>

      <div id="tList">
        ${tasks.length ? tasks.map(t => taskRowHTML(t, canComplete)).join("") : `<div class="muted">No tasks for this day.</div>`}
      </div>
    </div>
  `;

  // Jump back to today (and set active date to today)
  rootEl.querySelector("#btnBackToToday").addEventListener("click", async () => {
    setActiveDateKey(todayKey());
    await renderToday(rootEl);
  });

  // Add task
  const inp = rootEl.querySelector("#tAddInput");
  const addBtn = rootEl.querySelector("#tAddBtn");

  async function doAdd() {
    await addTask(key, inp.value);
    inp.value = "";
    await renderToday(rootEl);
  }

  addBtn.addEventListener("click", doAdd);
  inp.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doAdd();
  });

  // Row interactions: tap to toggle (today only), long-press menu always
  wireRows(rootEl, key, canComplete, canEditDelete);
}

function taskRowHTML(t, canToggle) {
  const chk = t.done ? "✓" : "";
  return `
    <div class="taskrow ${t.done ? "done" : ""}" data-id="${t.id}">
      <div class="taskleft">
        <div class="chk">${chk}</div>
        <div class="tTitle">${escapeHTML(t.title)}</div>
      </div>
      <div class="handle">☰</div>
    </div>
  `;
}

function wireRows(rootEl, dateKey, canComplete, canEditDelete) {
  const rows = rootEl.querySelectorAll(".taskrow");
  rows.forEach(row => {
    const id = row.getAttribute("data-id");

    // Tap toggles done only if today
    row.addEventListener("click", async (e) => {
      if (e.target.closest(".handle")) return;
      if (!canComplete) return;
      await toggleTaskDone(id);
      await renderToday(rootEl);
    });

    // Long-press menu (Edit/Delete/Duplicate)
    let timer = null;
    row.addEventListener("touchstart", () => {
      timer = setTimeout(async () => {
        if (!canEditDelete) return;

        const choice = prompt("Type: edit / delete / dup", "edit");
        if (!choice) return;

        const c = choice.toLowerCase();

        if (c.startsWith("del")) {
          await deleteTask(id);
          await renderToday(rootEl);
          return;
        }

        if (c.startsWith("dup")) {
          await duplicateTask(id);
          await renderToday(rootEl);
          return;
        }

        if (c.startsWith("edit")) {
          const current = row.querySelector(".tTitle")?.textContent || "";
          const newTitle = prompt("Edit task title:", current);
          if (newTitle != null) {
            await updateTaskTitle(id, newTitle);
            await renderToday(rootEl);
          }
          return;
        }
      }, 450);
    }, { passive: true });

    row.addEventListener("touchend", () => clearTimeout(timer));
    row.addEventListener("touchmove", () => clearTimeout(timer));
  });
}

function escapeHTML(s) {
  return (s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}