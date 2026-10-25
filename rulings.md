# Rulings

Amendments to `spec.md` v1.0. Each entry names the spec part it changes and the reason. Spec v1.0.1 is v1.0 with R1–R13 applied. The on-disk `spec.md` was not present when M1 was built; these entries are the authoritative delta.

## Spec corrections
### R1 — All-day DTEND on or before DTSTART

Part 11. If an imported all-day event has `DTEND;VALUE=DATE` equal to or before `DTSTART`, store one day: `all_day_start = DTSTART`, `all_day_end = DTSTART + 1 day`, and warn `Non-RFC DTEND on all-day event; treated as one day`. Applies to date-valued DTEND only. Replaces the self-correcting paragraph in Part 11.

### R2 — Theme geometry citation

Part 21. Delete `[C-21]`; no such constraint exists. The rule is never-list #18: themes never change row heights, cell padding, chip font size, information shown, or view layout. Constraint numbering stays 1–14.

### R3 — Lazy push citation

Part 17. `[C-14 avoided by design]` is wrong; C-14 is conflict resolution. Cite never-list #19 (never load `@supabase/supabase-js` unless push is enabled).

### R4 — Store location

Part 6, brief directory layout. The store is a singleton and lives at `core/store.js`. `modules/events/` is deleted; Part 6 already assigns event CRUD to the store, so the directory would be an empty wrapper.

### R5 — Year-view presence query

Part 6, Part 8. Add `store.getEventDaysInRange(startUtc, endUtc, calendarIds?) -> Set<'YYYY-MM-DD'>`. It reuses the normal expansion path and projects occurrences to date strings, so Year view never receives event objects.

### R6 — Search scope

Part 18. Search is global over all events. Delete "search returns matches in the current view range". API: `search.query(text, {calendarIds?})`. A result tap navigates to the event's first occurrence. The index was already global; a view-scoped search would need a second index.

### R7 — Week-view hours

Part 4, Part 8, Part 20. Add settings `week_view_start_hour` (default 6) and `week_view_end_hour` (default 24). Valid range `0 <= start < end <= 24`. Both appear under Settings > General.

### R8 — Milestone count and pre-M1 checks

Appendix A/B, brief milestone note. Appendix A M1–M14 is canonical. Only V-5.1r runs before M1. V-5.2 folds into V-Store-1 (M2); V-5.3r folds into V-Gesture-1/2 (M5) because views do not exist yet.

### R9 — Recurring push expansion

Part 17. Expand recurrence in the event's TZID over `[now, now + 30d]`. One row per occurrence per reminder. Deterministic `row_key = eventId:fireAtUtc:minutesBefore`, so re-upload upserts and cancellation targets a row. Cap 100 occurrences per event per upload; beyond the cap, skip and warn. `push_queue` gains `kind: 'reminder' | 'cancel'`.

### R10 — Unit tests confirmed (F-b)

Part 6, brief F-b. `node --test`, fixture-based, exactly `core/datetime.js` and `core/ics/recurrence.js`. `npm test` runs them. No browser mode, no framework, no other test files.

### R11 — Push configuration is build-time

Part 4, Part 14, Part 17, Part 20. The default build contains no push code (`__PUSH_ENABLED__` define plus dynamic import; dead-code eliminated). A custom build bakes Supabase URL, anon key, and VAPID public key. Remove runtime `supabase_url`, `supabase_anon_key`, and `vapid_public_key` from the settings store. The default build shows "Push not available in this build". Runtime fields that a static CSP blocks would be a lie.

### R12 — Settings storage authority

Part 4, Part 6. For scalar settings, localStorage is authoritative. Write localStorage first, mirror to IndexedDB best-effort, never read back from the mirror.

### R13 — OAuth handoff

Part 14, M10. Handoff into the installed PWA is confirmed by the user: M10 stays unconditional. Callback page stores `{access_token, expires_at}` in sessionStorage and calls `location.replace('/?oauth=<provider>')`; drop the `postMessage` to a parent, since no opener is guaranteed. Boot reads and clears the token. No token on boot means `oauth-failed` ("Import cancelled") and no state change. V-CSP-1 remains a blocking verification but no longer gates whether M10 exists.

### R14 — V-Store-1 runs at M2

Appendix A/B, M2. V-Store-1 needs 18,250 events rendered in Month, but M2 was scoped as an empty Month view and import arrives M7. M2 therefore includes read-only Month chips and a debug-only seed fixture (18,250 deterministic events, idempotent). The gate stays at M2. Multi-day chip spanning remains M6.

## M2 build deviations

- **Seed/Clear live in the debug panel**, behind long-press. Temporary test tooling; remove before v1.0.
- **Month chips are read-only.** Tap-to-create and the editor are M3.
- **Multi-day all-day events render only on the start day.** Spanning cells are M6.
- **`week_starts_on` is hardcoded to Sunday.** Settings wiring is M14.
- **Calendar CRUD is store-level only.** No management UI yet.
- **`core/datetime.js` formatter cache.** `Intl.DateTimeFormat` allocation per cell pushed render past 200 ms; one formatter per timezone/options key fixed it.
- **Headless boot is 460 ms** with 18,250 events; month render is 133 ms. Only render is gated; hardware must confirm.

## M1 additions (user request)

- **System theme default.** With no stored choice, the theme follows `prefers-color-scheme` and updates live when the system flips. Picking a theme in the select stores it and stops system following. Apple/Google skins remain manual.
- **Debug log overlay.** Long-press the title for 1 second to toggle. Captures `console.log/info/warn/error`, `window.onerror`, and `unhandledrejection`, plus boot and service-worker events. 100-entry ring buffer, in memory only. Escape closes.
- **Version label.** Bottom-right, from `package.json` via Vite `define`. Not interactive.

## M1 build deviations

- **vite-plugin-pwa 2.0.0 is a build-only dependency.** It bundles `src/sw.js` (ESM imports of Workbox) and injects the precache manifest. Standalone `workbox-config.js` would require an extra bundler step. There is no unused `workbox-config.js`; the config lives in `vite.config.js`.
- **`postcss` is a dev dependency** for `scripts/lint-themes.mjs`. It enforces: theme files declare only `--*` custom properties, no `!important`, and all four themes define the same token set. Vite already ships postcss; the entry makes the dependency explicit.
- **`index.html` lives at the repo root**, because Vite requires it there. The brief's layout omitted it.
- **Theme bootstrap is `public/theme-init.js`**, an external classic script. Inline script would be blocked by the CSP.
