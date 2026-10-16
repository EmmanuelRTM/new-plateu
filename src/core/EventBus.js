/**
 * Tiny synchronous publish/subscribe bus. No DOM or Three.js dependencies.
 *
 * Handlers are stored per event name in a Set, so subscribing the same function twice is
 * idempotent. `emit` iterates over a snapshot copy of the handler list, so handlers that are
 * added or removed while an event is being dispatched do not disturb the current dispatch.
 */
export class EventBus {
  constructor() {
    /** @type {Map<string, Set<(payload: any) => void>>} */
    this._handlers = new Map();
  }

  /**
   * Subscribe a handler to an event.
   * @param {string} event Event name, e.g. `'player:exitedShrine'`.
   * @param {(payload: any) => void} handler Called with the emitted payload.
   * @returns {() => void} Function that removes this subscription when called.
   */
  on(event, handler) {
    let set = this._handlers.get(event);
    if (!set) {
      set = new Set();
      this._handlers.set(event, set);
    }
    set.add(handler);
    return () => this.off(event, handler);
  }

  /**
   * Remove a previously subscribed handler. Unknown events or handlers are ignored.
   * @param {string} event Event name.
   * @param {(payload: any) => void} handler The exact function passed to `on`.
   * @returns {void}
   */
  off(event, handler) {
    const set = this._handlers.get(event);
    if (!set) return;
    set.delete(handler);
    if (set.size === 0) this._handlers.delete(event);
  }

  /**
   * Dispatch a payload to every handler currently subscribed to `event`, in subscription order.
   * @param {string} event Event name.
   * @param {any} [payload] Value passed to each handler.
   * @returns {void}
   */
  emit(event, payload) {
    const set = this._handlers.get(event);
    if (!set) return;
    for (const handler of [...set]) handler(payload);
  }
}
