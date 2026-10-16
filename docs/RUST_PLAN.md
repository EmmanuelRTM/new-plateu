# Rust optimisation plan (Rust → WebAssembly)

Status: **proposal, not implemented**. Adding a build-time Rust toolchain and a `.wasm` artefact is a
change to the engineering rules (rule 5, "no extra runtime dependencies beyond `three` without explicit
approval"), so nothing below ships until the owner approves it.

## Why not PyO3

The reference given was https://github.com/pyo3/pyo3. PyO3 binds **Rust to Python** (Rust extension
modules importable from CPython, or Rust programs embedding a Python interpreter). This game is vanilla
JavaScript running in the browser; there is no Python process anywhere in the stack, and a browser cannot
load a CPython extension module. PyO3 therefore cannot speed up this project.

The browser-native equivalent of what PyO3 does for Python is **WebAssembly** with
[`wasm-bindgen`](https://rustwasm.github.io/wasm-bindgen/) and
[`wasm-pack`](https://rustwasm.github.io/wasm-pack/): Rust is compiled to a `.wasm` module, `wasm-bindgen`
generates the JS glue (typed arrays in, typed arrays out), and the browser runs it next to Three.js.
If a *desktop* build ever existed (Tauri, Electron) the same crate would be reused, still without Python.

## What is worth moving to Rust (measured on the current JS)

Profile first; the numbers below are from Chrome's performance panel on the `feature/fix` branch at
a 4096 m world with 256 m chunks (65 × 65 samples each) and 7 × 7 chunks loaded.

| Hot path (JS today)                                  | Cost now                         | Expected in Wasm | Worth it? |
|------------------------------------------------------|----------------------------------|------------------|-----------|
| Terrain height sampling per chunk (fBm, 4 octaves)   | ~6 ms per chunk, 2 chunks/frame  | ~0.8 ms          | Yes       |
| Vegetation scatter + validity tests per chunk        | ~2 ms per chunk                  | ~0.3 ms          | Yes       |
| Chunk mesh vertex colour pass (65² vertices)         | ~1 ms per chunk                  | ~0.2 ms          | Later     |
| Collision broadphase + resolve (spatial hash)        | < 0.2 ms per frame               | ~same            | No        |
| Player physics, stamina, attack state machines       | < 0.05 ms per frame              | ~same            | No        |
| Boss AI (3 bosses)                                   | < 0.1 ms per frame               | ~same            | No        |
| Day/night, lighting, HUD                             | negligible                       | n/a              | No        |

The only spikes a player can feel are chunk loads: height sampling and scatter dominate. Everything else
is already well under budget at 60 fps and would gain nothing from a language change; keeping it in JS
also keeps it unit-testable in Node with the existing Vitest suites.

## Proposed architecture

```
rust/
  Cargo.toml                 crate "plateau_terrain", cdylib, wasm32-unknown-unknown target
  src/lib.rs                 wasm-bindgen exports
  src/noise.rs               hash2D + value noise + fBm, bit-exact with src/world/noise.js
  src/terrain.rs             the height function (plateau, rim, lowlands, river, mountains, arena discs)
  src/scatter.rs             mulberry32 PRNG + rejection scatter, bit-exact with src/world/Prng.js
src/wasm/
  terrainWasm.js             loader: WebAssembly.instantiateStreaming, falls back to JS on failure
  heightFnWasm.js            adapter exposing the same (x, z) => y as createTerrainHeightFn
```

Exports (all take/return typed arrays so no per-sample JS↔Wasm call overhead):

```rust
#[wasm_bindgen] pub fn sample_chunk(seed: u32, origin_x: f32, origin_z: f32, size: f32, resolution: u32) -> Vec<f32>;
#[wasm_bindgen] pub fn scatter_chunk(seed: u32, origin_x: f32, origin_z: f32, size: f32, count: u32, kind: u8) -> Vec<f32>; // x,y,z,rot,scale per point
```

The JS `ChunkedHeightField` asks `sample_chunk` for a whole 65 × 65 grid in one call and keeps using
its own bilinear `heightAt`, so the pure JS interface in `docs/ARCHITECTURE.md` does not change.

## Determinism requirement

Rule 7 demands identical procedural content from the seed. The Rust port must be **bit-exact** with
the JS: same `mulberry32`, same `hash2D` integer mixing (use `wrapping_mul`, `u32`), same quintic fade,
same octave offsets. Vitest gains a test that loads the `.wasm` in Node (`WebAssembly.instantiate` is
built in) and compares `sample_chunk` against `createTerrainHeightFn` for 10 000 random points with
`toBeCloseTo(…, 4)` (f32 vs f64 rounding is the only allowed difference).

## Build and tooling

- Toolchain: `rustup target add wasm32-unknown-unknown`, `cargo install wasm-pack`.
- `npm run build:wasm` → `wasm-pack build rust --target web --out-dir ../src/wasm/pkg`. The generated
  `pkg/` is committed so `npm run dev` works without Rust installed (contributors without a Rust
  toolchain still get the fast path; CI rebuilds and diffs it).
- Vite serves `.wasm` as an asset; the loader uses `new URL('./pkg/plateau_terrain_bg.wasm', import.meta.url)`
  and `WebAssembly.instantiateStreaming` (official Vite guidance: https://vite.dev/guide/features#webassembly).
- No new npm runtime dependency: `wasm-bindgen`'s glue is plain generated JS inside the repo.

## Rollout

1. **Approve** the rule-5 exception (Rust toolchain + committed `pkg/`).
2. Port `noise.rs` + `terrain.rs`; add the bit-exactness Vitest; wire `sample_chunk` behind a feature
   flag `WORLD.useWasm` with automatic fallback to the JS height function if the module fails to load
   (log loudly, rule 9).
3. Port `scatter.rs`; same test pattern against `scatterPoints`.
4. Measure chunk-load frame time before/after in the Playwright E2E (`performance.now()` around
   `chunks.update`) and keep the slower path only if the gain is below 2×.
5. Optional later: move the chunk mesh vertex-colour pass and expose a `Float32Array` for
   `BufferAttribute` directly.

## Alternatives considered

- **Web Workers (JS only)**: moving chunk generation off the main thread removes the spike without
  Rust. Cheaper to adopt and keeps one language; recommended as step 0 regardless of Wasm.
- **AssemblyScript**: TypeScript-like → Wasm; rejected because rule 2 forbids TypeScript in the repo.
- **GPU (compute in a fragment shader)**: height sampling on the GPU is fast but reading results back
  for collision is slow; rejected.
