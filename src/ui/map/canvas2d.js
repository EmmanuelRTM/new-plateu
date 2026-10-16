/**
 * Canvas 2D context access with a loud failure, shared by the map adapters.
 */

/**
 * Returns the 2D context of a canvas or throws. A null context means the browser cannot draw here
 * (or jsdom without a canvas stub), so it is an error, not something to hide.
 * @param {HTMLCanvasElement} canvas Canvas to draw on.
 * @param {string} label Short name of the caller, used in the error message.
 * @returns {CanvasRenderingContext2D} The 2D context.
 * @throws {Error} When getContext('2d') returns null.
 */
export function getContext2d(canvas, label) {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error(`Canvas 2D context unavailable for ${label}`);
  }
  return ctx;
}
