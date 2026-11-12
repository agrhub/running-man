import * as THREE from 'three';
import type { CityId, Terrain } from '../../shared/content';
import { Batch, box, colorize, type Rand } from './geo';

/*
 * Scenery beside the closed course for each terrain: parks, forests, zoos, hills, beaches and deserts. Static pieces
 * go into the shared merge batch; animals, boats and camels are separate meshes so they can move.
 */

export type TerrainMaterials = {
  solid: THREE.Material;
  greens: THREE.Material;
  metal: THREE.Material;
  glow: THREE.Material;
};

export type TerrainContext = {
  group: THREE.Group;
  batch: Batch;
  mats: TerrainMaterials;
  rand: Rand;
  zStart: number;
  zEnd: number;
  /** Distance from the course centre to the outer edge of the sidewalk. */
  frontX: number;
  terrain: Terrain;
  cityId: CityId;
  /** True where the landmark's plaza is (right side), which must stay clear. */
  inPlaza: (side: number, z0: number, z1: number) => boolean;
  /** Builds a facade building; used for beachfront hotels. */
  hotel: (
    x0: number,
    x1: number,
    z0: number,
    z1: number,
    floors: number,
    face: 1 | -1
  ) => void;
  shadows: boolean;
};

export type TerrainLife = { update(t: number, dt: number, camZ: number): void };

/** Ground and path colours per terrain (city keeps the city's own palette). */
export const TERRAIN_GROUND: Record<
  Exclude<Terrain, 'city'>,
  { ground: string; path: string }
> = {
  park: { ground: '#9fcf7f', path: '#d9ccb0' },
  forest: { ground: '#6f9e55', path: '#cdb894' },
  zoo: { ground: '#a6c97a', path: '#dccba6' },
  hills: { ground: '#93c46f', path: '#d6c9ad' },
  beach: { ground: '#f1dcaa', path: '#c9a378' },
  desert: { ground: '#e9cf98', path: '#dcc192' },
};

export const buildTerrain = (ctx: TerrainContext): TerrainLife => {
  const { batch, mats, rand, zStart, zEnd, frontX, group } = ctx;
  const range = (a: number, b: number) => a + rand() * (b - a);
  const pick = <T>(arr: T[]): T =>
    arr[Math.floor(rand() * arr.length)] ?? arr[0]!;
  const movers: ((t: number, dt: number, camZ: number) => void)[] = [];

  const g = (geo: THREE.BufferGeometry, color: string) => colorize(geo, color);

  const tree = (x: number, z: number, s: number, crown: string) => {
    batch.push(
      mats.greens,
      g(
        new THREE.CylinderGeometry(0.14 * s, 0.2 * s, 2 * s, 6).translate(
          x,
          s,
          z
        ),
        '#5b4433'
      )
    );
    batch.push(
      mats.greens,
      g(
        new THREE.IcosahedronGeometry(1.3 * s, 1).translate(x, 2.6 * s, z),
        crown
      )
    );
    batch.push(
      mats.greens,
      g(
        new THREE.IcosahedronGeometry(0.9 * s, 1).translate(
          x + 0.5 * s,
          3.3 * s,
          z - 0.3 * s
        ),
        crown
      )
    );
  };
  const conifer = (x: number, z: number, s: number, color: string) => {
    batch.push(
      mats.greens,
      g(
        new THREE.CylinderGeometry(0.12 * s, 0.18 * s, 1.2 * s, 6).translate(
          x,
          0.6 * s,
          z
        ),
        '#5b4433'
      )
    );
    batch.push(
      mats.greens,
      g(
        new THREE.ConeGeometry(1.3 * s, 2.6 * s, 8).translate(x, 2.2 * s, z),
        color
      )
    );
    batch.push(
      mats.greens,
      g(
        new THREE.ConeGeometry(0.95 * s, 2.0 * s, 8).translate(x, 3.5 * s, z),
        color
      )
    );
  };
  const palm = (x: number, z: number, s: number) => {
    const lean = range(-0.25, 0.25);
    for (let i = 0; i < 4; i++) {
      batch.push(
        mats.greens,
        g(
          new THREE.CylinderGeometry(0.13 * s, 0.17 * s, 1.3 * s, 6).translate(
            x + lean * i * s,
            0.65 * s + i * 1.25 * s,
            z
          ),
          i % 2 ? '#a07850' : '#8c6640'
        )
      );
    }
    const topX = x + lean * 4 * s;
    const topY = 5.1 * s;
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      const leaf = new THREE.BoxGeometry(2.4 * s, 0.06, 0.5 * s)
        .translate(1.1 * s, 0, 0)
        .rotateZ(-0.45)
        .rotateY(a)
        .translate(topX, topY, z);
      batch.push(mats.greens, g(leaf, k % 2 ? '#3f9a4e' : '#2e8540'));
    }
  };
  const acacia = (x: number, z: number, s: number) => {
    batch.push(
      mats.greens,
      g(
        new THREE.CylinderGeometry(0.15 * s, 0.22 * s, 2.6 * s, 6).translate(
          x,
          1.3 * s,
          z
        ),
        '#6b4f36'
      )
    );
    batch.push(
      mats.greens,
      g(
        new THREE.CylinderGeometry(2.2 * s, 1.6 * s, 0.6 * s, 10).translate(
          x,
          2.9 * s,
          z
        ),
        '#7aa64a'
      )
    );
  };
  const bush = (x: number, z: number, s: number, color: string) =>
    batch.push(
      mats.greens,
      g(
        new THREE.IcosahedronGeometry(0.6 * s, 0)
          .scale(1, 0.7, 1)
          .translate(x, 0.35 * s, z),
        color
      )
    );
  const rock = (x: number, z: number, s: number, color = '#9a958c') =>
    batch.push(
      mats.solid,
      g(
        new THREE.DodecahedronGeometry(0.8 * s, 0)
          .scale(1.2, 0.7, 1)
          .translate(x, 0.3 * s, z),
        color
      )
    );
  const bench = (x: number, z: number) => {
    batch.push(mats.solid, box(0.5, 0.08, 1.6, x, 0.48, z, '#8b5e3c'));
    batch.push(
      mats.solid,
      box(0.08, 0.5, 1.6, x + Math.sign(x) * 0.22, 0.75, z, '#8b5e3c')
    );
    batch.push(
      mats.metal,
      box(0.45, 0.45, 0.08, x, 0.24, z - 0.7, '#2b2f36'),
      box(0.45, 0.45, 0.08, x, 0.24, z + 0.7, '#2b2f36')
    );
  };
  const flowerBed = (x: number, z: number) => {
    batch.push(mats.solid, box(1.8, 0.25, 3.2, x, 0.12, z, '#b9a88a'));
    batch.push(mats.greens, box(1.6, 0.12, 3, x, 0.28, z, '#5f9a45'));
    const c = pick(['#ff5d73', '#ffd166', '#c77dff', '#ffffff', '#ff8a3d']);
    for (let i = 0; i < 8; i++) {
      batch.push(
        mats.greens,
        g(
          new THREE.SphereGeometry(0.14, 6, 5).translate(
            x + range(-0.6, 0.6),
            0.42,
            z + range(-1.3, 1.3)
          ),
          c
        )
      );
    }
  };
  const fence = (x: number, z0: number, z1: number, color = '#c9a46b') => {
    const len = Math.abs(z1 - z0);
    const mid = (z0 + z1) / 2;
    batch.push(
      mats.solid,
      box(0.1, 0.1, len, x, 0.55, mid, color),
      box(0.1, 0.1, len, x, 1.05, mid, color)
    );
    for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z += 2.2)
      batch.push(mats.solid, box(0.16, 1.3, 0.16, x, 0.65, z, '#8b6a42'));
  };
  const crossFence = (x0: number, x1: number, z: number, color = '#c9a46b') => {
    const len = Math.abs(x1 - x0);
    const mid = (x0 + x1) / 2;
    batch.push(
      mats.solid,
      box(len, 0.1, 0.1, mid, 0.55, z, color),
      box(len, 0.1, 0.1, mid, 1.05, z, color)
    );
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x += 2.2)
      batch.push(mats.solid, box(0.16, 1.3, 0.16, x, 0.65, z, '#8b6a42'));
  };
  const house = (
    x: number,
    z: number,
    s: number,
    wall: string,
    roof: string
  ) => {
    batch.push(mats.solid, box(3 * s, 2.4 * s, 3.4 * s, x, 1.2 * s, z, wall));
    const r = new THREE.ConeGeometry(2.6 * s, 1.6 * s, 4)
      .rotateY(Math.PI / 4)
      .scale(1, 1, 1.15)
      .translate(x, 3.2 * s, z);
    batch.push(mats.solid, g(r, roof));
    batch.push(
      mats.solid,
      box(
        0.05,
        0.8 * s,
        0.6 * s,
        x - Math.sign(x) * 1.52 * s,
        1.1 * s,
        z,
        '#3b3557'
      )
    );
  };

  const sides = [-1, 1] as const;
  const clear = (side: number, z: number) => !ctx.inPlaza(side, z - 3, z + 3);

  switch (ctx.terrain) {
    case 'park': {
      for (let z = zStart; z > zEnd; z -= 3.4) {
        for (const side of sides) {
          if (!clear(side, z)) continue;
          if (rand() < 0.55)
            tree(
              side * range(frontX + 3, frontX + 26),
              z + range(-1.5, 1.5),
              range(0.9, 1.4),
              pick(['#5aa04a', '#6fb35a', '#4c8f3e'])
            );
          if (rand() < 0.35)
            tree(
              side * range(frontX + 26, frontX + 60),
              z,
              range(1.2, 1.8),
              pick(['#4f9442', '#5aa04a'])
            );
          if (rand() < 0.12) flowerBed(side * (frontX + 2.4), z);
          if (rand() < 0.1) bench(side * (frontX + 1.1), z);
        }
      }
      // a pond with a fountain on the left
      const pz = (zStart + zEnd) / 2 + range(-60, 60);
      const pond = new THREE.Mesh(
        new THREE.CircleGeometry(9, 32),
        new THREE.MeshStandardMaterial({
          color: '#6cc3df',
          roughness: 0.1,
          metalness: 0.2,
        })
      );
      pond.rotation.x = -Math.PI / 2;
      pond.scale.set(1.5, 1, 1);
      pond.position.set(-(frontX + 18), 0.05, pz);
      group.add(pond);
      batch.push(
        mats.solid,
        g(
          new THREE.TorusGeometry(9, 0.35, 6, 40)
            .rotateX(Math.PI / 2)
            .scale(1.5, 1, 1)
            .translate(-(frontX + 18), 0.1, pz),
          '#c9bfae'
        )
      );
      const spray = new THREE.Mesh(
        new THREE.ConeGeometry(0.6, 3, 10, 1, true),
        new THREE.MeshBasicMaterial({
          color: '#e6f7ff',
          transparent: true,
          opacity: 0.6,
        })
      );
      spray.position.set(-(frontX + 18), 1.5, pz);
      group.add(spray);
      movers.push((t) => {
        spray.scale.y = 0.85 + Math.sin(t * 5) * 0.15;
      });
      break;
    }
    case 'forest': {
      for (let z = zStart; z > zEnd; z -= 2.2) {
        for (const side of sides) {
          if (!clear(side, z)) continue;
          for (let row = 0; row < 4; row++) {
            if (rand() < 0.25) continue;
            const x =
              side * (frontX + 1.8 + row * range(3.5, 6.5) + rand() * 2);
            const s = range(1, 1.8) + row * 0.15;
            if (rand() < 0.6)
              conifer(
                x,
                z + range(-1, 1),
                s,
                pick(['#2f6b3a', '#3c7d45', '#24583a'])
              );
            else
              tree(x, z + range(-1, 1), s * 0.9, pick(['#4f8a3c', '#5f9b48']));
          }
          if (rand() < 0.08) {
            batch.push(
              mats.greens,
              g(
                new THREE.CylinderGeometry(0.3, 0.3, 3, 8)
                  .rotateZ(Math.PI / 2)
                  .translate(side * (frontX + 2), 0.3, z),
                '#7a5a3c'
              )
            );
          }
          if (rand() < 0.3)
            bush(side * (frontX + 1.2), z, range(0.6, 1), '#3f7a3a');
        }
      }
      break;
    }
    case 'zoo': {
      const animals: {
        mesh: THREE.Group;
        z0: number;
        z1: number;
        speed: number;
        kind: string;
        phase: number;
      }[] = [];
      const pen = 34;
      for (let z = zStart - 6; z > zEnd + pen; z -= pen) {
        for (const side of sides) {
          if (ctx.inPlaza(side, z - pen, z)) continue;
          const x0 = side * (frontX + 1.4);
          const x1 = side * (frontX + 26);
          fence(x0, z, z - pen + 3);
          crossFence(x0, x1, z);
          for (let k = 0; k < 3; k++)
            acacia(
              side * range(frontX + 13, frontX + 24),
              z - range(4, pen - 4),
              range(0.9, 1.3)
            );
          rock(
            side * range(frontX + 5, frontX + 22),
            z - range(3, pen - 3),
            range(0.8, 1.6),
            '#b5a68e'
          );
          const kind = pick([
            'giraffe',
            'elephant',
            'zebra',
            'zebra',
            'giraffe',
          ]);
          for (let n = 0; n < (kind === 'zebra' ? 3 : 2); n++) {
            const mesh = buildAnimal(kind);
            const ax = side * range(frontX + 4.5, frontX + 11);
            mesh.position.set(ax, 0, z - range(6, pen - 6));
            mesh.scale.setScalar(1.35);
            mesh.rotation.y = rand() < 0.5 ? 0 : Math.PI;
            mesh.traverse((o) => {
              if (o instanceof THREE.Mesh) o.castShadow = ctx.shadows;
            });
            group.add(mesh);
            animals.push({
              mesh,
              z0: z - 5,
              z1: z - pen + 5,
              speed: range(0.6, 1.4),
              kind,
              phase: rand() * 6,
            });
          }
        }
      }
      movers.push((t, dt, camZ) => {
        for (const a of animals) {
          a.mesh.visible =
            a.mesh.position.z < camZ + 20 && a.mesh.position.z > camZ - 160;
          if (!a.mesh.visible) continue;
          const dir = a.mesh.rotation.y === 0 ? -1 : 1;
          a.mesh.position.z += dir * a.speed * dt;
          if (a.mesh.position.z < a.z1) a.mesh.rotation.y = Math.PI;
          if (a.mesh.position.z > a.z0) a.mesh.rotation.y = 0;
          a.mesh.position.y = Math.abs(Math.sin(t * 3 + a.phase)) * 0.06;
          const neck = a.mesh.getObjectByName('neck');
          if (neck) neck.rotation.x = Math.sin(t * 0.8 + a.phase) * 0.15;
        }
      });
      break;
    }
    case 'hills': {
      for (let k = 0; k < 30; k++) {
        const side = k % 2 === 0 ? -1 : 1;
        const r = range(18, 46);
        const hill = new THREE.SphereGeometry(
          r,
          18,
          10,
          0,
          Math.PI * 2,
          0,
          Math.PI / 2
        ).scale(1.3, range(0.35, 0.6), 1);
        batch.push(
          mats.greens,
          g(
            hill.translate(
              side * (frontX + r * 0.9 + range(6, 30)),
              -0.5,
              range(zEnd, zStart)
            ),
            pick(['#86bd63', '#7bb35a', '#93c46f', '#6fa852'])
          )
        );
      }
      for (let z = zStart; z > zEnd; z -= 6) {
        for (const side of sides) {
          if (!clear(side, z)) continue;
          if (rand() < 0.35)
            house(
              side * range(frontX + 4, frontX + 12),
              z,
              range(0.9, 1.2),
              pick(['#f4ead8', '#efe3c8', '#f7f1e6']),
              pick(['#5d6470', '#b75b3d', '#6a5d55'])
            );
          if (rand() < 0.5)
            tree(
              side * range(frontX + 2, frontX + 16),
              z + 2,
              range(0.8, 1.2),
              pick(['#5aa04a', '#6fb35a'])
            );
          if (rand() < 0.2) fence(side * (frontX + 1.3), z, z - 5, '#ffffff');
        }
      }
      break;
    }
    case 'beach': {
      // the sea on the left, beyond a strip of sand
      const seaX = frontX + 16;
      const sea = new THREE.Mesh(
        new THREE.PlaneGeometry(400, zStart - zEnd + 200),
        new THREE.MeshStandardMaterial({
          color: '#3fb0d6',
          roughness: 0.15,
          metalness: 0.1,
        })
      );
      sea.rotation.x = -Math.PI / 2;
      sea.position.set(-(seaX + 200), 0.04, (zStart + zEnd) / 2);
      group.add(sea);
      const foam = new THREE.Mesh(
        new THREE.PlaneGeometry(2.4, zStart - zEnd + 200),
        new THREE.MeshBasicMaterial({
          color: '#e9fbff',
          transparent: true,
          opacity: 0.8,
        })
      );
      foam.rotation.x = -Math.PI / 2;
      foam.position.set(-seaX, 0.06, (zStart + zEnd) / 2);
      group.add(foam);
      const boats: THREE.Group[] = [];
      for (let k = 0; k < 6; k++) {
        const boat = new THREE.Group();
        const hull = new THREE.Mesh(
          new THREE.BoxGeometry(1.4, 0.6, 4),
          new THREE.MeshStandardMaterial({ color: '#ffffff' })
        );
        hull.position.y = 0.3;
        const sail = new THREE.Mesh(
          new THREE.ConeGeometry(1.4, 4, 3),
          new THREE.MeshStandardMaterial({
            color: pick(['#ff5d73', '#ffd166', '#ffffff', '#4fc3f7']),
          })
        );
        sail.position.y = 2.6;
        sail.scale.z = 0.15;
        boat.add(hull, sail);
        boat.position.set(-(seaX + range(12, 70)), 0, range(zEnd, zStart));
        group.add(boat);
        boats.push(boat);
      }
      for (let z = zStart; z > zEnd; z -= 4.2) {
        // palms along the promenade on both sides
        for (const side of sides)
          if (clear(side, z) && rand() < 0.6)
            palm(side * (frontX + 0.9), z, range(0.85, 1.1));
        // umbrellas, towels and sunbathers on the sand
        if (rand() < 0.7) {
          const ux = -range(frontX + 3, seaX - 2);
          const color = pick([
            '#ff5d73',
            '#ffd166',
            '#4fc3f7',
            '#06d6a0',
            '#ff8a3d',
          ]);
          batch.push(
            mats.solid,
            g(
              new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6).translate(
                ux,
                1.2,
                z
              ),
              '#ffffff'
            )
          );
          batch.push(
            mats.solid,
            g(
              new THREE.ConeGeometry(1.3, 0.55, 12).translate(ux, 2.5, z),
              color
            )
          );
          batch.push(
            mats.solid,
            box(
              1,
              0.04,
              2,
              ux + 1,
              0.05,
              z + 0.4,
              pick(['#ffffff', '#4fc3f7', '#ff5d73'])
            )
          );
          if (rand() < 0.5) {
            batch.push(
              mats.solid,
              g(
                new THREE.CapsuleGeometry(0.2, 0.9, 3, 6)
                  .rotateX(Math.PI / 2)
                  .translate(ux + 1, 0.25, z + 0.4),
                pick(['#f6cfa8', '#c58a5e', '#e0a97c'])
              )
            );
          }
        }
      }
      // beachfront hotels on the right
      let z = zStart;
      while (z > zEnd) {
        const w = range(14, 22);
        if (clear(1, z - w / 2) && clear(1, z))
          ctx.hotel(
            frontX + 4,
            frontX + 4 + range(10, 16),
            z - w,
            z,
            Math.floor(range(6, 22)),
            -1
          );
        z -= w + range(3, 8);
      }
      movers.push((t) => {
        foam.material.opacity = 0.55 + Math.sin(t * 1.4) * 0.25;
        boats.forEach((b, i) => {
          b.position.z += Math.sin(i) * 0.01;
          b.rotation.z = Math.sin(t * 1.2 + i) * 0.06;
        });
      });
      break;
    }
    case 'desert': {
      for (let k = 0; k < 46; k++) {
        const side = k % 2 === 0 ? -1 : 1;
        const r = range(10, 30);
        const dune = new THREE.SphereGeometry(
          r,
          16,
          8,
          0,
          Math.PI * 2,
          0,
          Math.PI / 2
        ).scale(1.6, range(0.22, 0.42), 1);
        batch.push(
          mats.greens,
          g(
            dune.translate(
              side * (frontX + r + range(4, 70)),
              -0.3,
              range(zEnd, zStart)
            ),
            pick(['#e6c48a', '#dcb877', '#ebcf98'])
          )
        );
      }
      for (let z = zStart; z > zEnd; z -= 5) {
        for (const side of sides) {
          if (!clear(side, z)) continue;
          if (rand() < 0.35)
            bush(
              side * range(frontX + 2, frontX + 14),
              z,
              range(0.5, 0.9),
              '#9a8f5a'
            );
          if (rand() < 0.15)
            rock(
              side * range(frontX + 3, frontX + 18),
              z,
              range(0.6, 1.4),
              '#c2a06c'
            );
          if (rand() < 0.08)
            palm(side * range(frontX + 3, frontX + 9), z, range(0.8, 1));
        }
        if (rand() < 0.06) {
          // a Bedouin-style tent
          const tx = -range(frontX + 8, frontX + 20);
          batch.push(
            mats.solid,
            g(
              new THREE.ConeGeometry(3, 2.2, 4)
                .rotateY(Math.PI / 4)
                .scale(1.4, 1, 1)
                .translate(tx, 1.1, z),
              '#7a4b32'
            )
          );
          batch.push(
            mats.solid,
            box(0.1, 0.9, 1.4, tx + 2.9, 0.45, z, '#e8c27a')
          );
        }
      }
      // a camel caravan crossing the dunes on the right
      const caravan: THREE.Group[] = [];
      for (let k = 0; k < 5; k++) {
        const camel = buildAnimal('camel');
        camel.position.set(frontX + 22 + (k % 2) * 1.2, 0, -40 - k * 4.5);
        camel.rotation.y = Math.PI;
        camel.traverse((o) => {
          if (o instanceof THREE.Mesh) o.castShadow = ctx.shadows;
        });
        group.add(camel);
        caravan.push(camel);
      }
      movers.push((t, dt, camZ) => {
        caravan.forEach((c, i) => {
          c.position.z -= dt * 1.1;
          if (c.position.z < camZ - 120) c.position.z = camZ + 10 - i * 4.5;
          c.position.y = Math.abs(Math.sin(t * 2.4 + i)) * 0.1;
        });
      });
      break;
    }
    default:
      break;
  }

  return {
    update: (t, dt, camZ) => {
      for (const m of movers) m(t, dt, camZ);
    },
  };
};

/** Simple low-poly animals; the model faces -z. */
const buildAnimal = (kind: string): THREE.Group => {
  const a = new THREE.Group();
  const mat = (c: string) =>
    new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 });
  const part = (
    geo: THREE.BufferGeometry,
    m: THREE.Material,
    x: number,
    y: number,
    z: number,
    parent: THREE.Object3D = a
  ) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };
  const legs = (
    m: THREE.Material,
    h: number,
    w: number,
    l: number,
    r = 0.12
  ) => {
    for (const [x, z] of [
      [-w, -l],
      [w, -l],
      [-w, l],
      [w, l],
    ] as const) {
      part(new THREE.CylinderGeometry(r, r * 0.8, h, 6), m, x, h / 2, z);
    }
  };
  switch (kind) {
    case 'giraffe': {
      const body = mat('#e8b04a');
      const spots = mat('#9a5a2a');
      legs(body, 2.2, 0.35, 0.7, 0.1);
      part(
        new THREE.CapsuleGeometry(0.55, 1.2, 4, 10).rotateX(Math.PI / 2),
        body,
        0,
        2.6,
        0
      );
      for (let i = 0; i < 6; i++)
        part(
          new THREE.SphereGeometry(0.16, 6, 5),
          spots,
          i % 2 ? 0.48 : -0.48,
          2.6 + (i % 3) * 0.15,
          -0.6 + i * 0.25
        );
      const neck = new THREE.Group();
      neck.name = 'neck';
      neck.position.set(0, 2.9, -0.8);
      a.add(neck);
      part(
        new THREE.CylinderGeometry(0.16, 0.24, 2.4, 8),
        body,
        0,
        1.1,
        -0.3,
        neck
      ).rotation.x = -0.35;
      part(
        new THREE.CapsuleGeometry(0.22, 0.45, 4, 8).rotateX(Math.PI / 2),
        body,
        0,
        2.3,
        -0.85,
        neck
      );
      part(
        new THREE.CylinderGeometry(0.04, 0.04, 0.3, 5),
        spots,
        -0.1,
        2.6,
        -0.7,
        neck
      );
      part(
        new THREE.CylinderGeometry(0.04, 0.04, 0.3, 5),
        spots,
        0.1,
        2.6,
        -0.7,
        neck
      );
      break;
    }
    case 'elephant': {
      const grey = mat('#9aa0a8');
      legs(grey, 1.3, 0.55, 0.75, 0.32);
      part(
        new THREE.CapsuleGeometry(1, 1.2, 4, 12).rotateX(Math.PI / 2),
        grey,
        0,
        2,
        0
      );
      const head = new THREE.Group();
      head.name = 'neck';
      head.position.set(0, 2.3, -1.6);
      a.add(head);
      part(new THREE.SphereGeometry(0.75, 12, 10), grey, 0, 0, 0, head);
      part(
        new THREE.CylinderGeometry(0.16, 0.24, 1.6, 8),
        grey,
        0,
        -0.85,
        -0.5,
        head
      ).rotation.x = 0.3;
      part(
        new THREE.CircleGeometry(0.75, 12),
        grey,
        -0.7,
        0.1,
        0.1,
        head
      ).rotation.y = -Math.PI / 2 - 0.3;
      part(
        new THREE.CircleGeometry(0.75, 12),
        grey,
        0.7,
        0.1,
        0.1,
        head
      ).rotation.y = Math.PI / 2 + 0.3;
      break;
    }
    case 'camel': {
      const tan = mat('#c99a5b');
      legs(tan, 1.6, 0.3, 0.6, 0.09);
      part(
        new THREE.CapsuleGeometry(0.5, 1.1, 4, 10).rotateX(Math.PI / 2),
        tan,
        0,
        1.95,
        0
      );
      part(new THREE.SphereGeometry(0.45, 10, 8), tan, 0, 2.45, 0.1).scale.set(
        1,
        0.9,
        1.2
      );
      const neck = new THREE.Group();
      neck.name = 'neck';
      neck.position.set(0, 2.1, -0.85);
      a.add(neck);
      part(
        new THREE.CylinderGeometry(0.13, 0.18, 1.1, 8),
        tan,
        0,
        0.4,
        -0.25,
        neck
      ).rotation.x = -0.7;
      part(
        new THREE.CapsuleGeometry(0.16, 0.35, 4, 8).rotateX(Math.PI / 2),
        tan,
        0,
        0.85,
        -0.65,
        neck
      );
      part(new THREE.BoxGeometry(0.9, 0.15, 0.9), mat('#c0392b'), 0, 2.5, 0.1);
      break;
    }
    default: {
      // zebra
      const white = mat('#f4f1ea');
      const black = mat('#2a2340');
      legs(white, 1.1, 0.3, 0.6, 0.09);
      part(
        new THREE.CapsuleGeometry(0.45, 0.9, 4, 10).rotateX(Math.PI / 2),
        white,
        0,
        1.45,
        0
      );
      for (let i = 0; i < 5; i++)
        part(
          new THREE.TorusGeometry(0.46, 0.05, 4, 16),
          black,
          0,
          1.45,
          -0.5 + i * 0.25
        );
      const neck = new THREE.Group();
      neck.name = 'neck';
      neck.position.set(0, 1.6, -0.7);
      a.add(neck);
      part(
        new THREE.CylinderGeometry(0.15, 0.2, 0.8, 8),
        white,
        0,
        0.3,
        -0.15,
        neck
      ).rotation.x = -0.6;
      part(
        new THREE.CapsuleGeometry(0.17, 0.4, 4, 8).rotateX(Math.PI / 2),
        white,
        0,
        0.62,
        -0.5,
        neck
      );
      part(new THREE.BoxGeometry(0.06, 0.25, 0.6), black, 0, 0.75, -0.2, neck);
      break;
    }
  }
  return a;
};
