// Ritual V3 — templates.js (RC1)
// Real UI templates + daily "Add recurring tasks today?" prompt (once/day).
// No prompt() usage. Uses store.js RC1 APIs.

import {
  todayKey,
  getTemplates,
  addTemplate,
  updateTemplate,
  deleteTemplate,
  applyTemplatesToDate,
  getLastRecurringPromptDate,
  setLastRecurringPromptDate,
  debugLog
} from "./store.js";

let _stylesInjected = false;

// Screen renderer (Settings -> Open Templates can route to this later, or you can wire it to a sheet)
export async function renderTemplates(rootEl) {
  injectStylesOnce();

  const templates = await getTemplates();

  rootEl.innerHTML = `
    <div class="card card--hero">
      <div class="row between">
        <div>
          <div class="h2">Recurring Templates</div>
          <div class="muted small">Daily / Weekly tasks you can add to days.</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="h2">Add Template</div>
      <div class="muted small">Choose daily or weekly, then add.</div>
      <div class="divider"></div>

      <div class="row" style="gap:10px; flex-wrap:wrap;">
        <input class="input" id="tplTitle" placeholder="e.g., Laundry" />
      </div>

      <div class="row" style="gap:10px; margin-top:10px; flex-wrap:wrap;">
        <button class="btn btn--primary" id="modeDaily" type="button">Daily</button>
        <button class="btn" id="modeWeekly" type="button">Weekly</button>

        <select class="input" id="weekdaySel" style="max-width:200px; display:none;">
          <option value="0">Sunday</option>
          <option value="1">Monday</option>
          <option value="2">Tuesday</option>
          <option value="3">Wednesday</option>
          <option value="4">Thursday</option>
          <option value="5">Friday</option>
          <option value="6">Saturday</option>
        </select>

        <button class="btn btn--primary" id="btnAddTpl" type="button">Add</button>
      </div>

      <div class="muted small" id="modeLine" style="margin-top:10px;">Mode: Daily</div>
    </div>

    <div class="card grow">
      <div class="h2">Templates</div>
      <div class="muted small">Toggle On/Off. Delete removes it.</div>
      <div class="divider"></div>

      <div id="tplList">
        ${templates.length ? templates.map(t => tplRow(t)).join("") : `<div class="muted">No templates yet.</div>`}
      </div>
    </div>

    <div id="sheetHost"></div>
  `;

  // Mode state
  let mode = "daily"; // daily | weekly
  const titleEl = rootEl.querySelector("#tplTitle");
  const weekdaySel = rootEl.querySelector("#weekdaySel");
  const modeLine = rootEl.querySelector("#modeLine");

  const setMode = (m) => {
    mode = m;
    if (mode === "weekly") {
      weekdaySel.style.display = "";
      rootEl.querySelector("#modeWeekly").classList.add("btn--primary");
      rootEl.querySelector("#modeDaily").classList.remove("btn--primary");
      modeLine.textContent = "Mode: Weekly";
    } else {
      weekdaySel.style.display = "none";
      rootEl.querySelector("#modeDaily").classList.add("btn--primary");
      rootEl.querySelector("#modeWeekly").classList.remove("btn--primary");
      modeLine.textContent = "Mode: Daily";
    }
  };

  rootEl.querySelector("#modeDaily").onclick = () => setMode("daily");
  rootEl.querySelector("#modeWeekly").onclick = () => setMode("weekly");

  // Add template
  rootEl.querySelector("#btnAddTpl").onclick = async () => {
    const title = (titleEl.value || "").trim();
    if (!title) return toast(rootEl, "Enter a title");

    const recurrence =
      mode === "daily"
        ? { type: "daily" }
        : { type: "weekly", weekday: Number(weekdaySel.value) };

    await addTemplate({ title, recurrence, enabled: true });
    await debugLog(`templates:add ${title}`);

    titleEl.value = "";
    await renderTemplates(rootEl);
  };

  // Toggle & delete
  rootEl.querySelectorAll("[data-toggle]").forEach(btn => {
    btn.onclick = async () => {
      const id = btn.getAttribute("data-toggle");
      const cur = templates.find(x => x.id === id);
      if (!cur) return;
      await updateTemplate(id, { enabled: !cur.enabled });
      await debugLog(`templates:toggle ${id}`);
      await renderTemplates(rootEl);
    };
  });

  rootEl.querySelectorAll("[data-del]").forEach(btn => {
    btn.onclick = async () => {
      const id = btn.getAttribute("data-del");
      if (!confirm("Delete this template?")) return;
      await deleteTemplate(id);
      await debugLog(`templates:delete ${id}`);
      await renderTemplates(rootEl);
    };
  });

  rootEl.querySelectorAll("[data-edit]").forEach(btn => {
    btn.onclick = async () => {
      const id = btn.getAttribute("data-edit");
      const cur = templates.find(x => x.id === id);
      if (!cur) return;
      openEditSheet(rootEl, cur);
    };
  });
}

// =====================================
// Daily prompt (call this once on app boot)
// =====================================
export async function maybePromptRecurringForToday() {
  const tKey = todayKey();
  const last = await getLastRecurringPromptDate();
  if (last === tKey) return { shown: false };

  const templates = (await getTemplates()).filter(t => t.enabled);
  if (!templates.length) {
    await setLastRecurringPromptDate(tKey);
    return { shown: false };
  }

  const applicable = templates.filter(t => appliesToDate(t, tKey));
  if (!applicable.length) {
    await setLastRecurringPromptDate(tKey);
    return { shown: false };
  }

  // Build sheet with checklist
  const host = ensureGlobalSheetHost();
  host.innerHTML = `
    <div class="sheetBackdrop"></div>

    <div class="sheetPanel">
      <div class="sheetHeader">
        <div>
          <div class="sheetTitle">Add recurring tasks for today?</div>
          <div class="muted small">${tKey} • Select what to add</div>
        </div>
        <button class="iconbtn" id="xClose" type="button">✕</button>
      </div>

      <div class="divider"></div>

      <div id="recList" class="recList">
        ${applicable.map((t, i) => `
          <label class="recRow">
            <input type="checkbox" class="recChk" data-i="${i}" checked />
            <div class="recText">
              <div style="font-weight:900;">${escapeHTML(t.title)}</div>
              <div class="muted small">${recLabel(t.recurrence)}</div>
            </div>
          </label>
        `).join("")}
      </div>

      <div class="divider"></div>

      <div class="sheetFooter">
        <button class="btn btn--primary" id="btnAddSel" type="button">Add Selected</button>
        <button class="btn" id="btnSkip" type="button">Skip</button>
      </div>
    </div>
  `;

  const close = async (markDone = true) => {
    host.innerHTML = "";
    if (markDone) await setLastRecurringPromptDate(tKey);
  };

  host.querySelector("#xClose").onclick = () => close(true);
  // no backdrop close (keeps consistent with your preference for X-only)
  host.querySelector(".sheetBackdrop").onclick = () => {};

  host.querySelector("#btnSkip").onclick = () => close(true);

  host.querySelector("#btnAddSel").onclick = async () => {
    const checks = Array.from(host.querySelectorAll(".recChk"));
    const chosen = [];
    checks.forEach(cb => {
      if (!cb.checked) return;
      const i = Number(cb.getAttribute("data-i"));
      chosen.push(applicable[i]);
    });

    // Apply templates idempotently by title (store.js handles it)
    // We apply all enabled templates for today — but only from chosen list.
    // So we temporarily apply by enabling chosen only (simple approach: apply all then nothing else)
    // Safer: apply by manually adding tasks (but store.js already does idempotent).
    // We'll just call applyTemplatesToDate and rely on enabled templates.
    // To support chosen-only, we do a one-off: disable unchosen -> apply -> re-enable.
    const all = await getTemplates();
    const chosenIds = new Set(chosen.map(t => t.id));
    const changed = [];

    for (const t of all) {
      if (!t.enabled) continue;
      if (!chosenIds.has(t.id)) {
        changed.push(t);
        await updateTemplate(t.id, { enabled: false });
      }
    }

    const res = await applyTemplatesToDate(tKey);

    // restore enabled state
    for (const t of changed) {
      await updateTemplate(t.id, { enabled: true });
    }

    await debugLog(`templates:promptAdd added=${res.added}`);
    await close(true);

    // Small hint
    try { alert(`Added ${res.added} tasks ✅`); } catch {}
  };

  injectGlobalSheetStylesOnce();
  return { shown: true, count: applicable.length };
}

// =====================================
// Helpers
// =====================================
function tplRow(t) {
  const rec = t.recurrence || { type: "daily" };
  const label = recLabel(rec);

  return `
    <div class="tRow">
      <div class="tLeft">
        <div class="dot" style="${t.enabled ? "background:var(--accent);border-color:var(--accent);" : ""}"></div>
        <div>
          <div style="font-weight:900;">${escapeHTML(t.title)}</div>
          <div class="muted small">${escapeHTML(label)}</div>
        </div>
      </div>

      <div class="row" style="gap:8px;">
        <button class="btn" data-toggle="${t.id}" type="button">${t.enabled ? "On" : "Off"}</button>
        <button class="btn" data-edit="${t.id}" type="button">Edit</button>
        <button class="btn btn--danger" data-del="${t.id}" type="button">Delete</button>
      </div>
    </div>
  `;
}

function openEditSheet(rootEl, tpl) {
  const host = rootEl.querySelector("#sheetHost");
  host.innerHTML = `
    <div class="sheetBackdrop"></div>

    <div class="sheetPanel">
      <div class="sheetHeader">
        <div>
          <div class="sheetTitle">Edit Template</div>
          <div class="muted small">Title + recurrence</div>
        </div>
        <button class="iconbtn" id="xClose" type="button">✕</button>
      </div>

      <div class="divider"></div>

      <input class="input" id="eTitle" value="${escapeAttr(tpl.title)}" />

      <div class="divider"></div>

      <div class="row" style="gap:10px; flex-wrap:wrap;">
        <button class="btn btn--primary" id="eDaily" type="button">Daily</button>
        <button class="btn" id="eWeekly" type="button">Weekly</button>
        <select class="input" id="eWeekday" style="max-width:200px; display:none;">
          <option value="0">Sunday</option><option value="1">Monday</option><option value="2">Tuesday</option>
          <option value="3">Wednesday</option><option value="4">Thursday</option><option value="5">Friday</option><option value="6">Saturday</option>
        </select>
      </div>

      <div class="divider"></div>

      <div class="sheetFooter">
        <button class="btn btn--primary" id="eSave" type="button">Save</button>
        <button class="btn" id="eCancel" type="button">Cancel</button>
      </div>
    </div>
  `;

  const close = () => { host.innerHTML = ""; };
  host.querySelector("#xClose").onclick = close;
  host.querySelector("#eCancel").onclick = close;
  host.querySelector(".sheetBackdrop").onclick = () => {}; // no close

  let mode = tpl.recurrence?.type === "weekly" ? "weekly" : "daily";
  const weekdaySel = host.querySelector("#eWeekday");

  const setMode = (m) => {
    mode = m;
    if (mode === "weekly") {
      weekdaySel.style.display = "";
      host.querySelector("#eWeekly").classList.add("btn--primary");
      host.querySelector("#eDaily").classList.remove("btn--primary");
    } else {
      weekdaySel.style.display = "none";
      host.querySelector("#eDaily").classList.add("btn--primary");
      host.querySelector("#eWeekly").classList.remove("btn--primary");
    }
  };

  host.querySelector("#eDaily").onclick = () => setMode("daily");
  host.querySelector("#eWeekly").onclick = () => setMode("weekly");

  // set initial weekday
  if (tpl.recurrence?.type === "weekly") {
    weekdaySel.value = String(tpl.recurrence.weekday ?? 0);
    setMode("weekly");
  } else {
    setMode("daily");
  }

  host.querySelector("#eSave").onclick = async () => {
    const title = (host.querySelector("#eTitle").value || "").trim();
    if (!title) return;

    const recurrence =
      mode === "daily"
        ? { type: "daily" }
        : { type: "weekly", weekday: Number(weekdaySel.value) };

    await updateTemplate(tpl.id, { title, recurrence });
    await debugLog(`templates:edit ${tpl.id}`);
    close();
    await renderTemplates(rootEl);
  };

  injectStylesOnce();
}

function appliesToDate(tpl, dateKey) {
  const d = new Date(dateKey + "T12:00:00");
  const wd = d.getDay(); // 0..6
  const rec = tpl.recurrence || { type: "daily" };
  if (rec.type === "daily") return true;
  if (rec.type === "weekly") return Number(rec.weekday) === wd;
  return false;
}

function recLabel(rec) {
  if (!rec || rec.type === "daily") return "Daily";
  if (rec.type === "weekly") return `Weekly (${weekdayName(rec.weekday)})`;
  return "Daily";
}

function weekdayName(n) {
  const names = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  return names[Number(n) ?? 0] || "Sunday";
}

// Global sheet host for daily prompt (not tied to a specific screen root)
function ensureGlobalSheetHost() {
  let host = document.getElementById("ritualSheetHost");
  if (!host) {
    host = document.createElement("div");
    host.id = "ritualSheetHost";
    document.body.appendChild(host);
  }
  return host;
}

let _globalSheetStyles = false;
function injectGlobalSheetStylesOnce() {
  if (_globalSheetStyles) return;
  _globalSheetStyles = true;
  injectStylesOnce();
}

function toast(rootEl, msg) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  rootEl.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

function escapeHTML(s) {
  return (s || "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}
function escapeAttr(s) {
  return escapeHTML(s).replaceAll("\n"," ");
}

function injectStylesOnce() {
  if (_stylesInjected) return;
  _stylesInjected = true;

  const style = document.createElement("style");
  style.textContent = `
    .tRow{
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
    .tLeft{ display:flex; gap:12px; align-items:center; }
    .dot{
      width:10px;height:10px;border-radius:99px;
      border:1px solid rgba(255,255,255,.16);
      background: rgba(255,255,255,.12);
      flex:0 0 auto;
    }
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
    .sheetFooter{
      display:flex; gap:10px; justify-content:flex-end; flex-wrap:wrap;
    }

    .recList{ display:flex; flex-direction:column; gap:10px; }
    .recRow{
      display:flex; gap:12px; align-items:flex-start;
      border:1px solid rgba(255,255,255,.10);
      background: rgba(255,255,255,.03);
      border-radius:14px;
      padding:12px;
    }
    .recRow input{ transform: scale(1.15); margin-top:2px; }
    .recText{ display:flex; flex-direction:column; gap:2px; }

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