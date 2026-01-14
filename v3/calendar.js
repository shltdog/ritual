// Ritual V3 — calendar.js
// Phase B: calendar grid + select a day + show task count
// (No fancy visuals yet. Full SwiftUI-like calendar comes later.)

import { dateKeyFromDate, getTasksForDate } from "./store.js";

export async function renderCalendar(rootEl) {
  // state (kept in module memory)
  if (!renderCalendar.state) {
    const now = new Date();
    renderCalendar.state = {
      year: now.getFullYear(),
      month: now.getMonth(), // 0-11
      selected: dateKeyFromDate(now)
    };
  }

  const st = renderCalendar.state;
  const monthDate = new Date(st.year, st.month, 1);

  rootEl.innerHTML = `
    <div class="card card--hero">
      <div class="row between">
        <button class="iconbtn" id="calPrev" aria-label="Previous Month">‹</button>
        <div>
          <div class="h2" id="calTitle">${monthTitle(monthDate)}</div>
          <div class="muted small">Tap a day to view its task count.</div>
        </div>
        <button class="iconbtn" id="calNext" aria-label="Next Month">›</button>
      </div>
    </div>

    <div class="card">
      <div class="calDow" id="calDow"></div>
      <div class="calGrid" id="calGrid"></div>
    </div>

    <div class="card">
      <div class="h2">Selected</div>
      <div class="muted small" id="calSelectedLine">Loading…</div>
    </div>
  `;

  // weekday headers
  const dow = ["S","M","T","W","T","F","S"];
  rootEl.querySelector("#calDow").innerHTML = dow.map(d => `<div class="dow">${d}</div>`).join("");

  // render month grid
  const gridEl = rootEl.querySelector("#calGrid");
  gridEl.innerHTML = "";

  const cells = buildMonthGrid(st.year, st.month);
  // Preload counts for visible dates (simple, not optimized)
  const counts = {};
  for (const c of cells) {
    if (!c) continue;
    const key = dateKeyFromDate(c);
    const tasks = await getTasksForDate(key);
    counts[key] = tasks.length;
  }

  for (const c of cells) {
    if (!c) {
      gridEl.insertAdjacentHTML("beforeend", `<div class="dayCell empty"></div>`);
      continue;
    }

    const key = dateKeyFromDate(c);
    const day = c.getDate();
    const isSelected = key === st.selected;
    const hasTasks = (counts[key] || 0) > 0;

    gridEl.insertAdjacentHTML("beforeend", `
      <button class="dayCell ${isSelected ? "selected" : ""}" data-key="${key}">
        <div class="dayNum">${day}</div>
        <div class="dayMeta">${hasTasks ? "•" : ""}</div>
      </button>
    `);
  }

  // click day -> set selected
  gridEl.querySelectorAll(".dayCell[data-key]").forEach(btn => {
    btn.addEventListener("click", async () => {
      renderCalendar.state.selected = btn.getAttribute("data-key");
      await renderCalendar(rootEl);
    });
  });

  // selected line
  const selKey = st.selected;
  const selTasks = await getTasksForDate(selKey);
  rootEl.querySelector("#calSelectedLine").textContent =
    `${selKey} — ${selTasks.length} task${selTasks.length === 1 ? "" : "s"}`;

  // prev/next month
  rootEl.querySelector("#calPrev").addEventListener("click", async () => {
    const d = new Date(st.year, st.month - 1, 1);
    renderCalendar.state.year = d.getFullYear();
    renderCalendar.state.month = d.getMonth();
    await renderCalendar(rootEl);
  });

  rootEl.querySelector("#calNext").addEventListener("click", async () => {
    const d = new Date(st.year, st.month + 1, 1);
    renderCalendar.state.year = d.getFullYear();
    renderCalendar.state.month = d.getMonth();
    await renderCalendar(rootEl);
  });
}

// ---------- helpers ----------
function monthTitle(d) {
  return d.toLocaleString(undefined, { month: "long", year: "numeric" });
}

// Returns array sized multiple of 7. Each item is Date or null.
function buildMonthGrid(year, month) {
  const first = new Date(year, month, 1);
  const firstDow = first.getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const out = [];
  for (let i = 0; i < firstDow; i++) out.push(null);

  for (let day = 1; day <= daysInMonth; day++) {
    out.push(new Date(year, month, day, 12, 0, 0));
  }

  while (out.length % 7 !== 0) out.push(null);
  return out;
}
