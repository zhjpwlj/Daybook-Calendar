const MAX_ENTRIES = 100;
const entries = [];
let panel;
let list;
let actions;
let installed = false;

export function addDebugAction(label, handler) {
  if (!actions) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.addEventListener('click', async () => {
    try {
      await handler();
    } catch (error) {
      console.error(`Debug action failed: ${label}`, error);
    }
  });
  actions.append(button);
}

export function log(label, detail) {
  push('log', [label, detail]);
}

export function installDebug() {
  if (installed) return;
  installed = true;

  for (const level of ['log', 'info', 'warn', 'error']) {
    const original = console[level].bind(console);
    console[level] = (...args) => {
      push(level, args);
      original(...args);
    };
  }

  window.addEventListener('error', (event) => {
    push('error', [event.message, `${event.filename}:${event.lineno}`]);
  });

  window.addEventListener('unhandledrejection', (event) => {
    push('error', ['unhandledrejection', event.reason]);
  });

  buildPanel();
  bindLongPress();
}

function push(level, args) {
  const entry = {
    level,
    at: performance.now(),
    text: args.map(formatArg).join(' '),
  };
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) entries.shift();
  if (panel && !panel.hidden) append(entry);
}

function formatArg(value) {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.stack || `${value.name}: ${value.message}`;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function buildPanel() {
  panel = document.createElement('section');
  panel.className = 'debug-panel';
  panel.hidden = true;
  panel.setAttribute('role', 'log');
  panel.setAttribute('aria-label', 'Debug log');

  const head = document.createElement('header');
  head.className = 'debug-head';

  const title = document.createElement('span');
  title.textContent = 'Debug log';

  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = 'Close';
  close.addEventListener('click', () => toggle(false));

  head.append(title, close);

  list = document.createElement('ol');
  list.className = 'debug-list';

  actions = document.createElement('div');
  actions.className = 'debug-actions';

  panel.append(head, list, actions);
  document.body.append(panel);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !panel.hidden) toggle(false);
  });
}

function append(entry) {
  const item = document.createElement('li');
  item.dataset.level = entry.level;
  item.textContent = `${(entry.at / 1000).toFixed(2)}s ${entry.level.toUpperCase()} ${entry.text}`;
  list.append(item);
  list.scrollTop = list.scrollHeight;
}

function toggle(force) {
  panel.hidden = force === undefined ? !panel.hidden : !force;
  if (!panel.hidden) {
    list.replaceChildren();
    for (const entry of entries) append(entry);
  }
}

function bindLongPress() {
  const title = document.getElementById('app-title');
  if (!title) return;

  let timer;
  const start = () => {
    clearTimeout(timer);
    timer = setTimeout(() => toggle(), 1000);
  };
  const cancel = () => clearTimeout(timer);

  title.addEventListener('pointerdown', start);
  title.addEventListener('pointerup', cancel);
  title.addEventListener('pointerleave', cancel);
  title.addEventListener('pointercancel', cancel);
  title.addEventListener('contextmenu', (event) => event.preventDefault());
}
