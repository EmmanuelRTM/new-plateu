/**
 * Pure height function for the Great Plateau.
 * Rolling fBm hills, a smooth cliff rim beyond plateauRadius, flat landmark discs and a lake basin.
 * Pure module (no Three.js).
 */
import { WORLD } from './WorldConfig.js';
import { fbm2D, smoothstep } from './noise.js';

const HILL_SCALE = 220;     // metres per noise lattice cell
const HILL_MIN = 15;
const HILL_MAX = 90;
const SHRINE_FLAT_RADIUS = 24;
const TEMPLE_FLAT_RADIUS = 34;   // covers the 30×50 m ruin footprint (corner at ≈29 m)
// Each landmark sits on a broad hill: fully flat inside the radius, then a gentle skirt that blends
// back to the natural hills over SKIRT metres (≈45 m of rise over 180 m ⇒ < 25° slope, walkable grass).
const SHRINE_SKIRT = 180;
const TEMPLE_SKIRT = 160;
const LAKE_CENTRE = { x: 120, z: -160 };
const LAKE_RADIUS = 70;
const LAKE_SHORE = 100;     // metres over which the basin floor blends back up to the surrounding ground
const LAKE_DEPTH = 4;       // lake floor sits at seaLevel - LAKE_DEPTH
const RIM_WIDTH = 60;       // metres over which the ground drops to the rim floor

/**
 * Lerp helper.
 * @param {number} a
 * @param {number} b
 * @param {number} t
 * @returns {number}
 */
function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Blends height toward flatY inside a disc (full weight within `radius`, fading across `skirt`).
 * @param {number} y Current height.
 * @param {number} x Sample x.
 * @param {number} z Sample z.
 * @param {{x:number,z:number}} centre Disc centre.
 * @param {number} flatY Target height.
 * @param {number} radius Fully flat radius.
 * @param {number} skirt Distance beyond `radius` over which the blend fades out (the hill's skirt).
 * @returns {number}
 */
function flattenDisc(y, x, z, centre, flatY, radius, skirt) {
  const d = Math.hypot(x - centre.x, z - centre.z);
  const w = 1 - smoothstep(radius, radius + skirt, d);
  return lerp(y, flatY, w);
}

/**
 * Creates the seeded plateau height function.
 * @param {typeof WORLD} [config=WORLD] World configuration (seed, seaLevel, plateauRadius, landmarks).
 * @returns {(x: number, z: number) => number} Height in metres at world (x, z).
 */
export function createTerrainHeightFn(config = WORLD) {
  const { seed, seaLevel, plateauRadius, shrine, templeOfTime } = config;
  const rimFloor = seaLevel - 15;
  const lakeFloor = seaLevel - LAKE_DEPTH;

  return (x, z) => {
    // Rolling hills in [HILL_MIN, HILL_MAX].
    const n = fbm2D(x / HILL_SCALE, z / HILL_SCALE, seed, { octaves: 4 });
    let y = lerp(HILL_MIN, HILL_MAX, smoothstep(0.2, 0.8, n));

    // Cliff rim: drop below sea level beyond the plateau radius.
    const r = Math.hypot(x, z);
    const edge = smoothstep(plateauRadius - 10, plateauRadius - 10 + RIM_WIDTH, r);
    y = lerp(y, rimFloor, edge);

    // Lake basin: flat floor at seaLevel - LAKE_DEPTH, blending back up over LAKE_SHORE metres.
    const dl = Math.hypot(x - LAKE_CENTRE.x, z - LAKE_CENTRE.z);
    const lakeW = 1 - smoothstep(LAKE_RADIUS - 20, LAKE_RADIUS + LAKE_SHORE, dl);
    y = lerp(y, lakeFloor, lakeW);

    // Level landmark discs on broad hills (applied last so the landmarks are always level).
    y = flattenDisc(y, x, z, shrine, 60, SHRINE_FLAT_RADIUS, SHRINE_SKIRT);
    y = flattenDisc(y, x, z, templeOfTime, 75, TEMPLE_FLAT_RADIUS, TEMPLE_SKIRT);
    return y;
  };
}
