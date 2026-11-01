/** @typedef {{ level: string, at: number, text: string }} Entry */

const MAX_ENTRIES = 100;
/** @type {Entry[]} */
const entries = [];
/** @type {HTMLElement | undefined} */
let panel;
/** @type {HTMLOListElement | undefined} */
let list;
/** @type {HTMLDivElement | undefined} */
let actions;
let installed = false;

/**
 * @param {string} label
 * @param {() => void | Promise<void>} handler
 */
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

/**
 * @param {string} label
 * @param {unknown} [detail]
 */
export function log(label, detail) {
  push('log', [label, detail]);
}

export function installDebug() {
  if (installed) return;
  installed = true;

  const target = /** @type {Record<string, (...args: any[]) => void>} */ (
    /** @type {unknown} */ (console)
  );
  for (const level of ['log', 'info', 'warn', 'error']) {
    const original = target[level];
    if (!original) continue;
    target[level] = (/** @type {any[]} */ ...args) => {
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

/**
 * @param {string} level
 * @param {any[]} args
 */
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

/**
 * @param {unknown} value
 * @returns {string}
 */
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
    if (event.key === 'Escape' && panel && !panel.hidden) toggle(false);
  });
}

/**
 * @param {Entry} entry
 */
function append(entry) {
  if (!list) return;
  const item = document.createElement('li');
  item.dataset.level = entry.level;
  item.textContent = `${(entry.at / 1000).toFixed(2)}s ${entry.level.toUpperCase()} ${entry.text}`;
  list.append(item);
  list.scrollTop = list.scrollHeight;
}

/**
 * @param {boolean} [force]
 */
function toggle(force) {
  if (!panel) return;
  panel.hidden = force === undefined ? !panel.hidden : !force;
  if (!panel.hidden && list) {
    list.replaceChildren();
    for (const entry of entries) append(entry);
  }
}

function bindLongPress() {
  const title = document.getElementById('app-title');
  if (!title) return;

  /** @type {ReturnType<typeof setTimeout> | undefined} */
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
