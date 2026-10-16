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
  it('adds sun and hemisphere lights to the scene', () => {
    const { scene, lighting } = setup(12);
    expect(scene.children).toContain(lighting.sun);
    expect(scene.children).toContain(lighting.sun.target);
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

  it('sets scene.fog to a THREE.Fog with the contract range', () => {
    const { scene } = setup(12);
    expect(scene.fog).toBeInstanceOf(THREE.Fog);
    expect(scene.fog.near).toBe(120);
    expect(scene.fog.far).toBe(900);
  });

  it('at noon the sun is lit and above the followed position', () => {
    const { lighting, cycle } = setup(12);
    lighting.update(cycle, follow);
    expect(lighting.sun.intensity).toBeGreaterThan(0);
    expect(lighting.sun.position.y).toBeGreaterThan(follow.y);
  });

  it('at midnight the sun intensity is exactly 0', () => {
    const { lighting, cycle } = setup(0);
    lighting.update(cycle, follow);
    expect(lighting.sun.intensity).toBe(0);
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

  it('drives hemisphere intensity from ambient light and fog colour from the cycle', () => {
    const day = setup(12);
    day.lighting.update(day.cycle, follow);
    const night = setup(0);
    night.lighting.update(night.cycle, follow);
    expect(day.lighting.hemi.intensity).toBeCloseTo(1.5 * 0.6, 6);
    expect(night.lighting.hemi.intensity).toBeCloseTo(1.5 * 0.15, 6);
    expect(day.scene.fog.color.getHex()).not.toBe(night.scene.fog.color.getHex());
  });

  it('leaves scene.background untouched (sky dome covers it)', () => {
    const { scene, lighting, cycle } = setup(12);
    lighting.update(cycle, follow);
    expect(scene.background).toBeNull();
  });
});
