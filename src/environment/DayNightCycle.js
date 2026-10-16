/**
 * Pure day/night cycle: maps an in-game clock to sun and moon directions, light intensity,
 * colours and sky turbidity. No Three.js or DOM imports, so it is unit-testable in Node.
 *
 * Convention: the sun elevation is sin((hour - 6) / 24 * 2π), so sunrise ≈ 6 h, noon ≈ 12 h,
 * sunset ≈ 18 h. Sun directions point FROM the scene TOWARD the sun. The moon direction is the
 * opposite side of the sky (same horizontal track, mirrored) and is always above the horizon at night.
 */

const TWO_PI = Math.PI * 2;
/** Fixed tilt (radians) of the sun's horizontal track so shadows are not axis-aligned. */
const TILT = 0.35;

const HORIZON_COLOUR = Object.freeze({ r: 1.0, g: 0.6, b: 0.35 });
/** Near-white with a slight cool bias so the midday light does not wash the blue sky out. */
const NOON_COLOUR = Object.freeze({ r: 0.98, g: 0.97, b: 1.0 });
const NIGHT_COLOUR = Object.freeze({ r: 0.2, g: 0.25, b: 0.4 });
/** Cool blue-white moonlight. */
const MOON_COLOUR = Object.freeze({ r: 0.75, g: 0.85, b: 1.0 });

/** Ambient (hemisphere) strength floor at midnight and ceiling at noon. */
const AMBIENT_NIGHT = 0.6;
const AMBIENT_DAY = 0.75;
/** Sky turbidity: hazy-free deep blue by day, clean dark sky at night. */
const TURBIDITY_NIGHT = 1.5;
const TURBIDITY_DAY = 3;
/** Sine-of-elevation band over which the moon fades in after sunset (fully on at -0.35). */
const MOON_FADE_ELEVATION = -0.35;

/**
 * Hermite smoothstep clamped to [0, 1]. Also works with edge0 > edge1 (reversed ramp).
 * @param {number} edge0
 * @param {number} edge1
 * @param {number} x
 * @returns {number}
 */
function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Linear interpolation between two numbers.
 * @param {number} a
 * @param {number} b
 * @param {number} t
 * @returns {number}
 */
function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Wraps an hour value into [0, 24).
 * @param {number} hour
 * @returns {number}
 */
function wrapHour(hour) {
  return ((hour % 24) + 24) % 24;
}

/**
 * Sun elevation curve. Returns the sine of the sun's elevation, which equals the sun
 * direction's y component: sunrise (6 h) is 0, noon (12 h) is 1, sunset (18 h) is 0, midnight is -1.
 * @param {number} hour - in-game hour, 0..24
 * @returns {number} value in [-1, 1]
 */
export function hourToElevation(hour) {
  return Math.sin(((hour - 6) / 24) * TWO_PI);
}

/**
 * Creates a day/night clock.
 * @param {{ dayLengthSeconds?: number, startHour?: number }} [options]
 * @returns {{
 *   update: (dt: number) => void,
 *   readonly hour: number,
 *   readonly isNight: boolean,
 *   sunDirection: () => {x:number, y:number, z:number},
 *   moonDirection: () => {x:number, y:number, z:number},
 *   sunIntensity: () => number,
 *   moonIntensity: () => number,
 *   ambientIntensity: () => number,
 *   sunColor: () => {r:number, g:number, b:number},
 *   moonColor: () => {r:number, g:number, b:number},
 *   skyTurbidity: () => number
 * }}
 */
export function createDayNightCycle({ dayLengthSeconds = 600, startHour = 8 } = {}) {
  let hour = wrapHour(startHour);

  /** @returns {number} sun intensity 0..1 for the current hour */
  const intensity = () => smoothstep(0, 0.35, hourToElevation(hour));

  return {
    /**
     * Advances the clock by dt seconds of real time.
     * @param {number} dt - seconds
     * @returns {void}
     */
    update(dt) {
      hour = wrapHour(hour + (24 * dt) / dayLengthSeconds);
    },

    /** @returns {number} current in-game hour in [0, 24) */
    get hour() {
      return hour;
    },

    /** @returns {boolean} true when the sun is below the horizon */
    get isNight() {
      return hourToElevation(hour) < 0;
    },

    /**
     * Unit vector pointing from the scene toward the sun.
     * @returns {{x:number, y:number, z:number}}
     */
    sunDirection() {
      const angle = ((hour - 6) / 24) * TWO_PI;
      const c = Math.cos(angle);
      return { x: c * Math.cos(TILT), y: Math.sin(angle), z: c * Math.sin(TILT) };
    },

    /**
     * Unit vector pointing from the scene toward the moon. It is the sun's direction mirrored
     * through the scene, so at night (when the sun is below the horizon) the moon is above it.
     * @returns {{x:number, y:number, z:number}}
     */
    moonDirection() {
      const angle = ((hour - 6) / 24) * TWO_PI;
      const c = Math.cos(angle);
      return { x: -c * Math.cos(TILT), y: -Math.sin(angle), z: -c * Math.sin(TILT) };
    },

    /**
     * Directional sun strength: 0 at or below the horizon, 1 at high sun.
     * @returns {number}
     */
    sunIntensity: intensity,

    /**
     * Moon strength: 0 by day, rising smoothly after sunset, 1 around midnight.
     * @returns {number} value in [0, 1]
     */
    moonIntensity() {
      return smoothstep(0, MOON_FADE_ELEVATION, hourToElevation(hour));
    },

    /**
     * Hemisphere/ambient strength: 0.45 at midnight up to 0.75 at noon.
     * @returns {number}
     */
    ambientIntensity() {
      return lerp(AMBIENT_NIGHT, AMBIENT_DAY, intensity());
    },

    /**
     * Sun/light colour as 0..1 RGB (sRGB values): warm orange at the horizon, near-white at noon,
     * dim blue at night.
     * @returns {{r:number, g:number, b:number}}
     */
    sunColor() {
      const elevation = hourToElevation(hour);
      const warmth = smoothstep(0, 0.25, elevation);
      const day = {
        r: lerp(HORIZON_COLOUR.r, NOON_COLOUR.r, warmth),
        g: lerp(HORIZON_COLOUR.g, NOON_COLOUR.g, warmth),
        b: lerp(HORIZON_COLOUR.b, NOON_COLOUR.b, warmth),
      };
      const blend = smoothstep(-0.2, 0, elevation);
      return {
        r: lerp(NIGHT_COLOUR.r, day.r, blend),
        g: lerp(NIGHT_COLOUR.g, day.g, blend),
        b: lerp(NIGHT_COLOUR.b, day.b, blend),
      };
    },

    /**
     * Moonlight colour: cool blue-white, constant over the night.
     * @returns {{r:number, g:number, b:number}}
     */
    moonColor() {
      return { r: MOON_COLOUR.r, g: MOON_COLOUR.g, b: MOON_COLOUR.b };
    },

    /**
     * Atmospheric turbidity for the Sky shader: about 1.5 at night, 5 at day (deep blue, not hazy).
     * @returns {number}
     */
    skyTurbidity() {
      return lerp(TURBIDITY_NIGHT, TURBIDITY_DAY, intensity());
    },
  };
}
