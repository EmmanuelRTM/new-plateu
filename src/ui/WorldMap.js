import '../styles/map.css';
import { createElement } from './dom.js';
import { getContext2d } from './map/canvas2d.js';
import { createTerrainCanvas } from './map/terrainCanvas.js';
import { worldToMap, headingAngle } from './map/mapMath.js';
import { drawArrow, drawDiamond, drawText, markerColour } from './map/mapDraw.js';

const TITLE = 'Hyrule — Great Plateau';
const FOOTER = 'M close · WASD move';
const GRID_SPACING = 512;
const LABEL_FONT = '14px Georgia, "Times New Roman", serif';
const GRID_COLOUR = 'rgba(244, 239, 228, 0.25)';
/** Marker and arrow sizes for a 1024 px image; scaled with imageSize. */
const BASE_IMAGE = 1024;
const MARKER_RADIUS = 9;
const ARROW_RADIUS = 14;

/**
 * Full-screen world map overlay with terrain, a metre grid, markers with labels and the player.
 * Hidden by default; redraws only while open.
 */
export class WorldMap {
  /**
   * Builds the overlay (hidden) and appends it to the parent.
   * @param {HTMLElement} parent Element to append the overlay to.
   * @param {{worldSize: number, heightAt: (x: number, z: number) => number, seaLevel: number,
   *   markers?: Array<{kind: string, label?: string, x: number, z: number}>, imageSize?: number,
   *   terrainCanvas?: HTMLCanvasElement|null}} opts `terrainCanvas` is an already painted terrain
   *   image shared with the MiniMap; when given it is drawn scaled to imageSize.
   * @throws {Error} When a 2D canvas context is unavailable.
   */
  constructor(parent, { worldSize, heightAt, seaLevel, markers = [], imageSize = 1024, terrainCanvas = null }) {
    this.imageSize = imageSize;
    this.scale = imageSize / BASE_IMAGE;
    this.markers = markers;
    this.state = null;
    this.terrain = terrainCanvas ?? createTerrainCanvas({ size: imageSize, worldSize, heightAt, seaLevel });
    // Markers are placed in terrain-image pixels, then the terrain is drawn scaled onto imageSize.
    this.frame = { worldSize, mapSize: imageSize };

    this.root = createElement('div', 'world-map');
    this.root.hidden = true;
    const canvas = createElement('canvas', 'world-map-canvas');
    canvas.width = imageSize;
    canvas.height = imageSize;
    this.canvas = canvas;
    this.ctx = getContext2d(canvas, 'world map');
    this.ctx.font = LABEL_FONT;
    this.root.append(
      createElement('div', 'world-map-title', TITLE),
      canvas,
      createElement('div', 'world-map-footer', FOOTER),
    );
    parent.appendChild(this.root);
  }

  /**
   * @returns {HTMLElement} The root `.world-map` element.
   */
  get element() {
    return this.root;
  }

  /**
   * True while the overlay is visible.
   * @returns {boolean}
   */
  get isOpen() {
    return !this.root.hidden;
  }

  /**
   * Opens the map if closed, closes it if open.
   * @returns {void}
   */
  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  /**
   * Shows the overlay and draws it.
   * @returns {void}
   */
  open() {
    this.root.hidden = false;
    this.redraw();
  }

  /**
   * Hides the overlay.
   * @returns {void}
   */
  close() {
    this.root.hidden = true;
  }

  /**
   * Stores the player state; redraws only when the map is open.
   * @param {{x: number, z: number, yaw: number}} state Player position (metres) and facing yaw.
   * @returns {void}
   */
  update({ x, z, yaw }) {
    this.state = { x, z, yaw };
    if (this.isOpen) this.redraw();
  }

  /**
   * Replaces the markers; redraws when open.
   * @param {Array<{kind: string, label?: string, x: number, z: number}>} markers Marker positions.
   * @returns {void}
   */
  setMarkers(markers) {
    this.markers = markers;
    if (this.isOpen) this.redraw();
  }

  /**
   * Draws terrain, grid, markers and the player arrow onto the canvas.
   * @returns {void}
   */
  redraw() {
    const ctx = this.ctx;
    const S = this.imageSize;
    ctx.clearRect(0, 0, S, S);
    ctx.drawImage(this.terrain, 0, 0, S, S);
    this.drawGrid();
    for (const marker of this.markers) {
      const { u, v } = worldToMap(marker.x, marker.z, this.frame);
      drawDiamond(ctx, u, v, MARKER_RADIUS * this.scale, markerColour(marker.kind));
      if (marker.label) drawText(ctx, marker.label, u + 12 * this.scale, v + 5 * this.scale);
    }
    if (this.state) {
      const { u, v } = worldToMap(this.state.x, this.state.z, this.frame);
      drawArrow(ctx, u, v, ARROW_RADIUS * this.scale, headingAngle(this.state.yaw));
    }
  }

  /**
   * Draws grid lines every 512 m with coordinate labels along the top and left edges.
   * @returns {void}
   */
  drawGrid() {
    const ctx = this.ctx;
    const S = this.imageSize;
    const half = this.frame.worldSize / 2;
    const first = Math.ceil(-half / GRID_SPACING);
    const last = Math.floor(half / GRID_SPACING);
    ctx.strokeStyle = GRID_COLOUR;
    ctx.lineWidth = 1;
    for (let k = first; k <= last; k += 1) {
      const w = k * GRID_SPACING;
      const { u } = worldToMap(w, 0, this.frame);
      const { v } = worldToMap(0, w, this.frame);
      ctx.beginPath();
      ctx.moveTo(u, 0);
      ctx.lineTo(u, S);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, v);
      ctx.lineTo(S, v);
      ctx.stroke();
      drawText(ctx, `x ${w}`, u + 3, 14 * this.scale);
      drawText(ctx, `z ${w}`, 3, v - 3);
    }
  }
}
