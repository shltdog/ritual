import { renderToday } from './today.js';
import { renderCalendar } from './calendar.js';
import { renderScore } from './score.js';
import { renderSettings } from './settings.js';
import { maybeShowStartOfDayPrompt } from './templates.js';

const app = document.getElementById('app');

// ✅ Debug banner
const debugBanner = document.createElement('div');
debugBanner.style.background = '#222';
debugBanner.style.color = '#0f0';
debugBanner.style.fontSize = '12px';
debugBanner.style.padding = '6px';
debugBanner.style.textAlign = 'center';
debugBanner.textContent = '🧪 main.js loaded – starting app...';
document.body.prepend(debugBanner);

// ✅ Clear #app and create screen container
app.innerHTML = '';
const screen = document.createElement('div');
screen.id = 'screen';
screen.style.flex = '1';
screen.style.overflow = 'auto';
app.appendChild(screen);

// ✅ Tab state
let currentTab = 'today';

// ✅ Tab rendering map
const renderers = {
  today: renderToday,
  calendar: renderCalendar,
  score: renderScore,
  settings: renderSettings
};

// ✅ Render tab
function renderActiveTab() {
  const renderer = renderers[currentTab];
  if (renderer) {
    debugBanner.textContent = `🧪 Rendering tab: ${currentTab}`;
    screen.innerHTML = '';
    try {
      renderer(screen);
    } catch (err) {
      screen.innerHTML = `<pre style="color:red;">Error rendering ${currentTab}:\n${err.message}</pre>`;
    }
  } else {
    screen.innerHTML = `<pre style="color:orange;">Unknown tab: ${currentTab}</pre>`;
  }
}

// ✅ Global tab switcher
window.goToTab = function (tab) {
  currentTab = tab;
  renderActiveTab();
};

// ✅ Init logic
maybeShowStartOfDayPrompt?.();
renderActiveTab();