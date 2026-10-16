import { vi } from 'vitest';

/** Canvas 2D methods that the map adapters call. Each is a recording spy. */
const METHODS = [
  'drawImage', 'putImageData', 'arc', 'fill', 'rotate', 'translate', 'save', 'restore',
  'clearRect', 'beginPath', 'moveTo', 'lineTo', 'closePath', 'fillText', 'strokeRect',
  'stroke', 'setTransform', 'scale',
];

/**
 * Builds a minimal recording stand-in for CanvasRenderingContext2D (jsdom has none).
 * @returns {Record<string, any>} Context whose drawing methods are vi.fn() spies.
 */
export function createFakeContext() {
  const ctx = {
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
  };
  for (const name of METHODS) ctx[name] = vi.fn();
  return ctx;
}

/**
 * Makes every HTMLCanvasElement.getContext('2d') return one shared fake context.
 * @returns {{ ctx: Record<string, any>, restore: () => void }}
 */
export function stubCanvasContext() {
  const ctx = createFakeContext();
  const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ctx);
  return { ctx, restore: () => spy.mockRestore() };
}
