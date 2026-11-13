import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export type Rand = () => number;

export const canvasTex = (
  w: number,
  h: number,
  draw: (g: CanvasRenderingContext2D) => void
): THREE.CanvasTexture => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  if (g) draw(g);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
};

export const colorize = (
  geo: THREE.BufferGeometry,
  color: string | THREE.Color
): THREE.BufferGeometry => {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(color);
  const n = g.attributes.position?.count ?? 0;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  if (!g.attributes.uv)
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  return g;
};

export const box = (
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  color: string
) => colorize(new THREE.BoxGeometry(w, h, d).translate(x, y, z), color);

/** Length of road (in units) that shares one merged mesh. */
const CHUNK = 60;

/**
 * Collects geometry per material and adds merged meshes for each, one per
 * stretch of road. One mesh for the whole course could never be culled, so the
 * shadow pass drew every tree and building on every frame; per-stretch meshes
 * let three.js skip what is behind the camera and outside the shadow area.
 */
export class Batch {
  private readonly parts = new Map<THREE.Material, THREE.BufferGeometry[]>();
  push(mat: THREE.Material, ...geos: THREE.BufferGeometry[]) {
    const list = this.parts.get(mat) ?? [];
    list.push(...geos);
    this.parts.set(mat, list);
  }
  flush(group: THREE.Group, shadows: boolean) {
    for (const [mat, geos] of this.parts) {
      const chunks = new Map<number, THREE.BufferGeometry[]>();
      for (const g of geos) {
        g.computeBoundingBox();
        const box = g.boundingBox!;
        // Long pieces (ground, kerbs, river) span many stretches: keep them together.
        const key =
          box.max.z - box.min.z > CHUNK
            ? Number.POSITIVE_INFINITY
            : Math.floor((box.min.z + box.max.z) / 2 / CHUNK);
        const list = chunks.get(key) ?? [];
        list.push(g);
        chunks.set(key, list);
      }
      for (const list of chunks.values()) {
        const merged = mergeGeometries(list, false);
        list.forEach((g) => g.dispose());
        if (!merged) continue;
        merged.computeBoundingSphere();
        const mesh = new THREE.Mesh(merged, mat);
        mesh.castShadow = shadows;
        mesh.receiveShadow = true;
        group.add(mesh);
      }
    }
    this.parts.clear();
  }
}
