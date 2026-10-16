# New Plateau

A browser prototype inspired by the opening of *The Legend of Zelda: Breath of the Wild*. You wake
in the Shrine of Resurrection, walk out into the Great Plateau, and explore rolling hills, trees,
rocks, a lake and the Temple of Time ruins on the horizon.

Built with vanilla JavaScript (ES modules), [Three.js](https://threejs.org/) and
[Vite](https://vite.dev/). No framework, no TypeScript.

## Controls

| Action        | Input                                   |
|---------------|-----------------------------------------|
| Start         | Any key (or click the intro screen)     |
| Look around   | Click the game to lock the mouse, then move it |
| Move          | `W` `A` `S` `D` or arrow keys           |
| Sprint        | Hold `Shift` (drains stamina)           |
| Jump          | `Space`                                 |
| Glide         | Jump, then hold `Space` while falling (drains stamina) |

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
src/     game code: core loop, world generation, player, camera, UI, styles
tests/   Vitest unit tests, mirroring src/
e2e/     Playwright specs (intro, gameplay)
docs/    ARCHITECTURE.md: the module contract and scene goals
```

Pure logic (physics, stamina, terrain math) has no Three.js or DOM imports, so it is unit tested
in Node. Three.js and DOM code wrap those modules.

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the module interfaces, the scene goals,
the yaw conventions and the event names. Engineering rules are in [CLAUDE.md](CLAUDE.md).
