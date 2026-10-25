// Runs before first paint, outside the module graph. Keeps CSP inline-script-free.
try {
  const saved = localStorage.getItem('daybook.theme');
  const theme = ['light', 'dark', 'apple', 'google'].includes(saved)
    ? saved
    : window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  document.documentElement.dataset.theme = theme;
} catch {
  // Storage blocked: still follow the system theme.
  document.documentElement.dataset.theme = window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}
