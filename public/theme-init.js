// Runs before first paint, outside the module graph. Keeps CSP inline-script-free.
try {
  const saved = localStorage.getItem('daybook.theme');
  if (['light', 'dark', 'apple', 'google'].includes(saved)) {
    document.documentElement.dataset.theme = saved;
  }
} catch {
  // Private browsing or blocked storage: keep the default theme.
}
