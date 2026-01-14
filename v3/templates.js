// Ritual V3 — templates.js
// Phase B: recurring templates CRUD in IndexedDB
// - daily or weekly(day)
// - enabled toggle
// - delete
// Auto-generation into task lists is Phase C wiring.

import { DB, idbPut, idbDelete, idbGetAll } from "./db.js";
import { uuid, nowISO } from "./store.js";

export async function renderTemplates(rootEl) {
  const templates = await loadTemplates();

  rootEl.innerHTML = `
    <div class="card card--hero">
      <div class="h2">Recurring Templates</div>
      <div class="muted small">Daily / weekly tasks that auto-add to a day.</div>
    </div>

    <div class="card">
      <div class="h2">Add Template</div>
      <div class="divider"></div>

      <div class="stack">
        <input class="input" id="rtTitle" placeholder="e.g., Laundry" />

        <div class="row" style="flex-wrap:wrap; gap:8px;">
          <button class="btn btn--primary" id="rtDaily">Daily</button>
          <button class="btn" id="rtWeekly">Weekly</button>
          <select class="input" id="rtWeekday" style="max-width:180px; display:none;">
            <option value="0">Sunday</option>
            <option value="1">Monday</option>
            <option value="2">Tuesday</option>
            <option value="3">Wednesday</option>
            <option value="4">Thursday</option>
            <option value="5">Friday</option>
            <option value="6">Saturday</option>
          </select>
        </div>

        <button class="btn btn--primary" id="rtAdd">Add Template</button>
        <div class="muted small" id="rtModeLine">Mode: Daily</div>
      </div>
    </div>

    <div class="card grow">
      <div class="h2">Templates</div>
      <div class="muted small">Tap toggle to enable/disable. Tap delete to remove.</div>
      <div class="divider"></div>
      <div id="rtList"></div>
    </div>
  `;

  // Mode state
  let mode = "daily"; // or "weekly"
  const titleEl = rootEl.querySelector("#rtTitle");
  const weekdaySel = rootEl.querySelector("#rtWeekday");
  const modeLine = rootEl.querySelector("#rtModeLine");

  function setMode(next) {
    mode = next;
    if (mode === "weekly") {
      weekdaySel.style.display = "";
      rootEl.querySelector("#rtWeekly").classList.add("btn--primary");
      rootEl.querySelector("#rtDaily").classList.remove("btn--primary");
      modeLine.textContent = "Mode: Weekly";
    } else {
      weekdaySel.style.display = "none";
      rootEl.querySelector("#rtDaily").classList.add("btn--primary");
      rootEl.querySelector("#rtWeekly").classList.remove("btn--primary");
      modeLine.textContent = "Mode: Daily";
    }
  }

  rootEl.querySelector("#rtDaily").addEventListener("click", () => setMode("daily"));
  rootEl.querySelector("#rtWeekly").addEventListener("click", () => setMode("weekly"));

  // Add template
  rootEl.querySelector("#rtAdd").addEventListener("click", async () => {
    const title = (titleEl.value || "").trim();
    if (!title) return alert("Enter a title.");

    const tpl = {
      id: uuid(),
      title,
      type: mode,
      weekday: mode === "weekly" ? parseInt(weekdaySel.value, 10) : null,
      enabled: true,
      createdAt: nowISO(),
      updatedAt: nowISO()
    };

    await idbPut(DB.stores.templates, tpl);
    titleEl.value = "";
    await renderTemplates(rootEl);
  });

  // Render list
  const listEl = rootEl.querySelector("#rtList");
  if (!templates.length) {
    listEl.innerHTML = `<div class="muted">No recurring templates yet.</div>`;
  } else {
    listEl.innerHTML = templates
      .sort((a,b)=> (a.title||"").localeCompare(b.title||""))
      .map(t => templateRow(t))
      .join("");
  }

  // Wire list actions
  listEl.querySelectorAll("[data-action='toggle']").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      const t = templates.find(x => x.id === id);
      if (!t) return;
      t.enabled = !t.enabled;
      t.updatedAt = nowISO();
      await idbPut(DB.stores.templates, t);
      await renderTemplates(rootEl);
    });
  });

  listEl.querySelectorAll("[data-action='delete']").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      if (!confirm("Delete this template?")) return;
      await idbDelete(DB.stores.templates, id);
      await renderTemplates(rootEl);
    });
  });
}

async function loadTemplates() {
  const all = await idbGetAll(DB.stores.templates);
  return all || [];
}

function templateRow(t) {
  const label = t.type === "daily"
    ? "Daily"
    : `Weekly (${weekdayName(t.weekday)})`;

  return `
    <div class="ghost-row" style="justify-content:space-between; gap:12px;">
      <div class="ghost-left" style="gap:12px;">
        <div class="dot" style="${t.enabled ? 'background: var(--accent); border-color: var(--accent);' : ''}"></div>
        <div style="display:flex; flex-direction:column; gap:3px;">
          <div style="font-weight:800;">${escapeHTML(t.title)}</div>
          <div class="muted small">${label}</div>
        </div>
      </div>

      <div class="row" style="gap:8px;">
        <button class="btn" data-action="toggle" data-id="${t.id}">
          ${t.enabled ? "On" : "Off"}
        </button>
        <button class="btn" data-action="delete" data-id="${t.id}" style="border-color: rgba(239,68,68,.35);">
          Delete
        </button>
      </div>
    </div>
  `;
}

function weekdayName(n) {
  const names = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  if (n == null) return "—";
  return names[n] || "—";
}

function escapeHTML(s) {
  return (s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
