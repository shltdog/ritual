// Ritual V3 — score.js (RC1)
// Uses IndexedDB scan for total score (so we don't need to edit store.js again).
// Shows: Total score, Today score, Level, Progress to next.

import { todayKey, getTasksForDate } from "./store.js";

const POINTS_PER_TASK = 10;

const LEVELS = [
  { key: "rookie",  title: "Rookie",  threshold: 0 },
  { key: "runner",  title: "Runner",  threshold: 200 },
  { key: "striver", title: "Striver", threshold: 600 },
  { key: "knight",  title: "Knight",  threshold: 1200 },
  { key: "legend",  title: "Legend",  threshold: 2000 }
];

export async function renderScore(rootEl) {
  injectStylesOnce();

  // Total score from all completed tasks (scan IndexedDB)
  const totalDone = await countAllCompletedTasks();
  const totalScore = totalDone * POINTS_PER_TASK;

  // Today's score
  const tKey = todayKey();
  const todayTasks = await getTasksForDate(tKey);
  const todayDone = todayTasks.filter(t => t.done).length;
  const todayScore = todayDone * POINTS_PER_TASK;

  const level = currentLevel(totalScore);
  const next = nextLevel(level);

  const progress = next
    ? clamp((totalScore - level.threshold) / (next.threshold - level.threshold), 0, 1)
    : 1;

  rootEl.innerHTML = `
    <div class="card card--hero">
      <div class="row between">
        <div>
          <div class="muted small">Level</div>
          <div class="h2" style="margin:0;">${level.title}</div>
        </div>

        <div style="text-align:right;">
          <div class="muted small">Total Score</div>
          <div class="h2" style="margin:0;">${totalScore}</div>
        </div>
      </div>

      <div class="divider"></div>

      <div class="muted small">
        Today: <b>${todayScore}</b> pts • Completed: <b>${todayDone}</b>
      </div>

      <div class="divider"></div>

      <div class="muted small">
        ${next ? `Next: <b>${next.title}</b> at ${next.threshold}` : "Max level reached"}
      </div>

      <div class="progress" style="margin-top:10px;">
        <div class="progress__bar" style="width:${Math.round(progress * 100)}%;"></div>
      </div>
    </div>

    <div class="card grow">
      <div class="h2">Levels</div>
      <div class="muted small">10 points per completed task.</div>
      <div class="divider"></div>

      <div class="levelList">
        ${LEVELS.map(l => rowLevel(l, level)).join("")}
      </div>
    </div>
  `;
}

// ---------- UI ----------
function rowLevel(l, current) {
  const active = l.key === current.key;
  return `
    <div class="levelRow ${active ? "active" : ""}">
      <div class="levelLeft">
        <div class="levelDot" style="${active ? "background:var(--accent);border-color:var(--accent);" : ""}"></div>
        <div style="display:flex;flex-direction:column;gap:2px;">
          <div style="font-weight:900;">${l.title}</div>
          <div class="muted small">${l.threshold}+</div>
        </div>
      </div>
    </div>
  `;
}

let _stylesInjected = false;
function injectStylesOnce() {
  if (_stylesInjected) return;
  _stylesInjected = true;

  const style = document.createElement("style");
  style.textContent = `
    .levelList{ display:flex; flex-direction:column; gap:10px; }
    .levelRow{
      border:1px solid rgba(255,255,255,.10);
      background: rgba(255,255,255,.03);
      border-radius:14px;
      padding:12px;
    }
    .levelRow.active{
      border-color: color-mix(in oklab, var(--accent), #ffffff 25%);
      background: color-mix(in oklab, var(--accent), transparent 90%);
    }
    .levelLeft{ display:flex; gap:12px; align-items:center; }
    .levelDot{
      width:10px;height:10px;border-radius:99px;
      border:1px solid rgba(255,255,255,.16);
      background: rgba(255,255,255,.12);
      flex:0 0 auto;
    }
  `;
  document.head.appendChild(style);
}

// ---------- Level helpers ----------
function currentLevel(score) {
  let cur = LEVELS[0];
  for (const l of LEVELS) {
    if (score >= l.threshold) cur = l;
  }
  return cur;
}
function nextLevel(level) {
  const i = LEVELS.findIndex(x => x.key === level.key);
  if (i < 0) return null;
  return LEVELS[i + 1] || null;
}
function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

// ---------- IndexedDB scan (total completed tasks) ----------
async function countAllCompletedTasks() {
  // Must match your store.js settings:
  const DB_NAME = "ritual_v3";
  const DB_VERSION = 2;           // from store.js SCHEMA_VERSION
  const TASK_STORE = "tasks";

  return new Promise((resolve) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onerror = () => resolve(0);

    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(TASK_STORE, "readonly");
      const store = tx.objectStore(TASK_STORE);

      let count = 0;
      const cursor = store.openCursor();

      cursor.onsuccess = () => {
        const c = cursor.result;
        if (!c) return;

        const v = c.value;
        if (v && v.done) count++;
        c.continue();
      };

      cursor.onerror = () => resolve(0);

      tx.oncomplete = () => {
        db.close();
        resolve(count);
      };

      tx.onerror = () => {
        db.close();
        resolve(count);
      };
    };
  });
}