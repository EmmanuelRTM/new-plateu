import { getContext2d } from './canvas2d.js';
import { paintTerrain } from './terrainPainter.js';

/**
 * Paints the world terrain once into an offscreen canvas. Shared by MiniMap and WorldMap.
 * @param {{size: number, worldSize: number, heightAt: (x: number, z: number) => number,
 *   seaLevel: number}} opts size is the square image side in pixels.
 * @returns {HTMLCanvasElement} Canvas holding the painted terrain.
 * @throws {Error} When a 2D context is unavailable.
 */
export function createTerrainCanvas({ size, worldSize, heightAt, seaLevel }) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = getContext2d(canvas, 'terrain');
  const image = ctx.createImageData(size, size);
  image.data.set(paintTerrain({ size, worldSize, heightAt, seaLevel }));
  ctx.putImageData(image, 0, 0);
  return canvas;
}
