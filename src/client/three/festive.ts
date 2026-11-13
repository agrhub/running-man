import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { COURSE_KM, ROAD_HALF, kmZ } from './city';

/**
 * Holiday dressing for a December stage: falling snow that follows the camera,
 * string lights on every km gantry, and decorated trees beside the gates.
 */

export type Festive = {
  group: THREE.Group;
  update(t: number, dt: number, camZ: number): void;
};

const FLAKES = 1400;
const BOX = { x: 13, y: 11, back: 8, ahead: 55 };
const BULBS = ['#ff4d5e', '#3ddc84', '#ffd447', '#7fd6ff', '#ffffff'];

const tint = (g: THREE.BufferGeometry, color: string) => {
  const c = new THREE.Color(color);
  const n = g.getAttribute('position').count;
  const data = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) data.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(data, 3));
  return g;
};

/** A soft round flake, so the snow is not drawn as squares. */
const flakeTexture = (): THREE.Texture => {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  if (g) {
    const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.85)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 32, 32);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
};

export const buildFestive = (christmas: boolean, calm = false): Festive => {
  const flakes = calm ? Math.round(FLAKES / 4) : FLAKES;
  const group = new THREE.Group();

  // Snow: points in a box that rides with the camera, wrapping at the edges.
  const pos = new Float32Array(flakes * 3);
  const drift = new Float32Array(flakes);
  for (let i = 0; i < flakes; i++) {
    pos[i * 3] = (Math.random() - 0.5) * BOX.x * 2;
    pos[i * 3 + 1] = Math.random() * BOX.y;
    pos[i * 3 + 2] = -Math.random() * (BOX.ahead + BOX.back) + BOX.back;
    drift[i] = Math.random() * Math.PI * 2;
  }
  const snowGeo = new THREE.BufferGeometry();
  snowGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const snow = new THREE.Points(
    snowGeo,
    new THREE.PointsMaterial({
      color: '#ffffff',
      map: flakeTexture(),
      size: 0.28,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    })
  );
  snow.frustumCulled = false;
  group.add(snow);

  // Lights on the gantries and trees by the gates, merged into two meshes.
  const bulbs: THREE.BufferGeometry[] = [];
  const trees: THREE.BufferGeometry[] = [];
  const bulb = new THREE.SphereGeometry(0.085, 8, 6);
  const span = ROAD_HALF * 2 + 0.8;
  for (let km = 0; km <= COURSE_KM; km++) {
    const z = kmZ(km);
    // A sagging string under the banner, and one up each post.
    const n = 16;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const x = -span / 2 + u * span;
      const y = 4.62 - Math.sin(u * Math.PI) * 0.35;
      bulbs.push(
        tint(bulb.clone().translate(x, y, z + 0.22), BULBS[i % BULBS.length]!)
      );
    }
    for (const side of [-1, 1])
      for (let i = 0; i < 7; i++)
        bulbs.push(
          tint(
            bulb
              .clone()
              .translate(side * (ROAD_HALF + 0.2), 0.6 + i * 0.62, z + 0.28),
            BULBS[(i + km) % BULBS.length]!
          )
        );
    // Two trees beside each gate.
    for (const side of [-1, 1]) {
      const x = side * (ROAD_HALF + 1.4);
      const tz = z + 2.2;
      trees.push(
        tint(
          new THREE.CylinderGeometry(0.14, 0.18, 0.5, 8).translate(x, 0.25, tz),
          '#7a4a26'
        )
      );
      for (const [r, y] of [
        [1.0, 1.0],
        [0.8, 1.65],
        [0.55, 2.25],
      ] as const)
        trees.push(
          tint(
            new THREE.ConeGeometry(r, 1.0, 10).translate(x, y, tz),
            '#1f7a43'
          )
        );
      trees.push(
        tint(
          new THREE.OctahedronGeometry(0.2).translate(x, 2.92, tz),
          '#ffd447'
        )
      );
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + km;
        const h = 0.75 + (i % 3) * 0.6;
        const rr = 0.95 - (i % 3) * 0.25;
        bulbs.push(
          tint(
            bulb
              .clone()
              .translate(
                x + Math.cos(a) * rr * 0.8,
                h,
                tz + Math.sin(a) * rr * 0.8
              ),
            BULBS[i % BULBS.length]!
          )
        );
      }
    }
  }
  const lightGeo = mergeGeometries(bulbs, false);
  bulbs.forEach((g) => g.dispose());
  bulb.dispose();
  const lightMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  if (lightGeo) group.add(new THREE.Mesh(lightGeo, lightMat));
  const treeGeo = mergeGeometries(trees, false);
  trees.forEach((g) => g.dispose());
  if (treeGeo) {
    const m = new THREE.Mesh(
      treeGeo,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 })
    );
    m.castShadow = true;
    group.add(m);
  }

  // On the Christmas Run the snow falls a little harder.
  const fall = christmas ? 1.6 : 1.1;
  let twinkle = 0;
  return {
    group,
    update(t, dt, camZ) {
      const a = snowGeo.getAttribute('position') as THREE.BufferAttribute;
      const arr = a.array as Float32Array;
      const top = camZ + BOX.back;
      const bottom = camZ - BOX.ahead;
      for (let i = 0; i < flakes; i++) {
        const k = i * 3;
        arr[k + 1] = (arr[k + 1] ?? 0) - fall * dt;
        arr[k] =
          (arr[k] ?? 0) + Math.sin(t * 0.8 + (drift[i] ?? 0)) * 0.25 * dt;
        let z = arr[k + 2] ?? 0;
        if ((arr[k + 1] ?? 0) < 0) arr[k + 1] = BOX.y;
        if (z > top) z -= BOX.ahead + BOX.back;
        else if (z < bottom) z += BOX.ahead + BOX.back;
        arr[k + 2] = z;
      }
      a.needsUpdate = true;
      twinkle += dt;
      lightMat.color.setScalar(0.82 + 0.18 * Math.sin(twinkle * 3.2));
    },
  };
};
