import { db } from '../core/db.js';
import { dt } from '../core/datetime.js';
import { log as debugLog } from '../core/debug.js';
import { store } from '../core/store.js';

const DAYS = 3650;
const TIMES = [9, 10, 12, 15, 17];
const BATCH_SIZE = 1000;

export async function seedEvents() {
  await store.load();
  const calendar = store.getCalendars()[0];
  if (!calendar) throw new Error('No calendar to seed into');

  const now = dt.nowUtc();
  const firstDay = dt.nowZoned().startOfDay().subtract({ years: 5 });
  let batch = [];
  let written = 0;

  const flush = async () => {
    if (batch.length === 0) return;
    const chunk = batch;
    batch = [];
    await db.transaction(['events'], 'readwrite', (transaction) => {
      const events = transaction.objectStore('events');
      for (const event of chunk) events.put(event);
    });
    written += chunk.length;
    debugLog('seed:progress', written);
  };

  for (let dayIndex = 0; dayIndex < DAYS; dayIndex += 1) {
    const day = firstDay.add({ days: dayIndex });

    for (const hour of TIMES) {
      const start = day.with({ hour, minute: 0, second: 0, millisecond: 0 });
      const end = start.add({ minutes: 30 });
      const id = `seed-${dayIndex}-${hour}`;

      batch.push({
        id,
        uid: `${id}@daybook`,
        calendar_id: calendar.id,
        summary: `Seed ${dayIndex + 1} \u00b7 ${hour}:00`,
        description: null,
        location: null,
        dtstart_utc: dt.toUtc(start),
        dtstart_tzid: start.timeZoneId,
        dtend_utc: dt.toUtc(end),
        dtend_tzid: end.timeZoneId,
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
        created_at: now,
        modified_at: now,
        raw_valarms: null,
      });

      if (batch.length >= BATCH_SIZE) await flush();
    }
  }

  await flush();
  await store.load();
  debugLog('seed:done', { events: written });
  return written;
}

export async function clearEvents() {
  await db.clear('events');
  await store.load();
  debugLog('seed:cleared');
}
