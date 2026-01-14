// Ritual V3 — settings.js
// Phase B: Theme preset + Export Backup + Reminders note

import { getSettings, setSettings, buildBackupPayload, downloadJSON, todayKey } from "./store.js";

const THEME_PRESETS = [
  { id: "ember", label: "Ember", accent: "#ff7a18" },
  { id: "blue", label: "Blue", accent: "#3b82f6" },
  { id: "purple", label: "Purple", accent: "#a855f7" },
  { id: "green", label: "Green", accent: "#22c55e" },
  { id: "orange", label: "Orange", accent: "#f59e0b" },
  { id: "red", label: "Red", accent: "#ef4444" },
  { id: "pink", label: "Pink", accent: "#ec4899" }
];

export async function renderSettings(rootEl) {
  const settings = await getSettings();

  rootEl.innerHTML = `
    <div class="card card--hero">
      <div class="h2">Settings</div>
      <div class="muted small">Theme • Backup • Reminders</div>
    </div>

    <div class="card">
      <div class="h2">Theme</div>
      <div class="muted small">Pick a preset. This controls the accent color.</div>
      <div class="divider"></div>
      <div class="row" style="flex-wrap:wrap; gap:8px;" id="themeButtons"></div>
      <div class="divider"></div>
      <div class="muted small">Current: <b id="themeCurrent"></b></div>
    </div>

    <div class="card">
      <div class="h2">Backup</div>
      <div class="muted small">
        Export a backup JSON in case iOS clears storage.
      </div>
      <div class="divider"></div>
      <button class="btn btn--primary" id="btnExport">Export Backup</button>
      <div class="muted small" style="margin-top:10px;">Last export: <span id="lastExport">—</span></div>
    </div>

    <div class="card">
      <div class="h2">Reminders</div>
      <div class="muted small">
        Use Apple Reminders for recurring reminders.
      </div>
      <div class="divider"></div>
      <div class="muted small">
        Tip: set 4 recurring reminders daily (morning / midday / afternoon / evening).
      </div>
    </div>

    <div class="card">
      <div class="h2">About</div>
      <div class="muted small">
        Ritual • V3<br/>
        Points per completed task: <b>10</b><br/>
        Levels: Rookie(0) • Runner(200) • Striver(600) • Knight(1200) • Legend(2000)
      </div>
    </div>
  `;

  // Fill current theme label
  rootEl.querySelector("#themeCurrent").textContent = settings.themeId || "ember";
  rootEl.querySelector("#lastExport").textContent = settings.lastExportAt ? settings.lastExportAt : "—";

  // Build theme buttons
  const themeWrap = rootEl.querySelector("#themeButtons");
  themeWrap.innerHTML = THEME_PRESETS.map(t => `
    <button class="btn" data-theme="${t.id}">
      ${t.label}
    </button>
  `).join("");

  // Theme click
  themeWrap.querySelectorAll("button[data-theme]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-theme");
      const preset = THEME_PRESETS.find(x => x.id === id) || THEME_PRESETS[0];

      // Apply instantly
      document.documentElement.style.setProperty("--accent", preset.accent);

      // Save to DB
      const next = await setSettings({ themeId: preset.id });
      rootEl.querySelector("#themeCurrent").textContent = next.themeId;
    });
  });

  // Export backup
  rootEl.querySelector("#btnExport").addEventListener("click", async () => {
    try {
      const payload = await buildBackupPayload();
      const key = todayKey();
      const filename = `ritual-backup-${key}.json`;
      downloadJSON(filename, payload);

      const exportedAt = new Date().toISOString();
      const next = await setSettings({ lastExportAt: exportedAt });
      rootEl.querySelector("#lastExport").textContent = next.lastExportAt;
      alert("Backup exported ✅");
    } catch (e) {
      console.error(e);
      alert("Export failed. Try again.");
    }
  });
}
