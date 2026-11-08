# M2–M14 — build spec pack

One document per milestone. Feed in order. Each is self-contained for its milestone but expects `brief.md`, `spec.md`, `decisions.md`, `rulings.md`, and `scaffolding/` as the base pack. Each names its blocking verification (from `spec.md` Appendix B), its non-goals, and its review format. **Do not skip non-goals — they are the scope contract.**

Carry forward: rulings accumulated in prior milestones are binding. If a ruling from M2 contradicts this document, the ruling wins and this document is the one that's stale.

---

## M2 — Data model, IndexedDB, store, calendar CRUD, empty Month view

**Blocking verification:** V-Store-1
**Depends on:** M1 (shell, SW, viewport, theme scaffold)
**Adds:** the entire persistence layer, the store, calendar management, and a Month view that can render an empty grid and (behind a dev flag) a loaded dataset.

**Files to create:**

- `src/core/db.js` — IndexedDB wrapper per `spec.md` PART 6.
- `src/core/store.js` — store per `spec.md` PART 4 and PART 6.
- `src/core/bus.js` — synchronous `CustomEvent` dispatcher.
- `src/core/datetime.js` — Temporal polyfill wrapper. All the functions listed in `spec.md` PART 6.
- `src/modules/calendars/calendars.js` — CRUD per `spec.md` PART 12.
- `src/modules/views/month.js` — Month grid; no event rendering yet (see "empty" below).
- `src/dev/seed.js` — dev-only seeding function. Gate behind `import.meta.env.DEV` or a `?dev=1` query parameter. Must not ship in production builds.
- `src/styles/tokens.css` — the token contract from `spec.md` PART 21, values for Light theme only (other themes land in M14).

**Store schema:** exactly per `spec.md` PART 4, IndexedDB v1. Stores: `events`, `calendars`, `settings`, `push_queue`. Indexes as listed.

**Store APIs:** exactly per `spec.md` PART 6 (`store.*` and `db.*`). Not more. **No `store.getEventsInRange` implementation yet** — stub it to return `[]` and throw a `// TODO M3` comment.

**Behaviors:**

- On boot: `db.open()` → `store.load()` → `calendars.load()` → emit `store-loaded` → render Month view.
- On first launch (no calendars): create default calendar "Personal" (color `#5B7FFF`), emit `calendar-created`.
- Month view renders 5 or 6 rows, 7 columns, day numbers, prev/next/today buttons, correct grid lines from `--grid-line`. **Empty cells — no event chips yet.**
- Swipe on month grid: navigate prev/next month. (Full gesture testing lands in M5; M2 proves the render.)
- `bus` events emitted per `spec.md` PART 5 — at minimum `store-loaded`, `calendar-created`, `calendar-updated`, `calendar-deleted`, `calendar-visibility-toggled`, `view-changed`.

**Do NOT build:**

- Event editor (M3)
- Any event rendering on the month grid (M3)
- Recurrence (M4)
- Week/Day/Year/Agenda (M5, M6)
- Import/export of anything (M7–M9)
- OAuth (M10)
- Toast / push (M11, M12)
- Search / palette / keyboard (M13)
- Settings UI / themes beyond Light (M14)
- The `store.getEventsInRange` implementation

**Acceptance checklist (human reviewable before hardware test):**

- [ ] Default calendar created on first boot with correct name + color.
- [ ] Second calendar created via console (`store.createCalendar({...})`) appears in store and persists.
- [ ] Delete calendar with 0 events: succeeds without reassign prompt.
- [ ] Delete calendar with events: **not applicable yet** — events don't exist until M3. Skip.
- [ ] Month grid renders 12 consecutive months via prev/next without layout shift.
- [ ] Today's cell visually distinct (accent border or tint).
- [ ] Grep: no `new Date()` or `Temporal.*` outside `src/core/datetime.js`. No `Intl.DateTimeFormat` outside `src/core/datetime.js`.
- [ ] `import.meta.env.PROD` build has no `dev/seed.js` in the bundle.

**Blocking verification on hardware (V-Store-1):**

1. On iPad, dev-build with `?dev=1` loads 18,250 synthetic events into IndexedDB via `seed.js` (10y × 5/day).
2. Reload app. Measure: time from `store-loaded` emit to Month view first paint. Target <200ms.
3. Swipe away app from iOS app switcher. Reopen. Events still present. `store.getAll('events').length === 18250`.
4. Relaunch Safari standalone (quit + reopen from Home Screen icon). Data persists.
5. **Fail if:** TTFB >200ms, OR data lost after swipe-away, OR data lost after quit+reopen, OR IndexedDB open throws.

**Review request format:**

> M2 complete. V-Store-1: [measured ms] TTFB on iPad, data survived swipe-away and quit+reopen (18,250 events). Files created: [list]. Deviations: [list or "none"]. Notes: [anything surprising]. Ready for M3.

**Expected rulings:**

- The exact IndexedDB versioning approach if `spec.md`'s schema doesn't survive first write (unlikely).
- The dev-seed mechanism if `import.meta.env.DEV` doesn't tree-shake cleanly with the `scaffolding/vite.config.js`. If a ruling is needed, prefer `?dev=1` + explicit `if` guard over build-flag tree-shaking.

---

## M3 — Event editor, Month view with data

**Blocking verification:** V-Editor-1
**Depends on:** M2 (store, db, calendar CRUD, Month skeleton)
**Adds:** the create/edit/delete path, event rendering on Month, and `store.getEventsInRange` (single-occurrence only; recurrence lands in M4).

**Files to create:**

- `src/modules/editor/editor.js` — modal per `spec.md` PART 9.
- `src/ui/date-picker.js` — custom iOS-safe date picker (never `<input type=date>`).
- `src/ui/time-picker.js` — custom iOS-safe time picker.
- `src/ui/modal.js` — full-screen modal shell.
- `src/ui/toast.js` — in-app toast (used by M11 later; basic surface built now so `edit-saved` has a place to announce).
- Update `src/modules/views/month.js` — render event chips per day cell.
- Update `src/core/store.js` — implement `store.getEventsInRange` (single-occurrence; ignore `rrule`, `rdates`, `exdates` for now — return the base `dtstart` only).

**Behaviors:**

- Tap empty area of month cell → editor opens in create mode with that date pre-filled at the last-used time-of-day (default 9:00am for first-ever edit).
- Editor fields per `spec.md` PART 9. All-day toggle hides time pickers and shows date range.
- Save → write to store → emit `edit-saved` + `event-changed` → Month re-renders → toast "Event created".
- Tap event chip → detail view (read-only). Edit button opens editor. Delete with confirm.
- Event chips: calendar color stripe, time, summary. Max 3 per cell; overflow shows "+N more" → tap opens Day view (built in M5; for M3, "+N more" opens an agenda-styled list of that day's events in the modal).
- All-day events render at the top of the cell before timed events. Multi-day all-day events span across cells.
- `store.getEventsInRange(startUtc, endUtc)` returns events sorted by `dtstart_utc`. Range check: `dtstart_utc >= startUtc && dtstart_utc < endUtc`. **For all-day events, check `all_day_start` intersects range** — do not compare UTC.

**Do NOT build:**

- Any recurrence expansion (M4). `rrule` field is stored on the event if the editor sets it, but the view ignores it — the event renders only its `dtstart`.
- Week/Day/Year/Agenda (M5, M6).
- Import/export (M7–M9).
- OAuth (M10).
- Reminders actually firing (M11) — the reminder fields are stored on the event; nothing fires them yet.
- Search / palette / keyboard (M13).
- Any theme besides Light (M14).

**Acceptance checklist:**

- [ ] Create, edit, delete round-trips without error.
- [ ] All-day event created via editor: `all_day=true`, `all_day_start` and `all_day_end` set, `dtstart_utc` null. Verify via console.
- [ ] Timed event created via editor: `dtstart_utc` and `dtstart_tzid` set, `all_day` false. Verify via console.
- [ ] All-day event renders on the correct day in Month view. A 2-day all-day event (start Jan 15, end Jan 17 exclusive) spans Jan 15 and Jan 16 visually.
- [ ] Event chip color matches the event's calendar color.
- [ ] "+N more" appears when > 3 events on a day. Tap opens the list.
- [ ] Custom date/time pickers render correctly on iPhone; native `<input type=date>` is not used anywhere (grep).
- [ ] Editor cancels without writing on Escape and on X button.
- [ ] Editor with unsaved changes confirms before closing.

**Blocking verification on hardware (V-Editor-1):**

1. On iPhone, create 5 timed events across 3 days via editor. 3 with reminders set.
2. Create 2 all-day events: one single-day, one 3-day.
3. Edit one timed event: change time. Saved correctly.
4. Toggle an all-day event on: dates preserved, no time fields. Toggle back off: default time reappears.
5. Delete one event.
6. Relaunch app. All 6 remaining events present, correct fields.
7. **Fail if:** any edit is lost on relaunch, any all-day event shifted by a day, any timed event's time is off by more than its stored TZID explains.

**Review request format:**

> M3 complete. V-Editor-1: [pass/fail], events survived relaunch. Files created: [list]. All-day round-trips correctly. Deviations: [list or "none"]. Ready for M4.

**Expected rulings:**

- If the custom date/time picker takes more than ~1 day, consider using `<input type=date>` as fallback for non-iOS browsers (Android Chrome). **Ruling should state this explicitly** and mark it "iOS uses custom, other platforms may fall back to native."
- If `event-changed` fires too many times per save (e.g., create + edit in rapid succession for the "default time prefill" behavior), a debounce ruling may be needed. Prefer not — synchronous is fine at this scale.

---

## M4 — Recurrence engine

**Blocking verification:** V-RRULE-1, V-RRULE-2
**Depends on:** M3 (event editor, Month with data)
**Adds:** `rrule` npm integration, `RDATE`/`EXDATE` handling, fallback behavior for unsupported rules, and expanded rendering on Month.

**Files to create:**

- `src/core/ics/recurrence.js` — the wrapper per `spec.md` PART 6.
- `src/core/ics/validate.js` — `validateRrule` per `spec.md` PART 6.
- Update `src/core/store.js` — `getEventsInRange` now calls `recurrence.expand(event, startUtc, endUtc)` for events with `rrule` set.
- Update `src/modules/editor/editor.js` — recurrence dropdown per `spec.md` PART 9 (None / Daily / Weekly / Every weekday / Monthly / Yearly / Custom raw RRULE).
- Update `src/modules/views/month.js` — render expanded occurrences; badge unsupported rules.

**Dependencies:**

- Add `rrule` to `package.json`. Pin the version. ~30KB min.

**Behaviors:**

- Supported rules per `spec.md` PART 10 expand correctly.
- Unsupported rules (`BYSETPOS`, ordinal `BYDAY` authored in UI, `EXRULE`, `RECURRENCE-ID;RANGE=THISANDFUTURE`): event imports/stores with `rrule_supported=false`, renders as single occurrence with badge, raw rule preserved. [C-9]
- `RDATE` and `EXDATE` handled at expansion time: `rdates[]` union, `exdates[]` subtraction.
- DST boundary: recurring 9am `America/New_York` stays 9am across spring-forward. Verified per V-RRULE-1.
- Editor: recurrence dropdown updates `rrule` string. "Custom" opens raw RRULE textarea; validate on save via `validateRrule`; reject save if unsupported (with option to save anyway as single occurrence).
- Editing a recurring event shows the three-option dialog per `spec.md` PART 9. Only "Edit this event" and "Edit entire series" implemented. "This and all following" shows the unsupported toast.

**Do NOT build:**

- `THISANDFUTURE` split-series logic (v1.1 deferral per B9-C).
- Ordinal `BYDAY` in the editor UI (accept on import via rrule.js, don't author in the UI).
- Week/Day/Year/Agenda (M5, M6).
- Any export of recurrence (M9) — recurrence fields are stored, not yet exported.
- Reminder generation per occurrence (M11).

**Acceptance checklist:**

- [ ] Create "Every day for 5 days" starting Jan 1: renders on Jan 1, 2, 3, 4, 5 in Month view.
- [ ] Create "Every 2 weeks on Mon, Wed" for 6 months: renders on correct days.
- [ ] Create "Monthly on the 15th": renders on 15th of each month.
- [ ] Create "Yearly": renders once per year.
- [ ] DST: event at 9am `America/New_York` starting the Friday before spring-forward renders at 9am on both sides. (Visual: same clock time in cell.)
- [ ] Import event with `RRULE:FREQ=MONTHLY;BYDAY=2TU`: renders once with badge "recurrence not fully supported". Raw rule preserved in `event.rrule`.
- [ ] Edit a recurring event: dialog offers "this event" / "entire series". "This and following" shows unsupported toast.
- [ ] "Edit this event" adds `EXDATE` on the series and creates a standalone event. Original series still shows on other dates.

**Blocking verification on hardware (V-RRULE-1, V-RRULE-2):**

*V-RRULE-1 (correctness against fixture):*

1. Load reference fixture file (from `scaffolding/fixtures/rrule-reference.json` — create this fixture during M4):
   - Daily x 10
   - Weekly on MO,WE,FR x 8 weeks
   - Monthly `BYMONTHDAY=15` x 12
   - Monthly ordinal `BYDAY=2TU` x 6 (accepted, expand via rrule.js, verify correctness)
   - Yearly x 3
   - Daily `COUNT=100`
   - Daily `UNTIL=20250601`
   - DST-crossing daily in `America/New_York`
   - `RDATE` on a monthly series
   - `EXDATE` on a weekly series
2. For each, verify expansion against expected output in the fixture.
3. **Fail if:** any date is off, any DST boundary is wrong, any count/until over/under-runs.

*V-RRULE-2 (fallback on iPhone):*

1. Import event with `RRULE:FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1`.
2. Verify: renders once with badge, raw rule stored.
3. Tap edit: dialog offers "save as single event" or "cancel".
4. **Fail if:** view crashes, badge missing, raw rule lost, or edit path crashes.

**Review request format:**

> M4 complete. V-RRULE-1: [pass against N fixture cases]. V-RRULE-2: [pass], unsupported rule badges correctly. Deviations: [list or "none"]. rrule.js pinned at [version]. Ready for M5.

**Expected rulings:**

- If `rrule.js` bundle size exceeds 50KB min after tree-shaking, ruling may be needed on whether to lazy-load `recurrence.js` (acceptable: it's on the critical path for view rendering, so lazy-loading is likely wrong).
- If `rrule.js` throws during expansion on any fixture, catch-and-fallback rule per `spec.md` PART 22.

---

## M5 — Week, Day, Year views + gesture navigation

**Blocking verification:** V-Gesture-1, V-Gesture-2
**Depends on:** M4 (recurrence expands correctly on Month)
**Adds:** three new views, view navigation (via swipe and via button), and the gesture framework shared across views.

**Files to create:**

- `src/modules/views/week.js` — Week view per `spec.md` PART 8.
- `src/modules/views/day.js` — Day view (Week view with 1 column).
- `src/modules/views/year.js` — Year view per `spec.md` PART 8.
- `src/modules/views/nav.js` — shared view-switching and gesture logic.
- Update `scaffolding/src/main.js` — mount all views, route `view-changed`.

**Behaviors:**

- View switcher: prev/next arrows in header + view-name dropdown. Emits `view-changed` with `{view, date}`.
- Swipe left/right on any view navigates within that view (prev/next week/day/year).
- Week view: 7 columns, hour grid 6am–midnight by default (settings override lands in M14), all-day row at top, timed events positioned correctly, overlapping events side-by-side.
- Day view: same, one column.
- Year view: 12 mini-months, dot indicators per day with events. Loads only presence flags — **do not load full event objects** (per `spec.md` PART 8 rationale). Use a lightweight query.
- Current-time indicator on Week/Day views, updated every minute via `setInterval` (cleared on view unmount).
- Tap empty slot in Week/Day → editor opens with that time.
- Drag from empty slot in Week → editor with dragged duration (drag-to-create per V-Gesture-2).
- Tap in Year view: enters Month view for that mini-month's month.
- `Alt+M/W/D/Y/A` shortcuts become partially active from M13 — until then, wire the keyboard module's `bind` calls but do not gate on shortcuts working. Simpler: no keyboard bindings yet, land in M13.

**Do NOT build:**

- Agenda view (M6).
- Calendar filter UI (M6) — visibility toggling works if set via console, but no UI.
- Import/export (M7–M9).
- OAuth (M10).
- Reminders (M11, M12).
- Search / palette / keyboard bindings (M13).
- Settings UI beyond what M3 built (M14).
- The full theme set (M14).

**Gesture implementation note:**

Hand-rolled. `touchstart` with `{passive: false}` on the view container. Track delta-x; if |delta-x| > 40px and |delta-x| > 2× |delta-y| within 300ms → it's a swipe. `preventDefault()` only on confirmed horizontal swipe. Release triggers prev/next navigation. **Do not use a gesture library.** If hand-rolling fails V-Gesture-1, a ruling may be needed — but prefer fixing the hand-rolled logic first.

Edge-swipe-back: test that a swipe that starts within 20px of the left edge on iPhone does not trigger app horizontal swipe — let Safari's back gesture win (if back gesture is enabled; in standalone PWA it isn't enabled by default, so edge swipe is a no-op — verify this too). If the app misreads edge-swipe as its own swipe, gate: do not treat as view-swipe if `touchstart.clientX < 20` or `> window.innerWidth - 20`.

**Acceptance checklist:**

- [ ] Week view renders all 7 days for the current week; all-day events correctly span columns.
- [ ] Overlapping timed events in Week render side-by-side without overlap.
- [ ] Current-time indicator updates every minute.
- [ ] Day view renders correctly for a day with 10+ events.
- [ ] Year view renders 12 mini-months correctly, dots appear on days with events, today highlighted.
- [ ] Year view loads for a year with 500+ events in <300ms (lightweight query check).
- [ ] Swipe on Month: prev/next month. On Week: prev/next week. On Day: prev/next day. On Year: prev/next year.
- [ ] Swipe that starts within 20px of screen edge does NOT trigger view navigation.
- [ ] Tap empty Week slot: editor opens at that time.
- [ ] Drag empty Week slot: editor opens with dragged duration.

**Blocking verification on hardware (V-Gesture-1, V-Gesture-2):**

*V-Gesture-1 (view transitions + edge behavior):*

1. On iPhone, in standalone PWA. Start on Month view.
2. Swipe left/right: navigates prev/next month. Clean transition.
3. Switch to Week via view-name dropdown. Swipe: prev/next week. Clean.
4. Same for Day, Year.
5. From any view, swipe starting at x < 20px from left edge: does NOT trigger view navigation. (If the OS intercepts as back-nav: confirm it doesn't exit the app to Safari. If it does, escalate to ruling.)
6. **Fail if:** any view's swipe doesn't navigate, any swipe is stuttery enough to miss the release, edge swipe navigates the view or exits the app unexpectedly.

*V-Gesture-2 (drag-to-create):*

1. On iPhone, in Week view.
2. Long-press on an empty 9am slot, drag down to 10am, release.
3. Editor opens with start = 9:00am, end = 10:00am on that day.
4. **Fail if:** editor doesn't open, times are wrong, or drag is misread as scroll.

**Review request format:**

> M5 complete. V-Gesture-1: [pass/fail], all four view transitions swipe cleanly, edge-swipe tested [behavior noted]. V-Gesture-2: [pass/fail]. Files created: [list]. Deviations: [list or "none"]. Ready for M6.

**Expected rulings:**

- Gesture sensitivity thresholds if 40px / 300ms feels wrong on device. Ruling adjusts numbers, not logic.
- If `passive: false` triggers iOS console warning about scroll performance, a ruling may be needed to limit the non-passive listener scope to specific containers rather than the whole view.

---

## M6 — Agenda view, all-day handling polish, calendar filter UI

**Blocking verification:** V-Agenda-1
**Depends on:** M5 (all views render)
**Adds:** the fifth view, the calendar filter UI, and final polish on all-day rendering across all views.

**Files to create:**

- `src/modules/views/agenda.js` — Agenda per `spec.md` PART 7.
- `src/modules/calendars/filter.js` — visibility panel UI.
- Update all view files — finalize all-day rendering (multi-day spans, "+N more", tap-to-day).

**Behaviors:**

- Agenda: vertical list grouped by date. Date headers ("Today", "Tomorrow", "Wed 8 Jan"). All-day events first per day. Infinite scroll: 30-day chunks. Re-renders on `event-changed`, `calendar-visibility-toggled`.
- Filter: top-level button in every view header. Tap opens panel listing all calendars with toggles. "All" / "None" quick actions. Changes emit `calendar-visibility-toggled` and update all views.
- All-day rendering finalized: multi-day all-day events span correctly across week boundaries (in Month view, does the bar break at week boundaries or run continuous? **Continuous within a week, break at week boundary** — Apple and Google do this).
- Hidden calendar events: filtered out of all views. Event detail still renders correctly if opened from a badge, with the calendar chip dimmed + "hidden" indicator.

**Do NOT build:**

- Import/export (M7–M9).
- OAuth (M10).
- Reminders (M11, M12).
- Search / palette / keyboard (M13).
- Settings UI beyond what M3 built (M14).
- Full themes (M14).

**Acceptance checklist:**

- [ ] Agenda renders 100+ events grouped correctly with date headers.
- [ ] Infinite scroll loads next 30 days on scroll-to-bottom.
- [ ] All-day multi-day event spans correctly in Month view (breaks at week boundary), Week view (spans continuous across days), Day view (single bar).
- [ ] Filter panel opens from every view's header; toggles work immediately.
- [ ] Hidden calendar's events disappear from all views on toggle.
- [ ] Hidden calendar's event opened via deep link (or badge) shows correctly with "hidden" indicator.
- [ ] Filter state persists across app relaunch (via `settings.hidden_calendar_ids`).

**Blocking verification on hardware (V-Agenda-1):**

1. On iPad, load 500 events across 2 years, 3 calendars.
2. Open Agenda. Measure TTFB and scroll smoothness (subjective but must pass "no stutter when flicking").
3. Toggle one calendar off. Verify all views update.
4. Scroll agenda to bottom, verify next chunk loads.
5. **Fail if:** render >500ms, scroll stutters visibly, filter toggle doesn't propagate to all views, or scroll doesn't paginate.

**Review request format:**

> M6 complete. V-Agenda-1: [measured ms TTFB, scroll behavior noted]. Filter propagates correctly. Files created: [list]. Deviations: [list or "none"]. Ready for M7.

**Expected rulings:**

- If infinite scroll needs explicit scroll listener throttling for iOS performance, ruling documents the throttle rate. Prefer `requestAnimationFrame`-coalesced.
- If all-day spanning across week boundaries is ambiguous in Month view for the "carries to next week" case, ruling locks the behavior (default: break at week boundary, but the event title is shown in both weeks' cells with a leading/trailing arrow indicator).

---

## M7 — `.ics` import

**Blocking verification:** V-Import-ICS-1, V-Import-ICS-2
**Depends on:** M6 (all views render, agenda works)
**Adds:** the first import path — `.ics` file, liberal parser, conflict merge dialog.

**Files to create:**

- `src/core/ics/parser.js` — per `spec.md` PART 6.
- `src/core/ics/validate.js` — event validation (already partially exists from M4 for RRULE; extend to full event).
- `src/modules/import/ics.js` — import orchestration, merge logic, conflict emission.
- `src/modules/import/conflict-dialog.js` — per-conflict and bulk conflict resolution UI.
- Create `scaffolding/fixtures/import-google-sample.ics` — a real Google Calendar export (anonymize or synthesize; 100+ events, mixed recurrence, some with `VALARM`).

**Behaviors:**

- `<input type="file" accept=".ics,.ical,text/calendar">`.
- Parse via `parser.parse(text)`. Warnings collected.
- Per-event validation: skip invalid, count skipped.
- Dedupe by `uid` per `spec.md` PART 6 merge rules: identical → silent merge; differing → conflict dialog.
- Conflict dialog: per-event (Keep local / Use import / Keep both) with a "Apply to all remaining" option.
- Report at end via modal: "Imported N. Merged M. Skipped K malformed. Resolved C conflicts."
- Emit events: `import-started`, `import-progress` (throttled), `import-completed`.
- Malformed file (not parseable at all): `import-failed`, no state change. [C-8]
- No network. Fully local.

**Do NOT build:**

- `.csv` import (M8).
- `.json` import (M8).
- OAuth (M10).
- `.ics` export (M9).
- Any write-back mechanism.

**Acceptance checklist:**

- [ ] Import 100-event Google `.ics` file. Report accurate: correct counts.
- [ ] Re-import same file: all events "merged" (0 new). No duplicates.
- [ ] Modify one event in the file (via text editor), re-import: 1 conflict surfaced. Resolve "Use import": local updated. Re-import again: 0 conflicts.
- [ ] Malformed `.ics` (e.g., truncated): rejected with clear error. Store unchanged.
- [ ] File with 100 events, 3 invalid: 97 imported, 3 skipped, report accurate.
- [ ] File with unsupported `RRULE`: 1 event imported with badge, raw rule preserved.
- [ ] `.ical` extension accepted (same parser).
- [ ] File > 5MB: rejected with clear message.

**Blocking verification on hardware (V-Import-ICS-1, V-Import-ICS-2):**

*V-Import-ICS-1:*

1. On iPad, import `scaffolding/fixtures/import-google-sample.ics` (real Google export).
2. Verify all events render across Month/Week/Agenda.
3. Verify report matches actual counts.
4. **Fail if:** any event missing, any unsupported rule crashes, report inaccurate, import >10s for 100 events.

*V-Import-ICS-2:*

1. On iPhone, after V-Import-ICS-1 import, re-import same file.
2. Verify: 0 new events, 0 conflicts (identical content).
3. Modify one event externally (start time change), re-import.
4. Verify: 1 conflict dialog. Resolve "Keep local": local unchanged. Re-import again with same modified file: conflict dialog appears again (content still differs).
5. Resolve "Use import": local updated.
6. **Fail if:** duplicates created, silent merge occurred on differing content, conflict dialog doesn't appear, or "Keep local" mutates local.

**Review request format:**

> M7 complete. V-Import-ICS-1: [pass], imported N events from Google sample in [time]. V-Import-ICS-2: [pass], no duplicates, conflict dialog fires on differing content. Files created: [list]. Deviations: [list or "none"]. Ready for M8.

**Expected rulings:**

- If Google sample contains more `VALARM` complexity than expected (e.g., `ATTENDEE`), ruling may be needed on preservation strategy for `raw_valarms`. Default per `spec.md`: preserve as-is in `raw_valarms[]`.
- If `uid` generation for events without `UID` (rare but valid) needs a rule: default to generating a `uid`, marking `source_uid = null`.

---

## M8 — `.csv` and `.json` import; `.json` and `.csv` export

**Blocking verification:** V-Import-CSV-1, V-Export-JSON-1
**Depends on:** M7 (`.ics` import, merge logic, conflict dialog)
**Adds:** the other import formats and the two non-`.ics` exports.

**Files to create:**

- `src/modules/import/csv.js` — Google Calendar CSV schema.
- `src/modules/import/json.js` — Daybook native backup format.
- `src/modules/export/csv.js` — Google Calendar CSV out.
- `src/modules/export/json.js` — full backup out.
- Create `scaffolding/fixtures/import-google-sample.csv` — Google Calendar CSV export.
- Create `scaffolding/fixtures/import-daybook-sample.json` — Daybook backup file.

**Behaviors:**

- **`.csv` in:** parse Google Calendar CSV, no UID, no RRULE, no VALARM. Each import creates new events (no dedupe possible). Warn in UI. All-day handling: Google's CSV uses inclusive end date — convert to exclusive internally.
- **`.csv` out:** Google Calendar CSV schema. Single-occurrence events only. Recurring events: exported as first occurrence, with warning in dialog "Recurring events are exported as their first occurrence. Use `.ics` for full fidelity."
- **`.json` in:** parse Daybook backup, full fidelity. Dedupe by `id` first, then `uid`. Version check. Merge with conflict dialogs per M7. **Full backup restore** (Settings > Restore from backup) requires the destructive confirm dialog (type "REPLACE").
- **`.json` out:** full backup. `{ version: 1, exported_at, calendars, events, settings }`. `settings` excludes `supabase_url`, `supabase_anon_key`, `vapid_public_key`.

**Do NOT build:**

- `.ics` export (M9).
- OAuth (M10).
- Reminders (M11, M12).
- Search / palette / keyboard (M13).
- Full Settings UI (M14) — except the Import/Export dialog entry points and Restore-from-backup flow, which land here so they're testable.

**Acceptance checklist:**

- [ ] `.csv` import: 50-event file imports. All-day events correct. Duplicate import creates duplicates (with warning).
- [ ] `.csv` export: 50 events export, re-import creates 50 new events (no dedupe possible), fields preserved.
- [ ] `.json` export → `.json` import (merge mode): 0 new, 0 conflicts (identical content).
- [ ] `.json` export → modify one event locally → re-import: 1 conflict dialog. Resolve "Use import": local overwritten. Verify event `id` is preserved (not regenerated).
- [ ] Restore-from-backup: prompts "type REPLACE". Type REPLACE → all local data cleared, backup loaded. Type anything else → cancelled.
- [ ] `.json` export excludes `supabase_url`, `vapid_public_key`.
- [ ] `.json` export version field = 1.

**Blocking verification on hardware (V-Import-CSV-1, V-Export-JSON-1):**

*V-Import-CSV-1:*

1. On iPhone, import `import-google-sample.csv` (50 events).
2. Verify all-day events land on correct dates (no off-by-one).
3. Verify recurring events land as their first occurrence only (with badge "single occurrence from CSV").
4. **Fail if:** any event off by a day, any all-day event becomes timed, crash on import.

*V-Export-JSON-1:*

1. On iPad, create 100 events across 3 calendars with various reminder types and recurrence.
2. Export `.json`.
3. Clear all data via Settings > Data > Clear all.
4. Import `.json` (restore mode).
5. Verify all 100 events, 3 calendars with correct colors and names, all reminder types, all recurrence fields present and identical.
6. **Fail if:** any field lost, any calendar color changed, any reminder type changed, or restore is partial.

**Review request format:**

> M8 complete. V-Import-CSV-1: [pass]. V-Export-JSON-1: [pass], full round-trip of 100 events across 3 calendars preserved. Files created: [list]. Deviations: [list or "none"]. Ready for M9.

**Expected rulings:**

- If CSV parsing chokes on embedded commas/quotes (RFC 4180 edge cases), ruling needed on whether to use a mini CSV parser or a library. Prefer hand-rolled RFC 4180 for 40 lines over adding a library.
- If `.json` restore crashes on a very large dataset (>10k events), ruling on streaming vs in-memory. Prefer in-memory at v1 sizes; the check is V-Store-1's 18,250 test — if that passed, restore will too.

---

## M9 — `.ics` export with `VALARM`; round-trip verification

**Blocking verification:** V-Export-ICS-1, V-Export-VALARM-1
**Depends on:** M8 (`.json` and `.csv` exports working)
**Adds:** the guaranteed reminder mechanism — `.ics` out with `VALARM` blocks. This is the M9 deliverable and the reminder mechanism for Part 16 Mechanism 1.

**Files to create:**

- `src/modules/export/ics.js` — per `spec.md` PART 6 (`core/ics/writer.js` was already created — extend it here).
- `src/modules/export/export-dialog.js` — scope selection UI (all visible / selected calendar / date range).

**Behaviors:**

- Serialize via `core/ics/writer.js`. Full RFC 5545.
- `VALARM` per reminder of `type: 'valarm'`. `TRIGGER:-PT15M` style. `ACTION:DISPLAY`. `DESCRIPTION:` set to event summary.
- `raw_valarms` preserved as-is for round-trip. [C-10]
- All-day: `DTSTART;VALUE=DATE` + `DTEND;VALUE=DATE` exclusive.
- Timed: `DTSTART;TZID=<original>` — preserves original TZID.
- `RRULE` raw. If `rrule_supported=false`, add `X-DAYBOOK-RRULE-UNSUPPORTED` (ignorable by other apps).
- Download via `<a download="daybook-YYYY-MM-DD.ics" href="blob:...">`. Revoke blob URL immediately after click.
- Round-trip test: import → export → re-import → verify identical event count and fields.

**Do NOT build:**

- OAuth (M10).
- Toast reminders (M11).
- Push reminders (M12).
- Search / palette / keyboard (M13).
- Full settings UI (M14) beyond the export dialog entry point.

**Acceptance checklist:**

- [ ] Export 10 events (mixed timed/all-day/recurring/with reminders). File opens in iOS Calendar (AirDrop the `.ics`).
- [ ] Exported file re-imports into Daybook with identical content (round-trip byte-identical except `DTSTAMP`, `PRODID`).
- [ ] All-day events round-trip without off-by-one.
- [ ] Recurring events round-trip with original `RRULE` string.
- [ ] Events with `VALARM` export with correct `TRIGGER` offsets.
- [ ] Events with `raw_valarms` preserved (unknown `X-*` properties, `ATTENDEE` if present) — verify by textual inspection.
- [ ] Export scope options work: all visible / one calendar / date range.

**Blocking verification on hardware (V-Export-ICS-1, V-Export-VALARM-1):**

*V-Export-ICS-1 (round-trip):*

1. On iPhone, import `import-google-sample.ics` (from M7 fixture).
2. Export all as `daybook-export.ics`.
3. Clear all data.
4. Import `daybook-export.ics`.
5. Diff against original import result (via `.json` export of both, byte-compare excluding `created_at`, `modified_at`).
6. **Fail if:** any field differs, any event count differs, any `VALARM` lost or duplicated.

*V-Export-VALARM-1:*

1. Create event: "Test Reminder" on tomorrow at 3:00pm, reminder `valarm` at 15 min before.
2. Export `.ics`. AirDrop to iPhone (or download + open). Import to iOS Calendar.
3. Wait until 2:45pm tomorrow. iOS Calendar fires the notification.
4. **Fail if:** notification doesn't fire, fires at wrong time, or event not in iOS Calendar.
5. **This is the load-bearing verification for the entire reminder strategy.** If it fails, [C-7] is violated and the entire D3 architecture is reconsidered.

**Review request format:**

> M9 complete. V-Export-ICS-1: [pass], round-trip identical for N events. V-Export-VALARM-1: [pass/fail], iOS Calendar fired alarm at [time] for event at [time]. Files created: [list]. Deviations: [list or "none"]. Ready for M10.

**Expected rulings:**

- If iOS Calendar rejects the `.ics` on import due to some `VALARM` property, ruling on which properties to strip. Prefer stripping unknown `X-*` properties from the emitted `VALARM` while preserving them in `raw_valarms`.
- If round-trip is not byte-identical for some field (e.g., `CREATED`), ruling adds the field to the exclusion list in V-Export-ICS-1.

---

## M10 — OAuth import (Google + Microsoft)

**Blocking verification:** V-OAuth-1, V-OAuth-2, V-CSP-1
**Depends on:** M9 (all local import/export paths working, `_headers` already has base CSP)
**Adds:** import from Google Calendar and Microsoft Graph via OAuth 2.0 + PKCE. Import-only. No token persistence.

**Files to create:**

- `public/oauth/google/start.html` — initiates OAuth, PKCE.
- `public/oauth/google/callback.html` — receives code, exchanges for token, writes `sessionStorage`, navigates back.
- `public/oauth/microsoft/start.html` — same for Microsoft.
- `public/oauth/microsoft/callback.html` — same.
- `src/modules/import/oauth/google.js` — calendar listing, event fetch, merge into store.
- `src/modules/import/oauth/microsoft.js` — same.
- `src/modules/import/oauth/oauth-ui.js` — provider selection, calendar selection dialog.
- Update `scaffolding/_headers` — extend CSP per `spec.md` PART 14. **This is the silent-blocker category from the prior session. Enumerate all token-exchange origins.**

**Dependencies:** none new — use native `fetch` and `crypto.subtle` for PKCE.

**OAuth client provisioning:** This milestone requires the app publisher to have registered OAuth client IDs with Google and Microsoft. **This is a release-blocker outside the code** — do not start M10 until the client IDs and redirect URIs are registered. Flagged in `brief.md` F-a. If client IDs are not yet provisioned at M10 start, this milestone blocks and M11–M14 can proceed in parallel — do not reorder, just note that M10 completion depends on external provisioning.

**Behaviors:**

- User taps "Import from Google" in Import/Export dialog. Confirmation: "This will download your calendar events from Google. Changes you make in Daybook will not be sent back to Google. Continue?".
- Start page redirects to Google auth URL with PKCE challenge and CSRF state.
- Google redirects to callback page. Callback page exchanges code → tokens. Tokens in `sessionStorage` (`access_token`, `expires_at`). Navigate back to `/`.
- PWA reads tokens, lists calendars (`GET /calendar/v3/users/me/calendarList`), shows selection dialog per `spec.md` PART 14.
- User selects calendars. Fetch events paginated. Progress bar via `import-progress`.
- Import via same merge logic as `.ics`.
- Tokens cleared from `sessionStorage` immediately after fetch completes. [B6]
- Microsoft: same, different endpoints (`login.microsoftonline.com`, `graph.microsoft.com`, `GET /me/calendars`, `GET /me/calendars/<id>/events`).
- Failure modes per `spec.md` PART 14.

**Do NOT build:**

- Token refresh / persistence (v1.1).
- Write-back to Google or Microsoft.
- Microsoft `offline_access` scope.
- Settings UI for OAuth clients (M14) — the entry points exist, not the credential config UI (there is none; clients are baked in).
- Any custom-build mechanism for OAuth clients — v1.0 ships one build with one set of client IDs.

**Acceptance checklist:**

- [ ] CSP allowlist includes: `accounts.google.com`, `oauth2.googleapis.com`, `www.googleapis.com`, `login.microsoftonline.com`, `graph.microsoft.com`. Grep `_headers`.
- [ ] PKCE challenge correctly generated (verify via console).
- [ ] `state` parameter validated on callback.
- [ ] Token in `sessionStorage` after callback, cleared after fetch.
- [ ] Calendar list fetch returns correct count.
- [ ] Event fetch paginated correctly (Google returns max 250/page; verify multiple pages fetched).
- [ ] Import merges via same dedupe logic as `.ics`.
- [ ] Google account with 3 calendars, importing 2: only 2 imported, third not touched.
- [ ] Microsoft personal account works end-to-end. Organizational account either works or surfaces "admin consent required" clearly.

**Blocking verification on hardware (V-OAuth-1, V-OAuth-2, V-CSP-1):**

*V-CSP-1 (do first — silent blocker):*

1. Deploy to production hosting with the CSP from `_headers`.
2. On iPad standalone PWA, initiate Google OAuth.
3. Verify: no CSP violations in console during the entire flow (auth page → token exchange → API fetch).
4. Repeat for Microsoft.
5. **Fail if:** any step is blocked by CSP, any token-exchange origin is unreachable.

*V-OAuth-1 (Google end-to-end):*

1. On iPad standalone PWA. Tap "Import from Google".
2. Authenticate. Verify callback page loads, token exchange succeeds.
3. Calendar selection dialog appears with correct calendar names.
4. Select 2 of 3 calendars. Import completes. Progress bar accurate.
5. Verify: events from 2 selected calendars imported, third not present.
6. Verify: `sessionStorage` cleared of tokens (via Web Inspector).
7. **Fail if:** any step breaks, any token persists beyond import, any event missing.

*V-OAuth-2 (Microsoft end-to-end):*

1. Same flow for Microsoft.
2. **Fail if:** same as Google OR admin-consent error is not clearly surfaced (if account is organizational).

**Review request format:**

> M10 complete. V-CSP-1: [pass/fail], [origins verified]. V-OAuth-1: [pass], N events from M calendars. V-OAuth-2: [pass/fail], [account type tested]. Files created: [list]. Deviations: [list or "none"]. Ready for M11.

**Expected rulings:**

- If callback-page → PWA token handoff via `sessionStorage` has a race condition (page loads before store ready), ruling on retry logic.
- If Microsoft Graph requires `/me/events` (simpler endpoint) instead of `/me/calendars/<id>/events` for personal accounts, ruling switches the endpoint.
- If CSP for `connect-src` needs `blob:` for some iOS callback quirk, ruling adds it with a documented reason.

---

## M11 — Foreground toast reminders

**Blocking verification:** V-Toast-1
**Depends on:** M9 (`VALARM` export), M10 (optional — OAuth import brings events with reminders)
**Adds:** the foreground reminder mechanism. Reminder fields on events are stored from M3; this makes them fire.

**Files to create:**

- `src/modules/reminders/toast.js` — per `spec.md` PART 6.
- Update `scaffolding/src/main.js` — call `toast.schedule()` on boot.

**Behaviors:**

- `toast.schedule()` on boot and on `event-changed`.
- Scans `store.getEventsInRange(now, now + 24h)` for events with a `toast`-type reminder.
- Computes fire times. Sets one `setTimeout` for the earliest. Reschedules after fire.
- On fire: emits `reminder-toast-fired`, shows toast in the corner: "[Summary] in [N] min" (or "was due at [time]" if the fire is late).
- Rescans every 5 minutes while app is open (drift correction).
- Not scheduled if no events with toast reminders within 24h. Not scheduled if app is backgrounded (browser throttles `setTimeout` anyway; accept the throttle).
- On `visibilitychange` back to visible: rescan.

**Do NOT build:**

- Push reminders (M12).
- `.ics` VALARM export (already M9).
- Any other mechanism.
- Notification permission prompt (M12, only if push enabled).
- Settings UI toggle for foreground toast (M14) — but per `spec.md` PART 16, it should be a per-event mechanism (in the editor), which exists from M3. Global settings toggle for "enable toast reminders" lands in M14; M11 assumes default-enabled.

**Acceptance checklist:**

- [ ] Create event 5 minutes from now with a `toast`-type reminder at 2 min before. Leave app open. Toast fires at 3 min from now (5 min event − 2 min offset = 3 min from now).
- [ ] Close app, wait, reopen. No toast fires for a missed reminder (past events don't toast on open).
- [ ] Late fire: create event with reminder set to fire in 1 min. Suspend app. Wait 5 min. Bring app to foreground. On `visibilitychange` rescan, verify toast shows "was due at [time]" not "in -4 min".
- [ ] Multiple events due within 24h: only the earliest schedules initially; after it fires, next schedules.
- [ ] Event deletion cancels pending toast.

**Blocking verification on hardware (V-Toast-1):**

1. On iPhone standalone PWA, create event 3 min from now with reminder at 2 min before.
2. Keep app foregrounded (don't switch away).
3. At 1 min from now (3-2), verify toast fires.
4. Create event 3 min from now with reminder at 2 min before. Suspend app (home button). Wait 5 min. Reopen.
5. Verify: no toast fired while suspended, no toast fires on reopen for the missed event (past).
6. Create event 10 min from now with reminder at 9 min before. Suspend at 2 min from now. Reopen at 3 min from now.
7. Verify: on reopen, rescan schedules correctly. Toast fires at 1 min from now.
8. **Fail if:** toast never fires when foregrounded, late-fire displays negative time, missed reminders toast on reopen, or toast mis-schedules after resume.

**Review request format:**

> M11 complete. V-Toast-1: [pass]. Toast fires within [±X seconds] of target. Late-fire displays correct past-time message. Files created: [list]. Deviations: [list or "none"]. Ready for M12.

**Expected rulings:**

- If iOS throttles `setTimeout` aggressively even while foregrounded (some reports suggest 1s throttle on backgrounded tabs; foregrounded should be fine but verify), ruling may adjust the rescan frequency or use `requestAnimationFrame`-based timing. Prefer the rescan.

---

## M12 — Push reminders via Supabase (conditional)

**Blocking verification:** V-Push-1 (and pre-verification V-5.1p)
**Depends on:** M11 (toast scheduling working — shares the reminder scheduler)
**Adds:** the optional, backend-shaped push mechanism. **This milestone is conditional on V-5.1p passing on hardware. If V-5.1p fails, this milestone is dropped entirely — remove `push.js`, remove the settings section, remove the CSP extension — and proceed to M13.**

**Files to create:**

- `src/modules/reminders/push.js` — per `spec.md` PART 6 (`spec` — lazy-imported).
- `public/push-setup.sql` — the Supabase setup SQL (also linked from the setup guide in Settings).
- `public/push-edge-function.ts` — the Edge Function source (as a download; not shipped as code in the PWA).
- `public/push-setup-guide.md` — the user-facing setup guide.
- Update `scaffolding/_headers` — **CSP extension for Supabase URL is a custom build requirement** per `spec.md` PART 14. Do not extend CSP in the default build.
- Update `scaffolding/vite.config.js` — support `--supabase-url=...` build arg to bake the URL into the bundle and into the CSP.

**Behaviors:**

- `push.js` is `import()`-ed lazily, only when user enables push in settings (M14 builds the toggle; M12 builds the module and the enable/disable path via console if M14 not yet done — but the settings UI must be present by M12's hardware verification, so coordinate with M14 or build a minimal settings surface in M12).
- Supabase URL, anon key, VAPID public key stored in settings. Set via UI (M14) or via `settings.set(...)` in console for M12 testing.
- Enable push flow: register SW, request permission, subscribe to push, POST subscription to Supabase.
- Sync flow: on `event-changed`, enqueue push reminders for next 30 days. On app foreground: flush `push_queue` to Supabase.
- Payload `{eventId, fireAt}` by default; opt-in full payload via `push_payload_opt_in='full'` setting.
- SW handles push event: reads payload, looks up event in IndexedDB (for full mode: uses payload directly), shows notification.
- State detection: probe on app-open per `spec.md` PART 17.

**Setup SQL (public/push-setup.sql):**

Must match `spec.md` PART 17:
- `push_reminders` table with RLS (insert only for anon).
- `push_subscriptions` table.
- `pg_cron` extension enable.
- `pg_cron` job: `every 1 minute` → `trigger_due_pushes()`.
- `trigger_due_pushes()` function calling the Edge Function.

**Edge Function (public/push-edge-function.ts):**

- Deno-based.
- Reads due rows from `push_reminders` where `sent_at IS NULL AND fire_at <= now()`.
- Sends Web Push via VAPID.
- Marks `sent_at`.
- Deletes subscription on 410 Gone.

**Do NOT build:**

- Push without custom build (CSP makes this impossible; documented).
- Full payload by default (opt-in only).
- Token or subscription persistence across devices (subscriptions are per-device, stored in Supabase).
- Any mechanism to make Supabase free-tier projects un-pause automatically (the keep-alive recipe is documentation only, not shipped code).

**Acceptance checklist:**

- [ ] Setup SQL runs cleanly on a fresh Supabase project.
- [ ] Edge Function deploys and returns 200 on manual invoke.
- [ ] Custom build with `--supabase-url=...` includes the URL in CSP and bundle.
- [ ] Default build does not import `push.js` in bundle (verify via Web Inspector network tab or build output size).
- [ ] Enable push in a `--supabase-url` build: permission requested, subscription POSTed, row in `push_subscriptions`.
- [ ] Create event 5 min from now with push reminder at 3 min before. Close app. Verify push received within 5 min.
- [ ] Notifications show correct title (or "Event" if payload is eventId+fireAt only).

**Blocking verification on hardware (V-Push-1):**

*Pre-verification V-5.1p (must be run first):*

1. Set up Supabase project per the guide.
2. Custom build with the Supabase URL.
3. Install PWA on iPhone.
4. Enable push. Verify subscription stored.
5. Create reminder 10 min out. Suspend app (lock screen).
6. Wait. Measure: does the push arrive within 5 min of scheduled time?
7. Test survival: create reminder 24h out. Do not touch the app. Verify push arrives.
8. **Fail V-5.1p if:** latency >5 min on any test, push not received, or app is required to be foregrounded for push to work.
9. **If V-5.1p fails: drop M12.** Remove `push.js`, remove settings push section, remove CSP extension. Documented in `rulings.md` as "M12 dropped per V-5.1p failure." Proceed to M13.

*V-Push-1 (if V-5.1p passes):*

1. Create event 5 min from now with push reminder at 3 min before, foreground toast off, VALARM off.
2. Close app (suspend). Lock screen.
3. At 2 min from now, verify: notification received within 5 min of target.
4. Notify: shows title (or "Event" if eventId-only).
5. Open notification → app opens to event detail (deep-link if implemented; if not, opens to today's agenda).
6. **Fail if:** push not received, notification title wrong, or notification tap doesn't open app.

**Review request format:**

> M12 [complete / dropped per V-5.1p]. V-5.1p: [pass/fail], latency measured at [X]. V-Push-1: [pass/fail/N/A]. If dropped: push.js removed, settings removed, CSP reverted. Files created: [list]. Deviations: [list or "none"]. Ready for M13.

**Expected rulings:**

- If Supabase's `pg_cron` doesn't have sufficient permissions to call the Edge Function, ruling adjusts the function's RLS/auth model.
- If notification tap does not deep-link into the app (iOS PWA limitation for notification clicks is often "opens app to last state"), ruling documents the acceptable behavior: "notification tap opens the app; user sees the event via Agenda."

---

## M13 — Search, command palette, keyboard

**Blocking verification:** V-Search-1, V-Shortcuts-1
**Depends on:** M12 (all views populated)
**Adds:** search across events, command palette, and the full Alt-shortcut keyboard layer.

**Files to create:**

- `src/modules/search/search.js` — per `spec.md` PART 6.
- `src/modules/palette/palette.js` — per `spec.md` PART 6.
- `src/modules/keyboard/keyboard.js` — per `spec.md` PART 6.
- `src/ui/search-input.js` — search bar in Agenda header (search is scoped to the current view per `spec.md` PART 18).

**Behaviors:**

- Search: fuzzy on `summary`, `description`, `location`. Results in current view range. Live filter <100ms. Escape clears.
- Index in-memory. Linear scan at v1 sizes; if V-Search-1 fails at 18,250 events, build a suffix array per `spec.md` PART 18.
- Command palette: full-screen overlay. `Alt+K`. Fuzzy match on command names, calendar names, recent events. Keyboard-navigable (arrows + Enter). Escape closes.
- Keyboard: `event.code` per `spec.md` PART 19. All bindings from the table.
- Editor-active exception: Alt-shortcuts disabled except `Escape` and `Alt+K` when a text input has focus.
- Shortcut table rendered in Settings > Keyboard (M14).

**Do NOT build:**

- Full-text index (v1.1 deferral if needed).
- Remote search.
- Search ranking beyond exact-then-substring.
- Any settings UI beyond the shortcut table entry point (M14).

**Acceptance checklist:**

- [ ] Alt+K opens palette from any view.
- [ ] Palette commands work: new event, search, today, view switches, settings, import, export, calendar toggles, theme switches.
- [ ] Search: "meeting" returns matches within current view range. Escape clears.
- [ ] Search on 18,250-event dataset returns <100ms.
- [ ] All Alt-shortcuts fire per table.
- [ ] In editor with text focus: Alt+N does not create a new event; Escape cancels editor; Alt+K opens palette.
- [ ] Cmd+W, Cmd+T, Cmd+1–9, Cmd+Tab are not bound (verify via console that nothing fires).

**Blocking verification on hardware (V-Search-1, V-Shortcuts-1):**

*V-Search-1:*

1. On iPad with 18,250 events loaded.
2. Search "meeting": time from keystroke to render <100ms (measure via Web Inspector performance timeline).
3. Search "qwertyuiop": 0 results, no lag.
4. **Fail if:** any search >100ms, or lag felt subjectively.

*V-Shortcuts-1:*

1. On iPad, verify every shortcut in `spec.md` PART 19 fires correctly via `event.code`.
2. Focus a text input in editor. Verify Alt+N/M/W/D/Y/A/,/F/T no longer fire.
3. Verify Escape closes the input focus context (not the app).
4. Verify Alt+K opens palette from within the editor.
5. Verify Cmd+W/T/1-9/Tab do nothing.
6. **Fail if:** any binding doesn't fire, any Safari-reserved binding does fire, or editor-active exception fails.

**Review request format:**

> M13 complete. V-Search-1: [measured ms] across 18,250 events. V-Shortcuts-1: [pass], all Alt- and Cmd- behaviors verified. Files created: [list]. Deviations: [list or "none"]. Ready for M14.

**Expected rulings:**

- If search index construction on boot exceeds boot TTFB, ruling on lazy index build (build on first search).
- If palette fuzzy match is too slow at >1000 events, ruling switches to a pre-built index.

---

## M14 — Settings, themes, accessibility

**Blocking verification:** V-A11y-1
**Depends on:** M13 (search, palette, keyboard all working)
**Adds:** the full Settings modal, the other three themes, `prefers-contrast: more` overrides, and the accessibility pass.

**Files to create:**

- `src/modules/settings/settings.js` — full modal, tabs per `spec.md` PART 20.
- `src/styles/themes/dark.css`
- `src/styles/themes/apple.css`
- `src/styles/themes/google.css`
- `src/styles/contrast.css` — `prefers-contrast: more` overrides for all four themes.
- Update `src/styles/tokens.css` — finalize token contract from `spec.md` PART 21.
- PostCSS theme lint (if not already in `scaffolding/vite.config.js`, add here) — per `spec.md` PART 21.

**Behaviors:**

- Settings modal per `spec.md` PART 20, full tab list: General, Calendars, Appearance, Reminders, Import/Export, Data, About, Keyboard.
- Theme switcher: Light / Dark / Apple Calendar / Google Calendar. Applies `data-theme` on `<html>`. Persists to settings.
- `prefers-contrast: more` override per theme.
- Lint passes: no raw colors in theme CSS, no layout properties in theme CSS, no `!important` in theme CSS.
- "Follow system appearance" toggle (overrides theme when system dark and theme is Light, or system light and theme is Dark).
- Accessibility pass: VoiceOver navigates Month grid (arrow keys? touch-based?). Focus trap in all modals. Contrast ratios AA throughout all four themes + contrast override.
- Shortcut table in Settings > Keyboard exactly matches `spec.md` PART 19.

**Do NOT build:**

- Any new features beyond what prior milestones built.
- `.vcs`, `.json` version 2, natural-language parsing, attendance, attachments — all per `spec.md` PART 2 non-goals.
- Fifth theme — `prefers-contrast: more` is the accessibility mechanism, not a fifth theme. [B4]
- Any change to layout geometry based on theme — themes may only change color, typography, borders, chip shapes. [C-21]

**Acceptance checklist:**

- [ ] All 8 Settings tabs render correctly.
- [ ] Theme switcher applies each theme with correct visual identity (Apple looks like Apple Calendar, Google looks like Google Calendar).
- [ ] Apple and Google skins do not change row heights, cell padding, or hit-target geometry vs Light/Dark (verify via DevTools computed styles).
- [ ] `prefers-contrast: more` (enabled via iOS Accessibility > Increase Contrast) visibly increases contrast in all four themes.
- [ ] All settings persist across app relaunch.
- [ ] "Follow system appearance" toggle works (system dark → app dark, regardless of selected theme unless the theme is explicitly Dark).
- [ ] PostCSS theme lint fails build on raw color in theme CSS.
- [ ] PostCSS theme lint fails build on layout property in theme CSS.
- [ ] VoiceOver navigates Month grid: each cell is a distinct focusable element with date + event count announced.
- [ ] Focus trap in every modal (editor, palette, settings, import/export).
- [ ] Contrast ratio check: all text + grid lines pass WCAG AA in all four themes + contrast override.

**Blocking verification on hardware (V-A11y-1):**

1. On iPhone with VoiceOver enabled.
2. Navigate Month view: each cell announces date and event count. Swipe-to-cell, double-tap to activate.
3. Open editor via VoiceOver: all form fields reachable, correct labels, save/cancel accessible.
4. Open settings via VoiceOver: all tabs reachable, all toggles operable.
5. Enable iOS Accessibility > Increase Contrast. Verify visual change in all four themes.
6. Run contrast ratio check (Safari Web Inspector > Elements > Computed > contrast annotation) on representative text and grid lines in each theme.
7. **Fail if:** VoiceOver cannot reach any interactive element, any contrast ratio <AA (<4.5:1 for normal text, <3:1 for large text and non-text), or themes change hit-target geometry vs baseline.

**Review request format:**

> M14 complete. V-A11y-1: [pass], VoiceOver navigated all views, contrast AA across 4 themes + override. Files created: [list]. Deviations: [list or "none"]. All spec parts implemented. Ready for full ship review.

**Expected rulings:**

- If the PostCSS lint flags legitimate token uses (e.g., `var(--shadow-modal)` inside another `var()` expression), ruling adjusts the lint's AST rule.
- If Apple or Google skins need a hit-target geometry change to look right (e.g., Google's tighter line spacing), ruling may relax [C-21] for a specific token — but only if it does not degrade tap accuracy. Prefer adjusting visual-only properties first.

---

## Post-M14 — ship review

After M14 passes V-A11y-1:

1. Full-spec round-trip on target hardware:
   - Import real Google `.ics` (100+ events).
   - Edit 5 events, add 2, delete 1.
   - Export `.ics` with `VALARM`.
   - Import to iOS Calendar. Wait for a `VALARM` to fire.
   - Clear all data. Import original `.json` backup (if one exists) OR re-import `.ics`.
   - Diff. No data lost.
2. Full-spec failure check:
   - Malformed `.ics`: rejects cleanly.
   - Unsupported RRULE: badges, doesn't crash.
   - Editor with no reminder: warns.
   - Push configured but paused: settings reflects state.
   - OAuth cancelled: toast, no state change.
3. Report completeness.

**Ship sign-off requires:** all V-* pass on hardware, ship review round-trip succeeds, no open rulings marked Blocking.

---

**End of M2–M14 pack.** Feed in order. Each milestone's non-goals are the scope contract — do not build what the next milestone owns. If a ruling is needed mid-milestone, stop, produce a `rulings.md` entry referencing the spec part, and wait for sign-off before proceeding.
