import { bus } from '../../core/bus.js';
import { dt } from '../../core/datetime.js';
import { log as debugLog } from '../../core/debug.js';
import { store } from '../../core/store.js';
import { openDay, openDetail, openEditor } from '../event-panel.js';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEK_STARTS_ON = 0;
const MAX_CHIPS = 3;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(className, label, text) {
  const node = el('button', className, text);
  node.type = 'button';
  node.setAttribute('aria-label', label);
  return node;
}

export function createMonthView(container) {
  let current = dt.nowZoned();
  let renderToken = 0;

  async function render(anchor = current) {
    current = anchor;
    const token = ++renderToken;
    const started = performance.now();

    const monthStart = dt.startOfMonth(current);
    const firstDay = WEEK_STARTS_ON === 0 ? 7 : WEEK_STARTS_ON;
    const offset = (monthStart.dayOfWeek - firstDay + 7) % 7;
    const weeks = Math.ceil((offset + monthStart.daysInMonth) / 7);
    const gridStart = dt.addDays(monthStart, -offset);
    const gridEnd = dt.addDays(gridStart, weeks * 7);

    const events = await store.getEventsInRange(dt.toUtc(gridStart), dt.toUtc(gridEnd));
    if (token !== renderToken) return;

    const calendarById = new Map(store.getCalendars().map((calendar) => [calendar.id, calendar]));
    const byDay = new Map();

    for (const event of events) {
      const key = event.all_day
        ? event.all_day_start
        : dt.toDateString(event.dtstart_utc);
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key).push(event);
    }

    for (const dayEvents of byDay.values()) {
      dayEvents.sort((a, b) => {
        if (a.all_day !== b.all_day) return a.all_day ? -1 : 1;
        return (a.dtstart_utc ?? 0) - (b.dtstart_utc ?? 0);
      });
    }

    const header = el('header', 'month-header');
    const previous = button('month-nav', 'Previous month', '\u2039');
    const next = button('month-nav', 'Next month', '\u203a');
    const today = button('month-today', 'Jump to today', 'Today');
    const title = el(
      'h2',
      'month-title',
      dt.format(monthStart, { month: 'long', year: 'numeric' }),
    );
    header.append(previous, title, next, today);

    const weekdayRow = el('div', 'month-weekdays');
    const labels = [...WEEKDAYS.slice(WEEK_STARTS_ON), ...WEEKDAYS.slice(0, WEEK_STARTS_ON)];
    for (const label of labels) weekdayRow.append(el('span', null, label));

    const grid = el('div', 'month-grid');
    grid.setAttribute('role', 'grid');
    grid.setAttribute('aria-label', dt.format(monthStart, { month: 'long', year: 'numeric' }));

    const todayKey = dt.todayString();

    for (let index = 0; index < weeks * 7; index += 1) {
      const day = dt.addDays(gridStart, index);
      const key = day.toPlainDate().toString();
      const cell = el('div', 'month-cell');
      cell.setAttribute('role', 'gridcell');
      cell.tabIndex = 0;
      cell.setAttribute(
        'aria-label',
        dt.format(day, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
      );

      if (day.month !== monthStart.month || day.year !== monthStart.year) {
        cell.classList.add('is-other-month');
      }
      if (day.dayOfWeek === 6 || day.dayOfWeek === 7) cell.classList.add('is-weekend');
      if (key === todayKey) cell.classList.add('is-today');

      const dateNumber = el('span', 'month-date', String(day.day));
      if (key === todayKey) dateNumber.classList.add('is-today');
      cell.append(dateNumber);

      const dayEvents = byDay.get(key) ?? [];
      if (dayEvents.length > 0) {
        const chips = el('div', 'month-chips');
        for (const event of dayEvents.slice(0, MAX_CHIPS)) {
          const chip = el('button', 'event-chip');
          chip.type = 'button';
          chip.dataset.eventId = event.id;
          const calendar = calendarById.get(event.calendar_id);
          chip.style.setProperty('--chip-color', calendar?.color ?? 'var(--event-chip-stripe)');
          chip.title = event.summary || 'Untitled event';

          if (!event.all_day) {
            chip.append(
              el(
                'span',
                'event-chip-time',
                dt.format(dt.toZoned(event.dtstart_utc), {
                  hour: 'numeric',
                  minute: '2-digit',
                }),
              ),
            );
          }
          chip.append(el('span', 'event-chip-title', event.summary || 'Untitled'));
          chip.addEventListener('click', (clickEvent) => {
            clickEvent.stopPropagation();
            openDetail(event.id);
          });
          chips.append(chip);
        }

        if (dayEvents.length > MAX_CHIPS) {
          const more = el('button', 'month-more', `+${dayEvents.length - MAX_CHIPS} more`);
          more.type = 'button';
          more.addEventListener('click', (clickEvent) => {
            clickEvent.stopPropagation();
            openDay(key);
          });
          chips.append(more);
        }
        cell.append(chips);
      }

      cell.addEventListener('click', (clickEvent) => {
        if (clickEvent.target.closest('.event-chip, .month-more')) return;
        openEditor({ dateKey: key });
      });
      cell.addEventListener('keydown', (keyEvent) => {
        if (keyEvent.key !== 'Enter' && keyEvent.key !== ' ') return;
        keyEvent.preventDefault();
        openEditor({ dateKey: key });
      });

      grid.append(cell);
    }

    const view = el('section', 'month-view');
    view.append(header, weekdayRow, grid);
    container.replaceChildren(view);

    previous.addEventListener('click', () => render(dt.addMonths(current, -1)));
    next.addEventListener('click', () => render(dt.addMonths(current, 1)));
    today.addEventListener('click', () => render(dt.nowZoned()));

    requestAnimationFrame(() => {
      debugLog('month:render', {
        ms: Number((performance.now() - started).toFixed(1)),
        events: events.length,
        weeks,
      });
    });
  }

  bus.on('store-loaded', () => render(current));
  bus.on('event-changed', () => render(current));
  bus.on('calendar-visibility-toggled', () => render(current));
  bus.on('calendar-deleted', () => render(current));

  return { render };
}
