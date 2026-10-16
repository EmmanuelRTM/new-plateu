/**
 * Shared world constants. Units: 1 unit = 1 metre, Y is up, world centred on the origin.
 * Pure module (no Three.js).
 */
export const WORLD = Object.freeze({
  size: 1024,            // metres, square, centred on origin: x,z ∈ [-512, 512]
  resolution: 256,       // height samples per side (grid spacing = size/resolution = 4 m)
  seed: 1337,
  seaLevel: 10,          // water plane y
  maxHeight: 140,
  plateauRadius: 420,    // beyond this the ground falls away sharply (cliff rim)
  gravity: 28,           // m/s²
  spawn: Object.freeze({ x: 0, z: 0, yaw: 0 }),   // inside the shrine, facing the +z exit
  templeOfTime: Object.freeze({ x: -180, z: 140 }),
  shrine: Object.freeze({ x: 0, z: 0, exitDirection: Object.freeze({ x: 0, z: 1 }) }),
});
