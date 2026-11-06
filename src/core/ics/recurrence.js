import { Temporal } from '@js-temporal/polyfill';
import rrule from 'rrule';
import { dt, getSystemTimezone } from '../datetime.js';
import { validateRrule } from './validate.js';

// rrule ships an ESM build whose internal imports lack extensions, so Node
// cannot load it. The CJS entry works in both Node and Vite.
const { RRule } = rrule;

/** @typedef {import('../../core/types.js').Event} Event */
/** @typedef {import('../../core/types.js').Occurrence} Occurrence */
/** @typedef {'single' | 'rrule' | 'rdate'} OccurrenceKind */

/**
 * @param {Event} event
 * @returns {number}
 */
function eventStartUtc(event) {
  return event.all_day ? dt.toUtc(dt.fromDateString(event.all_day_start)) : event.dtstart_utc;
}

/**
 * @param {Event} event
 * @returns {number}
 */
function eventDurationMs(event) {
  if (event.all_day) {
    return spanDays(event) * 86_400_000;
  }
  return event.dtend_utc ? Math.max(0, event.dtend_utc - event.dtstart_utc) : 0;
}

/**
 * @param {Event} event
 * @returns {number}
 */
function spanDays(event) {
  if (!event.all_day) return 0;
  return Temporal.PlainDate.from(event.all_day_start)
    .until(Temporal.PlainDate.from(event.all_day_end))
    .days;
}

/**
 * Wall-clock Date for an instant, so rrule.js expands in local time.
 * @param {Event} event
 * @param {number} utcMs
 * @returns {Date}
 */
function toWall(event, utcMs) {
  const zoned = event.all_day ? dt.toZoned(utcMs) : dt.toZoned(utcMs, event.dtstart_tzid);
  return new Date(
    Date.UTC(
      zoned.year,
      zoned.month - 1,
      zoned.day,
      zoned.hour,
      zoned.minute,
      zoned.second,
      zoned.millisecond,
    ),
  );
}

/**
 * @param {Date} wall
 * @param {string} tzid
 * @returns {import('@js-temporal/polyfill').Temporal.ZonedDateTime}
 */
function wallToZoned(wall, tzid) {
  return Temporal.PlainDateTime.from({
    year: wall.getUTCFullYear(),
    month: wall.getUTCMonth() + 1,
    day: wall.getUTCDate(),
    hour: wall.getUTCHours(),
    minute: wall.getUTCMinutes(),
    second: wall.getUTCSeconds(),
    millisecond: wall.getUTCMilliseconds(),
  }).toZonedDateTime(tzid);
}

/**
 * @param {Date} wall
 * @returns {string}
 */
function wallToDateString(wall) {
  const year = wall.getUTCFullYear();
  const month = String(wall.getUTCMonth() + 1).padStart(2, '0');
  const day = String(wall.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * @param {Event} event
 * @param {number} startUtc
 * @param {OccurrenceKind} kind
 * @param {boolean} unsupported
 * @returns {Occurrence}
 */
function occurrenceAt(event, startUtc, kind, unsupported) {
  if (event.all_day) {
    const allDayStart = dt.toDateString(startUtc);
    const allDayEnd = dt.addDaysToDateString(allDayStart, spanDays(event));
    return {
      event,
      startUtc,
      endUtc: dt.toUtc(dt.fromDateString(allDayEnd)),
      allDayStart,
      allDayEnd,
      kind,
      unsupported,
    };
  }

  return {
    event,
    startUtc,
    endUtc: event.dtend_utc === null ? null : startUtc + eventDurationMs(event),
    allDayStart: null,
    allDayEnd: null,
    kind,
    unsupported,
  };
}

/**
 * @param {Event} event
 * @returns {Occurrence}
 */
function singleOccurrence(event) {
  return occurrenceAt(event, eventStartUtc(event), 'single', false);
}

/**
 * @param {Event} event
 * @returns {Occurrence}
 */
function unsupportedOccurrence(event) {
  return occurrenceAt(event, eventStartUtc(event), 'single', true);
}

/**
 * Expand one event into occurrences overlapping [rangeStartUtc, rangeEndUtc).
 * @param {Event} event
 * @param {number} rangeStartUtc
 * @param {number} rangeEndUtc
 * @returns {Occurrence[]}
 */
export function expand(event, rangeStartUtc, rangeEndUtc) {
  if (!event.rrule) return [singleOccurrence(event)];
  if (!event.rrule_supported) return [unsupportedOccurrence(event)];

  const verdict = validateRrule(event.rrule);
  if (!verdict.supported) return [unsupportedOccurrence(event)];

  try {
    return expandRule(event, rangeStartUtc, rangeEndUtc);
  } catch {
    return [unsupportedOccurrence(event)];
  }
}

/**
 * @param {Event} event
 * @param {number} rangeStartUtc
 * @param {number} rangeEndUtc
 * @returns {Occurrence[]}
 */
function expandRule(event, rangeStartUtc, rangeEndUtc) {
  const ruleText = event.rrule;
  if (!ruleText) return [singleOccurrence(event)];

  const tzid = event.all_day ? getSystemTimezone() : event.dtstart_tzid;
  const duration = eventDurationMs(event);
  const wallStart = toWall(event, eventStartUtc(event));
  const wallAfter = toWall(event, rangeStartUtc - duration);
  const wallBefore = toWall(event, rangeEndUtc);

  const parsed = RRule.parseString(ruleText);
  /** @type {Partial<import('rrule').Options>} */
  const options = { ...parsed, dtstart: wallStart };
  if (parsed.until) options.until = toWall(event, parsed.until.getTime());

  const rule = new RRule(options);
  const exdates = new Set(event.exdates ?? []);
  /** @type {Occurrence[]} */
  const occurrences = [];

  for (const wall of rule.between(wallAfter, wallBefore, true)) {
    const startUtc = wallToZoned(wall, tzid).epochMilliseconds;
    if (exdates.has(startUtc)) continue;
    occurrences.push(occurrenceAt(event, startUtc, 'rrule', false));
  }

  if (event.rdates) {
    const seen = new Set(occurrences.map((occurrence) => occurrence.startUtc));
    for (const rdate of event.rdates) {
      if (exdates.has(rdate) || seen.has(rdate)) continue;
      if (rdate + duration < rangeStartUtc || rdate >= rangeEndUtc) continue;
      occurrences.push(occurrenceAt(event, rdate, 'rdate', false));
    }
  }

  occurrences.sort((a, b) => a.startUtc - b.startUtc);
  return occurrences.filter(
    (occurrence) =>
      occurrence.startUtc < rangeEndUtc &&
      (occurrence.endUtc ?? occurrence.startUtc) >= rangeStartUtc,
  );
}
