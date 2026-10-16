# new-plateu — engineering rules

Open-world browser prototype inspired by the *opening* of The Legend of Zelda: Breath of the Wild
(waking in the Shrine of Resurrection, stepping out onto the Great Plateau). Vanilla JavaScript
ES modules + Three.js, bundled with Vite. No framework, no TypeScript.

Read `docs/ARCHITECTURE.md` before touching code. It is the contract between modules.

## Hard rules
1. **≤ 500 lines per file.** `npm run lint:size` must pass. Split rather than cram.
2. **SOLID, modular.** One responsibility per module. Pure logic (math, state machines, placement)
   lives in modules with **no Three.js or DOM imports** so it is unit-testable in Node.
   Three.js/DOM adapters wrap the pure modules.
3. **Official sources only.** Three.js: https://threejs.org/docs/ and https://threejs.org/manual/ ,
   addons import path `three/addons/...`. Vite: https://vite.dev/guide/ . Vitest: https://vitest.dev/ .
   Playwright: https://playwright.dev/docs/ . Do not copy code from random blog posts or tutorials.
4. **TDD + E2E.** Write the Vitest test first for every pure module, then implement. Tests live in
   `tests/` mirroring `src/`. DOM tests opt in with `// @vitest-environment jsdom` at file top.
   End-to-end tests (Playwright) live in `e2e/`.
5. **Native implementation.** Browser-native APIs (Pointer Lock, requestAnimationFrame, Canvas/SVG for
   HUD). No extra runtime dependencies beyond `three` without explicit approval.
6. **Scope.** Work only inside this repository. Never read or reference other repositories.
7. **Determinism.** All procedural content uses the seeded PRNG in `src/world/Prng.js`, never `Math.random`.
8. **Units.** 1 unit = 1 metre. Y is up. World is centred on the origin.
9. **No silent failures.** Do not swallow errors in try/catch. Fail loudly in dev.
10. **JSDoc** every exported function/class with param and return types.

## Commands
- `npm run dev` — Vite dev server at http://127.0.0.1:5173
- `npm test` — Vitest unit tests
- `npm run test:e2e` — Playwright E2E (starts dev server itself)
- `npm run lint:size` — enforce the 500-line cap
- `npm run build` — production build

## Definition of done for any task
`npm test` green, `npm run lint:size` green, `npm run build` succeeds, and the module matches the
interface in `docs/ARCHITECTURE.md`. Report exactly which files you created/changed.
