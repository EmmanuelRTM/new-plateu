# Architecture contract

Every module below has a fixed public interface. Implementers may add private helpers and extra
files but must not change exported names/signatures without updating this document.

## Scene goal (the "beginning of Breath of the Wild", then beyond it)
1. Black screen, title "New Plateau", then intro text *"...Open your eyes..."*. Any key starts.
2. Player spawns inside the **Shrine of Resurrection** (a 30 m stone corridor), walks out into daylight.
3. Outside: the **Great Plateau** — rolling grass hills, trees and rocks, a cliff rim, a lake, and the
   **Temple of Time** ruins on a hill. A location banner "Great Plateau" fades in on exit.
4. Movement: walk, sprint and glide drain stamina; jump; hold jump while falling to deploy the **paraglider**.
   Stamina regenerates when idle or walking. Movement is collision-checked against trees, rocks, the temple and bosses.
5. Beyond the plateau: a streamed **4096 m world** with lowlands and a meandering river, and a mountain
   ring at its edge. Terrain and vegetation are streamed in chunks; a low-detail far terrain fills the horizon.
6. **Weapons and inventory** (Tears of the Kingdom style): 9 slots, equip by key or wheel, durability that
   breaks, melee combos, shields you raise to guard. Bows equip and show a model; no arrow firing exists yet.
   Zonai abilities are listed in the weapon menu as "coming soon" and are not implemented.
7. **Three bosses** in flat arenas (Stone Talus, Hinox, Flux Construct I) with a phase state machine,
   a health bar. Player death respawns the player at the shrine with full hearts.
8. **Minimap** (bottom-right) and a full-screen **world map** (M) with landmark and boss markers.
9. Day/night cycle with sun, moon, stars, sky and fog. Third-person camera with mouse look (Pointer Lock).

## Directory layout
```
src/
  main.js                      bootstrap: new Game(document.getElementById('app')).start()
  core/Game.js                 composition root + frame loop (owns renderer, scene, systems)
  core/GameLoop.js             rAF loop with dt clamp (pure timing; no Three.js)
  core/EventBus.js             tiny pub/sub
  core/Input.js                keyboard/mouse → InputState snapshot (Pointer Lock)
  core/WorldBuilder.js         composition of the world (terrain, water, landmarks, chunks)
  core/playerCollision.js      bridge: chunk and static colliders → player push-out
  core/CombatController.js     inventory, melee attack, weapon meshes, weapon HUD
  core/playerVitals.js         hearts, damage, guard, invulnerability window, respawn
  core/shrineBounds.js         shrine corridor clamps for player and camera
  physics/                     pure collision: colliders, spatial hash, resolve; meshColliders (Three.js)
  items/itemCatalog.js         item data (pure)
  items/Inventory.js           fixed slots, equip, cycle, durability (pure)
  combat/Health.js             health resource (pure)
  combat/attackState.js        melee windup/active/recover combo state machine (pure)
  enemies/bossCatalog.js       boss stat blocks (pure)
  enemies/bossAi.js            boss state machine (pure)
  enemies/Boss.js              one boss: state machine + figure
  enemies/BossManager.js       all bosses: step, hits both ways, active boss
  enemies/BossMesh.js          boss figure, rig picked by id
  enemies/rigs/                talusRig.js, hinoxRig.js, fluxRig.js, rigCommon.js
  world/WorldConfig.js         WORLD constants
  world/Prng.js                seeded PRNG (mulberry32) + hash helpers
  world/noise.js               seeded value noise and fBm (pure)
  world/terrainHeight.js       pure heightFn(x,z): plateau, rim, lowlands, river, mountain ring, arenas
  world/terrainColour.js       pure per-vertex colour (grass / rock / sand)
  world/HeightField.js         pure sampled height field: heightAt/normalAt/slopeAt (+ offset variant)
  world/TerrainMesh.js         Three.js mesh from a HeightField (vertex colours, world-space UVs)
  world/terrainMaterial.js     shared terrain material (procedural grass and soil textures)
  world/Water.js               water plane at WORLD.seaLevel with scrolling ripple normals
  world/partition/chunkMath.js           pure chunk indices, keys, neighbourhoods, load/unload diff, seeds
  world/partition/ChunkedHeightField.js  pure chunk-routed, LRU-cached height field (world coords)
  world/partition/chunkVegetation.js     pure deterministic per-chunk scatter (trees/grass/rocks)
  world/partition/ChunkManager.js        Three.js adapter: streams chunk groups around the player
  world/vegetation/Placement.js  pure: deterministic scatter points on valid terrain
  world/vegetation/Trees.js | Grass.js | Rocks.js | instancing.js | treeGeometry.js   InstancedMesh vegetation
  world/vegetation/windUniforms.js  shared wind clock for vegetation shaders
  world/materials/textureNoise.js       pure tileable noise, normal maps, palette colouring
  world/materials/proceduralTextures.js Three.js DataTextures built from textureNoise
  world/landmarks/ShrineOfResurrection.js  spawn cave group
  world/landmarks/TempleOfTime.js          ruined temple group
  environment/DayNightCycle.js pure: time → sun and moon directions, intensities, colours
  environment/SkyDome.js       three/addons/objects/Sky.js wrapper
  environment/Lighting.js      sun (shadows) + moon + hemisphere light + fog
  environment/Stars.js         star field and moon disc
  environment/renderSettings.js renderer constants (exposure, shadow map type)
  player/Stamina.js            pure stamina resource
  player/PlayerPhysics.js      pure movement/state machine step
  player/playerMovement.js     pure helpers: movement intent, damping, slopes, facing
  player/PlayerMesh.js         placeholder Link (capsule + limbs, arm pivots) Object3D
  player/WeaponMesh.js         held weapon and shield meshes on the arm pivots
  player/Player.js             adapter: Input + PlayerPhysics + PlayerMesh
  camera/ThirdPersonCamera.js  orbit/follow camera with terrain clamp
  ui/Hud.js                    composes StaminaWheel, Hearts, LocationBanner, prompt, MiniMap, WorldMap
  ui/MiniMap.js                circular minimap (bottom-right)
  ui/WorldMap.js               full-screen world map overlay (M)
  ui/WeaponSlot.js             top-right weapon card (equipped weapon, durability, shield, key hints)
  ui/WeaponMenu.js             centred 3×3 weapon menu (Tab)
  ui/BossBar.js                top-centre boss health bar
  ui/StaminaWheel.js | Hearts.js | LocationBanner.js | IntroOverlay.js | dom.js
  ui/map/                      canvas2d, mapMath, mapDraw, terrainPainter, terrainCanvas (map helpers)
  styles/base.css, hud.css, intro.css, boss.css, inventory.css, map.css
tests/   mirrors src/ (Vitest)        e2e/  Playwright specs
```

## Shared constants — `src/world/WorldConfig.js`
Copied verbatim from the file (the file is the source of truth):
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

// core/GameLoop.js (pure timing)
export const MAX_FRAME_SECONDS = 0.05;
export function createGameLoop(update, render, options = {})  // → { start(), stop() }; start() is a no-op while running

// core/Input.js — DOM adapter. No Three.js.
export class Input {
  constructor(domElement)        // element to request pointer lock on click
  attach()  detach()             // detach() removes every listener and drops held keys
  snapshot()  // returns InputState and resets per-frame edge flags, wheel and mouse deltas
}
/** @typedef {{ moveX:number, moveZ:number, sprint:boolean, jumpHeld:boolean, jumpPressed:boolean,
 *   interactPressed:boolean, anyKeyPressed:boolean, mouseDX:number, mouseDY:number, pointerLocked:boolean,
 *   attackPressed:boolean, blockHeld:boolean, menuPressed:boolean, mapPressed:boolean,
 *   cycleDelta:number, slotPressed:number }} InputState */
```
Key map (`Input.js`; moveX/moveZ are NOT normalised, PlayerPhysics does it):

| Input | InputState effect |
|-------|-------------------|
| `W` / `S` (or ↑ / ↓) | `moveZ` +1 / −1 |
| `A` / `D` (or ← / →) | `moveX` −1 / +1 |
| `Shift` | `sprint` |
| `Space` | `jumpHeld`; `jumpPressed` on the press (glide when pressed again while falling) |
| `E` | `interactPressed` (reserved, no consumer yet) |
| `Tab` | `menuPressed` — toggles the weapon menu |
| `M` | `mapPressed` — toggles the world map |
| `Q` / `R` or mouse wheel | `cycleDelta` −1 / +1 — previous / next weapon (wheel only while locked) |
| `1`–`9` | `slotPressed` = 1..9 — equip that inventory slot |
| Left mouse (locked) | `attackPressed` — melee attack |
| Right mouse held (locked) | `blockHeld` — guard with the equipped shield |

Game-side: while the weapon menu or the world map is open, movement, look, attack and guard are
zeroed, but `menuPressed`, `cycleDelta` and `slotPressed` still reach the combat controller.

## Physics (collision) — `src/physics/` and `src/core/playerCollision.js`
Colliders are vertical prisms in XZ with a [yMin, yMax] band. The player is a circle of radius
`PLAYER.radius` with the band `PLAYER_BAND` (0.1 to 1.7 m above the feet). Only colliders whose
band strictly overlaps can block, so standing on or jumping over an object never snags.
```js
// physics/colliders.js (pure)
export function circleCollider({ x, z, radius, yMin, yMax })         // → { kind:'circle', ... }
export function boxCollider({ x, z, halfX, halfZ, yaw = 0, yMin, yMax })  // → { kind:'box', ... } (yaw about +Y)
export function colliderBounds(collider)                              // → { minX, maxX, minZ, maxZ }

// physics/SpatialHash.js (pure)
export function createSpatialHash(cellSize = 8)  // → { insert, remove, has, query(minX,minZ,maxX,maxZ), clear(), size }

// physics/ColliderWorld.js (pure)
export function createColliderWorld({ cellSize = 8 } = {})
// → { addGroup(groupId, colliders), removeGroup(groupId), hasGroup(groupId), query(x,z,radius),
//     resolve(position, { radius, yMin = 0.1, yMax = 1.7 }) → { collided, pushX, pushZ }, count }

// physics/resolveCollisions.js (pure)
export function penetrationCircleCircle(px, pz, pr, cx, cz, cr) // → { nx, nz, depth } | null
export function penetrationCircleBox(px, pz, pr, box)           // → { nx, nz, depth } | null
export function resolveCircleAgainst(position, radius, yMin, yMax, colliders, { passes = 3 } = {})
// → { collided, pushX, pushZ }; mutates position.x/z in place over up to `passes` sweeps

// physics/vegetationColliders.js (pure)
export function treeColliders(points)   // → circle per tree, radius 0.4 × point.scale
export function rockColliders(points)   // → circle per rock

// physics/meshColliders.js (Three.js adapter)
export function collidersFromGroup(group, { minHeight = 0.6, skip = () => false })  // → Collider[] from mesh bounding boxes

// physics/penetrationEpsilon.js
export const penetrationDepthEpsilon = 1e-9;

// core/playerCollision.js
export const PLAYER_BAND = Object.freeze({ yMin: 0.1, yMax: 1.7 });
export function createPlayerCollision({ cellSize = 8 } = {})
// → { world, onChunkLoaded(key, { trees, rocks }), onChunkUnloaded(key), addStatic(id, colliders),
//     syncDynamic(id, colliders), resolvePlayer(state, radius) → { collided, pushX, pushZ } }
// resolvePlayer also removes the velocity component pointing into the collider it pushed against.
// Chunk colliders live under 'chunk:<key>'. Boss bodies are synced under 'boss:<id>'. The temple is static.

// core/shrineBounds.js (pure)
export const CORRIDOR_LIMITS = Object.freeze({ maxLateral: 2.5, minAlong: -14.3 });
export const CAMERA_CEILING_CLEARANCE = 0.4;
export function clampToCorridor(position, shrine)        // mutates position.x/z inside the corridor
export function clampCameraToCorridor(position, shrine)  // same for the camera, plus the ceiling
```

## Items & combat — `src/items/`, `src/combat/`, `src/core/CombatController.js`
```js
// items/itemCatalog.js (pure)
export const ITEM_TYPES = Object.freeze(['sword', 'claymore', 'spear', 'bow', 'shield']);
export const ITEMS = Object.freeze({ /* keyed by id: { id, name, type, attack, durability, reach, swingSeconds, colour, description } */ });
export function getItem(id)            // → ItemDef; throws on an unknown id
export const ZONAI_ABILITIES           // five unimplemented entries for the weapon menu
// Ids: master-sword (unbreakable, Infinity durability), traveler-sword, soldier-broadsword,
// royal-broadsword, zonaite-sword, boko-club; traveler-spear, zonaite-spear; traveler-claymore,
// royal-claymore; traveler-bow, zonaite-bow; wooden-shield, hylian-shield, zonaite-shield.

// items/Inventory.js (pure)
export function createInventory({ capacity = 9 } = {})
// → { slots, equipIndex, add(itemId) → index|-1, remove(index), equip(index), equipped(), cycle(delta),
//     useDurability(amount = 1) → { broke }, equippedShield(), serialize() }
// The first item added while nothing is equipped is equipped automatically. cycle() skips empty slots and wraps.

// combat/Health.js (pure)
export function createHealth({ max })  // → { value, dead, damage(amount) → { dead, applied }, heal(amount), ratio() }

// combat/attackState.js (pure)
export const ATTACK_TIMINGS = Object.freeze({ sword: {windup:0.12, active:0.15, recover:0.25}, claymore: {...}, spear: {...} });
export function createAttackState()                       // → { phase:'idle'|'windup'|'active'|'recover', t, comboIndex, timings }
export function startAttack(state, item)                  // starts a swing; a three-hit combo; bows and shields cannot melee
export function stepAttack(state, item, dt)
export function attackHitbox(state, item, position, yaw) // → { x, z, radius, yMin, yMax, damage } | null, only in the active phase
export function swingProgress(state)                     // → 0..1 for the weapon mesh

// core/playerVitals.js (pure)
export const GUARD_DAMAGE_FRACTION = 0.25;
export function createPlayerVitals({ maxHearts = 3, invulnerableSeconds = 1 } = {})
// → { health, maxHearts, hearts(), invulnerable(), update(dt), takeHits(hits, { guarding }) → { damaged, died, hearts },
//     respawn() }
// At most one hit per grace window. Guarding scales the damage to 25%. Death emits nothing by itself; Game does.

// core/CombatController.js (Three.js and DOM adapter)
export const STARTING_ITEMS = Object.freeze(['traveler-sword', 'wooden-shield', 'traveler-bow', 'boko-club']);
export class CombatController {
  constructor({ armPivots, hudRoot, menuParent, startingItems = STARTING_ITEMS })
  get menuOpen()                       // true while the weapon menu is open
  equippedDef()                        // → ItemDef | null
  update(input, playerState, dt)       // handles slot/cycle/menu keys, attacks, visuals, HUD → hitbox | null
  onHitLanded()                        // wears the weapon; breaks it at 0 durability ("Your weapon broke!" hint, 3 s)
  inventory, attack, weapon, slot, menu // public handles (inventory is an Inventory)
}

// player/WeaponMesh.js
export function createWeaponMesh()
// → { object (right hand group), shieldObject (left hand group), setItem(def|null), setShield(def|null), setSwing(progress, type) }
```

## Enemies — `src/enemies/`
```js
// enemies/bossCatalog.js (pure data)
export const BOSSES     // talus ('Stone Talus', hp 120), hinox ('Hinox', hp 160), flux ('Flux Construct I', hp 100)
export function getBoss(id)   // → BossDef; throws on an unknown id

// enemies/bossAi.js (pure state machine)
export const BOSS_PHASES = Object.freeze(['dormant','alert','chase','windup','strike','recover','stagger','return','dead']);
export function createBossState({ def, home, y })                  // → BossState, starts dormant
export function stepBoss(state, def, { player, heightAt }, dt)     // mutates state
export function bossStrikeHitbox(state, def)                       // → { x, z, radius, yMin, yMax, damageHearts } | null
export function markStrikeLanded(state)                            // one strike hits at most once
export function applyHitToBoss(state, def, hitbox, now)            // → { hit, damage, dead, staggered }
export function hitboxHitsPlayer(hitbox, playerPosition, playerRadius = 0.4)  // → boolean
```
Boss phase rules (`bossAi.js`):
- **dormant** wakes to **alert** when the player is within `aggroRadius`. A hit also wakes it.
- **alert** faces the player for 0.6 s, then **chase**.
- **chase** walks at `speed`. Beyond `leashRadius` it goes to **return**. Within `attackRange` it starts **windup**.
- **windup** (`windupSeconds`) → **strike** (`strikeSeconds`, one hitbox ahead of the boss) → **recover** (`recoverSeconds`) → chase.
- A hit of at least `staggerThreshold` damage enters **stagger** (`staggerSeconds`) → chase.
- **return** walks home at `speed` and regenerates 20% of max health per second. It goes dormant at home when healed.
- **dead** at 0 health. Each body has a 0.35 s hit cooldown.
- Hits on the player are damage in hearts (`damageHearts`). Guarding reduces them to 25% (`playerVitals`).

```js
// enemies/Boss.js
export class Boss {
  constructor({ def, arena, heightAt })
  get object()    get state()    get engaged()    get dead()
  update(playerPosition, dt)   takeHit(hitbox)   strikeHitbox()   markStrikeLanded()
  bodyCollider()               // → CircleCollider of the body, for player collision
  syncMesh(dt)
}

// enemies/BossManager.js
export function createBossManager({ scene, arenas, heightAt, defs = BOSSES })
// → { bosses, update(playerPosition, dt) → { playerHits: {bossId, damageHearts}[] },
//     applyPlayerHitbox(hitbox) → {bossId, damage, dead, staggered}[], activeBoss() → Boss|null,
//     colliders() → { id, collider }[], dispose() }
// Throws when an arena has no matching definition. Game passes WORLD.arenas and wires the results into collision and the BossBar.

// enemies/BossMesh.js
export function createBossMesh(def)   // → figure with update({ phase, t, def, dt }) and setDead(); rig picked by def.id
// enemies/rigs/*.js: buildTalusRig(def), buildHinoxRig(def), buildFluxRig(def) → THREE.Group.
// rigCommon.js: DEATH_SECONDS = 1, clamp01, stoneMaterial, glowMaterial, shadowMesh, namedGroup, capsuleCentreToGround.
```

## World (pure modules have no Three.js import)
```js
// world/Prng.js
export function createPrng(seed)   // → { next():number [0,1), range(min,max):number, int(min,maxInclusive):number }
export function hash2D(x, z, seed) // deterministic [0,1) for integer lattice coords

// world/noise.js (pure)
export function valueNoise2D(x, z, seed)                                // → [0,1]
export function fbm2D(x, z, seed, { octaves = 5, lacunarity = 2, gain = 0.5 })  // → [0,1] normalised
export function smoothstep(e0, e1, x)

// world/terrainHeight.js
export function createTerrainHeightFn(config = WORLD) // → (x:number, z:number) => y:number
// Rolling hills 15–90 m on the plateau; cliff rim dropping to seaLevel − 15 beyond plateauRadius; flat
// discs of radius 24 m around WORLD.shrine (y≈60) and 34 m around WORLD.templeOfTime (y≈75) on broad
// hills (skirts ~160–180 m); a lake basin at (120, −160). Beyond the rim the ground blends (r ≈ 540 →
// 690) into lowlands at seaLevel + 8…40 with a meandering river (bed below seaLevel − 3 within ~14 m of
// x = 600 + 180·sin(z/400), |z| ≤ 1800). A mountain ring rises from r ≈ 1500 to 110–140 m at r ≈ 1900,
// then falls to seaLevel − 20 beyond r ≈ 2030 (the natural edge). Arena discs are flattened last.

// world/terrainColour.js (pure)
export const DEFAULT_PALETTE                                  // { grass, rock, sand } linear RGB triples
export function terrainColour(height, slope, palette = DEFAULT_PALETTE, seaLevel = 10)  // → [r,g,b]
// Sand within ±2 m of sea level, grass on gentle slopes, rock on slopes > 35° or above 110 m.

// world/HeightField.js
export function createHeightField({ size, resolution, heightFn })
// → { size, resolution, data:Float32Array((resolution+1)²), heightAt(x,z), normalAt(x,z)→{x,y,z}, slopeAt(x,z)→radians }
// heightAt bilinearly interpolates; outside bounds clamps to edge.
export function createOffsetHeightField({ originX, originZ, size, resolution, heightFn })  // same shape, minimum corner at origin

// world/TerrainMesh.js
export function createTerrainMesh(heightField, { colours, originX, originZ, material, uvMetres = 256 } = {})
// → THREE.Mesh 'Terrain' (receiveShadow, vertex colours); positioned at origin + size/2.
// UVs are world-space metres / uvMetres, so repeating textures line up across chunk borders.

// world/Water.js
export function createWater({ size, level, seed = 1337 })   // → THREE.Mesh 'Water' at y=level; userData.update(dt) scrolls ripples

// world/vegetation/Placement.js (pure)
export function scatterPoints({ count, size, originX, originZ, prng, heightAt, slopeAt, isValid })  // origin defaults to centred on 0
// → Array<{x,y,z,rotation,scale}>; rejects points where !isValid(x,y,z,slope). Deterministic via prng.
// world/vegetation/Trees.js | Grass.js | Rocks.js
export function createTrees(points)  // → THREE.Group of InstancedMesh (castShadow). Same shape for createGrass, createRocks.

// world/vegetation/windUniforms.js
export const WIND = { time: { value: 0 } };   // shared uniform; vegetation shaders reference WIND.time
export function tickWind(dt)                  // advances the clock; called once per frame by Game

// world/landmarks/ShrineOfResurrection.js
export function createShrineOfResurrection({ position, exitDirection, groundY }) // → THREE.Group. A 6 m wide, 5 m tall,
// 30 m long stone corridor whose open end faces exitDirection. userData.spawn = {x,y,z} 12 m inside the closed end;
// userData.exitPoint = a world-space point just outside the open end.
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
export function createChunkManager({ scene, config, heightField, onChunkLoaded, onChunkUnloaded, terrainMaterial = null })
// → { group (THREE.Group 'Chunks', added to scene), update(position, { maxLoads = 2 }), loadedKeys(), dispose() }
//   Loaded chunk = Group 'chunk:<key>' with a terrain mesh (shared terrainMaterial when given) and
//   trees/grass/rocks InstancedMeshes.
//   onChunkLoaded(key, { cx, cz, trees: ScatterPoint[], rocks: ScatterPoint[] })
//   onChunkUnloaded(key)
// core/WorldBuilder.js: buildWorld(scene, config = WORLD, { onChunkLoaded, onChunkUnloaded } = {})
//   → { heightField (chunked), terrain (FarTerrain), water, shrine, temple, chunks, spawn }
//   Loads chunks around the spawn before returning (maxLoads Infinity). Per frame Game calls chunks.update(playerPosition).
//   spawn = shrine spawn lifted 0.05 m, yaw = atan2(exit.x, exit.z) so the player faces the exit.
```
Rules: chunks outside ±size/2 are never requested; adjacent chunks share edge samples exactly (no seams);
vegetation per chunk uses that chunk's own `heightAt/slopeAt` and PRNG seeded by (world seed, cx, cz).

## Visuals — textures, terrain material, wind
```js
// world/materials/textureNoise.js (pure: typed arrays only)
export function periodicFbm2D(s, t, scale, seed, octaves)         // tileable fBm in [0,1]
export function noiseHeightArray({ size, seed, scale = 8, octaves = 4 })   // tileable height array, row-major
export function ridgedNoiseArray({ size, seed, scale = 6, octaves = 3 })   // sharp valleys: cracks and ripples
export function heightToNormalRGBA(height, size, strength = 2)     // tangent-space normal map bytes
export function colourFromPaletteRGBA(height, size, palette)       // palette stops, linear interpolation

// world/materials/proceduralTextures.js (Three.js adapters: fresh textures per call, no global cache)
export function createDataTextureRGBA(data, size, { colorSpace = 'srgb', repeat = 1, anisotropy = 4 })
export function createGrassDetailTexture({ seed, size = 256 })    // mottled green-brown albedo
export function createRockTexture({ seed, size = 256 })           // grey albedo with crack lines
export function createSoilNormalMap({ seed, size = 256, strength = 1.5 })
export function createWaterNormalMap({ seed, size = 256 })        // ridged ripples for water

// world/terrainMaterial.js
export function createTerrainMaterial({ seed = 1337, tileMetres = 6, chunkMetres = 256 } = {})
// → MeshStandardMaterial: vertexColors × grass albedo, soil normal map, roughness 0.92, metalness 0.
// Requires world-continuous UVs (see TerrainMesh uvMetres). Chunk meshes share one material instance.
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

// player/playerMovement.js (pure)
export const STEEP_SLOPE_RAD, SLIDE_SPEED, GROUND_DROP_TOLERANCE
export function movementIntent(input, cameraYaw)     // → { dirX, dirZ, magnitude }; dir = forward·moveZ + right·moveX
export function dampVelocity(current, target, rate, dt)
export function wrapAngle(angle)
export function turnYawToward(yaw, dirX, dirZ, turnRate, dt)
export function facingDirection(yaw)                 // → { x: sin yaw, z: cos yaw }
export function slopeAt(heightAt, x, z)
export function isBlockedUphillStep(heightAt, nx, nz, currentY)

// player/PlayerMesh.js
export function createPlayerMesh()
// → { object: THREE.Group, armPivots: { left, right } (shoulder pivots; held items attach here), setGliding(bool), setMoving(speedRatio), update(dt) }
// player/Player.js
export class Player {
  constructor({ heightField, spawn })   // spawn = { x, y, z, yaw }
  get object()      // THREE.Group to add to the scene
  get state()       // PlayerState
  update(inputState, cameraYaw, dt)     // syncs the mesh: group.rotation.y = state.yaw
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

## Environment
```js
// environment/DayNightCycle.js (pure)
export function createDayNightCycle({ dayLengthSeconds = 600, startHour = 8 } = {})
// Game uses dayLengthSeconds 720 and startHour 8.5.
// → { update(dt), hour (0–24, getter), isNight, sunDirection()→{x,y,z} unit, moonDirection()→{x,y,z} unit,
//     sunIntensity()→0..1, moonIntensity()→0..1, ambientIntensity()→0.6..0.75, sunColor()→{r,g,b}, moonColor()→{r,g,b},
//     skyTurbidity()→1.5..3 }
export function hourToElevation(hour)   // sin((hour − 6) / 24 · 2π): sunrise 6 h, noon 12 h, sunset 18 h
// Sun directions point FROM the scene TOWARD the sun. The moon is the mirrored direction, so it is above the
// horizon at night. moonIntensity = smoothstep(0, −0.35, elevation).

// environment/Lighting.js
export function createLighting(scene, { shadowMapSize = 2048 } = {})
// → { sun: DirectionalLight (shadows), moon: DirectionalLight (no shadows), hemi: HemisphereLight,
//     update(cycle, followPosition) }
// Final numbers: sun peak 2.2 × sunIntensity (shadows only while day > 0); moon peak 1.5 × moonIntensity;
// hemi peak 2.15 × ambientIntensity (≈ 1.29 at night, ≈ 1.61 at noon). Shadow frustum is orthographic ±80 m
// (≈ 160 m), light distance 200 m. Fog: day 150–1100 m, night 220–1400 m; fog colour #a9c8ee by day, #1c2746 by night.
// Hemi sky colour #7fb2ff (day) / #1a2a55 (night); ground #5b7745 / #0d1226.
// Moon and sun positions track the followed point; scene.fog is set here.

// environment/SkyDome.js
export function createSkyDome()  // → { object: THREE.Object3D (Sky addon, scale 10000), update(cycle, dt) }  dt drives cloud drift
// mieCoefficient 0.003, mieDirectionalG 0.75; rayleigh 1 at night → 1.8 at full sun; turbidity from the cycle.

// environment/Stars.js
export function createStars({ seed, count = 1500, radius = 4000 })
// → { object: THREE.Group ('Stars': Points field + moon disc, radius 60 at 0.9 × radius), update(cycle) }
// update sets opacity to moonIntensity and hides the group below 0.01. Game keeps `object` at the camera position.

// environment/renderSettings.js
export const RENDER = Object.freeze({ toneMappingExposure: 0.65, shadowMapType: 'PCF', outputColorSpace: 'srgb' });
// Game maps these onto THREE.ACESFilmicToneMapping, PCFShadowMap and SRGBColorSpace.
```

## UI (DOM only, no Three.js). Each class takes a parent element and builds its own DOM.
```js
export class StaminaWheel { constructor(parent); update(ratio, exhausted) }
export class Hearts       { constructor(parent, maxHearts = 3); update(hearts) }   // hearts in heart units, drawn in half steps
export class LocationBanner { constructor(parent); show(text, durationMs = 4000) }
export class IntroOverlay { constructor(parent); show(); hide()→Promise (fades); onStart(cb) /* resolves on any key */ }

// ui/Hud.js
export class Hud {
  constructor(parent, { maxHearts = 3, map = null })
  // map: { worldSize, heightAt, seaLevel, markers } enables the MiniMap and WorldMap; the terrain image is painted once and shared.
  update({ staminaRatio, exhausted, hearts, prompt, player })
  // prompt: text shown when non-empty; player: { x, z, yaw } drives both maps when present.
  toggleMap() → boolean   // opens or closes the WorldMap; false without map options
  get banner()            // LocationBanner
  root, hearts, stamina, miniMap, worldMap
}

// ui/MiniMap.js
export class MiniMap {
  constructor(parent, { worldSize, heightAt, seaLevel, markers = [], radiusMetres = 220, imageSize, diameterPx, terrainCanvas })
  get element()                  // the .minimap root
  setMarkers(markers)            // [{ kind, label, x, z }]
  update({ x, z, yaw })          // repaints only when shouldRepaint() says so; north up, arrow shows facing
}

// ui/WorldMap.js
export class WorldMap {
  constructor(parent, { worldSize, heightAt, seaLevel, markers = [], imageSize = 1024, terrainCanvas = null })
  get element()   get isOpen()   toggle()   open()   close()
  update({ x, z, yaw })          // redraws only while open
  setMarkers(markers)   redraw()   drawGrid()
}
// Markers come from Game: the shrine, the Temple of Time, and each boss arena ('boss' kind).

// ui/WeaponSlot.js
export class WeaponSlot { constructor(parent); update({ item, shield, hint }) }   // top-right card: weapon, durability bar, shield, key hints
export function createWeaponIcon(type)                  // inline SVG silhouette for a weapon type
export function durabilityLabel(durability, maxDurability)   // e.g. "11/22", ∞ for unbreakable
export function durabilityPercent(durability, maxDurability) // 0..100; unbreakable is always 100

// ui/WeaponMenu.js
export class WeaponMenu { constructor(parent); get isOpen(); open(inventory); close(); toggle(inventory); render(inventory) }
// Centred 3×3 grid of the 9 slots (keys 1–9), details of the equipped item, the Zonai row and a key footer.
// It takes no pointer events, so the mouse stays on attack and camera.

// ui/BossBar.js
export class BossBar { constructor(parent); update({ name, ratio } | null) }   // null hides the bar

// ui/map/ (pure helpers and canvas adapters, shared by MiniMap and WorldMap)
export function worldToMap(x, z, { worldSize, mapSize })  // → { u, v } (north-up image)
export function mapToWorld(u, v, { worldSize, mapSize })
export function minimapWindow(centerX, centerZ, radiusMetres, frame)  // → { sx, sy, sw, sh }
export function headingAngle(yaw)                          // canvas rotation for the arrow
export function shouldRepaint(prev, next, { moveThreshold = 0.5, yawThreshold = 0.02 } = {})
export function paintTerrain({ size, worldSize, heightAt, seaLevel, maxHeight = 140 })  // → RGBA bytes
export function heightToColour(height, seaLevel, maxHeight), shadeFactor(h, hNW)
export function createTerrainCanvas({ size, worldSize, heightAt, seaLevel })  // → HTMLCanvasElement, painted once
export function getContext2d(canvas, label)                // throws when the 2D context is unavailable
export function markerColour(kind), drawDiamond(ctx, x, y, r, fill), drawArrow(ctx, x, y, r, angle), drawText(ctx, text, x, y, colour)
```

## Game loop — `core/Game.js`
```js
export class Game {
  constructor(container)   // builds renderer (antialias, shadows, ACES tone mapping, sRGB), world, systems, HUD
  async start()            // show intro → wait for key → discard that key's edge flags → hide intro → run loop
  update(dt)               // see order below
  render()
  dispose()
  get player()             // Player (E2E)
  get cameraRig()          // ThirdPersonCamera (E2E)
  get debug()              // handles for tests: player, cameraRig, camera, cycle, world, scene, collision, combat, hud, bosses, vitals
}
```
`window.__game` is set to the instance in dev builds only. Frame dt is clamped to 0.05 s (`MAX_FRAME_SECONDS`).

**`Game.update(dt)` order:**
1. `input.snapshot()`. If `mapPressed`, toggle the world map.
2. While the weapon menu or the map is open, replace input with an idle snapshot (menu and slot keys still pass through).
3. `player.update(input, cameraRig.yaw, dt)`, then `collision.resolvePlayer(state, PLAYER.radius)`.
4. `clampToCorridor(position)`, then the shrine exit check (fires `player:exitedShrine` once).
5. `world.chunks.update(position)` (streams chunks).
6. `combat.update(input, state, dt)` → the player's melee hitbox.
7. `#updateBosses(hitbox, input.blockHeld, dt)`:
   - `bosses.update(position, dt)` → `playerHits`.
   - If there is a hitbox, `bosses.applyPlayerHitbox(hitbox)`. Any landed hit calls `combat.onHitLanded()`.
   - Sync boss body colliders into collision (`syncDynamic('boss:<id>')`).
   - `vitals.update(dt)`, then `vitals.takeHits(playerHits, { guarding })`. Guarding needs a shield equipped.
   - If the player died, emit `player:died`.
   - Feed the BossBar with the active boss.
8. `cameraRig.update(position, input, dt)`, then `#keepCameraInCorridor` while inside the shrine.
9. `cycle.update(dt)`, `sky.update(cycle, dt)`, `lighting.update(cycle, position)`, `water.userData.update(dt)`.
10. Stars follow the camera and `stars.update(cycle)`. Then `tickWind(dt)`.
11. `hud.update({ staminaRatio, exhausted, hearts, prompt, player: { x, z, yaw } })`.

`#respawn()` (on `player:died`): sets the player to the spawn point with zero velocity, refills hearts,
resets the exit flag, and shows the banner "…Open your eyes…" for 3.5 s.

## Events (EventBus names)
- `player:exitedShrine` (no payload): emitted once, on the frame the player first leaves the shrine corridor.
  Game shows the banner "Great Plateau" for 4.5 s.
- `player:died` (no payload): emitted when vitals report death. Game respawns the player at the shrine.

## Yaw conventions
Camera and player use different conventions; the Game bridges them.
- **Camera** (`ThirdPersonCamera.yaw`): `yaw = 0` looks toward −Z (Three.js default). Forward = `(−sin yaw, −cos yaw)`,
  right = `(cos yaw, −sin yaw)`. Mouse right decreases yaw. Pass `ThirdPersonCamera.yaw` as `cameraYaw`.
  `playerMovement.movementIntent` computes `dir = forward·moveZ + right·moveX` (then normalised).
- **Player facing** (`state.yaw`): facing = `(sin yaw, cos yaw)`, so `yaw = 0` faces +Z. `Player.update` sets
  `object.rotation.y = state.yaw`, which matches because the mesh's front is built along local +Z.
- **Bridge:** at spawn the Game sets the player's yaw to `atan2(exitDirection.x, exitDirection.z)` (faces the exit) and the
  camera's `initialYaw` to that value **+ π**, so the camera looks the same way.
- `WORLD.spawn` only records the shrine centre. The actual spawn point is `shrine.userData.spawn` (12 m inside the closed end).

## Rust / WebAssembly
Rust is not used yet. A proposal to move hot paths (terrain sampling, vegetation scatter) to Rust compiled to
WebAssembly is in [docs/RUST_PLAN.md](RUST_PLAN.md). It is not implemented and needs the owner's approval
(engineering rule 5).
