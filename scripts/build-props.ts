/**
 * Packs the roadside props of `src/client/three/props/catalog.ts` into one
 * small binary file the game loads with the 3D world.
 *
 *   npx tsx scripts/build-props.ts
 *
 * Each free Polyfork model (https://polyfork.dev) is downloaded once into
 * `.cache/polyfork`, with its asset record for the CC BY 4.0 credit line.
 * Every mesh of a model is flattened into one, shared corners are merged,
 * positions become 16-bit integers inside the model's box and colours 8-bit
 * sRGB. Normals are dropped: the models are flat-shaded, so the game works
 * them out again from the faces. The colours and shapes are Polyfork's own.
 *
 * Writes `props.bin` and `packed.ts` (offsets and credits) next to the catalog.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { PROPS } from '../src/client/three/props/catalog';

const ROOT = join(import.meta.dirname, '..');
const CACHE = join(ROOT, '.cache', 'polyfork');
const OUT = join(ROOT, 'src', 'client', 'three', 'props');
const CDN = 'https://polyfork.dev';

type Gltf = {
  nodes: {
    mesh?: number;
    children?: number[];
    translation?: number[];
    rotation?: number[];
    scale?: number[];
    matrix?: number[];
  }[];
  scenes?: { nodes: number[] }[];
  scene?: number;
  meshes: {
    primitives: {
      attributes: Record<string, number>;
      indices?: number;
      mode?: number;
    }[];
  }[];
  accessors: {
    bufferView: number;
    byteOffset?: number;
    componentType: number;
    count: number;
    type: string;
    normalized?: boolean;
  }[];
  bufferViews: { byteOffset?: number; byteStride?: number }[];
};

const fetchOnce = async (url: string, file: string) => {
  if (existsSync(file)) return readFile(file);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(file, buf);
  return buf;
};

const parseGlb = (buf: Buffer) => {
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('not a GLB');
  let at = 12;
  let json: Gltf | null = null;
  let bin: Buffer | null = null;
  while (at < buf.length) {
    const len = buf.readUInt32LE(at);
    const type = buf.readUInt32LE(at + 4);
    const chunk = buf.subarray(at + 8, at + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(chunk.toString('utf8')) as Gltf;
    if (type === 0x004e4942) bin = chunk;
    at += 8 + len;
  }
  if (!json || !bin) throw new Error('GLB without JSON or BIN');
  return { json, bin };
};

const SIZE: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

const read = (g: Gltf, bin: Buffer, index: number): number[][] => {
  const acc = g.accessors[index]!;
  const view = g.bufferViews[acc.bufferView]!;
  const n = SIZE[acc.type]!;
  const bytes =
    acc.componentType === 5126 || acc.componentType === 5125
      ? 4
      : acc.componentType === 5123 || acc.componentType === 5122
        ? 2
        : 1;
  const stride = view.byteStride ?? n * bytes;
  const base = (view.byteOffset ?? 0) + (acc.byteOffset ?? 0);
  const out: number[][] = [];
  for (let i = 0; i < acc.count; i++) {
    const row: number[] = [];
    for (let k = 0; k < n; k++) {
      const o = base + i * stride + k * bytes;
      let x: number;
      switch (acc.componentType) {
        case 5126:
          x = bin.readFloatLE(o);
          break;
        case 5125:
          x = bin.readUInt32LE(o);
          break;
        case 5123:
          x = bin.readUInt16LE(o);
          if (acc.normalized) x /= 65535;
          break;
        case 5121:
          x = bin.readUInt8(o);
          if (acc.normalized) x /= 255;
          break;
        default:
          throw new Error(`component type ${acc.componentType}`);
      }
      row.push(x);
    }
    out.push(row);
  }
  return out;
};

const toSrgb = (c: number) =>
  Math.round(
    255 *
      Math.min(
        1,
        Math.max(0, c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055)
      )
  );

/** One model: triangles in model space, each corner a position and an sRGB colour. */
const flatten = (g: Gltf, bin: Buffer) => {
  const tris: { p: THREE.Vector3; c: [number, number, number] }[] = [];
  const visit = (index: number, parent: THREE.Matrix4) => {
    const node = g.nodes[index]!;
    const local = new THREE.Matrix4();
    if (node.matrix) local.fromArray(node.matrix);
    else
      local.compose(
        new THREE.Vector3(
          ...((node.translation ?? [0, 0, 0]) as [number, number, number])
        ),
        new THREE.Quaternion(
          ...((node.rotation ?? [0, 0, 0, 1]) as [
            number,
            number,
            number,
            number,
          ])
        ),
        new THREE.Vector3(
          ...((node.scale ?? [1, 1, 1]) as [number, number, number])
        )
      );
    const world = parent.clone().multiply(local);
    if (node.mesh !== undefined) {
      for (const prim of g.meshes[node.mesh]!.primitives) {
        if ((prim.mode ?? 4) !== 4) continue;
        const pos = read(g, bin, prim.attributes.POSITION!);
        const col =
          prim.attributes.COLOR_0 !== undefined
            ? read(g, bin, prim.attributes.COLOR_0)
            : null;
        const idx =
          prim.indices !== undefined
            ? read(g, bin, prim.indices).map((r) => r[0]!)
            : pos.map((_, i) => i);
        for (const i of idx) {
          const p = new THREE.Vector3(...(pos[i] as [number, number, number]));
          p.applyMatrix4(world);
          const c = col?.[i] ?? [0.8, 0.8, 0.8];
          tris.push({
            p,
            c: [toSrgb(c[0]!), toSrgb(c[1]!), toSrgb(c[2]!)],
          });
        }
      }
    }
    for (const child of node.children ?? []) visit(child, world);
  };
  const roots = g.scenes?.[g.scene ?? 0]?.nodes ?? g.nodes.map((_, i) => i);
  for (const r of roots) visit(r, new THREE.Matrix4());
  return tris;
};

type Record_ = { id: string; title: string; credit: string; page: string };

const main = async () => {
  await mkdir(CACHE, { recursive: true });
  const chunks: Buffer[] = [];
  let offset = 0;
  const index: Record<
    string,
    { o: number; v: number; t: number; min: number[]; max: number[] }
  > = {};
  const credits: Record_[] = [];
  let triangles = 0;

  for (const prop of PROPS) {
    const glb = await fetchOnce(
      `${CDN}/cdn/${prop.id}.glb`,
      join(CACHE, `${prop.id}.glb`)
    );
    const rec = JSON.parse(
      (
        await fetchOnce(
          `${CDN}/api/assets/${prop.id}`,
          join(CACHE, `${prop.id}.json`)
        )
      ).toString('utf8')
    ) as Record_ & { free?: boolean };
    if (rec.free === false) throw new Error(`${prop.id} is not free`);
    credits.push({
      id: prop.id,
      title: rec.title,
      credit: rec.credit,
      page: rec.page,
    });

    const { json, bin } = parseGlb(glb);
    const corners = flatten(json, bin);
    const box = new THREE.Box3();
    for (const k of corners) box.expandByPoint(k.p);
    const size = box.getSize(new THREE.Vector3());

    // Merge corners that share a position and a colour.
    const q = corners.map((k) =>
      [0, 1, 2].map((a) =>
        Math.round(
          ((k.p.getComponent(a) - box.min.getComponent(a)) /
            (size.getComponent(a) || 1)) *
            65535
        )
      )
    );
    const seen = new Map<string, number>();
    const verts: number[][] = [];
    const idx: number[] = [];
    corners.forEach((k, i) => {
      const key = `${q[i]!.join(',')}|${k.c.join(',')}`;
      let at = seen.get(key);
      if (at === undefined) {
        at = verts.length;
        verts.push([...q[i]!, ...k.c]);
        seen.set(key, at);
      }
      idx.push(at);
    });
    if (verts.length > 65535) throw new Error(`${prop.id}: too many corners`);

    // [u16 x,y,z per corner][u8 r,g,b per corner][pad to 2][u16 indices][pad to 4]
    const pos = Buffer.alloc(verts.length * 6);
    const col = Buffer.alloc(verts.length * 3 + ((verts.length * 3) % 2));
    verts.forEach((vtx, i) => {
      pos.writeUInt16LE(vtx[0]!, i * 6);
      pos.writeUInt16LE(vtx[1]!, i * 6 + 2);
      pos.writeUInt16LE(vtx[2]!, i * 6 + 4);
      col.writeUInt8(vtx[3]!, i * 3);
      col.writeUInt8(vtx[4]!, i * 3 + 1);
      col.writeUInt8(vtx[5]!, i * 3 + 2);
    });
    const ind = Buffer.alloc(idx.length * 2 + ((idx.length * 2) % 4));
    idx.forEach((x, i) => ind.writeUInt16LE(x, i * 2));
    const block = Buffer.concat([pos, col, ind]);
    const pad = Buffer.alloc((4 - (block.length % 4)) % 4);
    index[prop.id] = {
      o: offset,
      v: verts.length,
      t: idx.length / 3,
      min: box.min.toArray().map((x) => +x.toFixed(4)),
      max: box.max.toArray().map((x) => +x.toFixed(4)),
    };
    chunks.push(block, pad);
    offset += block.length + pad.length;
    triangles += idx.length / 3;
  }

  await writeFile(join(OUT, 'props.bin'), Buffer.concat(chunks));
  const ts = `// Written by scripts/build-props.ts: do not edit by hand.
/* eslint-disable */

/** Where each prop sits in props.bin, and its box in metres. */
export const PACKED: Record<
  string,
  { o: number; v: number; t: number; min: number[]; max: number[] }
> = ${JSON.stringify(index)};

/** CC BY 4.0 credit lines, one per model. */
export const PROP_CREDITS: { id: string; title: string; credit: string; page: string }[] = ${JSON.stringify(credits)};
`;
  await writeFile(join(OUT, 'packed.ts'), ts);

  // The credit lines also go into THIRD_PARTY_NOTICES.md, between markers.
  const notices = join(ROOT, 'THIRD_PARTY_NOTICES.md');
  const START = '<!-- polyfork:start -->';
  const END = '<!-- polyfork:end -->';
  const section = [
    START,
    '',
    '## Polyfork 3D models',
    '',
    'The roadside props are free low-poly models from [Polyfork](https://polyfork.dev), used under',
    '[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). `scripts/build-props.ts` converts them to the game’s',
    'packed format (meshes merged, positions and colours quantised, normals recomputed); shapes and colours are',
    'unchanged. The game lists the same credits under Me → Options → 3D model credits.',
    '',
    ...credits.map((c) => `- ${c.credit}`),
    '',
    END,
  ].join('\n');
  const text = await readFile(notices, 'utf8');
  const at = text.indexOf(START);
  const next =
    at >= 0
      ? text.slice(0, at) + section + text.slice(text.indexOf(END) + END.length)
      : `${text.trimEnd()}\n\n${section}\n`;
  await writeFile(notices, next);
  console.log(
    `${PROPS.length} props, ${triangles} triangles, ${(offset / 1024).toFixed(0)} KB`
  );
};

await main();
