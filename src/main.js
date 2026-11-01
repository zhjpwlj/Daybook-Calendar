import './styles/tokens.css';
import './styles/themes/light.css';
import './styles/themes/dark.css';
import './styles/themes/apple.css';
import './styles/themes/google.css';
import './styles/base.css';
import './styles/app.css';

import { bus } from './core/bus.js';
import { installDebug, log as debugLog } from './core/debug.js';
import {
  applyTheme,
  currentTheme,
  hasStoredTheme,
  systemTheme,
} from './modules/theme.js';

installDebug();

const root = document.documentElement;

function syncAppHeight() {
  // iOS: 100dvh is unreliable in standalone, so window.innerHeight is the final fallback.
  root.style.setProperty('--app-height', `${window.innerHeight}px`);
}

syncAppHeight();
window.addEventListener('resize', syncAppHeight);
window.addEventListener('orientationchange', () => {
  // iOS reports stale innerHeight for one frame after rotation.
  setTimeout(syncAppHeight, 150);
});

const themeSelect = /** @type {HTMLSelectElement} */ (
  document.getElementById('theme-select')
);
themeSelect.value = applyTheme(currentTheme(), { persist: false });
themeSelect.addEventListener('change', () => applyTheme(themeSelect.value));

const colorScheme = window.matchMedia('(prefers-color-scheme: dark)');
colorScheme.addEventListener('change', () => {
  if (hasStoredTheme()) return;
  themeSelect.value = applyTheme(systemTheme(), { persist: false });
});

bus.on('theme-changed', ({ detail }) => {
  debugLog('theme', detail.theme);
});

const versionLabel = document.getElementById('app-version');
if (versionLabel) versionLabel.textContent = `v${__APP_VERSION__}`;

debugLog('boot', {
  version: __APP_VERSION__,
  theme: currentTheme(),
  standalone:
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true,
  serviceWorker: 'serviceWorker' in navigator,
  innerHeight: window.innerHeight,
  appHeight: root.style.getPropertyValue('--app-height'),
  dpr: window.devicePixelRatio,
});

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloading = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    debugLog('sw', 'controller changed');
    if (!hadController || reloading) return;
    reloading = true;
    location.reload();
  });

  window.addEventListener('load', async () => {
    try {
      debugLog('sw', 'registering');
      const registration = await navigator.serviceWorker.register('/sw.js');
      debugLog('sw', { registered: registration.scope });

      registration.addEventListener('updatefound', () => {
        debugLog('sw', 'update found');
        const worker = registration.installing;
        if (!worker) return;

        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateBanner(worker);
          }
        });
      });
    } catch (error) {
      console.error('Service worker registration failed', error);
    }
  });
}

/**
 * @param {ServiceWorker} worker
 */
function showUpdateBanner(worker) {
  const banner = /** @type {HTMLElement} */ (document.getElementById('update-banner'));
  const reload = /** @type {HTMLButtonElement} */ (
    document.getElementById('update-reload')
  );
  banner.hidden = false;
  reload.focus();

  reload.addEventListener(
    'click',
    () => {
      reload.disabled = true;
      debugLog('sw', 'skip waiting');
      worker.postMessage({ type: 'SKIP_WAITING' });
    },
    { once: true },
  );
}
