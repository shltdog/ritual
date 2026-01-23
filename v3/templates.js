// templates.js

import {
  getTemplates,
  addTemplate,
  updateTemplate,
  deleteTemplate,
  getStartOfDayCandidates,
  addTask,
  setSettings,
  getSettings
} from './store.js';

export async function renderTemplatesManager(rootEl) {
  rootEl.innerHTML = `
    <div class="frosted-card">
      <h3>Recurring Templates</h3>
      <form id="template-form">
        <input type="text" id="template-title" placeholder="Template Task" />
        <select id="template-type">
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
        </select>
        <select id="template-day" class="hidden">
          <option value="0">Sunday</option>
          <option value="1">Monday</option>
          <option value="2">Tuesday</option>
          <option value="3">Wednesday</option>
          <option value="4">Thursday</option>
          <option value="5">Friday</option>
          <option value="6">Saturday</option>
        </select>
        <button type="submit" class="accent">Add</button>
      </form>
      <div id="template-list" style="margin-top: 12px;"></div>
    </div>
  `;

  const form = rootEl.querySelector('#template-form');
  const titleInput = rootEl.querySelector('#template-title');
  const typeSelect = rootEl.querySelector('#template-type');
  const daySelect = rootEl.querySelector('#template-day');
  const listEl = rootEl.querySelector('#template-list');

  typeSelect.addEventListener('change', () => {
    daySelect.classList.toggle('hidden', typeSelect.value !== 'weekly');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = titleInput.value.trim();
    const type = typeSelect.value;
    const day = parseInt(daySelect.value, 10);

    if (title) {
      const template = {
        title,
        type,
        enabled: true,
        days: type === 'daily' ? [0,1,2,3,4,5,6] : [day]
      };
      await addTemplate(template);
      titleInput.value = '';
      refreshTemplateList();
    }
  });

  async function refreshTemplateList() {
    const templates = await getTemplates();
    listEl.innerHTML = '';
    templates.forEach(t => {
      const row = document.createElement('div');
      row.className = 'frosted-card';
      row.style.display = 'flex';
      row.style.justifyContent = 'space-between';
      row.style.alignItems = 'center';
      row.innerHTML = `
        <span>${t.title} (${t.type})</span>
        <div>
          <label>
            <input type="checkbox" ${t.enabled ? 'checked' : ''} />
            Enabled
          </label>
          <button class="delete-btn">Delete</button>
        </div>
      `;
      row.querySelector('input[type="checkbox"]').addEventListener('change', async (e) => {
        await updateTemplate(t.id, { enabled: e.target.checked });
        refreshTemplateList();
      });
      row.querySelector('.delete-btn').addEventListener('click', async () => {
        await deleteTemplate(t.id);
        refreshTemplateList();
      });
      listEl.appendChild(row);
    });
  }

  refreshTemplateList();
}

export async function maybeShowStartOfDayPrompt() {
  const todayKey = new Date().toISOString().slice(0, 10);
  const settings = await getSettings();
  if (settings.lastPrompted === todayKey) return;

  const { fromYesterday, recurringTemplates } = await getStartOfDayCandidates(todayKey);

  if (fromYesterday.length === 0 && recurringTemplates.length === 0) {
    settings.lastPrompted = todayKey;
    await setSettings(settings);
    return;
  }

  const modal = document.createElement('div');
  modal.className = 'frosted-card';
  modal.style.position = 'fixed';
  modal.style.top = '10%';
  modal.style.left = '5%';
  modal.style.right = '5%';
  modal.style.zIndex = 9999;
  modal.style.padding = '16px';
  modal.style.maxHeight = '80vh';
  modal.style.overflowY = 'auto';

  modal.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <h3>Start Today</h3>
      <button id="close-start-day">
        <img src="/v3/images/icon/icon-close-cancel.png.png" class="icon" />
      </button>
    </div>
    ${recurringTemplates.length > 0 ? '<h4>Recurring</h4>' : ''}
    <div id="recurring-section"></div>
    ${fromYesterday.length > 0 ? '<h4>From Yesterday</h4>' : ''}
    <div id="yesterday-section"></div>
    <div style="margin-top: 16px;">
      <button class="accent" id="add-selected">
        <img src="/v3/images/icon/icon-confirm-check.png.png" class="icon" /> Add Selected
      </button>
      <button id="skip-selected" style="margin-left: 12px;">
        <img src="/v3/images/icon/icon-overflow-more.png.png" class="icon" /> Skip
      </button>
    </div>
  `;

  const recurringSection = modal.querySelector('#recurring-section');
  const yesterdaySection = modal.querySelector('#yesterday-section');

  recurringTemplates.forEach((item, i) => {
    const row = document.createElement('div');
    row.className = 'frosted-card';
    row.innerHTML = `
      <label>
        <input type="checkbox" checked id="rec-${i}" />
        ${item.title}
      </label>
    `;
    recurringSection.appendChild(row);
  });

  fromYesterday.forEach((task, i) => {
    const row = document.createElement('div');
    row.className = 'frosted-card';
    row.innerHTML = `
      <label>
        <input type="checkbox" checked id="yest-${i}" />
        ${task.title}
      </label>
    `;
    yesterdaySection.appendChild(row);
  });

  function cleanup() {
    document.body.removeChild(modal);
    settings.lastPrompted = todayKey;
    setSettings(settings);
  }

  modal.querySelector('#close-start-day').addEventListener('click', cleanup);
  modal.querySelector('#skip-selected').addEventListener('click', cleanup);

  modal.querySelector('#add-selected').addEventListener('click', async () => {
    for (let i = 0; i < recurringTemplates.length; i++) {
      const cb = modal.querySelector(`#rec-${i}`);
      if (cb && cb.checked) {
        await addTask(todayKey, recurringTemplates[i].title);
      }
    }
    for (let i = 0; i < fromYesterday.length; i++) {
      const cb = modal.querySelector(`#yest-${i}`);
      if (cb && cb.checked) {
        await addTask(todayKey, fromYesterday[i].title);
      }
    }
    cleanup();
  });

  document.body.appendChild(modal);
}
