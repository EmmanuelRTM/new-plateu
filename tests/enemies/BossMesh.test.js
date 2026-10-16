import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createBossMesh } from '../../src/enemies/BossMesh.js';
import { BOSSES } from '../../src/enemies/bossCatalog.js';
import { BOSS_PHASES } from '../../src/enemies/bossAi.js';

const IDS = ['talus', 'hinox', 'flux'];
const DT = 1 / 60;

/** Flattens position, rotation and scale of every descendant into one numeric array. */
function signature(object) {
  const out = [];
  object.traverse((node) => {
    out.push(node.position.x, node.position.y, node.position.z);
    out.push(node.rotation.x, node.rotation.y, node.rotation.z);
    out.push(node.scale.x, node.scale.y, node.scale.z);
  });
  return out;
}

/** Runs one update with the given phase for `seconds`, in fixed steps. */
function runPhase(mesh, def, phase, seconds) {
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i += 1) mesh.update({ phase, t: i * DT, def, dt: DT });
}

describe.each(IDS)('createBossMesh(%s)', (id) => {
  const def = BOSSES[id];

  it('builds a Group with visible meshes', () => {
    const { object } = createBossMesh(def);
    expect(object).toBeInstanceOf(THREE.Group);
    let meshes = 0;
    object.traverse((node) => { if (node.isMesh) meshes += 1; });
    expect(meshes).toBeGreaterThan(5);
  });

  it('casts shadows from every mesh', () => {
    const { object } = createBossMesh(def);
    object.traverse((node) => { if (node.isMesh) expect(node.castShadow).toBe(true); });
  });

  it('keeps all transforms finite across every phase', () => {
    const mesh = createBossMesh(def);
    for (const phase of BOSS_PHASES) {
      runPhase(mesh, def, phase, 0.5);
    }
    for (const value of signature(mesh.object)) expect(Number.isFinite(value)).toBe(true);
  });

  it('is deterministic: two builds share one pose signature', () => {
    const a = createBossMesh(def);
    const b = createBossMesh(def);
    expect(signature(a.object)).toEqual(signature(b.object));
    runPhase(a, def, 'chase', 0.3);
    runPhase(b, def, 'chase', 0.3);
    expect(signature(a.object)).toEqual(signature(b.object));
  });

  it('collapses after setDead and keeps animating', () => {
    const mesh = createBossMesh(def);
    runPhase(mesh, def, 'chase', 0.2);
    const alive = signature(mesh.object);
    mesh.setDead();
    runPhase(mesh, def, 'dead', 1.5);
    expect(signature(mesh.object)).not.toEqual(alive);
  });

  it('collapses on its own when update receives phase dead', () => {
    const mesh = createBossMesh(def);
    const alive = signature(mesh.object);
    runPhase(mesh, def, 'dead', 1.5);
    expect(signature(mesh.object)).not.toEqual(alive);
  });

  it('plays strike and stagger poses without throwing', () => {
    const mesh = createBossMesh(def);
    runPhase(mesh, def, 'windup', def.windupSeconds);
    runPhase(mesh, def, 'strike', def.strikeSeconds);
    runPhase(mesh, def, 'stagger', def.staggerSeconds);
    expect(signature(mesh.object).every(Number.isFinite)).toBe(true);
  });
});

describe('createBossMesh specifics', () => {
  it('hinox falls over to -PI/2 about X within one second of death', () => {
    const def = BOSSES.hinox;
    const mesh = createBossMesh(def);
    mesh.setDead();
    runPhase(mesh, def, 'dead', 1.0);
    const rig = mesh.object.getObjectByName('boss-rig');
    expect(rig.rotation.x).toBeCloseTo(-Math.PI / 2, 2);
  });

  it('hinox stays upright while alive', () => {
    const def = BOSSES.hinox;
    const mesh = createBossMesh(def);
    runPhase(mesh, def, 'chase', 0.5);
    expect(mesh.object.getObjectByName('boss-rig').rotation.x).toBeCloseTo(0, 10);
  });

  it('flux builds 27 core cubes plus a glowing centre cube', () => {
    const mesh = createBossMesh(BOSSES.flux);
    const cubes = mesh.object.getObjectByName('cubes');
    expect(cubes.children.filter((c) => /^cube-\d+$/.test(c.name)).length).toBe(27);
    const core = mesh.object.getObjectByName('cube-13');
    expect(core.material.emissiveIntensity).toBeGreaterThan(0);
  });

  it('rejects an unknown boss id', () => {
    expect(() => createBossMesh({ id: 'ganon', colours: {} })).toThrow(/unknown boss/i);
  });
});
