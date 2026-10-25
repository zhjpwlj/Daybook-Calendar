import './styles/tokens.css';
import './styles/themes/light.css';
import './styles/themes/dark.css';
import './styles/themes/apple.css';
import './styles/themes/google.css';
import './styles/base.css';
import './styles/app.css';

import { applyTheme, currentTheme } from './modules/theme.js';

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

const themeSelect = document.getElementById('theme-select');
themeSelect.value = applyTheme(currentTheme(), { persist: false });
themeSelect.addEventListener('change', () => applyTheme(themeSelect.value));

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloading = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    location.reload();
  });

  window.addEventListener('load', async () => {
    const registration = await navigator.serviceWorker.register('/sw.js');

    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      if (!worker) return;

      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          showUpdateBanner(worker);
        }
      });
    });
  });
}

function showUpdateBanner(worker) {
  const banner = document.getElementById('update-banner');
  const reload = document.getElementById('update-reload');
  banner.hidden = false;
  reload.focus();

  reload.addEventListener(
    'click',
    () => {
      reload.disabled = true;
      worker.postMessage({ type: 'SKIP_WAITING' });
    },
    { once: true },
  );
}
