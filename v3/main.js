// main.js

const STORAGE_KEY = 'ritual_v3_state';
const XP_PER_TASK = 10;

const LEVELS = [
  { name: 'Rookie', threshold: 0, icon: '/v3/images/level/level-1.png' },
  { name: 'Runner', threshold: 200, icon: '/v3/images/level/level-2.png' },
  { name: 'Striver', threshold: 600, icon: '/v3/images/level/level-3.png' },
  { name: 'Knight', threshold: 1200, icon: '/v3/images/level/level-4.png' },
  { name: 'Legend', threshold: 2000, icon: '/v3/images/level/level-5.png' }
];

let state = {
  tasks: [],
  xp: 0
};

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  const data = localStorage.getItem(STORAGE_KEY);
  if (data) {
    try {
      const parsed = JSON.parse(data);
      state.tasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
      state.xp = Number.isFinite(parsed.xp) ? parsed.xp : 0;
    } catch {
      resetState();
    }
  } else {
    resetState();
  }
}

function resetState() {
  state = { tasks: [], xp: 0 };
  saveState();
}

function addTask(text) {
  const task = {
    id: Date.now(),
    text,
    done: false
  };
  state.tasks.push(task);
  saveState();
  renderTasks();
  updateScore();
}

function deleteTask(id) {
  state.tasks = state.tasks.filter(t => t.id !== id);
  saveState();
  renderTasks();
  updateScore();
}

function toggleTask(id) {
  const task = state.tasks.find(t => t.id === id);
  if (task) {
    task.done = !task.done;
    saveState();
    renderTasks();
    updateScore();
  }
}

function calculateXP() {
  return state.tasks.filter(t => t.done).length * XP_PER_TASK;
}

function getCurrentLevel() {
  const xp = calculateXP();
  let current = LEVELS[0];
  for (const level of LEVELS) {
    if (xp >= level.threshold) {
      current = level;
    } else {
      break;
    }
  }
  return current;
}

function renderTasks() {
  const list = document.querySelector('#task-list');
  if (!list) return;

  list.innerHTML = '';

  const incomplete = state.tasks.filter(t => !t.done);
  const complete = state.tasks.filter(t => t.done);

  [...incomplete, ...complete].forEach(task => {
    const item = document.createElement('div');
    item.className = 'frosted-card task-item';
    item.innerText = task.text;
    item.addEventListener('click', () => toggleTask(task.id));
    if (task.done) {
      item.classList.add('done');
    }
    list.appendChild(item);
  });
}

function updateScore() {
  state.xp = calculateXP();
  const xpEl = document.querySelector('#score-xp');
  const levelEl = document.querySelector('#score-level');
  const levelImg = document.querySelector('#level-icon');

  if (xpEl) xpEl.textContent = `${state.xp} XP`;

  const level = getCurrentLevel();
  if (levelEl) levelEl.textContent = level.name;
  if (levelImg) {
    levelImg.src = level.icon;
    levelImg.alt = level.name;
  }
}

function switchTab(tabId) {
  const pages = document.querySelectorAll('.page');
  const tabs = document.querySelectorAll('.tab-item');

  pages.forEach(p => p.classList.add('hidden'));
  tabs.forEach(t => t.classList.remove('active'));

  const page = document.querySelector(`#${tabId}`);
  const tab = document.querySelector(`.tab-item[data-tab="${tabId}"]`);

  if (page) page.classList.remove('hidden');
  if (tab) tab.classList.add('active');
}

function initTabs() {
  const tabs = document.querySelectorAll('.tab-item');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.getAttribute('data-tab');
      switchTab(tabId);
    });
  });
}

function initAddTask() {
  const form = document.querySelector('#add-task-form');
  const input = document.querySelector('#add-task-input');
  if (form && input) {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const text = input.value.trim();
      if (text) {
        addTask(text);
        input.value = '';
      }
    });
  }
}

function init() {
  loadState();
  renderTasks();
  updateScore();
  initTabs();
  initAddTask();
  switchTab('today');
}

document.addEventListener('DOMContentLoaded', init);
