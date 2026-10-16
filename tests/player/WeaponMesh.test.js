import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createWeaponMesh, createArrowGeometry, createArrowMaterial } from '../../src/player/WeaponMesh.js';
import { getItem, ITEM_TYPES } from '../../src/items/itemCatalog.js';

/** Collects every material colour and emissive hex used under an object. */
function materialHexes(root) {
  const out = [];
  root.traverse((node) => {
    if (node.isMesh) out.push({ colour: node.material.color.getHex(), emissive: node.material.emissive.getHex() });
  });
  return out;
}

describe('createWeaponMesh', () => {
  it('returns a hand group and a shield group, both empty at start', () => {
    const w = createWeaponMesh();
    expect(w.object).toBeInstanceOf(THREE.Group);
    expect(w.shieldObject).toBeInstanceOf(THREE.Group);
    expect(w.object.children).toHaveLength(0);
    expect(w.shieldObject.children).toHaveLength(0);
  });
});

describe('setItem', () => {
  it('adds one model named after the item type', () => {
    const w = createWeaponMesh();
    w.setItem(getItem('traveler-sword'));
    expect(w.object.children).toHaveLength(1);
    expect(w.object.children[0].name).toBe('weapon-sword');
  });

  it('swaps the visible model when a different item is set', () => {
    const w = createWeaponMesh();
    w.setItem(getItem('traveler-sword'));
    w.setItem(getItem('traveler-bow'));
    expect(w.object.children).toHaveLength(1);
    expect(w.object.children[0].name).toBe('weapon-bow');
  });

  it('removes the model when set to null', () => {
    const w = createWeaponMesh();
    w.setItem(getItem('traveler-sword'));
    w.setItem(null);
    expect(w.object.children).toHaveLength(0);
  });

  it('builds a model with meshes for every weapon type', () => {
    const w = createWeaponMesh();
    const samples = {
      sword: 'traveler-sword',
      claymore: 'traveler-claymore',
      spear: 'traveler-spear',
      bow: 'traveler-bow',
    };
    for (const type of ITEM_TYPES.filter((t) => t !== 'shield')) {
      w.setItem(getItem(samples[type]));
      const model = w.object.children[0];
      expect(model.name).toBe(`weapon-${type}`);
      let meshes = 0;
      model.traverse((n) => {
        if (n.isMesh) meshes += 1;
      });
      expect(meshes).toBeGreaterThan(0);
    }
  });

  it('colours the blade from item.colour', () => {
    const w = createWeaponMesh();
    w.setItem(getItem('zonaite-spear'));
    const colours = materialHexes(w.object).map((m) => m.colour);
    expect(colours).toContain(getItem('zonaite-spear').colour);
  });

  it('gives the Master Sword a purple hilt and a glowing light-blue blade', () => {
    const w = createWeaponMesh();
    w.setItem(getItem('master-sword'));
    const mats = materialHexes(w.object);
    expect(mats.map((m) => m.colour)).toContain(0x5b3fa0);
    const blade = mats.find((m) => m.colour === 0xcfe7ff);
    expect(blade).toBeDefined();
    expect(blade.emissive).not.toBe(0);
  });

  it('does not glow for ordinary swords', () => {
    const w = createWeaponMesh();
    w.setItem(getItem('traveler-sword'));
    expect(materialHexes(w.object).every((m) => m.emissive === 0)).toBe(true);
  });
});

describe('setShield', () => {
  it('attaches a shield model to the shield group', () => {
    const w = createWeaponMesh();
    w.setShield(getItem('hylian-shield'));
    expect(w.shieldObject.children).toHaveLength(1);
    expect(w.shieldObject.children[0].name).toBe('shield-hylian-shield');
    expect(w.object.children).toHaveLength(0);
  });

  it('replaces the shield when another is set', () => {
    const w = createWeaponMesh();
    w.setShield(getItem('wooden-shield'));
    w.setShield(getItem('zonaite-shield'));
    expect(w.shieldObject.children).toHaveLength(1);
    expect(w.shieldObject.children[0].name).toBe('shield-zonaite-shield');
  });

  it('removes the shield when set to null', () => {
    const w = createWeaponMesh();
    w.setShield(getItem('wooden-shield'));
    w.setShield(null);
    expect(w.shieldObject.children).toHaveLength(0);
  });

  it('rejects a non-shield item', () => {
    const w = createWeaponMesh();
    expect(() => w.setShield(getItem('traveler-sword'))).toThrow(/shield/i);
  });
});

describe('setSwing', () => {
  it('rests at zero rotation and position when progress is 0', () => {
    const w = createWeaponMesh();
    w.setItem(getItem('traveler-sword'));
    const rest = w.object.position.z;
    w.setSwing(0.5, 'sword');
    w.setSwing(0, 'sword');
    expect(w.object.rotation.x).toBeCloseTo(0, 10);
    expect(w.object.rotation.y).toBeCloseTo(0, 10);
    expect(w.object.position.z).toBeCloseTo(rest, 10);
  });

  it('changes the rotation during the swing', () => {
    const w = createWeaponMesh();
    w.setItem(getItem('traveler-sword'));
    w.setSwing(0.6, 'sword');
    expect(w.object.rotation.x).not.toBeCloseTo(0, 3);
  });

  it('sweeps the sword from -1.6 to +0.8 rad about X across the active phase', () => {
    const w = createWeaponMesh();
    w.setItem(getItem('traveler-sword'));
    w.setSwing(1, 'sword');
    expect(w.object.rotation.x).toBeCloseTo(0.8, 10);
    // windup fraction for the sword is 0.12 / 0.27; the active sweep starts at -1.6
    const windupEnd = 0.12 / 0.27;
    w.setSwing(windupEnd, 'sword');
    expect(w.object.rotation.x).toBeCloseTo(-1.6, 10);
  });

  it('thrusts a spear forward along Z and returns it at the ends', () => {
    const w = createWeaponMesh();
    w.setItem(getItem('traveler-spear'));
    const rest = w.object.position.z;
    w.setSwing(0.5, 'spear');
    expect(w.object.position.z).toBeGreaterThan(rest);
    w.setSwing(1, 'spear');
    expect(w.object.position.z).toBeCloseTo(rest, 6);
  });

  it('sweeps a claymore wide across Y as well as X', () => {
    const w = createWeaponMesh();
    w.setItem(getItem('traveler-claymore'));
    w.setSwing(0.7, 'claymore');
    expect(Math.abs(w.object.rotation.y)).toBeGreaterThan(0.1);
  });

  it('clamps out-of-range and non-finite progress', () => {
    const w = createWeaponMesh();
    w.setItem(getItem('traveler-sword'));
    w.setSwing(5, 'sword');
    expect(w.object.rotation.x).toBeCloseTo(0.8, 10);
    w.setSwing(Number.NaN, 'sword');
    expect(w.object.rotation.x).toBeCloseTo(0, 10);
  });
});

describe('bow draw', () => {
  it('raises the bow hand forward as the draw progresses', () => {
    const w = createWeaponMesh();
    w.setItem(getItem('traveler-bow'));
    w.setSwing(0, 'bow');
    expect(w.object.rotation.x).toBeCloseTo(0, 10);
    w.setSwing(0.5, 'bow');
    const half = w.object.rotation.x;
    w.setSwing(1, 'bow');
    expect(w.object.rotation.x).toBeCloseTo(-1.3, 2);
    expect(half).toBeLessThan(0);
    expect(half).toBeGreaterThan(-1.3);
  });

  it('pulls the nock back along -Z as the draw progresses', () => {
    const w = createWeaponMesh();
    w.setItem(getItem('traveler-bow'));
    const nock = w.object.getObjectByName('nock');
    expect(nock).toBeDefined();
    w.setSwing(1, 'bow');
    expect(nock.position.z).toBeCloseTo(-0.25, 10);
    w.setSwing(0, 'bow');
    expect(nock.position.z).toBeCloseTo(0, 10);
  });
});

describe('createArrowGeometry and createArrowMaterial', () => {
  it('builds a geometry with a position attribute and a merged set of parts', () => {
    const geo = createArrowGeometry();
    expect(geo).toBeInstanceOf(THREE.BufferGeometry);
    expect(geo.getAttribute('position').count).toBeGreaterThan(0);
    geo.computeBoundingBox();
    // Tip points along +Z, the nock sits at the origin.
    expect(geo.boundingBox.max.z).toBeGreaterThan(0.8);
    expect(geo.boundingBox.min.z).toBeGreaterThanOrEqual(-0.01);
  });

  it('returns a standard material', () => {
    expect(createArrowMaterial()).toBeInstanceOf(THREE.MeshStandardMaterial);
  });
});
