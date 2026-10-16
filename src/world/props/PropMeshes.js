/**
 * Three.js adapter that draws movable props. One group per prop holds its body mesh and a glue sphere
 * (shown when the prop is glued to another). The body is the first child mesh of the group.
 * Official docs: https://threejs.org/docs/ (Group, Mesh, MeshStandardMaterial, DodecahedronGeometry,
 * BoxGeometry, TorusGeometry, SphereGeometry).
 */
import * as THREE from 'three';
import { PROP_KINDS } from './props.js';
import { createPrng } from '../Prng.js';

/** Colours. Boulders are grey stone, crates are wood, Zonai wheels are teal with a green rim. */
const BOULDER_COLOUR = 0x8a8f96;
const CRATE_COLOUR = 0x8b5a2b;
const CRATE_EDGE_COLOUR = 0x4a2e15;
const WHEEL_COLOUR = 0x3fc9a8;
const WHEEL_RIM_COLOUR = 0x2fff9a;
const GLUE_COLOUR = 0xa8ff6a;
const HIGHLIGHT_COLOUR = 0xffd966;
/** Jitter applied to each dodecahedron vertex, as a fraction of its radius. */
const BOULDER_JITTER = 0.1;
const CRATE_EDGE_WIDTH = 0.1;
const GLUE_RADIUS = 0.12;

/**
 * @typedef {{ group: THREE.Group, body: THREE.Mesh, glue: THREE.Mesh, offset: number, baseEmissive: number }} PropEntry
 * @typedef {object} PropMeshHandle
 * @property {THREE.Group} object  parent group; add it to the scene
 * @property {(props: import('./props.js').Prop[], opts?: { highlightId?: string|null }) => void} sync
 *   creates, updates and removes meshes so that there is one group per prop in `props`
 */

/**
 * Hashes a prop id to a 32-bit seed so boulder shapes are stable across sessions.
 * @param {string} id
 * @returns {number}
 */
function seedFromId(id) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    h = Math.imul(h ^ id.charCodeAt(i), 16777619) >>> 0;
  }
  return h;
}

/**
 * Dodecahedron with each vertex pushed in or out by a seeded factor, so boulders look different.
 * Duplicate vertices (the faces share corners) receive the same factor, so the surface stays closed.
 * @param {number} radius
 * @param {string} id prop id, used as the seed
 * @returns {THREE.BufferGeometry}
 */
function jitteredBoulder(radius, id) {
  const geometry = new THREE.DodecahedronGeometry(radius, 0);
  const rng = createPrng(seedFromId(id));
  const pos = geometry.attributes.position;
  const factors = new Map();
  for (let i = 0; i < pos.count; i += 1) {
    const key = `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`;
    if (!factors.has(key)) factors.set(key, 1 + rng.range(-BOULDER_JITTER, BOULDER_JITTER));
    const f = factors.get(key);
    pos.setXYZ(i, pos.getX(i) * f, pos.getY(i) * f, pos.getZ(i) * f);
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Builds the body mesh (and its details) for a prop kind.
 * @param {import('./props.js').Prop} prop
 * @returns {{ body: THREE.Mesh, offset: number }} body with the group offset above the prop's base
 */
function buildBody(prop) {
  const def = PROP_KINDS[prop.kind];
  if (prop.kind === 'boulder') {
    const mat = new THREE.MeshStandardMaterial({ color: BOULDER_COLOUR, roughness: 0.95, flatShading: true });
    return { body: new THREE.Mesh(jitteredBoulder(def.radius, prop.id), mat), offset: def.radius };
  }
  if (prop.kind === 'crate') {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2 * def.radius, def.height, 2 * def.radius),
      new THREE.MeshStandardMaterial({ color: CRATE_COLOUR, roughness: 0.8 }),
    );
    const edgeMat = new THREE.MeshStandardMaterial({ color: CRATE_EDGE_COLOUR, roughness: 0.7 });
    const edgeGeo = new THREE.BoxGeometry(CRATE_EDGE_WIDTH, def.height * 1.02, CRATE_EDGE_WIDTH);
    const inset = def.radius - CRATE_EDGE_WIDTH / 2;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const edge = new THREE.Mesh(edgeGeo, edgeMat);
        edge.position.set(sx * inset, 0, sz * inset);
        edge.castShadow = true;
        body.add(edge);
      }
    }
    return { body, offset: def.height / 2 };
  }
  if (prop.kind === 'zonaiWheel') {
    const mat = new THREE.MeshStandardMaterial({
      color: WHEEL_COLOUR,
      emissive: WHEEL_RIM_COLOUR,
      emissiveIntensity: 0.5,
      roughness: 0.4,
    });
    const geo = new THREE.TorusGeometry(def.radius - 0.1, 0.1, 8, 24);
    return { body: new THREE.Mesh(geo, mat), offset: def.radius };
  }
  throw new Error(`No mesh for prop kind: ${prop.kind}`);
}

/**
 * Creates the mesh group for one prop, with its glue sphere hidden.
 * @param {import('./props.js').Prop} prop
 * @returns {PropEntry}
 */
function buildEntry(prop) {
  const { body, offset } = buildBody(prop);
  body.castShadow = true;
  body.receiveShadow = true;
  const group = new THREE.Group();
  group.name = `prop:${prop.id}`;
  const glue = new THREE.Mesh(
    new THREE.SphereGeometry(GLUE_RADIUS, 10, 8),
    new THREE.MeshStandardMaterial({ color: GLUE_COLOUR, emissive: GLUE_COLOUR, emissiveIntensity: 1.2 }),
  );
  glue.name = 'glue';
  glue.visible = false;
  group.add(body, glue);
  const baseEmissive = body.material.emissive.getHex();
  return { group, body, glue, offset, baseEmissive };
}

/**
 * Pushes state onto one entry: position, yaw, highlight and glue sphere.
 * @param {PropEntry} entry
 * @param {import('./props.js').Prop} prop
 * @param {Map<string, import('./props.js').Prop>} byId
 * @param {string|null} highlightId
 * @returns {void}
 */
function updateEntry(entry, prop, byId, highlightId) {
  const { x, y, z } = prop.position;
  entry.group.position.set(x, y + entry.offset, z);
  entry.body.rotation.y = prop.yaw;
  entry.body.material.emissive.setHex(prop.id === highlightId ? HIGHLIGHT_COLOUR : entry.baseEmissive);
  const root = prop.attachedTo === null ? undefined : byId.get(prop.attachedTo);
  entry.glue.visible = root !== undefined;
  if (root === undefined) return;
  const contactX = (x + root.position.x) / 2;
  const contactZ = (z + root.position.z) / 2;
  const contactY = y + PROP_KINDS[prop.kind].height / 2;
  entry.glue.position.set(contactX - x, contactY - (y + entry.offset), contactZ - z);
}

/**
 * Frees the geometry and materials of a removed group.
 * @param {THREE.Object3D} root
 * @returns {void}
 */
function disposeTree(root) {
  root.traverse((node) => {
    if (node.geometry) node.geometry.dispose();
    if (node.material) node.material.dispose();
  });
}

/**
 * Builds the prop mesh adapter. Call `sync` every frame with the current prop list.
 * @param {import('./props.js').Prop[]} props initial props (sync is run for them by the caller)
 * @returns {PropMeshHandle}
 */
export function createPropMeshes(props) {
  const object = new THREE.Group();
  object.name = 'Props';
  /** @type {Map<string, PropEntry>} */
  const entries = new Map();
  if (!Array.isArray(props)) throw new TypeError('createPropMeshes expects an array of props');

  return {
    object,
    sync(list, { highlightId = null } = {}) {
      const byId = new Map(list.map((p) => [p.id, p]));
      for (const prop of list) {
        let entry = entries.get(prop.id);
        if (!entry) {
          entry = buildEntry(prop);
          entries.set(prop.id, entry);
          object.add(entry.group);
        }
        updateEntry(entry, prop, byId, highlightId);
      }
      for (const [id, entry] of entries) {
        if (byId.has(id)) continue;
        object.remove(entry.group);
        disposeTree(entry.group);
        entries.delete(id);
      }
    },
  };
}
