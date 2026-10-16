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
  world/terrainHeight.js       pure heightFn(x,z): plateau, rim, lowlands, river, mountain ring, arenas
  world/HeightField.js         pure sampled height field: heightAt/normalAt/slopeAt (+ offset variant)
  world/TerrainMesh.js         Three.js mesh from a HeightField (vertex colours, positioned by origin)
  world/partition/chunkMath.js           pure chunk indices, keys, neighbourhoods, load/unload diff, seeds
  world/partition/ChunkedHeightField.js  pure chunk-routed, LRU-cached height field (world coords)
  world/partition/chunkVegetation.js     pure deterministic per-chunk scatter (trees/grass/rocks)
  world/partition/ChunkManager.js        Three.js adapter: streams chunk groups around the player
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
  chunk: Object.freeze({ size: 256, resolution: 64, loadRadius: 3, unloadRadius: 4 }),
  far: Object.freeze({ resolution: 128, yOffset: -1.5 }),
  arenas: Object.freeze([                       // flat boss discs: { id, name, x, z, radius, y }
    { id: 'talus', name: 'Talus Hollow', x: 300, z: 250, radius: 40, y: 48 },
    { id: 'hinox', name: 'Hinox Grove', x: -280, z: -240, radius: 45, y: 52 },
    { id: 'flux', name: 'Flux Construct Rise', x: 1100, z: -900, radius: 50, y: 34 },
  ]),
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
// Rolling hills 15–90 m on the plateau; cliff rim dropping to seaLevel − 15 beyond plateauRadius; flat
// discs of radius 24 m around WORLD.shrine (y≈60) and 34 m around WORLD.templeOfTime (y≈75) on broad
// hills (skirts ~160–180 m); a lake basin at (120, −160). Beyond the rim the ground blends (r ≈ 540 →
// 690) into lowlands at seaLevel + 8…40 with a meandering river (bed below seaLevel − 3 within ~14 m of
// x = 600 + 180·sin(z/400), |z| ≤ 1800). A mountain ring rises from r ≈ 1500 to 110–140 m at r ≈ 1900,
// then falls to seaLevel − 20 beyond r ≈ 2030 (the natural edge). Arena discs are flattened last.

// world/HeightField.js
export function createHeightField({ size, resolution, heightFn })
// → { size, resolution, data:Float32Array((resolution+1)²), heightAt(x,z), normalAt(x,z)→{x,y,z}, slopeAt(x,z)→radians }
// heightAt bilinearly interpolates; outside bounds clamps to edge.

// world/TerrainMesh.js
export function createTerrainMesh(heightField, { colours, originX, originZ } = {})  // → THREE.Mesh 'Terrain' (receiveShadow, vertex colours); positioned at origin + size/2

// world/Water.js
export function createWater({ size, level })   // → THREE.Mesh (transparent blue plane at y=level)

// world/vegetation/Placement.js (pure)
export function scatterPoints({ count, size, originX, originZ, prng, heightAt, slopeAt, isValid })  // origin defaults to centred on 0
// → Array<{x,y,z,rotation,scale}>; rejects points where !isValid(x,y,z,slope). Deterministic via prng.
// world/vegetation/Trees.js | Grass.js | Rocks.js
export function createTrees(points)  // → THREE.Group of InstancedMesh (castShadow). Same shape for createGrass, createRocks.

// world/landmarks/ShrineOfResurrection.js
export function createShrineOfResurrection({ position, exitDirection, groundY }) // → THREE.Group. A 6 m wide, 5 m tall,
// 30 m long stone corridor whose open end faces exitDirection; spawn point is at the closed end. Exposes group.userData.spawn = {x,y,z}.
// world/landmarks/TempleOfTime.js
export function createTempleOfTime({ position, groundY })  // → THREE.Group of broken stone walls, columns, a Goddess statue plinth at the far (north) end.
```

## World partition (chunk streaming)
The world is 4096 m. Terrain and vegetation exist only for chunks near the player; a low-detail
**far terrain** (`FarTerrain`, 128 cells, sunk `far.yOffset` below the chunks) always fills the horizon.
```js
// world/partition/chunkMath.js (pure)
export function chunkCoord(x, z, chunkSize)            // → {cx, cz} floor division; chunk (0,0) = [0,size)
export function chunkKey(cx, cz)                       // → 'cx,cz'
export function parseChunkKey(key)                     // → {cx, cz}
export function chunkOrigin(cx, cz, chunkSize)         // → {x, z} minimum corner
export function chunksAround(cx, cz, radius)           // → [{cx,cz}] square, nearest ring first
export function diffChunkSets(current: Set<string>, wanted: string[], unloadRadius, centre) // → {toLoad, toUnload}
export function chunkSeed(baseSeed, cx, cz)            // → deterministic uint32 (hash2D)
export function isChunkInWorld(cx, cz, worldSize, chunkSize)

// world/partition/ChunkedHeightField.js (pure)
export function createChunkedHeightField({ worldSize, chunkSize, resolution, heightFn, maxCached = 128 })
// → { size, chunkSize, resolution, heightAt, normalAt, slopeAt (world coords, clamped to world edge),
//     chunkField(cx,cz) (cached HeightField with originX/originZ; throws outside world),
//     retain(key) / release(key) (pin against LRU eviction), cachedCount() }
// world/partition/chunkVegetation.js (pure)
export function scatterChunkVegetation({ config, field, cx, cz }) // → {trees, grass, rocks} ScatterPoint[]
// world/partition/ChunkManager.js (Three.js adapter)
export function createChunkManager({ scene, config, heightField, onChunkLoaded, onChunkUnloaded })
// → { group (THREE.Group 'Chunks', added to scene), update(position, { maxLoads = 2 }), loadedKeys(), dispose() }
//   Loaded chunk = Group 'chunk:<key>' with terrain mesh + trees/grass/rocks InstancedMeshes.
//   onChunkLoaded(key, { cx, cz, trees: ScatterPoint[], rocks: ScatterPoint[] })
//   onChunkUnloaded(key)
// core/WorldBuilder.js: buildWorld(scene, config = WORLD, { onChunkLoaded, onChunkUnloaded } = {})
//   → { heightField (chunked), terrain (FarTerrain), water, shrine, temple, chunks, spawn }
//   Loads chunks around the spawn before returning. Per frame the game calls chunks.update(playerPosition).
```
Rules: chunks outside ±size/2 are never requested; adjacent chunks share edge samples exactly (no seams);
vegetation per chunk uses that chunk's own `heightAt/slopeAt` and PRNG seeded by (world seed, cx, cz).

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
