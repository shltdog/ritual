// score.js

import { getTasksForDate, POINTS_PER_TASK, LEVELS } from './store.js';

function calculateTotalXP(tasksByDate) {
  let total = 0;
  for (const dateKey in tasksByDate) {
    const tasks = tasksByDate[dateKey];
    total += tasks.filter(t => t.done).length * POINTS_PER_TASK;
  }
  return total;
}

function getLevel(xp) {
  let levelIndex = 0;
  for (let i = 0; i < LEVELS.length; i++) {
    if (xp >= LEVELS[i].threshold) {
      levelIndex = i;
    } else {
      break;
    }
  }
  return LEVELS[levelIndex];
}

function renderScore(rootEl) {
  rootEl.innerHTML = '';

  getTasksForDate('*').then(tasksByDate => {
    const xp = calculateTotalXP(tasksByDate);
    const level = getLevel(xp);
    const nextLevel = LEVELS[Math.min(LEVELS.indexOf(level) + 1, LEVELS.length - 1)];
    const xpToNext = nextLevel.threshold - xp;
    const progress = Math.min(100, Math.round((xp / nextLevel.threshold) * 100));

    const wrapper = document.createElement('div');
    wrapper.className = 'score-screen frost-card';

    const frame = document.createElement('img');
    frame.src = 'images/level-frame-base.png';
    frame.alt = 'Level Frame';
    frame.style.width = '100px';
    frame.style.display = 'block';
    frame.style.margin = '0 auto';

    const levelIcon = document.createElement('img');
    levelIcon.src = `images/level-${LEVELS.indexOf(level) + 1}.png`;
    levelIcon.alt = level.name;
    levelIcon.style.width = '80px';
    levelIcon.style.margin = '-80px auto 0';
    levelIcon.style.display = 'block';
    levelIcon.style.position = 'relative';
    levelIcon.style.zIndex = '2';

    const levelName = document.createElement('h2');
    levelName.textContent = `${level.name}`;
    levelName.style.textAlign = 'center';

    const xpLine = document.createElement('p');
    xpLine.textContent = `Total XP: ${xp}`;
    xpLine.style.textAlign = 'center';

    const progressBar = document.createElement('div');
    progressBar.style.height = '10px';
    progressBar.style.width = '100%';
    progressBar.style.background = '#333';
    progressBar.style.borderRadius = '6px';
    progressBar.style.marginTop = '1rem';

    const progressFill = document.createElement('div');
    progressFill.style.width = `${progress}%`;
    progressFill.style.height = '100%';
    progressFill.style.background = 'var(--accent)';
    progressFill.style.borderRadius = '6px';

    progressBar.appendChild(progressFill);

    wrapper.appendChild(frame);
    wrapper.appendChild(levelIcon);
    wrapper.appendChild(levelName);
    wrapper.appendChild(xpLine);
    wrapper.appendChild(progressBar);

    rootEl.appendChild(wrapper);
  });
}

export { renderScore };