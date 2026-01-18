// Ritual V3 — settings.js (RC1)
// Accent picker, backup export/import (R1 replace), custom holidays (pink dot), debug tools.
// Uses store.js RC1 foundation APIs.

import {
  getSettings,
  setSettings,
  setAccent,
  setDebugEnabled,
  getDebugLog,
  clearDebugLog,
  exportBackupJSON,
  importBackupJSON,
  getCustomHolidays,
  addCustomHoliday,
  deleteCustomHoliday,
  updateCustomHoliday,
  todayKey,
  debugLog
} from "./store.js";

let _stylesInjected = false;

export async function renderSettings(rootEl) {
  injectStylesOnce();

  const s = await getSettings();
  const holidays = await getCustomHolidays();

  rootEl.innerHTML = `
    <div class="card card--hero">
      <div class="row between">
        <div>
          <div class="h2">Settings</div>
          <div class="muted small">Accent • Backup • Holidays • Debug</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="h2">Accent Color</div>
      <div class="muted small">This is the only “theme” for now.</div>
      <div class="divider"></div>

      <div class="chips" id="accentChips">
        ${accentChip("red","Red")}
        ${accentChip("ember","Ember")}
        ${accentChip("orange","Orange")}
        ${accentChip("pink","Pink")}
        ${accentChip("purple","Purple")}
        ${accentChip("blue","Blue")}
        ${accentChip("green","Green")}
      </div>

      <div class="divider"></div>
      <div class="muted small">Current: <b id="accentCurrent">${escapeHTML(s.accent || "red")}</b></div>
    </div>

    <div class="card">
      <div class="h2">Backup</div>
      <div class="muted small">Export a JSON file. Import restores everything (Replace All).</div>
      <div class="divider"></div>

      <div class="row" style="flex-wrap:wrap; gap:10px;">
        <button class="btn btn--primary" id="btnExport" type="button">Export Backup</button>

        <label class="fileBtn">
          <input type="file" id="fileImport" accept="application/json" />
          Import Backup
        </label>
      </div>

      <div id="importPreview" class="previewBox hidden"></div>
    </div>

    <div class="card">
      <div class="h2">Custom Holidays</div>
      <div class="muted small">These show as <span class="pinkDot"></span> in the calendar.</div>
      <div class="divider"></div>

      <div class="row" style="gap:10px; flex-wrap:wrap;">
        <input class="input" id="holidayDate" placeholder="YYYY-MM-DD" />
        <input class="input" id="holidayName" placeholder="Holiday name" />
        <button class="btn btn--primary" id="btnAddHoliday" type="button">Add</button>
      </div>

      <div class="divider"></div>

      <div id="holidayList">
        ${renderHolidayList(holidays)}
      </div>
    </div>

    <div class="card">
      <div class="h2">Reminders</div>
      <div class="muted small">Use Apple Reminders for recurring reminders.</div>
    </div>

    <div class="card">
      <div class="h2">Debug</div>
      <div class="muted small">Keep it clean: debug is off unless you enable it.</div>
      <div class="divider"></div>

      <div class="row" style="flex-wrap:wrap; gap:10px;">
        <button class="btn ${s.debugEnabled ? "btn--primary" : ""}" id="btnToggleDebug" type="button">
          ${s.debugEnabled ? "Disable Debug" : "Enable Debug"}
        </button>

        <button class="btn" id="btnCopyDebug" type="button">Copy Debug Log</button>
        <button class="btn" id="btnClearDebug" type="button">Clear Debug Log</button>
      </div>

      <div class="divider"></div>

      <div class="muted small">Debug stays non-blocking. You can still use the app.</div>
    </div>

    <div id="sheetHost"></div>
  `;

  // Accent picker
  rootEl.querySelectorAll("[data-accent]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const key = btn.getAttribute("data-accent");
      await setAccent(key);
      await debugLog(`settings:accent ${key}`);
      // Apply immediately (index.html should read accent too, but we set CSS var here)
      applyAccentCSS(key);
      rootEl.querySelector("#accentCurrent").textContent = key;
    });
  });
  applyAccentCSS(s.accent || "red");

  // Export
  rootEl.querySelector("#btnExport").addEventListener("click", async () => {
    const json = await exportBackupJSON();
    const filename = `ritual-backup-${todayKey()}.json`;
    downloadText(filename, json, "application/json");
    await debugLog("settings:exportBackup");
    toast(rootEl, "Backup exported");
  });

  // Import (file input)
  const fileInput = rootEl.querySelector("#fileImport");
  const previewBox = rootEl.querySelector("#importPreview");

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;

    try {
      const text = await file.text();

      // We do a "dry parse" preview by calling importBackupJSON but NOT applying yet
      // RC1 importBackupJSON already replaces immediately; so we must preview first ourselves.
      const preview = safePreviewBackup(text);
      if (!preview.ok) {
        previewBox.classList.remove("hidden");
        previewBox.innerHTML = `<div class="muted small">Invalid backup file.</div>`;
        return;
      }

      previewBox.classList.remove("hidden");
      previewBox.innerHTML = `
        <div style="font-weight:900;">Import Preview</div>
        <div class="muted small" style="margin-top:6px;">
          Exported: <b>${escapeHTML(preview.data.exportedAt || "unknown")}</b><br/>
          Tasks: <b>${preview.data.taskCount}</b> • Templates: <b>${preview.data.templateCount}</b> • Holidays: <b>${preview.data.holidayCount}</b><br/>
          Mode: <b>Replace All</b>
        </div>
        <div class="row" style="gap:10px; margin-top:12px; flex-wrap:wrap;">
          <button class="btn btn--danger" id="btnDoImport" type="button">Confirm Restore</button>
          <button class="btn" id="btnCancelImport" type="button">Cancel</button>
        </div>
      `;

      previewBox.querySelector("#btnCancelImport").onclick = () => {
        previewBox.classList.add("hidden");
        previewBox.innerHTML = "";
        fileInput.value = "";
      };

      previewBox.querySelector("#btnDoImport").onclick = async () => {
        // Confirm again (safety)
        if (!confirm("Restore backup and replace all local data?")) return;

        // This will replace everything
        const info = await importBackupJSON(text);
        await debugLog("settings:importBackup");

        toast(rootEl, "Restore complete");
        previewBox.classList.add("hidden");
        previewBox.innerHTML = "";
        fileInput.value = "";

        // Re-render settings to reflect restored settings
        await renderSettings(rootEl);
      };

    } catch (e) {
      previewBox.classList.remove("hidden");
      previewBox.innerHTML = `<div class="muted small">Import failed.</div>`;
    }
  });

  // Holidays add
  rootEl.querySelector("#btnAddHoliday").addEventListener("click", async () => {
    const dateKey = (rootEl.querySelector("#holidayDate").value || "").trim();
    const name = (rootEl.querySelector("#holidayName").value || "").trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
      toast(rootEl, "Date must be YYYY-MM-DD");
      return;
    }
    if (!name) {
      toast(rootEl, "Enter a name");
      return;
    }

    await addCustomHoliday(dateKey, name);
    await debugLog(`settings:addHoliday ${dateKey}`);
    await renderSettings(rootEl);
  });

  // Holiday list actions
  rootEl.querySelectorAll("[data-hdel]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-hdel");
      if (!confirm("Delete this custom holiday?")) return;
      await deleteCustomHoliday(id);
      await debugLog(`settings:deleteHoliday ${id}`);
      await renderSettings(rootEl);
    });
  });

  rootEl.querySelectorAll("[data-hedit]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-hedit");
      const dateKey = btn.getAttribute("data-date") || "";
      const name = btn.getAttribute("data-name") || "";
      openEditHolidaySheet(rootEl, id, dateKey, name);
    });
  });

  // Debug toggle
  rootEl.querySelector("#btnToggleDebug").addEventListener("click", async () => {
    const next = !s.debugEnabled;
    await setDebugEnabled(next);
    await debugLog(`settings:debug ${next}`);
    toast(rootEl, next ? "Debug enabled" : "Debug disabled");
    await renderSettings(rootEl);
  });

  // Copy debug
  rootEl.querySelector("#btnCopyDebug").addEventListener("click", async () => {
    const lines = await getDebugLog();
    const text = lines.join("\n");
    await copyToClipboard(text);
    toast(rootEl, "Debug copied");
  });

  // Clear debug
  rootEl.querySelector("#btnClearDebug").addEventListener("click", async () => {
    if (!confirm("Clear debug log?")) return;
    await clearDebugLog();
    toast(rootEl, "Debug cleared");
  });
}

// ----------------- UI helpers -----------------
function accentChip(key, label) {
  return `<button class="chip" data-accent="${key}" type="button">${label}</button>`;
}

function renderHolidayList(holidays) {
  if (!holidays.length) return `<div class="muted">No custom holidays yet.</div>`;

  const sorted = [...holidays].sort((a,b) => (a.dateKey||"").localeCompare(b.dateKey||""));
  return sorted.map(h => `
    <div class="hRow">
      <div class="hLeft">
        <span class="pinkDot"></span>
        <div>
          <div style="font-weight:900;">${escapeHTML(h.name)}</div>
          <div class="muted small">${escapeHTML(h.dateKey)}</div>
        </div>
      </div>
      <div class="row" style="gap:8px;">
        <button class="btn" data-hedit="${h.id}" data-date="${escapeAttr(h.dateKey)}" data-name="${escapeAttr(h.name)}" type="button">Edit</button>
        <button class="btn btn--danger" data-hdel="${h.id}" type="button">Delete</button>
      </div>
    </div>
  `).join("");
}

function openEditHolidaySheet(rootEl, id, dateKey, name) {
  const host = rootEl.querySelector("#sheetHost");
  host.innerHTML = `
    <div class="sheetBackdrop"></div>
    <div class="sheetPanel">
      <div class="sheetHeader">
        <div>
          <div class="sheetTitle">Edit Holiday</div>
          <div class="muted small">Update date or name</div>
        </div>
        <button class="iconbtn" id="xClose" type="button">✕</button>
      </div>

      <div class="divider"></div>

      <input class="input" id="editDate" value="${escapeAttr(dateKey)}" />
      <input class="input" id="editName" value="${escapeAttr(name)}" style="margin-top:10px;" />

      <div class="divider"></div>

      <div class="row" style="gap:10px; justify-content:flex-end; flex-wrap:wrap;">
        <button class="btn btn--primary" id="btnSave" type="button">Save</button>
        <button class="btn" id="btnCancel" type="button">Cancel</button>
      </div>
    </div>
  `;

  const close = () => { host.innerHTML = ""; };

  host.querySelector("#xClose").onclick = close;
  // (Keep clean: no backdrop close)
  host.querySelector(".sheetBackdrop").onclick = () => {};

  host.querySelector("#btnCancel").onclick = close;
  host.querySelector("#btnSave").onclick = async () => {
    const newDate = (host.querySelector("#editDate").value || "").trim();
    const newName = (host.querySelector("#editName").value || "").trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
      alert("Date must be YYYY-MM-DD");
      return;
    }
    if (!newName) {
      alert("Name required");
      return;
    }

    await updateCustomHoliday(id, { dateKey: newDate, name: newName });
    await debugLog(`settings:updateHoliday ${id}`);
    close();
    await renderSettings(rootEl);
  };

  injectStylesOnce();
}

function applyAccentCSS(accentKey) {
  const map = {
    red: "#ef4444",
    ember: "#f97316",
    orange: "#f59e0b",
    pink: "#ec4899",
    purple: "#a855f7",
    blue: "#3b82f6",
    green: "#22c55e"
  };
  const val = map[String(accentKey || "red").toLowerCase()] || map.red;
  document.documentElement.style.setProperty("--accent", val);
}

function toast(rootEl, msg) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  rootEl.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
}

function downloadText(filename, text, mime) {
  const blob = new Blob([text], { type: mime || "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function safePreviewBackup(jsonText) {
  try {
    const data = JSON.parse(jsonText);
    const info = {
      exportedAt: data.exportedAt || "",
      taskCount: Array.isArray(data.tasks) ? data.tasks.length : 0,
      templateCount: Array.isArray(data.templates) ? data.templates.length : 0,
      holidayCount: Array.isArray(data.holidays) ? data.holidays.length : 0
    };
    if (!data.tasks || !data.templates || !data.settings) return { ok: false };
    return { ok: true, data: info };
  } catch {
    return { ok: false };
  }
}

function escapeHTML(s) {
  return (s || "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}
function escapeAttr(s) {
  return escapeHTML(s).replaceAll("\n"," ");
}

// ----------------- Styles -----------------
function injectStylesOnce() {
  if (_stylesInjected) return;
  _stylesInjected = true;

  const style = document.createElement("style");
  style.textContent = `
    .chips{ display:flex; flex-wrap:wrap; gap:10px; }
    .chip{
      padding:10px 12px;
      border-radius:14px;
      border:1px solid rgba(255,255,255,.12);
      background: rgba(255,255,255,.04);
      font-weight:900;
    }

    .fileBtn{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      padding: 12px 14px;
      border-radius: 14px;
      border: 1px solid rgba(255,255,255,.12);
      background: rgba(255,255,255,.04);
      font-weight: 900;
      cursor: pointer;
      position: relative;
      overflow:hidden;
    }
    .fileBtn input{
      position:absolute;
      inset:0;
      opacity:0;
      cursor:pointer;
    }

    .previewBox{
      margin-top:12px;
      padding:12px;
      border-radius:14px;
      border:1px solid rgba(255,255,255,.12);
      background: rgba(255,255,255,.03);
    }
    .hidden{ display:none; }

    .pinkDot{
      display:inline-block;
      width:8px;height:8px;border-radius:99px;
      background:#ec4899;
      margin-right:8px;
      transform: translateY(-1px);
    }

    .hRow{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      border:1px solid rgba(255,255,255,.10);
      background: rgba(255,255,255,.03);
      border-radius:14px;
      padding:12px;
      margin-bottom:10px;
    }
    .hLeft{ display:flex; align-items:center; gap:12px; }

    .btn--danger{
      background: rgba(239,68,68,.18);
      border-color: rgba(239,68,68,.30);
    }

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

    .toast{
      position:fixed; top:14px; left:50%;
      transform: translateX(-50%);
      padding:10px 14px;
      border-radius:999px;
      background: rgba(255,255,255,.08);
      border:1px solid rgba(255,255,255,.12);
      backdrop-filter: blur(12px);
      z-index:10000;
      font-weight:900;
    }
  `;
  document.head.appendChild(style);
}