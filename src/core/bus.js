/** @typedef {(event: CustomEvent<any>) => void} BusHandler */

export const bus = {
  /**
   * @param {string} name
   * @param {any} [detail]
   */
  emit(name, detail) {
    document.dispatchEvent(new CustomEvent(name, { detail }));
  },

  /**
   * @param {string} name
   * @param {BusHandler} handler
   * @returns {() => void}
   */
  on(name, handler) {
    document.addEventListener(name, /** @type {EventListener} */ (handler));
    return () => bus.off(name, handler);
  },

  /**
   * @param {string} name
   * @param {BusHandler} handler
   */
  off(name, handler) {
    document.removeEventListener(name, /** @type {EventListener} */ (handler));
  },
};
