import * as THREE from 'three';
import type { CourseItem, ItemKind } from '../../shared/course';
import { kmZ } from './city';

/**
 * Boosters: roller skates, a skateboard and a bicycle wait on the road with a
 * glowing ring; grab one and your runner rides it while the burst lasts.
 */
export type RideKind = 'skates' | 'skateboard' | 'bike';

const m = (
  color: string,
  extra: Partial<THREE.MeshStandardMaterialParameters> = {}
) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, ...extra });

const add = (
  parent: THREE.Object3D,
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  x = 0,
  y = 0,
  z = 0
) => {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
};

const wheelGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.05, 10).rotateZ(
  Math.PI / 2
);

/** One skate: a boot on four little wheels, toe towards -z. */
const skate = (x: number) => {
  const g = new THREE.Group();
  add(g, new THREE.BoxGeometry(0.17, 0.2, 0.32), m('#ff4f81'), x, 0.17, 0);
  add(g, new THREE.BoxGeometry(0.18, 0.04, 0.34), m('#ffffff'), x, 0.07, 0);
  for (const z of [-0.12, -0.04, 0.04, 0.12])
    add(g, wheelGeo, m('#ffd447'), x, 0.04, z);
  return g;
};

const skateboard = () => {
  const g = new THREE.Group();
  add(g, new THREE.BoxGeometry(0.38, 0.05, 1.05), m('#2ec4b6'), 0, 0.11, 0);
  add(g, new THREE.BoxGeometry(0.39, 0.012, 0.9), m('#ffbf69'), 0, 0.14, 0);
  for (const x of [-0.13, 0.13])
    for (const z of [-0.36, 0.36]) add(g, wheelGeo, m('#f7f7f7'), x, 0.05, z);
  return g;
};

const bike = () => {
  const g = new THREE.Group();
  const frame = m('#ff6b35');
  for (const z of [-0.55, 0.55]) {
    const w = add(
      g,
      new THREE.TorusGeometry(0.33, 0.045, 8, 20),
      m('#20222a'),
      0,
      0.34,
      z
    );
    w.rotation.y = Math.PI / 2;
  }
  const bar = (len: number, y: number, z: number, rx: number) => {
    const b = add(
      g,
      new THREE.CylinderGeometry(0.035, 0.035, len, 8),
      frame,
      0,
      y,
      z
    );
    b.rotation.x = rx;
  };
  bar(1.0, 0.62, 0, Math.PI / 2);
  bar(0.55, 0.5, 0.25, 0.5);
  bar(0.55, 0.5, -0.4, -0.3);
  add(g, new THREE.BoxGeometry(0.14, 0.05, 0.26), m('#20222a'), 0, 0.82, 0.3);
  add(g, new THREE.BoxGeometry(0.55, 0.04, 0.04), m('#20222a'), 0, 0.92, -0.55);
  // A rear rack and a red light, so the bike reads from behind too.
  add(g, new THREE.BoxGeometry(0.34, 0.05, 0.4), frame, 0, 0.7, 0.6);
  add(
    g,
    new THREE.BoxGeometry(0.16, 0.08, 0.04),
    m('#ff2b3a', { emissive: '#ff0000', emissiveIntensity: 0.8 }),
    0,
    0.66,
    0.82
  );
  return g;
};

export const buildRide = (kind: RideKind): THREE.Group => {
  if (kind === 'skates') {
    const g = new THREE.Group();
    g.add(skate(-0.1), skate(0.1));
    return g;
  }
  return kind === 'skateboard' ? skateboard() : bike();
};

/** How high the runner stands or sits while riding. */
export const RIDE_LIFT: Record<RideKind, number> = {
  skates: 0.08,
  skateboard: 0.16,
  bike: 0.42,
};

/** The booster waiting on the road: it bobs and spins inside a glowing ring. */
export const buildBoosterItem = (item: CourseItem, laneWidth: number) => {
  const g = new THREE.Group();
  g.position.set(item.lane * laneWidth, 0, kmZ(item.km));
  const kind = item.kind as ItemKind as RideKind;
  const ride = buildRide(kind);
  if (kind !== 'bike') ride.scale.setScalar(1.4);
  const spin = new THREE.Group();
  spin.add(ride);
  g.add(spin);
  const ring = add(
    g,
    new THREE.TorusGeometry(0.75, 0.05, 8, 32),
    new THREE.MeshBasicMaterial({
      color: '#7cf3ff',
      transparent: true,
      opacity: 0.85,
    }),
    0,
    0.04,
    0
  );
  ring.rotation.x = Math.PI / 2;
  ring.castShadow = false;
  let hitAt = -1;
  return {
    group: g,
    hit: (t: number) => (hitAt = t),
    update: (t: number) => {
      if (hitAt >= 0) {
        g.visible = t - hitAt < 0.05;
        return;
      }
      spin.rotation.y = t * 1.6;
      spin.position.y = 0.15 + Math.sin(t * 3) * 0.08;
      ring.scale.setScalar(1 + Math.sin(t * 4) * 0.08);
    },
  };
};
