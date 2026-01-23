// settings.js

import {
  getAccent,
  setAccent,
  getSettings,
  setSettings,
  getCustomHolidays,
  addCustomHoliday,
  deleteCustomHoliday,
  exportBackupJSON,
  importBackupJSON,
  getDebugEnabled,
  setDebugEnabled,
  getDebugLog,
  clearDebugLog
} from './store.js';

export async function renderSettings(rootEl) {
  rootEl.innerHTML = `
    <div class="frosted-card">
      <h3>Accent Color</h3>
      <div id="accent-current" style="margin-bottom: 8px;"></div>
      <button class="accent" id="change-accent">Change Accent</button>
      <div id="accent-popup" class="frosted-card hidden" style="margin-top: 8px;"></div>
    </div>

    <div class="frosted-card" style="margin-top: 24px;">
      <h3>Custom Holidays</h3>
      <form id="holiday-form">
        <input type="text" id="holiday-mmdd" placeholder="MM-DD" maxlength="5" />
        <input type="text" id="holiday-name" placeholder="Holiday Name" />
        <button type="submit" class="accent">Add Holiday</button>
      </form>
      <div id="holiday-list" style="margin-top: 8px;"></div>
    </div>

    <div class="frosted-card" style="margin-top: 24px;">
      <h3>Backup</h3>
      <button id="export-backup" class="accent">
        <img src="/v3/images/icon/icon-backup-cloud.png.png" class="icon" /> Export Backup
      </button>
      <input type="file" id="import-backup" accept=".json" style="margin-top: 8px;" />
      <div id="backup-error" style="color: #e55; margin-top: 8px;"></div>
    </div>

    <div class="frosted-card" style="margin-top: 24px;">
      <h3>Debug</h3>
      <label style="display: block; margin-bottom: 8px;">
        <input type="checkbox" id="toggle-debug" />
        Enable Debug
      </label>
      <button id="copy-debug" class="accent">Copy Debug Log</button>
      <button id="clear-debug" style="margin-left: 12px;">Clear Debug Log</button>
    </div>

    <div class="frosted-card" style="margin-top: 24px;">
      <h3>Reminders</h3>
      <p>This app does not send notifications. Use the Apple Reminders app to set alerts for your rituals.</p>
    </div>
  `;

  const accentDisplay = rootEl.querySelector('#accent-current');
  const accentPopup = rootEl.querySelector('#accent-popup');
  const changeAccentBtn = rootEl.querySelector('#change-accent');
  const accentColors = [
    { name: 'Red', color: '#e34242' },
    { name: 'Blue', color: '#42a5f5' },
    { name: 'Green', color: '#66bb6a' },
    { name: 'Purple', color: '#ab47bc' },
    { name: 'Pink', color: '#f06292' },
    { name: 'SeaBelly Pink', color: '#F5E2E3' }
  ];

  async function refreshAccentDisplay() {
    const current = await getAccent();
    const found = accentColors.find(a => a.color === current);
    accentDisplay.textContent = `Current: ${found ? found.name : current}`;
  }

  changeAccentBtn.addEventListener('click', () => {
    accentPopup.classList.toggle('hidden');
    if (!accentPopup.classList.contains('hidden')) {
      accentPopup.innerHTML = '';
      accentColors.forEach(a => {
        const btn = document.createElement('button');
        btn.textContent = a.name;
        btn.style.background = a.color;
        btn.style.color = '#000';
        btn.style.margin = '4px';
        btn.style.padding = '8px 12px';
        btn.addEventListener('click', async () => {
          document.documentElement.style.setProperty('--accent-color', a.color);
          await setAccent(a.color);
          accentPopup.classList.add('hidden');
          refreshAccentDisplay();
        });
        accentPopup.appendChild(btn);
      });
    }
  });

  refreshAccentDisplay();

  const holidayForm = rootEl.querySelector('#holiday-form');
  const mmddInput = rootEl.querySelector('#holiday-mmdd');
  const nameInput = rootEl.querySelector('#holiday-name');
  const holidayList = rootEl.querySelector('#holiday-list');

  async function refreshHolidayList() {
    const holidays = await getCustomHolidays();
    holidayList.innerHTML = '';
    holidays.forEach(h => {
      const row = document.createElement('div');
      row.style.marginBottom = '6px';
      row.style.display = 'flex';
      row.style.justifyContent = 'space-between';
      row.style.alignItems = 'center';
      row.innerHTML = `
        <span style="color: #F5E2E3;">${h.mmdd}: ${h.name}</span>
        <button data-id="${h.id}">Delete</button>
      `;
      row.querySelector('button').addEventListener('click', async () => {
        await deleteCustomHoliday(h.id);
        refreshHolidayList();
      });
      holidayList.appendChild(row);
    });
  }

  holidayForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const mmdd = mmddInput.value.trim();
    const name = nameInput.value.trim();
    if (/^\d{2}-\d{2}$/.test(mmdd) && name) {
      await addCustomHoliday(mmdd, name);
      mmddInput.value = '';
      nameInput.value = '';
      refreshHolidayList();
    }
  });

  refreshHolidayList();

  const exportBtn = rootEl.querySelector('#export-backup');
  const importInput = rootEl.querySelector('#import-backup');
  const backupError = rootEl.querySelector('#backup-error');

  exportBtn.addEventListener('click', async () => {
    const json = await exportBackupJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ritual-backup.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  importInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      await importBackupJSON(text);
      backupError.textContent = 'Import successful.';
    } catch {
      backupError.textContent = 'Invalid or corrupted file.';
    }
  });

  const debugToggle = rootEl.querySelector('#toggle-debug');
  const copyDebugBtn = rootEl.querySelector('#copy-debug');
  const clearDebugBtn = rootEl.querySelector('#clear-debug');

  getDebugEnabled().then(val => {
    debugToggle.checked = val;
  });

  debugToggle.addEventListener('change', () => {
    setDebugEnabled(debugToggle.checked);
  });

  copyDebugBtn.addEventListener('click', async () => {
    const logs = await getDebugLog();
    const text = logs.map(l => `[${new Date(l.timestamp).toISOString()}] ${l.message}`).join('\n');
    await navigator.clipboard.writeText(text);
  });

  clearDebugBtn.addEventListener('click', async () => {
    await clearDebugLog();
  });
}
