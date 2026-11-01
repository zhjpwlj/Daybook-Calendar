export const bus = {
  emit(name, detail) {
    document.dispatchEvent(new CustomEvent(name, { detail }));
  },

  on(name, handler) {
    document.addEventListener(name, handler);
    return () => bus.off(name, handler);
  },

  off(name, handler) {
    document.removeEventListener(name, handler);
  },
};
