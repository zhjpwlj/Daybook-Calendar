import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dt } from '../datetime.js';
import { expand } from './recurrence.js';
import { validateRrule, validateEditorRrule } from './validate.js';

const fixture = JSON.parse(
  readFileSync(new URL('./rrule-reference.json', import.meta.url), 'utf8'),
);

function makeEvent(spec) {
  const startUtc = Date.parse(spec.dtstart);
  return {
    id: spec.name,
    uid: `${spec.name}@test`,
    calendar_id: 'test',
    summary: spec.name,
    description: null,
    location: null,
    rrule: spec.rule ?? null,
    rrule_supported: spec.rruleSupported ?? true,
    exdates: (spec.exdates ?? []).map((value) => Date.parse(value)),
    rdates: (spec.rdates ?? []).map((value) => Date.parse(value)),
    reminders: [],
    status: 'confirmed',
    transparency: 'opaque',
    source: 'local',
    source_uid: null,
    created_at: 0,
    modified_at: 0,
    raw_valarms: null,
    all_day: false,
    all_day_start: null,
    all_day_end: null,
    dtstart_utc: startUtc,
    dtstart_tzid: spec.tzid ?? 'UTC',
    dtend_utc: startUtc + (spec.durationMinutes ?? 30) * 60_000,
    dtend_tzid: spec.tzid ?? 'UTC',
  };
}

for (const spec of fixture.cases) {
  test(spec.name, () => {
    const occurrences = expand(
      makeEvent(spec),
      Date.parse(spec.rangeStart),
      Date.parse(spec.rangeEnd),
    );
    const starts = occurrences.map((occurrence) =>
      new Date(occurrence.startUtc).toISOString(),
    );

    if (spec.expectedStarts) assert.deepEqual(starts, spec.expectedStarts);
    if (spec.expectedCount) assert.equal(starts.length, spec.expectedCount);
    if (spec.expectedFirst) assert.equal(starts[0], spec.expectedFirst);
    if (spec.expectedLast) assert.equal(starts.at(-1), spec.expectedLast);

    if (spec.expectedWallHour) {
      for (const occurrence of occurrences) {
        assert.equal(dt.toZoned(occurrence.startUtc, spec.tzid).hour, spec.expectedWallHour);
      }
    }
  });
}

test('non-recurring event is a single occurrence', () => {
  const event = makeEvent({ name: 'single', dtstart: '2025-01-01T09:00:00.000Z' });
  const occurrences = expand(event, Date.parse('2025-01-01T00:00:00Z'), Date.parse('2025-02-01T00:00:00Z'));
  assert.equal(occurrences.length, 1);
  assert.equal(occurrences[0].kind, 'single');
  assert.equal(occurrences[0].unsupported, false);
});

test('unsupported flag renders one occurrence with the badge', () => {
  const event = makeEvent({
    name: 'unsupported',
    dtstart: '2025-01-01T09:00:00.000Z',
    rule: 'FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1',
    rruleSupported: false,
  });
  const occurrences = expand(event, Date.parse('2025-01-01T00:00:00Z'), Date.parse('2025-02-01T00:00:00Z'));
  assert.equal(occurrences.length, 1);
  assert.equal(occurrences[0].unsupported, true);
  assert.equal(occurrences[0].kind, 'single');
});

test('validator allowlist', () => {
  assert.equal(validateRrule('FREQ=WEEKLY;BYDAY=MO,WE,FR').supported, true);
  assert.equal(validateRrule('FREQ=DAILY;COUNT=5').supported, true);
  assert.equal(validateRrule('FREQ=MONTHLY;BYDAY=2TU').supported, true);
  assert.equal(
    validateRrule('FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1').supported,
    false,
  );
  assert.equal(validateRrule('FREQ=DAILY;COUNT=5;UNTIL=20250101').supported, false);
  assert.equal(validateRrule('FREQ=HOURLY').supported, false);
  assert.equal(validateRrule('').supported, false);
});

test('editor validator rejects ordinal BYDAY', () => {
  assert.equal(validateEditorRrule('FREQ=MONTHLY;BYDAY=2TU').supported, false);
  assert.equal(validateEditorRrule('FREQ=WEEKLY;BYDAY=MO,WE,FR').supported, true);
});
