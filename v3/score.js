// Ritual V3 — score.js
// Phase B: simple scoring + level display
// (Uses tasks stored in IndexedDB; total score = completed tasks * 10)

import { idbGetAll } from "./db.js";
import { DB } from "./db.js";
import { POINTS_PER_TASK, todayKey, getTasksForDate } from "./store.js";

const LEVELS = [
  { name: "Rookie", threshold: 0 },
  { name: "Runner", threshold: 200 },
  { name: "Striver", threshold: 600 },
  { name: "Knight", threshold: 1200 },
  { name: "Legend", threshold: 2000 }
];

export async function renderScore(rootEl) {
  // total score = sum(completed tasks across all dates) * 10
  const allTasks = await idbGetAll(DB.stores.tasks);
  const completedTotal = allTasks.filter(t => t.done).length;
  const totalScore = completedTotal * POINTS_PER_TASK;

  // today score
  const tKey = todayKey();
  const todayTasks = await getTasksForDate(tKey);
  const todayCompleted = todayTasks.filter(t => t.done).length;
  const todayScore = todayCompleted * POINTS_PER_TASK;

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
          <div class="h2" style="margin:0;">${level.name}</div>
        </div>
        <div style="text-align:right;">
          <div class="muted small">Total Score</div>
          <div class="h2" style="margin:0;">${totalScore}</div>
        </div>
      </div>

      <div class="divider"></div>

      <div class="muted small">Today’s Score: <b>${todayScore}</b> (${todayCompleted} done)</div>

      <div class="divider"></div>

      <div class="muted small">${next ? `Next: ${next.name} at ${next.threshold}` : "Max level reached"}</div>

      <div class="progress" style="margin-top:10px;">
        <div class="progress__bar" style="width:${Math.round(progress * 100)}%;"></div>
      </div>
    </div>

    <div class="card grow">
      <div class="h2">Levels</div>
      <div class="muted small">Points per completed task: ${POINTS_PER_TASK}</div>
      <div class="divider"></div>
      <div class="ghost-list" id="levelsList"></div>
    </div>
  `;

  // list levels
  const list = rootEl.querySelector("#levelsList");
  list.innerHTML = LEVELS.map(l => {
    const active = l.name === level.name;
    return `
      <div class="ghost-row" style="${active ? 'border-color: color-mix(in oklab, var(--accent), #ffffff 25%); background: color-mix(in oklab, var(--accent), transparent 88%);' : ''}">
        <div class="ghost-left">
          <div class="dot" style="${active ? 'background: var(--accent); border-color: var(--accent);' : ''}"></div>
          <div style="display:flex;flex-direction:column;gap:4px;">
            <div style="font-weight:700;">${l.name}</div>
            <div class="muted small">${l.threshold}+</div>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function currentLevel(score) {
  let cur = LEVELS[0];
  for (const l of LEVELS) {
    if (score >= l.threshold) cur = l;
  }
  return cur;
}

function nextLevel(level) {
  const idx = LEVELS.findIndex(x => x.name === level.name);
  if (idx < 0) return null;
  return LEVELS[idx + 1] || null;
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}
