import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { createBossManager } from '../../src/enemies/BossManager.js';
import { BOSSES } from '../../src/enemies/bossCatalog.js';

const DT = 1 / 60;
const ARENAS = [
  { id: 'talus', name: 'Talus Hollow', x: 300, z: 250, radius: 40, y: 48 },
  { id: 'hinox', name: 'Hinox Grove', x: -280, z: -240, radius: 45, y: 52 },
  { id: 'flux', name: 'Flux Construct Rise', x: 1100, z: -900, radius: 50, y: 34 },
];
const heightAt = (x, z) => 10 + (x + z) * 0.001;
const FAR = { x: 1e5, y: 0, z: 1e5 };

describe('createBossManager', () => {
  let scene;
  let manager;
  beforeEach(() => {
    scene = new THREE.Scene();
    manager = createBossManager({ scene, arenas: ARENAS, heightAt });
  });

  it('spawns one boss per arena, matched by id, and adds them to the scene', () => {
    expect(manager.bosses).toHaveLength(3);
    expect(manager.bosses.map((b) => b.def.id)).toEqual(['talus', 'hinox', 'flux']);
    for (const boss of manager.bosses) {
      expect(scene.children).toContain(boss.object);
      expect(boss.state.position.x).toBe(boss.arena.x);
      expect(boss.state.position.z).toBe(boss.arena.z);
    }
  });

  it('throws when an arena has no boss definition', () => {
    const scene2 = new THREE.Scene();
    expect(() => createBossManager({
      scene: scene2,
      arenas: [{ id: 'ganon', name: 'X', x: 0, z: 0, radius: 10, y: 0 }],
      heightAt,
    })).toThrow(/ganon/);
  });

  it('a far player produces no strike hits and leaves bosses dormant', () => {
    let hits = 0;
    for (let i = 0; i < 600; i += 1) hits += manager.update(FAR, DT).playerHits.length;
    expect(hits).toBe(0);
    expect(manager.bosses.every((b) => b.state.phase === 'dormant')).toBe(true);
    expect(manager.activeBoss()).toBeNull();
  });

  it('a player inside aggro range engages that boss after some steps', () => {
    const talus = manager.bosses[0];
    const player = { x: talus.arena.x + 10, y: 48, z: talus.arena.z };
    for (let i = 0; i < 120; i += 1) manager.update(player, DT);
    expect(talus.engaged).toBe(true);
    expect(manager.activeBoss()).toBe(talus);
  });

  it('a player standing in melee range eventually takes strike damage, once per strike', () => {
    const talus = manager.bosses[0];
    const x = talus.arena.x + 3;
    const player = { x, y: heightAt(x, talus.arena.z), z: talus.arena.z };
    let damageHearts = 0;
    let strikes = 0;
    let previousPhase = talus.state.phase;
    for (let i = 0; i < 60 * 15; i += 1) {
      const { playerHits } = manager.update(player, DT);
      for (const hit of playerHits) {
        expect(hit.bossId).toBe('talus');
        damageHearts += hit.damageHearts;
      }
      if (talus.state.phase === 'strike' && previousPhase !== 'strike') strikes += 1;
      previousPhase = talus.state.phase;
    }
    expect(strikes).toBeGreaterThan(0);
    expect(damageHearts).toBeCloseTo(BOSSES.talus.damageHearts * strikes, 6);
  });

  it('applyPlayerHitbox damages a boss in reach and returns only hits', () => {
    const talus = manager.bosses[0];
    const { x, z } = talus.state.position;
    const hitbox = { x, z, radius: 1, yMin: heightAt(x, z), yMax: heightAt(x, z) + 2, damage: 20 };
    const hits = manager.applyPlayerHitbox(hitbox);
    expect(hits).toEqual([{ bossId: 'talus', damage: 20, dead: false, staggered: false }]);
    expect(talus.state.health.value).toBe(BOSSES.talus.hp - 20);
  });

  it('applyPlayerHitbox reports an empty array when nothing is in reach', () => {
    const hitbox = { x: 0, z: 0, radius: 1, yMin: 0, yMax: 5, damage: 20 };
    expect(manager.applyPlayerHitbox(hitbox)).toEqual([]);
  });

  it('colliders lists living bosses only, keyed by id', () => {
    const talus = manager.bosses[0];
    expect(manager.colliders().map((c) => c.id).sort()).toEqual(['flux', 'hinox', 'talus']);
    talus.state.health.damage(BOSSES.talus.hp);
    talus.state.phase = 'dead';
    const live = manager.colliders();
    expect(live.map((c) => c.id)).not.toContain('talus');
    expect(live[0].collider.kind).toBe('circle');
  });

  it('activeBoss returns the nearest engaged boss to the last known player position', () => {
    const hinox = manager.bosses[1];
    const near = { x: hinox.arena.x + 10, y: 0, z: hinox.arena.z };
    for (let i = 0; i < 90; i += 1) manager.update(near, DT);
    expect(manager.activeBoss()).toBe(hinox);
  });

  it('dispose removes every boss from the scene', () => {
    manager.dispose();
    for (const boss of manager.bosses) expect(scene.children).not.toContain(boss.object);
  });
});
