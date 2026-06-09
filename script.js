// ── STATE ──────────────────────────────────────────────────
let tasks = [];
let theme = 'light';

const COLS       = ['todo', 'progress', 'done'];
const NEXT       = { todo: 'progress', progress: 'done' };
const NEXT_LABEL = { todo: 'Start',    progress: 'Complete' };

// ── PERSISTENCE ────────────────────────────────────────────
function save() {
  localStorage.setItem('tf_tasks', JSON.stringify(tasks));
  localStorage.setItem('tf_theme', theme);
}

function load() {
  try { tasks = JSON.parse(localStorage.getItem('tf_tasks')) || []; }
  catch { tasks = []; }
  theme = localStorage.getItem('tf_theme') || 'light';
}

// ── THEME ──────────────────────────────────────────────────
const htmlEl      = document.documentElement;
const toggleTrack = document.getElementById('toggleTrack');
const themeLabel  = document.getElementById('themeLabel');

function applyTheme() {
  htmlEl.dataset.theme = theme;
  if (theme === 'dark') {
    toggleTrack.classList.add('on');
    themeLabel.textContent = 'Light';
  } else {
    toggleTrack.classList.remove('on');
    themeLabel.textContent = 'Dark';
  }
}

document.getElementById('themeToggle').addEventListener('click', () => {
  theme = theme === 'light' ? 'dark' : 'light';
  applyTheme();
  save();
});

// ── RENDER ─────────────────────────────────────────────────
function renderAll() {
  COLS.forEach(col => {
    const list     = document.getElementById('list-' + col);
    const colTasks = tasks.filter(t => t.col === col);
    list.innerHTML = '';

    if (colTasks.length === 0) {
      const msgs = {
        todo:     'No tasks yet. Add one!',
        progress: 'Nothing in progress.',
        done:     'Completed tasks appear here.'
      };
      list.innerHTML = `<div class="empty-state">${msgs[col]}</div>`;
    } else {
      colTasks.forEach(t => list.appendChild(makeCard(t)));
    }

    document.getElementById('count-' + col).textContent = colTasks.length;
  });

  updateStats();
  applyFilters();
}

function makeCard(t) {
  const card = document.createElement('div');
  card.className        = 'task-card';
  card.dataset.id       = t.id;
  card.dataset.category = t.category;
  card.dataset.priority = t.priority;

  const moveBtn = NEXT[t.col]
    ? `<button class="btn-action btn-move" data-action="move" data-id="${t.id}">${NEXT_LABEL[t.col]}</button>`
    : '';

  card.innerHTML = `
    <div class="card-top">
      <div class="task-title" contenteditable="false"
           data-action="edit" data-id="${t.id}"
           title="Click to edit">${escHtml(t.title)}</div>
    </div>
    <div class="card-meta">
      <span class="priority-badge p-${t.priority}">${t.priority}</span>
      <span class="category-tag">${t.category}</span>
      <span class="card-date">${t.date}</span>
    </div>
    ${t.desc
      ? `<p style="font-size:12.5px;color:var(--text-2);margin-top:8px;line-height:1.5;">${escHtml(t.desc)}</p>`
      : ''}
    <div class="card-actions">
      ${moveBtn}
      <button class="btn-action btn-delete" data-action="delete" data-id="${t.id}">Delete</button>
    </div>`;

  return card;
}

function escHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function updateStats() {
  document.getElementById('statTotal').textContent = tasks.length;
  document.getElementById('statTodo').textContent  = tasks.filter(t => t.col === 'todo').length;
  document.getElementById('statProg').textContent  = tasks.filter(t => t.col === 'progress').length;
  document.getElementById('statDone').textContent  = tasks.filter(t => t.col === 'done').length;
}

// ── SEARCH & FILTER ────────────────────────────────────────
function applyFilters() {
  const q   = document.getElementById('search').value.toLowerCase().trim();
  const cat = document.getElementById('filter').value;

  document.querySelectorAll('.task-card').forEach(card => {
    const title  = card.querySelector('.task-title').textContent.toLowerCase();
    const matchQ = !q   || title.includes(q);
    const matchC = !cat || card.dataset.category === cat;
    card.classList.toggle('hidden', !(matchQ && matchC));
  });
}

document.getElementById('search').addEventListener('input', applyFilters);
document.getElementById('filter').addEventListener('change', applyFilters);

// ── EVENT DELEGATION ───────────────────────────────────────
document.getElementById('boardWrapper').addEventListener('click', e => {
  const action = e.target.dataset.action;
  const id     = e.target.dataset.id;
  if (!action || !id) return;

  // DELETE
  if (action === 'delete') {
    tasks = tasks.filter(t => t.id !== id);
    save(); renderAll();
    showToast('Task deleted.');
  }

  // MOVE
  if (action === 'move') {
    const t = tasks.find(t => t.id === id);
    if (t && NEXT[t.col]) {
      t.col = NEXT[t.col];
      save(); renderAll();
      showToast('Task moved!');
    }
  }

  // EDIT (click-to-edit)
  if (action === 'edit') {
    const el = e.target;
    if (el.contentEditable === 'true') return;

    el.contentEditable = 'true';
    el.focus();

    const range = document.createRange();
    range.selectNodeContents(el);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);

    el.addEventListener('blur', () => {
      el.contentEditable = 'false';
      const t = tasks.find(t => t.id === id);
      if (t) {
        t.title = el.textContent.trim() || t.title;
        el.textContent = t.title;
        save();
      }
    }, { once: true });

    el.addEventListener('keydown', ev => {
      if (ev.key === 'Enter') { ev.preventDefault(); el.blur(); }
    });
  }
});

// ── MODAL ──────────────────────────────────────────────────
const overlay = document.getElementById('modalOverlay');

function openModal() {
  overlay.classList.add('open');
  document.getElementById('taskTitle').focus();
}

function closeModal() {
  overlay.classList.remove('open');
  document.getElementById('taskTitle').value = '';
  document.getElementById('taskDesc').value  = '';
}

document.getElementById('btnNew').addEventListener('click', openModal);
document.getElementById('btnCancel').addEventListener('click', closeModal);
overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

document.getElementById('btnSubmit').addEventListener('click', () => {
  const title = document.getElementById('taskTitle').value.trim();
  if (!title) { document.getElementById('taskTitle').focus(); return; }

  const task = {
    id:       Date.now().toString(),
    title,
    desc:     document.getElementById('taskDesc').value.trim(),
    priority: document.getElementById('taskPriority').value,
    category: document.getElementById('taskCategory').value,
    col:      'todo',
    date:     new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
  };

  tasks.unshift(task);
  save(); renderAll(); closeModal();
  showToast('Task added!');
});

// ── TOAST ──────────────────────────────────────────────────
let toastTimer;

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

// ── SEED DATA ──────────────────────────────────────────────
function seedIfEmpty() {
  if (tasks.length) return;
  tasks = [
    { id:'1', title:'Design new landing page',      desc:'Wireframes and mockups for v2 homepage.', priority:'high',   category:'design',      col:'todo',     date:'08 Jun' },
    { id:'2', title:'Fix login bug on mobile',       desc:'Safari viewport issue reported.',         priority:'high',   category:'development', col:'progress', date:'07 Jun' },
    { id:'3', title:'Competitor analysis report',    desc:'',                                        priority:'medium', category:'research',    col:'progress', date:'06 Jun' },
    { id:'4', title:'Update README documentation',   desc:'',                                        priority:'low',    category:'development', col:'done',     date:'05 Jun' },
    { id:'5', title:'Social media content plan',     desc:'June + July schedule.',                   priority:'medium', category:'marketing',   col:'todo',     date:'08 Jun' },
  ];
}

// ── INIT ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  load();
  seedIfEmpty();
  applyTheme();
  renderAll();
});