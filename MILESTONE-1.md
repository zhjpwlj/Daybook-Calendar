# Milestone 1 — App shell

**Goal:** Installable PWA shell with a working service worker, CSP headers, safe-area viewport, and four switchable themes.

**Status:** M1 complete. V-Viewport-1 passed on target hardware (user-reported, 2026-10-25). Automated checks pass.

## Scope

In:

- Vite 6 build, Workbox 7 `injectManifest` precache, app-shell navigation fallback.
- Update flow: new SW installs, banner appears, Reload activates the new worker.
- `manifest.json` with the three icons (192, 512, maskable 512), standalone display.
- `_headers` with CSP, permissions policy, and cache rules.
- Viewport: `viewport-fit=cover`, safe-area padding, `window.innerHeight` fallback for `--app-height`.
- Four themes (Light, Dark, Apple, Google) via `data-theme`, persisted in localStorage, no first-paint flash.
- Theme lint: custom properties only, no `!important`, identical token set across themes.

Out: any data model, store, month view, editor, import, export, reminders, search, settings UI beyond the theme select.

## Files

```
index.html
vite.config.js
package.json
public/_headers
public/manifest.json
public/theme-init.js
public/icons/{icon-192,icon-512,icon-maskable-512,apple-touch-icon}.png
scripts/lint-themes.mjs
src/main.js
src/sw.js
src/core/bus.js
src/modules/theme.js
src/styles/{tokens,base,app}.css
src/styles/themes/{light,dark,apple,google}.css
```

## Automated verification

| Check | Command | Expected |
|---|---|---|
| Theme contract | `npm run lint:themes` | `4 themes, 26 tokens each` |
| Build | `npm run build` | exit 0; `dist/sw.js`; `precache 9 entries` |
| Precache manifest injected | `grep index.html dist/sw.js` | `"url":"index.html"` present |
| SW is classic-compatible | `grep -c '^import' dist/sw.js` | `0` |
| Assets copied | `ls dist/icons dist/_headers dist/manifest.json` | all present |
| Manifest parses | `node -e "JSON.parse(require('fs').readFileSync('dist/manifest.json'))"` | exit 0 |
| Preview serves | `npm run preview` + `curl -I localhost:4173/sw.js` | 200 |

## V-Viewport-1 (blocking, hardware)

Target: iPhone with iOS 26.x and iPad 10th/11th gen, installed to Home Screen, tethered to a Mac with Safari Web Inspector.

1. Install from Safari. Launch from Home Screen.
2. No clipping at top or bottom in portrait; header clears the status bar/notch.
3. Rotate to landscape; header and bottom safe area still correct after 1 second.
4. Root document does not scroll; only `.app-main` scrolls.
5. In Web Inspector, `document.documentElement.style.getPropertyValue('--app-height')` equals `window.innerHeight` and matches the visible app height.
6. Theme select: switch all four; reload; theme persists; no light flash before paint.
7. With `prefers-contrast: more` enabled in iOS Accessibility, grid lines and text visibly strengthen.
8. Airplane mode, relaunch: app shell still loads.
9. Rebuild with a changed title, reopen twice: "New version available" banner appears; Reload activates it.

## Handoff

M2 may start only after V-Viewport-1 passes on both devices, or the failure is recorded in `rulings.md` with a workaround.
