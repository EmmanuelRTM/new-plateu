/**
 * Shared world constants. Units: 1 unit = 1 metre, Y is up, world centred on the origin.
 * Pure module (no Three.js).
 */
export const WORLD = Object.freeze({
  size: 4096,            // metres, square, centred on origin: x,z ∈ [-2048, 2048]
  resolution: 1024,      // legacy global sampling resolution (far mesh uses WORLD.far.resolution)
  seed: 1337,
  seaLevel: 10,          // water plane y
  maxHeight: 140,
  plateauRadius: 420,    // beyond this the ground falls to the rim floor (cliff rim), then lowlands
  gravity: 28,           // m/s²
  spawn: Object.freeze({ x: 0, z: 0, yaw: 0 }),   // inside the shrine, facing the +z exit
  templeOfTime: Object.freeze({ x: -180, z: 140 }),
  shrine: Object.freeze({ x: 0, z: 0, exitDirection: Object.freeze({ x: 0, z: 1 }) }),
  // World partition: terrain + vegetation are generated per chunk around the player.
  chunk: Object.freeze({ size: 256, resolution: 64, loadRadius: 3, unloadRadius: 4 }),
  // Always-visible low-detail terrain covering the whole world, sunk just below the chunks.
  far: Object.freeze({ resolution: 128, yOffset: -1.5 }),
  // Flat discs for boss fights (the boss agent builds the encounters on top of these).
  arenas: Object.freeze([
    Object.freeze({ id: 'talus', name: 'Talus Hollow', x: 300, z: 250, radius: 40, y: 48 }),
    Object.freeze({ id: 'hinox', name: 'Hinox Grove', x: -280, z: -240, radius: 45, y: 52 }),
    Object.freeze({ id: 'flux', name: 'Flux Construct Rise', x: 1100, z: -900, radius: 50, y: 34 }),
  ]),
});
