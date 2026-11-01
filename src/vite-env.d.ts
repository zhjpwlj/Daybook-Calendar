/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface Navigator {
  /** iOS Safari exposes this on the navigator object. */
  standalone?: boolean;
}
