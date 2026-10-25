# Milestone 2 — Data model, store, Month view

**Goal:** IndexedDB v1 schema, singleton store with event/calendar CRUD, real Month grid with read-only chips, and a 10-year seed fixture for V-Store-1.

**Status:** automated checks pass in headless Chromium. **V-Store-1 pending on target hardware.**

## Scope

In:

- `core/db.js`: IndexedDB v1, stores `events`, `calendars`, `settings`, `push_queue`; indexes per spec.
- `core/datetime.js`: Temporal polyfill wrappers; all date math goes through it. Formatter cache added after render profiling.
- `core/store.js`: load, ranged query, event CRUD, calendar CRUD with reassignment guard, visibility filter, event emission.
- Default "Personal" calendar on first launch.
- `modules/views/month.js`: real dates, leading/trailing days, today marker, weekend tint, all-day first, 3 chips + "+N more", month navigation, today button.
- Read-only chips with summary and (≥600px) time; calendar color stripe.
- Debug actions: Seed 10y (18,250 events, idempotent), Clear events. Temporary; remove before v1.0.
- Version 0.2.0.

Out: event editor, recurrence expansion, other views, import/export, calendar management UI, settings UI, all-day span rendering.

## Automated verification

Headless Chromium 1248, 430×732, dark system scheme, production build, fresh profile.

| Check | Result |
|---|---|
| Month grid renders | 35 cells |
| System dark theme default | `data-theme=dark` |
| Month title | October 2026 |
| Version label | `v0.2.0` |
| Seed writes 18,250 | DB count = 18,250 |
| Re-seed idempotent | DB count stays 18,250 |
| Chips render | 105 chips |
| Chip title text | `Seed 1799 · 9:00` |
| Month render, 18,250 events | **133 ms** (<200) |
| Cold boot to ready | 460 ms (recorded, not gated) |
| Long-press opens debug | pass |
| Store update | persisted in memory |
| Calendar delete blocked with events | pass |
| Calendar delete with reassign | pass |
| Event delete | pass, DB row gone |
| All-day overlap query | included |
| All-day DTEND exclusive | excluded next day |
| Hidden calendar default query | excluded |
| Hidden calendar explicit ids | included |

Run: `npm run build`, then `node /tmp/opencode/daybook-cdp-test.mjs` (harness not committed).

## V-Store-1 (blocking, hardware)

Target: iPad 10th/11th gen, installed PWA, tethered Safari Web Inspector.

1. Install latest build. Long-press title 1s. Tap **Seed 10y**. Confirm. Wait for `seed:done {"events":18250}`.
2. Close panel. Verify Month shows chips and "+N more" without visible lag.
3. Long-press title. Record `month:render` ms. **Pass: <200 ms.**
4. Record `boot:ready` ms after a cold relaunch. No gate yet; if it exceeds 200 ms, treat `boot:ready` as TTFB and report.
5. Swipe the app away. Reopen. Events still there, count unchanged.
6. Re-seed. Count must stay 18,250.
7. Clear events. Month empties. Re-seed for further milestones.

## Deviations

- Month chips are read-only; tap/create arrives M3.
- Multi-day all-day events render only on the start day; spanning cells arrive M6.
- `week_starts_on` is hardcoded to Sunday; settings wiring arrives M14.
- Calendar CRUD exists at store level only; no settings UI yet.
- Seed/Clear debug actions ship in this build. Remove before v1.0.
- Headless render passes; boot latency includes reading 18,250 records and does not prove iPad performance.

## Next

M3: event editor, create/edit/delete, Month view interaction, detail view.
