import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createPropMeshes } from '../../../src/world/props/PropMeshes.js';
import { createProp } from '../../../src/world/props/props.js';

/** Returns every Mesh under an object, including the object itself when it is a mesh. */
function meshesOf(object) {
  const out = [];
  object.traverse((node) => {
    if (node.isMesh) out.push(node);
  });
  return out;
}

/** Finds the top-level group for one prop by its name. */
function groupFor(object, id) {
  return object.children.find((c) => c.name === `prop:${id}`);
}

/** The main body mesh of a prop group (the first child that is a Mesh and not a glue sphere). */
function bodyOf(group) {
  return group.children.find((c) => c.isMesh && c.name !== 'glue');
}

describe('createPropMeshes', () => {
  it('returns a Group and a sync function', () => {
    const handle = createPropMeshes([]);
    expect(handle.object).toBeInstanceOf(THREE.Group);
    expect(typeof handle.sync).toBe('function');
    expect(handle.object.children).toHaveLength(0);
  });

  it('creates one group per prop, each with a body mesh that casts shadows', () => {
    const props = [
      createProp({ id: 'b', kind: 'boulder', x: 0, y: 0, z: 0 }),
      createProp({ id: 'c', kind: 'crate', x: 5, y: 0, z: 0 }),
      createProp({ id: 'w', kind: 'zonaiWheel', x: 9, y: 0, z: 0 }),
    ];
    const handle = createPropMeshes(props);
    handle.sync(props, { highlightId: null });
    expect(handle.object.children).toHaveLength(3);
    for (const p of props) {
      const body = bodyOf(groupFor(handle.object, p.id));
      expect(body).toBeDefined();
      expect(body.castShadow).toBe(true);
    }
  });

  it('uses a wood colour for crates and a teal colour with a green emissive rim for Zonai wheels', () => {
    const props = [
      createProp({ id: 'c', kind: 'crate', x: 0, y: 0, z: 0 }),
      createProp({ id: 'w', kind: 'zonaiWheel', x: 3, y: 0, z: 0 }),
    ];
    const handle = createPropMeshes(props);
    handle.sync(props, { highlightId: null });
    const crate = bodyOf(groupFor(handle.object, 'c'));
    const wheel = bodyOf(groupFor(handle.object, 'w'));
    expect(crate.material.color.getHex()).toBe(0x8b5a2b);
    expect(wheel.material.color.getHex()).toBe(0x3fc9a8);
    expect(wheel.material.emissive.getHex()).toBe(0x2fff9a);
    expect(wheel.geometry.type).toBe('TorusGeometry');
  });

  it('gives a boulder a grey dodecahedron body', () => {
    const props = [createProp({ id: 'b', kind: 'boulder', x: 0, y: 0, z: 0 })];
    const handle = createPropMeshes(props);
    handle.sync(props, { highlightId: null });
    const boulder = bodyOf(groupFor(handle.object, 'b'));
    expect(boulder.geometry.type).toBe('DodecahedronGeometry');
    expect(boulder.material.color.getHex()).toBe(0x8a8f96);
  });

  it('syncs group positions from prop positions and body yaw', () => {
    const p = createProp({ id: 'c', kind: 'crate', x: 1, y: 2, z: 3 });
    const handle = createPropMeshes([p]);
    p.yaw = 0.5;
    handle.sync([p], { highlightId: null });
    const group = groupFor(handle.object, 'c');
    expect(group.position.x).toBe(1);
    expect(group.position.z).toBe(3);
    expect(group.position.y).toBeCloseTo(2 + 0.6, 6);
    expect(bodyOf(group).rotation.y).toBe(0.5);

    p.position.x = 7;
    handle.sync([p], { highlightId: null });
    expect(groupFor(handle.object, 'c').position.x).toBe(7);
  });

  it('adds an emissive glow only to the highlighted prop', () => {
    const props = [
      createProp({ id: 'a', kind: 'crate', x: 0, y: 0, z: 0 }),
      createProp({ id: 'b', kind: 'crate', x: 3, y: 0, z: 0 }),
    ];
    const handle = createPropMeshes(props);
    handle.sync(props, { highlightId: 'b' });
    const a = bodyOf(groupFor(handle.object, 'a'));
    const b = bodyOf(groupFor(handle.object, 'b'));
    expect(a.material.emissive.getHex()).toBe(0x000000);
    expect(b.material.emissive.getHex()).not.toBe(0x000000);

    handle.sync(props, { highlightId: null });
    expect(b.material.emissive.getHex()).toBe(0x000000);
  });

  it('shows a glue sphere only on props glued to a root', () => {
    const root = createProp({ id: 'r', kind: 'boulder', x: 0, y: 0, z: 0 });
    const child = createProp({ id: 'k', kind: 'crate', x: 2, y: 0, z: 0 });
    child.attachedTo = 'r';
    const handle = createPropMeshes([root, child]);
    handle.sync([root, child], { highlightId: null });
    const rootGlue = groupFor(handle.object, 'r').children.filter((c) => c.name === 'glue');
    const childGlue = groupFor(handle.object, 'k').children.filter((c) => c.name === 'glue');
    expect(rootGlue.every((g) => g.visible === false)).toBe(true);
    expect(childGlue).toHaveLength(1);
    expect(childGlue[0].visible).toBe(true);
    expect(childGlue[0].geometry.type).toBe('SphereGeometry');
    expect(childGlue[0].material.emissive.getHex()).not.toBe(0x000000);
  });

  it('removes groups for props no longer in the list and disposes their geometry', () => {
    const a = createProp({ id: 'a', kind: 'crate', x: 0, y: 0, z: 0 });
    const b = createProp({ id: 'b', kind: 'crate', x: 4, y: 0, z: 0 });
    const handle = createPropMeshes([a, b]);
    handle.sync([a, b], { highlightId: null });
    const geometry = bodyOf(groupFor(handle.object, 'b')).geometry;
    let disposed = false;
    geometry.addEventListener('dispose', () => { disposed = true; });
    handle.sync([a], { highlightId: null });
    expect(groupFor(handle.object, 'b')).toBeUndefined();
    expect(handle.object.children).toHaveLength(1);
    expect(disposed).toBe(true);
  });

  it('adds groups for props that appear later', () => {
    const handle = createPropMeshes([]);
    const c = createProp({ id: 'late', kind: 'crate', x: 0, y: 0, z: 0 });
    handle.sync([c], { highlightId: null });
    expect(groupFor(handle.object, 'late')).toBeDefined();
    expect(meshesOf(handle.object).length).toBeGreaterThan(0);
  });

  it('builds the same boulder shape for the same prop id', () => {
    const p = createProp({ id: 'stable', kind: 'boulder', x: 0, y: 0, z: 0 });
    const one = createPropMeshes([p]);
    one.sync([p], { highlightId: null });
    const two = createPropMeshes([p]);
    two.sync([p], { highlightId: null });
    const a = bodyOf(groupFor(one.object, 'stable')).geometry.attributes.position.array;
    const b = bodyOf(groupFor(two.object, 'stable')).geometry.attributes.position.array;
    expect(Array.from(a)).toEqual(Array.from(b));
  });
});
