import {
  getTasksForDate,
  addTask,
  updateTaskTitle,
  deleteTask,
  toggleTaskDone,
  reorderTasks
} from './store.js';

export function renderToday(rootEl) {
  const dateKey = new Date().toISOString().slice(0, 10);
  let tasks = [];

  const container = document.createElement('div');
  container.className = 'today-container';

  const topBar = document.createElement('div');
  topBar.className = 'top-bar';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Add a task…';
  input.className = 'task-input';

  const addBtn = document.createElement('button');
  addBtn.innerHTML = `<img src="images/icon-task-add.png" alt="+" />`;
  addBtn.className = 'task-add-btn';
  addBtn.onclick = () => {
    const title = input.value.trim();
    if (title) {
      addTask(dateKey, title).then(refresh);
      input.value = '';
    }
  };

  const inputRow = document.createElement('div');
  inputRow.className = 'input-row';
  inputRow.appendChild(input);
  inputRow.appendChild(addBtn);

  const taskList = document.createElement('div');
  taskList.className = 'task-list';

  const toolsBtn = document.createElement('button');
  toolsBtn.className = 'tools-btn';
  toolsBtn.innerHTML = `<img src="images/icon-overflow-more.png" alt="tools" /> Tools`;

  const toolsMenu = document.createElement('div');
  toolsMenu.className = 'tools-menu hidden';

  const reorderBtn = document.createElement('button');
  reorderBtn.innerHTML = `<img src="images/icon-task-reorder.png" /> Reorder Tasks`;
  reorderBtn.onclick = () => {
    const order = [...taskList.querySelectorAll('.task-row')].map(el => el.dataset.id);
    reorderTasks(dateKey, order).then(refresh);
  };

  const importBtn = document.createElement('button');
  importBtn.innerHTML = `<img src="images/icon-import-export.png" /> Import Plan`;
  importBtn.onclick = () => {
    const pasted = prompt('Paste your list');
    if (!pasted) return;
    const lines = pasted.split('\n').map(l => l.trim()).filter(Boolean);
    lines.forEach(title => addTask(dateKey, title));
    setTimeout(refresh, 300);
  };

  const copyBtn = document.createElement('button');
  copyBtn.innerHTML = `<img src="images/icon-confirm-check.png" /> Copy Summary for ChatGPT`;
  copyBtn.onclick = async () => {
    const remaining = tasks.filter(t => !t.done).map(t => `- [ ] ${t.title}`);
    const completed = tasks.filter(t => t.done).map(t => `- [x] ${t.title}`);
    const final = `# Today’s Task Summary\n\n${remaining.join('\n')}\n\n## Completed\n${completed.join('\n')}\n\n(From Ritual app)`;
    await navigator.clipboard.writeText(final);
  };

  const clearBtn = document.createElement('button');
  clearBtn.innerHTML = `<img src="images/icon-close-cancel.png" /> Clear Done`;
  clearBtn.onclick = () => {
    tasks.filter(t => t.done).forEach(t => deleteTask(dateKey, t.id));
    setTimeout(refresh, 300);
  };

  toolsMenu.append(reorderBtn, importBtn, copyBtn, clearBtn);

  toolsBtn.onclick = () => {
    toolsMenu.classList.toggle('hidden');
  };

  function renderTasks() {
    taskList.innerHTML = '';
    tasks.forEach(task => {
      const row = document.createElement('div');
      row.className = 'task-row';
      row.dataset.id = task.id;

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = task.done;
      checkbox.onclick = () => {
        toggleTaskDone(dateKey, task.id).then(refresh);
      };

      const label = document.createElement('span');
      label.textContent = task.title;

      const delBtn = document.createElement('button');
      delBtn.innerHTML = `<img src="images/icon-task-delete.png" />`;
      delBtn.onclick = () => {
        deleteTask(dateKey, task.id).then(refresh);
      };

      row.append(checkbox, label, delBtn);
      taskList.appendChild(row);
    });
  }

  function refresh() {
    getTasksForDate(dateKey).then(t => {
      tasks = t;
      renderTasks();
    });
  }

  topBar.appendChild(inputRow);
  topBar.appendChild(toolsBtn);
  container.appendChild(topBar);
  container.appendChild(toolsMenu);
  container.appendChild(taskList);

  rootEl.innerHTML = '';
  rootEl.appendChild(container);

  refresh();
}