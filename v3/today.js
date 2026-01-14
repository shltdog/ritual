// Ritual V3 — today.js
// Renders Today screen (Phase B): add, toggle, delete, duplicate, long-press menu

import {
  todayKey,
  getTasksForDate,
  addTask,
  toggleTaskDone,
  deleteTask,
  duplicateTask,
  updateTaskTitle
} from "./store.js";

export async function renderToday(rootEl) {
  const key = todayKey();
  const tasks = await getTasksForDate(key);

  rootEl.innerHTML = `
    <div class="card card--hero">
      <div class="h2">Today</div>
      <div class="muted small">Date: ${key} • ${tasks.filter(t=>t.done).length}/${tasks.length} done</div>
      <div class="divider"></div>

      <div class="row">
        <input class="input" id="tAddInput" placeholder="Add a task…" />
        <button class="btn btn--primary" id="tAddBtn">Add</button>
      </div>
    </div>

    <div class="card grow">
      <div class="h2">Tasks</div>
      <div class="muted small">Tap to toggle done. Long-press for Edit/Delete/Duplicate.</div>
      <div class="divider"></div>
      <div id="tList"></div>
    </div>
  `;

  const listEl = rootEl.querySelector("#tList");
  if (!tasks.length) {
    listEl.innerHTML = `<div class="muted">No tasks yet.</div>`;
  } else {
    listEl.innerHTML = tasks.map(t => taskRowHTML(t)).join("");
  }

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

  // Row interactions
  wireRows(rootEl);
}

function taskRowHTML(t) {
  return `
    <div class="taskrow ${t.done ? "done" : ""}" data-id="${t.id}">
      <div class="taskleft">
        <div class="chk">${t.done ? "✓" : ""}</div>
        <div class="tTitle">${escapeHTML(t.title)}</div>
      </div>
      <div class="handle">☰</div>
    </div>
  `;
}

function wireRows(rootEl) {
  const rows = rootEl.querySelectorAll(".taskrow");
  rows.forEach(row => {
    const id = row.getAttribute("data-id");

    // Tap toggles done
    row.addEventListener("click", async (e) => {
      // ignore clicks on handle (future drag)
      if (e.target.closest(".handle")) return;
      await toggleTaskDone(id);
      await renderToday(rootEl);
    });

    // Long press menu (simple prompt for now; we’ll replace with a real sheet later)
    let timer = null;

    row.addEventListener("touchstart", () => {
      timer = setTimeout(async () => {
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
