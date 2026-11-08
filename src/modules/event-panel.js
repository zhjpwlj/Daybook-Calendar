import { dt } from '../core/datetime.js';
import { store } from '../core/store.js';

/** @typedef {import('@js-temporal/polyfill').Temporal.ZonedDateTime} ZonedDateTime */
/** @typedef {import('../core/types.js').Event} Event */
/** @typedef {import('../core/types.js').EventDraft} EventDraft */
/** @typedef {import('../core/types.js').Occurrence} Occurrence */

/** @type {Intl.DateTimeFormatOptions} */
const DATE_LABEL = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
/** @type {Intl.DateTimeFormatOptions} */
const SHORT_DATE = { month: 'short', day: 'numeric' };
/** @type {Intl.DateTimeFormatOptions} */
const TIME_LABEL = { hour: 'numeric', minute: '2-digit' };

/** @type {HTMLDialogElement | undefined} */
let dialog;

/**
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} tag
 * @param {string | null} [className]
 * @param {string} [text]
 * @returns {HTMLElementTagNameMap[K]}
 */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * @param {string} label
 * @param {string} text
 * @param {string} [className]
 * @returns {HTMLButtonElement}
 */
function button(label, text, className) {
  const node = el('button', className, text);
  node.type = 'button';
  node.dataset.action = label;
  return node;
}

/** @returns {HTMLDialogElement} */
function getDialog() {
  if (dialog) return dialog;
  dialog = document.createElement('dialog');
  dialog.className = 'event-panel';
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  });
  document.body.append(dialog);
  return dialog;
}

/** @param {Node} node */
function open(node) {
  const panel = getDialog();
  panel.replaceChildren(node);
  if (!panel.open) panel.showModal();
}

function close() {
  if (dialog?.open) dialog.close();
}

/**
 * @param {string} title
 * @param {{ left?: Node | null, right?: Node | null }} [options]
 * @returns {HTMLElement}
 */
function header(title, { left, right } = {}) {
  const head = el('header', 'event-panel-head');
  const start = left ?? el('span', 'event-panel-spacer');
  const heading = el('h2', 'event-panel-title', title);
  const end = right ?? el('span', 'event-panel-spacer');
  head.append(start, heading, end);
  return head;
}

/**
 * @param {ZonedDateTime} zoned
 * @returns {string}
 */
function timeOf(zoned) {
  return zoned.toPlainTime().toString({ smallestUnit: 'minute' });
}

/**
 * @param {Event} event
 * @returns {string}
 */
function whenLabel(event) {
  if (event.all_day) {
    const start = dt.fromDateString(event.all_day_start);
    const endKey = dt.addDaysToDateString(event.all_day_end, -1);
    if (endKey === event.all_day_start) return dt.format(start, DATE_LABEL);
    return `${dt.format(start, SHORT_DATE)} – ${dt.format(dt.fromDateString(endKey), { ...SHORT_DATE, year: 'numeric' })}`;
  }

  const start = dt.toZoned(event.dtstart_utc);
  if (!event.dtend_utc) return dt.format(start, { ...DATE_LABEL, ...TIME_LABEL });
  const end = dt.toZoned(event.dtend_utc);
  const sameDay = start.toPlainDate().equals(end.toPlainDate());
  if (sameDay) {
    return `${dt.format(start, DATE_LABEL)}, ${dt.format(start, TIME_LABEL)} – ${dt.format(end, TIME_LABEL)}`;
  }
  return `${dt.format(start, { ...DATE_LABEL, ...TIME_LABEL })} – ${dt.format(end, { ...DATE_LABEL, ...TIME_LABEL })}`;
}

/**
 * @param {Occurrence} occurrence
 * @returns {HTMLButtonElement}
 */
function eventRow(occurrence) {
  const event = occurrence.event;
  const row = button('open-event', '', 'event-day-row');
  row.dataset.eventId = event.id;
  row.dataset.occurrenceStart = String(occurrence.startUtc);
  const time = el(
    'span',
    'event-day-time',
    event.all_day ? 'All day' : dt.format(dt.toZoned(occurrence.startUtc), TIME_LABEL),
  );
  const calendar = store.getCalendar(event.calendar_id);
  const dot = el('span', 'event-dot');
  dot.style.setProperty('--chip-color', calendar?.color ?? 'var(--event-chip-stripe)');
  row.append(time, dot, el('span', 'event-day-title', event.summary || 'Untitled event'));
  if (occurrence.unsupported) row.classList.add('is-unsupported');
  return row;
}

/**
 * @param {Occurrence[]} occurrences
 * @returns {Occurrence[]}
 */
function sortEvents(occurrences) {
  return [...occurrences].sort((a, b) => {
    if (a.event.all_day !== b.event.all_day) return a.event.all_day ? -1 : 1;
    return a.startUtc - b.startUtc;
  });
}

/**
 * @param {string} eventId
 * @param {number | null} [occurrenceStartUtc]
 */
export function openDetail(eventId, occurrenceStartUtc = null) {
  const event = store.getEvent(eventId);
  if (!event) return;

  const view = el('article', 'event-detail');
  const edit = button('edit', 'Edit', 'event-primary');
  const remove = button('delete', 'Delete', 'event-danger');
  const closeButton = button('close', 'Close', 'event-plain');

  view.append(
    header(event.summary || 'Untitled event', { right: closeButton }),
    el('p', 'event-detail-when', whenLabel(event)),
  );

  const calendar = store.getCalendar(event.calendar_id);
  const calendarRow = el('p', 'event-detail-calendar');
  const dot = el('span', 'event-dot');
  dot.style.setProperty('--chip-color', calendar?.color ?? 'var(--event-chip-stripe)');
  calendarRow.append(dot, el('span', null, calendar?.name ?? 'Calendar'));
  view.append(calendarRow);

  if (event.location) {
    view.append(el('p', 'event-detail-location', event.location));
  }
  if (event.description) {
    view.append(el('p', 'event-detail-description', event.description));
  }

  const actions = el('div', 'event-actions');
  actions.append(remove, edit);
  view.append(actions);

  closeButton.addEventListener('click', close);
  edit.addEventListener('click', () => openEditor({ event, occurrenceStartUtc }));
  remove.addEventListener('click', async () => {
    if (!window.confirm('Delete this event?')) return;
    await store.deleteEvent(event.id);
    close();
  });

  open(view);
}

/** @param {string} dateKey */
export async function openDay(dateKey) {
  const dayStart = dt.fromDateString(dateKey);
  const events = sortEvents(
    await store.getEventsInRange(dt.toUtc(dayStart), dt.toUtc(dt.addDays(dayStart, 1))),
  );
  const view = el('section', 'event-day');
  const closeButton = button('close', 'Close', 'event-plain');
  view.append(header(dt.format(dayStart, DATE_LABEL), { right: closeButton }));

  if (events.length === 0) {
    view.append(el('p', 'event-day-empty', 'No events this day.'));
  } else {
    const list = el('div', 'event-day-list');
    for (const occurrence of events) list.append(eventRow(occurrence));
    view.append(list);
  }

  const actions = el('div', 'event-actions');
  const add = button('new', 'New event', 'event-primary');
  actions.append(add);
  view.append(actions);

  closeButton.addEventListener('click', close);
  add.addEventListener('click', () => openEditor({ dateKey }));
  for (const row of view.querySelectorAll('.event-day-row')) {
    row.addEventListener('click', () => {
      const element = /** @type {HTMLElement} */ (row);
      const eventId = element.dataset.eventId;
      const start = element.dataset.occurrenceStart;
      if (eventId) openDetail(eventId, start ? Number(start) : null);
    });
  }

  open(view);
}

/**
 * @param {string | null} dateKey
 * @returns {{ startDate: string, startTime: string, endDate: string, endTime: string }}
 */
function defaultSlot(dateKey) {
  const now = dt.nowZoned();
  const today = now.toPlainDate().toString();

  if (!dateKey || dateKey === today) {
    const start = now.with({ minute: 0, second: 0, millisecond: 0 }).add({ hours: 1 });
    const end = start.add({ hours: 1 });
    return {
      startDate: start.toPlainDate().toString(),
      startTime: timeOf(start),
      endDate: end.toPlainDate().toString(),
      endTime: timeOf(end),
    };
  }

  return { startDate: dateKey, startTime: '09:00', endDate: dateKey, endTime: '10:00' };
}

/**
 * @param {{ event?: Event | null, dateKey?: string | null, occurrenceStartUtc?: number | null }} [options]
 */
export function openEditor({ event = null, dateKey = null, occurrenceStartUtc = null } = {}) {
  const slot = event ? null : defaultSlot(dateKey);
  const start = event && !event.all_day ? dt.toZoned(event.dtstart_utc) : null;
  const end = event?.all_day
    ? null
    : event?.dtend_utc
      ? dt.toZoned(event.dtend_utc)
      : (start?.add({ hours: 1 }) ?? null);

  const view = el('form', 'event-form');
  view.noValidate = true;

  const cancel = button('cancel', 'Cancel', 'event-plain');
  const save = el('button', 'event-save', 'Save');
  save.type = 'submit';

  const title = el('input', 'event-input');
  title.id = 'event-title';
  title.name = 'summary';
  title.type = 'text';
  title.placeholder = 'Untitled event';
  title.autocomplete = 'off';
  title.value = event?.summary ?? '';

  const allDay = el('input');
  allDay.id = 'event-all-day';
  allDay.type = 'checkbox';
  allDay.checked = event?.all_day ?? false;
  const allDayLabel = el('label', 'event-check');
  allDayLabel.htmlFor = 'event-all-day';
  allDayLabel.append(allDay, el('span', null, 'All day'));

  const startDate = el('input', 'event-input');
  startDate.id = 'event-start-date';
  startDate.type = 'date';
  startDate.value =
    (event?.all_day ? event.all_day_start : start?.toPlainDate().toString()) ??
    slot?.startDate ??
    '';

  const startTime = el('input', 'event-input');
  startTime.id = 'event-start-time';
  startTime.type = 'time';
  startTime.value = start ? timeOf(start) : (slot?.startTime ?? '');

  const endDate = el('input', 'event-input');
  endDate.id = 'event-end-date';
  endDate.type = 'date';
  endDate.value = event?.all_day
    ? dt.addDaysToDateString(event.all_day_end, -1)
    : (end?.toPlainDate().toString() ?? slot?.endDate ?? '');

  const endTime = el('input', 'event-input');
  endTime.id = 'event-end-time';
  endTime.type = 'time';
  endTime.value = end ? timeOf(end) : (slot?.endTime ?? '');

  const startTimeWrap = el('span', 'event-time');
  startTimeWrap.append(startTime);
  const endTimeWrap = el('span', 'event-time');
  endTimeWrap.append(endTime);

  const calendarSelect = el('select', 'event-input');
  calendarSelect.id = 'event-calendar';
  for (const calendar of store
    .getCalendars()
    .filter((entry) => entry.visible || entry.id === event?.calendar_id)) {
    const option = el('option', null, calendar.name);
    option.value = calendar.id;
    calendarSelect.append(option);
  }
  calendarSelect.value = event?.calendar_id ?? store.getVisibleCalendarIds()[0] ?? '';

  const location = el('input', 'event-input');
  location.id = 'event-location';
  location.type = 'text';
  location.value = event?.location ?? '';

  const description = el('textarea', 'event-input event-textarea');
  description.id = 'event-description';
  description.rows = 3;
  description.value = event?.description ?? '';

  const error = el('p', 'event-error', '');
  error.hidden = true;
  error.setAttribute('role', 'alert');

  const row = (
    /** @type {string} */ labelText,
    /** @type {HTMLElement} */ control,
  ) => {
    const wrapper = el('label', 'event-row');
    wrapper.append(el('span', 'event-label', labelText), control);
    return wrapper;
  };

  const startsRow = row('Starts', startDate);
  startsRow.append(startTimeWrap);
  const endsRow = row('Ends', endDate);
  endsRow.append(endTimeWrap);

  const body = el('div', 'event-panel-body');
  body.append(
    row('Title', title),
    allDayLabel,
    startsRow,
    endsRow,
    row('Calendar', calendarSelect),
    row('Location', location),
    row('Notes', description),
    error,
  );

  const syncAllDay = () => {
    startTimeWrap.hidden = allDay.checked;
    endTimeWrap.hidden = allDay.checked;
  };
  syncAllDay();
  allDay.addEventListener('change', syncAllDay);

  view.append(
    header(event ? 'Edit event' : 'New event', { left: cancel, right: save }),
    body,
  );

  cancel.addEventListener('click', close);

  view.addEventListener('submit', async (submitEvent) => {
    submitEvent.preventDefault();

    /** @param {string} message */
    const showError = (message) => {
      error.textContent = message;
      error.hidden = false;
    };

    if (!startDate.value || !endDate.value) {
      showError('Pick a start and end date.');
      return;
    }

    const patch = {
      summary: title.value.trim(),
      calendar_id: calendarSelect.value,
      location: location.value.trim() || null,
      description: description.value.trim() || null,
    };

    /** @type {EventDraft} */
    let draft;

    if (allDay.checked) {
      if (endDate.value < startDate.value) {
        showError('End date cannot be before the start date.');
        return;
      }
      draft = {
        ...patch,
        all_day: true,
        all_day_start: startDate.value,
        all_day_end: dt.addDaysToDateString(endDate.value, 1),
        dtstart_utc: null,
        dtstart_tzid: null,
        dtend_utc: null,
        dtend_tzid: null,
      };
    } else {
      if (!startTime.value || !endTime.value) {
        showError('Pick a start and end time.');
        return;
      }
      let startZoned;
      let endZoned;
      try {
        startZoned = dt.fromDateTimeStrings(startDate.value, startTime.value);
        endZoned = dt.fromDateTimeStrings(endDate.value, endTime.value);
      } catch {
        showError('That date and time do not exist in this timezone.');
        return;
      }
      if (dt.toUtc(endZoned) <= dt.toUtc(startZoned)) {
        showError('End must be after start.');
        return;
      }
      draft = {
        ...patch,
        all_day: false,
        all_day_start: null,
        all_day_end: null,
        dtstart_utc: dt.toUtc(startZoned),
        dtstart_tzid: startZoned.timeZoneId,
        dtend_utc: dt.toUtc(endZoned),
        dtend_tzid: endZoned.timeZoneId,
      };
    }

    if (event) {
      await store.updateEvent(event.id, draft);
    } else {
      await store.createEvent(draft);
    }

    close();
  });

  open(view);
  title.focus();
}
