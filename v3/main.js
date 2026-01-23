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

// ✅ Clear #app and create screen + tabs
app.innerHTML = '';

// Screen container
const screen = document.createElement('div');
screen.id = 'screen';
screen.style.flex = '1';
screen.style.overflow = 'auto';

// Tab bar
const tabBar = document.createElement('div');
tabBar.id = 'tab-bar';
tabBar.style.display = 'flex';
tabBar.style.justifyContent = 'space-around';
tabBar.style.background = '#111';
tabBar.style.borderTop = '1px solid #333';
tabBar.style.padding = '6px 0';

const tabs = [
  { id: 'today', icon: '/v3/images/tab/tab-score-flame.png', label: 'Today' },
  { id: 'calendar', icon: '/v3/images/tab/tab-calendar.png', label: 'Calendar' },
  { id: 'score', icon: '/v3/images/tab/tab-score.png', label: 'Score' },
  { id: 'settings', icon: '/v3/images/tab/tab-settings.png', label: 'Settings' }
];

tabs.forEach(tab => {
  const btn = document.createElement('button');
  btn.className = 'tab-button';
  btn.dataset.tab = tab.id;
  btn.style.flex = '1';
  btn.style.padding = '4px';
  btn.style.background = 'none';
  btn.style.border = 'none';
  btn.style.color = '#aaa';
  btn.style.display = 'flex';
  btn.style.flexDirection = 'column';
  btn.style.alignItems = 'center';
  btn.style.fontSize = '12px';

  const img = document.createElement('img');
  img.src = tab.icon;
  img.alt = tab.label;
  img.style.width = '24px';
  img.style.height = '24px';
  img.style.marginBottom = '2px';

  const label = document.createElement('div');
  label.textContent = tab.label;

  btn.appendChild(img);
  btn.appendChild(label);
  btn.addEventListener('click', () => goToTab(tab.id));
  tabBar.appendChild(btn);
});

app.appendChild(screen);
app.appendChild(tabBar);

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

  // Highlight active tab
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.style.opacity = btn.dataset.tab === currentTab ? '1' : '0.6';
  });
}

// ✅ Global tab switcher
window.goToTab = function (tab) {
  currentTab = tab;
  renderActiveTab();
};

// ✅ Init logic
maybeShowStartOfDayPrompt?.();
renderActiveTab();