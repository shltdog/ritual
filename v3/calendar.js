// Ritual V3 — calendar.js (FINAL v2)
// Fix: day taps work reliably on iPhone/PWA by using pointer/touch handlers.
// Includes: US holidays + dots + selected panel.

import { dateKeyFromDate, getTasksForDate } from "./store.js";

export async function renderCalendar(rootEl) {
  if (!renderCalendar.state) {
    const now = new Date();
    renderCalendar.state = {
      year: now.getFullYear(),
      month: now.getMonth(),
      selected: dateKeyFromDate(now)
    };
  }

  const st = renderCalendar.state;
  const monthDate = new Date(st.year, st.month, 1);
  const todayKey = dateKeyFromDate(new Date());
  const holidayMap = getUSHolidayMap(st.year);

  rootEl.innerHTML = `
    <div class="card card--hero">
      <div class="row between">
        <button class="iconbtn" id="calPrev" type="button" aria-label="Previous Month">‹</button>

        <div style="text-align:center;">
          <div class="h2" id="calTitle">${monthTitle(monthDate)}</div>
          <div class="muted small">Tap a day. Holidays included (US).</div>
        </div>

        <button class="iconbtn" id="calNext" type="button" aria-label="Next Month">›</button>
      </div>
    </div>

    <div class="card">
      <div id="calDow"
        style="display:grid;grid-template-columns:repeat(7,1fr);gap:8px;margin-bottom:10px;">
      </div>

      <div id="calGrid"
        style="display:grid;grid-template-columns:repeat(7,1fr);gap:8px;">
      </div>

      <div class="divider"></div>

      <div class="muted small" style="display:flex;gap:12px;flex-wrap:wrap;">
        <span><span style="display:inline-block;width:8px;height:8px;border-radius:99px;background:var(--accent);margin-right:6px;"></span>Today</span>
        <span><span style="display:inline-block;width:8px;height:8px;border-radius:99px;background:rgba(255,255,255,.55);margin-right:6px;"></span>Has tasks</span>
        <span><span style="display:inline-block;width:8px;height:8px;border-radius:99px;background:#fbbf24;margin-right:6px;"></span>Holiday</span>
      </div>
    </div>

    <div class="card">
      <div class="h2">Selected</div>
      <div class="muted small" id="calSelectedLine">Loading…</div>
      <div class="muted small" id="calHolidayLine" style="margin-top:6px;"></div>
    </div>
  `;

  // weekday headers
  const dow = ["S","M","T","W","T","F","S"];
  rootEl.querySelector("#calDow").innerHTML = dow
    .map(d => `<div class="muted small" style="text-align:center;font-weight:900;letter-spacing:.2px;">${d}</div>`)
    .join("");

  const gridEl = rootEl.querySelector("#calGrid");
  gridEl.innerHTML = "";

  const cells = buildMonthGrid(st.year, st.month);

  // Preload task counts for visible dates
  const counts = {};
  for (const c of cells) {
    if (!c) continue;
    const key = dateKeyFromDate(c);
    const tasks = await getTasksForDate(key);
    counts[key] = tasks.length;
  }

  for (const c of cells) {
    if (!c) {
      gridEl.insertAdjacentHTML("beforeend", `<div style="height:44px;"></div>`);
      continue;
    }

    const key = dateKeyFromDate(c);
    const day = c.getDate();

    const isSelected = key === st.selected;
    const isToday = key === todayKey;

    const taskCount = counts[key] || 0;
    const hasTasks = taskCount > 0;

    const holidayName = holidayMap.get(key) || null;
    const hasHoliday = !!holidayName;

    const border = isSelected
      ? "border:1px solid color-mix(in oklab, var(--accent), #fff 25%);"
      : "border:1px solid rgba(255,255,255,.10);";

    const bg = isToday
      ? "background: color-mix(in oklab, var(--accent), transparent 86%);"
      : "background: rgba(255,255,255,.04);";

    const taskDot = hasTasks
      ? `<span title="Has tasks" style="width:6px;height:6px;border-radius:99px;background:rgba(255,255,255,.55);display:inline-block;"></span>`
      : `<span style="width:6px;height:6px;border-radius:99px;background:transparent;display:inline-block;"></span>`;

    const holidayDot = hasHoliday
      ? `<span title="${escapeHTML(holidayName)}" style="width:6px;height:6px;border-radius:99px;background:#fbbf24;display:inline-block;"></span>`
      : `<span style="width:6px;height:6px;border-radius:99px;background:transparent;display:inline-block;"></span>`;

    gridEl.insertAdjacentHTML("beforeend", `
      <button
        type="button"
        class="dayCell"
        data-key="${key}"
        style="
          height:44px;
          border-radius:14px;
          ${border}
          ${bg}
          color: var(--text);
          padding: 8px 0;
          text-align:center;
          display:flex;
          flex-direction:column;
          align-items:center;
          justify-content:center;
          gap:4px;
          touch-action: manipulation;
        "
      >
        <div style="font-weight:900;line-height:1;">${day}</div>
        <div style="display:flex;gap:6px;align-items:center;justify-content:center;line-height:1;">
          ${taskDot}
          ${holidayDot}
        </div>
      </button>
    `);
  }

  // Update selected panel
  await updateSelectedPanel(rootEl, st.selected, counts[st.selected] ?? null, holidayMap.get(st.selected) || "");

  // ===== INSERTED (ONLY ADDITION): day tap now opens that date in Today =====
  const ACTIVE_DATE_KEY = "ritual_active_date";
  const jumpToTodayTab = () => {
    const btn = document.querySelector(".tab[data-tab='today']");
    if (btn) btn.click();
  };
  // =======================================================================

  // Day tap handler (use pointer/touch for iPhone reliability)
  const handler = async (key) => {
    renderCalendar.state.selected = key;

    // Update cell borders without full rerender first (fast feedback)
    gridEl.querySelectorAll(".dayCell").forEach(b => {
      const k = b.getAttribute("data-key");
      if (k === key) {
        b.style.border = "1px solid color-mix(in oklab, var(--accent), #fff 25%)";
      } else {
        b.style.border = "1px solid rgba(255,255,255,.10)";
      }
    });

    // Update selected panel
    await updateSelectedPanel(rootEl, key, counts[key] ?? null, holidayMap.get(key) || "");

    // ===== INSERTED (ONLY ADDITION): store active date + jump to Today =====
    localStorage.setItem(ACTIVE_DATE_KEY, key);
    jumpToTodayTab();
    // =====================================================================
  };

  gridEl.querySelectorAll(".dayCell[data-key]").forEach(btn => {
    const key = btn.getAttribute("data-key");

    // pointer (best)
    btn.addEventListener("pointerup", () => handler(key));

    // fallback
    btn.addEventListener("touchend", (e) => { e.preventDefault(); handler(key); }, { passive: false });
    btn.addEventListener("click", (e) => { e.preventDefault(); handler(key); });
  });

  // month nav
  rootEl.querySelector("#calPrev").addEventListener("click", async () => {
    const d = new Date(st.year, st.month - 1, 1);
    renderCalendar.state.year = d.getFullYear();
    renderCalendar.state.month = d.getMonth();
    renderCalendar.state.selected = dateKeyFromDate(new Date(d.getFullYear(), d.getMonth(), 1, 12,0,0));
    await renderCalendar(rootEl);
  });

  rootEl.querySelector("#calNext").addEventListener("click", async () => {
    const d = new Date(st.year, st.month + 1, 1);
    renderCalendar.state.year = d.getFullYear();
    renderCalendar.state.month = d.getMonth();
    renderCalendar.state.selected = dateKeyFromDate(new Date(d.getFullYear(), d.getMonth(), 1, 12,0,0));
    await renderCalendar(rootEl);
  });
}

async function updateSelectedPanel(rootEl, key, taskCountMaybe, holidayName) {
  let taskCount = taskCountMaybe;
  if (taskCount == null) {
    const tasks = await getTasksForDate(key);
    taskCount = tasks.length;
  }
  rootEl.querySelector("#calSelectedLine").textContent =
    `${key} — ${taskCount} task${taskCount === 1 ? "" : "s"}`;
  rootEl.querySelector("#calHolidayLine").textContent =
    holidayName ? `Holiday: ${holidayName}` : "";
}

// ---------- helpers ----------
function monthTitle(d) {
  return d.toLocaleString(undefined, { month: "long", year: "numeric" });
}

function buildMonthGrid(year, month) {
  const first = new Date(year, month, 1);
  const firstDow = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const out = [];
  for (let i = 0; i < firstDow; i++) out.push(null);
  for (let day = 1; day <= daysInMonth; day++) out.push(new Date(year, month, day, 12, 0, 0));
  while (out.length % 7 !== 0) out.push(null);
  return out;
}

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

  // Federal (observed)
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

  // Common “regular” holidays / observances
  set(new Date(year, 1, 14, 12,0,0), "Valentine’s Day");
  set(new Date(year, 2, 17, 12,0,0), "St. Patrick’s Day");
  set(nthWeekdayOfMonth(year, 4, 0, 2), "Mother’s Day");
  set(nthWeekdayOfMonth(year, 5, 0, 3), "Father’s Day");
  set(new Date(year, 9, 31, 12,0,0), "Halloween");
  set(new Date(year, 11, 31, 12,0,0), "New Year’s Eve");

  return map;
}

function escapeHTML(s) {
  return (s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}