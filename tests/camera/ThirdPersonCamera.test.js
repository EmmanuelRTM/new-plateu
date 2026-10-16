import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { ThirdPersonCamera } from '../../src/camera/ThirdPersonCamera.js';

const flat = () => 0;
const input = (over = {}) => ({ mouseDX: 0, mouseDY: 0, ...over });
const DT = 1 / 60;

function make(opts = {}) {
  const camera = new THREE.PerspectiveCamera();
  const rig = new ThirdPersonCamera(camera, { heightAt: flat, ...opts });
  return { camera, rig };
}

function settle(rig, target, frames = 600) {
  for (let i = 0; i < frames; i++) rig.update(target, input(), DT);
}

describe('ThirdPersonCamera', () => {
  it('settles at the configured distance from target + height', () => {
    const { camera, rig } = make({ distance: 6, height: 1.8 });
    const target = new THREE.Vector3(10, 0, -4);
    settle(rig, target);
    const anchor = new THREE.Vector3(10, 1.8, -4);
    expect(camera.position.distanceTo(anchor)).toBeCloseTo(6, 2);
  });

  it('does not move the camera in a single instant (smooth damping)', () => {
    const { camera, rig } = make();
    const target = new THREE.Vector3(0, 0, 0);
    settle(rig, target);
    const before = camera.position.clone();
    rig.update(new THREE.Vector3(50, 0, 0), input(), DT);
    const step = camera.position.distanceTo(before);
    expect(step).toBeGreaterThan(0);
    expect(step).toBeLessThan(50);
  });

  it('a mouseDX of dx changes yaw by -sensitivity * dx', () => {
    const sensitivity = 0.0025;
    const { rig } = make({ sensitivity });
    const target = new THREE.Vector3();
    const startYaw = rig.yaw;
    rig.update(target, input({ mouseDX: 100 }), DT);
    expect(rig.yaw).toBeCloseTo(startYaw - sensitivity * 100, 10);
  });

  it('positive mouseDX (mouse right) decreases yaw', () => {
    const { rig } = make();
    const target = new THREE.Vector3();
    const startYaw = rig.yaw;
    rig.update(target, input({ mouseDX: 40 }), DT);
    expect(rig.yaw).toBeLessThan(startYaw);
  });

  it('mouseDY increases pitch by sensitivity * dy (mouse down looks down from above)', () => {
    const { rig } = make({ sensitivity: 0.01 });
    const target = new THREE.Vector3();
    const startPitch = rig.pitch;
    rig.update(target, input({ mouseDY: 10 }), DT);
    expect(rig.pitch).toBeCloseTo(startPitch + 0.1, 10);
  });

  it('pitch clamps to maxPitch and minPitch', () => {
    const { rig } = make({ sensitivity: 0.1, minPitch: -0.5, maxPitch: 1.2 });
    const target = new THREE.Vector3();
    for (let i = 0; i < 50; i++) rig.update(target, input({ mouseDY: 100 }), DT);
    expect(rig.pitch).toBeLessThanOrEqual(1.2 + 1e-12);
    expect(rig.pitch).toBeCloseTo(1.2, 10);
    for (let i = 0; i < 200; i++) rig.update(target, input({ mouseDY: -100 }), DT);
    expect(rig.pitch).toBeGreaterThanOrEqual(-0.5 - 1e-12);
    expect(rig.pitch).toBeCloseTo(-0.5, 10);
  });

  it('never ends below heightAt(x, z) + 0.5 for a high terrain', () => {
    const highGround = () => 200;
    const camera = new THREE.PerspectiveCamera();
    const rig = new ThirdPersonCamera(camera, { heightAt: highGround, distance: 6, height: 1.8 });
    const target = new THREE.Vector3(3, 0, 3);
    for (let i = 0; i < 300; i++) {
      rig.update(target, input(), DT);
      expect(camera.position.y).toBeGreaterThanOrEqual(200.5 - 1e-9);
    }
  });

  it('samples heightAt at the camera x/z', () => {
    const seen = [];
    const heightAt = (x, z) => {
      seen.push([x, z]);
      return 0;
    };
    const camera = new THREE.PerspectiveCamera();
    const rig = new ThirdPersonCamera(camera, { heightAt });
    rig.update(new THREE.Vector3(0, 0, 0), input(), DT);
    expect(seen.length).toBeGreaterThan(0);
    const [x, z] = seen.at(-1);
    expect(Number.isFinite(x) && Number.isFinite(z)).toBe(true);
  });

  it('camera looks at the target (forward points toward target + height)', () => {
    const { camera, rig } = make({ distance: 6, height: 1.8 });
    const target = new THREE.Vector3(2, 0, 2);
    settle(rig, target);
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const toTarget = new THREE.Vector3(2, 1.8, 2).sub(camera.position).normalize();
    expect(dir.dot(toTarget)).toBeGreaterThan(0.999);
  });

  it('yaw=0 places the camera on +Z side of the target (looks toward -Z)', () => {
    const { camera, rig } = make({ distance: 6, height: 0 });
    const target = new THREE.Vector3();
    settle(rig, target);
    expect(rig.yaw).toBeCloseTo(0, 10);
    expect(camera.position.x).toBeCloseTo(0, 6);
    expect(camera.position.z).toBeCloseTo(6 * Math.cos(rig.pitch), 4);
    expect(camera.position.y).toBeCloseTo(6 * Math.sin(rig.pitch), 4);
  });

  it('positive pitch raises the camera above the anchor by distance * sin(pitch)', () => {
    const { camera, rig } = make({ distance: 6, height: 0, minPitch: -0.5, maxPitch: 1.2 });
    const target = new THREE.Vector3();
    rig.update(target, input({ mouseDY: 1e4 }), DT); // clamp pitch to maxPitch
    settle(rig, target);
    expect(rig.pitch).toBeCloseTo(1.2, 10);
    expect(camera.position.y).toBeCloseTo(6 * Math.sin(1.2), 4);
  });

  it('wraps yaw into [-PI, PI) so repeated turns stay bounded', () => {
    const { rig } = make({ sensitivity: 0.0025 });
    const target = new THREE.Vector3();
    for (let i = 0; i < 100; i++) rig.update(target, input({ mouseDX: 2000 }), DT);
    expect(rig.yaw).toBeGreaterThanOrEqual(-Math.PI);
    expect(rig.yaw).toBeLessThan(Math.PI);
  });

  it('exposes yaw as the horizontal look direction for the player', () => {
    const { rig } = make();
    const target = new THREE.Vector3();
    rig.update(target, input({ mouseDX: -400 }), DT); // yaw increases
    expect(rig.yaw).toBeGreaterThan(0);
  });
});
