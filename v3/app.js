// app.js

const screens = ['today', 'calendar', 'score', 'settings'];
let currentScreen = 'today';

function showScreen(name) {
  screens.forEach(screen => {
    const el = document.getElementById(screen);
    const tab = document.querySelector(`.tab-item[data-tab="${screen}"]`);
    if (el) el.classList.toggle('hidden', screen !== name);
    if (tab) tab.classList.toggle('active', screen === name);
  });

  currentScreen = name;
  renderScreen(name);
}

function renderScreen(name) {
  const hook = renderHooks[name];
  if (typeof hook === 'function') {
    hook();
  }
}

const renderHooks = {
  today: () => {},
  calendar: () => {},
  score: () => {},
  settings: () => {}
};

function initApp() {
  const tabItems = document.querySelectorAll('.tab-item');
  tabItems.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-tab');
      if (target && screens.includes(target)) {
        showScreen(target);
      }
    });
  });

  showScreen(currentScreen);
}

document.addEventListener('DOMContentLoaded', initApp);
