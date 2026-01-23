// score.js

import {
  getTasksForDate,
  POINTS_PER_TASK,
  LEVELS
} from './store.js';

export async function renderScore(rootEl) {
  rootEl.innerHTML = `
    <div id="score-card" class="frosted-card" style="text-align:center;">
      <div style="position: relative; display: inline-block; margin-top: 16px;">
        <img src="/v3/images/level-frame-base.png" style="width: 160px; height: 160px;" />
        <img id="level-icon" src="" style="position:absolute; top:0; left:0; width:160px; height:160px;" />
      </div>
      <h2 id="level-name" style="margin: 12px 0 4px 0;"></h2>
      <div id="xp-total" style="margin-bottom: 12px;"></div>
      <div style="height: 12px; background: #333; border-radius: 6px; overflow: hidden; margin: 0 24px 16px 24px;">
        <div id="xp-bar" style="height: 100%; background: var(--accent-color); width: 0%;"></div>
      </div>
    </div>
  `;

  const xpTotal = await calculateTotalXP();
  const level = getCurrentLevel(xpTotal);
  const next = getNextLevel(level);

  const levelIcon = rootEl.querySelector('#level-icon');
  const levelName = rootEl.querySelector('#level-name');
  const xpDisplay = rootEl.querySelector('#xp-total');
  const xpBar = rootEl.querySelector('#xp-bar');

  levelIcon.src = level.icon;
  levelName.textContent = level.name;
  xpDisplay.textContent = `${xpTotal} XP`;

  if (next) {
    const range = next.threshold - level.threshold;
    const intoLevel = xpTotal - level.threshold;
    const percent = Math.min(100, Math.floor((intoLevel / range) * 100));
    xpBar.style.width = `${percent}%`;
  } else {
    xpBar.style.width = '100%';
  }
}

async function calculateTotalXP() {
  let xp = 0;
  const today = new Date().toISOString().slice(0, 10);
  const daysBack = 365;
  for (let i = 0; i < daysBack; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = date.toISOString().slice(0, 10);
    const tasks = await getTasksForDate(key);
    const completed = tasks.filter(t => t.done).length;
    xp += completed * POINTS_PER_TASK;
  }
  return xp;
}

function getCurrentLevel(xp) {
  let current = LEVELS[0];
  for (const level of LEVELS) {
    if (xp >= level.threshold) current = level;
    else break;
  }
  return {
    ...current,
    icon: `/v3/images/level/level-${LEVELS.indexOf(current) + 1}.png`
  };
}

function getNextLevel(currentLevel) {
  const idx = LEVELS.indexOf(currentLevel);
  return LEVELS[idx + 1] || null;
}
