// Ritual V3 — today.js (RC1)
// Today screen: swipe actions, import preview, copy summary, clear done, reorder mode (up/down).
// NO prompt() menus. NO long-press menus.

import {
  todayKey,
  getTasksForDate,
  addTask,
  toggleTaskDone,
  deleteTask,
  duplicateTask,
  updateTaskTitle,
  reorderTasks,
  debugLog
} from "./store.js";

let _stylesInjected = false;

export async function renderToday(rootEl) {
  injectStylesOnce();

  const key = todayKey();
  const tasks = await getTasksForDate(key);
  const doneCount = tasks.filter(t => t.done).length;

  rootEl.innerHTML = `
    <div class="card card--hero">
      <div class="row between">
        <div>
          <div class="h2">Today</div>
          <div class="muted small">
            Date: <b>${key}</b> • ${doneCount}/${tasks.length} done • ${doneCount * 10} pts
          </div>
        </div>

        <div class="row" style="gap:8px;">
          <button class="iconbtn" id="btnEditMode" type="button" title="Reorder / Edit mode">Edit</button>
          <button class="iconbtn" id="btnTools" type="button" title="Tools">⋯</button>
        </div>
      </div>

      <div class="divider"></div>

      <div class="row" style="gap:10px;">
        <input class="input" id="addInput" placeholder="Add a task…" />
        <button class="btn btn--primary" id="addBtn" type="button">Add</button>
      </div>

      <div class="row" style="flex-wrap:wrap; gap:8px; margin-top:10px;">
        <span class="pill">Tap to complete</span>
        <span class="pill">Swipe left for actions</span>
        <span class="pill">Done sinks to bottom</span>
      </div>
    </div>

    <div class="card grow">
      <div class="h2">Tasks</div>
      <div class="muted small" id="modeHint">Swipe left on a task to Edit / Duplicate / Delete.</div>
      <div class="divider"></div>

      <div id="taskList">
        ${tasks.length ? tasks.map(t => taskRowHTML(t)).join("") : `<div class="muted">No tasks yet.</div>`}
      </div>
    </div>

    <div id="sheetHost"></div>
  `;

  // Add task
  const inp = rootEl.querySelector("#addInput");
  const addBtn = rootEl.querySelector("#addBtn");
  const doAdd = async () => {
    const v = (inp.value || "").trim();
    if (!v) return;
    await addTask(key, v);
    inp.value = "";
    await debugLog(`today:add "${v}"`);
    await renderToday(rootEl);
  };
  addBtn.addEventListener("click", doAdd);
  inp.addEventListener("keydown", (e) => { if (e.key === "Enter") doAdd(); });

  // Tools
  rootEl.querySelector("#btnTools").addEventListener("click", () => openToolsSheet(rootEl, key));

  // Reorder mode
  const editBtn = rootEl.querySelector("#btnEditMode");
  editBtn.addEventListener("click", () => toggleReorderMode(rootEl, key));

  // Swipe actions wiring
  wireSwipeRows(rootEl, key);
}

function taskRowHTML(t) {
  return `
    <div class="swipeRow ${t.done ? "done" : ""}" data-id="${t.id}">
      <div class="swipeActions">
        <button class="act act-edit" type="button">Edit</button>
        <button class="act act-dup" type="button">Dup</button>
        <button class="act act-del" type="button">Del</button>
      </div>

      <div class="swipeContent">
        <div class="taskRowMain">
          <div class="chk">${t.done ? "✓" : ""}</div>
          <div class="tTitle">${escapeHTML(t.title)}</div>
          <div class="tHandle" title="Reorder handle">☰</div>
        </div>

        <div class="reorderControls hidden">
          <button class="iconbtn smallBtn upBtn" type="button">↑</button>
          <button class="iconbtn smallBtn downBtn" type="button">↓</button>
        </div>
      </div>
    </div>
  `;
}

// ---------------------------
// Swipe actions (iPhone-safe)
// ---------------------------
function wireSwipeRows(rootEl, dateKey) {
  // Close any open row when tapping background
  rootEl.addEventListener("click", (e) => {
    if (e.target.closest(".swipeRow")) return;
    closeAllRows(rootEl);
  });

  rootEl.querySelectorAll(".swipeRow").forEach(row => {
    const id = row.getAttribute("data-id");
    const content = row.querySelector(".swipeContent");

    let startX = 0;
    let currentX = 0;
    let dragging = false;

    const openPx = 168; // width of actions revealed
    const threshold = 40;

    const onPointerDown = (e) => {
      // ignore clicks on buttons
      if (e.target.closest("button")) return;
      dragging = true;
      startX = e.clientX;
      currentX = getTranslateX(content);
      row.classList.add("dragging");
    };

    const onPointerMove = (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      let next = currentX + dx;
      next = Math.min(0, Math.max(-openPx, next));
      setTranslateX(content, next);
      startX = e.clientX;
      currentX = next;
    };

    const onPointerUp = async (e) => {
      if (!dragging) return;
      dragging = false;
      row.classList.remove("dragging");

      const x = getTranslateX(content);
      if (Math.abs(x) < threshold) {
        // snap closed
        setTranslateX(content, 0);
      } else {
        // snap open
        setTranslateX(content, -openPx);
        closeOtherRows(rootEl, row);
      }

      // Tap toggles done (only if not swiping)
      // We treat pointerup with very small movement as tap:
      // (handled separately in click handler below)
    };

    // Pointer events
    row.addEventListener("pointerdown", onPointerDown);
    row.addEventListener("pointermove", onPointerMove);
    row.addEventListener("pointerup", onPointerUp);
    row.addEventListener("pointercancel", onPointerUp);

    // Click toggles done (if row isn't open)
    row.addEventListener("click", async (e) => {
      if (e.target.closest("button")) return;
      // if open, tap closes
      if (getTranslateX(content) !== 0) {
        setTranslateX(content, 0);
        return;
      }
      // toggle done
      await toggleTaskDone(id);
      await debugLog(`today:toggle ${id}`);
      await renderToday(rootEl);
    });

    // Action buttons
    row.querySelector(".act-edit").addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      openTaskEditSheet(rootEl, dateKey, id);
    });

    row.querySelector(".act-dup").addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Today screen: duplicate to today (same as same-day)
      await duplicateTask(id, dateKey);
      await debugLog(`today:dup ${id}`);
      await renderToday(rootEl);
    });

    row.querySelector(".act-del").addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      openConfirmSheet(rootEl, "Delete task?", "This cannot be undone.", async () => {
        await deleteTask(id);
        await debugLog(`today:delete ${id}`);
        await renderToday(rootEl);
      });
    });
  });
}

function closeAllRows(rootEl) {
  rootEl.querySelectorAll(".swipeRow .swipeContent").forEach(c => setTranslateX(c, 0));
}

function closeOtherRows(rootEl, keepRow) {
  rootEl.querySelectorAll(".swipeRow").forEach(r => {
    if (r === keepRow) return;
    const c = r.querySelector(".swipeContent");
    if (c) setTranslateX(c, 0);
  });
}

function getTranslateX(el) {
  const m = el.style.transform.match(/translateX\((-?\d+)px\)/);
  return m ? parseInt(m[1], 10) : 0;
}
function setTranslateX(el, x) {
  el.style.transform = `translateX(${x}px)`;
}

// ---------------------------
// Reorder mode (Up/Down)
// ---------------------------
async function toggleReorderMode(rootEl, dateKey) {
  const listEl = rootEl.querySelector("#taskList");
  const hint = rootEl.querySelector("#modeHint");
  const isOn = listEl.classList.toggle("reorderOn");

  // show/hide controls
  listEl.querySelectorAll(".reorderControls").forEach(el => el.classList.toggle("hidden", !isOn));
  listEl.querySelectorAll(".tHandle").forEach(el => el.style.opacity = isOn ? "0.4" : "1.0");

  hint.textContent = isOn
    ? "Reorder mode: use ↑ / ↓ on each task, then tap Edit again to exit."
    : "Swipe left on a task to Edit / Duplicate / Delete.";

  if (!isOn) return;

  // wire up buttons
  listEl.querySelectorAll(".swipeRow").forEach((row) => {
    const up = row.querySelector(".upBtn");
    const down = row.querySelector(".downBtn");
    if (!up || !down) return;

    up.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      moveRow(listEl, row, -1);
      await persistOrder(listEl, dateKey);
    };

    down.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      moveRow(listEl, row, +1);
      await persistOrder(listEl, dateKey);
    };
  });
}

function moveRow(listEl, row, dir) {
  const rows = Array.from(listEl.querySelectorAll(".swipeRow"));
  const idx = rows.indexOf(row);
  const nextIdx = idx + dir;
  if (nextIdx < 0 || nextIdx >= rows.length) return;

  if (dir < 0) {
    listEl.insertBefore(row, rows[nextIdx]);
  } else {
    listEl.insertBefore(rows[nextIdx], row);
  }
}

async function persistOrder(listEl, dateKey) {
  const orderedIds = Array.from(listEl.querySelectorAll(".swipeRow")).map(r => r.getAttribute("data-id"));
  await reorderTasks(dateKey, orderedIds);
  await debugLog(`today:reorder ${dateKey}`);
}

// ---------------------------
// Tools Sheet (Import/Copy/Clear)
// ---------------------------
function openToolsSheet(rootEl, dateKey) {
  openSheet(rootEl, {
    title: "Tools",
    content: `
      <div class="sheetBtns">
        <button class="btn btn--primary" id="toolImport">Import Plan (paste)</button>
        <button class="btn" id="toolCopy">Copy Summary for ChatGPT</button>
        <button class="btn btn--danger" id="toolClearDone">Clear Done</button>
      </div>
    `,
    onMount: (sheetEl, close) => {
      sheetEl.querySelector("#toolImport").addEventListener("click", () => {
        close();
        openImportSheet(rootEl, dateKey);
      });

      sheetEl.querySelector("#toolCopy").addEventListener("click", async () => {
        const tasks = await getTasksForDate(dateKey);
        const summary = buildSummary(dateKey, tasks);
        await copyToClipboard(summary);
        await debugLog("today:copySummary");
        close();
        toast(rootEl, "Copied");
      });

      sheetEl.querySelector("#toolClearDone").addEventListener("click", async () => {
        close();
        openConfirmSheet(rootEl, "Clear done tasks?", "This removes completed tasks for today.", async () => {
          const tasks = await getTasksForDate(dateKey);
          for (const t of tasks) {
            if (t.done) await deleteTask(t.id);
          }
          await debugLog("today:clearDone");
          await renderToday(rootEl);
        });
      });
    }
  });
}

function openImportSheet(rootEl, dateKey) {
  openSheet(rootEl, {
    title: "Import Plan",
    content: `
      <div class="muted small">Paste a list (one per line). You can edit before confirming.</div>
      <textarea class="ta" id="importText" placeholder="Paste your plan here…"></textarea>
      <div class="row" style="gap:8px; margin-top:10px;">
        <button class="btn btn--primary" id="btnParse">Preview</button>
        <button class="btn" id="btnCancel">Cancel</button>
      </div>
      <div id="previewWrap" style="margin-top:12px;"></div>
    `,
    onMount: (sheetEl, close) => {
      sheetEl.querySelector("#btnCancel").addEventListener("click", close);

      sheetEl.querySelector("#btnParse").addEventListener("click", () => {
        const raw = sheetEl.querySelector("#importText").value || "";
        const items = parseImport(raw);

        const wrap = sheetEl.querySelector("#previewWrap");
        if (!items.length) {
          wrap.innerHTML = `<div class="muted">Nothing found.</div>`;
          return;
        }

        wrap.innerHTML = `
          <div class="h2">Preview</div>
          <div class="muted small">Uncheck anything you don’t want. Edit titles inline.</div>
          <div class="previewList">
            ${items.map((t, i) => `
              <div class="prevRow" data-i="${i}">
                <input type="checkbox" class="prevChk" checked />
                <input class="input prevInput" value="${escapeAttr(t)}" />
              </div>
            `).join("")}
          </div>

          <div class="row" style="gap:8px; margin-top:12px;">
            <button class="btn btn--primary" id="btnImportGo">Import</button>
            <button class="btn" id="btnImportBack">Back</button>
          </div>
        `;

        wrap.querySelector("#btnImportBack").addEventListener("click", () => {
          wrap.innerHTML = "";
        });

        wrap.querySelector("#btnImportGo").addEventListener("click", async () => {
          const rows = Array.from(wrap.querySelectorAll(".prevRow"));
          const toAdd = [];
          for (const r of rows) {
            const chk = r.querySelector(".prevChk");
            const input = r.querySelector(".prevInput");
            if (!chk.checked) continue;
            const v = (input.value || "").trim();
            if (!v) continue;
            toAdd.push(v);
          }
          for (const t of toAdd) await addTask(dateKey, t);
          await debugLog(`today:import ${toAdd.length}`);
          close();
          await renderToday(rootEl);
        });
      });
    }
  });
}

// ---------------------------
// Task Edit Sheet
// ---------------------------
async function openTaskEditSheet(rootEl, dateKey, taskId) {
  const tasks = await getTasksForDate(dateKey);
  const t = tasks.find(x => x.id === taskId);
  const initial = t ? t.title : "";

  openSheet(rootEl, {
    title: "Edit Task",
    content: `
      <div class="muted small">Edit the task title.</div>
      <input class="input" id="editTitle" value="${escapeAttr(initial)}" />
      <div class="row" style="gap:8px; margin-top:12px;">
        <button class="btn btn--primary" id="btnSave">Save</button>
        <button class="btn" id="btnCancel">Cancel</button>
      </div>
    `,
    onMount: (sheetEl, close) => {
      const input = sheetEl.querySelector("#editTitle");
      input.focus();

      sheetEl.querySelector("#btnCancel").addEventListener("click", close);

      sheetEl.querySelector("#btnSave").addEventListener("click", async () => {
        const v = (input.value || "").trim();
        if (!v) return;
        await updateTaskTitle(taskId, v);
        await debugLog(`today:edit ${taskId}`);
        close();
        await renderToday(rootEl);
      });
    }
  });
}

// ---------------------------
// Confirm Sheet
// ---------------------------
function openConfirmSheet(rootEl, title, body, onConfirm) {
  openSheet(rootEl, {
    title,
    content: `
      <div class="muted">${escapeHTML(body)}</div>
      <div class="row" style="gap:8px; margin-top:12px;">
        <button class="btn btn--danger" id="btnYes">Confirm</button>
        <button class="btn" id="btnNo">Cancel</button>
      </div>
    `,
    onMount: (sheetEl, close) => {
      sheetEl.querySelector("#btnNo").addEventListener("click", close);
      sheetEl.querySelector("#btnYes").addEventListener("click", async () => {
        close();
        await onConfirm();
      });
    }
  });
}

// ---------------------------
// Sheet framework (simple, consistent)
// ---------------------------
function openSheet(rootEl, { title, content, onMount }) {
  const host = rootEl.querySelector("#sheetHost");
  host.innerHTML = `
    <div class="sheetBackdrop"></div>
    <div class="sheet">
      <div class="sheetHeader">
        <div class="sheetTitle">${escapeHTML(title)}</div>
        <button class="iconbtn" id="sheetClose" type="button">✕</button>
      </div>
      <div class="sheetBody">${content}</div>
    </div>
  `;

  const close = () => { host.innerHTML = ""; };
  host.querySelector(".sheetBackdrop").addEventListener("click", close);
  host.querySelector("#sheetClose").addEventListener("click", close);

  const sheetEl = host.querySelector(".sheet");
  if (onMount) onMount(sheetEl, close);
}

// ---------------------------
// Summary for ChatGPT
// ---------------------------
function buildSummary(dateKey, tasks) {
  const remaining = tasks.filter(t => !t.done);
  const completed = tasks.filter(t => t.done);

  const list = (arr) => arr.length ? arr.map(t => `- ${t.title}`).join("\n") : "- (none)";

  return `DATE: ${dateKey}

REMAINING (in order):
${list(remaining)}

COMPLETED:
${list(completed)}

INSTRUCTIONS:
1) Reorder the remaining tasks into the best execution order.
2) For the top 3 tasks, give the smallest next action.
3) Rewrite any vague tasks into clear, concrete actions.
`;
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // fallback
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
}

// ---------------------------
// Import parsing
// ---------------------------
function parseImport(text) {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const out = [];

  for (let line of lines) {
    line = (line || "").trim();
    if (!line) continue;
    if (line.endsWith(":")) continue;

    line = line.replace(/^✅\s*/, "");
    line = line.replace(/^\[x\]\s*/i, "");
    line = line.replace(/^[-•*]\s*/, "");
    line = line.replace(/^\d+[\.\)]\s*/, "");
    line = line.trim();
    if (!line) continue;

    out.push(line);
  }

  return out;
}

// ---------------------------
// Toast
// ---------------------------
function toast(rootEl, msg) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  rootEl.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

// ---------------------------
// Escapes
// ---------------------------
function escapeHTML(s) {
  return (s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function escapeAttr(s) {
  return escapeHTML(s).replaceAll("\n", " ");
}

// ---------------------------
// Styles (injected once)
// ---------------------------
function injectStylesOnce() {
  if (_stylesInjected) return;
  _stylesInjected = true;

  const style = document.createElement("style");
  style.textContent = `
    .swipeRow{ position:relative; overflow:hidden; border-radius:14px; margin:10px 0; }
    .swipeActions{
      position:absolute; inset:0 0 0 auto;
      width:168px; display:flex; gap:6px; align-items:center; justify-content:center;
      padding:0 10px;
      background: rgba(255,255,255,.04);
      border:1px solid rgba(255,255,255,.08);
      border-left: none;
    }
    .swipeActions .act{
      border-radius:12px; padding:10px 10px;
      border:1px solid rgba(255,255,255,.10);
      background: rgba(255,255,255,.06);
      color: var(--text, #fff);
      font-weight:800;
      min-width:44px;
    }
    .swipeActions .act-del{ background: rgba(255,60,60,.16); border-color: rgba(255,60,60,.25); }
    .swipeActions .act-edit{ }
    .swipeActions .act-dup{ }

    .swipeContent{
      transform: translateX(0px);
      transition: transform .12s ease;
      background: rgba(255,255,255,.04);
      border:1px solid rgba(255,255,255,.10);
      border-radius:14px;
      padding:12px 12px;
    }
    .swipeRow.dragging .swipeContent{ transition:none; }

    .taskRowMain{ display:flex; gap:10px; align-items:center; }
    .chk{
      width:22px; height:22px; border-radius:999px;
      border:1px solid rgba(255,255,255,.15);
      display:flex; align-items:center; justify-content:center;
      color: var(--accent, #f97316);
      font-weight:900;
      flex:0 0 auto;
    }
    .tTitle{ flex:1; font-weight:800; }
    .tHandle{ opacity:.9; }

    .swipeRow.done .tTitle{ opacity:.65; text-decoration: line-through; }
    .swipeRow.done .chk{ border-color: rgba(255,255,255,.10); }

    .reorderControls{ display:flex; gap:8px; margin-top:10px; }
    .reorderControls.hidden{ display:none; }
    .smallBtn{ padding:8px 10px; }

    .sheetBackdrop{
      position:fixed; inset:0; background: rgba(0,0,0,.55);
      z-index:9998;
    }
    .sheet{
      position:fixed; left:50%; transform: translateX(-50%);
      bottom:14px; width:min(720px, calc(100vw - 24px));
      background: rgba(20,20,22,.92);
      border:1px solid rgba(255,255,255,.12);
      border-radius:18px;
      padding:12px;
      z-index:9999;
      backdrop-filter: blur(14px);
    }
    .sheetHeader{ display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:10px; }
    .sheetTitle{ font-weight:900; font-size:16px; }
    .sheetBody{ display:flex; flex-direction:column; gap:10px; }
    .sheetBtns{ display:flex; flex-direction:column; gap:10px; }
    .ta{
      width:100%; min-height:150px; resize:vertical;
      border-radius:14px; padding:12px;
      border:1px solid rgba(255,255,255,.12);
      background: rgba(255,255,255,.04);
      color: var(--text, #fff);
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size:13px;
    }
    .previewList{ display:flex; flex-direction:column; gap:10px; }
    .prevRow{ display:flex; gap:10px; align-items:center; }
    .prevRow .prevChk{ transform: scale(1.15); }

    .toast{
      position:fixed; top:14px; left:50%; transform: translateX(-50%);
      padding:10px 14px; border-radius:999px;
      background: rgba(255,255,255,.08);
      border:1px solid rgba(255,255,255,.12);
      backdrop-filter: blur(12px);
      z-index:10000;
      font-weight:900;
    }
  `;
  document.head.appendChild(style);
}