import { Temporal } from '@js-temporal/polyfill';

/** @typedef {import('@js-temporal/polyfill').Temporal.ZonedDateTime} ZonedDateTime */
/** @typedef {import('@js-temporal/polyfill').Temporal.PlainDate} PlainDate */
/** @typedef {Intl.DateTimeFormatOptions} FormatOptions */

/** @returns {string} */
export function getSystemTimezone() {
  return Temporal.Now.timeZoneId();
}

/** @type {Map<string, Intl.DateTimeFormat>} */
const formatterCache = new Map();

/**
 * @param {ZonedDateTime} zoned
 * @param {FormatOptions} options
 * @returns {Intl.DateTimeFormat}
 */
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
  /** @returns {number} */
  nowUtc() {
    return Temporal.Now.instant().epochMilliseconds;
  },

  /**
   * @param {string} [tzid]
   * @returns {ZonedDateTime}
   */
  nowZoned(tzid = getSystemTimezone()) {
    return Temporal.Now.zonedDateTimeISO(tzid);
  },

  /**
   * @param {ZonedDateTime} zoned
   * @returns {number}
   */
  toUtc(zoned) {
    return zoned.toInstant().epochMilliseconds;
  },

  /**
   * @param {number} utcMs
   * @param {string} [tzid]
   * @returns {ZonedDateTime}
   */
  toZoned(utcMs, tzid = getSystemTimezone()) {
    return Temporal.Instant.fromEpochMilliseconds(utcMs).toZonedDateTimeISO(tzid);
  },

  /**
   * @param {ZonedDateTime} zoned
   * @param {number} days
   * @returns {ZonedDateTime}
   */
  addDays(zoned, days) {
    return zoned.add({ days });
  },

  /**
   * @param {ZonedDateTime} zoned
   * @param {number} months
   * @returns {ZonedDateTime}
   */
  addMonths(zoned, months) {
    return zoned.add({ months });
  },

  /**
   * @param {ZonedDateTime} zoned
   * @returns {ZonedDateTime}
   */
  startOfDay(zoned) {
    return zoned.startOfDay();
  },

  /**
   * @param {ZonedDateTime} zoned
   * @returns {ZonedDateTime}
   */
  startOfMonth(zoned) {
    return zoned.with({ day: 1 }).startOfDay();
  },

  /**
   * @param {ZonedDateTime} zoned
   * @returns {ZonedDateTime}
   */
  endOfMonth(zoned) {
    return zoned
      .with({ day: 1 })
      .add({ months: 1 })
      .subtract({ days: 1 })
      .startOfDay();
  },

  /**
   * @param {ZonedDateTime} zoned
   * @param {number} [weekStartsOn]
   * @returns {ZonedDateTime}
   */
  startOfWeek(zoned, weekStartsOn = 0) {
    const firstDay = weekStartsOn === 0 ? 7 : weekStartsOn;
    const offset = (zoned.dayOfWeek - firstDay + 7) % 7;
    return zoned.startOfDay().subtract({ days: offset });
  },

  /**
   * @param {ZonedDateTime} zoned
   * @param {number} [weekStartsOn]
   * @returns {ZonedDateTime}
   */
  endOfWeek(zoned, weekStartsOn = 0) {
    return dt.addDays(dt.startOfWeek(zoned, weekStartsOn), 6).startOfDay();
  },

  /**
   * @param {ZonedDateTime} zoned
   * @param {FormatOptions} options
   * @returns {string}
   */
  format(zoned, options) {
    return getFormatter(zoned, options).format(zoned.epochMilliseconds);
  },

  /**
   * @param {string} dateString
   * @param {string} timeString
   * @param {string} [tzid]
   * @returns {ZonedDateTime}
   */
  fromDateTimeStrings(dateString, timeString, tzid = getSystemTimezone()) {
    return Temporal.PlainDateTime.from(`${dateString}T${timeString}`).toZonedDateTime(tzid);
  },

  /**
   * @param {string} dateString
   * @param {string} [tzid]
   * @returns {ZonedDateTime}
   */
  fromDateString(dateString, tzid = getSystemTimezone()) {
    return Temporal.PlainDate.from(dateString).toZonedDateTime(tzid);
  },

  /**
   * @param {string} dateString
   * @param {number} days
   * @returns {string}
   */
  addDaysToDateString(dateString, days) {
    return Temporal.PlainDate.from(dateString).add({ days }).toString();
  },

  /**
   * @param {string} tzid
   * @returns {boolean}
   */
  isValidTimezone(tzid) {
    try {
      Temporal.Now.zonedDateTimeISO(tzid);
      return true;
    } catch {
      return false;
    }
  },

  /** @returns {string} */
  todayString() {
    return dt.nowZoned().toPlainDate().toString();
  },

  /**
   * @param {number} utcMs
   * @param {string} [tzid]
   * @returns {string}
   */
  toDateString(utcMs, tzid = getSystemTimezone()) {
    return dt.toZoned(utcMs, tzid).toPlainDate().toString();
  },
};
