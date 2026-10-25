import { Temporal } from '@js-temporal/polyfill';

export function getSystemTimezone() {
  return Temporal.Now.timeZoneId();
}

const formatterCache = new Map();

function getFormatter(zoned, options) {
  const key = `${zoned.timeZoneId}|${JSON.stringify(options)}`;
  let formatter = formatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(undefined, {
      ...options,
      timeZone: zoned.timeZoneId,
    });
    formatterCache.set(key, formatter);
  }
  return formatter;
}

export const dt = {
  nowUtc() {
    return Temporal.Now.instant().epochMilliseconds;
  },

  nowZoned(tzid = getSystemTimezone()) {
    return Temporal.Now.zonedDateTimeISO(tzid);
  },

  toUtc(zoned) {
    return zoned.toInstant().epochMilliseconds;
  },

  toZoned(utcMs, tzid = getSystemTimezone()) {
    return Temporal.Instant.fromEpochMilliseconds(utcMs).toZonedDateTimeISO(tzid);
  },

  addDays(zoned, days) {
    return zoned.add({ days });
  },

  addMonths(zoned, months) {
    return zoned.add({ months });
  },

  startOfDay(zoned) {
    return zoned.startOfDay();
  },

  startOfMonth(zoned) {
    return zoned.with({ day: 1 }).startOfDay();
  },

  endOfMonth(zoned) {
    return zoned
      .with({ day: 1 })
      .add({ months: 1 })
      .subtract({ days: 1 })
      .startOfDay();
  },

  startOfWeek(zoned, weekStartsOn = 0) {
    const firstDay = weekStartsOn === 0 ? 7 : weekStartsOn;
    const offset = (zoned.dayOfWeek - firstDay + 7) % 7;
    return zoned.startOfDay().subtract({ days: offset });
  },

  endOfWeek(zoned, weekStartsOn = 0) {
    return dt.addDays(dt.startOfWeek(zoned, weekStartsOn), 6).startOfDay();
  },

  format(zoned, options) {
    return getFormatter(zoned, options).format(zoned.epochMilliseconds);
  },

  isValidTimezone(tzid) {
    try {
      Temporal.Now.zonedDateTimeISO(tzid);
      return true;
    } catch {
      return false;
    }
  },

  todayString() {
    return dt.nowZoned().toPlainDate().toString();
  },

  toDateString(utcMs, tzid = getSystemTimezone()) {
    return dt.toZoned(utcMs, tzid).toPlainDate().toString();
  },
};
