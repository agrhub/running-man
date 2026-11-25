import * as THREE from 'three';
import { PROP_SCALE, PROPS, type PropDef, type PropId } from './catalog';
import { PACKED } from './packed';

/** Each prop's geometry in world units, standing on y = 0, centred on its footprint. */
export type PropLibrary = ReadonlyMap<PropId, THREE.BufferGeometry>;

/**
 * Unpacks `props.bin` (see scripts/build-props.ts). Faces get their own
 * corners again and flat normals, as the models were drawn.
 */
export const decodeProps = (data: ArrayBuffer): PropLibrary => {
  const lib = new Map<PropId, THREE.BufferGeometry>();
  const color = new THREE.Color();
  for (const def of PROPS) {
    const p = PACKED[def.id];
    if (!p) continue;
    const pos = new Uint16Array(data, p.o, p.v * 3);
    const colAt = p.o + p.v * 6;
    const col = new Uint8Array(data, colAt, p.v * 3);
    const idxAt = colAt + p.v * 3 + ((p.v * 3) % 2);
    const idx = new Uint16Array(data, idxAt, p.t * 3);

    const [x0, y0, z0] = p.min as [number, number, number];
    const [x1, y1, z1] = p.max as [number, number, number];
    const s = (def as PropDef).s ?? PROP_SCALE;
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const n = idx.length;
    const out = new Float32Array(n * 3);
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const v = idx[i]!;
      out[i * 3] = (x0 + (pos[v * 3]! / 65535) * (x1 - x0) - cx) * s;
      out[i * 3 + 1] = (pos[v * 3 + 1]! / 65535) * (y1 - y0) * s;
      out[i * 3 + 2] = (z0 + (pos[v * 3 + 2]! / 65535) * (z1 - z0) - cz) * s;
      color.setRGB(
        col[v * 3]! / 255,
        col[v * 3 + 1]! / 255,
        col[v * 3 + 2]! / 255,
        THREE.SRGBColorSpace
      );
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(out, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    lib.set(def.id, geo);
  }
  return lib;
};

let pending: Promise<PropLibrary> | null = null;

/** Fetches and unpacks the props once; the world adds them when they arrive. */
export const loadProps = (): Promise<PropLibrary> =>
  (pending ??= import('./props.bin?url')
    .then(({ default: url }) => fetch(url))
    .then((res) => {
      if (!res.ok) throw new Error(`props: ${res.status}`);
      return res.arrayBuffer();
    })
    .then(decodeProps)
    .catch((error: unknown) => {
      pending = null;
      throw error;
    }));
