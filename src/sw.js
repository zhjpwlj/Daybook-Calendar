import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

// DOM and WebWorker libs are both loaded for the app; this cast selects the SW side.
const sw = /** @type {ServiceWorkerGlobalScope} */ (/** @type {unknown} */ (self));

sw.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    sw.skipWaiting();
  }
});

const precacheManifest = /** @type {Array<import('workbox-precaching').PrecacheEntry>} */ (
  /** @type {any} */ (self).__WB_MANIFEST
);
precacheAndRoute(precacheManifest);
cleanupOutdatedCaches();
clientsClaim();

// App shell fallback for navigations. OAuth callback pages are real files, not the shell.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), {
    denylist: [/^\/oauth\//],
  }),
);
