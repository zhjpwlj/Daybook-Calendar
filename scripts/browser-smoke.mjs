import { spawn } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CHROME =
  [
    process.env.CHROME,
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/home/zhjpwlj/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',
  ].find((candidate) => candidate && existsSync(candidate)) ?? null;

const PROFILE = '/tmp/opencode/daybook-cdp';
const OUT_DIR = '/tmp/opencode';
const PREVIEW = 'http://127.0.0.1:4173/';
const DEV = 'http://127.0.0.1:5173/';
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

if (!CHROME) {
  console.error('Set CHROME=/path/to/chrome');
  process.exit(1);
}

for (const url of [PREVIEW, DEV]) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(String(response.status));
  } catch {
    console.error(`Server not reachable: ${url}`);
    console.error('Run: npm run build && npm run preview -- --port 4173');
    console.error('And: npm run dev -- --port 5173');
    process.exit(1);
  }
}

const failures = [];

function assert(condition, label, detail) {
  if (condition) {
    console.log(`PASS ${label}`, detail ?? '');
  } else {
    failures.push(label);
    console.log(`FAIL ${label}`, detail ?? '');
  }
}

rmSync(PROFILE, { recursive: true, force: true });

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--remote-debugging-port=9222',
    `--user-data-dir=${PROFILE}`,
    '--window-size=430,932',
    'about:blank',
  ],
  { stdio: 'ignore' },
);

async function waitForEndpoint() {
  for (let i = 0; i < 100; i += 1) {
    try {
      const response = await fetch('http://127.0.0.1:9222/json/list');
      const targets = await response.json();
      const page = targets.find((target) => target.type === 'page');
      if (page) return page;
    } catch {
      // Chrome not ready.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Chrome DevTools endpoint never appeared');
}

const page = await waitForEndpoint();
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let nextId = 0;
const pending = new Map();

socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message);
    pending.delete(message.id);
  }
});

function send(method, params = {}) {
  return new Promise((resolve) => {
    const id = ++nextId;
    pending.set(id, resolve);
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression, awaitPromise = false) {
  const response = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise,
  });
  if (response.result?.exceptionDetails) {
    throw new Error(JSON.stringify(response.result.exceptionDetails));
  }
  return response.result?.result?.value;
}

async function waitFor(expression, timeout = 30000, awaitPromise = false) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await evaluate(expression, awaitPromise)) return true;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return false;
}

const countExpression = `new Promise((resolve, reject) => {
  const request = indexedDB.open('daybook');
  request.onerror = () => reject(request.error);
  request.onsuccess = () => {
    const count = request.result.transaction('events').objectStore('events').count();
    count.onsuccess = () => resolve(count.result);
    count.onerror = () => reject(count.error);
  };
})`;

try {
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-color-scheme', value: 'dark' }],
  });
  await send('Page.navigate', { url: PREVIEW });

  assert(
    await waitFor("document.querySelectorAll('.month-cell').length >= 35"),
    'month grid renders',
    await evaluate("document.querySelectorAll('.month-cell').length"),
  );
  assert(
    (await evaluate('document.documentElement.dataset.theme')) === 'dark',
    'system dark theme is default',
    await evaluate('document.documentElement.dataset.theme'),
  );
  assert(
    (await evaluate("document.querySelector('.month-title')?.textContent"))?.length > 4,
    'month title present',
    await evaluate("document.querySelector('.month-title')?.textContent"),
  );
  assert(
    (await evaluate("document.getElementById('app-version')?.textContent")) === `v${pkg.version}`,
    'version label',
    await evaluate("document.getElementById('app-version')?.textContent"),
  );

  await evaluate('window.confirm = () => true; true');
  await evaluate(
    "[...document.querySelectorAll('.debug-actions button')].find((b) => b.textContent === 'Seed 10y').click(); true",
  );

  assert(
    await waitFor(`${countExpression}.then((count) => count === 18250)`, 90000, true),
    'seed writes 18,250 events',
  );

  const finalCount = await evaluate(countExpression, true);
  assert(finalCount === 18250, 'seed event count is 18,250', finalCount);
  assert(
    await waitFor("document.querySelectorAll('.event-chip').length > 0"),
    'chips render after seed',
    await evaluate("document.querySelectorAll('.event-chip').length"),
  );
  assert(
    await evaluate("Boolean(document.querySelector('.event-chip-title')?.textContent)"),
    'chip title is visible text',
    await evaluate("document.querySelector('.event-chip-title')?.textContent"),
  );

  await evaluate(
    "[...document.querySelectorAll('.debug-actions button')].find((b) => b.textContent === 'Seed 10y').click(); true",
  );
  await evaluate('new Promise((resolve) => setTimeout(resolve, 4000))', true);
  const rerunCount = await evaluate(countExpression, true);
  assert(rerunCount === 18250, 're-seed is idempotent', rerunCount);

  await send('Page.reload');
  assert(
    await waitFor("document.querySelectorAll('.month-cell').length >= 35"),
    'reload with 18,250 events',
  );

  const cleanShot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(OUT_DIR, 'daybook-m2.png'), Buffer.from(cleanShot.result.data, 'base64'));

  await evaluate(
    "document.getElementById('app-title').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); true",
  );
  await evaluate('new Promise((resolve) => setTimeout(resolve, 1200))', true);

  assert(
    await evaluate("!document.querySelector('.debug-panel').hidden"),
    'long-press opens debug panel',
  );

  const debugText = await evaluate("document.querySelector('.debug-list').textContent");
  const bootMatches = [...debugText.matchAll(/boot:ready (\{[^}]*\})/g)];
  const bootStats = bootMatches.length > 0 ? JSON.parse(bootMatches.at(-1)[1]) : null;
  assert(bootStats !== null, 'debug log has boot:ready', JSON.stringify(bootStats));

  const renderMatches = [...debugText.matchAll(/month:render (\{[^}]*\})/g)];
  const renderStats = renderMatches.length > 0 ? JSON.parse(renderMatches.at(-1)[1]) : null;
  assert(renderStats !== null, 'debug log has render stats', JSON.stringify(renderStats));
  assert(
    renderStats?.ms < 200,
    'month render under 200ms with 18,250 events',
    `${renderStats?.ms}ms`,
  );

  await send('Page.navigate', { url: DEV });
  assert(await waitFor("Boolean(document.querySelector('.month-cell'))"), 'dev server boots');

  const crud = await evaluate(
    `(async () => {
      const { store } = await import('/src/core/store.js');
      await store.load();
      const calendar = await store.createCalendar({ name: 'CRUD', color: '#ff0000' });
      const event = await store.createEvent({
        summary: 'Before',
        calendar_id: calendar.id,
        dtstart_utc: 1767225600000,
        dtstart_tzid: 'UTC',
      });
      await store.updateEvent(event.id, { summary: 'After' });
      const updated = store.getEvent(event.id).summary;

      let blocked = false;
      try {
        await store.deleteCalendar(calendar.id);
      } catch {
        blocked = true;
      }

      await store.deleteCalendar(calendar.id, { reassignTo: store.getCalendars()[0].id });
      const reassigned = store.getEvent(event.id).calendar_id !== calendar.id;
      await store.deleteEvent(event.id);

      const home = store.getCalendars()[0];
      const allDay = await store.createEvent({
        summary: 'All day',
        calendar_id: home.id,
        all_day: true,
        all_day_start: '2026-10-26',
        all_day_end: '2026-10-28',
      });
      const allDayInRange = (await store.getEventsInRange(
        Date.UTC(2026, 9, 26),
        Date.UTC(2026, 9, 27),
      )).some((entry) => entry.id === allDay.id);
      const allDayAfterRange = (await store.getEventsInRange(
        Date.UTC(2026, 9, 28),
        Date.UTC(2026, 9, 29),
      )).some((entry) => entry.id === allDay.id);

      const hiddenCalendar = await store.createCalendar({ name: 'Hidden', visible: false });
      const hiddenEvent = await store.createEvent({
        summary: 'Hidden',
        calendar_id: hiddenCalendar.id,
        dtstart_utc: Date.UTC(2026, 9, 26, 12),
        dtstart_tzid: 'UTC',
      });
      const hiddenExcluded = !(await store.getEventsInRange(
        Date.UTC(2026, 9, 25),
        Date.UTC(2026, 9, 27),
      )).some((entry) => entry.id === hiddenEvent.id);
      const hiddenExplicit = (await store.getEventsInRange(
        Date.UTC(2026, 9, 25),
        Date.UTC(2026, 9, 27),
        [home.id, hiddenCalendar.id],
      )).some((entry) => entry.id === hiddenEvent.id);

      await store.deleteEvent(allDay.id);
      await store.deleteEvent(hiddenEvent.id);
      await store.deleteCalendar(hiddenCalendar.id);

      return {
        updated,
        blocked,
        reassigned,
        eventGone: store.getEvent(event.id) === null,
        calendarGone: store.getCalendar(calendar.id) === null,
        allDayInRange,
        allDayAfterRange,
        hiddenExcluded,
        hiddenExplicit,
      };
    })()`,
    true,
  );

  assert(crud.updated === 'After', 'store update persists in memory', crud.updated);
  assert(crud.blocked, 'calendar delete blocked when events exist');
  assert(crud.reassigned, 'calendar delete reassigns events');
  assert(crud.eventGone, 'event delete removes event');
  assert(crud.calendarGone, 'calendar delete removes calendar');
  assert(crud.allDayInRange, 'all-day event matches overlapping range');
  assert(!crud.allDayAfterRange, 'all-day DTEND is exclusive');
  assert(crud.hiddenExcluded, 'hidden calendar excluded by default');
  assert(crud.hiddenExplicit, 'hidden calendar included when requested');
} finally {
  socket.close();
  chrome.kill('SIGKILL');
}

if (failures.length > 0) {
  console.log(`FAILURES: ${failures.join(', ')}`);
  process.exit(1);
}
console.log('ALL CHECKS PASSED');
