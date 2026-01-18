// Ritual V3 — calendar.js (RC1)
// Calendar grid + US holidays (gold) + custom holidays (pink)
// Tap day -> Day Detail bottom sheet (X close only)
// Past: edit/delete/duplicate only (no add/import/complete/reorder)
// Today: full (add/import/complete/edit/delete/dup/reorder)
// Future: add/import/edit/delete/dup/reorder (no complete)

import {
  todayKey,
  dateKeyFromDate,
  getTasksForDate,
  addTask,
  deleteTask,
  updateTaskTitle,
  duplicateTask,
  toggleTaskDone,
  reorderTasks,
  getCustomHolidaysForYear
} from "./store.js";

let state = null;

// ---------- Public ----------
export async function renderCalendar(rootEl) {
  if (!state) {
    const now = new Date();
    state = {
      year: now.getFullYear(),
      month: now.getMonth(),
      selected: dateKeyFromDate(now)
    };
  }

  const st = state;
  const monthDate = new Date(st.year, st.month, 1);
  const tKey = todayKey();

  const usHolidayMap = getUSHolidayMap(st.year);
  const customHolidays = await getCustomHolidaysForYear(st.year);
  const customHolidayMap = new Map(customHolidays.map(h => [h.dateKey, h.name]));

  rootEl.innerHTML = `
    <div class="card card--hero">
      <div class="row between">
        <button class="iconbtn" id="calPrev" type="button">‹</button>

        <div style="text-align:center;">
          <div class="h2" style="margin:0;">${monthTitle(monthDate)}</div>
          <div class="muted small">Tap a day for details.</div>
        </div>

        <button class="iconbtn" id="calNext" type="button">›</button>
      </div>
    </div>

    <div class="card">
      <div id="calDow" style="display:grid;grid-template-columns:repeat(7,1fr);gap:8px;margin-bottom:10px;"></div>
      <div id="calGrid" style="display:grid;grid-template-columns:repeat(7,1fr);gap:8px;"></div>

      <div class="divider"></div>

      <div class="muted small" style="display:flex;gap:12px;flex-wrap:wrap;">
        <span><span style="display:inline-block;width:8px;height:8px;border-radius:99px;background:rgba(255,255,255,.55);margin-right:6px;"></span>Has tasks</span>
        <span><span style="display:inline-block;width:8px;height:8px;border-radius:99px;background:#fbbf24;margin-right:6px;"></span>US holiday</span>
        <span><span style="display:inline-block;width:8px;height:8px;border-radius:99px;background:#ec4899;margin-right:6px;"></span>Custom holiday</span>
      </div>
    </div>
  `;

  // Weekdays row
  const dow = ["S","M","T","W","T","F","S"];
  rootEl.querySelector("#calDow").innerHTML = dow
    .map(d => `<div class="muted small" style="text-align:center;font-weight:900;letter-spacing:.2px;">${d}</div>`)
    .join("");

  // Build month cells
  const cells = buildMonthGrid(st.year, st.month);
  const counts = await preloadTaskCounts(cells);

  const grid = rootEl.querySelector("#calGrid");
  grid.innerHTML = "";

  for (const c of cells) {
    if (!c) {
      grid.insertAdjacentHTML("beforeend", `<div style="height:44px;"></div>`);
      continue;
    }

    const key = dateKeyFromDate(c);
    const day = c.getDate();
    const isToday = key === tKey;
    const isSelected = key === st.selected;

    const taskCount = counts[key] || 0;
    const hasTasks = taskCount > 0;

    const usName = usHolidayMap.get(key) || "";
    const customName = customHolidayMap.get(key) || "";

    const border = isSelected
      ? "border:1px solid color-mix(in oklab, var(--accent), #fff 25%);"
      : "border:1px solid rgba(255,255,255,.10);";

    const bg = isToday
      ? "background: color-mix(in oklab, var(--accent), transparent 86%);"
      : "background: rgba(255,255,255,.04);";

    const dotTasks = hasTasks ? `background:rgba(255,255,255,.55);` : `background:transparent;`;
    const dotUS = usName ? `background:#fbbf24;` : `background:transparent;`;
    const dotCustom = customName ? `background:#ec4899;` : `background:transparent;`;

    grid.insertAdjacentHTML("beforeend", `
      <button
        type="button"
        class="dayCell"
        data-key="${key}"
        style="
          height:44px;border-radius:14px;${border}${bg}
          color:var(--text);padding:8px 0;text-align:center;
          display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;
          touch-action:manipulation;
        "
        aria-label="${key}"
      >
        <div style="font-weight:900;line-height:1;">${day}</div>
        <div style="display:flex;gap:6px;align-items:center;justify-content:center;line-height:1;">
          <span style="width:6px;height:6px;border-radius:99px;display:inline-block;${dotTasks}"></span>
          <span style="width:6px;height:6px;border-radius:99px;display:inline-block;${dotUS}"></span>
          <span style="width:6px;height:6px;border-radius:99px;display:inline-block;${dotCustom}"></span>
        </div>
      </button>
    `);
  }

  // Day tap -> open sheet (no navigation away)
  grid.querySelectorAll(".dayCell[data-key]").forEach(btn => {
    const key = btn.getAttribute("data-key");
    const handler = async () => {
      state.selected = key;
      // quick border update
      grid.querySelectorAll(".dayCell").forEach(b => {
        const k = b.getAttribute("data-key");
        b.style.border = (k === key)
          ? "1px solid color-mix(in oklab, var(--accent), #fff 25%)"
          : "1px solid rgba(255,255,255,.10)";
      });

      await openDayDetailSheet(key, usHolidayMap.get(key) || "", customHolidayMap.get(key) || "");
    };

    btn.addEventListener("pointerup", handler);
    btn.addEventListener("touchend", (e) => { e.preventDefault(); handler(); }, { passive: false });
    btn.addEventListener("click", (e) => { e.preventDefault(); handler(); });
  });

  // Month nav
  rootEl.querySelector("#calPrev").onclick = async () => {
    const d = new Date(st.year, st.month - 1, 1);
    state.year = d.getFullYear();
    state.month = d.getMonth();
    await renderCalendar(rootEl);
  };

  rootEl.querySelector("#calNext").onclick = async () => {
    const d = new Date(st.year, st.month + 1, 1);
    state.year = d.getFullYear();
    state.month = d.getMonth();
    await renderCalendar(rootEl);
  };
}

// ---------- Day Detail Sheet (X close only) ----------
async function openDayDetailSheet(dateKey, usHolidayName, customHolidayName) {
  const mode = getDayMode(dateKey);
  const canComplete = (mode === "today");
  const canAddImport = (mode !== "past");
  const canReorder = (mode !== "past");

  const tasks = await getTasksForDate(dateKey);
  const doneCount = tasks.filter(t => t.done).length;
  const score = doneCount * 10;

  const holidayLine = formatHolidayLine(usHolidayName, customHolidayName);

  const host = getSheetHost();
  host.innerHTML = `
    <div class="sheetBackdrop"></div>

    <div class="sheetPanel">
      <div class="sheetHeader">
        <div>
          <div class="sheetTitle">${prettyDate(dateKey)}</div>
          <div class="muted small">${dateKey} • <b>${mode.toUpperCase()}</b>${holidayLine ? ` • ${escapeHTML(holidayLine)}` : ""}</div>
        </div>
        <button class="iconbtn" id="sheetClose" type="button">✕</button>
      </div>

      <div class="divider"></div>

      <div class="muted small">
        Total: <b>${tasks.length}</b> • Done: <b>${doneCount}</b> • Score: <b>${score}</b>
      </div>

      <div class="divider"></div>

      <div class="muted small" style="margin-bottom:8px;">
        ${mode === "past"
          ? "Past day: edit/delete/duplicate only. Completion locked."
          : mode === "future"
            ? "Future day: plan tasks. Completion locked."
            : "Today: full control."}
      </div>

      <div class="dayTasks" id="dayTasks">
        ${tasks.length ? tasks.map(t => dayTaskRow(t, canComplete)).join("") : `<div class="muted">No tasks for this day.</div>`}
      </div>

      <div class="divider"></div>

      <div class="sheetFooter">
        ${canAddImport ? `
          <button class="btn btn--primary" id="btnAdd">Add</button>
          <button class="btn" id="btnImport">Import</button>
        ` : ``}
        ${canReorder ? `<button class="btn" id="btnReorder">Reorder</button>` : ``}
        <button class="btn" id="btnClose2">Close</button>
      </div>
    </div>
  `;

  // Close = X only + explicit Close button
  host.querySelector("#sheetClose").onclick = closeSheet;
  host.querySelector("#btnClose2").onclick = closeSheet;

  // Prevent backdrop close (per your 1B)
  host.querySelector(".sheetBackdrop").onclick = () => { /* do nothing */ };

  // Wire tasks
  wireDayTaskInteractions(host, dateKey, mode);

  // Add / Import
  if (canAddImport) {
    host.querySelector("#btnAdd").onclick = () => openAddTaskSheet(dateKey);
    host.querySelector("#btnImport").onclick = () => openImportSheet(dateKey);
  }

  // Reorder (compact) via up/down mode (reliable on iOS web)
  if (canReorder) {
    host.querySelector("#btnReorder").onclick = () => openReorderSheet(dateKey);
  }

  // Ensure styles exist
  injectSheetStylesOnce();
}

function wireDayTaskInteractions(host, dateKey, mode) {
  const canComplete = (mode === "today");

  host.querySelectorAll(".dayTaskRow").forEach(row => {
    const id = row.getAttribute("data-id");

    // Tap checkbox area toggles done for TODAY only
    row.addEventListener("click", async (e) => {
      if (e.target.closest("button")) return;
      if (!canComplete) return;

      await toggleTaskDone(id);
      await refreshDaySheet(dateKey);
    });

    // Actions button opens action sheet (Edit/Delete/Dup)
    row.querySelector(".actBtn").onclick = () => openTaskActionSheet(dateKey, id);
  });
}

async function refreshDaySheet(dateKey) {
  // Re-open sheet for same day (simple + reliable)
  closeSheet();
  const year = Number(dateKey.slice(0,4));
  const us = getUSHolidayMap(year).get(dateKey) || "";
  const custom = (await getCustomHolidaysForYear(year)).find(h => h.dateKey === dateKey)?.name || "";
  await openDayDetailSheet(dateKey, us, custom);
}

// ---------- Task Row (compact) ----------
function dayTaskRow(t, canComplete) {
  return `
    <div class="dayTaskRow ${t.done ? "done" : ""}" data-id="${t.id}">
      <div class="dayLeft">
        <div class="dayChk">${t.done ? "✓" : ""}</div>
        <div class="dayTitle">${escapeHTML(t.title)}</div>
      </div>
      <button class="iconbtn actBtn" type="button" title="Actions">⋯</button>
    </div>
  `;
}

// ---------- Task Action Sheet ----------
async function openTaskActionSheet(dateKey, taskId) {
  const tasks = await getTasksForDate(dateKey);
  const t = tasks.find(x => x.id === taskId);
  if (!t) return;

  const host = getSheetHost();
  host.innerHTML = `
    <div class="sheetBackdrop"></div>

    <div class="sheetPanel">
      <div class="sheetHeader">
        <div>
          <div class="sheetTitle">Task</div>
          <div class="muted small">${escapeHTML(t.title)}</div>
        </div>
        <button class="iconbtn" id="sheetClose" type="button">✕</button>
      </div>

      <div class="divider"></div>

      <div class="sheetFooter" style="justify-content:flex-start; flex-wrap:wrap;">
        <button class="btn btn--primary" id="btnEdit">Edit</button>
        <button class="btn" id="btnDup">Duplicate</button>
        <button class="btn btn--danger" id="btnDel">Delete</button>
        <button class="btn" id="btnClose">Close</button>
      </div>
    </div>
  `;

  host.querySelector("#sheetClose").onclick = closeSheet;
  host.querySelector("#btnClose").onclick = closeSheet;
  host.querySelector(".sheetBackdrop").onclick = () => { /* no close */ };

  host.querySelector("#btnEdit").onclick = () => openEditTaskSheet(dateKey, taskId, t.title);

  host.querySelector("#btnDup").onclick = () => openDuplicateChoiceSheet(dateKey, taskId);

  host.querySelector("#btnDel").onclick = async () => {
    if (!confirm("Delete this task?")) return;
    await deleteTask(taskId);
    await refreshDaySheet(dateKey);
  };

  injectSheetStylesOnce();
}

function openEditTaskSheet(dateKey, taskId, currentTitle) {
  const host = getSheetHost();
  host.innerHTML = `
    <div class="sheetBackdrop"></div>

    <div class="sheetPanel">
      <div class="sheetHeader">
        <div>
          <div class="sheetTitle">Edit Task</div>
          <div class="muted small">Update the title</div>
        </div>
        <button class="iconbtn" id="sheetClose" type="button">✕</button>
      </div>

      <div class="divider"></div>

      <input class="input" id="editInput" value="${escapeAttr(currentTitle)}" />

      <div class="divider"></div>

      <div class="sheetFooter">
        <button class="btn btn--primary" id="btnSave">Save</button>
        <button class="btn" id="btnCancel">Cancel</button>
      </div>
    </div>
  `;

  host.querySelector("#sheetClose").onclick = closeSheet;
  host.querySelector("#btnCancel").onclick = closeSheet;
  host.querySelector(".sheetBackdrop").onclick = () => { /* no close */ };

  host.querySelector("#btnSave").onclick = async () => {
    const v = host.querySelector("#editInput").value || "";
    await updateTaskTitle(taskId, v);
    await refreshDaySheet(dateKey);
  };

  injectSheetStylesOnce();
}

function openDuplicateChoiceSheet(dateKey, taskId) {
  const host = getSheetHost();
  host.innerHTML = `
    <div class="sheetBackdrop"></div>

    <div class="sheetPanel">
      <div class="sheetHeader">
        <div>
          <div class="sheetTitle">Duplicate</div>
          <div class="muted small">Where should the duplicate go?</div>
        </div>
        <button class="iconbtn" id="sheetClose" type="button">✕</button>
      </div>

      <div class="divider"></div>

      <div class="sheetFooter" style="justify-content:flex-start; flex-wrap:wrap;">
        <button class="btn btn--primary" id="btnSame">Same day</button>
        <button class="btn" id="btnToday">Today</button>
        <button class="btn" id="btnCancel">Cancel</button>
      </div>
    </div>
  `;

  host.querySelector("#sheetClose").onclick = closeSheet;
  host.querySelector("#btnCancel").onclick = closeSheet;
  host.querySelector(".sheetBackdrop").onclick = () => { /* no close */ };

  host.querySelector("#btnSame").onclick = async () => {
    await duplicateTask(taskId, dateKey);
    await refreshDaySheet(dateKey);
  };

  host.querySelector("#btnToday").onclick = async () => {
    await duplicateTask(taskId, todayKey());
    await refreshDaySheet(dateKey);
  };

  injectSheetStylesOnce();
}

// ---------- Add Task ----------
function openAddTaskSheet(dateKey) {
  const host = getSheetHost();
  host.innerHTML = `
    <div class="sheetBackdrop"></div>

    <div class="sheetPanel">
      <div class="sheetHeader">
        <div>
          <div class="sheetTitle">Add Task</div>
          <div class="muted small">${dateKey}</div>
        </div>
        <button class="iconbtn" id="sheetClose" type="button">✕</button>
      </div>

      <div class="divider"></div>

      <input class="input" id="addInput" placeholder="Task title…" />

      <div class="divider"></div>

      <div class="sheetFooter">
        <button class="btn btn--primary" id="btnAddGo">Add</button>
        <button class="btn" id="btnCancel">Cancel</button>
      </div>
    </div>
  `;

  host.querySelector("#sheetClose").onclick = closeSheet;
  host.querySelector("#btnCancel").onclick = closeSheet;
  host.querySelector(".sheetBackdrop").onclick = () => { /* no close */ };

  host.querySelector("#btnAddGo").onclick = async () => {
    const v = host.querySelector("#addInput").value || "";
    await addTask(dateKey, v);
    await refreshDaySheet(dateKey);
  };

  injectSheetStylesOnce();
}

// ---------- Import (Today/Future only) ----------
function openImportSheet(dateKey) {
  const host = getSheetHost();
  host.innerHTML = `
    <div class="sheetBackdrop"></div>

    <div class="sheetPanel">
      <div class="sheetHeader">
        <div>
          <div class="sheetTitle">Import Plan</div>
          <div class="muted small">${dateKey} • paste list</div>
        </div>
        <button class="iconbtn" id="sheetClose" type="button">✕</button>
      </div>

      <div class="divider"></div>

      <textarea class="ta" id="impText" placeholder="- Task 1&#10;- Task 2"></textarea>

      <div class="divider"></div>

      <div class="sheetFooter">
        <button class="btn btn--primary" id="btnPreview">Preview</button>
        <button class="btn" id="btnCancel">Cancel</button>
      </div>

      <div id="previewWrap" style="margin-top:12px;"></div>
    </div>
  `;

  host.querySelector("#sheetClose").onclick = closeSheet;
  host.querySelector("#btnCancel").onclick = closeSheet;
  host.querySelector(".sheetBackdrop").onclick = () => { /* no close */ };

  host.querySelector("#btnPreview").onclick = () => {
    const raw = host.querySelector("#impText").value || "";
    const items = parseImport(raw);
    const wrap = host.querySelector("#previewWrap");
    if (!items.length) {
      wrap.innerHTML = `<div class="muted">Nothing found.</div>`;
      return;
    }

    wrap.innerHTML = `
      <div class="divider"></div>
      <div class="h2">Preview</div>
      <div class="muted small">Edit titles, uncheck to exclude.</div>
      <div class="previewList">
        ${items.map((t,i)=>`
          <div class="prevRow" data-i="${i}">
            <input type="checkbox" class="prevChk" checked />
            <input class="input prevInput" value="${escapeAttr(t)}" />
          </div>
        `).join("")}
      </div>
      <div class="divider"></div>
      <div class="sheetFooter">
        <button class="btn btn--primary" id="btnImportGo">Import</button>
        <button class="btn" id="btnClose2">Close</button>
      </div>
    `;

    wrap.querySelector("#btnClose2").onclick = () => { wrap.innerHTML = ""; };

    wrap.querySelector("#btnImportGo").onclick = async () => {
      const rows = Array.from(wrap.querySelectorAll(".prevRow"));
      const toAdd = [];
      for (const r of rows) {
        const chk = r.querySelector(".prevChk");
        const inp = r.querySelector(".prevInput");
        if (!chk.checked) continue;
        const v = (inp.value || "").trim();
        if (!v) continue;
        toAdd.push(v);
      }
      for (const t of toAdd) await addTask(dateKey, t);
      await refreshDaySheet(dateKey);
    };
  };

  injectSheetStylesOnce();
}

// ---------- Reorder (Up/Down list) ----------
async function openReorderSheet(dateKey) {
  const tasks = await getTasksForDate(dateKey);
  // Keep the current order as shown (undone then done)
  const host = getSheetHost();

  host.innerHTML = `
    <div class="sheetBackdrop"></div>

    <div class="sheetPanel">
      <div class="sheetHeader">
        <div>
          <div class="sheetTitle">Reorder</div>
          <div class="muted small">${dateKey}</div>
        </div>
        <button class="iconbtn" id="sheetClose" type="button">✕</button>
      </div>

      <div class="divider"></div>

      <div id="reList">
        ${tasks.map(t => `
          <div class="ghostRow" data-id="${t.id}">
            <div style="font-weight:900; flex:1;">${escapeHTML(t.title)}</div>
            <button class="iconbtn smallBtn upBtn" type="button">↑</button>
            <button class="iconbtn smallBtn downBtn" type="button">↓</button>
          </div>
        `).join("")}
      </div>

      <div class="divider"></div>

      <div class="sheetFooter">
        <button class="btn btn--primary" id="btnSave">Save</button>
        <button class="btn" id="btnCancel">Cancel</button>
      </div>
    </div>
  `;

  host.querySelector("#sheetClose").onclick = closeSheet;
  host.querySelector("#btnCancel").onclick = closeSheet;
  host.querySelector(".sheetBackdrop").onclick = () => { /* no close */ };

  const listEl = host.querySelector("#reList");

  listEl.querySelectorAll(".ghostRow").forEach(row => {
    row.querySelector(".upBtn").onclick = () => moveRow(listEl, row, -1);
    row.querySelector(".downBtn").onclick = () => moveRow(listEl, row, +1);
  });

  host.querySelector("#btnSave").onclick = async () => {
    const ordered = Array.from(listEl.querySelectorAll(".ghostRow")).map(r => r.getAttribute("data-id"));
    await reorderTasks(dateKey, ordered);
    await refreshDaySheet(dateKey);
  };

  injectSheetStylesOnce();
}

function moveRow(listEl, row, dir) {
  const rows = Array.from(listEl.querySelectorAll(".ghostRow"));
  const idx = rows.indexOf(row);
  const nextIdx = idx + dir;
  if (nextIdx < 0 || nextIdx >= rows.length) return;

  if (dir < 0) listEl.insertBefore(row, rows[nextIdx]);
  else listEl.insertBefore(rows[nextIdx], row);
}

// ---------- Utilities ----------
function getDayMode(dateKey) {
  const t = todayKey();
  const diff = new Date(dateKey + "T12:00:00").getTime() - new Date(t + "T12:00:00").getTime();
  if (diff < 0) return "past";
  if (diff > 0) return "future";
  return "today";
}

function prettyDate(key) {
  const d = new Date(key + "T12:00:00");
  return d.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function formatHolidayLine(us, custom) {
  const parts = [];
  if (us) parts.push(us);
  if (custom) parts.push(custom);
  return parts.join(" • ");
}

function parseImport(text) {
  const lines = String(text || "").replace(/\r\n/g,"\n").replace(/\r/g,"\n").split("\n");
  const out = [];
  for (let line of lines) {
    line = (line || "").trim();
    if (!line) continue;
    if (line.endsWith(":")) continue;
    line = line.replace(/^[-•*]\s*/, "");
    line = line.replace(/^\d+[\.\)]\s*/, "");
    line = line.trim();
    if (!line) continue;
    out.push(line);
  }
  return out;
}

function getSheetHost() {
  let host = document.getElementById("ritualSheetHost");
  if (!host) {
    host = document.createElement("div");
    host.id = "ritualSheetHost";
    document.body.appendChild(host);
  }
  return host;
}

function closeSheet() {
  const host = document.getElementById("ritualSheetHost");
  if (host) host.innerHTML = "";
}

let _sheetStylesInjected = false;
function injectSheetStylesOnce() {
  if (_sheetStylesInjected) return;
  _sheetStylesInjected = true;

  const style = document.createElement("style");
  style.textContent = `
    .sheetBackdrop{
      position:fixed; inset:0;
      background: rgba(0,0,0,.55);
      z-index: 9998;
    }
    .sheetPanel{
      position:fixed;
      left:50%;
      transform: translateX(-50%);
      bottom: 14px;
      width: min(720px, calc(100vw - 24px));
      background: rgba(20,20,22,.94);
      border: 1px solid rgba(255,255,255,.12);
      border-radius: 18px;
      padding: 12px;
      z-index: 9999;
      backdrop-filter: blur(14px);
      max-height: calc(100vh - 120px);
      overflow:auto;
    }
    .sheetHeader{
      display:flex; justify-content:space-between; align-items:flex-start; gap:12px;
    }
    .sheetTitle{
      font-weight: 900;
      font-size: 16px;
      letter-spacing: -0.2px;
    }
    .sheetFooter{
      display:flex; gap:10px; justify-content:flex-end; flex-wrap:wrap;
    }
    .btn--danger{
      background: rgba(239,68,68,.18);
      border-color: rgba(239,68,68,.30);
    }

    /* Compact day task list */
    .dayTasks{ display:flex; flex-direction:column; gap:8px; }
    .dayTaskRow{
      display:flex; align-items:center; justify-content:space-between; gap:10px;
      border:1px solid rgba(255,255,255,.10);
      background: rgba(255,255,255,.04);
      border-radius: 14px;
      padding: 10px 10px;
    }
    .dayTaskRow.done{ opacity:.65; }
    .dayLeft{ display:flex; align-items:center; gap:10px; flex:1; }
    .dayChk{
      width:20px; height:20px; border-radius:999px;
      border:1px solid rgba(255,255,255,.14);
      display:flex; align-items:center; justify-content:center;
      color: var(--accent);
      font-weight:900;
      flex:0 0 auto;
    }
    .dayTitle{ font-weight:800; }

    .ta{
      width:100%;
      min-height:140px;
      resize:vertical;
      border-radius:14px;
      padding:12px;
      border:1px solid rgba(255,255,255,.12);
      background: rgba(255,255,255,.04);
      color: var(--text, #fff);
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 13px;
    }
    .previewList{ display:flex; flex-direction:column; gap:10px; margin-top:10px; }
    .prevRow{ display:flex; gap:10px; align-items:center; }
    .prevRow .prevChk{ transform: scale(1.15); }

    .ghostRow{
      display:flex; align-items:center; gap:10px;
      border:1px solid rgba(255,255,255,.10);
      background: rgba(255,255,255,.04);
      border-radius: 14px;
      padding: 10px 10px;
      margin-bottom: 8px;
    }
    .smallBtn{ padding:8px 10px; font-size:12px; }
  `;
  document.head.appendChild(style);
}

function escapeHTML(s) {
  return (s || "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}
function escapeAttr(s) {
  return escapeHTML(s).replaceAll("\n"," ");
}

// ---------- Holidays (US federal + common) ----------
function observedIfWeekend(date) {
  const wd = date.getDay();
  if (wd === 6) return new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1, 12,0,0);
  if (wd === 0) return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 12,0,0);
  return date;
}
function nthWeekdayOfMonth(year, month0, weekday0, n) {
  const first = new Date(year, month0, 1, 12,0,0);
  const offset = (weekday0 - first.getDay() + 7) % 7;
  const day = 1 + offset + (n - 1) * 7;
  return new Date(year, month0, day, 12,0,0);
}
function lastWeekdayOfMonth(year, month0, weekday0) {
  const last = new Date(year, month0 + 1, 0, 12,0,0);
  const offset = (last.getDay() - weekday0 + 7) % 7;
  const day = last.getDate() - offset;
  return new Date(year, month0, day, 12,0,0);
}
function getUSHolidayMap(year) {
  const map = new Map();
  const set = (d, name) => map.set(dateKeyFromDate(d), name);

  // Federal
  set(observedIfWeekend(new Date(year, 0, 1, 12,0,0)), "New Year’s Day");
  set(nthWeekdayOfMonth(year, 0, 1, 3), "Martin Luther King Jr. Day");
  set(nthWeekdayOfMonth(year, 1, 1, 3), "Presidents’ Day");
  set(lastWeekdayOfMonth(year, 4, 1), "Memorial Day");
  set(observedIfWeekend(new Date(year, 5, 19, 12,0,0)), "Juneteenth");
  set(observedIfWeekend(new Date(year, 6, 4, 12,0,0)), "Independence Day");
  set(nthWeekdayOfMonth(year, 8, 1, 1), "Labor Day");
  set(nthWeekdayOfMonth(year, 9, 1, 2), "Columbus Day");
  set(observedIfWeekend(new Date(year, 10, 11, 12,0,0)), "Veterans Day");
  set(nthWeekdayOfMonth(year, 10, 4, 4), "Thanksgiving");
  set(observedIfWeekend(new Date(year, 11, 25, 12,0,0)), "Christmas Day");

  // Common
  set(new Date(year, 1, 14, 12,0,0), "Valentine’s Day");
  set(new Date(year, 2, 17, 12,0,0), "St. Patrick’s Day");
  set(nthWeekdayOfMonth(year, 4, 0, 2), "Mother’s Day");
  set(nthWeekdayOfMonth(year, 5, 0, 3), "Father’s Day");
  set(new Date(year, 9, 31, 12,0,0), "Halloween");
  set(new Date(year, 11, 31, 12,0,0), "New Year’s Eve");

  return map;
}

function buildMonthGrid(year, month) {
  const first = new Date(year, month, 1);
  const firstDow = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const out = [];
  for (let i = 0; i < firstDow; i++) out.push(null);
  for (let d = 1; d <= daysInMonth; d++) out.push(new Date(year, month, d, 12, 0, 0));
  while (out.length % 7 !== 0) out.push(null);
  return out;
}

async function preloadTaskCounts(cells) {
  const counts = {};
  for (const c of cells) {
    if (!c) continue;
    const key = dateKeyFromDate(c);
    const tasks = await getTasksForDate(key);
    counts[key] = tasks.length;
  }
  return counts;
}