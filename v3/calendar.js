// calendar.js

import {
  getTasksForDate,
  getCustomHolidays,
  addTask,
  updateTaskTitle,
  deleteTask,
  toggleTaskDone,
  reorderTasks
} from './store.js';

const SEABELLY_PINK = '#F5E2E3';
const GOLD = '#FFD700';

export function renderCalendar(rootEl) {
  rootEl.innerHTML = `
    <div class="calendar-header frosted-card">
      <button id="prev-month">←</button>
      <span id="month-label"></span>
      <button id="next-month">→</button>
    </div>
    <div class="calendar-grid"></div>
    <div id="day-sheet" class="frosted-card hidden"></div>
  `;

  const monthLabel = rootEl.querySelector('#month-label');
  const calendarGrid = rootEl.querySelector('.calendar-grid');
  const prevBtn = rootEl.querySelector('#prev-month');
  const nextBtn = rootEl.querySelector('#next-month');
  const daySheet = rootEl.querySelector('#day-sheet');

  const todayKey = new Date().toISOString().slice(0, 10);
  let currentMonth = new Date();

  prevBtn.addEventListener('click', () => {
    currentMonth.setMonth(currentMonth.getMonth() - 1);
    renderMonth();
  });

  nextBtn.addEventListener('click', () => {
    currentMonth.setMonth(currentMonth.getMonth() + 1);
    renderMonth();
  });

  function getMonthLabel(date) {
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  }

  function getDaysInMonth(date) {
    const y = date.getFullYear();
    const m = date.getMonth();
    return new Date(y, m + 1, 0).getDate();
  }

  function getStartDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  }

  function getDateKey(year, month, day) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  function getUSHolidayMap(year) {
    const holidays = {};
    const fixed = {
      "01-01": "New Year's Day",
      "07-04": "Independence Day",
      "12-25": "Christmas Day"
    };

    for (let mmdd in fixed) {
      holidays[`${year}-${mmdd}`] = fixed[mmdd];
    }

    const mlk = getNthWeekdayOfMonth(year, 0, 2, 1);
    const pres = getNthWeekdayOfMonth(year, 1, 2, 1);
    const mem = getLastWeekdayOfMonth(year, 4, 1);
    const labor = getNthWeekdayOfMonth(year, 8, 1, 1);
    const col = getNthWeekdayOfMonth(year, 9, 2, 1);
    const thanks = getNthWeekdayOfMonth(year, 10, 4, 4);

    holidays[mlk] = "MLK Jr. Day";
    holidays[pres] = "Presidents' Day";
    holidays[mem] = "Memorial Day";
    holidays[labor] = "Labor Day";
    holidays[col] = "Columbus Day";
    holidays[thanks] = "Thanksgiving";

    return holidays;
  }

  function getNthWeekdayOfMonth(year, month, n, weekday) {
    let date = new Date(year, month, 1);
    let count = 0;
    while (date.getMonth() === month) {
      if (date.getDay() === weekday) {
        count++;
        if (count === n) break;
      }
      date.setDate(date.getDate() + 1);
    }
    return date.toISOString().slice(0, 10);
  }

  function getLastWeekdayOfMonth(year, month, weekday) {
    let date = new Date(year, month + 1, 0);
    while (date.getDay() !== weekday) {
      date.setDate(date.getDate() - 1);
    }
    return date.toISOString().slice(0, 10);
  }

  async function renderMonth() {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = getDaysInMonth(currentMonth);
    const startDay = getStartDay(currentMonth);
    const customHolidays = await getCustomHolidays();
    const usHolidays = getUSHolidayMap(year);

    monthLabel.textContent = getMonthLabel(currentMonth);
    calendarGrid.innerHTML = `
      <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
    `;

    for (let i = 0; i < startDay; i++) {
      calendarGrid.innerHTML += `<div></div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = getDateKey(year, month, day);
      const cell = document.createElement('div');
      cell.className = 'calendar-day';
      cell.innerHTML = `<span>${day}</span>`;

      const taskDot = document.createElement('div');
      const usDot = document.createElement('div');
      const customDot = document.createElement('div');

      getTasksForDate(dateKey).then(tasks => {
        if (tasks.length > 0) {
          taskDot.style.width = '6px';
          taskDot.style.height = '6px';
          taskDot.style.borderRadius = '50%';
          taskDot.style.background = '#aaa';
          taskDot.style.margin = '2px auto';
          cell.appendChild(taskDot);
        }
      });

      if (usHolidays[dateKey]) {
        usDot.style.width = '6px';
        usDot.style.height = '6px';
        usDot.style.borderRadius = '50%';
        usDot.style.background = GOLD;
        usDot.style.margin = '2px auto';
        cell.appendChild(usDot);
      }

      const mmdd = dateKey.slice(5);
      const custom = customHolidays.find(h => h.mmdd === mmdd);
      if (custom) {
        customDot.style.width = '6px';
        customDot.style.height = '6px';
        customDot.style.borderRadius = '50%';
        customDot.style.background = SEABELLY_PINK;
        customDot.style.margin = '2px auto';
        cell.appendChild(customDot);
      }

      cell.addEventListener('click', () => openDaySheet(dateKey, usHolidays[dateKey], custom?.name));
      calendarGrid.appendChild(cell);
    }
  }

  async function openDaySheet(dateKey, usHoliday, customHoliday) {
    const isToday = dateKey === new Date().toISOString().slice(0, 10);
    const isPast = dateKey < new Date().toISOString().slice(0, 10);
    const tasks = await getTasksForDate(dateKey);

    daySheet.classList.remove('hidden');
    daySheet.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <h3>${dateKey}</h3>
        <button id="close-sheet">
          <img src="/v3/images/icon/icon-close-cancel.png.png" class="icon" />
        </button>
      </div>
      ${usHoliday ? `<div style="color:${GOLD}; margin-bottom: 8px;">US Holiday: ${usHoliday}</div>` : ''}
      ${customHoliday ? `<div style="color:${SEABELLY_PINK}; margin-bottom: 8px;">Custom Holiday: ${customHoliday}</div>` : ''}
      <div id="day-task-list"></div>
      ${!isPast ? `
        <form id="day-add-form">
          <input type="text" id="day-add-input" placeholder="Add task..." />
          <button type="submit"><img src="/v3/images/task/icon-task-add.png" class="icon" /></button>
        </form>
      ` : ''}
      <button id="reorder-day" class="accent">
        <img src="/v3/images/task/icon-task-reorder.png" class="icon" /> Reorder
      </button>
      ${!isPast ? `
        <button id="import-day" class="accent">
          <img src="/v3/images/icon/icon-import-export.png.png" class="icon" /> Import Plan
        </button>
      ` : ''}
    `;

    daySheet.querySelector('#close-sheet').addEventListener('click', () => {
      daySheet.classList.add('hidden');
    });

    const listEl = daySheet.querySelector('#day-task-list');
    for (const task of tasks) {
      const row = document.createElement('div');
      row.className = 'frosted-card';
      row.innerHTML = `
        <span>${task.done ? '✓' : ''} ${task.title}</span>
        <div style="float:right;">
          <button class="edit-btn"><img src="/v3/images/task/icon-task-edit.png" class="icon" /></button>
          <button class="delete-btn"><img src="/v3/images/task/icon-task-delete.png" class="icon" /></button>
        </div>
      `;
      if (!isPast) {
        row.addEventListener('click', () => toggleTaskDone(task.id).then(() => openDaySheet(dateKey, usHoliday, customHoliday)));
      }
      row.querySelector('.edit-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        const newTitle = promptInline(task.title);
        if (newTitle) {
          await updateTaskTitle(task.id, newTitle);
          openDaySheet(dateKey, usHoliday, customHoliday);
        }
      });
      row.querySelector('.delete-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        await deleteTask(task.id);
        openDaySheet(dateKey, usHoliday, customHoliday);
      });
      listEl.appendChild(row);
    }

    const addForm = daySheet.querySelector('#day-add-form');
    if (addForm) {
      addForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = addForm.querySelector('#day-add-input');
        const val = input.value.trim();
        if (val) {
          await addTask(dateKey, val);
          openDaySheet(dateKey, usHoliday, customHoliday);
        }
      });
    }

    const reorderBtn = daySheet.querySelector('#reorder-day');
    reorderBtn.addEventListener('click', () => {
      openReorder(tasks, dateKey, usHoliday, customHoliday);
    });

    const importBtn = daySheet.querySelector('#import-day');
    if (importBtn) {
      importBtn.addEventListener('click', () => {
        openImport(dateKey, usHoliday, customHoliday);
      });
    }
  }

  function promptInline(oldTitle) {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = oldTitle;
    input.style.width = '100%';
    input.style.fontSize = '16px';
    input.style.padding = '10px';
    const wrapper = document.createElement('div');
    wrapper.className = 'frosted-card';
    wrapper.appendChild(input);
    const confirmBtn = document.createElement('button');
    confirmBtn.innerHTML = 'Confirm';
    confirmBtn.className = 'accent';
    wrapper.appendChild(confirmBtn);
    const dayTaskList = document.querySelector('#day-task-list');
    dayTaskList.innerHTML = '';
    dayTaskList.appendChild(wrapper);
    return new Promise(resolve => {
      confirmBtn.addEventListener('click', () => {
        resolve(input.value.trim());
      });
    });
  }

  function openReorder(tasks, dateKey, usHoliday, customHoliday) {
    const list = tasks.slice().filter(t => !t.done);
    const listEl = document.querySelector('#day-task-list');
    listEl.innerHTML = '';
    list.forEach(task => {
      const el = document.createElement('div');
      el.className = 'frosted-card';
      el.draggable = true;
      el.dataset.id = task.id;
      el.textContent = task.title;
      listEl.appendChild(el);
    });

    let dragging = null;
    listEl.querySelectorAll('.frosted-card').forEach(el => {
      el.addEventListener('dragstart', () => dragging = el);
      el.addEventListener('dragover', (e) => {
        e.preventDefault();
        const target = e.currentTarget;
        if (dragging && target !== dragging) {
          listEl.insertBefore(dragging, target);
        }
      });
    });

    const doneBtn = document.createElement('button');
    doneBtn.className = 'accent';
    doneBtn.textContent = 'Done';
    doneBtn.addEventListener('click', async () => {
      const newOrder = Array.from(listEl.children).map(el => el.dataset.id);
      await reorderTasks(dateKey, newOrder);
      openDaySheet(dateKey, usHoliday, customHoliday);
    });
    listEl.parentElement.appendChild(doneBtn);
  }

  function openImport(dateKey, usHoliday, customHoliday) {
    const sheet = document.querySelector('#day-task-list');
    sheet.innerHTML = `
      <textarea id="import-text" rows="6" placeholder="Paste tasks..."></textarea>
      <button class="accent" id="import-preview">Preview</button>
    `;
    const previewBtn = sheet.querySelector('#import-preview');
    previewBtn.addEventListener('click', () => {
      const lines = sheet.querySelector('#import-text').value.split('\n').map(x => x.trim()).filter(Boolean);
      sheet.innerHTML = `<form id="import-form"></form>`;
      const form = sheet.querySelector('#import-form');
      lines.forEach((line, i) => {
        form.innerHTML += `
          <div class="frosted-card">
            <input type="checkbox" checked id="chk-${i}" />
            <input type="text" value="${line}" id="txt-${i}" />
          </div>
        `;
      });
      form.innerHTML += `<button type="submit" class="accent">Import</button>`;
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        for (let i = 0; i < lines.length; i++) {
          const use = form.querySelector(`#chk-${i}`).checked;
          const text = form.querySelector(`#txt-${i}`).value.trim();
          if (use && text) {
            await addTask(dateKey, text);
          }
        }
        openDaySheet(dateKey, usHoliday, customHoliday);
      });
    });
  }

  renderMonth();
}