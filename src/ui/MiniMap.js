import '../styles/map.css';
import { createElement } from './dom.js';
import { getContext2d } from './map/canvas2d.js';
import { createTerrainCanvas } from './map/terrainCanvas.js';
import { minimapWindow, worldToMap, headingAngle, shouldRepaint } from './map/mapMath.js';
import { drawArrow, drawDiamond, markerColour } from './map/mapDraw.js';

/** Marker half-diagonal and arrow length in CSS pixels (scaled by the device pixel ratio). */
const MARKER_RADIUS = 4;
const ARROW_RADIUS = 14;

/**
 * Circular minimap in the bottom-right corner. Shows the terrain around the player, markers that
 * fall inside the window, and a player arrow fixed at the centre (north up).
 */
export class MiniMap {
  /**
   * Paints the terrain once, builds the DOM and appends it to the parent.
   * @param {HTMLElement} parent Element to append the minimap to.
   * @param {{worldSize: number, heightAt: (x: number, z: number) => number, seaLevel: number,
   *   markers?: Array<{kind: string, label: string, x: number, z: number}>, radiusMetres?: number,
   *   imageSize?: number, diameterPx?: number, terrainCanvas?: HTMLCanvasElement|null}} opts
   *   worldSize in metres; imageSize is the terrain image side in pixels; radiusMetres is the
   *   half-width of the view; diameterPx is the on-screen size in CSS pixels. `terrainCanvas` is an
   *   already painted square terrain image (see createTerrainCanvas) shared with the WorldMap so the
   *   world is painted once; when given, imageSize is taken from its width.
   * @throws {Error} When a 2D canvas context is unavailable.
   */
  constructor(parent, opts) {
    const {
      worldSize,
      heightAt,
      seaLevel,
      markers = [],
      radiusMetres = 220,
      imageSize = 512,
      diameterPx = 180,
      terrainCanvas = null,
    } = opts;
    this.frame = { worldSize, mapSize: imageSize };
    this.radiusMetres = radiusMetres;
    this.markers = markers;
    this.lastDrawn = null;
    this.dpr = globalThis.devicePixelRatio || 1;
    this.terrain = terrainCanvas ?? createTerrainCanvas({ size: imageSize, worldSize, heightAt, seaLevel });
    if (terrainCanvas) this.frame.mapSize = terrainCanvas.width;

    this.root = createElement('div', 'minimap');
    this.root.style.width = `${diameterPx}px`;
    this.root.style.height = `${diameterPx}px`;
    this.canvas = createElement('canvas');
    this.size = Math.round(diameterPx * this.dpr);
    this.canvas.width = this.size;
    this.canvas.height = this.size;
    this.ctx = getContext2d(this.canvas, 'minimap');
    this.root.append(this.canvas, createElement('span', 'minimap-north', 'N'));
    parent.appendChild(this.root);
  }

  /**
   * @returns {HTMLElement} The root `.minimap` element.
   */
  get element() {
    return this.root;
  }

  /**
   * Replaces the marker list and repaints on the next update.
   * @param {Array<{kind: string, label: string, x: number, z: number}>} markers Marker positions.
   * @returns {void}
   */
  setMarkers(markers) {
    this.markers = markers;
    this.lastDrawn = null;
  }

  /**
   * Repaints when the player has moved more than 0.5 m or turned more than 0.02 rad since the last
   * paint; otherwise does nothing.
   * @param {{x: number, z: number, yaw: number}} state Player position (metres) and facing yaw.
   * @returns {void}
   */
  update({ x, z, yaw }) {
    const state = { x, z, yaw };
    if (!shouldRepaint(this.lastDrawn, state)) return;
    this.lastDrawn = state;
    this.draw(state);
  }

  /**
   * Draws terrain window, markers and arrow for a state.
   * @param {{x: number, z: number, yaw: number}} state Player state.
   * @returns {void}
   */
  draw({ x, z, yaw }) {
    const ctx = this.ctx;
    const S = this.size;
    const win = minimapWindow(x, z, this.radiusMetres, this.frame);
    const scale = S / win.sw;
    ctx.clearRect(0, 0, S, S);
    ctx.drawImage(this.terrain, win.sx, win.sy, win.sw, win.sh, 0, 0, S, S);
    for (const marker of this.markers) {
      const { u, v } = worldToMap(marker.x, marker.z, this.frame);
      const px = (u - win.sx) * scale;
      const py = (v - win.sy) * scale;
      if (px < 0 || py < 0 || px > S || py > S) continue;
      drawDiamond(ctx, px, py, MARKER_RADIUS * this.dpr, markerColour(marker.kind));
    }
    drawArrow(ctx, S / 2, S / 2, ARROW_RADIUS * this.dpr, headingAngle(yaw));
  }
}
