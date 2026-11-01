import { bus } from '../core/bus.js';

/** @typedef {import('../core/types.js').ThemeName} ThemeName */

const STORAGE_KEY = 'daybook.theme';
/** @type {ReadonlyArray<ThemeName>} */
export const THEMES = ['light', 'dark', 'apple', 'google'];

/** @returns {ThemeName} */
export function systemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** @returns {boolean} */
export function hasStoredTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved !== null && THEMES.includes(/** @type {ThemeName} */ (saved));
  } catch {
    return false;
  }
}

/**
 * @param {ThemeName | string} name
 * @param {{ persist?: boolean }} [options]
 * @returns {ThemeName}
 */
export function applyTheme(name, { persist = true } = {}) {
  const theme = THEMES.includes(/** @type {ThemeName} */ (name))
    ? /** @type {ThemeName} */ (name)
    : systemTheme();
  document.documentElement.dataset.theme = theme;

  const meta = /** @type {HTMLMetaElement | null} */ (
    document.querySelector('meta[name="theme-color"]')
  );
  if (meta) {
    meta.content = getComputedStyle(document.documentElement)
      .getPropertyValue('--bg-primary')
      .trim();
  }

  if (persist) {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Storage blocked; the theme still applies for this session.
    }
  }

  bus.emit('theme-changed', { theme });
  return theme;
}

/** @returns {ThemeName} */
export function currentTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null && THEMES.includes(/** @type {ThemeName} */ (saved))) {
      return /** @type {ThemeName} */ (saved);
    }
  } catch {
    // Fall back to the system theme.
  }
  return systemTheme();
}
