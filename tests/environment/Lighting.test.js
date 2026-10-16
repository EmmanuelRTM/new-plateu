import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createLighting } from '../../src/environment/Lighting.js';
import { createDayNightCycle } from '../../src/environment/DayNightCycle.js';

const follow = { x: 10, y: 5, z: -20 };

function setup(startHour) {
  const scene = new THREE.Scene();
  const lighting = createLighting(scene);
  const cycle = createDayNightCycle({ dayLengthSeconds: 600, startHour });
  return { scene, lighting, cycle };
}

describe('createLighting', () => {
  it('adds sun, moon and hemisphere lights to the scene', () => {
    const { scene, lighting } = setup(12);
    expect(scene.children).toContain(lighting.sun);
    expect(scene.children).toContain(lighting.sun.target);
    expect(scene.children).toContain(lighting.moon);
    expect(scene.children).toContain(lighting.moon.target);
    expect(scene.children).toContain(lighting.hemi);
    expect(lighting.sun).toBeInstanceOf(THREE.DirectionalLight);
    expect(lighting.hemi).toBeInstanceOf(THREE.HemisphereLight);
  });

  it('configures shadows per the architecture contract', () => {
    const { lighting } = setup(12);
    const cam = lighting.sun.shadow.camera;
    expect(lighting.sun.castShadow).toBe(true);
    expect(lighting.sun.shadow.mapSize.x).toBe(2048);
    expect(cam.left).toBe(-80);
    expect(cam.right).toBe(80);
    expect(cam.top).toBe(80);
    expect(cam.bottom).toBe(-80);
    expect(cam.near).toBe(1);
    expect(cam.far).toBe(400);
    expect(lighting.sun.shadow.bias).toBeCloseTo(-0.0005, 7);
    expect(lighting.sun.shadow.normalBias).toBeCloseTo(0.02, 6);
  });

  it('the moon is a DirectionalLight without shadows', () => {
    const { lighting } = setup(0);
    expect(lighting.moon).toBeInstanceOf(THREE.DirectionalLight);
    expect(lighting.moon.castShadow).toBe(false);
  });

  it('sets scene.fog to a THREE.Fog with the day range at noon', () => {
    const { scene, lighting, cycle } = setup(12);
    lighting.update(cycle, follow);
    expect(scene.fog).toBeInstanceOf(THREE.Fog);
    expect(scene.fog.near).toBe(150);
    expect(scene.fog.far).toBe(1100);
  });

  it('fog far is never below 900 m at any hour', () => {
    for (let h = 0; h < 24; h += 0.5) {
      const { scene, lighting, cycle } = setup(h);
      lighting.update(cycle, follow);
      expect(scene.fog.far).toBeGreaterThanOrEqual(900);
    }
  });

  it('pushes fog out at night so mid-distance objects stay visible', () => {
    const night = setup(0);
    night.lighting.update(night.cycle, follow);
    expect(night.scene.fog.near).toBe(220);
    expect(night.scene.fog.far).toBe(1400);
  });

  it('at noon the sun is lit at peak 2.2 and above the followed position', () => {
    const { lighting, cycle } = setup(12);
    lighting.update(cycle, follow);
    expect(lighting.sun.intensity).toBeCloseTo(2.2, 2);
    expect(lighting.sun.position.y).toBeGreaterThan(follow.y);
  });

  it('at midnight the sun intensity is exactly 0', () => {
    const { lighting, cycle } = setup(0);
    lighting.update(cycle, follow);
    expect(lighting.sun.intensity).toBe(0);
  });

  it('moon intensity is 0 at noon and above 0.7 * peak (0.9) at midnight', () => {
    const day = setup(12);
    day.lighting.update(day.cycle, follow);
    expect(day.lighting.moon.intensity).toBe(0);
    const night = setup(0);
    night.lighting.update(night.cycle, follow);
    expect(night.lighting.moon.intensity).toBeGreaterThan(0.7 * 0.9);
    expect(night.lighting.moon.intensity).toBeLessThanOrEqual(0.9 + 1e-9);
  });

  it('places the moon 200 m from the followed position along moonDirection', () => {
    const { lighting, cycle } = setup(0);
    lighting.update(cycle, follow);
    const d = cycle.moonDirection();
    expect(lighting.moon.position.x).toBeCloseTo(follow.x + d.x * 200, 4);
    expect(lighting.moon.position.y).toBeCloseTo(follow.y + d.y * 200, 4);
    expect(lighting.moon.position.z).toBeCloseTo(follow.z + d.z * 200, 4);
    expect(lighting.moon.target.position.x).toBe(follow.x);
  });

  it('keeps the sun target on the followed position', () => {
    const { lighting, cycle } = setup(12);
    lighting.update(cycle, follow);
    expect(lighting.sun.target.position.x).toBe(follow.x);
    expect(lighting.sun.target.position.y).toBe(follow.y);
    expect(lighting.sun.target.position.z).toBe(follow.z);
  });

  it('places the sun 200 m from the followed position along sunDirection', () => {
    const { lighting, cycle } = setup(9);
    lighting.update(cycle, follow);
    const d = cycle.sunDirection();
    expect(lighting.sun.position.x).toBeCloseTo(follow.x + d.x * 200, 4);
    expect(lighting.sun.position.y).toBeCloseTo(follow.y + d.y * 200, 4);
    expect(lighting.sun.position.z).toBeCloseTo(follow.z + d.z * 200, 4);
  });

  it('hemisphere intensity is about 1.0 at midnight and 1.6 at noon', () => {
    const day = setup(12);
    day.lighting.update(day.cycle, follow);
    const night = setup(0);
    night.lighting.update(night.cycle, follow);
    expect(day.lighting.hemi.intensity).toBeCloseTo(1.6, 1);
    expect(night.lighting.hemi.intensity).toBeGreaterThanOrEqual(0.9);
    expect(night.lighting.hemi.intensity).toBeLessThanOrEqual(1.05);
  });

  it('uses a saturated sky blue by day and a deep blue (not near-black) at night', () => {
    const day = setup(12);
    day.lighting.update(day.cycle, follow);
    const night = setup(0);
    night.lighting.update(night.cycle, follow);
    expect(day.lighting.hemi.color.getHex()).toBe(new THREE.Color('#7fb2ff').getHex());
    expect(night.lighting.hemi.color.getHex()).not.toBe(new THREE.Color('#000000').getHex());
    expect(night.lighting.hemi.color.b).toBeGreaterThan(night.lighting.hemi.color.r);
  });

  it('fog colour differs between day and night', () => {
    const day = setup(12);
    day.lighting.update(day.cycle, follow);
    const night = setup(0);
    night.lighting.update(night.cycle, follow);
    expect(day.scene.fog.color.getHex()).not.toBe(night.scene.fog.color.getHex());
  });

  it('leaves scene.background untouched (sky dome covers it)', () => {
    const { scene, lighting, cycle } = setup(12);
    lighting.update(cycle, follow);
    expect(scene.background).toBeNull();
  });
});
