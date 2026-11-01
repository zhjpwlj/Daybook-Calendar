import { bus } from './bus.js';
import { db } from './db.js';
import { dt } from './datetime.js';

const DEFAULT_CALENDAR = {
  name: 'Personal',
  color: '#5B7FFF',
};

function clone(value) {
  return structuredClone(value);
}

export const store = {
  events: [],
  calendars: [],
  settings: {},

  async load() {
    const [events, calendars, settingsRows] = await Promise.all([
      db.getAll('events'),
      db.getAll('calendars', 'order'),
      db.getAll('settings'),
    ]);

    this.events = events;
    this.calendars = calendars;
    this.settings = Object.fromEntries(settingsRows.map((row) => [row.key, row.value]));

    if (this.calendars.length === 0) {
      const calendar = {
        id: crypto.randomUUID(),
        name: DEFAULT_CALENDAR.name,
        color: DEFAULT_CALENDAR.color,
        visible: true,
        order: 0,
        source: 'local',
        created_at: dt.nowUtc(),
      };
      await db.put('calendars', calendar);
      this.calendars = [calendar];
    }

    bus.emit('store-loaded', {
      eventCount: this.events.length,
      calendarCount: this.calendars.length,
    });
  },

  async getEventsInRange(startUtc, endUtc, calendarIds) {
    const ids = new Set(calendarIds ?? this.getVisibleCalendarIds());
    const startDate = dt.toDateString(startUtc);
    const endDate = dt.toDateString(endUtc);

    return this.events
      .filter((event) => ids.has(event.calendar_id))
      .filter((event) => {
        if (event.all_day) {
          return event.all_day_start < endDate && event.all_day_end > startDate;
        }
        const eventEnd = event.dtend_utc ?? event.dtstart_utc;
        return event.dtstart_utc < endUtc && eventEnd >= startUtc;
      });
  },

  getEvent(id) {
    return this.events.find((event) => event.id === id) ?? null;
  },

  async createEvent(data) {
    const calendarId =
      data.calendar_id ?? this.getVisibleCalendarIds()[0] ?? this.calendars[0]?.id;

    if (!calendarId) throw new Error('Cannot create an event without a calendar');

    const now = dt.nowUtc();
    const event = {
      description: null,
      location: null,
      dtstart_utc: null,
      dtstart_tzid: null,
      dtend_utc: null,
      dtend_tzid: null,
      all_day: false,
      all_day_start: null,
      all_day_end: null,
      rrule: null,
      rrule_supported: true,
      exdates: null,
      rdates: null,
      reminders: [],
      status: 'confirmed',
      transparency: 'opaque',
      source: 'local',
      source_uid: null,
      raw_valarms: null,
      ...data,
      id: data.id ?? crypto.randomUUID(),
      uid: data.uid ?? crypto.randomUUID(),
      calendar_id: calendarId,
      summary: data.summary ?? '',
      created_at: data.created_at ?? now,
      modified_at: now,
    };

    await db.put('events', event);
    this.events.push(event);

    bus.emit('event-created', { event });
    bus.emit('event-changed', { type: 'create', event });
    return event;
  },

  async updateEvent(id, patch) {
    const existing = this.getEvent(id);
    if (!existing) throw new Error(`Event not found: ${id}`);

    const previous = clone(existing);
    const event = {
      ...existing,
      ...patch,
      id: existing.id,
      uid: existing.uid,
      created_at: existing.created_at,
      modified_at: dt.nowUtc(),
    };

    await db.put('events', event);
    this.events[this.events.indexOf(existing)] = event;

    bus.emit('event-updated', { event, previous });
    bus.emit('event-changed', { type: 'update', event });
    return event;
  },

  async deleteEvent(id) {
    const existing = this.getEvent(id);
    if (!existing) throw new Error(`Event not found: ${id}`);

    await db.delete('events', id);
    this.events = this.events.filter((event) => event.id !== id);

    bus.emit('event-deleted', { eventId: id });
    bus.emit('event-changed', { type: 'delete', event: existing });
  },

  getCalendars() {
    return this.calendars;
  },

  getCalendar(id) {
    return this.calendars.find((calendar) => calendar.id === id) ?? null;
  },

  async createCalendar(data) {
    const calendar = {
      id: crypto.randomUUID(),
      name: data.name ?? 'Calendar',
      color: data.color ?? DEFAULT_CALENDAR.color,
      visible: data.visible ?? true,
      order: data.order ?? this.calendars.length,
      source: data.source ?? 'local',
      created_at: dt.nowUtc(),
    };

    await db.put('calendars', calendar);
    this.calendars.push(calendar);
    this.calendars.sort((a, b) => a.order - b.order);

    bus.emit('calendar-created', { calendar });
    return calendar;
  },

  async updateCalendar(id, patch) {
    const existing = this.getCalendar(id);
    if (!existing) throw new Error(`Calendar not found: ${id}`);

    const calendar = {
      ...existing,
      ...patch,
      id: existing.id,
      created_at: existing.created_at,
    };

    await db.put('calendars', calendar);
    this.calendars[this.calendars.indexOf(existing)] = calendar;
    this.calendars.sort((a, b) => a.order - b.order);

    bus.emit('calendar-updated', { calendar, previous: existing });
    if (Object.hasOwn(patch, 'visible')) {
      bus.emit('calendar-visibility-toggled', {
        calendarId: id,
        visible: calendar.visible,
      });
    }
    return calendar;
  },

  async deleteCalendar(id, { reassignTo } = {}) {
    const calendar = this.getCalendar(id);
    if (!calendar) throw new Error(`Calendar not found: ${id}`);

    const owned = this.events.filter((event) => event.calendar_id === id);
    if (owned.length > 0 && !reassignTo) {
      throw new Error('Calendar has events; reassignTo is required');
    }
    if (reassignTo && !this.getCalendar(reassignTo)) {
      throw new Error(`Reassign target not found: ${reassignTo}`);
    }
    if (reassignTo === id) throw new Error('Cannot reassign a calendar to itself');

    const modifiedAt = dt.nowUtc();

    await db.transaction(['events', 'calendars'], 'readwrite', (transaction) => {
      const eventsStore = transaction.objectStore('events');
      for (const event of owned) {
        eventsStore.put({ ...event, calendar_id: reassignTo, modified_at: modifiedAt });
      }
      transaction.objectStore('calendars').delete(id);
    });

    if (reassignTo) {
      for (const event of owned) {
        event.calendar_id = reassignTo;
        event.modified_at = modifiedAt;
      }
    }
    this.calendars = this.calendars.filter((entry) => entry.id !== id);

    bus.emit('calendar-deleted', { calendar, reassignTo: reassignTo ?? null });
  },

  getVisibleCalendarIds() {
    return this.calendars.filter((calendar) => calendar.visible).map((calendar) => calendar.id);
  },
};
