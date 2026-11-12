import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { City, CityId, Landmark, Stage } from '../../shared/content';
import { hashString, mulberry32 } from '../../shared/rng';

/*
 * The race course as a city street, seen from behind the runner.
 *
 * The course runs from z = 0 (start) to z = -6 km along a closed avenue. Cross streets cut it into blocks; each block has
 * buildings at real floor scale on both sides, with a second, taller row behind for the skyline. Facades are one
 * canvas-drawn "floor x bay" module repeated by UV, tinted per building with vertex colours, so the whole city is merged
 * into a handful of meshes (one per material).
 */

export const UNITS_PER_KM = 40;
export const COURSE_KM = 6;
export const ROAD_HALF = 4.2;
const SIDEWALK = 3.2;
const FRONT_X = ROAD_HALF + SIDEWALK;
const BLOCK = 34;
const CROSS_W = 7;
const FH = 3;
const BAY = 2;

export const kmZ = (km: number) => -km * UNITS_PER_KM;

type Rand = () => number;

const canvasTex = (
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

const colorize = (
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

const box = (
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  color: string
) => colorize(new THREE.BoxGeometry(w, h, d).translate(x, y, z), color);

/** Collects geometry per material and adds one merged mesh for each. */
class Batch {
  private readonly parts = new Map<THREE.Material, THREE.BufferGeometry[]>();
  push(mat: THREE.Material, ...geos: THREE.BufferGeometry[]) {
    const list = this.parts.get(mat) ?? [];
    list.push(...geos);
    this.parts.set(mat, list);
  }
  flush(group: THREE.Group, shadows: boolean) {
    for (const [mat, geos] of this.parts) {
      if (geos.length === 0) continue;
      const merged = mergeGeometries(geos, false);
      geos.forEach((g) => g.dispose());
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = shadows;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    this.parts.clear();
  }
}

type FacadeStyle = {
  wall: string;
  glass: [string, string];
  win: [number, number, number, number];
  frame?: string;
  balcony?: boolean;
  shutters?: string;
  bands?: boolean;
};

const FACADES: Record<CityId, FacadeStyle[]> = {
  tokyo: [
    {
      wall: '#e9edf1',
      glass: ['#bcd6e6', '#38506a'],
      win: [0.05, 0.28, 0.95, 0.95],
      bands: true,
    },
    {
      wall: '#f4f1eb',
      glass: ['#a9bccb', '#2c3946'],
      win: [0.2, 0.3, 0.8, 0.85],
      frame: '#ffffff',
      balcony: true,
    },
    {
      wall: '#ffffff',
      glass: ['#9fb6c6', '#27313b'],
      win: [0.15, 0.25, 0.85, 0.85],
      frame: '#d9dde2',
    },
  ],
  paris: [
    {
      wall: '#f6ecd6',
      glass: ['#8fa3b6', '#2b3441'],
      win: [0.3, 0.18, 0.7, 0.88],
      frame: '#ffffff',
      balcony: true,
    },
    {
      wall: '#efe3c8',
      glass: ['#94a7b8', '#26303b'],
      win: [0.32, 0.2, 0.68, 0.86],
      frame: '#f8f3e7',
      shutters: '#5f7c6a',
    },
  ],
  hanoi: [
    {
      wall: '#ffffff',
      glass: ['#7b8f9a', '#26323a'],
      win: [0.22, 0.28, 0.78, 0.85],
      shutters: '#3f8f6b',
      balcony: true,
    },
    {
      wall: '#ffffff',
      glass: ['#8899a4', '#2a3138'],
      win: [0.18, 0.3, 0.82, 0.86],
      frame: '#f5efe4',
      balcony: true,
    },
  ],
};

const TINTS: Record<CityId, string[]> = {
  tokyo: [
    '#dfe5ea',
    '#c9d3db',
    '#f1e8dc',
    '#d7d2cc',
    '#bfcad3',
    '#e9dfe6',
    '#cfd9cf',
  ],
  paris: ['#fbf3e0', '#f2e6cb', '#ece0c5', '#f7eedd', '#e8dcc0'],
  hanoi: [
    '#ffd36e',
    '#f6b28b',
    '#a8d8b9',
    '#f2e2a6',
    '#e7c1d8',
    '#9ccfe0',
    '#ffe7a3',
    '#f4a6a6',
  ],
};

const SIGN_COLORS = [
  '#ff5d73',
  '#3ddc84',
  '#f2b544',
  '#4fc3f7',
  '#b388ff',
  '#ff8a3d',
  '#64ffda',
  '#ffffff',
];

const facadeTexture = (st: FacadeStyle) =>
  canvasTex(64, 64, (g) => {
    const [x0, y0, x1, y1] = st.win;
    const X = (f: number) => f * 64;
    const Y = (f: number) => (1 - f) * 64;
    g.fillStyle = st.wall;
    g.fillRect(0, 0, 64, 64);
    if (st.bands) {
      g.fillStyle = 'rgba(0,0,0,.12)';
      g.fillRect(0, Y(0.28), 64, Y(0) - Y(0.28));
    }
    if (st.shutters) {
      g.fillStyle = st.shutters;
      g.fillRect(X(x0) - 7, Y(y1), 6, Y(y0) - Y(y1));
      g.fillRect(X(x1) + 1, Y(y1), 6, Y(y0) - Y(y1));
    }
    const gr = g.createLinearGradient(0, Y(y1), 0, Y(y0));
    gr.addColorStop(0, st.glass[0]);
    gr.addColorStop(0.5, st.glass[1]);
    gr.addColorStop(1, st.glass[1]);
    g.fillStyle = gr;
    g.fillRect(X(x0), Y(y1), X(x1) - X(x0), Y(y0) - Y(y1));
    if (st.frame) {
      g.strokeStyle = st.frame;
      g.lineWidth = 2;
      g.strokeRect(X(x0), Y(y1), X(x1) - X(x0), Y(y0) - Y(y1));
      g.fillRect(X(x0) - 2, Y(y0), X(x1) - X(x0) + 4, 3);
    }
    if (st.balcony) {
      g.fillStyle = 'rgba(30,30,40,.55)';
      g.fillRect(0, Y(0.3), 64, 2);
      for (let x = 2; x < 64; x += 5)
        g.fillRect(x, Y(0.3), 1, Y(0.14) - Y(0.3));
      g.fillRect(0, Y(0.14), 64, 2);
    }
  });

/** Ground-floor shop fronts: warm glass, a striped awning and a plain sign (no real brands). */
const shopTexture = () =>
  canvasTex(1024, 128, (g) => {
    for (let i = 0; i < 8; i++) {
      const x = i * 128;
      g.fillStyle = '#2a2d35';
      g.fillRect(x, 0, 128, 128);
      const gr = g.createLinearGradient(0, 50, 0, 128);
      gr.addColorStop(0, '#ffe7b8');
      gr.addColorStop(1, '#c98e4a');
      g.fillStyle = gr;
      g.fillRect(x + 8, 52, 112, 76);
      g.fillStyle = 'rgba(0,0,0,.35)';
      for (let k = 1; k < 4; k++) g.fillRect(x + 8 + k * 28, 52, 3, 76);
      const sign = SIGN_COLORS[i] ?? '#ffffff';
      for (let k = 0; k < 8; k++) {
        g.fillStyle = k % 2 === 0 ? sign : '#ffffff';
        g.fillRect(x + 4 + k * 15, 36, 15, 12);
      }
      g.fillStyle = sign;
      g.fillRect(x + 14, 8, 100, 22);
      g.fillStyle = 'rgba(255,255,255,.85)';
      g.fillRect(x + 28, 16, 72, 6);
    }
  });

const asphaltTexture = (rand: Rand) => {
  const t = canvasTex(256, 256, (g) => {
    g.fillStyle = '#dcdcdc';
    g.fillRect(0, 0, 256, 256);
    for (let k = 0; k < 7000; k++) {
      const v = 175 + Math.floor(rand() * 75);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(rand() * 256, rand() * 256, 1.5, 1.5);
    }
    for (let k = 0; k < 5; k++) {
      g.fillStyle = 'rgba(0,0,0,.06)';
      g.beginPath();
      g.ellipse(
        rand() * 256,
        rand() * 256,
        20 + rand() * 40,
        10 + rand() * 25,
        rand() * 3,
        0,
        Math.PI * 2
      );
      g.fill();
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
};

const pavementTexture = () => {
  const t = canvasTex(128, 128, (g) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = 'rgba(0,0,0,.13)';
    g.lineWidth = 2;
    for (let i = 0; i <= 128; i += 32) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i, 128);
      g.moveTo(0, i);
      g.lineTo(128, i);
      g.stroke();
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
};

export const textLabel = (
  text: string,
  bg: string,
  fg = '#ffffff',
  w = 512,
  h = 128
) =>
  canvasTex(w, h, (g) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.fillStyle = fg;
    g.font = `800 ${Math.round(h * 0.62)}px "Baloo 2", sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, w / 2, h * 0.56, w - 24);
  });

const checkerTexture = () =>
  canvasTex(512, 64, (g) => {
    for (let i = 0; i < 32; i++) {
      for (let r = 0; r < 4; r++) {
        g.fillStyle = (i + r) % 2 === 0 ? '#2a2340' : '#ffffff';
        g.fillRect(i * 16, r * 16, 16, 16);
      }
    }
  });

type BuildingSpec = {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  floors: number;
  /** Which side faces the avenue: +1 when the facade looks to +x. */
  face: 1 | -1;
  front: boolean;
};

export type CityBuild = {
  group: THREE.Group;
  /** Landmark position, for the camera and toasts. */
  landmark: THREE.Vector3;
  update(t: number): void;
};

export const buildCity = (
  city: City,
  stage: Stage,
  shadows: boolean
): CityBuild => {
  const group = new THREE.Group();
  const rand = mulberry32(hashString(`${city.id}:${stage.name}`));
  const pick = <T>(arr: T[]): T =>
    arr[Math.floor(rand() * arr.length)] ?? arr[0]!;
  const range = (a: number, b: number) => a + rand() * (b - a);
  const batch = new Batch();
  const vmat = (rough = 0.85, metal = 0) =>
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: rough,
      metalness: metal,
    });

  const solid = vmat();
  const metal = vmat(0.45, 0.4);
  const greens = vmat(0.95);
  const glow = new THREE.MeshBasicMaterial({ vertexColors: true });
  const facadeMats = FACADES[city.id].map(
    (st) =>
      new THREE.MeshStandardMaterial({
        map: facadeTexture(st),
        vertexColors: true,
        roughness: 0.82,
      })
  );
  for (const m of facadeMats) {
    if (m.map) m.map.wrapS = m.map.wrapT = THREE.RepeatWrapping;
  }
  const shopMat = new THREE.MeshStandardMaterial({
    map: shopTexture(),
    roughness: 0.6,
    emissive: '#3a2a10',
    emissiveIntensity: 0.25,
  });

  const zStart = 40;
  const zEnd = kmZ(COURSE_KM) - 60;
  const length = zStart - zEnd;
  const zMid = (zStart + zEnd) / 2;

  // Avenue, sidewalks and the ground beyond
  const asphalt = asphaltTexture(rand);
  asphalt.repeat.set(2, length / 8);
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(ROAD_HALF * 2, length),
    new THREE.MeshStandardMaterial({
      map: asphalt,
      color: city.palette.road,
      roughness: 0.92,
    })
  );
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0, zMid);
  road.receiveShadow = true;
  group.add(road);

  const pave = pavementTexture();
  pave.repeat.set(SIDEWALK / 1.6, length / 1.6);
  const pavementMat = new THREE.MeshStandardMaterial({
    map: pave,
    color:
      city.id === 'paris'
        ? '#e8dfcc'
        : city.id === 'hanoi'
          ? '#d9cfc0'
          : '#d8d9dc',
    roughness: 0.9,
  });
  for (const side of [-1, 1]) {
    const walk = new THREE.Mesh(
      new THREE.PlaneGeometry(SIDEWALK, length),
      pavementMat
    );
    walk.rotation.x = -Math.PI / 2;
    walk.position.set(side * (ROAD_HALF + SIDEWALK / 2), 0.12, zMid);
    walk.receiveShadow = true;
    group.add(walk);
    batch.push(
      solid,
      box(0.22, 0.14, length, side * (ROAD_HALF + 0.11), 0.07, zMid, '#f2efe8')
    );
  }
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(400, length + 200),
    new THREE.MeshStandardMaterial({ color: city.palette.ground, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.02, zMid);
  ground.receiveShadow = true;
  group.add(ground);

  // Lane dashes and edge lines
  for (let z = zStart; z > zEnd; z -= 6) {
    batch.push(
      glow,
      box(0.16, 0.01, 2.6, -ROAD_HALF / 3, 0.012, z, city.palette.roadLine),
      box(0.16, 0.01, 2.6, ROAD_HALF / 3, 0.012, z, city.palette.roadLine)
    );
  }
  for (const side of [-1, 1])
    batch.push(
      glow,
      box(0.14, 0.01, length, side * (ROAD_HALF - 0.35), 0.012, zMid, '#f4f1ea')
    );

  // Cross streets with zebra crossings, traffic lights and parked cars
  const crossZs: number[] = [];
  for (let z = zStart - 18; z > zEnd; z -= BLOCK) crossZs.push(z);
  const crossMat = new THREE.MeshStandardMaterial({
    map: asphalt,
    color: city.palette.road,
    roughness: 0.92,
  });
  for (const cz of crossZs) {
    const cross = new THREE.Mesh(
      new THREE.PlaneGeometry(200, CROSS_W),
      crossMat
    );
    cross.rotation.x = -Math.PI / 2;
    cross.position.set(0, 0.005, cz);
    cross.receiveShadow = true;
    group.add(cross);
    // cut the sidewalk visually with a darker strip over it
    for (const side of [-1, 1]) {
      batch.push(
        solid,
        box(
          SIDEWALK,
          0.02,
          CROSS_W,
          side * (ROAD_HALF + SIDEWALK / 2),
          0.125,
          cz,
          '#5a5b63'
        )
      );
    }
    for (const edge of [-1, 1]) {
      for (let x = -ROAD_HALF + 0.4; x < ROAD_HALF; x += 0.9) {
        batch.push(
          glow,
          box(
            0.5,
            0.012,
            2.4,
            x + 0.25,
            0.014,
            cz + edge * (CROSS_W / 2 + 1.4),
            '#f4f1ea'
          )
        );
      }
    }
    for (const [sx, sz] of [
      [-1, 1],
      [1, -1],
    ] as const) {
      const px = sx * (ROAD_HALF + 0.5);
      const pz = cz + sz * (CROSS_W / 2 + 0.4);
      batch.push(
        metal,
        colorize(
          new THREE.CylinderGeometry(0.07, 0.09, 3.6, 8).translate(px, 1.8, pz),
          '#2b2f36'
        )
      );
      batch.push(metal, box(0.32, 0.9, 0.3, px, 3.4, pz, '#2b2f36'));
      batch.push(
        glow,
        colorize(
          new THREE.SphereGeometry(0.09, 8, 6).translate(
            px,
            3.7,
            pz + sz * 0.16
          ),
          '#ff4d4d'
        )
      );
      batch.push(
        glow,
        colorize(
          new THREE.SphereGeometry(0.09, 8, 6).translate(
            px,
            3.4,
            pz + sz * 0.16
          ),
          '#4a3b20'
        )
      );
      batch.push(
        glow,
        colorize(
          new THREE.SphereGeometry(0.09, 8, 6).translate(
            px,
            3.1,
            pz + sz * 0.16
          ),
          '#1f3b2a'
        )
      );
    }
    // Cars wait at the closed crossing, behind a barrier.
    for (const side of [-1, 1]) {
      const bx = side * (FRONT_X + 1.2);
      batch.push(metal, box(0.12, 1, CROSS_W - 0.6, bx, 0.5, cz, '#c9ccd2'));
      batch.push(
        solid,
        box(0.14, 0.3, CROSS_W - 0.6, bx, 0.8, cz, city.palette.accent)
      );
      if (rand() < 0.8) {
        const carX = side * (FRONT_X + 4.5 + rand() * 3);
        const col = pick([
          '#e63946',
          '#f1faee',
          '#457b9d',
          '#ffb703',
          '#2a9d8f',
          '#8d99ae',
          '#1d3557',
        ]);
        const lane = cz + (side > 0 ? -1.6 : 1.6);
        batch.push(
          solid,
          colorize(
            new THREE.BoxGeometry(3.6, 0.8, 1.7).translate(carX, 0.65, lane),
            col
          )
        );
        batch.push(
          solid,
          colorize(
            new THREE.BoxGeometry(2, 0.65, 1.5).translate(
              carX + side * 0.2,
              1.35,
              lane
            ),
            '#2f3a48'
          )
        );
        for (const [wx, wz] of [
          [-1.15, -0.8],
          [1.15, -0.8],
          [-1.15, 0.8],
          [1.15, 0.8],
        ] as const) {
          batch.push(
            solid,
            colorize(
              new THREE.CylinderGeometry(0.34, 0.34, 0.25, 12)
                .rotateX(Math.PI / 2)
                .translate(carX + wx, 0.34, lane + wz),
              '#1b1b22'
            )
          );
        }
      }
    }
  }
  const inCross = (z0: number, z1: number) =>
    crossZs.some(
      (cz) => z1 > cz - CROSS_W / 2 - 0.5 && z0 < cz + CROSS_W / 2 + 0.5
    );

  // Buildings
  const lmZ = kmZ(stage.landmark.km);
  const lmSide = 1;
  const lmBlock = crossZs.find((cz, i) => {
    const next = crossZs[i + 1] ?? cz - BLOCK;
    return lmZ <= cz && lmZ > next;
  });
  const plaza = {
    z0: (lmBlock ?? lmZ + BLOCK / 2) - BLOCK + CROSS_W / 2,
    z1: (lmBlock ?? lmZ + BLOCK / 2) - CROSS_W / 2,
  };
  const inPlaza = (side: number, z0: number, z1: number) =>
    side === lmSide && z1 > plaza.z0 - 0.5 && z0 < plaza.z1 + 0.5;

  const facadeUV = (
    geo: THREE.BoxGeometry,
    w: number,
    h: number,
    d: number,
    offU: number,
    offV: number
  ) => {
    const uv = geo.attributes.uv;
    const n = geo.attributes.normal;
    if (!uv || !n) return geo;
    for (let i = 0; i < uv.count; i++) {
      if (Math.abs(n.getY(i)) > 0.5) {
        uv.setXY(i, 0.02, 0.02);
        continue;
      }
      const bays = Math.max(
        1,
        Math.round((Math.abs(n.getX(i)) > 0.5 ? d : w) / BAY)
      );
      uv.setXY(i, offU + uv.getX(i) * bays, offV + uv.getY(i) * (h / FH));
    }
    return geo;
  };

  const shopGeos: THREE.BufferGeometry[] = [];
  const building = (b: BuildingSpec) => {
    const w = b.x1 - b.x0;
    const d = b.z1 - b.z0;
    const cx = (b.x0 + b.x1) / 2;
    const cz = (b.z0 + b.z1) / 2;
    const h = b.floors * FH;
    const styleIndex = Math.floor(rand() * facadeMats.length);
    const mat = facadeMats[styleIndex] ?? facadeMats[0]!;
    const tint = pick(TINTS[city.id]);
    const geo = facadeUV(
      new THREE.BoxGeometry(w, h, d),
      w,
      h,
      d,
      Math.floor(rand() * 4),
      0.98
    );
    geo.translate(cx, h / 2, cz);
    // the ground floor stays a plain wall band; shops cover it on the avenue side
    batch.push(mat, colorize(geo, tint));
    // roof
    if (city.id === 'paris') {
      // mansard: a slate block set back, with dormers
      batch.push(solid, box(w - 0.6, 1.8, d - 0.6, cx, h + 0.9, cz, '#5d6470'));
      batch.push(
        solid,
        box(w + 0.2, 0.25, d + 0.2, cx, h + 0.1, cz, '#e3d7bc')
      );
      for (let k = -1; k <= 1; k++)
        batch.push(
          solid,
          box(
            0.5,
            0.8,
            0.9,
            cx + b.face * (w / 2 - 0.4),
            h + 1.2,
            cz + k * (d / 3.2),
            '#f2ead6'
          )
        );
    } else {
      batch.push(
        solid,
        box(
          w + 0.24,
          0.35,
          d + 0.24,
          cx,
          h + 0.17,
          cz,
          city.id === 'hanoi' ? '#b75b3d' : '#454b55'
        )
      );
      if (rand() < 0.6)
        batch.push(
          metal,
          box(
            1,
            0.8,
            1,
            cx + range(-w / 4, w / 4),
            h + 0.75,
            cz + range(-d / 4, d / 4),
            '#8e949c'
          )
        );
      if (city.id === 'hanoi' && rand() < 0.5) {
        batch.push(
          metal,
          colorize(
            new THREE.CylinderGeometry(0.45, 0.45, 1, 12).translate(
              cx,
              h + 0.85,
              cz
            ),
            '#cfd6dc'
          )
        );
      }
    }
    if (b.front) {
      const fx = b.face > 0 ? b.x1 + 0.04 : b.x0 - 0.04;
      const plain = new THREE.PlaneGeometry(d - 0.6, FH * 0.86);
      const uv = plain.attributes.uv;
      const i = Math.floor(rand() * 8);
      if (uv)
        for (let k = 0; k < uv.count; k++) uv.setX(k, (i + uv.getX(k)) / 8);
      plain
        .rotateY(b.face > 0 ? Math.PI / 2 : -Math.PI / 2)
        .translate(fx, FH * 0.43, cz);
      shopGeos.push(plain);
      // Tokyo: vertical sign boards; Hanoi: balconies with plants; Paris: iron balconies
      if (city.id === 'tokyo' && rand() < 0.55) {
        const sc = pick(SIGN_COLORS);
        batch.push(
          glow,
          box(
            0.25,
            Math.min(h - 4, 6),
            0.9,
            fx + b.face * 0.35,
            FH + Math.min(h - 4, 6) / 2 + 0.5,
            cz + range(-d / 3, d / 3),
            sc
          )
        );
      }
      if (city.id !== 'tokyo') {
        for (let f = 1; f < b.floors; f++) {
          if (city.id === 'paris' && f !== 2 && f !== b.floors - 1) continue;
          batch.push(
            metal,
            box(
              0.5,
              0.08,
              d - 0.4,
              fx + b.face * 0.25,
              f * FH + 0.05,
              cz,
              '#2b2f36'
            )
          );
          batch.push(
            metal,
            box(
              0.04,
              0.6,
              d - 0.4,
              fx + b.face * 0.5,
              f * FH + 0.35,
              cz,
              '#2b2f36'
            )
          );
          if (city.id === 'hanoi' && rand() < 0.5) {
            batch.push(
              greens,
              colorize(
                new THREE.IcosahedronGeometry(0.35, 0).translate(
                  fx + b.face * 0.3,
                  f * FH + 0.4,
                  cz + range(-d / 3, d / 3)
                ),
                '#4c9a50'
              )
            );
          }
        }
      }
    }
  };

  const floorsFor = (row: number) => {
    switch (city.id) {
      case 'tokyo':
        return row === 0
          ? 3 + Math.floor(rand() * 6)
          : 7 + Math.floor(rand() * 12);
      case 'paris':
        return row === 0
          ? 6 + Math.floor(rand() * 2)
          : 6 + Math.floor(rand() * 3);
      case 'hanoi':
        return row === 0
          ? 3 + Math.floor(rand() * 3)
          : 4 + Math.floor(rand() * 6);
    }
  };

  for (let i = 0; i <= crossZs.length; i++) {
    const top = i === 0 ? zStart + 20 : (crossZs[i - 1] ?? 0) - CROSS_W / 2;
    const bottom = (crossZs[i] ?? zEnd - 20) + CROSS_W / 2;
    for (const side of [-1, 1] as const) {
      for (let row = 0; row < 2; row++) {
        const xNear = row === 0 ? FRONT_X + 0.3 : FRONT_X + 13;
        const depth = row === 0 ? range(8, 11) : range(10, 16);
        let z = top;
        while (z > bottom + 2) {
          const width =
            city.id === 'hanoi' && row === 0
              ? range(3.8, 5.5)
              : city.id === 'paris'
                ? range(8, 12)
                : range(6, 11);
          const z1 = z;
          const z0 = Math.max(bottom, z - width);
          if (z1 - z0 > 2.4 && !inCross(z0, z1) && !inPlaza(side, z0, z1)) {
            const x0 = side > 0 ? xNear : -xNear - depth;
            const x1 = side > 0 ? xNear + depth : -xNear;
            building({
              x0,
              x1,
              z0,
              z1,
              floors: floorsFor(row),
              face: side > 0 ? -1 : 1,
              front: row === 0,
            });
          }
          z = z0 - (city.id === 'hanoi' ? 0.05 : range(0.3, 1.2));
        }
      }
    }
  }
  if (shopGeos.length > 0) {
    const merged = mergeGeometries(shopGeos, false);
    shopGeos.forEach((g) => g.dispose());
    if (merged) group.add(new THREE.Mesh(merged, shopMat));
  }

  // Far skyline: big simple blocks swallowed by fog
  for (let k = 0; k < 40; k++) {
    const side = k % 2 === 0 ? -1 : 1;
    const x = side * range(45, 80);
    const z = range(zEnd, zStart);
    const h = range(15, city.id === 'tokyo' ? 60 : 30);
    batch.push(
      solid,
      box(range(8, 16), h, range(8, 16), x, h / 2, z, pick(TINTS[city.id]))
    );
  }

  // Street lamps, trees and benches on the sidewalks
  const crown =
    city.id === 'tokyo'
      ? ['#ffb7c5', '#f9a8bb', '#ffc6d3']
      : city.id === 'paris'
        ? ['#7fae6a', '#8bbd73', '#6f9e5d']
        : ['#3f9a4e', '#4caf50', '#2e8540'];
  for (let z = zStart; z > zEnd; z -= 13) {
    for (const side of [-1, 1]) {
      if (inCross(z - 1, z + 1)) continue;
      const lx = side * (ROAD_HALF + 0.55);
      batch.push(
        metal,
        colorize(
          new THREE.CylinderGeometry(0.06, 0.08, 4.2, 8).translate(lx, 2.1, z),
          '#2b2f36'
        )
      );
      batch.push(
        metal,
        box(0.9, 0.07, 0.08, lx - side * 0.4, 4.15, z, '#2b2f36')
      );
      batch.push(
        glow,
        box(0.36, 0.08, 0.18, lx - side * 0.8, 4.08, z, '#fff3d6')
      );
      if (city.id === 'hanoi') {
        // a few sagging cables between poles
        batch.push(
          metal,
          box(0.03, 0.03, 13, lx, 3.7, z - 6.5, '#1b1b1b'),
          box(0.03, 0.03, 13, lx, 3.5, z - 6.5, '#1b1b1b')
        );
      }
    }
  }
  for (let z = zStart - 6; z > zEnd; z -= 9.5) {
    for (const side of [-1, 1]) {
      if (inCross(z - 2, z + 2) || inPlaza(side, z - 2, z + 2)) continue;
      const tx = side * (FRONT_X - 0.9);
      const s = range(0.85, 1.15);
      batch.push(solid, box(1, 0.3, 1, tx, 0.27, z, '#8a8f97'));
      batch.push(
        greens,
        colorize(
          new THREE.CylinderGeometry(0.12 * s, 0.16 * s, 1.8 * s, 6).translate(
            tx,
            0.9 * s + 0.2,
            z
          ),
          '#5b4433'
        )
      );
      const c = pick(crown);
      batch.push(
        greens,
        colorize(
          new THREE.IcosahedronGeometry(1.1 * s, 1).translate(
            tx,
            2.4 * s + 0.2,
            z
          ),
          c
        )
      );
      batch.push(
        greens,
        colorize(
          new THREE.IcosahedronGeometry(0.8 * s, 1).translate(
            tx + 0.4 * s,
            3 * s + 0.2,
            z - 0.3 * s
          ),
          c
        )
      );
    }
  }
  if (city.id === 'hanoi') {
    // scooters parked on the sidewalk
    for (let z = zStart; z > zEnd; z -= 3.5) {
      if (rand() < 0.45 || inCross(z - 1, z + 1)) continue;
      const side = rand() < 0.5 ? -1 : 1;
      const sx = side * (FRONT_X - 1.9);
      const col = pick(['#e63946', '#1d3557', '#f1faee', '#2a9d8f', '#ffb703']);
      batch.push(solid, box(0.4, 0.45, 1.4, sx, 0.55, z, col));
      batch.push(solid, box(0.35, 0.15, 0.6, sx, 0.85, z + 0.2, '#222'));
      batch.push(
        solid,
        colorize(
          new THREE.CylinderGeometry(0.22, 0.22, 0.12, 10)
            .rotateZ(Math.PI / 2)
            .translate(sx, 0.34, z - 0.55),
          '#1b1b22'
        )
      );
      batch.push(
        solid,
        colorize(
          new THREE.CylinderGeometry(0.22, 0.22, 0.12, 10)
            .rotateZ(Math.PI / 2)
            .translate(sx, 0.34, z + 0.55),
          '#1b1b22'
        )
      );
    }
  }

  // Crowd barriers and spectators: thick at the start, the finish and around the landmark
  const busy = (z: number) => {
    const fromStart = Math.abs(z);
    const fromFinish = Math.abs(z - kmZ(COURSE_KM));
    const fromLm = Math.abs(z - lmZ);
    return fromStart < 30 || fromFinish < 40 || fromLm < 18 ? 0.8 : 0.12;
  };
  const shirts = [
    '#ff5d73',
    '#ffd166',
    '#06d6a0',
    '#118ab2',
    '#ef476f',
    '#8338ec',
    '#ffffff',
    '#ff9f1c',
  ];
  const skins = ['#ffe0c7', '#f6cfa8', '#e0a97c', '#c58a5e', '#8d5b3e'];
  const crowd: THREE.BufferGeometry[] = [];
  for (let z = zStart - 2; z > zEnd + 10; z -= 1.1) {
    for (const side of [-1, 1]) {
      if (inCross(z - 0.6, z + 0.6)) continue;
      const p = busy(z);
      if (busy(z) > 0.5)
        batch.push(
          metal,
          box(0.06, 0.9, 1.05, side * (ROAD_HALF + 0.25), 0.55, z, '#c9ccd2')
        );
      if (rand() > p) continue;
      const px = side * (ROAD_HALF + 0.75 + rand() * 1.4);
      const pz = z + range(-0.3, 0.3);
      const s = range(0.85, 1.1);
      crowd.push(
        colorize(
          new THREE.CapsuleGeometry(0.2 * s, 0.45 * s, 3, 8).translate(
            px,
            0.6 * s + 0.12,
            pz
          ),
          pick(shirts)
        )
      );
      crowd.push(
        colorize(
          new THREE.SphereGeometry(0.22 * s, 10, 8).translate(
            px,
            1.2 * s + 0.12,
            pz
          ),
          pick(skins)
        )
      );
      if (rand() < 0.4)
        crowd.push(
          colorize(
            new THREE.CapsuleGeometry(0.05, 0.4, 2, 6).translate(
              px,
              1.5 * s + 0.12,
              pz + 0.18
            ),
            pick(skins)
          )
        );
    }
  }
  const crowdMat = vmat(0.7);
  let crowdMesh: THREE.Mesh | null = null;
  if (crowd.length > 0) {
    const merged = mergeGeometries(crowd, false);
    crowd.forEach((g) => g.dispose());
    if (merged) {
      crowdMesh = new THREE.Mesh(merged, crowdMat);
      crowdMesh.castShadow = shadows;
      group.add(crowdMesh);
    }
  }

  // Gantries: start, every km, finish
  const gantry = (z: number, label: string, banner: THREE.Texture | null) => {
    const g = new THREE.Group();
    const accent = new THREE.MeshStandardMaterial({
      color: city.palette.accent,
      roughness: 0.6,
    });
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 5.6, 0.45),
        accent
      );
      post.position.set(side * (ROAD_HALF + 0.2), 2.8, 0);
      post.castShadow = shadows;
      g.add(post);
    }
    const tex = banner ?? textLabel(label, city.palette.accent);
    const face = new THREE.MeshBasicMaterial({ map: tex });
    const beam = new THREE.Mesh(
      new THREE.BoxGeometry(ROAD_HALF * 2 + 0.8, 1.3, 0.35),
      [accent, accent, accent, accent, face, face]
    );
    beam.position.y = 5.4;
    g.add(beam);
    g.position.z = z;
    group.add(g);
  };
  gantry(0, 'START', null);
  for (let km = 1; km < COURSE_KM; km++) gantry(kmZ(km), `${km} km`, null);
  gantry(kmZ(COURSE_KM), 'FINISH', checkerTexture());

  // Water stations: tables with cups on the right sidewalk
  for (const km of stage.waterAfterKm) {
    const z = kmZ(km) + 3;
    batch.push(solid, box(0.8, 0.08, 3.4, ROAD_HALF + 0.9, 0.85, z, '#ffffff'));
    batch.push(
      solid,
      box(0.7, 0.8, 0.08, ROAD_HALF + 0.9, 0.45, z - 1.5, '#ffffff'),
      box(0.7, 0.8, 0.08, ROAD_HALF + 0.9, 0.45, z + 1.5, '#ffffff')
    );
    for (let k = 0; k < 8; k++) {
      batch.push(
        glow,
        colorize(
          new THREE.CylinderGeometry(0.08, 0.06, 0.18, 8).translate(
            ROAD_HALF + 0.75 + (k % 2) * 0.25,
            0.98,
            z - 1.3 + k * 0.36
          ),
          '#38b6e8'
        )
      );
    }
    batch.push(solid, box(0.1, 2.4, 0.1, ROAD_HALF + 1.2, 1.2, z, '#9aa0a8'));
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(1.8, 0.6),
      new THREE.MeshBasicMaterial({
        map: textLabel('WATER', '#38b6e8', '#ffffff', 256, 86),
      })
    );
    sign.position.set(ROAD_HALF + 1.2, 2.5, z);
    sign.rotation.y = -Math.PI / 2;
    group.add(sign);
  }

  // The landmark sits in a plaza on the right side of the avenue.
  const lmPos = new THREE.Vector3(
    FRONT_X + 7,
    0,
    THREE.MathUtils.clamp(lmZ, plaza.z0 + 9, plaza.z1 - 9)
  );
  const plazaTiles = new THREE.Mesh(
    new THREE.PlaneGeometry(40, plaza.z1 - plaza.z0),
    new THREE.MeshStandardMaterial({
      map: pave,
      color: '#e9e2d3',
      roughness: 0.9,
    })
  );
  plazaTiles.rotation.x = -Math.PI / 2;
  plazaTiles.position.set(FRONT_X + 20, 0.1, (plaza.z0 + plaza.z1) / 2);
  plazaTiles.receiveShadow = true;
  group.add(plazaTiles);
  const lm = buildLandmark(stage.landmark, city.palette.accent);
  lm.position.copy(lmPos);
  lm.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = shadows;
      o.receiveShadow = true;
    }
  });
  group.add(lm);

  batch.flush(group, shadows);

  return {
    group,
    landmark: lmPos,
    update: (t: number) => {
      if (crowdMesh) crowdMesh.position.y = Math.abs(Math.sin(t * 6)) * 0.05;
    },
  };
};

const buildLandmark = (lm: Landmark, accent: string): THREE.Group => {
  const g = new THREE.Group();
  const std = (
    c: string,
    extra: Partial<THREE.MeshStandardMaterialParameters> = {}
  ) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, ...extra });
  const white = std('#fdfbf7');
  const acc = std(accent);
  const dark = std('#3b3557');
  const add = (
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number
  ) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };
  switch (lm.kind) {
    case 'tower': {
      add(new THREE.CylinderGeometry(1.6, 3.4, 16, 8), acc, 0, 8, 0);
      add(new THREE.CylinderGeometry(2.4, 2.4, 1.6, 16), white, 0, 16.8, 0);
      add(new THREE.CylinderGeometry(1, 1.6, 12, 8), acc, 0, 23.6, 0);
      add(new THREE.CylinderGeometry(1.4, 1.4, 1.2, 16), white, 0, 30.2, 0);
      add(new THREE.ConeGeometry(0.45, 8, 8), white, 0, 35, 0);
      break;
    }
    case 'gate': {
      const red = std('#d7263d');
      add(new THREE.BoxGeometry(1, 9, 1), red, 0, 4.5, -4);
      add(new THREE.BoxGeometry(1, 9, 1), red, 0, 4.5, 4);
      add(new THREE.BoxGeometry(1.6, 0.9, 12), dark, 0, 9.4, 0);
      add(new THREE.BoxGeometry(1.2, 0.6, 10), red, 0, 7.8, 0);
      add(
        new THREE.CylinderGeometry(1.5, 1.5, 3.2, 20),
        std('#ff3b3b'),
        -0.6,
        5.6,
        0
      );
      add(new THREE.CylinderGeometry(1.55, 1.55, 0.3, 20), dark, -0.6, 7.3, 0);
      break;
    }
    case 'bridge': {
      const arc = add(
        new THREE.TorusGeometry(12, 0.6, 10, 40, Math.PI),
        acc,
        0,
        0,
        0
      );
      arc.rotation.y = Math.PI / 2;
      add(new THREE.BoxGeometry(3, 0.8, 28), white, 0, 0.4, 0);
      for (let i = -4; i <= 4; i++) {
        const h = Math.sqrt(Math.max(0, 144 - (i * 2.8) ** 2));
        add(
          new THREE.CylinderGeometry(0.07, 0.07, h, 4),
          white,
          0,
          h / 2,
          i * 2.8
        );
      }
      const water = add(
        new THREE.PlaneGeometry(14, 34),
        std('#7fd1e8', { roughness: 0.2 }),
        2,
        0.05,
        0
      );
      water.rotation.x = -Math.PI / 2;
      break;
    }
    case 'temple': {
      const wood = std('#c0392b');
      add(new THREE.BoxGeometry(10, 1, 10), white, 0, 0.5, 0);
      add(new THREE.BoxGeometry(7, 4, 7), wood, 0, 3, 0);
      const r1 = add(new THREE.ConeGeometry(7.5, 3, 4), dark, 0, 6.5, 0);
      r1.rotation.y = Math.PI / 4;
      add(new THREE.BoxGeometry(4.6, 2.4, 4.6), wood, 0, 9, 0);
      const r2 = add(new THREE.ConeGeometry(5, 2.6, 4), dark, 0, 11.4, 0);
      r2.rotation.y = Math.PI / 4;
      add(new THREE.SphereGeometry(0.5, 10, 8), std('#ffc23d'), 0, 13, 0);
      break;
    }
    case 'arch': {
      const stone = std('#efe2c4');
      add(new THREE.BoxGeometry(5, 14, 4), stone, 0, 7, -6);
      add(new THREE.BoxGeometry(5, 14, 4), stone, 0, 7, 6);
      add(new THREE.BoxGeometry(5.2, 5, 16), stone, 0, 16.5, 0);
      const ring = add(
        new THREE.TorusGeometry(4, 0.4, 8, 24, Math.PI),
        acc,
        -2.6,
        10,
        0
      );
      ring.rotation.y = Math.PI / 2;
      add(new THREE.BoxGeometry(5.6, 0.6, 16.4), dark, 0, 19.2, 0);
      break;
    }
    case 'lake': {
      const water = add(
        new THREE.CircleGeometry(12, 40),
        std('#7fd1e8', { roughness: 0.15 }),
        0,
        0.12,
        0
      );
      water.rotation.x = -Math.PI / 2;
      add(
        new THREE.CylinderGeometry(2, 2.3, 0.8, 16),
        std('#9bc27a'),
        0,
        0.4,
        0
      );
      add(new THREE.BoxGeometry(2, 3.4, 2), white, 0, 2.5, 0);
      add(new THREE.BoxGeometry(1.4, 2, 1.4), white, 0, 5.2, 0);
      const r = add(new THREE.ConeGeometry(1.8, 1.3, 4), acc, 0, 6.8, 0);
      r.rotation.y = Math.PI / 4;
      break;
    }
    case 'crossing': {
      for (let i = 0; i < 3; i++) {
        const h = 16 + i * 5;
        add(
          new THREE.BoxGeometry(8, h, 7),
          std(i % 2 === 0 ? '#5a5f80' : '#7a7fa0'),
          4 + i * 2,
          h / 2,
          -9 + i * 9
        );
        const screen = add(
          new THREE.PlaneGeometry(6, 3.6),
          new THREE.MeshBasicMaterial({
            color: i % 2 === 0 ? accent : '#5ee6ff',
          }),
          4 + i * 2 - 4.01,
          h - 3,
          -9 + i * 9
        );
        screen.rotation.y = -Math.PI / 2;
      }
      break;
    }
    case 'basilica': {
      const hill = add(
        new THREE.SphereGeometry(14, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2),
        std('#b8d89a'),
        4,
        -8,
        0
      );
      hill.scale.set(1, 1, 1.3);
      add(new THREE.BoxGeometry(10, 6, 12), white, 4, 6.5, 0);
      add(new THREE.CylinderGeometry(3, 3, 2.5, 20), white, 4, 10.6, 0);
      add(
        new THREE.SphereGeometry(3, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
        white,
        4,
        11.8,
        0
      );
      add(
        new THREE.SphereGeometry(1.4, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2),
        white,
        4,
        9.5,
        -4.6
      );
      add(
        new THREE.SphereGeometry(1.4, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2),
        white,
        4,
        9.5,
        4.6
      );
      add(new THREE.ConeGeometry(0.3, 2, 8), acc, 4, 15.8, 0);
      break;
    }
  }
  return g;
};
