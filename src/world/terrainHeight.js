/**
 * Pure height function for the world: the Great Plateau (rolling hills, cliff rim, lake, landmark
 * discs), lowlands with a meandering river beyond the rim, a mountain ring and a natural edge.
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
const RIM_FLOOR_BELOW_SEA = 15;
const ARENA_SKIRT = 100;    // metres over which an arena disc blends back to the terrain

// Lowlands beyond the rim: fBm hills between seaLevel + 8 and seaLevel + 40.
const LOWLAND_SCALE = 320;
const LOWLAND_MIN_ABOVE_SEA = 8;
const LOWLAND_MAX_ABOVE_SEA = 40;
const LOWLAND_START = 120;  // metres beyond plateauRadius where the blend into lowlands begins
const LOWLAND_BLEND = 150;  // metres over which the blend completes

// Meandering river: centreline x = RIVER_CENTRE_X + RIVER_AMPLITUDE·sin(z / RIVER_WAVELENGTH).
const RIVER_CENTRE_X = 600;
const RIVER_AMPLITUDE = 180;
const RIVER_WAVELENGTH = 400;
const RIVER_HALF_LENGTH = 1800;  // river exists only for |z| <= this
const RIVER_CORE = 14;      // full-depth half width (m)
const RIVER_BANK = 26;      // half width (m) where the bed has blended back to the land
const RIVER_DEPTH_BELOW_SEA = 5;

// Mountain ring and world edge.
const MOUNTAIN_SCALE = 260;
const MOUNTAIN_MIN = 110;
const MOUNTAIN_MAX = 140;
const MOUNTAIN_RISE_START = 1500;
const MOUNTAIN_CREST = 1900;
const MOUNTAIN_FALL_START = 1950;
const MOUNTAIN_EDGE = 2030;
const EDGE_FLOOR_BELOW_SEA = 20;

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
 * Creates the seeded world height function.
 * @param {typeof WORLD} [config=WORLD] World configuration (seed, seaLevel, plateauRadius, landmarks, arenas).
 * @returns {(x: number, z: number) => number} Height in metres at world (x, z).
 */
export function createTerrainHeightFn(config = WORLD) {
  const { seed, seaLevel, plateauRadius, shrine, templeOfTime, arenas = [] } = config;
  const rimFloor = seaLevel - RIM_FLOOR_BELOW_SEA;
  const lakeFloor = seaLevel - LAKE_DEPTH;
  const riverFloor = seaLevel - RIVER_DEPTH_BELOW_SEA;
  const edgeFloor = seaLevel - EDGE_FLOOR_BELOW_SEA;
  const lowlandLo = seaLevel + LOWLAND_MIN_ABOVE_SEA;
  const lowlandHi = seaLevel + LOWLAND_MAX_ABOVE_SEA;

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

    // Lowlands beyond the rim.
    const lowNoise = fbm2D(x / LOWLAND_SCALE, z / LOWLAND_SCALE, seed + 77, { octaves: 4 });
    const lowland = lerp(lowlandLo, lowlandHi, smoothstep(0.25, 0.75, lowNoise));
    const rimStart = plateauRadius + LOWLAND_START;
    y = lerp(y, lowland, smoothstep(rimStart, rimStart + LOWLAND_BLEND, r));

    // Mountain ring: rises from r ≈ 1500 to 110–140 m, then falls to the sea-level edge beyond 2030 m.
    const peakNoise = fbm2D(x / MOUNTAIN_SCALE, z / MOUNTAIN_SCALE, seed + 131, { octaves: 3 });
    const peak = lerp(MOUNTAIN_MIN, MOUNTAIN_MAX, peakNoise);
    const crest = lerp(peak, edgeFloor, smoothstep(MOUNTAIN_FALL_START, MOUNTAIN_EDGE, r));
    y = lerp(y, crest, smoothstep(MOUNTAIN_RISE_START, MOUNTAIN_CREST, r));

    // River bed through the lowlands (and the outer mountains) for |z| <= RIVER_HALF_LENGTH.
    if (Math.abs(z) <= RIVER_HALF_LENGTH) {
      const riverX = RIVER_CENTRE_X + RIVER_AMPLITUDE * Math.sin(z / RIVER_WAVELENGTH);
      const bed = 1 - smoothstep(RIVER_CORE, RIVER_BANK, Math.abs(x - riverX));
      y = lerp(y, riverFloor, bed);
    }

    // Boss arenas: flat discs (after the lowlands, before the landmarks).
    for (const arena of arenas) {
      y = flattenDisc(y, x, z, arena, arena.y, arena.radius, ARENA_SKIRT);
    }

    // Level landmark discs on broad hills (applied last so the landmarks are always level).
    y = flattenDisc(y, x, z, shrine, 60, SHRINE_FLAT_RADIUS, SHRINE_SKIRT);
    y = flattenDisc(y, x, z, templeOfTime, 75, TEMPLE_FLAT_RADIUS, TEMPLE_SKIRT);
    return y;
  };
}
