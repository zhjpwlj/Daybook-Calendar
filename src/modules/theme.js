import { bus } from '../core/bus.js';

const STORAGE_KEY = 'daybook.theme';
export const THEMES = ['light', 'dark', 'apple', 'google'];

export function systemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function hasStoredTheme() {
  try {
    return THEMES.includes(localStorage.getItem(STORAGE_KEY));
  } catch {
    return false;
  }
}

export function applyTheme(name, { persist = true } = {}) {
  const theme = THEMES.includes(name) ? name : systemTheme();
  document.documentElement.dataset.theme = theme;

  const meta = document.querySelector('meta[name="theme-color"]');
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

export function currentTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (THEMES.includes(saved)) return saved;
  } catch {
    // Fall back to the system theme.
  }
  return systemTheme();
}
