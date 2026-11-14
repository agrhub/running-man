import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Batch, box, canvasTex, colorize, type Rand } from './geo';
import { TERRAIN_GROUND, buildTerrain } from './terrain';
import type { City, CityId, Landmark, Stage } from '../../shared/content';
import { isBooster, isPickup, type CourseItem } from '../../shared/course';
import { buildBoosterItem } from './boosters';
import { buildObstacle } from './obstacles';
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
/** Half a lane: where the lane ropes float between swim lanes. */
const LANE_GAP = 1.15;

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
  dubai: [
    {
      wall: '#f2f5f7',
      glass: ['#9fd0e6', '#2a5a78'],
      win: [0.04, 0.22, 0.96, 0.96],
      bands: true,
    },
    {
      wall: '#f1e4cf',
      glass: ['#a9b9c4', '#3b4651'],
      win: [0.25, 0.3, 0.75, 0.8],
      frame: '#e3d2b4',
      shutters: '#b8875a',
    },
  ],
  amazon: [
    {
      wall: '#ffffff',
      glass: ['#7f97a6', '#2a343d'],
      win: [0.3, 0.2, 0.7, 0.85],
      frame: '#ffffff',
      shutters: '#2f8f5b',
    },
    {
      wall: '#ffffff',
      glass: ['#8aa0ad', '#26313a'],
      win: [0.26, 0.24, 0.74, 0.84],
      frame: '#f4ead8',
      balcony: true,
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
  // Manaus: colonial facades in bright paint.
  amazon: ['#ffd36e', '#f6a6c1', '#9ad7ea', '#b6e3a1', '#ffb38a', '#f3e6c4'],
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
  dubai: ['#f4efe6', '#e9dcc6', '#dbe7ee', '#f1e4cf', '#cfdde6', '#efe7da'],
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
  /** Animates traffic, crowds, birds and the finish party. `camZ` follows the player. */
  update(t: number, dt: number, camZ: number, finished: boolean): void;
  /** Evening: lamps and shop windows glow (0 day .. 1 night). */
  setNight(k: number): void;
};

export const buildCity = (
  city: City,
  stage: Stage,
  shadows: boolean,
  triathlon = false
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

  const terrain = stage.terrain;
  const urban = terrain === 'city';
  const look = urban ? null : TERRAIN_GROUND[terrain];

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
    color: look
      ? look.path
      : city.id === 'paris'
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
    new THREE.MeshStandardMaterial({
      color: look ? look.ground : city.palette.ground,
      roughness: 1,
    })
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
  if (urban) for (let z = zStart - 18; z > zEnd; z -= BLOCK) crossZs.push(z);
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
    // Marshals in orange vests hold the traffic at the closed avenue.
    for (const side of [-1, 1]) {
      const mx = side * (FRONT_X + 0.9);
      const mz = cz + side * (CROSS_W / 2 - 0.6);
      batch.push(
        solid,
        colorize(
          new THREE.CapsuleGeometry(0.22, 0.5, 3, 8).translate(mx, 0.72, mz),
          '#ff7a1a'
        )
      );
      batch.push(
        solid,
        colorize(
          new THREE.SphereGeometry(0.22, 10, 8).translate(mx, 1.35, mz),
          '#f6cfa8'
        )
      );
      batch.push(
        solid,
        box(0.05, 0.05, 0.7, mx, 1.0, mz - side * 0.4, '#ffd23f')
      );
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
      case 'dubai':
        return row === 0
          ? 4 + Math.floor(rand() * 8)
          : 12 + Math.floor(rand() * 24);
      case 'amazon':
        return row === 0
          ? 2 + Math.floor(rand() * 3)
          : 3 + Math.floor(rand() * 6);
    }
  };

  for (let i = 0; urban && i <= crossZs.length; i++) {
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
  // Parks, forests, zoos, hills, beaches and deserts get their own scenery.
  const life = urban
    ? null
    : buildTerrain({
        group,
        batch,
        mats: { solid, greens, metal, glow },
        rand,
        zStart,
        zEnd,
        frontX: FRONT_X,
        terrain,
        cityId: city.id,
        inPlaza,
        hotel: (x0, x1, z0, z1, floors, face) => {
          if (!stage.wild)
            building({ x0, x1, z0, z1, floors, face, front: true });
        },
        shadows,
      });
  if (shopGeos.length > 0) {
    const merged = mergeGeometries(shopGeos, false);
    shopGeos.forEach((g) => g.dispose());
    if (merged) group.add(new THREE.Mesh(merged, shopMat));
    shopGeos.length = 0;
  }

  // Far skyline: big simple blocks swallowed by fog (only where a city is in sight)
  const skyline = stage.wild
    ? 0
    : urban || terrain === 'beach'
      ? 40
      : terrain === 'park' || terrain === 'zoo'
        ? 16
        : 0;
  for (let k = 0; k < skyline; k++) {
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
  const lamps = terrain !== 'forest' && terrain !== 'desert';
  for (let z = zStart; lamps && z > zEnd; z -= 13) {
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
  const streetTrees = urban || terrain === 'park' || terrain === 'hills';
  for (let z = zStart - 6; streetTrees && z > zEnd; z -= 9.5) {
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
  if (urban && city.id === 'hanoi') {
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
  const crowdParts: THREE.BufferGeometry[][] = [[], [], []];
  let crowdN = 0;
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
      const crowd = crowdParts[crowdN++ % 3] ?? [];
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
  const crowdMeshes: THREE.Mesh[] = [];
  for (const part of crowdParts) {
    if (part.length === 0) continue;
    const merged = mergeGeometries(part, false);
    part.forEach((g) => g.dispose());
    if (!merged) continue;
    const m = new THREE.Mesh(merged, crowdMat);
    m.castShadow = shadows;
    group.add(m);
    crowdMeshes.push(m);
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
  gantry(0, triathlon ? 'SWIM START' : 'START', null);
  for (let km = 1; km < COURSE_KM; km++)
    gantry(
      kmZ(km),
      triathlon && km === 1
        ? 'T1 · BIKE'
        : triathlon && km === 4
          ? 'T2 · RUN'
          : `${km} km`,
      null
    );
  if (triathlon) {
    // The swim: the first km of the avenue is flooded into a pool with lane ropes.
    const pool = new THREE.Mesh(
      new THREE.PlaneGeometry(ROAD_HALF * 2, UNITS_PER_KM + 6),
      new THREE.MeshStandardMaterial({
        color: '#2f9fd6',
        roughness: 0.15,
        metalness: 0.1,
        transparent: true,
        opacity: 0.92,
      })
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(0, 0.035, kmZ(0.5) + 2);
    group.add(pool);
    const floats: THREE.BufferGeometry[] = [];
    const ball = new THREE.SphereGeometry(0.11, 8, 6);
    for (const x of [-LANE_GAP, LANE_GAP])
      for (let z = 4; z > kmZ(1); z -= 0.5)
        floats.push(
          colorize(
            ball.clone().translate(x, 0.08, z),
            Math.round(z * 2) % 4 === 0 ? '#e63946' : '#ffffff'
          )
        );
    ball.dispose();
    const merged = mergeGeometries(floats, false);
    floats.forEach((g) => g.dispose());
    if (merged)
      group.add(
        new THREE.Mesh(
          merged,
          new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4 })
        )
      );
  }
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
  const lm = buildLandmark(
    stage.landmark,
    city.palette.accent,
    stage.wild ?? false
  );
  lm.position.copy(lmPos);
  lm.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = shadows;
      o.receiveShadow = true;
    }
  });
  group.add(lm);

  batch.flush(group, shadows);

  const traffic = buildTraffic(group, crossZs, city.id, rand, shadows);
  const sky = buildSkyLife(group, rand);
  const party = buildParty(group, city.palette.accent, shadows);

  return {
    group,
    landmark: lmPos,
    update: (t: number, dt: number, camZ: number, finished: boolean) => {
      crowdMeshes.forEach((m, i) => {
        m.position.y = Math.abs(Math.sin(t * 6 + i * 2.1)) * 0.07;
      });
      traffic(t, dt, camZ);
      life?.update(t, dt, camZ);
      sky(t, dt, camZ);
      party(t, dt, camZ, finished);
    },
    setNight: (k: number) => {
      glow.color.setScalar(1 + k * 1.5);
      shopMat.emissiveIntensity = 0.25 + k * 1.1;
      for (const m of facadeMats) {
        m.emissive.set('#ffcf7a');
        m.emissiveIntensity = k * 0.16;
      }
    },
  };
};
const TOUR_LANDMARKS: Landmark['kind'][] = [
  'wall',
  'pyramid',
  'terraces',
  'colosseum',
  'mausoleum',
  'angkor',
  'stones',
  'treasury',
  'karst',
  'canyon',
  'falls',
  'moai',
];

const buildLandmark = (
  lm: Landmark,
  accent: string,
  wild = false
): THREE.Group => {
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
    case 'opera': {
      // The Amazon Theatre: a pink colonnaded front and a dome of coloured tiles.
      const pink = std('#f4a6b8');
      add(new THREE.BoxGeometry(9, 1, 14), white, 0, 0.5, 0);
      add(new THREE.BoxGeometry(7, 6, 12), pink, 0, 4, 0);
      for (let i = -2; i <= 2; i++)
        add(
          new THREE.CylinderGeometry(0.3, 0.3, 5, 10),
          white,
          -3.7,
          3.5,
          i * 2.4
        );
      add(new THREE.BoxGeometry(1.4, 1.2, 12.4), white, -3.6, 7.2, 0);
      add(new THREE.CylinderGeometry(2.6, 2.8, 1.6, 20), pink, 0.6, 7.8, 0);
      const tiles = ['#2e7d32', '#ffd166', '#1d6fd1'];
      for (let k = 0; k < 3; k++) {
        const band = add(
          new THREE.SphereGeometry(
            3 - k * 0.15,
            24,
            6,
            0,
            Math.PI * 2,
            (k * Math.PI) / 7,
            Math.PI / 7
          ),
          std(tiles[k] ?? '#ffd166', { roughness: 0.4 }),
          0.6,
          8.4,
          0
        );
        band.rotation.x = 0;
      }
      add(new THREE.ConeGeometry(0.4, 1.6, 10), std('#ffd166'), 0.6, 11.9, 0);
      break;
    }
    case 'kapok': {
      // A giant kapok: buttress roots, a tall pale trunk and a flat crown above the forest.
      const bark = std('#b8a88a');
      add(new THREE.CylinderGeometry(1.1, 1.6, 22, 12), bark, 0, 11, 0);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        const fin = add(
          new THREE.BoxGeometry(0.5, 4, 3.4),
          bark,
          Math.cos(a) * 1.6,
          2,
          Math.sin(a) * 1.6
        );
        fin.rotation.y = -a;
      }
      for (const [r, y] of [
        [9, 22],
        [7, 24],
        [5, 25.5],
      ] as const)
        add(
          new THREE.SphereGeometry(r, 16, 8).scale(1, 0.32, 1),
          std('#2f7d3a'),
          0,
          y,
          0
        );
      break;
    }
    case 'canopy': {
      // Two towers in the trees joined by a rope bridge high above the trail.
      const wood = std('#8b5e3c');
      for (const z of [-9, 9]) {
        add(
          new THREE.CylinderGeometry(0.9, 1.2, 16, 10),
          std('#a89b80'),
          0,
          8,
          z
        );
        add(new THREE.CylinderGeometry(3, 3, 0.5, 12), wood, 0, 12, z);
        add(
          new THREE.SphereGeometry(5, 14, 8).scale(1, 0.5, 1),
          std('#2a7d3b'),
          0,
          17,
          z
        );
      }
      for (let i = 0; i <= 12; i++) {
        const z = -7.5 + i * 1.25;
        const sag = Math.sin((i / 12) * Math.PI) * 1.4;
        add(new THREE.BoxGeometry(1.4, 0.12, 0.9), wood, 0, 12 - sag, z);
      }
      for (const x of [-0.7, 0.7]) {
        const rope = add(
          new THREE.TorusGeometry(9, 0.05, 4, 30, Math.PI),
          std('#e9d8a6'),
          x,
          13.4 + 7.9,
          0
        );
        rope.rotation.y = Math.PI / 2;
        rope.rotation.z = Math.PI;
        rope.scale.set(1, 0.18, 1);
      }
      break;
    }
    case 'stilt': {
      // Wooden houses on stilts over the river, with a canoe tied below.
      const water = add(
        new THREE.PlaneGeometry(16, 26),
        std('#7a5a34', { roughness: 0.25 }),
        0,
        0.1,
        0
      );
      water.rotation.x = -Math.PI / 2;
      const walls = ['#ffd166', '#4fc3f7', '#f4a6b8'];
      for (let k = 0; k < 3; k++) {
        const z = -8 + k * 8;
        for (const dx of [-1.6, 1.6])
          for (const dz of [-1.6, 1.6])
            add(
              new THREE.CylinderGeometry(0.15, 0.15, 3, 6),
              std('#6b4f36'),
              dx,
              1.5,
              z + dz
            );
        add(new THREE.BoxGeometry(4, 0.3, 4), std('#8b5e3c'), 0, 3.1, z);
        add(
          new THREE.BoxGeometry(3.4, 2.4, 3.4),
          std(walls[k] ?? '#ffd166'),
          0,
          4.4,
          z
        );
        const roof = add(
          new THREE.ConeGeometry(3, 1.6, 4),
          std('#c96f3b'),
          0,
          6.4,
          z
        );
        roof.rotation.y = Math.PI / 4;
      }
      const canoe = add(
        new THREE.CapsuleGeometry(0.4, 3, 4, 10).rotateX(Math.PI / 2),
        std('#8b5a2b'),
        3.5,
        0.3,
        2
      );
      canoe.scale.y = 0.45;
      break;
    }
    case 'meeting': {
      // The Meeting of the Waters: dark and sandy rivers side by side, with a boat.
      const dark = add(
        new THREE.PlaneGeometry(10, 40),
        std('#2b1d12', { roughness: 0.2 }),
        -5,
        0.12,
        0
      );
      dark.rotation.x = -Math.PI / 2;
      const sandy = add(
        new THREE.PlaneGeometry(10, 40),
        std('#c9a26b', { roughness: 0.3 }),
        5,
        0.12,
        0
      );
      sandy.rotation.x = -Math.PI / 2;
      add(new THREE.BoxGeometry(2.2, 1, 6), white, 0, 0.6, 2);
      add(new THREE.BoxGeometry(1.8, 1.2, 3), std('#1d6fd1'), 0, 1.7, 2.6);
      break;
    }
    case 'river': {
      // The black Rio Negro behind a white sand beach.
      const sand = add(
        new THREE.PlaneGeometry(10, 34),
        std('#fff4dc'),
        0,
        0.1,
        0
      );
      sand.rotation.x = -Math.PI / 2;
      const water = add(
        new THREE.PlaneGeometry(14, 34),
        std('#2b1d12', { roughness: 0.15 }),
        10,
        0.11,
        0
      );
      water.rotation.x = -Math.PI / 2;
      for (let k = 0; k < 3; k++) {
        add(
          new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6),
          white,
          -1 + k * 2,
          1.2,
          -6 + k * 6
        );
        add(
          new THREE.ConeGeometry(1.6, 0.7, 10),
          std(k % 2 ? '#ffd166' : '#ff5d73'),
          -1 + k * 2,
          2.5,
          -6 + k * 6
        );
      }
      break;
    }
    case 'lilies': {
      // A lagoon of giant water lilies, leaves with upturned rims and a few flowers.
      const water = add(
        new THREE.CircleGeometry(12, 40),
        std('#3f6f4a', { roughness: 0.15 }),
        0,
        0.12,
        0
      );
      water.rotation.x = -Math.PI / 2;
      for (let k = 0; k < 9; k++) {
        const a = k * 2.1;
        const r = 2 + (k % 3) * 3;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        add(
          new THREE.CylinderGeometry(1.5, 1.5, 0.12, 20),
          std('#3fa34d'),
          x,
          0.25,
          z
        );
        add(
          new THREE.TorusGeometry(1.5, 0.1, 6, 20).rotateX(Math.PI / 2),
          std('#8a2f3f'),
          x,
          0.33,
          z
        );
        if (k % 3 === 0)
          add(
            new THREE.SphereGeometry(0.35, 10, 8),
            std('#ffd6e5'),
            x + 0.6,
            0.6,
            z
          );
      }
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
    case 'sail': {
      // a sail-shaped tower on its own island
      const island = add(
        new THREE.CylinderGeometry(9, 10, 1, 24),
        std('#e8d3a6'),
        6,
        0.3,
        0
      );
      island.scale.z = 0.8;
      const sail = new THREE.Shape();
      sail.moveTo(0, 0);
      sail.quadraticCurveTo(9, 14, 1.5, 32);
      sail.lineTo(0, 32);
      sail.lineTo(0, 0);
      const body = add(
        new THREE.ExtrudeGeometry(sail, { depth: 6, bevelEnabled: false }),
        std('#f7f9fb', { roughness: 0.3 }),
        2,
        0.8,
        -3
      );
      body.rotation.y = -Math.PI / 2;
      add(new THREE.CylinderGeometry(0.35, 0.35, 34, 8), white, 2, 17.5, 3.3);
      add(new THREE.CylinderGeometry(2.2, 2.2, 0.4, 20), acc, 6, 22, 0);
      break;
    }
    case 'wheel': {
      const wheel = new THREE.Group();
      wheel.position.set(4, 16, 0);
      g.add(wheel);
      const rim = new THREE.Mesh(
        new THREE.TorusGeometry(13, 0.35, 8, 48),
        white
      );
      rim.rotation.y = Math.PI / 2;
      wheel.add(rim);
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const spoke = new THREE.Mesh(
          new THREE.CylinderGeometry(0.06, 0.06, 13, 4),
          white
        );
        spoke.position.set(0, Math.cos(a) * 6.5, Math.sin(a) * 6.5);
        spoke.rotation.x = a;
        wheel.add(spoke);
        const cabin = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.5, 0.8, 4, 8),
          acc
        );
        cabin.position.set(0, Math.cos(a) * 13.4, Math.sin(a) * 13.4);
        cabin.rotation.x = Math.PI / 2;
        wheel.add(cabin);
      }
      add(
        new THREE.CylinderGeometry(0.6, 0.6, 18, 8),
        white,
        4,
        8,
        -4
      ).rotation.x = 0.25;
      add(
        new THREE.CylinderGeometry(0.6, 0.6, 18, 8),
        white,
        4,
        8,
        4
      ).rotation.x = -0.25;
      break;
    }
    case 'fort': {
      const mud = std('#c9a46b');
      const dark = std('#a8834f');
      add(new THREE.BoxGeometry(10, 5, 10), mud, 2, 2.5, 0);
      for (let i = -4; i <= 4; i += 2) {
        add(new THREE.BoxGeometry(0.8, 0.8, 0.8), mud, 2 - 5, 5.4, i);
        add(new THREE.BoxGeometry(0.8, 0.8, 0.8), mud, 2 + i, 5.4, -5);
        add(new THREE.BoxGeometry(0.8, 0.8, 0.8), mud, 2 + i, 5.4, 5);
      }
      add(new THREE.CylinderGeometry(2, 2.3, 9, 16), mud, -3, 4.5, -5);
      add(new THREE.CylinderGeometry(2.1, 2.1, 0.6, 16), dark, -3, 9.2, -5);
      add(new THREE.BoxGeometry(0.2, 2.6, 2), std('#5b3a24'), -3.05, 1.3, 1.5);
      add(new THREE.CylinderGeometry(0.05, 0.05, 3, 4), dark, -3, 11, -5);
      add(new THREE.PlaneGeometry(1.6, 1), acc, -3, 12, -4.2).rotation.y =
        Math.PI / 2;
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
    // ---------------------------------------------------------------- World Tour
    case 'wall': {
      // Ramparts snaking over the hills, with square watchtowers.
      const stone = std('#cdb88f');
      const top = std('#b39e74');
      for (let i = -6; i <= 6; i++) {
        const z = i * 4;
        const y = 4.2 - Math.abs(i) * 0.55 + Math.sin(i * 0.9) * 0.6;
        // Solid from the ground up, so the wall rises and dips with the hill.
        const seg = add(
          new THREE.BoxGeometry(2.6, y + 1.1, 4.2),
          stone,
          3 + Math.sin(i * 0.5) * 2,
          (y + 1.1) / 2,
          z
        );
        seg.rotation.y = Math.sin(i * 0.5) * 0.35;
        for (let k = -1; k <= 1; k += 2)
          add(
            new THREE.BoxGeometry(0.5, 0.6, 0.8),
            top,
            seg.position.x + k * 1.1,
            y + 1.4,
            z
          );
        if (i % 4 === 0) {
          add(
            new THREE.BoxGeometry(3.6, 4.2, 3.6),
            stone,
            seg.position.x,
            y + 1.6,
            z
          );
          add(
            new THREE.BoxGeometry(4, 0.5, 4),
            top,
            seg.position.x,
            y + 3.9,
            z
          );
          add(
            new THREE.ConeGeometry(2.6, 1.6, 4),
            std('#7a3b2e'),
            seg.position.x,
            y + 4.9,
            z
          ).rotation.y = Math.PI / 4;
        }
      }
      break;
    }
    case 'pyramid': {
      const sand = std('#e2c286');
      const cone = (r: number, h: number, x: number, z: number) =>
        (add(new THREE.ConeGeometry(r, h, 4), sand, x, h / 2, z).rotation.y =
          Math.PI / 4);
      cone(13, 17, 12, -4);
      cone(10, 13, 6, 14);
      cone(6, 8, 2, 26);
      // The Sphinx, lying in front.
      const lion = std('#d4b075');
      add(new THREE.BoxGeometry(2.4, 2, 6), lion, -1, 1, -18);
      add(new THREE.BoxGeometry(2, 2.6, 2), lion, -1, 2.4, -14.6);
      add(new THREE.BoxGeometry(2.6, 1.6, 0.6), std('#3b5e8c'), -1, 2.8, -14.2);
      break;
    }
    case 'terraces': {
      // Stepped green terraces up a peak, stone houses, and Huayna Picchu behind.
      const grass = std('#7fbf5f');
      const stone = std('#bdb6a3');
      for (let i = 0; i < 6; i++) {
        add(
          new THREE.BoxGeometry(14 - i * 1.6, 1.2, 26 - i * 2.4),
          grass,
          6 + i * 0.8,
          0.6 + i * 1.2,
          0
        );
        add(
          new THREE.BoxGeometry(14.2 - i * 1.6, 0.5, 26.2 - i * 2.4),
          stone,
          6 + i * 0.8,
          0.1 + i * 1.2,
          0
        );
      }
      for (let k = -2; k <= 2; k++) {
        add(new THREE.BoxGeometry(2, 1.6, 2.4), stone, 9, 8, k * 3.2);
        add(
          new THREE.ConeGeometry(1.7, 1.4, 4),
          std('#a07a4a'),
          9,
          9.5,
          k * 3.2
        ).rotation.y = Math.PI / 4;
      }
      const peak = add(
        new THREE.ConeGeometry(7, 26, 7),
        std('#5f8f4a'),
        22,
        13,
        6
      );
      peak.scale.set(1, 1, 0.8);
      add(new THREE.ConeGeometry(2.4, 6, 7), std('#6d6a60'), 22, 24, 6);
      break;
    }
    case 'colosseum': {
      const tufa = std('#e0bf8f');
      const shade = std('#7a5a3c');
      const ring = new THREE.Group();
      for (let i = 0; i < 28; i++) {
        const a = (i / 28) * Math.PI * 2;
        const tall = Math.cos(a) > -0.2;
        const h = tall ? 11 : 7;
        const x = Math.cos(a) * 10;
        const z = Math.sin(a) * 13;
        const pier = new THREE.Mesh(new THREE.BoxGeometry(1.1, h, 1.4), tufa);
        pier.position.set(x, h / 2, z);
        pier.rotation.y = -a;
        ring.add(pier);
        for (let f = 0; f < (tall ? 3 : 2); f++) {
          const arch = new THREE.Mesh(
            new THREE.BoxGeometry(0.4, 1.6, 1.1),
            shade
          );
          arch.position.set(
            Math.cos(a + 0.11) * 10.2,
            1.6 + f * 3.4,
            Math.sin(a + 0.11) * 13.2
          );
          arch.rotation.y = -a;
          ring.add(arch);
        }
      }
      ring.position.set(12, 0, 0);
      g.add(ring);
      // Cornices: oval rings (a torus laid flat, stretched along the road).
      for (const y of [3.4, 6.8, 10.4]) {
        const band = add(
          new THREE.TorusGeometry(10.4, 0.35, 6, 40),
          tufa,
          12,
          y,
          0
        );
        band.rotation.x = Math.PI / 2;
        band.scale.set(1, 1.27, 1);
      }
      add(
        new THREE.CylinderGeometry(8, 8, 0.4, 28),
        std('#d9c09a'),
        12,
        0.2,
        0
      ).scale.set(1, 1, 1.3);
      break;
    }
    case 'mausoleum': {
      // White marble, onion dome, four minarets and the reflecting pool.
      const marble = std('#fbf8f2', { roughness: 0.4 });
      add(new THREE.BoxGeometry(22, 1.2, 22), marble, 12, 0.6, 0);
      add(new THREE.BoxGeometry(12, 9, 12), marble, 12, 5.7, 0);
      add(new THREE.BoxGeometry(0.4, 6, 5), std('#e4dccd'), 5.9, 4.6, 0);
      add(new THREE.CylinderGeometry(3.6, 3.6, 2.6, 20), marble, 12, 11.4, 0);
      const dome = add(
        new THREE.SphereGeometry(4.4, 22, 16),
        marble,
        12,
        14.6,
        0
      );
      dome.scale.set(1, 1.15, 1);
      add(new THREE.ConeGeometry(0.5, 3.2, 10), std('#d4b04a'), 12, 20.4, 0);
      for (const [dx, dz] of [
        [-9, -9],
        [-9, 9],
        [9, -9],
        [9, 9],
      ] as const) {
        add(
          new THREE.CylinderGeometry(0.7, 0.9, 14, 12),
          marble,
          12 + dx,
          7.6,
          dz
        );
        add(new THREE.SphereGeometry(1.1, 12, 8), marble, 12 + dx, 15.4, dz);
      }
      for (const dz of [-4, 4]) {
        add(
          new THREE.CylinderGeometry(1.4, 1.4, 1.4, 14),
          marble,
          12,
          10.6,
          dz * 1.1
        );
        add(new THREE.SphereGeometry(1.6, 12, 8), marble, 12, 12, dz * 1.1);
      }
      // The long reflecting pool runs from the garden towards the road.
      const pool = add(
        new THREE.PlaneGeometry(8, 3),
        std('#7fc8e6', { roughness: 0.15 }),
        1.5,
        0.08,
        0
      );
      pool.rotation.x = -Math.PI / 2;
      break;
    }
    case 'angkor': {
      // Five lotus-bud towers over a stepped base, with the moat in front.
      const sand = std('#b8a07a');
      const dark = std('#8f7a58');
      add(new THREE.BoxGeometry(22, 2, 26), sand, 12, 1, 0);
      add(new THREE.BoxGeometry(16, 2, 20), dark, 12, 3, 0);
      add(new THREE.BoxGeometry(10, 2, 13), sand, 12, 5, 0);
      const bud = (x: number, z: number, h: number) => {
        for (let i = 0; i < 5; i++)
          add(
            new THREE.CylinderGeometry(
              1.9 - i * 0.35,
              2.1 - i * 0.35,
              h / 5,
              8
            ),
            i % 2 ? dark : sand,
            x,
            6 + (h / 5) * (i + 0.5),
            z
          );
        add(new THREE.ConeGeometry(0.5, 2.4, 8), sand, x, 6 + h + 1.2, z);
      };
      bud(12, 0, 13);
      for (const [dx, dz] of [
        [-4, -6],
        [-4, 6],
        [4, -6],
        [4, 6],
      ] as const)
        bud(12 + dx, dz, 8);
      const moat = add(
        new THREE.PlaneGeometry(5, 30),
        std('#5aa8b8', { roughness: 0.2 }),
        -0.5,
        0.06,
        0
      );
      moat.rotation.x = -Math.PI / 2;
      break;
    }
    case 'stones': {
      // Sarsen circle with lintels, and the inner trilithons.
      const stone = std('#a9a497');
      const r = 8;
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        if (i === 5 || i === 11) continue; // fallen stones
        const s = add(
          new THREE.BoxGeometry(1.2, 4.6, 2),
          stone,
          10 + Math.cos(a) * r,
          2.3,
          Math.sin(a) * r
        );
        s.rotation.y = -a;
        if (i % 2 === 0 && i !== 4 && i !== 10) {
          const l = add(
            new THREE.BoxGeometry(1, 0.8, 4.4),
            stone,
            10 + Math.cos(a + 0.2) * r,
            5,
            Math.sin(a + 0.2) * r
          );
          l.rotation.y = -a - 0.2;
        }
      }
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI + Math.PI / 2;
        const x = 10 + Math.cos(a) * 4;
        const z = Math.sin(a) * 4;
        add(new THREE.BoxGeometry(1.4, 6, 1.4), stone, x, 3, z - 1);
        add(new THREE.BoxGeometry(1.4, 6, 1.4), stone, x, 3, z + 1);
        add(new THREE.BoxGeometry(1.6, 1, 3.6), stone, x, 6.5, z);
      }
      const fallen = add(
        new THREE.BoxGeometry(1.2, 4.6, 2),
        stone,
        10 + r * 0.6,
        0.6,
        r * 0.9
      );
      fallen.rotation.z = Math.PI / 2;
      break;
    }
    case 'treasury': {
      // A temple front carved into a rose cliff.
      const rock = std('#d1866a');
      const carved = std('#e3a184');
      const deep = std('#7a3f30');
      add(new THREE.BoxGeometry(8, 30, 40), rock, 14, 15, 0);
      add(new THREE.BoxGeometry(1, 22, 14), carved, 9.6, 11, 0);
      for (let k = -3; k <= 3; k++)
        if (k !== 0)
          add(
            new THREE.CylinderGeometry(0.55, 0.55, 8, 10),
            carved,
            8.8,
            4.6,
            k * 1.9
          );
      add(new THREE.BoxGeometry(1.4, 1, 14), carved, 8.8, 9, 0);
      add(new THREE.ConeGeometry(7.4, 3, 4, 1), carved, 8.9, 11.2, 0).scale.set(
        0.2,
        1,
        1
      );
      add(new THREE.CylinderGeometry(1.8, 1.8, 6, 12), carved, 9, 16.4, 0);
      add(new THREE.ConeGeometry(2, 1.8, 12), carved, 9, 20.3, 0);
      for (const dz of [-5.2, 5.2])
        add(new THREE.BoxGeometry(1.2, 6, 3), carved, 9, 16.2, dz);
      add(new THREE.BoxGeometry(0.4, 4.2, 2.4), deep, 9, 2.1, 0);
      break;
    }
    case 'karst': {
      // Limestone towers rising from green water, and a junk with a red sail.
      const sea = add(
        new THREE.PlaneGeometry(40, 60),
        std('#3fb3a5', { roughness: 0.15 }),
        16,
        0.05,
        0
      );
      sea.rotation.x = -Math.PI / 2;
      const rock = std('#8a9a8a');
      const green = std('#5f9a5a');
      const towers: [number, number, number, number][] = [
        [8, -12, 3.2, 11],
        [14, -2, 4, 15],
        [10, 9, 2.6, 9],
        [22, 12, 4.4, 17],
        [24, -14, 3.6, 13],
        [30, 2, 5, 19],
      ];
      for (const [x, z, r, h] of towers) {
        const t = add(
          new THREE.CylinderGeometry(r * 0.75, r, h, 8),
          rock,
          x,
          h / 2,
          z
        );
        t.rotation.y = x;
        add(new THREE.SphereGeometry(r * 0.8, 8, 6), green, x, h, z).scale.set(
          1,
          0.55,
          1
        );
      }
      add(new THREE.BoxGeometry(1.6, 0.8, 4.2), std('#7a4a2a'), 5, 0.5, 2);
      add(
        new THREE.PlaneGeometry(3.2, 3.4),
        std('#c0392b', { side: THREE.DoubleSide }),
        5,
        2.8,
        2
      ).rotation.y = Math.PI / 2;
      break;
    }
    case 'canyon': {
      // Banded buttes and mesas, red and gold, like the view from the rim.
      const bands = ['#9c3d22', '#c1562a', '#e3a36f', '#b5482a', '#d9824f'];
      const butte = (x: number, z: number, w: number, d: number, n: number) => {
        for (let i = 0; i < n; i++) {
          const k = 1 - i * 0.12;
          add(
            new THREE.BoxGeometry(w * k, 2.4, d * k),
            std(bands[i % bands.length]!),
            x,
            1.2 + i * 2.4,
            z
          );
        }
      };
      butte(12, -6, 12, 22, 5);
      butte(22, 12, 9, 14, 7);
      butte(30, -14, 14, 12, 4);
      butte(8, 16, 6, 8, 3);
      add(new THREE.BoxGeometry(3, 9, 3), std('#b5482a'), 20, 4.5, -18);
      add(new THREE.BoxGeometry(1.6, 1.4, 30), std('#8a6a4a'), 3, 0.7, 0);
      break;
    }
    case 'falls': {
      // A curved cliff with white water pouring over, mist and a rainbow.
      const cliff = std('#6f7c6a');
      const water = std('#d9f2ff', {
        roughness: 0.1,
        transparent: true,
        opacity: 0.9,
      });
      for (let i = -5; i <= 5; i++) {
        const a = i * 0.16;
        const x = 18 - Math.cos(a) * 10;
        const z = Math.sin(a) * 20;
        const rock = add(
          new THREE.BoxGeometry(3, 10, 4.2),
          cliff,
          x + 1.4,
          5,
          z
        );
        rock.rotation.y = a;
        const fall = add(
          new THREE.BoxGeometry(0.6, 9.6, 4.2),
          water,
          x - 0.4,
          5,
          z
        );
        fall.rotation.y = a;
      }
      const basin = add(
        new THREE.PlaneGeometry(12, 44),
        std('#4fa6c8', { roughness: 0.2 }),
        4,
        0.06,
        0
      );
      basin.rotation.x = -Math.PI / 2;
      for (let k = 0; k < 6; k++)
        add(
          new THREE.SphereGeometry(2.4, 8, 6),
          std('#ffffff', { transparent: true, opacity: 0.55 }),
          6 + (k % 2),
          1.4,
          -12 + k * 5
        );
      const colors = [
        '#ff6b6b',
        '#ffb347',
        '#ffe66d',
        '#6bd47a',
        '#5ab0ff',
        '#9b7bff',
      ];
      colors.forEach((c, i) => {
        const arc = add(
          new THREE.TorusGeometry(12 - i * 0.45, 0.22, 6, 30, Math.PI),
          std(c, { transparent: true, opacity: 0.7 }),
          4,
          0,
          0
        );
        arc.rotation.y = Math.PI / 2;
      });
      break;
    }
    case 'moai': {
      // A row of stone heads on their platform, backs to the sea.
      const tuff = std('#7d7466');
      const hat = std('#a5523b');
      add(new THREE.BoxGeometry(4, 1.2, 34), std('#9a927f'), 8, 0.6, 0);
      for (let i = 0; i < 9; i++) {
        const z = -14 + i * 3.5;
        const h = 5.4 + ((i * 7) % 3) * 0.6;
        add(new THREE.BoxGeometry(2, h, 2.4), tuff, 8, 1.2 + h / 2, z);
        add(new THREE.BoxGeometry(0.9, 2.2, 1.6), tuff, 6.8, 1.2 + h * 0.62, z);
        add(new THREE.BoxGeometry(0.8, 0.5, 2.6), tuff, 7.1, 1.2 + h * 0.8, z);
        if (i % 3 === 1)
          add(new THREE.CylinderGeometry(1, 1, 1, 10), hat, 8, 1.7 + h, z);
      }
      const sea = add(
        new THREE.PlaneGeometry(30, 70),
        std('#3d8fc4', { roughness: 0.15 }),
        26,
        0.04,
        0
      );
      sea.rotation.x = -Math.PI / 2;
      break;
    }
  }
  if (TOUR_LANDMARKS.includes(lm.kind)) {
    // World Tour wonders are big and set further back: pull them towards the
    // road and scale them up so they fill the view as you run in.
    for (const c of g.children) {
      c.position.x -= 4;
      // Out in the open, set it a little further on so it sits in view as you
      // approach; in a town it stays on its plaza.
      if (wild) c.position.z -= 10;
    }
    g.scale.setScalar(1.45);
  }
  return g;
};

/* ---------------------------------------------------------------------------------------------------------------
 * Living city: traffic on the cross streets, birds, the start and finish party, the TV motorbike.
 * ------------------------------------------------------------------------------------------------------------- */

type VehicleKind = 'car' | 'taxi' | 'bus' | 'scooter';

const vehicleMesh = (
  kind: VehicleKind,
  color: string
): { mesh: THREE.Mesh; length: number } => {
  const parts: THREE.BufferGeometry[] = [];
  const wheel = (x: number, z: number, r: number) =>
    parts.push(
      colorize(
        new THREE.CylinderGeometry(r, r, 0.22, 12)
          .rotateX(Math.PI / 2)
          .translate(x, r, z),
        '#1b1b22'
      )
    );
  let length = 3.8;
  if (kind === 'bus') {
    length = 8.4;
    parts.push(box(8.4, 2.4, 2.3, 0, 1.6, 0, color));
    parts.push(box(7.6, 0.8, 2.34, -0.2, 2.1, 0, '#2c3e50'));
    parts.push(box(0.1, 1.2, 2.0, 4.2, 1.9, 0, '#2c3e50'));
    parts.push(box(8.42, 0.2, 2.32, 0, 0.55, 0, '#f4f1ea'));
    for (const x of [-2.9, 2.9])
      for (const z of [-1, 1]) wheel(x, z * 1.05, 0.45);
  } else if (kind === 'scooter') {
    length = 1.6;
    parts.push(box(1.3, 0.35, 0.36, 0, 0.55, 0, color));
    parts.push(box(0.2, 0.7, 0.2, 0.55, 0.85, 0, color));
    parts.push(
      colorize(
        new THREE.CapsuleGeometry(0.2, 0.4, 3, 8).translate(-0.05, 1.15, 0),
        '#3a6ea5'
      )
    );
    parts.push(
      colorize(
        new THREE.SphereGeometry(0.2, 10, 8).translate(0, 1.65, 0),
        '#e63946'
      )
    );
    wheel(-0.5, 0, 0.24);
    wheel(0.55, 0, 0.24);
  } else {
    parts.push(box(3.8, 0.75, 1.75, 0, 0.7, 0, color));
    parts.push(box(2.1, 0.62, 1.55, -0.2, 1.38, 0, '#2f3a48'));
    parts.push(box(1.9, 0.08, 1.6, -0.2, 1.72, 0, color));
    if (kind === 'taxi')
      parts.push(box(0.5, 0.25, 0.3, -0.2, 1.9, 0, '#ffe066'));
    for (const x of [-1.2, 1.2])
      for (const z of [-0.85, 0.85]) wheel(x, z, 0.34);
  }
  const geo = mergeGeometries(parts, false);
  parts.forEach((g) => g.dispose());
  const mesh = new THREE.Mesh(
    geo ?? new THREE.BufferGeometry(),
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.5,
      metalness: 0.15,
    })
  );
  return { mesh, length };
};

type Vehicle = {
  mesh: THREE.Mesh;
  length: number;
  side: 1 | -1;
  cz: number;
  /** Distance from the avenue's edge (always positive). */
  d: number;
  speed: number;
  state: 'toward' | 'wait' | 'turn' | 'away';
  timer: number;
};

const VEHICLE_COLORS = [
  '#e63946',
  '#f1faee',
  '#457b9d',
  '#2a9d8f',
  '#8d99ae',
  '#1d3557',
  '#ffffff',
  '#3d405b',
];

/**
 * The avenue is closed for the race: vehicles drive up to the marshals, wait, turn round and drive away again,
 * so the cross streets stay busy without ever crossing the course.
 */
const buildTraffic = (
  group: THREE.Group,
  crossZs: number[],
  cityId: CityId,
  rand: Rand,
  shadows: boolean
) => {
  const band = FRONT_X + 1.6;
  const far = 92;
  const vehicles: Vehicle[] = [];
  const pick = <T>(arr: T[]): T =>
    arr[Math.floor(rand() * arr.length)] ?? arr[0]!;
  for (const cz of crossZs) {
    for (const side of [-1, 1] as const) {
      const n = cityId === 'hanoi' ? 5 : 3;
      for (let i = 0; i < n; i++) {
        const roll = rand();
        const kind: VehicleKind =
          cityId === 'hanoi'
            ? roll < 0.65
              ? 'scooter'
              : roll < 0.85
                ? 'car'
                : 'bus'
            : roll < 0.12
              ? 'bus'
              : roll < (cityId === 'tokyo' ? 0.45 : 0.3)
                ? 'taxi'
                : roll < 0.6
                  ? 'scooter'
                  : 'car';
        const color =
          kind === 'bus'
            ? cityId === 'paris'
              ? '#2f6fbd'
              : '#ffc72c'
            : kind === 'taxi'
              ? cityId === 'tokyo'
                ? '#2b2d42'
                : '#ffd23f'
              : pick(VEHICLE_COLORS);
        const { mesh, length } = vehicleMesh(kind, color);
        mesh.castShadow = shadows;
        group.add(mesh);
        vehicles.push({
          mesh,
          length,
          side,
          cz,
          d: 4 + rand() * (far - 10),
          speed:
            kind === 'bus'
              ? 5
              : kind === 'scooter'
                ? 8 + rand() * 2
                : 7 + rand() * 3,
          state: rand() < 0.5 ? 'toward' : 'away',
          timer: 0,
        });
      }
    }
  }

  return (_t: number, dt: number, camZ: number) => {
    for (const v of vehicles) {
      // Only animate traffic near the camera; the rest waits in the fog.
      if (v.cz > camZ + 30 || v.cz < camZ - 200) {
        v.mesh.visible = v.cz > camZ - 200 && v.cz < camZ + 30;
        continue;
      }
      v.mesh.visible = true;
      if (v.state === 'toward') {
        // keep a gap behind whoever is queued ahead in the same lane
        let stop = 0;
        for (const o of vehicles) {
          if (o === v || o.cz !== v.cz || o.side !== v.side) continue;
          if (
            (o.state === 'toward' ||
              o.state === 'wait' ||
              o.state === 'turn') &&
            o.d < v.d
          ) {
            stop = Math.max(stop, o.d + o.length / 2 + v.length / 2 + 1.2);
          }
        }
        v.d = Math.max(stop, v.d - v.speed * dt);
        if (v.d <= 0.01 && stop === 0) {
          v.state = 'wait';
          v.timer = 2 + Math.random() * 4;
        }
      } else if (v.state === 'wait') {
        v.timer -= dt;
        if (v.timer <= 0) {
          v.state = 'turn';
          v.timer = 0;
        }
      } else if (v.state === 'turn') {
        v.timer += dt / 1.4;
        if (v.timer >= 1) v.state = 'away';
      } else {
        v.d += v.speed * dt;
        if (v.d > far) {
          v.d = far;
          v.state = 'toward';
        }
      }
      // Toward the avenue on one side of the street, away on the other; a U-turn blends the two.
      const k = v.state === 'turn' ? v.timer : v.state === 'away' ? 1 : 0;
      const laneZ = v.cz + v.side * (k * 1.7 - (1 - k) * 1.7);
      const x =
        v.side *
        (band +
          v.d +
          v.length / 2 +
          (v.state === 'turn' ? Math.sin(k * Math.PI) * 1.5 : 0));
      const heading = v.side > 0 ? Math.PI + k * Math.PI : k * Math.PI;
      v.mesh.position.set(x, 0, laneZ);
      v.mesh.rotation.y = heading;
    }
  };
};

/** Flocks of birds crossing the sky ahead of the runner. */
const buildSkyLife = (group: THREE.Group, rand: Rand) => {
  const mat = new THREE.MeshBasicMaterial({
    color: '#3b3557',
    side: THREE.DoubleSide,
  });
  const wingGeo = new THREE.BufferGeometry();
  wingGeo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [0, 0, 0, -0.5, 0, 0.35, -0.15, 0, 0, 0, 0, 0, 0.5, 0, 0.35, 0.15, 0, 0],
      3
    )
  );
  const flocks = Array.from({ length: 3 }, (_, f) => {
    const flock = new THREE.Group();
    const birds: THREE.Mesh[] = [];
    for (let i = 0; i < 6; i++) {
      const b = new THREE.Mesh(wingGeo, mat);
      b.position.set(-i * 1.2, Math.abs(i - 2.5) * 0.3, (i % 2) * 1.4 - 0.7);
      b.rotation.y = Math.PI / 2;
      flock.add(b);
      birds.push(b);
    }
    group.add(flock);
    return {
      flock,
      birds,
      x: -80 + f * 50 + rand() * 20,
      y: 22 + rand() * 10,
      dz: 40 + f * 30,
      speed: 6 + rand() * 3,
    };
  });
  return (t: number, dt: number, camZ: number) => {
    for (const f of flocks) {
      f.x += f.speed * dt;
      if (f.x > 90) f.x = -90;
      f.flock.position.set(
        f.x,
        f.y + Math.sin(t * 0.7 + f.dz) * 1.5,
        camZ - f.dz
      );
      f.birds.forEach(
        (b, i) => (b.scale.z = 0.4 + Math.abs(Math.sin(t * 9 + i)) * 0.8)
      );
    }
  };
};

/** Balloons at the start and finish, a TV motorbike filming the runner, confetti at the line. */
const buildParty = (group: THREE.Group, accent: string, shadows: boolean) => {
  const colors = [
    accent,
    '#ffc23d',
    '#4fc3f7',
    '#ffffff',
    '#06d6a0',
    '#ff5d73',
  ];
  const balloons: { m: THREE.Mesh; base: number; phase: number }[] = [];
  for (const z of [0, kmZ(COURSE_KM)]) {
    for (const side of [-1, 1]) {
      for (let i = 0; i < 7; i++) {
        const m = new THREE.Mesh(
          new THREE.SphereGeometry(0.42, 14, 12),
          new THREE.MeshStandardMaterial({
            color: colors[i % colors.length] ?? '#ffffff',
            roughness: 0.25,
          })
        );
        m.scale.y = 1.15;
        const base = 6.4 + (i % 3) * 0.6;
        m.position.set(
          side * (ROAD_HALF + 0.2) + (i - 3) * 0.18 * side,
          base,
          z + (i % 2) * 0.4
        );
        group.add(m);
        balloons.push({ m, base, phase: i * 0.9 + side });
      }
    }
  }

  // The TV motorbike rides a few metres ahead on the right, filming back.
  const moto = new THREE.Group();
  const { mesh: bike } = vehicleMesh('scooter', '#2a2340');
  bike.rotation.y = Math.PI / 2;
  moto.add(bike);
  const cameraman = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.2, 0.4, 3, 8),
    new THREE.MeshStandardMaterial({ color: '#ff7a1a' })
  );
  cameraman.position.set(0, 1.25, 0.45);
  moto.add(cameraman);
  const cam = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.3, 0.5),
    new THREE.MeshStandardMaterial({ color: '#1b1b22' })
  );
  cam.position.set(0, 1.55, 0.75);
  moto.add(cam);
  moto.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = shadows;
  });
  group.add(moto);

  const confettiCount = 260;
  const confettiGeo = new THREE.BufferGeometry();
  const pos = new Float32Array(confettiCount * 3);
  const col = new Float32Array(confettiCount * 3);
  const vel: number[] = [];
  const c = new THREE.Color();
  for (let i = 0; i < confettiCount; i++) {
    c.set(colors[i % colors.length] ?? '#ffffff');
    col.set([c.r, c.g, c.b], i * 3);
    pos.set([0, -50, 0], i * 3);
    vel.push(0);
  }
  confettiGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  confettiGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const confetti = new THREE.Points(
    confettiGeo,
    new THREE.PointsMaterial({ size: 0.16, vertexColors: true })
  );
  confetti.frustumCulled = false;
  group.add(confetti);
  let launched = false;

  return (t: number, dt: number, camZ: number, finished: boolean) => {
    for (const b of balloons) {
      b.m.position.y = b.base + Math.sin(t * 1.3 + b.phase) * 0.18;
    }
    const finishZ = kmZ(COURSE_KM);
    const motoZ = Math.max(finishZ - 6, camZ - 15);
    moto.position.set(3.1, Math.abs(Math.sin(t * 7)) * 0.03, motoZ);
    moto.visible = !finished;
    if (finished && !launched) {
      launched = true;
      for (let i = 0; i < confettiCount; i++) {
        pos.set(
          [
            (Math.random() - 0.5) * 9,
            5 + Math.random() * 4,
            finishZ + (Math.random() - 0.5) * 6,
          ],
          i * 3
        );
        vel[i] = 0.6 + Math.random() * 1.2;
      }
    }
    if (launched) {
      for (let i = 0; i < confettiCount; i++) {
        const y = pos[i * 3 + 1] ?? 0;
        if (y < 0) continue;
        pos[i * 3 + 1] = y - (vel[i] ?? 1) * dt;
        pos[i * 3] = (pos[i * 3] ?? 0) + Math.sin(t * 3 + i) * dt * 0.6;
      }
      confettiGeo.getAttribute('position').needsUpdate = true;
    }
  };
};

/* ---------------------------------------------------------------------------------------------------------------
 * Course items on the road: cones, puddles, dropped cups and high-five fans.
 * ------------------------------------------------------------------------------------------------------------- */

export type ItemView = {
  group: THREE.Group;
  hit(t: number): void;
  update(t: number): void;
};

let hiFiveTex: THREE.Texture | null = null;

export const buildItem = (item: CourseItem, laneWidth: number): ItemView => {
  const life = buildObstacle(item, laneWidth);
  if (life) return life;
  if (isBooster(item.kind)) return buildBoosterItem(item, laneWidth);
  const g = new THREE.Group();
  const x = item.lane * laneWidth;
  g.position.set(x, 0, kmZ(item.km));
  let hitAt = -1;
  const std = (
    color: string,
    extra: Partial<THREE.MeshStandardMaterialParameters> = {}
  ) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, ...extra });

  if (item.kind === 'cone') {
    const cone = new THREE.Group();
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.06, 0.62),
      std('#2a2340')
    );
    base.position.y = 0.03;
    const body = new THREE.Mesh(
      new THREE.ConeGeometry(0.26, 0.78, 16),
      std('#ff6a13')
    );
    body.position.y = 0.42;
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.19, 0.12, 16),
      std('#ffffff')
    );
    band.position.y = 0.45;
    cone.add(base, body, band);
    cone.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });
    g.add(cone);
    return {
      group: g,
      hit: (t) => (hitAt = t),
      update: (t) => {
        if (hitAt < 0) return;
        const k = Math.min(1, (t - hitAt) / 0.7);
        cone.position.set(
          Math.sin(k * 2) * 0.6,
          Math.sin(k * Math.PI) * 0.9,
          -k * 2.2
        );
        cone.rotation.set(-k * 2.4, 0, k * 1.2);
      },
    };
  }

  if (item.kind === 'puddle') {
    const water = new THREE.Mesh(
      new THREE.CircleGeometry(0.9, 24),
      std('#6fb7d9', {
        roughness: 0.05,
        metalness: 0.2,
        transparent: true,
        opacity: 0.8,
      })
    );
    water.rotation.x = -Math.PI / 2;
    water.scale.set(1.25, 0.8, 1);
    water.position.y = 0.02;
    g.add(water);
    const drops: THREE.Mesh[] = [];
    for (let i = 0; i < 10; i++) {
      const d = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 6, 5),
        std('#bfe6f5')
      );
      d.visible = false;
      g.add(d);
      drops.push(d);
    }
    return {
      group: g,
      hit: (t) => (hitAt = t),
      update: (t) => {
        if (hitAt < 0) return;
        const k = (t - hitAt) / 0.6;
        drops.forEach((d, i) => {
          const a = (i / drops.length) * Math.PI * 2;
          d.visible = k < 1;
          d.position.set(
            Math.cos(a) * k * 0.9,
            Math.sin(k * Math.PI) * 0.7,
            Math.sin(a) * k * 0.6
          );
        });
      },
    };
  }

  if (item.kind === 'cups') {
    const cups: THREE.Mesh[] = [];
    for (let i = 0; i < 7; i++) {
      const cup = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.06, 0.18, 8),
        std(i % 2 ? '#ffffff' : '#38b6e8')
      );
      cup.position.set(
        (i % 4) * 0.28 - 0.42,
        0.06,
        Math.floor(i / 4) * 0.35 - 0.2
      );
      cup.rotation.z = i % 3 === 0 ? 0 : Math.PI / 2;
      cup.rotation.y = i;
      g.add(cup);
      cups.push(cup);
    }
    return {
      group: g,
      hit: (t) => (hitAt = t),
      update: (t) => {
        if (hitAt < 0) return;
        const k = Math.min(1, (t - hitAt) / 0.5);
        cups.forEach((c, i) => {
          c.position.z =
            Math.floor(i / 4) * 0.35 - 0.2 - k * (0.8 + (i % 3) * 0.4);
          c.rotation.x = k * 4 * (i % 2 ? 1 : -1);
        });
      },
    };
  }

  if (isPickup(item.kind)) {
    const snack = new THREE.Group();
    const add = (
      geo: THREE.BufferGeometry,
      color: string,
      x = 0,
      y = 0,
      z = 0,
      extra: Partial<THREE.MeshStandardMaterialParameters> = {}
    ) => {
      const m = new THREE.Mesh(geo, std(color, extra));
      m.position.set(x, y, z);
      m.castShadow = true;
      snack.add(m);
      return m;
    };
    if (item.kind === 'bottle') {
      add(
        new THREE.CylinderGeometry(0.13, 0.13, 0.42, 14),
        '#7fd3ff',
        0,
        0,
        0,
        { transparent: true, opacity: 0.85, roughness: 0.1 }
      );
      add(
        new THREE.CylinderGeometry(0.135, 0.135, 0.14, 14),
        '#38b6e8',
        0,
        -0.02,
        0
      );
      add(
        new THREE.CylinderGeometry(0.06, 0.1, 0.1, 12),
        '#7fd3ff',
        0,
        0.26,
        0,
        { transparent: true, opacity: 0.85 }
      );
      add(
        new THREE.CylinderGeometry(0.065, 0.065, 0.06, 12),
        '#1d6fd1',
        0,
        0.33,
        0
      );
    } else if (item.kind === 'soda') {
      add(
        new THREE.CylinderGeometry(0.13, 0.13, 0.34, 16),
        '#e63946',
        0,
        0,
        0,
        { metalness: 0.5, roughness: 0.3 }
      );
      add(
        new THREE.CylinderGeometry(0.11, 0.13, 0.04, 16),
        '#d9dde2',
        0,
        0.19,
        0,
        { metalness: 0.7 }
      );
      add(
        new THREE.TorusGeometry(0.133, 0.02, 6, 20),
        '#ffffff',
        0,
        0.03,
        0
      ).rotateX(Math.PI / 2);
    } else if (item.kind === 'cake') {
      add(
        new THREE.CylinderGeometry(
          0.24,
          0.24,
          0.2,
          3,
          1,
          false,
          0,
          Math.PI / 2.2
        ),
        '#f6d7a7',
        0,
        -0.05,
        0
      );
      add(
        new THREE.CylinderGeometry(
          0.245,
          0.245,
          0.06,
          3,
          1,
          false,
          0,
          Math.PI / 2.2
        ),
        '#ff9fc2',
        0,
        0.08,
        0
      );
      add(new THREE.SphereGeometry(0.05, 10, 8), '#e63946', 0.08, 0.15, 0.08);
    } else {
      add(new THREE.SphereGeometry(0.13, 14, 10), '#ff5d8f');
      add(new THREE.ConeGeometry(0.09, 0.14, 8), '#ffd166', 0.17, 0, 0).rotateZ(
        Math.PI / 2
      );
      add(
        new THREE.ConeGeometry(0.09, 0.14, 8),
        '#ffd166',
        -0.17,
        0,
        0
      ).rotateZ(-Math.PI / 2);
    }
    snack.scale.setScalar(1.6);
    snack.position.y = 0.85;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.55, 28),
      new THREE.MeshBasicMaterial({
        color: '#fff3a3',
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    g.add(snack, ring);
    return {
      group: g,
      hit: (t) => (hitAt = t),
      update: (t) => {
        if (hitAt < 0) {
          snack.rotation.y = t * 2.2;
          snack.position.y = 0.85 + Math.sin(t * 3 + item.km * 10) * 0.08;
          ring.scale.setScalar(1 + Math.sin(t * 4) * 0.08);
          return;
        }
        const k = (t - hitAt) / 0.45;
        snack.visible = k < 1;
        ring.visible = k < 1;
        snack.position.y = 0.85 + k * 1.2;
        snack.scale.setScalar(1.6 * Math.max(0.01, 1 - k));
      },
    };
  }

  // A fan leans out from the crowd with a hand up for a high five.
  const fan = new THREE.Group();
  const side = item.lane > 0 ? 1 : -1;
  fan.position.x = side * 1.0;
  const shirt = std(
    ['#ff5d73', '#ffd166', '#06d6a0', '#8338ec'][
      Math.floor(item.km * 10) % 4
    ] ?? '#ff5d73'
  );
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.22, 0.55, 4, 10),
    shirt
  );
  body.position.y = 0.75;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 14, 10),
    std('#f6cfa8')
  );
  head.position.y = 1.42;
  const arm = new THREE.Group();
  arm.position.set(-side * 0.18, 1.05, 0);
  const armMesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.06, 0.5, 3, 8),
    std('#f6cfa8')
  );
  armMesh.position.set(-side * 0.3, 0.12, 0);
  armMesh.rotation.z = side * 1.2;
  arm.add(armMesh);
  if (!hiFiveTex)
    hiFiveTex = textLabel('HIGH FIVE!', '#ffc23d', '#2a2340', 256, 64);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 0.28),
    new THREE.MeshBasicMaterial({ map: hiFiveTex })
  );
  sign.position.set(0, 1.95, 0.05);
  fan.add(body, head, arm, sign);
  fan.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  g.add(fan);
  return {
    group: g,
    hit: (t) => (hitAt = t),
    update: (t) => {
      arm.rotation.z = Math.sin(t * 6) * 0.25;
      if (hitAt < 0) return;
      const k = (t - hitAt) / 0.8;
      fan.position.y = k < 1 ? Math.sin(k * Math.PI) * 0.5 : 0;
    },
  };
};
