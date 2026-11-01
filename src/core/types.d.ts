// Shared data shapes. No runtime code. Every module imports these via:
//   /** @typedef {import('./types.js').Event} Event */
// The `.js` specifier resolves to this `.d.ts` file under moduleResolution "bundler".

export type CalendarSource = 'local' | 'google' | 'microsoft';
export type EventSource = CalendarSource | 'ics' | 'csv' | 'json';
export type EventStatus = 'confirmed' | 'tentative' | 'cancelled';
export type Transparency = 'opaque' | 'transparent';
export type ReminderMechanism = 'toast' | 'valarm' | 'push';
export type ThemeName = 'light' | 'dark' | 'apple' | 'google';
export type ViewName = 'month' | 'week' | 'day' | 'year' | 'agenda';

export interface Calendar {
  id: string;
  name: string;
  /** CSS color from the fixed Part 12 palette. */
  color: string;
  visible: boolean;
  order: number;
  source: CalendarSource;
  created_at: number;
}

export interface Reminder {
  /** Offset before start. 0 means at start. */
  trigger_before_minutes: number;
  type: ReminderMechanism;
  /** Toast bookkeeping only; null until fired. */
  fired_at: number | null;
}

interface EventBase {
  /** Stable local ID, generated once. [C-5] */
  id: string;
  /** iCal UID. Local events generate one; imports reuse the source UID. */
  uid: string;
  calendar_id: string;
  summary: string;
  description: string | null;
  location: string | null;
  /** Raw RRULE as imported or authored. */
  rrule: string | null;
  /** false means view falls back to one occurrence and shows a badge. [C-9] */
  rrule_supported: boolean;
  exdates: number[] | null;
  rdates: number[] | null;
  reminders: Reminder[];
  status: EventStatus;
  transparency: Transparency;
  source: EventSource;
  source_uid: string | null;
  created_at: number;
  modified_at: number;
  /** Raw VALARM blocks preserved for round-trip. [C-10] */
  raw_valarms: string[] | null;
}

export interface AllDayEvent extends EventBase {
  all_day: true;
  /** YYYY-MM-DD. */
  all_day_start: string;
  /** YYYY-MM-DD, exclusive per RFC 5545. [C-2] */
  all_day_end: string;
  dtstart_utc: null;
  dtstart_tzid: null;
  dtend_utc: null;
  dtend_tzid: null;
}

export interface TimedEvent extends EventBase {
  all_day: false;
  all_day_start: null;
  all_day_end: null;
  dtstart_utc: number;
  dtstart_tzid: string;
  /** Null for zero-duration events. */
  dtend_utc: number | null;
  dtend_tzid: string | null;
}

export type Event = AllDayEvent | TimedEvent;

export interface Settings {
  theme: ThemeName;
  last_view: ViewName;
  week_starts_on: 0 | 1;
  default_reminder_minutes: number;
  push_enabled: boolean;
  push_payload_opt_in: 'eventId+fireAt' | 'full';
  hidden_calendar_ids: string[];
  /** Part 8 week grid bounds; 0 <= start < end <= 24. R7. */
  week_view_start_hour: number;
  week_view_end_hour: number;
}

export interface Occurrence {
  event: Event;
  /** UTC ms. For all-day occurrences this is the start-of-day instant used for sorting. */
  startUtc: number;
  endUtc: number | null;
  /** YYYY-MM-DD for all-day occurrences. */
  allDayStart: string | null;
  /** YYYY-MM-DD, exclusive. */
  allDayEnd: string | null;
  kind: 'single' | 'rrule' | 'rdate';
  /** True when the raw rule could not be expanded and the event renders once. */
  unsupported: boolean;
}

/** Capability surface for the M15 multi-platform refactor. */
export interface Platform {
  isStandalone: boolean;
  isIOS: boolean;
  hasServiceWorker: boolean;
  hasPush: boolean;
  hasNotification: boolean;
}
