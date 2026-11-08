# M15–M19 — multi-platform build pack

**What "multi-platform" means here.** Daybook ships as a single PWA codebase, installable on iOS 26.x (current), Android 14+ (Chrome, Samsung Internet, Firefox), macOS (Safari 17+, Chrome, Edge), Windows 11 (Chrome, Edge), and Linux (Chrome, Firefox). No native wrappers, no Electron, no Tauri. The PWA is the app.

**What does not change.** The core thesis. Same shell, same store, same `.ics` interoperability, same honest reminder architecture. iOS keeps its exact behavior — M2–M14's verifications must still pass. Android and desktop inherit most of it; the deltas are enumerated per platform.

**Ordering.** M15 first (foundation). M16, M17, M18 can run in parallel — they don't share files. M19 gates ship.

**Prerequisite you should know before starting.** M2–M14 were specced as iOS-first. If they haven't been built yet, add one line to M2's spec: "Create `src/core/platform.js` (defined in M15). Use it for all capability checks from this point forward." If M2–M14 are already built, M15 is a refactor that removes inline iOS checks and routes them through `platform.js`. Either path lands in the same place.

**Hardware the user needs for reviews.** Android device or emulator (Pixel 6+ or newer). macOS (already have from iOS tethering). Windows VM (or borrow). Linux VM. Browser support matters more than OS version.

---

## platform capability matrix

Reference for every milestone. Columns are the platforms; rows are capabilities Daybook cares about.

| Capability | iOS Safari | Android Chrome | Samsung Int. | Firefox Android | Safari Mac 17+ | Chrome Desktop | Edge Desktop | Firefox Desktop |
|---|---|---|---|---|---|---|---|---|
| Install prompt | manual (Share > Add to HS) | **`beforeinstallprompt`** | **`beforeinstallprompt`** | manual | manual (File > Add to Dock) | **`beforeinstallprompt`** | **`beforeinstallprompt`** | manual (URL bar) |
| Standalone mode | ✅ | ✅ | ✅ | ✅ | ✅ (macOS 14+) | ✅ | ✅ | ✅ |
| `100dvh` reliable | ⚠️ fallback to `100lvh` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Safe area insets | ✅ (notch, home indicator) | ✅ (cutout, gesture bar) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Push (Web Push + VAPID) | ⚠️ best-effort, requires install | ✅ reliable | ✅ | ✅ | ✅ (16.4+) | ✅ | ✅ | ✅ |
| Background sync | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ |
| File System Access API | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| Native `<input type=date>` | ⚠️ buggy | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Touch events | ✅ | ✅ | ✅ | ✅ | ⚠️ (trackpad) | ❌ | ❌ | ❌ |
| Pointer events | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Web Share API (out) | ✅ | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | ⚠️ | ⚠️ |
| Web Share Target (in) | ❌ | ✅ (installed) | ✅ | ❌ | ❌ | ✅ (installed) | ✅ (installed) | ❌ |
| `beforeinstallprompt` | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ |
| Window Controls Overlay | N/A | N/A | N/A | N/A | N/A | ✅ | ✅ | ❌ |
| Modifier key | `Alt+` | `Alt+` (or `Ctrl+` w/ hw kbd) | `Alt+` | `Alt+` | `Cmd+` | `Ctrl+` (Win/Linux), `Cmd+` (Mac) | `Ctrl+` | `Ctrl+` |
| Permissions Policy enforced | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

Bold = positive delta vs iOS. ⚠️ = caveat. ❌ = unavailable.

---

## M15 — Platform abstraction & install UI

**Blocking verification:** V-Platform-1
**Depends on:** M14 (all prior milestones complete, iOS verifications passing)
**Purpose:** Refactor capability detection into one module. Add the cross-platform install UI. Add `core/files.js` for platform-agnostic file operations. No user-facing behavior changes on iOS.

**Files to create:**

- `src/core/platform.js` — the capability detector. **Every other module imports from here.** Inline `navigator.*` checks in module code are banned after this milestone.
- `src/core/install.js` — install prompt abstraction (`canPrompt()`, `prompt()`, `isInstalled()`).
- `src/core/files.js` — file picker, file save abstraction. Handles `<input type=file>`, `<a download>`, and — on platforms that support it (Chrome/Edge desktop, added in M17) — File System Access API.
- `src/core/notify.js` — notification permission, subscription helper. Thin wrapper over `Notification` and `PushManager` that smooths platform differences in permission API. Actual push delivery logic stays in `modules/reminders/push.js`.
- `src/modules/settings/install-section.js` — the "Install Daybook" UI in Settings > About.

**Files to update:**

- `src/main.js` — call `platform.detect()` at boot; register install prompt listener on platforms that fire `beforeinstallprompt`; store the deferred prompt for later use.
- All modules from M2–M14 — grep out inline platform checks, route through `platform.*`.
- `manifest.json` — add `prefer_related_applications: false` explicitly (tells browsers not to suggest a related native app in store).

**`platform.js` API (final shape):**

```js
// Illustrative. Not final code.
export const platform = {
  // Detect once at boot. Synchronous after.
  detect(): void,

  // OS
  os: 'ios' | 'android' | 'macos' | 'windows' | 'linux' | 'other',
  isIOS: boolean, isAndroid: boolean, isMac: boolean, isWindows: boolean, isLinux: boolean,
  isIPad: boolean,        // iPadOS identifies as macOS by UA but has touch
  isStandalone: boolean,  // launched from Home Screen / Dock / installed

  // Input
  hasTouch: boolean,
  hasPointerFine: boolean,  // mouse cursor available
  hasHardwareKeyboard: boolean,  // heuristic: pointerFine && !isMobileOS

  // Browsers
  browser: 'safari' | 'chrome' | 'edge' | 'firefox' | 'samsung' | 'other',
  browserVersion: number,
  isSafari: boolean,

  // Capabilities
  hasPush: boolean,
  hasNotification: boolean,
  hasBackgroundSync: boolean,
  hasFileSystemAccess: boolean,
  hasBeforeInstallPrompt: boolean,
  hasShareTarget: boolean,
  hasWebShare: boolean,
  hasNativeDatePicker: boolean,   // false on iOS

  // Modifier keys
  modKey: 'meta' | 'ctrl',   // meta on Mac/iOS, ctrl otherwise
  modKeyLabel: '⌘' | 'Ctrl', // for UI display

  // Environment
  prefersReducedMotion: boolean,
  prefersContrastMore: boolean,
  prefersColorScheme: 'light' | 'dark',

  // Reactive subscriptions
  on(name, handler): void,  // 'prefers-color-scheme' | 'prefers-contrast' | 'standalone-change'
};
```

**`install.js` API:**

```js
export const install = {
  canPrompt(): boolean,      // true if beforeinstallprompt was captured
  prompt(): Promise<'accepted'|'dismissed'|'unavailable'>,
  isInstalled(): boolean,
  getManualInstructions(): string,  // for platforms without beforeinstallprompt
};
```

**`files.js` API:**

```js
export const files = {
  pickAccept(accepts: string[]): Promise<File | null>,  // wraps <input type=file>
  saveBlob(blob: Blob, filename: string): Promise<void>,  // wraps <a download>
  // FSA methods added in M17
};
```

**Behaviors:**

- `platform.detect()` runs once at boot, before any module loads. All flags available synchronously thereafter.
- Install UI in Settings > About: 
  - If `install.canPrompt()`: button "Install Daybook" fires the deferred prompt.
  - If not, and not installed: show `install.getManualInstructions()` ("On iOS: tap Share > Add to Home Screen. On Safari Mac: File > Add to Dock. On Firefox: install from the address bar.").
  - If installed: show "Installed" badge, hide button.
- iOS behavior unchanged: custom date/time pickers still used (routed through `platform.hasNativeDatePicker` — returns `false` on iOS, `true` elsewhere).
- Reduced motion: `platform.prefersReducedMotion` used to gate any animations added later.
- Contrast: `platform.prefersContrastMore` used by theme system (already implemented in M14; M15 just ensures the check routes through `platform`).
- `prefers-color-scheme` observer: `platform.on('prefers-color-scheme', ...)` fires when the OS toggles dark/light. The "Follow system appearance" setting from spec PART 20 relies on this.

**Do NOT build:**

- Any platform-specific feature (Android install prompt UI, FSA import, Cmd+ keybinding — those are M16/M17/M18).
- Any change to reminders architecture.
- Any change to data model.
- Any change to `.ics` format.
- Manifest changes beyond `prefer_related_applications`.

**Acceptance checklist:**

- [ ] `platform.*` returns correct values on iOS (iPhone, iPad), Android emulator, Mac Chrome, Mac Safari.
- [ ] Grep: no `navigator.serviceWorker`, `navigator.storage`, `Notification.`, `PushManager`, `'ontouchstart' in window`, `window.matchMedia` outside `src/core/platform.js`, `src/core/install.js`, `src/core/notify.js`, `src/core/files.js`.
- [ ] All prior V-* pass on iOS after refactor (regression check).
- [ ] Install UI appears in Settings > About on iOS with instructions ("Share > Add to Home Screen").
- [ ] Install UI appears with prompt button on Android Chrome (beforeinstallprompt fires).
- [ ] Install UI in standalone mode shows "Installed" badge.
- [ ] No new console warnings on iOS.

**Blocking verification (V-Platform-1):**

1. On iPhone standalone: launch. `window.__platform.os === 'ios'`, `isStandalone === true`, `hasNativeDatePicker === false`. All prior V-* pass unchanged (spot-check V-Editor-1, V-RRULE-1, V-Import-ICS-1, V-A11y-1).
2. On Android Chrome (device or emulator): launch. `platform.os === 'android'`, `hasBeforeInstallPrompt === true`, `hasNativeDatePicker === true`. Install button in Settings triggers native prompt.
3. On Mac Chrome: launch. `platform.os === 'macos'`, `platform.modKey === 'meta'`, `hasFileSystemAccess === true`, `hasNativeDatePicker === true`.
4. On Mac Safari: launch. `platform.os === 'macos'`, `hasPush === true`, `hasFileSystemAccess === false`.
5. **Fail if:** any prior iOS V-* regresses, or any platform reports incorrect flags, or any inline platform check survives in module code.

**Review request format:**

> M15 complete. V-Platform-1: [pass]. iOS V-* regressions: [none/list]. Platform flags verified on iOS/Android/Mac Chrome/Mac Safari. Files created: [list]. Install UI present in Settings > About. Deviations: [list or "none"]. Ready for M16/M17/M18 in parallel.

**Expected rulings:**

- If `beforeinstallprompt` fires unreliably on some Chromium browsers (it requires SW active, manifest valid, HTTPS, and user engagement), ruling documents the fallback path: "Install button shows instructions if the event hasn't fired by X seconds."
- If iPadOS's `navigator.userAgent` reports `Macintosh` (it does — iPadOS reports as macOS with touch), the `isIPad` heuristic needs a ruling: check `navigator.maxTouchPoints > 1 && os === 'macos'`. Prefer this fix over new user-agent parsing.
- If `prefers-color-scheme` fires synchronously on some platforms and asynchronously on others, ruling documents the timing and mandates the observer pattern uniformly.

---

## M16 — Android

**Blocking verification:** V-Android-1, V-Android-2, V-Android-3
**Depends on:** M15 (platform abstraction)
**Purpose:** Full Android support — install, notifications, file input, safe-area, theme-color. Push via Supabase pipeline (same as iOS, better delivery).

**Files to create:**

- `src/modules/install/android.js` — Android-specific install prompt wiring.
- `src/modules/theme/status-bar.js` — dynamic `<meta name="theme-color">` per theme. Used on Android, harmless elsewhere.

**Files to update:**

- `src/ui/date-picker.js` and `src/ui/time-picker.js` — short-circuit to native `<input type=date>` / `<input type=time>` when `platform.hasNativeDatePicker === true`. iOS keeps custom; Android uses native.
- `src/modules/views/nav.js` — gesture handling. **Switch from `touchstart`/`touchend` to pointer events** (`pointerdown`/`pointermove`/`pointerup`). Works on iOS 26+ (Safari supports pointer events) and Android. Verify iOS gesture V-* still pass after the switch.
- `src/main.js` — register `beforeinstallprompt` listener, defer the event, wire the install button. Add theme-color meta tag sync on theme change.
- `manifest.json` — verify icons exist (from M1). Add Android-appropriate shortcuts (already present from M1). Consider `share_target` (see Behaviors).
- `src/modules/settings/appearance.js` — add theme-color meta tag update on theme change (already emitted via `theme-changed`; just wire the meta update).

**Behaviors:**

- **Install.** Android Chrome fires `beforeinstallprompt`. Settings > About shows "Install Daybook" button. Tap → native install flow → installs to home screen. After install, button shows "Installed." `isInstalled()` returns true in standalone mode. Samsung Internet behaves identically. Firefox Android: no `beforeinstallprompt`, install button shows manual instructions ("Menu > Install").
- **Safe area.** Android devices with cutouts (Pixel 6+) and gesture navigation bar need `env(safe-area-inset-*)`. The CSS from M1 already applies this on `body` — verify it works on Pixel. `viewport-fit=cover` in the meta tag must be present (already in M1).
- **Theme color.** Android shows a status bar. `<meta name="theme-color">` updates on `theme-changed`:
  - Light theme: `#ffffff`
  - Dark theme: `#1c1c1e`
  - Apple Calendar skin: `#fbfbfd`
  - Google Calendar skin: `#ffffff`
  - Contrast overrides: same as base theme (status bar keeps theme color; contrast applies to in-app content).
- **Native date/time pickers.** `platform.hasNativeDatePicker === true` on Android. The custom picker modules return early and delegate to native. All editor flows work identically. V-Editor-1 re-run on Android verifies this.
- **Gestures.** Pointer events (`pointerdown`, `pointermove`, `pointerup`) with `setPointerCapture` for smooth tracking. Works for touch and mouse. Swipe detection: |deltaX| > 40px and |deltaX| > 2×|deltaY| within 300ms. Edge-swipe-back is an Android system gesture (from screen edge) — test that app swipes don't interfere.
- **Push notifications.** Supabase pipeline works identically (Web Push + VAPID, browser-agnostic). On Android, delivery is **reliable** (not best-effort). Settings > Reminders > Push should show: "Push: active (Android)" — a different label than iOS's "best-effort." Delivery within 30 seconds of scheduled time, tested via V-Android-2.
- **File input.** `<input type=file>` works. Android's file picker offers Drive, Downloads, etc. `.ics` and `.csv` import flows work identically. No FSA.
- **Share target.** Register a Web Share Target in `manifest.json`: users can share a `.ics` file from Files/Drive/Gmail to Daybook. This imports the file directly.
  ```json
  "share_target": {
    "action": "/share-target",
    "method": "POST",
    "enctype": "multipart/form-data",
    "params": { "files": [{ "name": "ics", "accept": [".ics", ".ical", "text/calendar"] }] }
  }
  ```
  Requires an SW route at `/share-target` that intercepts the POST, saves the file to a temp slot in IndexedDB, redirects to `/?imported=1`, and the app prompts to import on boot. **Only Chrome on Android and Chrome/Edge on Desktop** support this. Added as part of M16 (Android) and re-verified in M17 (Desktop Chrome).
- **Back button (Android hardware/software).** Android has a back button/gesture. The app needs to handle it: `history.pushState` for modals so back closes the modal, not the app. If not handled, Android users will exit the app when trying to close a modal. Implementation: `ui/modal.js` pushes a history entry on open; `popstate` listener closes the modal.
- **Notification tap behavior.** Android supports deep-linking from notifications. The push payload already includes `eventId`. On notification click, the SW's `notificationclick` handler calls `clients.openWindow('/?event=<eventId>')`. The app opens to that event's detail view (add this URL parameter handling to `main.js` or a router).
- **App shortcuts.** Android long-press on the Home Screen icon shows `shortcuts` from the manifest (already defined in `scaffolding/public/manifest.json`: "Today" and "New event"). Verify these fire correctly.
- **Files app integration.** Android's Files app doesn't show PWAs. Users can't "open with Daybook" from a file manager. Accept; share target covers the workflow.

**Do NOT build:**

- Trusted Web Activity (TWA) wrapper for Play Store distribution. PWA only. Distribution is via URL.
- Firebase Cloud Messaging integration. Supabase pipeline is provider-agnostic.
- Android widget, Auto, Wear OS integration. Not accessible from PWA.
- Background sync implementation. Push covers the notification case; sync as such doesn't exist in Daybook.
- Any Android-specific UI (Material theming, FAB patterns). The app has one UI across platforms.

**Acceptance checklist:**

- [ ] Install prompt fires on Android Chrome. Tapping it installs the app.
- [ ] Installed app launches to standalone mode. `platform.isStandalone === true`.
- [ ] Safe-area insets render correctly on a Pixel with cutout + gesture bar.
- [ ] Theme-color meta updates per theme. Verified by observing status bar during theme switch.
- [ ] Native date picker opens in the editor on Android. Same for time picker.
- [ ] All swipe gestures work (month/week/day/year transitions). Edge-swipe-back from left edge is a system gesture — app does not conflict.
- [ ] Android back button closes modals (editor, palette, settings) instead of exiting app.
- [ ] Push notification arrives within 30 seconds of scheduled reminder. Tapping it opens the app to event detail.
- [ ] Share target: share an `.ics` from Files → app opens with import prompt.
- [ ] Long-press on home screen icon shows "Today" and "New event" shortcuts. Both work.
- [ ] All iOS V-* still pass (regression check).

**Blocking verification on hardware (V-Android-1, V-Android-2, V-Android-3):**

*V-Android-1 (install + core flows):*

1. On Android 14+ device (Pixel 6+ or equivalent), launch in Chrome.
2. Tap install prompt in Settings > About. Install accepted. App on Home Screen.
3. Launch installed app. Verify standalone mode (no Chrome UI).
4. Create 5 events, edit one, delete one. Verify persistence across kill (swipe away from recents) and relaunch.
5. Verify all view transitions swipe cleanly.
6. Import a real Google `.ics` file. Verify import works, reports accurate.
7. **Fail if:** install prompt doesn't fire, standalone launch fails, any event lost, any swipe fails, import fails.

*V-Android-2 (push):*

1. Configure Supabase per setup guide. Custom build with URL.
2. Install PWA on Android.
3. Enable push in settings. Verify subscription registered.
4. Create event 5 min out with push reminder at 3 min before. Suspend app.
5. Verify notification arrives within 30 sec of target. Tap → app opens to event detail.
6. **Fail if:** notification not received, delivery >30 sec late, tap doesn't open app, or event detail not shown.

*V-Android-3 (cross-platform data):*

1. On iPhone, create 20 events across 3 calendars with mixed recurrence/reminders. Export `.json` backup.
2. Transfer `.json` to Android (via email, Drive, etc.). Import via Settings > Restore from backup.
3. Verify all 20 events, 3 calendars with correct colors/names, all reminder types, all recurrence fields present and identical.
4. Edit 3 events on Android. Export `.json`. Import on iPhone.
5. Verify all 3 edits propagated correctly.
6. **Fail if:** any field differs, any calendar color changed, any reminder type changed, or any recurrence lost.

**Review request format:**

> M16 complete. V-Android-1: [pass], installed on Pixel [model], all core flows working. V-Android-2: [pass], push delivered in [X sec]. V-Android-3: [pass], 20-event round-trip preserved. Share target, back button, native pickers verified. iOS regressions: [none/list]. Files created: [list]. Deviations: [list or "none"]. Ready for M17/M18 in parallel.

**Expected rulings:**

- If Android's back button handling conflicts with iOS/desktop navigation, ruling mandates: back button only closes modals where a `history` entry was pushed; otherwise behaves as system default.
- If `beforeinstallprompt` requires a `preventDefault()` on the initial fire (to defer the auto-prompt so we can show it from Settings), ruling documents this: `event.preventDefault(); this.deferredPrompt = event;`.
- If share target POSTs to `/share-target` but the SW can't intercept in standalone (some Chrome versions), ruling adds a fallback: open app to `/?import=share` and show a manual prompt.
- If notifications show the app name incorrectly (Chrome requires `name` in manifest to match), ruling adjusts.

---

## M17 — Desktop Chrome / Edge / Firefox

**Blocking verification:** V-Desktop-1, V-Desktop-2, V-Desktop-3, V-Desktop-4
**Depends on:** M15 (platform abstraction)
**Purpose:** Full desktop support — install, File System Access, drag-drop, keyboard (Cmd/Ctrl), wider layouts, Window Controls Overlay (Chrome).

**Files to create:**

- `src/modules/install/desktop.js` — `beforeinstallprompt` handling for Chrome/Edge; manual instructions for Firefox.
- `src/modules/import/dragdrop.js` — global drop zone on the app shell; accepts `.ics`, `.csv`, `.json`.
- `src/modules/import/folder.js` — FSA-based folder picker; import all `.ics` files in a folder.
- `src/modules/export/file-handle.js` — FSA-based persistent export target. First export: user picks a file or folder via `showSaveFilePicker`. Subsequent exports go to the same handle (with permission re-prompt if needed).
- `src/modules/keyboard/desktop.js` — desktop keyboard bindings; Cmd on Mac, Ctrl on Win/Linux; Alt fallback still active.

**Files to update:**

- `src/core/files.js` — add `pickWithFSA()`, `saveWithFSA()` methods (gated on `platform.hasFileSystemAccess`).
- `src/modules/keyboard/keyboard.js` — use `platform.modKey` for primary bindings. Keep Alt+ as secondary.
- `src/ui/modal.js` — modal width on wide viewports: max-width 640px, centered. Modal focus ring uses `:focus-visible`.
- `src/modules/views/month.js`, `week.js`, `year.js` — use wider viewport. On widths > 1000px: Month view gets more generous cell padding; Week view gets wider time columns; Year view shows all 12 mini-months side-by-side (currently 4×3 grid on mobile, so on desktop it's 6×2 or 4×3 depending on width — keep 4×3 but increase cell size). Typography scales up (spec PART 21's `--font-body` doesn't fix a size; add `--font-size-base` per breakpoint).
- `src/main.js` — wire install prompt (Chrome/Edge); wire `window-controls-overlay` if supported.
- `manifest.json` — add `display_override: ["window-controls-overlay"]` **only if Window Controls Overlay ships** (see below). Otherwise no change.

**Behaviors:**

- **Install.** Chrome/Edge desktop fires `beforeinstallprompt`. Settings > About shows "Install Daybook" button. After install, opens as a separate app window (not a tab). Firefox: manual install via URL bar (icon); instructions provided.
- **Keyboard.**
  - Primary shortcuts use `platform.modKey`: Cmd+ on Mac, Ctrl+ on Win/Linux.
  - Bindings: Mod+K (palette), Mod+N (new event), Mod+F (search), Mod+T (today — **note**: Mod+T is browser-reserved on Firefox; use Mod+Shift+T there as fallback), Mod+M (month), Mod+W (week — **note**: Mod+W is browser-close on all desktop browsers; disable or use Mod+Shift+W), Mod+D (day — **note**: Mod+D is bookmark on Chrome; use Mod+Shift+D), Mod+Y (year), Mod+A (agenda — **note**: Mod+A is select-all; **disable on desktop** or use Mod+Shift+A), Mod+, (settings).
  - Alt+ variants remain functional everywhere.
  - **Safari-reserved bindings from spec PART 19 (Cmd+W, Cmd+T, etc.) remain unbindable.** Desktop browsers reserve different bindings; the table above resolves each conflict with a Mod+Shift+ alternative where needed. Ruling documents the final table.
- **File System Access.**
  - On Chrome/Edge desktop: user can "Open folder" to import all `.ics` files from a folder at once.
  - Persistent export: after first export via "Save as" dialog with `showSaveFilePicker`, the file handle is stored (in IndexedDB). Subsequent exports overwrite the same file (with permission re-prompt if the browser requires it after reload).
  - Firefox, Safari, Android, iOS: FSA unavailable; falls back to `<a download>` (M1 behavior).
- **Drag-and-drop import.**
  - Drop a `.ics`, `.csv`, or `.json` file anywhere on the app window. Import dialog opens with the file pre-selected; user confirms.
  - Drop multiple files: import all sequentially with a combined report.
  - Visual feedback: dashed border around window during drag, "Drop .ics, .csv, or .json" overlay.
- **Wider layouts.**
  - Breakpoints: mobile (<600px), tablet (600–1000px), desktop (>1000px).
  - Desktop adds: modal max-width 640px; Month view cells taller (70px vs 50px); Week view time column wider (60px vs 40px); Year view mini-months larger. No multi-month or side-panel views in v1.0 — spec PART 2 non-goals still hold.
  - Typography scales via `--font-size-base: 16px` (desktop) vs `15px` (mobile).
- **Push notifications.** Work identically (Supabase pipeline). On desktop, delivery is reliable **when the browser is running** (even backgrounded). If the browser is fully quit, no delivery. Settings > Reminders > Push shows "Push: active (desktop — requires browser running)."
- **Notification tap.** Opens the app window (if installed) or a browser tab (if not). Same URL parameter `?event=<id>` for deep-link. Chrome/Edge support deep-linking via `notificationclick` + `clients.openWindow`.
- **Window Controls Overlay (Chrome/Edge only).** Optional. If implemented:
  - Adds a title bar with app name and window controls (minimize/maximize/close) integrated into the app chrome.
  - Gains ~30px of vertical content space.
  - Adds `display_override: ["window-controls-overlay"]` to manifest.
  - The app's top bar must reserve space for the window controls (via `env(titlebar-area-width)` and `env(titlebar-area-x)`).
  - **This is a nice-to-have, not required.** Ruling may decide to defer to v1.1. If deferring, manifest stays default.
- **Multi-window.** Chrome allows opening multiple PWA windows. Two windows share the same IndexedDB. If window A creates an event, window B does not receive `event-changed` (broadcast channel not implemented). On next query, window B sees the update. Accept; document. Optional `BroadcastChannel` for cross-window event sync is a v1.1 candidate.
- **Share target.** Register `.ics` as share target in manifest (already added in M16). Chrome/Edge desktop users can share from file manager → Daybook. Firefox no share target.
- **Firefox-specific.**
  - No `beforeinstallprompt`. Install via URL bar.
  - No FSA. Fall back to download.
  - No background sync. But push works.
  - Modifier keys are Ctrl+ (Linux) or Cmd+ (Mac).
  - No Window Controls Overlay.
  - No share target.
  - Verify all core flows work.

**Do NOT build:**

- Electron, Tauri, or native wrapper.
- macOS-specific integrations (Services menu, Quick Look).
- Windows jump lists, taskbar pinning beyond PWA install.
- Multi-window sync via `BroadcastChannel` (defer).
- Notification actions (button on notification) — not specced.
- Any desktop-only view (multi-month, side panel). Single-view layout stays.

**Acceptance checklist:**

- [ ] Install prompt fires on Chrome desktop (Mac, Win, Linux). Tap → installs to app launcher. Standalone launch works.
- [ ] Install prompt fires on Edge desktop. Same behavior.
- [ ] Firefox desktop: install button shows manual instructions. URL bar install works.
- [ ] All Mod+ shortcuts fire correctly per platform.
- [ ] No Mod+ binding conflicts with browser shortcuts (Mod+T closes new tab on Chrome? verify; if conflict, the alternative binding fires).
- [ ] Alt+ variants still work.
- [ ] FSA import: "Open folder" imports all `.ics` files in the folder on Chrome/Edge desktop.
- [ ] FSA export: first export "Save as," subsequent exports overwrite same file. Verify via Web Inspector > Application > File System.
- [ ] Drag-drop `.ics` on window imports it.
- [ ] Drag-drop multiple files imports all.
- [ ] Wide viewport layout: modal centered, Month cells wider, no horizontal scroll.
- [ ] Push notification delivered within 30 sec while browser running. Tap opens app.
- [ ] Firefox: no crashes on missing FSA / share target / beforeinstallprompt.
- [ ] All iOS V-* and Android V-* still pass (regression check on iOS; Android unaffected but spot-check).

**Blocking verification on hardware (V-Desktop-1 through V-Desktop-4):**

*V-Desktop-1 (install + core):*

1. On Mac Chrome, launch. Install via Settings > About button.
2. Install accepted. App opens as standalone window.
3. Create 5 events, edit 1, delete 1. Kill app. Relaunch. Data persists.
4. All views work, all swipes (mouse/trackpad) work.
5. Import `.ics`. Reports accurate.
6. Repeat on Windows 11 Chrome. Same results.
7. Repeat on Firefox (Linux VM or Mac). Same, but no install prompt (manual).
8. **Fail if:** any flow breaks on any desktop browser.

*V-Desktop-2 (keyboard):*

1. On Mac Chrome: Mod+K opens palette, Mod+N creates event, Mod+F focuses search.
2. Verify Mod+W does **not** open week view (it closes the tab — Safari/Chrome behavior — expected). Mod+Shift+W does open week view.
3. Mod+T does **not** open today (opens new tab). Mod+Shift+T does.
4. Alt+K still opens palette.
5. On Windows Chrome: Ctrl+K opens palette, Ctrl+N creates event.
6. **Fail if:** any Mod+ binding conflicts without a working alternative, or Alt+ fallbacks don't work.

*V-Desktop-3 (drag-drop import):*

1. Drag a `.ics` file onto the window. Import dialog appears. Confirm. Events imported.
2. Drag 3 `.ics` files. All import sequentially.
3. Drag a `.csv`. Imports correctly.
4. **Fail if:** drop is not accepted, or file is treated as URL navigation (browser default for dropped files on some configurations).

*V-Desktop-4 (FSA):*

1. On Mac Chrome installed PWA, use "Open folder" to import an `.ics` folder. All files imported.
2. Use "Export to file…" and pick `~/Documents/daybook.ics`. File created.
3. Edit an event. Export again. Same file overwritten (no prompt, or prompt auto-grants).
4. Reload app. Export again. Permission re-prompt appears (Chrome requires re-auth after reload). Grant. Export succeeds.
5. **Fail if:** folder import fails, or file handle doesn't persist, or overwrite fails.

**Review request format:**

> M17 complete. V-Desktop-1: [pass], Chrome (Mac/Win) + Firefox verified. V-Desktop-2: [pass], Mod+ bindings fire correctly, no browser conflicts unresolved. V-Desktop-3: [pass]. V-Desktop-4: [pass], FSA import + export + persistence verified. Wide viewport layout works. iOS regressions: [none/list]. Files created: [list]. Deviations: [list or "none"]. Ready for M18.

**Expected rulings:**

- If any Mod+ binding resolves to a browser-reserved action on any target desktop browser, ruling revises the table with Mod+Shift+ alternatives. Document the final table in PART 19 amendments.
- If `showSaveFilePicker` requires a user gesture in a specific context (it does — must be triggered by direct user action, not a chain of awaits), ruling documents the wiring: an export button on the app chrome (not deep in a settings flow) that directly calls the picker.
- If Window Controls Overlay has cross-browser inconsistencies (Firefox doesn't support it, Safari doesn't), ruling documents Chrome/Edge only, or defers to v1.1.
- If drag-drop is not intercepted by the app (browser navigates to the file path), ruling adds `e.preventDefault()` on `dragover` + `drop` at `document.body` level.

---

## M18 — Desktop Safari (macOS)

**Blocking verification:** V-Safari-mac-1, V-Safari-mac-2, V-Safari-mac-3
**Depends on:** M15 (platform abstraction)
**Purpose:** Full macOS Safari support. It's a distinct target from both iOS Safari and Mac Chrome — different quirks, different capabilities.

**Files to create:**

- `src/modules/install/safari-mac.js` — Add to Dock handling. Safari doesn't fire `beforeinstallprompt`; the user adds via File > Add to Dock (macOS 14+). No code needed to trigger; code needed to detect installed state and show appropriate UI.

**Files to update:**

- `src/modules/keyboard/desktop.js` — verify Cmd+ bindings (Safari Mac uses Cmd+ like Chrome Mac). May need Safari-specific reserved bindings checked (Cmd+1–9 for tabs is Safari-reserved, Cmd+T is Safari-reserved).
- `src/ui/date-picker.js` and `src/ui/time-picker.js` — Safari Mac supports native pickers reliably. `platform.hasNativeDatePicker === true` on Safari Mac. Native pickers open.
- `src/main.js` — detect installed state on Safari Mac. Safari Mac standalone mode is detectable via `navigator.standalone === false` on Mac, but installed state is a `display-mode: standalone` media query.

**Behaviors:**

- **Install.** No `beforeinstallprompt`. macOS 14+ (Sonoma) supports Add to Dock via File menu. Settings > About shows instructions: "On Safari Mac: File > Add to Dock."
- **Standalone detection.** `window.matchMedia('(display-mode: standalone)').matches` detects installed mode. `navigator.standalone` is iOS-only, not applicable.
- **Keyboard.** Cmd+ shortcuts work identically to Mac Chrome. Safari reserves: Cmd+1–9 (tabs), Cmd+T, Cmd+N, Cmd+W, Cmd+Shift+T. Mod+ alternatives per M17's table apply.
- **Native date/time pickers.** Work correctly. Custom pickers unused on Safari Mac.
- **File input.** Standard `<input type=file>`. No FSA.
- **Drag-drop.** Safari Mac supports drag-drop of files onto the window. Same implementation as M17.
- **Push notifications.** Safari 16.4+ supports Web Push. Supabase pipeline works. However:
  - Safari's push requires the site to be added to the Dock (installed PWA) for push to work reliably — check.
  - Notification permission is per-app in macOS System Settings (Safari > Notifications).
  - Delivery is reliable when Safari is running.
  - If Safari is quit, no delivery.
  - Settings > Reminders > Push shows: "Push: active (Safari Mac — requires Safari running)."
- **Viewport quirks.**
  - `100dvh` behavior: Safari Mac is more reliable than iOS Safari but can have browser-chrome-resize events. The M1 fallback (`100lvh` or `innerHeight`) still applies and is safe.
  - Safe-area insets: `env(safe-area-inset-*)` returns 0 on Mac. No notch. Correct.
  - Context menu: right-click shows Safari's default. No custom context menu in Daybook v1.0.
- **Window Controls Overlay.** Not supported on Safari. Default title bar.
- **Share target.** Not supported on Safari.
- **Firefox-specific code paths** (from M17) should degrade gracefully — `platform.hasFileSystemAccess === false`, `platform.hasShareTarget === false`, `hasBeforeInstallPrompt === false`.
- **CSP.** Safari enforces CSP strictly. Verify M15's CSP from `_headers` doesn't cause violations. In particular, Safari may complain about `frame-ancestors 'none'` if the app embeds itself (it doesn't). Verify no CSP violations in Web Inspector during normal flow.
- **IndexedDB.** Safari Mac supports IndexedDB, though with historically tighter quota. Verify 10y × 5/day dataset loads (V-Store-1 equivalent on Safari Mac).
- **Notifications.** Safari Mac requires a user gesture to request notification permission. The M11/M12 code path (permission request on user action) satisfies this. Verify.

**Do NOT build:**

- Any Safari-Mac-only feature.
- AppleScript integration.
- Menu bar app.
- Quick Look plugin.

**Acceptance checklist:**

- [ ] Install via File > Add to Dock works (macOS 14+). App appears in Dock, opens standalone.
- [ ] Standalone detection: `matchMedia('(display-mode: standalone)').matches === true` in installed mode.
- [ ] All Cmd+ shortcuts fire per M17's table (with Mac-specific reserved bindings resolved).
- [ ] Native date/time pickers open correctly in editor.
- [ ] Drag-drop `.ics` imports.
- [ ] Push notification delivered within 30 sec while Safari running.
- [ ] Safari Mac shows "Push: active (Safari Mac)" state in settings.
- [ ] CSP: no violations in Web Inspector during import/export/notification flows.
- [ ] 18,250-event dataset (V-Store-1 equivalent) loads with TTFB <200ms.
- [ ] All iOS V-* still pass (regression; iOS and Safari Mac share WebKit but diverge).
- [ ] Firefox/Chrome Desktop V-* still pass (regression check on Safari Mac's side; separately confirm no cross-contamination).

**Blocking verification on hardware (V-Safari-mac-1 through V-Safari-mac-3):**

*V-Safari-mac-1 (install + core):*

1. On macOS 14+, open the app URL in Safari.
2. File > Add to Dock. Verify app appears in Dock.
3. Launch from Dock. Standalone mode, no Safari UI.
4. Create 5 events, edit 1, delete 1. Relaunch. Persistence verified.
5. Import `.ics`. Reports accurate.
6. **Fail if:** install fails, standalone launch fails, persistence fails, import fails.

*V-Safari-mac-2 (push):*

1. Configure Supabase per setup guide. Custom build.
2. Install via Add to Dock.
3. Enable push. Verify permission prompt (Safari requires user gesture — Settings > Enable push button satisfies).
4. Create event 5 min out with push reminder at 3 min before. Close app window (Safari stays running).
5. Verify notification arrives within 30 sec. Tap → app opens to event detail.
6. Quit Safari entirely. Create another reminder, wait. Verify no push arrives (expected — Safari must be running).
7. **Fail if:** notification not received when Safari running, or push arrives when Safari is quit (would indicate a bug).

*V-Safari-mac-3 (quirks):*

1. Verify CSP compliance (no violations in console).
2. Verify IndexedDB 18,250-event load <200ms.
3. Verify all Cmd+ bindings and Mod+Shift+ alternatives.
4. Verify native date/time picker opens on editor save.
5. **Fail if:** any CSP violation, TTFB >200ms, any shortcut conflict, or picker failure.

**Review request format:**

> M18 complete. V-Safari-mac-1: [pass], installed via Add to Dock, standalone works. V-Safari-mac-2: [pass], push delivered in [X sec], quits correctly when Safari closed. V-Safari-mac-3: [pass], no CSP violations, TTFB [X ms], shortcuts verified. Files created: [list]. Deviations: [list or "none"]. Ready for M19.

**Expected rulings:**

- If Safari Mac push permission flow requires the prompt to be triggered by a click handler directly (not by a chain of promises), ruling documents the wiring: notification permission request must be the first await in a click handler.
- If Safari Mac's `100dvh` behavior differs from iOS (likely better), ruling may add `platform.os === 'macos'` short-circuit to use `100dvh` directly. Prefer no change; the fallback works everywhere.
- If drag-drop on Safari Mac does not fire `dragover` with the standard files payload, ruling adds `e.dataTransfer.items` inspection as a fallback.

---

## M19 — Cross-platform hardening & ship

**Blocking verification:** V-CrossPlatform-1 through V-CrossPlatform-6
**Depends on:** M15, M16, M17, M18 all complete
**Purpose:** Not a feature milestone. A verification and hardening pass. No new user-facing features.

**Files to create:**

- `docs/CROSS-PLATFORM-MATRIX.md` — the tested matrix. Rows = capabilities, columns = platforms, cells = tested result. Committed to the repo.
- `docs/SHARE-TARGET-SETUP.md` — for users who want to enable share-target on Android/Desktop Chrome, how to test.

**Files to update:**

- `src/core/platform.js` — fix any incorrect flag detections found during verification.
- `src/main.js` — fix any boot-flow inconsistencies.
- Any module that fails a cross-platform verification — small patches only.
- `rulings.md` — file any pending rulings from earlier milestones as "resolved" with references.

**Behaviors:**

This milestone is verification-first. The behaviors are: run every V-* from M2–M18 on the platforms they target, plus the new cross-platform verifications below. Fix any deviations. File rulings. Ship.

**Acceptance checklist:**

- [ ] Every V-* from M2–M18 passes on its target platform. No exceptions.
- [ ] Every V-CrossPlatform-* passes.
- [ ] `docs/CROSS-PLATFORM-MATRIX.md` complete.
- [ ] No outstanding Blocking rulings. Important and Minor rulings documented.
- [ ] Full ship review round-trip completed on each platform.

**Blocking verification (V-CrossPlatform-1 through V-CrossPlatform-6):**

*V-CrossPlatform-1 (data format compatibility):*

1. On iOS, create 20 events across 3 calendars with mixed recurrence, reminders, all-day, multi-timezone.
2. Export `.json`. Export `.ics`. Export `.csv`.
3. Import `.json` on Android, Windows Chrome, Safari Mac. Verify identical data (compare via `.json` re-export).
4. Import `.ics` on all platforms. Verify identical events.
5. Import `.csv` on all platforms. Verify single-occurrence events identical.
6. **Fail if:** any platform loses any field, any calendar color, any reminder type, any recurrence.

*V-CrossPlatform-2 (timezone behavior):*

1. Create a recurring 9am `America/New_York` event on iOS (device in New York).
2. Export `.json`. Import on Android (device in London), Windows Chrome (device in Tokyo), Safari Mac (device in London).
3. Verify: all platforms expand the recurring event with 9am New York time. Display in each device's local timezone.
4. Change one platform's device timezone to `America/Los_Angeles`. Verify display shifts to 6am local, but stored `dtstart_tzid` remains `America/New_York`.
5. **Fail if:** any platform mis-expands, any platform corrupts stored TZID, or display math is wrong.

*V-CrossPlatform-3 (themes):*

1. On iOS, switch through all 4 themes. Screenshot each view (Month, Week, Year).
2. On Android, Mac Chrome, Safari Mac: switch through all 4 themes. Screenshot same views.
3. Compare: each theme renders visually identically (color, typography, chip shape) across platforms, within tolerable platform font differences.
4. Apple Calendar skin on iOS: matches iOS Calendar look. Google Calendar skin on Android: matches Google Calendar look. These are the intended matches.
5. **Fail if:** any theme looks visibly different from its design, or a theme "breaks" on a platform (overflow, clipping, missing elements).

*V-CrossPlatform-4 (gesture & input):*

1. Touch (iPhone, iPad, Android): all view swipes, drag-to-create, edge-swipe tested. All pass.
2. Mouse (Mac Chrome, Win Chrome, Linux Chrome, Safari Mac): trackpad swipes, mouse drag-to-create, hover states verified.
3. Keyboard navigation (all desktop): Tab order through editor modal, month grid focusable, palette keyboard-operable.
4. **Fail if:** any gesture works on one input method but fails on another without a documented reason.

*V-CrossPlatform-5 (push & notifications):*

1. On each platform that supports push (iOS, Android, Mac Chrome, Safari Mac, Windows Chrome): configure Supabase, enable push, create a reminder, verify delivery.
2. Measurement: latency per platform. iOS worst-case, Android best-case. Record.
3. Notification title/body/action identical across platforms (or documented deltas).
4. **Fail if:** any platform's push fails silently (settings state wrong), or a notification opens the wrong destination.

*V-CrossPlatform-6 (ship review round-trip per platform):*

1. On each platform independently: fresh install → import real Google `.ics` → edit 5 events → create 2 → delete 1 → export `.ics` → import to system Calendar (iOS) or check via another app (Android/desktop) → export `.json` → clear all data → restore from `.json` → verify identical state.
2. Reminder fires from system Calendar (iOS) or from Supabase push (Android/desktop) at correct time.
3. **Fail if:** any round-trip loses any data, any reminder doesn't fire, any platform's ship review fails.

**Review request format:**

> M19 complete. All M2–M18 V-* pass on their target platforms. V-CrossPlatform-1: [pass]. V-CrossPlatform-2: [pass]. V-CrossPlatform-3: [pass], themes identical. V-CrossPlatform-4: [pass]. V-CrossPlatform-5: [pass], latencies recorded: iOS [X], Android [Y], Mac Chrome [Z], Safari Mac [W]. V-CrossPlatform-6: [pass] on all 5 platforms. Matrix doc complete. Ship review: [pass/fail]. Ready to ship.

**Expected rulings:**

- Any fix needed during verification lands as a ruling. If a fix is too large to fit M19, it becomes a new milestone (M20+) or a v1.1 deferral.
- If a platform fails a V-CrossPlatform-* verification, ship is blocked until resolved or explicitly deferred. **Do not ship with a "known issue" on any platform if that issue is data-integrity related.** [C-1]

---

## Final verification matrix

Consolidated. Every milestone's blocking verification, rolled up by platform. Cells show milestone(s) that verify the row.

| Platform | Install | Core (view/edit) | Import | Export | Push | FSA | Gesture | Keyboard | Data compat |
|---|---|---|---|---|---|---|---|---|---|
| iOS 26 iPhone | V-Android-1* | V-Editor-1, V-Agenda-1 | V-Import-ICS-1/2 | V-Export-ICS-1, V-Export-VALARM-1 | V-Push-1 | N/A | V-Gesture-1/2 | V-Shortcuts-1 | V-CrossPlatform-1 |
| iPadOS 26 | V-Platform-1 | V-Store-1, V-Agenda-1 | V-Import-ICS-1 | V-Export-ICS-1 | V-Push-1 | N/A | V-Gesture-1 | V-Shortcuts-1 | V-CrossPlatform-1 |
| Android 14 (Chrome) | V-Android-1 | V-Android-1 | V-Android-1 | V-Android-3 | V-Android-2 | N/A | V-Android-1 | V-Android-1 | V-Android-3 |
| Mac Chrome | V-Desktop-1 | V-Desktop-1 | V-Desktop-3 | V-Desktop-4 | V-CrossPlatform-5 | V-Desktop-4 | V-CrossPlatform-4 | V-Desktop-2 | V-CrossPlatform-1 |
| Windows Chrome | V-Desktop-1 | V-Desktop-1 | V-Desktop-3 | V-Desktop-4 | V-CrossPlatform-5 | V-Desktop-4 | V-CrossPlatform-4 | V-Desktop-2 | V-CrossPlatform-1 |
| Linux Chrome | V-Desktop-1 | V-Desktop-1 | V-Desktop-3 | V-Desktop-4 | V-CrossPlatform-5 | V-Desktop-4 | V-CrossPlatform-4 | V-Desktop-2 | V-CrossPlatform-1 |
| Safari Mac 17+ | V-Safari-mac-1 | V-Safari-mac-1 | V-Safari-mac-1 | V-Safari-mac-1 | V-Safari-mac-2 | N/A | V-CrossPlatform-4 | V-CrossPlatform-4 | V-CrossPlatform-1 |
| Firefox (any) | V-Desktop-1 | V-Desktop-1 | V-Desktop-3 | V-Desktop-4 | V-CrossPlatform-5 | N/A | V-CrossPlatform-4 | V-Desktop-2 | V-CrossPlatform-1 |

*V-Android-1* listed under iOS because iOS install must still be verified as a regression check at M16.

---

## What changed in the spec (implicit amendments for M2–M14)

If M2–M14 are **not yet built**, add these lines to their specs:

- **M2:** create `src/core/platform.js` (M15 spec). Use it for all capability checks.
- **M3:** date/time pickers short-circuit to native when `platform.hasNativeDatePicker === true` (this was already iOS-only; now it's platform-aware).
- **M5:** gesture handling uses pointer events (`pointerdown`/`pointermove`/`pointerup`) not `touchstart`/`touchend`. Works for touch and mouse.
- **M13:** keyboard bindings use `platform.modKey` for primary (Cmd/Ctrl) and Alt+ as secondary. Full table per M17's resolve-list.
- **M14:** theme-color meta tag updates on `theme-changed` (already emitted; just wire the meta update).

If M2–M14 are **already built**, these become M15 refactor tasks (enumerated in M15 files-to-update).

---

## What this milestone pack does NOT do

- **No native wrappers.** Electron, Tauri, Capacitor, TWA — all out of scope. PWA only.
- **No app store distribution.** iOS has no PWA store. Android Play Store would require a TWA wrapper. Desktop app stores would require native wrappers. All out of scope. Distribution is via URL.
- **No multi-window sync.** Chrome allows multiple PWA windows; they share IndexedDB but not real-time events. `BroadcastChannel` for this is a v1.1 candidate.
- **No platform-specific UI.** One UI, all platforms. Apple Calendar and Google Calendar are themes, not platform adaptations.
- **No new features.** Cross-platform is about *distribution*, not scope expansion. Feature cuts from `spec.md` PART 2 stand (no attendees, no attachments, no natural-language parsing, no calendar-as-notes-view, etc.).
- **No revision of the reminder architecture.** Same three mechanisms (VALARM, toast, push via Supabase) on all platforms. Only the reliability label changes per platform ("best-effort" on iOS, "reliable when browser running" on desktop, "reliable" on Android).

---

## Definition of done for the multi-platform program

Daybook v1.x ships on all listed platforms when:

1. All M2–M14 V-* pass on iOS 26 iPhone + iPad.
2. All M15–M19 V-* pass on their target platforms.
3. `docs/CROSS-PLATFORM-MATRIX.md` is complete and committed.
4. Full ship review round-trip succeeds on: iOS iPhone, iPad, Android, Mac Chrome, Mac Safari, Windows Chrome, Linux Chrome, Firefox.
5. No blocking rulings remain open.
6. `rulings.md` has documented every deviation from `spec.md` and this pack.

When all six are true, the app is "multi-platform" in the sense the series thesis promised: one codebase, one shell, one reminder architecture, honest about what each platform can and cannot do.

---

**Feed order:** M15 first. M16, M17, M18 in parallel (they don't touch the same files after M15). M19 gates ship. If any M16–M18 fails on hardware in a way that contradicts a signed decision, stop, file a ruling, wait for sign-off — do not reorder.
