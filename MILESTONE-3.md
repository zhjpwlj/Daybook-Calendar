# Milestone 3 — Event editor, detail, Month interaction

**Goal:** Create, edit, and delete events from Month, with a detail view and a per-day list for overflow chips.

**Status:** automated checks pass in headless Chromium. **Hardware checks pending.**

## Scope

In:

- `modules/event-panel.js`: one reusable `<dialog>` hosting editor, detail, and day list.
- Editor fields: title, all-day, start date/time, end date/time, calendar, location, notes.
- All-day events store date strings only (`all_day_start`, exclusive `all_day_end`), never instants.
- Timed events use the device timezone; end must be after start; DST-invalid combinations are rejected.
- Detail view: when, calendar, location, notes, Edit, Delete, Close.
- Delete asks for confirmation before removing anything.
- Month: tap an empty day to create; tap a chip to open detail; tap `+N more` to open the day list; Enter/Space on a focused cell creates.
- Day list: time, calendar dot, title, per-day New event button.
- Calendar picker lists visible calendars only (plus the event's own calendar when editing a hidden one).
- `core/datetime.js`: `fromDateTimeStrings`, `fromDateString`, `addDaysToDateString`.
- `--danger` token in all four themes.
- Version 0.3.0.

Out: recurrence editing (`rrule` preserved untouched), reminders, attendees, timezone picker, event duplication, drag-to-move, multi-day chip spanning, import/export.

## Assumed scope

`spec.md` was not available when M3 started and the user asked to continue using judgment. These calls are mine, not confirmed spec:

- Editor exposes the seven fields above; recurrence and reminders stay read-only until their milestones.
- All-day end date is inclusive in the UI and exclusive in storage, matching iCal `DTEND`.
- New events default to the next full hour on today, else 09:00–10:00.
- Deleting uses the platform confirm dialog; no custom undo yet.
- Detail is a panel, not a separate route.

## Automated verification

Headless Chromium 1248, 430×732, fresh profile, production build, dev server for UI flows.

| Check | Result |
|---|---|
| Prior M1/M2 checks (theme, seed, render, CRUD, range) | all pass |
| Month render, 18,250 events | 131 ms (<200) |
| Overflow chip `+N more` | shown with 4 events |
| `+N more` opens day list | 4 rows |
| Tap empty day | editor opens |
| Save timed event | chip appears, instant stored |
| Timed event ordering | start < end |
| Tap chip | detail opens with formatted when |
| Edit | title prefilled, chip updates |
| Reload | edited event persists |
| Delete | confirm, chip removed |
| All-day save | `all_day` true, no instants |
| All-day end | exclusive next day, `2026-10-01 → 2026-10-02` |
| All-day chip | no time shown |

Run: `npm run build`, `npm run preview -- --port 4173`, `npm run dev -- --port 5173`, then `npm run smoke`.

## Hardware checks (pending)

Target: iPad, installed PWA.

1. Update the app. Tap an empty day. Editor opens as a bottom sheet; Save and Cancel reachable above the home indicator.
2. Create a timed event. Chip appears without reload.
3. Tap chip, edit the title, save. Chip updates.
4. Create an all-day event. Chip shows no time.
5. Delete from detail. Confirm appears; chip disappears.
6. On a seeded month, tap `+N more`. Day list opens; rows open detail.
7. Rotate to landscape and open the editor. Sheet stays usable, no clipped footer.
8. Reload the app. All created events persist.

## Deviations

- Recurrence and reminders are not editable; existing `rrule` values are carried through updates unchanged.
- Delete uses `window.confirm`, not an in-app confirmation sheet.
- No duplicate detection or collision warnings.
- Multi-day all-day events still render on the start day only; spanning arrives M6.
- Seed/Clear debug actions remain in this build.
- Hardware checks were not run before this note.

## Next

M4: recurrence expansion, `core/ics/recurrence.js`, and the first unit tests.
