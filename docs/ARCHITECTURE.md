# Architecture contract

Every module below has a fixed public interface. Implementers may add private helpers and extra
files but must not change exported names/signatures without updating this document.

## Scene goal (the "beginning of Breath of the Wild")
1. Black screen, title "New Plateau", then intro text *"...Open your eyes..."*. Any key starts.
2. Player spawns inside the **Shrine of Resurrection** (a short stone corridor/cave), walks out of
   the opening into daylight.
3. Outside: the **Great Plateau** — rolling grass hills, scattered trees and rocks, a cliff edge that
   drops away at the plateau rim, a lake/pond at low elevation, and the **Temple of Time** ruins
   visible on a hill. A location banner "Great Plateau" fades in on exit.
4. Player can walk, sprint (drains stamina), jump, and hold jump while falling to deploy a
   **paraglider** (drains stamina, slow descent). Stamina regenerates when idle/walking.
5. Day/night cycle with sun, sky and fog. Third-person camera with mouse look (Pointer Lock).

## Directory layout
```
src/
  main.js                      bootstrap: new Game(document.getElementById('app')).start()
  core/Game.js                 composition root + frame loop (owns renderer, scene, systems)
  core/EventBus.js             tiny pub/sub
  core/Input.js                keyboard/mouse → InputState snapshot (Pointer Lock)
  world/WorldConfig.js         WORLD constants
  world/Prng.js                seeded PRNG (mulberry32) + helpers
  world/terrainHeight.js       pure heightFn(x,z) for the plateau (noise + rim falloff)
  world/HeightField.js         pure sampled height field: heightAt/normalAt/slopeAt
  world/TerrainMesh.js         Three.js mesh from a HeightField (vertex colours)
  world/Water.js               flat water plane at WORLD.seaLevel
  world/vegetation/Placement.js  pure: deterministic scatter points on valid terrain
  world/vegetation/Trees.js      InstancedMesh trees
  world/vegetation/Grass.js      InstancedMesh grass tufts
  world/vegetation/Rocks.js      InstancedMesh rocks
  world/landmarks/ShrineOfResurrection.js  spawn cave group
  world/landmarks/TempleOfTime.js          ruined temple group
  environment/DayNightCycle.js pure: time → sun direction/intensity/colours
  environment/SkyDome.js       three/addons/objects/Sky.js wrapper
  environment/Lighting.js      DirectionalLight (sun, shadows) + HemisphereLight + fog
  player/Stamina.js            pure stamina resource
  player/PlayerPhysics.js      pure movement/state machine step
  player/PlayerMesh.js         placeholder Link (capsule + simple limbs) Object3D
  player/Player.js             adapter: Input + PlayerPhysics + PlayerMesh
  camera/ThirdPersonCamera.js  orbit/follow camera with terrain clamp
  ui/Hud.js                    composes StaminaWheel, Hearts, LocationBanner, Prompt
  ui/StaminaWheel.js           SVG arc
  ui/Hearts.js                 heart row
  ui/LocationBanner.js         fading location title
  ui/IntroOverlay.js           title + "Open your eyes" + press-any-key
  styles/base.css, styles/hud.css, styles/intro.css
tests/   mirrors src/ (Vitest)        e2e/  Playwright specs
```

## Shared constants — `src/world/WorldConfig.js`
```js
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
```
Heights near the spawn and the temple are flattened by `terrainHeight.js` so landmarks sit level.

## Core
```js
// core/EventBus.js
export class EventBus {
  on(event, handler)   // returns unsubscribe fn
  off(event, handler)
  emit(event, payload)
}

// core/Input.js — DOM adapter. No Three.js.
export class Input {
  constructor(domElement)        // element to request pointer lock on click
  attach()  detach()
  snapshot()  // returns InputState (see below) and resets per-frame edge flags & mouse deltas
}
/** @typedef {{ moveX:number, moveZ:number, sprint:boolean, jumpHeld:boolean, jumpPressed:boolean,
 *   interactPressed:boolean, anyKeyPressed:boolean, mouseDX:number, mouseDY:number, pointerLocked:boolean }} InputState */
// Keys: W/S → moveZ (+1 forward, −1 back), A/D → moveX (−1 left, +1 right), ArrowKeys mirror WASD,
// ShiftLeft → sprint, Space → jump, KeyE → interact. moveX/moveZ are NOT normalised (PlayerPhysics does it).
```

## World (pure modules have no Three.js import)
```js
// world/Prng.js
export function createPrng(seed)   // → { next():number [0,1), range(min,max):number, int(min,maxInclusive):number }
export function hash2D(x, z, seed) // deterministic [0,1) for integer lattice coords

// world/terrainHeight.js
export function createTerrainHeightFn(config = WORLD) // → (x:number, z:number) => y:number
// Layered value/simplex noise (own implementation, seeded) ⇒ rolling hills 15–90 m; smooth radial
// falloff to below seaLevel for r > plateauRadius (cliff rim); flat disc of radius 24 m around
// WORLD.shrine (y≈60) and radius 34 m around WORLD.templeOfTime (y≈75), each on a broad hill whose skirt
// blends back to the natural terrain over ~120 m so the approach is a walkable (<25°) grass slope; a basin around (120, -160) that dips below seaLevel (lake).

// world/HeightField.js
export function createHeightField({ size, resolution, heightFn })
// → { size, resolution, data:Float32Array((resolution+1)²), heightAt(x,z), normalAt(x,z)→{x,y,z}, slopeAt(x,z)→radians }
// heightAt bilinearly interpolates; outside bounds clamps to edge.

// world/TerrainMesh.js
export function createTerrainMesh(heightField, { colours } = {})  // → THREE.Mesh (receiveShadow, vertex colours: grass/rock/sand by height+slope)

// world/Water.js
export function createWater({ size, level })   // → THREE.Mesh (transparent blue plane at y=level)

// world/vegetation/Placement.js (pure)
export function scatterPoints({ count, size, prng, heightAt, slopeAt, isValid })
// → Array<{x,y,z,rotation,scale}>; rejects points where !isValid(x,y,z,slope). Deterministic via prng.
// world/vegetation/Trees.js | Grass.js | Rocks.js
export function createTrees(points)  // → THREE.Group of InstancedMesh (castShadow). Same shape for createGrass, createRocks.

// world/landmarks/ShrineOfResurrection.js
export function createShrineOfResurrection({ position, exitDirection, groundY }) // → THREE.Group. A 6 m wide, 5 m tall,
// 30 m long stone corridor whose open end faces exitDirection; spawn point is at the closed end. Exposes group.userData.spawn = {x,y,z}.
// world/landmarks/TempleOfTime.js
export function createTempleOfTime({ position, groundY })  // → THREE.Group of broken stone walls, columns, a Goddess statue plinth at the far (north) end.
```

## Environment
```js
// environment/DayNightCycle.js (pure)
export function createDayNightCycle({ dayLengthSeconds = 600, startHour = 8 } = {})
// → { update(dt), hour (0–24, getter), sunDirection()→{x,y,z} unit, sunIntensity()→0..1, ambientIntensity()→0..1,
//     sunColor()→{r,g,b} 0..1, skyTurbidity()→number, isNight }
// environment/SkyDome.js
export function createSkyDome()  // → { object: THREE.Object3D (Sky addon, scale 10000), update(cycle, dt) }  dt drives cloud drift
// environment/Lighting.js
export function createLighting(scene, { shadowMapSize = 2048 } = {}) // → { sun: DirectionalLight, hemi: HemisphereLight, update(cycle, followPosition) }
// update moves sun to follow the player (shadow frustum ≈ 160 m) and tints fog/lights from the cycle.
```

## Player
```js
// player/Stamina.js (pure)
export function createStamina({ max = 100, sprintDrain = 15, glideDrain = 12, regenRate = 25, exhaustedRegenRate = 18 } = {})
// → { value, max, exhausted, drain(amountPerSec, dt)→boolean (false when the drain would go below 0; value is clamped to 0 and exhausted becomes true), regen(dt), ratio() }
// When value hits 0 ⇒ exhausted=true until value refills to max.

// player/PlayerPhysics.js (pure)
export const PLAYER = Object.freeze({ walkSpeed: 5, sprintSpeed: 9, jumpSpeed: 9, glideFallSpeed: 2.5, glideSpeed: 7,
  height: 1.7, radius: 0.4, turnRate: 12, accel: 40, airControl: 0.4 });
export function createPlayerState({ x, y, z, yaw })
// → { position:{x,y,z}, velocity:{x,y,z}, yaw, mode:'ground'|'air'|'glide', grounded:boolean, stamina: Stamina }
export function stepPlayer(state, input, env, dt)   // mutates+returns state
// env = { heightAt(x,z), gravity, cameraYaw }. Movement is camera-relative. Rules:
//   ground: accelerate toward input dir; sprint if sprint && stamina ok; jumpPressed ⇒ velocity.y = jumpSpeed, mode='air'.
//   air: gravity; airControl; if jumpPressed (new press) and falling (velocity.y < 0) ⇒ mode='glide'.
//   glide: velocity.y = -glideFallSpeed, horizontal = glideSpeed in facing dir; release jumpHeld or stamina empty ⇒ 'air'.
//   landing: position.y <= heightAt ⇒ snap, grounded, mode='ground'. Steep slopes (> 50°) slide the player downhill.

// player/PlayerMesh.js
export function createPlayerMesh()  // → { object: THREE.Group, setGliding(bool), setMoving(speedRatio), update(dt) } — simple limb bob.
// player/Player.js
export class Player {
  constructor({ heightField, spawn })
  get object()      // THREE.Group to add to the scene
  get state()       // PlayerState
  update(inputState, cameraYaw, dt)
}
```

## Camera
```js
// camera/ThirdPersonCamera.js
export class ThirdPersonCamera {
  constructor(camera, { heightAt, distance = 6, height = 1.8, sensitivity = 0.0025, minPitch = -0.5, maxPitch = 1.2, initialYaw = 0 })
  get yaw()   get pitch()
  update(targetPosition, inputState, dt)   // orbit from mouseDX/DY, smooth follow, keep camera ≥ 0.5 m above terrain
}
```

## UI (DOM only, no Three.js). Each class takes a parent element and builds its own DOM.
```js
export class StaminaWheel { constructor(parent); update(ratio, exhausted) }
export class Hearts       { constructor(parent, maxHearts = 3); update(hearts) }
export class LocationBanner { constructor(parent); show(text, durationMs = 4000) }
export class IntroOverlay { constructor(parent); show(); hide()→Promise (fades); onStart(cb) /* resolves on any key */ }
export class Hud { constructor(parent); update({ staminaRatio, exhausted, hearts, prompt }); get banner() }
```

## Game loop — `core/Game.js`
```js
export class Game {
  constructor(container)   // builds renderer (antialias, shadows, sRGB), scene, camera, all systems
  async start()            // show intro → wait for key → hide → run loop
  update(dt)               // input.snapshot → player.update → camera.update → cycle.update → lighting/sky.update → hud.update
  render()
}
```
Frame dt is clamped to 0.05 s. Resize handled via `window.resize`.

## Events (EventBus names)
`player:exitedShrine` (fired once when player leaves the shrine corridor) → Hud shows "Great Plateau".

## Yaw conventions
Two conventions coexist; the Game bridges them.
- **Camera** (`ThirdPersonCamera.yaw`): `yaw = 0` looks toward −Z (Three.js default). Forward = `(−sin yaw, −cos yaw)`,
  right = `(cos yaw, −sin yaw)`. Mouse right decreases yaw. Camera-relative movement in `playerMovement.movementIntent`
  uses this convention for `cameraYaw`: `dir = forward·moveZ + right·moveX`.
- **Player facing** (`state.yaw`, `PlayerMesh`): facing = `(sin yaw, cos yaw)`, so `yaw = 0` faces +Z and
  `object.rotation.y = state.yaw` is correct because the mesh's front is built along local +Z.
- Bridge: at spawn the Game sets the player's yaw to `atan2(exitDirection.x, exitDirection.z)` (faces the exit) and the
  camera's `initialYaw` to that value **+ π** so the camera looks the same way.
- `WORLD.spawn` only records the shrine centre; the actual spawn point is `shrine.userData.spawn` (12 m inside the closed end).

## Events (EventBus names)
`player:exitedShrine` (fired once when player leaves the shrine corridor) → Hud shows "Great Plateau".

## Yaw convention (camera and player share it)
`yaw = 0` looks toward −Z (Three.js default). For any yaw:
```js
const fx = -Math.sin(yaw), fz = -Math.cos(yaw);   // forward
const rx =  Math.cos(yaw), rz = -Math.sin(yaw);   // right (forward rotated 90° clockwise seen from above)
// camera-relative move direction in PlayerPhysics: dir = forward*moveZ + right*moveX  (then normalised)
```
The player mesh faces `(−sin(state.yaw), −cos(state.yaw))`, so `object.rotation.y = state.yaw` matches
Three.js's default −Z facing. Mouse right decreases camera yaw; `ThirdPersonCamera.yaw` is the value to pass
as `cameraYaw`.
