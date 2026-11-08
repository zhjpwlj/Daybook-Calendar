# M4 — Recurrence engine (implementation plan)

Source spec: `MILESTONE-1~14.md` §M4. `read-after-M14.md` carries M15–M19.
`spec.md` and
`scaffolding/` are absent from this repo (R14): work at the repo root, use the
existing `MILESTONE-N.md` convention, and create the missing fixture in-repo.

## Global Constraints

- Vanilla ES modules, `.js` only. JSDoc annotations; `npm run check:types`
  must exit 0 after every task. Never relax `tsconfig.json` (`strict`,
  `noUncheckedIndexedAccess`).
- `src/core/types.d.ts` is the binding contract. `Event`, `EventDraft`, and
  `Occurrence` shapes do not change without a ledger ruling.
- Pin `rrule@2.8.1` (declared `"rrule": "2.8.1"`, no caret).
- Keep existing patterns: `el()` DOM helpers, `bus` events, one `<dialog>` in
  `event-panel.js`, CSS tokens from `src/styles/tokens.css`.
- Git: stage explicit paths only. Never `git add -A`.
- Do not build: `THISANDFUTURE` split logic, ordinal `BYDAY` authoring in the
  UI, Week/Day/Year/Agenda views, recurrence export, per-occurrence reminders.
- Tests run with `node --test`; test files are excluded from `tsc` because
  `types: []` carries no Node typings.

## Binding decisions (rulings)

- **Strict allowlist.** `validateRrule` accepts `FREQ` in
  `DAILY|WEEKLY|MONTHLY|YEARLY` plus `INTERVAL`, `COUNT`, `UNTIL`, `WKST`,
  `BYDAY` (plain or ordinal), `BYMONTHDAY`, `BYMONTH`. Everything else — including
  `BYSETPOS`, `BYWEEKNO`, `BYYEARDAY`, `EXRULE`, `COUNT`+`UNTIL` together — is
  unsupported. Unsupported events still store the raw rule with
  `rrule_supported: false` and render once with a badge ([C-9]). Ordinal `BYDAY`
  expands on import (V-RRULE-1 needs `BYDAY=2TU`), but `validateEditorRrule`
  rejects it so the v1 editor never authors it.
- **`store.getEventsInRange` returns `Occurrence[]`.** All callers
  (`month.js`, `event-panel.js`) consume occurrences. Single events come back
  as `kind: 'single'`.
- **Recurrence is expanded in wall-clock time** from `dtstart_tzid`, then
  converted back to UTC. That is what keeps 9am at 9am across DST.
- **Work on `main`.** This repo's whole history ships each milestone on `main`
  and Cloudflare deploys from it. No worktree.
- **One rrule specifier.** `rrule`'s ESM build has extensionless internal
  imports that Node cannot resolve, so `vite.config.js` aliases `rrule` to
  `rrule/dist/es5/rrule.js` and prebundles that path. `recurrence.js` imports
  through the alias and reads `rruleModule.RRule ?? rruleModule.default`, which
  covers Vite's named-export interop and Node's namespace-default interop.

## Task 1 — Recurrence engine, validator, fixture, tests

**Files:** `src/core/ics/validate.js` (new), `src/core/ics/recurrence.js` (new),
`src/core/ics/rrule-reference.json` (new), `src/core/ics/recurrence.test.js`
(new), `package.json`, `tsconfig.json`.

**Install:** `npm install --save-exact rrule@2.8.1`. Add script
`"test:recurrence": "node --test src/core/ics/recurrence.test.js"`. Add
`"**/*.test.js"` to `tsconfig.json` `exclude`.

**Public interface — do not rename:**

```js
// validate.js
/** @param {string} rule @returns {{ supported: boolean, reason: string | null }} */
export function validateRrule(rule) {}

// recurrence.js
/** @typedef {import('../../core/types.js').Event} Event */
/** @typedef {import('../../core/types.js').Occurrence} Occurrence */
/**
 * @param {Event} event
 * @param {number} rangeStartUtc
 * @param {number} rangeEndUtc
 * @returns {Occurrence[]}
 */
export function expand(event, rangeStartUtc, rangeEndUtc) {}
```

**Behaviors:**

- No `rrule` → one occurrence, `kind: 'single'`, `unsupported: false`.
- `rrule_supported === false` → one occurrence from the event start,
  `kind: 'single'`, `unsupported: true`. Raw `rrule` untouched.
- Supported rule → expand with `rrule.js`, filter to
  `[rangeStartUtc, rangeEndUtc)`, `kind: 'rrule'`. Apply `exdates` subtraction
  and `rdates` union (`kind: 'rdate'` for rdate-only instants).
- Timed events: build the expansion seed from the wall-clock components of
  `dtstart_utc` in `dtstart_tzid`, hand `rrule.js` a floating `Date`
  (`Date.UTC(...)`), then read results back as UTC components and build a
  `ZonedDateTime` in `dtstart_tzid` via `Temporal.PlainDateTime`.
- All-day events: expand on `all_day_start` / `all_day_end` date strings;
  occurrence `allDayStart`/`allDayEnd` set, `startUtc`/`endUtc` at local
  start-of-day instants.
- Occurrence `endUtc` preserves the event duration; all-day `endUtc` is end of
  the exclusive end date.
- Any throw from `rrule.js` is caught: return one unsupported occurrence, never
  crash the view.
- Prefer reusing `dt` helpers from `src/core/datetime.js`; add one helper there
  only if it removes real duplication (that file already owns Temporal).

**Fixture (`rrule-reference.json`):** array of at least these 10 cases, each
with `name`, `event` (an Event-shaped object with `rrule` or `rdates`/`exdates`),
`rangeStartUtc`, `rangeEndUtc`, and `expected` (array of ISO start strings):

1. daily x10; 2. weekly MO,WE,FR x8 weeks; 3. monthly BYMONTHDAY=15 x12;
4. monthly BYDAY=2TU x6 (supported by the engine, expected dates correct);
5. yearly x3; 6. daily COUNT=100; 7. daily UNTIL=20250601; 8. DST-crossing
daily in `America/New_York` starting the Friday before spring-forward (assert
wall clock stays 09:00); 9. RDATE on a monthly series; 10. EXDATE on a weekly
series.

**Tests:** `recurrence.test.js` reads the JSON with
`readFileSync(new URL('./rrule-reference.json', import.meta.url))`, runs
`expand` per case, asserts exact ISO starts, and adds validator cases:
`FREQ=MONTHLY;BYDAY=2TU` unsupported, `FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1`
unsupported, `FREQ=WEEKLY;BYDAY=MO,WE,FR` supported, `FREQ=DAILY;COUNT=5`
supported, `FREQ=DAILY;COUNT=5;UNTIL=20250101` unsupported.

**Acceptance:** `npm run test:recurrence` passes; `npm run check:types` exits 0;
`npm run build` exits 0.

## Task 2 — Store and views consume occurrences

**Files:** `src/core/store.js`, `src/modules/views/month.js`,
`src/modules/event-panel.js`, `src/styles/month.css`.

**Behaviors:**

- `store.getEventsInRange` calls `expand(event, startUtc, endUtc)` for every
  candidate event and returns `Occurrence[]`, sorted by `startUtc`, all-day
  first on equal days. Visibility filtering stays as it is.
- `month.js` groups by `occurrence.allDayStart ?? dt.toDateString(occurrence.startUtc)`,
  renders `occurrence.event`, opens detail with the event id **and**
  `occurrence.startUtc`, and marks unsupported occurrences with a badge: add a
  `data-unsupported="true"` attribute plus title text "Recurrence not fully
  supported".
- `event-panel.js` day list consumes occurrences for the row title/time; rows
  keep opening the event id. `openDetail(eventId, occurrenceStartUtc)` gains the
  optional second parameter and passes it to `openEditor` when editing (Task 3
  uses it; this task only threads it through).
- `month.css` gets one rule for the unsupported badge (small warning glyph,
  fixed size, no layout shift). Use an existing token for color.

**Acceptance:** `check:types` and `build` pass; Month shows 5 chips for a
daily x5 series seeded through the editor; unsupported event shows one chip with
the badge.

## Task 3 — Editor recurrence UI and series edit

**Files:** `src/modules/event-panel.js`, `src/styles/editor.css`.

**Behaviors:**

- Recurrence control in the editor: `select` with None, Daily, Weekly, Every
  weekday, Monthly, Yearly, Custom. Preset values produce canonical rules
  (`FREQ=DAILY`, `FREQ=WEEKLY;BYDAY=<start weekday>`, `FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR`,
  `FREQ=MONTHLY;BYMONTHDAY=<start day>`, `FREQ=YEARLY`). Custom reveals a raw
  RRULE textarea, pre-filled from the existing event.
- On save, run `validateRrule`. Unsupported rule → show the reason in the
  existing error element and offer a `window.confirm('Save as a single event?')`;
  confirm stores `rrule` raw and `rrule_supported: false` (one occurrence,
  badge), cancel aborts the save.
- Editing a recurring event first shows a choice: "This event", "Entire
  series", "This and following". The first two work; "This and following"
  shows the existing unsupported notice path plus a debug log line, no crash,
  no data change.
- "This event": append the occurrence start to `exdates` on the series, then
  create a standalone event at that occurrence (same duration, no `rrule`,
  fresh `id`/`uid`). Series must still show on the other dates.
- "Entire series": current editor behavior; updates the event fields and rule.
- Keep the editor usable at 320px width; add CSS only where the new controls
  need it.

**Acceptance:** `check:types` and `build` pass; V-RRULE-2 path works (badge,
edit offers save-as-single or cancel, no crash); "This event" leaves the series
intact.

## Results

- `npm run check:types` — exit 0.
- `npm run test:recurrence` — 14/14 pass (10 fixture cases, unsupported paths,
  allowlist, editor gate).
- `npm run build` — `dist/assets/index-CSwm0Hgz.css` (17.36 kB) and
  `dist/assets/index-BLs_dXWG.js` (236.63 kB, 70.35 kB gzip); 10 precache entries.
- `CHROME=/opt/brave.com/brave/brave npm run smoke` — all checks pass, including
  daily x5 authored through the editor, the three-way series edit choice,
  EXDATE + standalone copy for "This event", and the unsupported-rule
  confirm/cancel path. Month render with 18,250 stored events stays under
  200 ms.
