import * as THREE from 'three';
import type { TimeOfDay, WeatherId } from '../../shared/content';

/**
 * The sky, light and weather you run through: the time of day sets the sun and
 * the sky, the weather adds rain, wind-blown leaves or a thunderstorm with
 * lightning. Particles ride with the camera, so they cost the same anywhere.
 */
export type Atmosphere = {
  group: THREE.Group;
  background: THREE.Texture;
  fog: THREE.Color;
  fogNear: number;
  fogFar: number;
  sun: { color: string; intensity: number; x: number; y: number };
  hemi: number;
  /** 0 by day, 1 at night: lamps and windows glow. */
  night: number;
  /** Returns a lightning flash 0..1 for this frame, and whether thunder should start. */
  update(
    t: number,
    dt: number,
    camZ: number
  ): { flash: number; thunder: boolean };
};

type Sky = [top: string, bottom: string];

const SKY: Record<TimeOfDay, Sky> = {
  morning: ['#9fd0f5', '#ffe6cf'],
  noon: ['#5fb0f2', '#d9efff'],
  afternoon: ['#86b2df', '#ffd6a0'],
  evening: ['#262a5a', '#f08b62'],
};

const SUN: Record<
  TimeOfDay,
  { color: string; intensity: number; x: number; y: number; hemi: number }
> = {
  morning: { color: '#ffe0b5', intensity: 2.2, x: -14, y: 12, hemi: 1.4 },
  noon: { color: '#fff8ec', intensity: 2.8, x: 6, y: 30, hemi: 1.6 },
  afternoon: { color: '#ffd29b', intensity: 2.3, x: 16, y: 14, hemi: 1.4 },
  evening: { color: '#ff9a6a', intensity: 0.9, x: 18, y: 6, hemi: 0.95 },
};

const mix = (a: string, b: string, k: number) =>
  `#${new THREE.Color(a).lerp(new THREE.Color(b), k).getHexString()}`;

const gradient = ([top, bottom]: Sky): THREE.Texture => {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const g = c.getContext('2d');
  if (g) {
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, top);
    grad.addColorStop(0.75, bottom);
    grad.addColorStop(1, bottom);
    g.fillStyle = grad;
    g.fillRect(0, 0, 4, 256);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
};

const BOX = { x: 12, y: 11, back: 8, ahead: 50 };

export const buildAtmosphere = (opts: {
  time: TimeOfDay;
  weather: WeatherId;
  /** December: snow falls instead of rain, under a winter sky. */
  festive: boolean;
  /** Calm motion: a quarter of the rain and leaves. */
  calm?: boolean;
}): Atmosphere => {
  const { time, weather, festive } = opts;
  const share = opts.calm ? 0.25 : 1;
  const wet = weather === 'rain' || weather === 'storm';
  let sky: Sky = SKY[time];
  if (festive) sky = [mix(sky[0], '#b8c7da', 0.7), mix(sky[1], '#e3eaf2', 0.7)];
  if (weather === 'rain')
    sky = [mix(sky[0], '#7d8a9c', 0.6), mix(sky[1], '#c3ccd8', 0.55)];
  if (weather === 'storm')
    sky = [mix(sky[0], '#3c4352', 0.75), mix(sky[1], '#7b8494', 0.7)];
  if (weather === 'hot') sky = [sky[0], mix(sky[1], '#ffe7a8', 0.4)];
  const sun = { ...SUN[time] };
  if (weather === 'rain') sun.intensity *= 0.55;
  if (weather === 'storm') sun.intensity *= 0.35;
  if (weather === 'hot') sun.intensity *= 1.1;
  const hemi = SUN[time].hemi * (weather === 'storm' ? 0.75 : wet ? 0.85 : 1);
  const night = time === 'evening' ? 1 : weather === 'storm' ? 0.45 : 0;

  const group = new THREE.Group();
  const updates: ((t: number, dt: number, camZ: number) => void)[] = [];

  // Rain: short streaks falling fast, slanted by the storm's wind.
  if (wet && !festive) {
    const n = Math.round((weather === 'storm' ? 1300 : 800) * share);
    const slant = weather === 'storm' ? 0.35 : 0.08;
    const pos = new Float32Array(n * 6);
    const seed = () => [
      (Math.random() - 0.5) * BOX.x * 2,
      Math.random() * BOX.y,
      BOX.back - Math.random() * (BOX.ahead + BOX.back),
    ];
    const head: number[][] = Array.from({ length: n }, seed);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const lines = new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({
        color: '#dfe9f5',
        transparent: true,
        opacity: weather === 'storm' ? 0.55 : 0.45,
      })
    );
    lines.frustumCulled = false;
    group.add(lines);
    const speed = weather === 'storm' ? 26 : 18;
    updates.push((_t, dt, camZ) => {
      for (let i = 0; i < n; i++) {
        const p = head[i]!;
        p[1]! -= speed * dt;
        p[0]! += slant * speed * dt;
        if (p[1]! < 0) {
          p[1] = BOX.y;
          p[0] = (Math.random() - 0.5) * BOX.x * 2;
        }
        let z = p[2]!;
        if (z > camZ + BOX.back) z -= BOX.ahead + BOX.back;
        else if (z < camZ - BOX.ahead) z += BOX.ahead + BOX.back;
        p[2] = z;
        pos.set([p[0]!, p[1]!, z, p[0]! - slant * 0.5, p[1]! + 0.5, z], i * 6);
      }
      geo.getAttribute('position').needsUpdate = true;
    });
  }

  // Wind: leaves and dust blowing along the road, at you or with you.
  if (weather === 'headwind' || weather === 'tailwind' || weather === 'storm') {
    const n = Math.round(160 * share);
    const dir = weather === 'tailwind' ? -1 : 1;
    const pos = new Float32Array(n * 3);
    const phase = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos.set(
        [
          (Math.random() - 0.5) * BOX.x * 2,
          0.2 + Math.random() * 3.5,
          BOX.back - Math.random() * (BOX.ahead + BOX.back),
        ],
        i * 3
      );
      phase[i] = Math.random() * Math.PI * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const leaves = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: weather === 'storm' ? '#5b6b4a' : '#c98d3a',
        size: 0.16,
      })
    );
    leaves.frustumCulled = false;
    group.add(leaves);
    updates.push((t, dt, camZ) => {
      for (let i = 0; i < n; i++) {
        const k = i * 3;
        pos[k + 2] = (pos[k + 2] ?? 0) + dir * 14 * dt;
        pos[k + 1] =
          0.2 +
          (((pos[k + 1] ?? 0) -
            0.2 +
            Math.sin(t * 3 + (phase[i] ?? 0)) * 0.02 +
            4) %
            4);
        pos[k] = (pos[k] ?? 0) + Math.cos(t * 2 + (phase[i] ?? 0)) * 0.6 * dt;
        let z = pos[k + 2] ?? 0;
        if (z > camZ + BOX.back) z -= BOX.ahead + BOX.back;
        else if (z < camZ - BOX.ahead) z += BOX.ahead + BOX.back;
        pos[k + 2] = z;
      }
      geo.getAttribute('position').needsUpdate = true;
    });
  }

  // Lightning: a flash every few seconds in a storm, thunder a beat later.
  let nextFlash = 3 + Math.random() * 4;
  let flashAt = -10;
  const storm = weather === 'storm';

  return {
    group,
    background: gradient(sky),
    fog: new THREE.Color(sky[1]),
    fogNear: storm ? 30 : wet ? 40 : 60,
    fogFar: storm ? 130 : wet ? 160 : 190,
    sun,
    hemi,
    night,
    update(t, dt, camZ) {
      for (const u of updates) u(t, dt, camZ);
      let thunder = false;
      if (storm && t > nextFlash) {
        flashAt = t;
        nextFlash = t + 4 + Math.random() * 6;
        thunder = true;
      }
      const since = t - flashAt;
      const flash =
        since < 0.08
          ? 1
          : since < 0.16
            ? 0.2
            : since < 0.24
              ? 0.8
              : since < 0.5
                ? (0.5 - since) * 1.5
                : 0;
      return { flash, thunder };
    },
  };
};
