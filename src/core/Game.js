/**
 * Composition root for the running game. Owns the renderer, scene and camera, builds every system,
 * and runs the intro → loop → dispose lifecycle. Logic lives in the modules it wires together.
 */
import * as THREE from 'three';
import { WORLD } from '../world/WorldConfig.js';
import { isInsideShrine } from '../world/landmarks/shrineGeometry.js';
import { buildWorld } from './WorldBuilder.js';
import { createGameLoop } from './GameLoop.js';
import { Input } from './Input.js';
import { EventBus } from './EventBus.js';
import { clampToCorridor, clampCameraToCorridor } from './shrineBounds.js';
import { createSkyDome } from '../environment/SkyDome.js';
import { createLighting } from '../environment/Lighting.js';
import { createDayNightCycle } from '../environment/DayNightCycle.js';
import { Player } from '../player/Player.js';
import { ThirdPersonCamera } from '../camera/ThirdPersonCamera.js';
import { Hud } from '../ui/Hud.js';
import { IntroOverlay } from '../ui/IntroOverlay.js';
import { RENDER } from '../environment/renderSettings.js';
import { PLAYER } from '../player/PlayerPhysics.js';
import { createPlayerCollision } from './playerCollision.js';
import { collidersFromGroup } from '../physics/meshColliders.js';
import { CombatController } from './CombatController.js';
import { tickWind } from '../world/vegetation/windUniforms.js';
import { createStars } from '../environment/Stars.js';

const DAY_LENGTH_SECONDS = 720;
const START_HOUR = 8.5;
const HEARTS = 3;
const EXIT_BANNER_TEXT = 'Great Plateau';
const EXIT_BANNER_MS = 4500;
const PROMPT_TEXT = 'Click to look around · WASD move · Shift sprint · Space jump / hold to glide · M map · Tab weapons';
const NO_MOUSE = Object.freeze({ mouseDX: 0, mouseDY: 0 });
/** Input with every axis and flag cleared, used while a menu or the map is open. */
const IDLE_INPUT = Object.freeze({
  moveX: 0, moveZ: 0, sprint: false, jumpHeld: false, jumpPressed: false, interactPressed: false,
  anyKeyPressed: false, mouseDX: 0, mouseDY: 0, pointerLocked: true, attackPressed: false,
  blockHeld: false, menuPressed: false, mapPressed: false, cycleDelta: 0, slotPressed: 0,
});

/**
 * Map markers for the fixed landmarks and boss arenas.
 * @param {typeof WORLD} config
 * @returns {Array<{kind:string, label:string, x:number, z:number}>}
 */
function worldMarkers(config) {
  return [
    { kind: 'shrine', label: 'Shrine of Resurrection', x: config.shrine.x, z: config.shrine.z },
    { kind: 'temple', label: 'Temple of Time', x: config.templeOfTime.x, z: config.templeOfTime.z },
    ...config.arenas.map((a) => ({ kind: 'boss', label: a.name, x: a.x, z: a.z })),
  ];
}

/** Game wiring: one instance per page. */
export class Game {
  /** @type {THREE.WebGLRenderer} */
  #renderer;
  /** @type {THREE.Scene} */
  #scene;
  /** @type {THREE.PerspectiveCamera} */
  #camera;
  /** @type {ReturnType<typeof buildWorld>} */
  #world;
  /** @type {ReturnType<typeof createSkyDome>} */
  #sky;
  /** @type {ReturnType<typeof createLighting>} */
  #lighting;
  /** @type {ReturnType<typeof createDayNightCycle>} */
  #cycle;
  /** @type {Input} */
  #input;
  /** @type {Player} */
  #player;
  /** @type {ThirdPersonCamera} */
  #cameraRig;
  /** @type {Hud} */
  #hud;
  /** @type {IntroOverlay} */
  #intro;
  /** @type {EventBus} */
  #bus;
  /** @type {ReturnType<typeof createGameLoop>} */
  #loop;
  /** @type {ReturnType<typeof createPlayerCollision>} */
  #collision;
  /** @type {CombatController} */
  #combat;
  /** @type {ReturnType<typeof createStars>} */
  #stars;
  /** Shrine description shared by the corridor clamp and exit detection. */
  #shrine;
  #wasInsideShrine = true;
  #hasExitedShrine = false;

  /**
   * Builds the renderer, scene, every system and the HUD. Nothing starts until start().
   * @param {HTMLElement} container Element the canvas is appended to (#app).
   */
  constructor(container) {
    this.#renderer = new THREE.WebGLRenderer({ antialias: true });
    this.#renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.#renderer.setSize(window.innerWidth, window.innerHeight);
    this.#renderer.shadowMap.enabled = true;
    this.#renderer.shadowMap.type = THREE[`${RENDER.shadowMapType}ShadowMap`];
    this.#renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.#renderer.toneMappingExposure = RENDER.toneMappingExposure;
    this.#renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.#renderer.domElement);

    this.#scene = new THREE.Scene();
    this.#camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 6000);

    this.#collision = createPlayerCollision();
    this.#world = buildWorld(this.#scene, WORLD, {
      onChunkLoaded: (key, payload) => this.#collision.onChunkLoaded(key, payload),
      onChunkUnloaded: (key) => this.#collision.onChunkUnloaded(key),
    });
    this.#collision.addStatic('temple', collidersFromGroup(this.#world.temple, { skip: (m) => m.isInstancedMesh }));
    this.#sky = createSkyDome();
    this.#scene.add(this.#sky.object);
    this.#stars = createStars({ seed: WORLD.seed });
    this.#scene.add(this.#stars.object);
    this.#lighting = createLighting(this.#scene);
    this.#cycle = createDayNightCycle({ dayLengthSeconds: DAY_LENGTH_SECONDS, startHour: START_HOUR });

    this.#shrine = {
      position: WORLD.shrine,
      exitDirection: WORLD.shrine.exitDirection,
      groundY: this.#world.heightField.heightAt(WORLD.shrine.x, WORLD.shrine.z),
    };
    this.#input = new Input(this.#renderer.domElement);
    this.#player = new Player({ heightField: this.#world.heightField, spawn: this.#world.spawn });
    this.#scene.add(this.#player.object);
    this.#cameraRig = new ThirdPersonCamera(this.#camera, {
      heightAt: (x, z) => this.#world.heightField.heightAt(x, z),
      // Camera looks along (-sin yaw, -cos yaw); the player faces (sin yaw, cos yaw). Adding π
      // makes the camera look the way the player faces at spawn.
      initialYaw: this.#world.spawn.yaw + Math.PI,
    });

    const hudRoot = document.getElementById('hud');
    this.#hud = new Hud(hudRoot, {
      maxHearts: HEARTS,
      map: {
        worldSize: WORLD.size,
        heightAt: this.#world.heightField.heightAt,
        seaLevel: WORLD.seaLevel,
        markers: worldMarkers(WORLD),
      },
    });
    this.#combat = new CombatController({
      armPivots: this.#player.armPivots,
      hudRoot: this.#hud.root,
      menuParent: document.getElementById('overlay'),
    });
    this.#intro = new IntroOverlay(document.getElementById('overlay'));
    this.#bus = new EventBus();
    this.#bus.on('player:exitedShrine', () => this.#hud.banner.show(EXIT_BANNER_TEXT, EXIT_BANNER_MS));
    this.#wasInsideShrine = isInsideShrine(this.#player.state.position, this.#shrine);

    this.#loop = createGameLoop((dt) => this.update(dt), () => this.render());
    window.addEventListener('resize', this.#onResize);
    if (import.meta.env.DEV) window.__game = this;
  }

  /**
   * Read-only access to the player for E2E tests (dev builds only read it via window.__game).
   * @returns {Player}
   */
  get player() {
    return this.#player;
  }

  /**
   * Read-only access to the third-person camera rig for E2E tests.
   * @returns {ThirdPersonCamera}
   */
  get cameraRig() {
    return this.#cameraRig;
  }

  /**
   * Shows the intro, waits for a key press, hides the intro and starts the frame loop.
   * @returns {Promise<void>}
   */
  async start() {
    this.#intro.show();
    this.#input.attach();
    this.#cameraRig.update(this.#player.state.position, NO_MOUSE, 0);
    this.render();
    await new Promise((resolve) => this.#intro.onStart(resolve));
    // Discard edge flags (jump, any key) produced by the key that started the game.
    this.#input.snapshot();
    await this.#intro.hide();
    this.#loop.start();
  }

  /**
   * Advances every system by dt seconds. Order: input → player → corridor clamp → exit check →
   * camera → day/night → sky and lights → HUD.
   * @param {number} dt Seconds since the previous frame (already clamped by the loop).
   * @returns {void}
   */
  update(dt) {
    const raw = this.#input.snapshot();
    const state = this.#player.state;
    const position = state.position;
    const stamina = state.stamina;

    if (raw.mapPressed) this.#hud.toggleMap();
    const paused = this.#combat.menuOpen || this.#hud.worldMap?.isOpen;
    // Menus swallow movement and look input but still receive their own keys.
    const input = paused ? { ...IDLE_INPUT, menuPressed: raw.menuPressed, cycleDelta: raw.cycleDelta, slotPressed: raw.slotPressed } : raw;

    this.#player.update(input, this.#cameraRig.yaw, dt);
    this.#collision.resolvePlayer(state, PLAYER.radius);
    clampToCorridor(position, this.#shrine);
    const inside = this.#checkShrineExit(position);
    this.#world.chunks.update(position);
    this.#combat.update(input, state, dt);

    this.#cameraRig.update(position, input, dt);
    if (inside) this.#keepCameraInCorridor(position);
    this.#cycle.update(dt);
    this.#sky.update(this.#cycle, dt);
    this.#lighting.update(this.#cycle, position);
    this.#world.water.userData.update?.(dt);
    this.#stars.object.position.copy(this.#camera.position);
    this.#stars.update(this.#cycle);
    tickWind(dt);
    this.#hud.update({
      staminaRatio: stamina.ratio(),
      exhausted: stamina.exhausted,
      hearts: HEARTS,
      prompt: raw.pointerLocked ? '' : PROMPT_TEXT,
      player: { x: position.x, z: position.z, yaw: state.yaw },
    });
  }

  /**
   * Emits `player:exitedShrine` once, on the frame the player first leaves the corridor.
   * @param {{x:number, y:number, z:number}} position Player feet position.
   * @returns {boolean} True while the player is inside the corridor.
   */
  #checkShrineExit(position) {
    const inside = isInsideShrine(position, this.#shrine);
    if (this.#wasInsideShrine && !inside && !this.#hasExitedShrine) {
      this.#hasExitedShrine = true;
      this.#bus.emit('player:exitedShrine');
    }
    this.#wasInsideShrine = inside;
    return inside;
  }

  /**
   * Stops the follow camera from leaving the corridor through its walls, back wall or ceiling,
   * then re-aims it at the player so the view stays stable.
   * @param {{x:number, y:number, z:number}} position Player feet position.
   * @returns {void}
   */
  #keepCameraInCorridor(position) {
    clampCameraToCorridor(this.#camera.position, this.#shrine);
    this.#camera.lookAt(position.x, position.y + this.#cameraRig.height, position.z);
  }

  /**
   * Read-only handles for debugging and end-to-end tests (exposed as window.__game in dev).
   * @returns {{ player: Player, cameraRig: ThirdPersonCamera, camera: THREE.PerspectiveCamera,
   *   cycle: ReturnType<typeof createDayNightCycle>, world: ReturnType<typeof buildWorld>, scene: THREE.Scene,
   *   collision: ReturnType<typeof createPlayerCollision>, combat: CombatController, hud: Hud }}
   */
  get debug() {
    return {
      player: this.#player,
      cameraRig: this.#cameraRig,
      camera: this.#camera,
      cycle: this.#cycle,
      world: this.#world,
      scene: this.#scene,
      collision: this.#collision,
      combat: this.#combat,
      hud: this.#hud,
    };
  }

  /**
   * Draws the current scene.
   * @returns {void}
   */
  render() {
    this.#renderer.render(this.#scene, this.#camera);
  }

  /**
   * Stops the loop, removes listeners and releases the WebGL context.
   * @returns {void}
   */
  dispose() {
    this.#loop.stop();
    this.#input.detach();
    window.removeEventListener('resize', this.#onResize);
    this.#renderer.dispose();
    this.#renderer.domElement.remove();
  }

  /** Keeps the camera aspect and renderer size in step with the window. */
  #onResize = () => {
    this.#camera.aspect = window.innerWidth / window.innerHeight;
    this.#camera.updateProjectionMatrix();
    this.#renderer.setSize(window.innerWidth, window.innerHeight);
  };
}
