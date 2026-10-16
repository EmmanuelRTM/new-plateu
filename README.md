# New Plateau

A browser prototype inspired by the opening of *The Legend of Zelda: Breath of the Wild*. You wake
in the Shrine of Resurrection, walk out onto the Great Plateau, and then explore a streamed 4096 m
world: lowlands and a river beyond the plateau, a mountain ring at the edge, weapons to find and
three boss arenas to fight.

Built with vanilla JavaScript (ES modules), [Three.js](https://threejs.org/) and
[Vite](https://vite.dev/). No framework, no TypeScript.

## Features

- Streamed 4096 m world: chunked terrain and vegetation around the player, a low-detail far terrain
  on the horizon, the Great Plateau with a cliff rim, lowlands with a meandering river, and a
  mountain ring at the edge.
- Collision with trees, rocks, the Temple of Time, boss bodies and the shrine corridor.
- Movement with sprint, jump and a paraglider glide, all drawing on stamina.
- Weapons and inventory inspired by *Tears of the Kingdom*: nine slots, swords, claymores, spears,
  bows and shields, durability that breaks weapons, three-hit combos, and a guard with shields.
- Three bosses (Stone Talus, Hinox, Flux Construct I), each with its own phases and health bar.
- A circular minimap and a full-screen world map with landmark and boss markers.
- Day and night with a sun, a moon, stars, a sky dome and fog.
- Procedural textures for terrain, rock, soil and water, all from a seeded PRNG so the world is
  deterministic.

## Controls

| Action          | Input                                                   |
|-----------------|---------------------------------------------------------|
| Start           | Any key (or click the intro screen)                     |
| Look around     | Click the game to lock the mouse, then move it          |
| Move            | `W` `A` `S` `D` or arrow keys                           |
| Sprint          | Hold `Shift` (drains stamina)                           |
| Jump            | `Space`                                                 |
| Glide           | Jump, then hold `Space` while falling (drains stamina)  |
| Attack          | Left mouse button                                       |
| Guard           | Hold right mouse button (raises the shield)             |
| Weapon menu     | `Tab`                                                   |
| Select slot     | `1` to `9`                                              |
| Cycle weapon    | `Q` / `R` or the mouse wheel                            |
| World map       | `M`                                                     |

## Getting started

Requires Node.js 20 or newer.

```sh
npm install
npm run dev        # dev server at http://127.0.0.1:5173
```

## Scripts

| Command             | What it does                                   |
|---------------------|------------------------------------------------|
| `npm run dev`       | Vite dev server with hot reload                |
| `npm test`          | Vitest unit tests (`tests/`, mirrors `src/`)   |
| `npm run test:e2e`  | Playwright end-to-end tests (`e2e/`); starts the dev server itself |
| `npm run lint:size` | Fails if any source or test file exceeds 500 lines |
| `npm run build`     | Production build into `dist/`                  |
| `npm run preview`   | Serves the production build locally            |

The first E2E run needs the Chromium binary: `npx playwright install chromium`.

## Project layout

```
src/     game code: core loop, physics, items and combat, enemies, world, environment, player, camera, UI, styles
tests/   Vitest unit tests, mirroring src/
e2e/     Playwright specs (intro, gameplay, world, weapons, boss, map, day/night)
docs/    ARCHITECTURE.md (module contract, scene goals) and RUST_PLAN.md (WebAssembly proposal)
```

Pure logic (physics, stamina, inventory, boss AI, terrain math) has no Three.js or DOM imports, so it
is unit tested in Node. Three.js and DOM code wrap those modules.

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the module interfaces, the scene goals,
the yaw conventions and the event names. Engineering rules are in [CLAUDE.md](CLAUDE.md).
