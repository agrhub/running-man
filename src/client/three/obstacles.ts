import * as THREE from 'three';
import type { CourseItem, ItemKind } from '../../shared/course';
import { kmZ } from './city';

/**
 * People, traffic and animals on the course. Each stands in one lane at its
 * spot, moves a little so the road feels alive, and reacts when a runner
 * meets it. The road runs towards -z.
 */
export type ObstacleView = {
  group: THREE.Group;
  hit(t: number): void;
  update(t: number): void;
};

const mats = new Map<string, THREE.MeshStandardMaterial>();
const mat = (color: string, emissive?: string) => {
  const key = `${color}:${emissive ?? ''}`;
  let m = mats.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.6,
      ...(emissive ? { emissive, emissiveIntensity: 0.9 } : {}),
    });
    mats.set(key, m);
  }
  return m;
};

const part = (
  parent: THREE.Object3D,
  geo: THREE.BufferGeometry,
  color: string,
  x = 0,
  y = 0,
  z = 0,
  emissive?: string
) => {
  const m = new THREE.Mesh(geo, mat(color, emissive));
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
};

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const ball = (r: number) => new THREE.SphereGeometry(r, 12, 10);

/** A wheel standing upright, rolling along z. */
const wheel = (
  parent: THREE.Object3D,
  r: number,
  x: number,
  y: number,
  z: number
) => {
  const w = part(
    parent,
    new THREE.TorusGeometry(r, r * 0.28, 8, 16),
    '#20222a',
    x,
    y,
    z
  );
  w.rotation.y = Math.PI / 2;
  return w;
};

/** A little person: body, head, arms, legs. Faces -z unless turned. */
const person = (shirt: string, skin = '#f1c7a3', hair = '#3a2a20') => {
  const p = new THREE.Group();
  part(p, new THREE.CapsuleGeometry(0.2, 0.36, 4, 10), shirt, 0, 0.78, 0);
  part(p, ball(0.24), skin, 0, 1.32, 0);
  part(
    p,
    new THREE.SphereGeometry(0.25, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    hair,
    0,
    1.36,
    0.02
  );
  const legs = [-0.09, 0.09].map((x) =>
    part(p, new THREE.CapsuleGeometry(0.07, 0.3, 3, 8), '#2f3b57', x, 0.28, 0)
  );
  return { group: p, legs };
};

const flasher = (
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  w: number
) => {
  const red = part(
    parent,
    box(w / 2, 0.14, 0.3),
    '#ff2b3a',
    x - w / 4,
    y,
    z,
    '#ff0000'
  );
  const blue = part(
    parent,
    box(w / 2, 0.14, 0.3),
    '#2b6bff',
    x + w / 4,
    y,
    z,
    '#0040ff'
  );
  return (t: number) => {
    const on = Math.floor(t * 6) % 2 === 0;
    (red.material as THREE.MeshStandardMaterial).emissiveIntensity = on
      ? 1.4
      : 0.1;
    (blue.material as THREE.MeshStandardMaterial).emissiveIntensity = on
      ? 0.1
      : 1.4;
  };
};

/** Car-like body along z: length l, width w, body height h. */
const car = (
  g: THREE.Group,
  color: string,
  l: number,
  w: number,
  h: number
) => {
  part(g, box(w, h, l), color, 0, 0.35 + h / 2, 0);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      wheel(g, 0.26, sx * (w / 2 - 0.02), 0.28, sz * (l / 2 - 0.55));
  part(
    g,
    box(w * 0.94, 0.04, 0.5),
    '#bfe3ff',
    0,
    0.36 + h * 0.75,
    -l / 2 + 0.02
  );
};

export const buildObstacle = (
  item: CourseItem,
  laneWidth: number
): ObstacleView | null => {
  const g = new THREE.Group();
  g.position.set(item.lane * laneWidth, 0, kmZ(item.km));
  const body = new THREE.Group();
  g.add(body);
  let hitAt = -1;
  let idle: (t: number) => void = () => undefined;
  let react: (k: number) => void = () => undefined;
  const kind: ItemKind = item.kind;
  const seed = (item.km * 997) % 1;

  switch (kind) {
    case 'walker': {
      const shirts = ['#ff8fab', '#7ec8e3', '#ffd166', '#95d5b2', '#c9a7ff'];
      const p = person(shirts[Math.floor(seed * shirts.length)] ?? '#ff8fab');
      p.group.rotation.y = Math.PI / 2; // crossing the road
      body.add(p.group);
      part(p.group, box(0.22, 0.26, 0.12), '#f4a261', 0.12, 0.62, 0.3);
      idle = (t) => {
        body.position.x = Math.sin(t * 0.7 + seed * 6) * 0.55;
        p.legs.forEach(
          (l, i) => (l.rotation.x = Math.sin(t * 6 + i * Math.PI) * 0.5)
        );
      };
      react = (k) => {
        body.position.z = -k * 0.4;
        p.group.rotation.z = Math.sin(k * Math.PI) * 0.3;
      };
      break;
    }
    case 'cyclist': {
      const bike = new THREE.Group();
      wheel(bike, 0.32, 0, 0.32, -0.5);
      wheel(bike, 0.32, 0, 0.32, 0.5);
      part(bike, box(0.06, 0.06, 1.0), '#e63946', 0, 0.62, 0).rotation.x = 0.1;
      part(bike, box(0.05, 0.5, 0.05), '#e63946', 0, 0.5, 0.1);
      const p = person('#2a9d8f');
      p.group.position.set(0, 0.35, 0.15);
      p.group.scale.setScalar(0.9);
      bike.add(p.group);
      part(
        bike,
        new THREE.SphereGeometry(0.27, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        '#ffd166',
        0,
        1.62,
        0.15
      );
      body.add(bike);
      idle = (t) => {
        body.position.z = Math.sin(t * 0.5 + seed * 5) * 0.8;
        p.legs.forEach(
          (l, i) => (l.rotation.x = Math.sin(t * 7 + i * Math.PI) * 0.7)
        );
      };
      react = (k) => {
        body.rotation.z = Math.sin(k * Math.PI) * 0.35;
      };
      break;
    }
    case 'scooter': {
      const colors = ['#e63946', '#457b9d', '#f4a261', '#2a9d8f'];
      const c = colors[Math.floor(seed * colors.length)] ?? '#e63946';
      wheel(body, 0.26, 0, 0.26, -0.55);
      wheel(body, 0.26, 0, 0.26, 0.55);
      part(body, box(0.42, 0.34, 1.1), c, 0, 0.55, 0.05);
      part(body, box(0.4, 0.12, 0.5), '#20222a', 0, 0.78, 0.2);
      part(body, box(0.6, 0.05, 0.05), '#555', 0, 1.05, -0.5);
      const p = person('#f1faee');
      p.group.position.set(0, 0.45, 0.2);
      p.group.scale.setScalar(0.85);
      body.add(p.group);
      part(body, ball(0.27), c, 0, 1.6, 0.2);
      idle = (t) => {
        body.position.y = Math.abs(Math.sin(t * 9 + seed * 3)) * 0.03;
      };
      react = (k) => {
        body.position.x = Math.sin(k * Math.PI) * 0.5;
      };
      break;
    }
    case 'cyclo': {
      // Hanoi's cyclo: the passenger seat in front, the rider pedalling behind.
      wheel(body, 0.3, -0.42, 0.3, -0.55);
      wheel(body, 0.3, 0.42, 0.3, -0.55);
      wheel(body, 0.3, 0, 0.3, 0.75);
      part(body, box(0.95, 0.5, 0.75), '#c1121f', 0, 0.75, -0.55);
      part(body, box(0.95, 0.1, 0.6), '#fdf0d5', 0, 1.02, -0.5);
      const hood = part(
        body,
        new THREE.CylinderGeometry(0.5, 0.5, 0.95, 12, 1, true, 0, Math.PI),
        '#264653',
        0,
        1.3,
        -0.35
      );
      hood.rotation.z = Math.PI / 2;
      part(body, box(0.06, 0.06, 1.2), '#333', 0, 0.62, 0.15);
      const p = person('#6c757d');
      p.group.position.set(0, 0.4, 0.7);
      p.group.scale.setScalar(0.85);
      body.add(p.group);
      part(
        body,
        new THREE.ConeGeometry(0.42, 0.22, 16),
        '#e9c46a',
        0,
        1.67,
        0.7
      );
      idle = (t) => {
        p.legs.forEach(
          (l, i) => (l.rotation.x = Math.sin(t * 4 + i * Math.PI) * 0.6)
        );
      };
      react = (k) => {
        body.rotation.y = Math.sin(k * Math.PI) * 0.25;
      };
      break;
    }
    case 'taxi': {
      car(body, '#ffc300', 3.2, 1.6, 0.7);
      part(body, box(1.4, 0.55, 1.7), '#ffc300', 0, 1.33, 0.2);
      part(body, box(1.42, 0.4, 1.6), '#bfe3ff', 0, 1.33, 0.2);
      part(body, box(0.5, 0.18, 0.3), '#ffffff', 0, 1.7, 0.2, '#fff2a8');
      part(body, box(1.62, 0.1, 3.0), '#20222a', 0, 0.75, 0);
      idle = (t) => {
        body.position.y = Math.sin(t * 20) * 0.006;
      };
      react = (k) => {
        body.position.z = -Math.sin(k * Math.PI) * 0.3;
      };
      break;
    }
    case 'ambulance':
    case 'firetruck': {
      const fire = kind === 'firetruck';
      const len = fire ? 4.2 : 3.4;
      car(body, fire ? '#d62828' : '#ffffff', len, 1.8, 1.4);
      if (fire) {
        part(body, box(0.7, 0.12, len - 0.6), '#c0c0c0', 0, 2.22, 0.3);
        for (let i = 0; i < 6; i++)
          part(body, box(0.72, 0.05, 0.05), '#c0c0c0', 0, 2.3, -1.2 + i * 0.55);
      } else {
        part(body, box(1.82, 0.22, len * 0.98), '#e63946', 0, 1.15, 0);
        part(body, box(0.1, 0.5, 0.5), '#e63946', 0.92, 1.55, 0.6);
        part(body, box(0.1, 0.16, 0.5), '#e63946', 0.92, 1.55, 0.6).rotation.x =
          Math.PI / 2;
      }
      const flash = flasher(body, 0, 2.18, -len / 2 + 0.6, 1.2);
      idle = (t) => flash(t);
      react = (k) => {
        body.position.x = Math.sin(k * Math.PI) * 0.35;
      };
      break;
    }
    case 'dog':
    case 'cat':
    case 'pig': {
      const color =
        kind === 'dog'
          ? seed < 0.5
            ? '#c68b59'
            : '#3b3b3b'
          : kind === 'cat'
            ? '#f4a261'
            : '#f7b2bd';
      const s = kind === 'pig' ? 1.3 : kind === 'cat' ? 0.8 : 1;
      const a = new THREE.Group();
      a.scale.setScalar(s);
      part(
        a,
        new THREE.CapsuleGeometry(0.16, 0.42, 4, 10),
        color,
        0,
        0.36,
        0
      ).rotation.x = Math.PI / 2;
      part(a, ball(kind === 'pig' ? 0.2 : 0.16), color, 0, 0.5, -0.32);
      if (kind === 'pig')
        part(
          a,
          new THREE.CylinderGeometry(0.08, 0.08, 0.06, 12),
          '#ef8fa0',
          0,
          0.48,
          -0.52
        ).rotation.x = Math.PI / 2;
      else part(a, ball(0.07), color, 0, 0.45, -0.46);
      for (const sx of [-1, 1]) {
        part(
          a,
          new THREE.ConeGeometry(0.06, kind === 'cat' ? 0.16 : 0.12, 6),
          color,
          sx * 0.09,
          0.66,
          -0.3
        );
        for (const sz of [-1, 1])
          part(
            a,
            new THREE.CylinderGeometry(0.04, 0.04, 0.26, 6),
            color,
            sx * 0.09,
            0.13,
            sz * 0.2
          );
      }
      const tail = part(
        a,
        new THREE.CylinderGeometry(0.025, 0.025, 0.3, 6),
        color,
        0,
        0.5,
        0.32
      );
      tail.rotation.x = -0.8;
      a.rotation.y = seed * Math.PI * 2;
      body.add(a);
      idle = (t) => {
        tail.rotation.z = Math.sin(t * (kind === 'dog' ? 14 : 4)) * 0.6;
        a.rotation.y += 0.004;
        body.position.x = Math.sin(t * 0.9 + seed * 4) * 0.4;
      };
      react = (k) => {
        body.position.y = Math.sin(k * Math.PI) * 0.6;
        body.position.x = k * 1.2;
      };
      break;
    }
    case 'chicken': {
      const c = new THREE.Group();
      part(c, ball(0.17), '#fffaf0', 0, 0.3, 0);
      part(c, ball(0.11), '#fffaf0', 0, 0.5, -0.12);
      part(
        c,
        new THREE.ConeGeometry(0.04, 0.1, 6),
        '#f4a261',
        0,
        0.5,
        -0.24
      ).rotation.x = -Math.PI / 2;
      part(c, box(0.04, 0.08, 0.1), '#e63946', 0, 0.62, -0.12);
      for (const sx of [-1, 1])
        part(
          c,
          new THREE.CylinderGeometry(0.015, 0.015, 0.16, 5),
          '#f4a261',
          sx * 0.06,
          0.08,
          0
        );
      body.add(c);
      idle = (t) => {
        c.rotation.x = Math.max(0, Math.sin(t * 5 + seed * 7)) * 0.6;
        body.position.x = Math.sin(t * 1.3 + seed * 3) * 0.5;
      };
      react = (k) => {
        body.position.y = Math.sin(k * Math.PI) * 0.9;
        body.position.x = -k * 1.4;
      };
      break;
    }
    default:
      return null;
  }

  return {
    group: g,
    hit: (t) => (hitAt = t),
    update: (t) => {
      idle(t);
      if (hitAt >= 0) react(Math.min(1, (t - hitAt) / 0.8));
    },
  };
};
