import '../styles/hud.css';
import { createElement } from './dom.js';
import { Hearts } from './Hearts.js';
import { StaminaWheel } from './StaminaWheel.js';
import { LocationBanner } from './LocationBanner.js';
import { MiniMap } from './MiniMap.js';
import { WorldMap } from './WorldMap.js';
import { createTerrainCanvas } from './map/terrainCanvas.js';

/** Side (pixels) of the terrain image shared by the minimap and the world map. */
const MAP_IMAGE_SIZE = 1024;

/**
 * Composes the in-game HUD: hearts (top-left), stamina wheel, location banner, interaction prompt
 * and, when map options are given, the minimap (bottom-right) and the full-screen world map.
 */
export class Hud {
  /**
   * Builds the HUD and appends its root to the parent.
   * @param {HTMLElement} parent Element to append the HUD root to (the #hud container).
   * @param {{ maxHearts?: number, map?: { worldSize: number, heightAt: (x:number, z:number) => number,
   *   seaLevel: number, markers?: Array<{kind:string, label:string, x:number, z:number}> } }} [options]
   *   `map` enables the minimap and world map; the terrain image is painted once and shared.
   */
  constructor(parent, { maxHearts = 3, map = null } = {}) {
    this.root = createElement('div', 'hud-root');
    this.hearts = new Hearts(this.root, maxHearts);
    this.stamina = new StaminaWheel(this.root);
    this.bannerView = new LocationBanner(this.root);
    this.promptEl = createElement('div', 'hud-prompt');
    this.promptEl.hidden = true;
    this.root.appendChild(this.promptEl);
    /** @type {MiniMap|null} */
    this.miniMap = null;
    /** @type {WorldMap|null} */
    this.worldMap = null;
    if (map) {
      const terrainCanvas = createTerrainCanvas({ size: MAP_IMAGE_SIZE, ...map });
      this.miniMap = new MiniMap(this.root, { ...map, terrainCanvas });
      this.worldMap = new WorldMap(this.root, { ...map, terrainCanvas });
    }
    parent.appendChild(this.root);
  }

  /**
   * Pushes the latest player state into the HUD widgets.
   * @param {{ staminaRatio?: number, exhausted?: boolean, hearts?: number, prompt?: string,
   *   player?: { x: number, z: number, yaw: number } }} state
   *   staminaRatio 0..1; exhausted true while stamina is empty; hearts in half units;
   *   prompt text shown only when non-empty; player drives the maps when present.
   */
  update({ staminaRatio = 1, exhausted = false, hearts = 3, prompt = '', player = null } = {}) {
    this.hearts.update(hearts);
    this.stamina.update(staminaRatio, exhausted);
    this.promptEl.textContent = prompt;
    this.promptEl.hidden = prompt.length === 0;
    if (player && this.miniMap) this.miniMap.update(player);
    if (player && this.worldMap) this.worldMap.update(player);
  }

  /**
   * Opens or closes the full-screen world map. No-op without map options.
   * @returns {boolean} True when the map is open after the call.
   */
  toggleMap() {
    if (!this.worldMap) return false;
    this.worldMap.toggle();
    return this.worldMap.isOpen;
  }

  /**
   * The location banner, so callers can show location titles.
   * @returns {LocationBanner}
   */
  get banner() {
    return this.bannerView;
  }
}
