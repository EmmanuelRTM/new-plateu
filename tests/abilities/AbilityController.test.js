import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { AbilityController } from '../../src/abilities/AbilityController.js';
import { createPrng } from '../../src/world/Prng.js';
import { WORLD } from '../../src/world/WorldConfig.js';
import { boxCollider } from '../../src/physics/colliders.js';
import { createProp } from '../../src/world/props/props.js';

const DT = 1 / 60;
const CAMERA = { yaw: 0, pitch: 0 };
const FORWARD = { x: 0, y: 0, z: -1 };

/** A fake InputState with every ability flag false. */
function input(overrides = {}) {
  return {
    moveX: 0,
    moveZ: 0,
    jump: false,
    sprint: false,
    abilityPressed: false,
    abilityCyclePressed: false,
    cancelPressed: false,
    ...overrides,
  };
}

/** Player standing at the origin. */
function playerAt(x = 0, y = 0, z = 0) {
  return { position: { x, y, z } };
}

/** Builds a controller on flat ground, with a fixed seed. */
function setup(extra = {}) {
  const scene = new THREE.Scene();
  const controller = new AbilityController({
    scene,
    config: WORLD,
    heightAt: () => 0,
    prng: createPrng(WORLD.seed),
    gravity: WORLD.gravity,
    ...extra,
  });
  return { scene, controller };
}

/** Finds a prop by id from the controller. */
function prop(controller, id) {
  const p = controller.props.find((q) => q.id === id);
  if (!p) throw new Error(`no prop ${id}`);
  return p;
}

/** Runs one frame with no input. */
function idle(controller, player = playerAt(), opts = {}) {
  return controller.update(input(), player, CAMERA, DT, opts);
}

/** Removes every existing prop and adds exactly the given ones, for predictable tests. */
function useOnly(controller, props) {
  controller.props.splice(0, controller.props.length, ...props);
}

describe('AbilityController construction', () => {
  it('adds one props group to the scene', () => {
    const { scene } = setup();
    expect(scene.children.some((c) => c.name === 'Props')).toBe(true);
  });

  it('places all props on the terrain height', () => {
    const { controller } = setup({ heightAt: () => 7 });
    expect(controller.props.length).toBe(23);
    for (const p of controller.props) expect(p.position.y).toBe(7);
  });

  it('starts on Ultrahand with no message', () => {
    const { controller } = setup();
    expect(controller.state.selected).toBe('ultrahand');
    expect(controller.state.active).toBeNull();
  });

  it('throws when given no scene', () => {
    expect(() => new AbilityController({ config: WORLD, heightAt: () => 0, prng: createPrng(1), gravity: 28 }))
      .toThrow();
  });

  it('throws when heightAt is not a function', () => {
    expect(() => new AbilityController({
      scene: new THREE.Scene(), config: WORLD, heightAt: null, prng: createPrng(1), gravity: 28,
    })).toThrow(/heightAt/);
  });
});

describe('cycling', () => {
  it('moves the selection on abilityCyclePressed and reports the new ability message', () => {
    const { controller } = setup();
    controller.update(input({ abilityCyclePressed: true }), playerAt(), CAMERA, DT, {});
    expect(controller.state.selected).toBe('fuse');
  });

  it('ignores cycling while an action is in progress', () => {
    const { controller } = setup();
    useOnly(controller, [createProp({ id: 'c', kind: 'crate', x: 0, y: 0, z: -3 })]);
    idle(controller);
    controller.update(input({ abilityPressed: true }), playerAt(), CAMERA, DT, {});
    controller.update(input({ abilityCyclePressed: true }), playerAt(), CAMERA, DT, {});
    expect(controller.state.selected).toBe('ultrahand');
  });
});

describe('Ultrahand', () => {
  let controller;
  beforeEach(() => {
    ({ controller } = setup());
    useOnly(controller, [createProp({ id: 'box', kind: 'crate', x: 0, y: 0, z: -3 })]);
  });

  it('shows a grab message when a prop is in reach', () => {
    const r = idle(controller);
    expect(r.message).toBe('Ultrahand: grab (F)');
  });

  it('shows a helpful message when nothing is in reach', () => {
    useOnly(controller, []);
    expect(idle(controller).message).toBe('Ultrahand: nothing in reach');
  });

  it('grabs the target on abilityPressed and carries it toward the aim point', () => {
    controller.update(input({ abilityPressed: true }), playerAt(), CAMERA, DT, {});
    expect(prop(controller, 'box').held).toBe(true);
    expect(controller.state.active).toEqual({ ability: 'ultrahand', propId: 'box' });
    for (let i = 0; i < 300; i += 1) idle(controller);
    expect(prop(controller, 'box').position.z).toBeCloseTo(-3.5, 2);
  });

  it('glues the carried prop to a touching prop on the second press', () => {
    controller.update(input({ abilityPressed: true }), playerAt(), CAMERA, DT, {});
    for (let i = 0; i < 300; i += 1) idle(controller);
    useOnly(controller, [
      prop(controller, 'box'),
      createProp({ id: 'anchor', kind: 'boulder', x: 1.2, y: 0, z: -3.5 }),
    ]);
    controller.update(input({ abilityPressed: true }), playerAt(), CAMERA, DT, {});
    expect(prop(controller, 'box').held).toBe(false);
    expect(prop(controller, 'box').attachedTo).toBe('anchor');
    expect(controller.state.active).toBeNull();
  });

  it('drops the carried prop without gluing on cancel', () => {
    controller.update(input({ abilityPressed: true }), playerAt(), CAMERA, DT, {});
    controller.update(input({ cancelPressed: true }), playerAt(), CAMERA, DT, {});
    expect(prop(controller, 'box').held).toBe(false);
    expect(prop(controller, 'box').attachedTo).toBeNull();
    expect(controller.state.active).toBeNull();
  });

  it('shows the carrying message while holding', () => {
    controller.update(input({ abilityPressed: true }), playerAt(), CAMERA, DT, {});
    expect(idle(controller).message).toContain('F to glue down');
  });

  it('highlights the target in the scene', () => {
    const { scene, controller: c } = setup();
    useOnly(c, [createProp({ id: 'box', kind: 'crate', x: 0, y: 0, z: -3 })]);
    idle(c);
    const group = scene.getObjectByName('prop:box');
    const body = group.children.find((n) => n.isMesh && n.name !== 'glue');
    expect(body.material.emissive.getHex()).not.toBe(0);
  });

  it('gravity acts on a dropped prop until it lands', () => {
    const p = prop(controller, 'box');
    p.position.y = 5;
    p.position.z = -3;
    for (let i = 0; i < 120; i += 1) idle(controller);
    expect(p.position.y).toBeCloseTo(0, 1);
  });
});

describe('Fuse', () => {
  let controller;
  beforeEach(() => {
    ({ controller } = setup());
    controller.state.selected = 'fuse';
    useOnly(controller, [createProp({ id: 'box', kind: 'boulder', x: 0, y: 0, z: -3 })]);
  });

  it('shows the fuse bonus of the target when an item is equipped', () => {
    const r = idle(controller, playerAt(), { equippedItem: { id: 'traveler-sword', durability: 22, maxDurability: 22 } });
    expect(r.message).toBe('Fuse: Boulder +6 (F)');
  });

  it('asks for a weapon when nothing is equipped', () => {
    expect(idle(controller).message).toBe('Fuse: equip a weapon first');
  });

  it('consumes the prop and fuses it into the equipped item', () => {
    const item = { id: 'traveler-sword', durability: 22, maxDurability: 22 };
    const r = controller.update(input({ abilityPressed: true }), playerAt(), CAMERA, DT, { equippedItem: item });
    expect(r.fused).toBe(true);
    expect(item.fused).toEqual({ kind: 'boulder', bonus: 6 });
    expect(item.durability).toBe(22 + 25);
    expect(controller.props.find((p) => p.id === 'box')).toBeUndefined();
    expect(r.propColliders.find((pc) => pc.id === 'box')).toBeUndefined();
  });

  it('does not fuse twice into the same item', () => {
    const item = { id: 'traveler-sword', durability: 22, maxDurability: 22, fused: { kind: 'crate', bonus: 3 } };
    const r = controller.update(input({ abilityPressed: true }), playerAt(), CAMERA, DT, { equippedItem: item });
    expect(r.fused).toBe(false);
    expect(controller.props.find((p) => p.id === 'box')).toBeDefined();
    expect(r.message).toBe('Fuse: weapon already fused');
  });

  it('reports no fuse when nothing is in reach', () => {
    useOnly(controller, []);
    const item = { id: 'traveler-sword', durability: 22, maxDurability: 22 };
    const r = controller.update(input({ abilityPressed: true }), playerAt(), CAMERA, DT, { equippedItem: item });
    expect(r.fused).toBe(false);
    expect(item.fused).toBeUndefined();
  });

  it('keeps props that were glued to a fused prop, freeing them', () => {
    const child = createProp({ id: 'kid', kind: 'crate', x: 1, y: 0, z: -3 });
    child.attachedTo = 'box';
    child.attachOffset = { x: 1, y: 0, z: 0 };
    useOnly(controller, [prop(controller, 'box'), child]);
    controller.update(input({ abilityPressed: true }), playerAt(), CAMERA, DT,
      { equippedItem: { id: 'traveler-sword', durability: 22, maxDurability: 22 } });
    expect(prop(controller, 'kid').attachedTo).toBeNull();
  });
});

describe('Ascend', () => {
  const ceiling = boxCollider({ x: 0, z: 0, halfX: 3, halfZ: 15, yaw: 0, yMin: 5, yMax: 5.6 });
  let controller;
  beforeEach(() => {
    ({ controller } = setup());
    controller.state.selected = 'ascend';
  });

  it('reports no ceiling when nothing is above', () => {
    const r = idle(controller, playerAt(), { colliders: [] });
    expect(r.message).toBe('Ascend: no ceiling above');
    expect(r.ascendPosition).toBeNull();
  });

  it('announces the rise when a ceiling is above', () => {
    expect(idle(controller, playerAt(), { colliders: [ceiling] }).message).toBe('Ascend: rise (F)');
  });

  it('returns a rising position each frame until it lands on the ceiling', () => {
    const player = playerAt();
    const first = controller.update(input({ abilityPressed: true }), player, CAMERA, 0.1,
      { colliders: [ceiling] });
    expect(first.ascendPosition.y).toBeGreaterThan(0);
    const positions = [first.ascendPosition];
    for (let i = 0; i < 30; i += 1) {
      const r = controller.update(input(), player, CAMERA, 0.1, { colliders: [ceiling] });
      positions.push(r.ascendPosition);
    }
    const landed = positions.filter((p) => p !== null);
    expect(landed[landed.length - 1].y).toBeCloseTo(5.8, 6);
    expect(positions[positions.length - 1]).toBeNull();
    expect(controller.state.active).toBeNull();
  });

  it('uses extra surfaces such as the shrine corridor ceiling', () => {
    const r = controller.update(input({ abilityPressed: true }), playerAt(), CAMERA, DT,
      { colliders: [], extraSurfaces: [ceiling] });
    expect(r.ascendPosition).not.toBeNull();
  });
});

describe('Recall', () => {
  let controller;
  beforeEach(() => {
    ({ controller } = setup());
    controller.state.selected = 'recall';
    useOnly(controller, [createProp({ id: 'box', kind: 'crate', x: -0.5, y: 0, z: -3 })]);
  });

  /** Moves the crate from x = -0.5 to x = 0.5 over two seconds so it has a history. */
  function driveCrate() {
    const p = prop(controller, 'box');
    for (let i = 0; i <= 120; i += 1) {
      p.position.x = -0.5 + i / 120;
      idle(controller);
    }
  }

  it('says there is nothing to rewind before the object has moved', () => {
    expect(idle(controller).message).toBe('Recall: nothing to rewind');
  });

  it('rewinds the target along its recorded path', () => {
    driveCrate();
    expect(idle(controller).message).toBe('Recall: rewind (F)');
    controller.update(input({ abilityPressed: true }), playerAt(), CAMERA, DT, {});
    const p = prop(controller, 'box');
    expect(p.held).toBe(true);
    expect(controller.state.active).toEqual({ ability: 'recall', propId: 'box' });
    for (let i = 0; i < 20; i += 1) idle(controller);
    expect(p.position.x).toBeLessThan(0.5);
  });

  it('releases the prop when the rewind finishes', () => {
    driveCrate();
    controller.update(input({ abilityPressed: true }), playerAt(), CAMERA, DT, {});
    for (let i = 0; i < 600; i += 1) idle(controller);
    const p = prop(controller, 'box');
    expect(p.held).toBe(false);
    expect(p.recall).toBeUndefined();
    expect(controller.state.active).toBeNull();
    expect(p.position.x).toBeCloseTo(-0.5, 1);
  });

  it('stops a rewind on cancel', () => {
    driveCrate();
    controller.update(input({ abilityPressed: true }), playerAt(), CAMERA, DT, {});
    controller.update(input({ cancelPressed: true }), playerAt(), CAMERA, DT, {});
    const p = prop(controller, 'box');
    expect(p.held).toBe(false);
    expect(p.recall).toBeUndefined();
    expect(controller.state.active).toBeNull();
  });
});

describe('frame outputs', () => {
  it('returns a propColliders entry for every prop', () => {
    const { controller } = setup();
    const r = idle(controller);
    expect(r.propColliders).toHaveLength(controller.props.length);
    for (const { id, collider } of r.propColliders) {
      expect(typeof id).toBe('string');
      expect(collider.kind).toBe('circle');
    }
  });

  it('returns fused false and ascendPosition null on an ordinary frame', () => {
    const { controller } = setup();
    const r = idle(controller);
    expect(r.fused).toBe(false);
    expect(r.ascendPosition).toBeNull();
  });
});

describe('dispose', () => {
  it('removes the props group from the scene', () => {
    const { scene, controller } = setup();
    controller.dispose();
    expect(scene.children.some((c) => c.name === 'Props')).toBe(false);
  });
});

