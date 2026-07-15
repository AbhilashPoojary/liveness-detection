/**
 * EventEmitter
 * -------------------------------------------------------------------------
 * Minimal, dependency-free pub/sub implementation used throughout
 * HumanCamJS so that every module (camera, quality, liveness, capture, ui)
 * can communicate without being tightly coupled to one another.
 *
 * @example
 *   const emitter = new EventEmitter();
 *   const off = emitter.on('capture', (result) => console.log(result));
 *   emitter.emit('capture', { success: true });
 *   off(); // unsubscribe
 */
export class EventEmitter {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this._listeners = new Map();
  }

  /**
   * Subscribe to an event.
   * @param {string} event
   * @param {(...args:any[]) => void} handler
   * @returns {() => void} unsubscribe function
   */
  on(event, handler) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(handler);
    return () => this.off(event, handler);
  }

  /**
   * Subscribe once.
   * @param {string} event
   * @param {(...args:any[]) => void} handler
   */
  once(event, handler) {
    const wrapper = (...args) => {
      this.off(event, wrapper);
      handler(...args);
    };
    this.on(event, wrapper);
  }

  /**
   * Unsubscribe from an event.
   * @param {string} event
   * @param {Function} handler
   */
  off(event, handler) {
    this._listeners.get(event)?.delete(handler);
  }

  /**
   * Emit an event to all subscribers.
   * @param {string} event
   * @param {...any} args
   */
  emit(event, ...args) {
    this._listeners.get(event)?.forEach((handler) => {
      try {
        handler(...args);
      } catch (err) {
        // Never let one bad subscriber break the pipeline.
        // eslint-disable-next-line no-console
        console.error(`[HumanCamJS] Error in "${event}" handler:`, err);
      }
    });
  }

  /** Remove all listeners, optionally scoped to one event. */
  removeAllListeners(event) {
    if (event) this._listeners.delete(event);
    else this._listeners.clear();
  }
}

export default EventEmitter;
