import * as THREE from 'three';
import type { City, Stage, TimeOfDay, WeatherId } from '../../shared/content';
import type { CourseItem } from '../../shared/course';
import type { Look } from '../../shared/economy';
import { itemById } from '../../shared/economy';
import {
  buildChibi,
  buildPet,
  disposeTree,
  makePainter,
  type Animated,
} from './chibi';
import {
  UNITS_PER_KM,
  buildCity,
  buildItem,
  type CityBuild,
  type ItemView,
} from './city';
import { buildFestive, type Festive } from './festive';
import { buildAtmosphere, type Atmosphere } from './atmosphere';

export { UNITS_PER_KM };

/** Distance between lane centres, in world units. */
export const LANE_WIDTH = 2.3;

export type Runner = {
  name: string;
  look: Look;
  bib?: number | null;
  /** False for the player. */
  other: boolean;
  /** Small sideways offset so runners in one lane do not overlap exactly. */
  offset?: number;
  labelled?: boolean;
  /** Friends and clubmates get their own tag colour. */
  tag?: 'friend' | 'club';
};

type RunnerView = {
  runner: Runner;
  holder: THREE.Group;
  chibi: Animated;
  pet: Animated | null;
  label: THREE.Sprite | null;
  z: number;
  x: number;
  fellAt: number;
  /** Materials of other runners, faded while they stand between the camera and you. */
  materials: THREE.Material[];
  opacity: number;
};

const makeLabel = (text: string, color: string): THREE.Sprite => {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.font = '700 30px Nunito, sans-serif';
    const w = Math.min(244, ctx.measureText(text).width + 28);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect((256 - w) / 2, 10, w, 44, 22);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 33, 230);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true })
  );
  sprite.scale.set(1.5, 0.38, 1);
  sprite.renderOrder = 10;
  return sprite;
};

const makeBubble = (text: string): THREE.Sprite => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.font = '700 40px Nunito, sans-serif';
    const w = Math.min(496, ctx.measureText(text).width + 44);
    const x = (512 - w) / 2;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#2a2340';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.roundRect(x, 8, w, 84, 30);
    ctx.moveTo(240, 90);
    ctx.lineTo(256, 118);
    ctx.lineTo(272, 90);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(242, 84, 28, 8);
    ctx.fillStyle = '#2a2340';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 52, 470);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true })
  );
  sprite.scale.set(2.4, 0.6, 1);
  sprite.renderOrder = 11;
  return sprite;
};

export type WorldOptions = {
  canvas: HTMLCanvasElement;
  city: City;
  stage: Stage;
  runners: Runner[];
  items?: CourseItem[];
  /** A single runner on a plain backdrop, used for the locker preview. */
  preview?: boolean;
  /** December dressing: snow, lights and trees ('christmas' snows harder). */
  festive?: 'season' | 'christmas' | null;
  weather?: WeatherId;
  time?: TimeOfDay;
  /** Called a moment after each lightning flash. */
  onThunder?: () => void;
};

export type Position = {
  name: string;
  km: number;
  speed: number;
  /** Lane -1..1 (may be fractional while changing lanes). */
  lane?: number;
  /** Limping after a fall or a cone. */
  limp?: boolean;
};

export type Positions = Position[];

/** Facing -z (down the course): the chibi is modelled facing +x. */
const FORWARD = Math.PI / 2;
/** Facing the camera, for the finish celebration. */
const TOWARD_CAMERA = -Math.PI / 2;

/**
 * The race scene: a third-person view from behind the runner, looking down a city avenue towards the finish. The
 * caller drives it with every runner's distance and lane per frame.
 */
export class RunWorld {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(55, 1, 0.1, 500);
  private readonly views = new Map<string, RunnerView>();
  private readonly items: ItemView[] = [];
  private readonly sun: THREE.DirectionalLight;
  private readonly city: CityBuild | null = null;
  private readonly festive: Festive | null = null;
  private readonly atmosphere: Atmosphere | null = null;
  private readonly hemi: THREE.HemisphereLight;
  private thunderAt = -1;
  private readonly trail: THREE.Points | null = null;
  private readonly trailData: {
    x: number;
    y: number;
    z: number;
    life: number;
  }[] = [];
  private readonly resizeObserver: ResizeObserver;
  private disposed = false;
  private camZ: number | null = null;
  private camX = 0;
  private lastT = 0;
  private finishTurn = 0;
  private baseFov = 55;
  private frames = 0;
  /** Adaptive quality: 0 full, 1 lower resolution, 2 also no shadows. */
  private quality = 0;
  private perfTime = 0;
  private perfFrames = 0;
  private readonly bubbles = new Map<
    string,
    { sprite: THREE.Sprite; until: number }
  >();

  constructor(private readonly opts: WorldOptions) {
    this.renderer = new THREE.WebGLRenderer({
      canvas: opts.canvas,
      antialias: true,
      alpha: true,
    });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = !opts.preview;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const palette = opts.city.palette;
    this.hemi = new THREE.HemisphereLight(
      '#ffffff',
      palette.ground,
      opts.preview ? 2.2 : 1.5
    );
    this.scene.add(this.hemi);
    const sun = new THREE.DirectionalLight('#fff4e0', opts.preview ? 1.6 : 2.4);
    sun.position.set(10, 22, 8);
    sun.castShadow = !opts.preview;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -22;
    sun.shadow.camera.right = 22;
    sun.shadow.camera.top = 30;
    sun.shadow.camera.bottom = -14;
    sun.shadow.camera.far = 80;
    sun.shadow.bias = -0.0005;
    this.scene.add(sun, sun.target);
    this.sun = sun;

    if (!opts.preview) {
      this.scene.fog = new THREE.Fog(new THREE.Color(palette.skyLow), 60, 190);
      this.city = buildCity(opts.city, opts.stage, true);
      this.scene.add(this.city.group);
      if (opts.festive) {
        this.festive = buildFestive(opts.festive === 'christmas');
        this.scene.add(this.festive.group);
      }
      const air = buildAtmosphere({
        time: opts.time ?? 'morning',
        weather: opts.weather ?? 'cool',
        festive: Boolean(opts.festive),
      });
      this.atmosphere = air;
      this.scene.add(air.group);
      this.scene.background = air.background;
      this.scene.fog = new THREE.Fog(air.fog, air.fogNear, air.fogFar);
      sun.color.set(air.sun.color);
      sun.intensity = air.sun.intensity;
      this.hemi.intensity = air.hemi;
      this.city.setNight(air.night);
      for (const item of opts.items ?? []) {
        const view = buildItem(item, LANE_WIDTH);
        this.scene.add(view.group);
        this.items.push(view);
      }
    }

    const paint = makePainter();
    for (const runner of opts.runners) {
      const holder = new THREE.Group();
      const chibi = buildChibi(
        runner.look,
        makePainter(runner.other),
        runner.bib ?? null
      );
      chibi.group.rotation.y = opts.preview ? 0 : FORWARD;
      holder.add(chibi.group);
      this.scene.add(holder);
      const materials = new Set<THREE.Material>();
      if (runner.other) {
        chibi.group.traverse((o) => {
          if (!(o instanceof THREE.Mesh) || Array.isArray(o.material)) return;
          const m = o.material as THREE.MeshStandardMaterial;
          // The bib is its own textured material: fade it with the rest of the runner.
          if (m.map && !m.transparent) {
            m.transparent = true;
            m.needsUpdate = true;
          }
          if (m.transparent) materials.add(m);
        });
      }
      let pet: Animated | null = null;
      if (!runner.other) {
        pet = buildPet(runner.look.pet, paint, runner.look.petGear);
        pet.group.rotation.y = opts.preview ? 0 : FORWARD;
        this.scene.add(pet.group);
      }
      let label: THREE.Sprite | null = null;
      if (!opts.preview && runner.labelled !== false) {
        label = makeLabel(
          runner.other ? runner.name : 'You',
          !runner.other
            ? palette.accent
            : runner.tag === 'friend'
              ? '#1f8f7f'
              : runner.tag === 'club'
                ? '#6c4fd8'
                : '#2a2340'
        );
        this.scene.add(label);
      }
      this.views.set(runner.name, {
        runner,
        holder,
        chibi,
        pet,
        label,
        z: 0,
        x: runner.offset ?? 0,
        fellAt: -10,
        materials: [...materials],
        opacity: 1,
      });
    }

    const me = opts.runners.find((r) => !r.other);
    const trailItem = me ? itemById(me.look.trail) : undefined;
    if (trailItem && trailItem.shape !== 'none' && !opts.preview) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array(40 * 3), 3)
      );
      const mat = new THREE.PointsMaterial({
        color: trailItem.color,
        size:
          trailItem.shape === 'sparkle'
            ? 0.16
            : trailItem.shape === 'snow'
              ? 0.14
              : 0.22,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      });
      this.trail = new THREE.Points(geo, mat);
      this.scene.add(this.trail);
      for (let i = 0; i < 40; i++)
        this.trailData.push({ x: 0, y: -10, z: 0, life: 0 });
    }

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(opts.canvas);
    this.resize();
  }

  /**
   * Watches the frame rate and steps quality down on slow phones: first a lower
   * resolution, then no shadows. It never steps back up within a race.
   */
  private adapt(dt: number) {
    if (this.quality >= 2 || dt <= 0) return;
    this.perfTime += dt;
    this.perfFrames += 1;
    if (this.perfTime < 2.5) return;
    const fps = this.perfFrames / this.perfTime;
    this.perfTime = 0;
    this.perfFrames = 0;
    if (fps >= 42) return;
    this.quality += 1;
    if (this.quality === 1) {
      this.renderer.setPixelRatio(1);
      this.resize();
    } else {
      this.sun.castShadow = false;
      this.renderer.shadowMap.enabled = false;
      this.scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) m.needsUpdate = true;
        }
      });
    }
    this.opts.canvas.dataset.quality = String(this.quality);
  }

  private resize() {
    const { canvas } = this.opts;
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.baseFov = this.opts.preview ? 38 : w / h < 0.8 ? 64 : 50;
    this.camera.fov = this.baseFov;
    this.camera.updateProjectionMatrix();
  }

  private capSize(sprite: THREE.Sprite, w: number, h: number) {
    const k = Math.min(1, this.camera.position.distanceTo(sprite.position) / 9);
    sprite.scale.set(w * k, h * k, 1);
  }

  /** Shows a speech bubble over a runner for a few seconds. */
  say(name: string, text: string) {
    const old = this.bubbles.get(name);
    if (old) {
      this.scene.remove(old.sprite);
      old.sprite.material.map?.dispose();
      old.sprite.material.dispose();
    }
    const sprite = makeBubble(text);
    this.scene.add(sprite);
    this.bubbles.set(name, { sprite, until: this.lastT + 2.8 });
  }

  /** A runner trips and falls (collisions). */
  fall(name: string) {
    const v = this.views.get(name);
    if (v) v.fellAt = this.lastT;
  }

  /** The runner met a course item: cones fly, puddles splash, fans jump. */
  hitItem(index: number) {
    this.items[index]?.hit(this.lastT);
  }

  /**
   * Renders one frame. `t` is animation time in seconds; `finished` turns the runner to the camera; `gaze` (0..1)
   * widens the view towards the landmark.
   */
  frame(
    t: number,
    positions: Positions,
    focus: string,
    finished = false,
    gaze = 0
  ) {
    if (this.disposed) return;
    const dt = Math.max(0, Math.min(0.5, t - this.lastT));
    this.lastT = t;
    // Skip the first seconds: shaders compile and the city uploads then.
    if (!this.opts.preview && t > 3) this.adapt(dt);
    const ease = 1 - Math.exp(-dt * 10);

    for (const p of positions) {
      const view = this.views.get(p.name);
      if (!view) continue;
      const z = -p.km * UNITS_PER_KM;
      view.z = z;
      const targetX = (p.lane ?? 0) * LANE_WIDTH + (view.runner.offset ?? 0);
      view.x = this.opts.preview ? 0 : view.x + (targetX - view.x) * ease;

      // Falling: tip forward, hit the ground, get back up.
      const since = t - view.fellAt;
      let tilt = 0;
      let drop = 0;
      if (since >= 0 && since < 1.2) {
        const k =
          since < 0.25
            ? since / 0.25
            : since < 0.7
              ? 1
              : 1 - (since - 0.7) / 0.5;
        tilt = k * 1.25;
        drop = k * 0.25;
      }
      if (!this.opts.preview) {
        view.holder.position.set(view.x, -drop, z);
        view.holder.rotation.x = -tilt;
        if (p.limp && since >= 1.2)
          view.holder.rotation.z = Math.sin(t * 9) * 0.12;
        else view.holder.rotation.z = 0;
      }
      view.chibi.update(t, since < 1.2 ? 0 : p.speed);
      if (view.pet) {
        if (!this.opts.preview)
          view.pet.group.position.set(view.x + 0.75, 0, z + 0.6);
        view.pet.update(t, p.speed);
      }
      // Just above the head (hair buns and hats included), so the tag reads as this runner's even up close.
      if (view.label) view.label.position.set(view.x, 1.74 - drop, z);
    }

    for (const it of this.items) it.update(t);

    // Runners between the camera and you fade so they never hide your runner.
    const meView = this.views.get(focus);
    if (meView && !this.opts.preview) {
      for (const v of this.views.values()) {
        if (!v.runner.other || v.materials.length === 0) continue;
        // How far behind you, towards the camera (which follows about 6.4 back).
        const gap = v.z - meView.z;
        const inLine = Math.abs(v.x - meView.x * 0.7) < 2.8;
        const nearLens = inLine && gap > 1.9 && gap < 7.5;
        // Right at the lens a runner would fill the screen, so it almost disappears;
        // just behind you it stays faintly visible.
        const target =
          !inLine || gap <= 0.6 || gap >= 7.5 ? 1 : nearLens ? 0.06 : 0.32;
        if (v.label) v.label.visible = !nearLens;
        if (Math.abs(target - v.opacity) < 0.01) continue;
        v.opacity += (target - v.opacity) * Math.min(1, dt * 10);
        for (const m of v.materials) {
          m.opacity = v.opacity;
          m.depthWrite = v.opacity > 0.95;
        }
      }
    }

    for (const [name, b] of this.bubbles) {
      const v = this.views.get(name);
      if (!v || t > b.until) {
        this.scene.remove(b.sprite);
        b.sprite.material.map?.dispose();
        b.sprite.material.dispose();
        this.bubbles.delete(name);
        continue;
      }
      b.sprite.position.set(
        v.x,
        2.1 + Math.min(0.1, (b.until - t) * 0.06),
        v.z
      );
      // Hidden with the tag when the runner is right at the camera lens.
      b.sprite.visible = v.holder.visible && (v.label?.visible ?? true);
    }

    const me = this.views.get(focus);
    if (this.opts.preview) {
      this.camera.position.set(2.6, 1.6, 3.6);
      this.camera.lookAt(0, 0.7, 0.2);
    } else {
      const targetZ = me ? me.z : 0;
      this.camZ =
        this.camZ === null
          ? targetZ
          : this.camZ + (targetZ - this.camZ) * (1 - Math.exp(-dt * 8));
      this.camX += ((me?.x ?? 0) - this.camX) * (1 - Math.exp(-dt * 4));
      if (finished && me) {
        this.finishTurn = Math.min(1, this.finishTurn + dt * 1.6);
        me.chibi.group.rotation.y =
          FORWARD + (TOWARD_CAMERA - FORWARD) * this.finishTurn;
        if (me.pet) me.pet.group.rotation.y = me.chibi.group.rotation.y;
      }
      const swing = this.finishTurn;
      const back = 6.4 - swing * 1.8;
      const cx = this.camX * 0.7 + swing * 2.2;
      // Landmark moment: widen the view and pan a little to the right, keeping the runner in frame.
      this.camera.position.set(
        cx - gaze * 0.6,
        3.1 - swing * 0.6 + gaze * 0.9,
        this.camZ + back + gaze * 1.5
      );
      this.camera.lookAt(
        this.camX * 0.5 + gaze * 4.5,
        1.35 - swing * 0.3 + gaze * 2.6,
        this.camZ - 9 + swing * 9
      );
      const fov = this.baseFov + gaze * 16;
      if (Math.abs(this.camera.fov - fov) > 0.01) {
        this.camera.fov = fov;
        this.camera.updateProjectionMatrix();
      }
      this.sun.position.set(
        this.atmosphere?.sun.x ?? 10,
        this.atmosphere?.sun.y ?? 22,
        this.camZ + 8
      );
      this.sun.target.position.set(0, 0, this.camZ - 6);
      this.city?.update(t, dt, this.camZ, finished);
      this.festive?.update(t, dt, this.camZ);
      if (this.atmosphere) {
        const air = this.atmosphere.update(t, dt, this.camZ);
        this.hemi.intensity = this.atmosphere.hemi + air.flash * 2.4;
        if (air.thunder) this.thunderAt = t + 0.6 + Math.random() * 0.8;
        if (this.thunderAt > 0 && t >= this.thunderAt) {
          this.thunderAt = -1;
          this.opts.onThunder?.();
        }
      }
      // Far runners and items are lost in the fog anyway: skip drawing them.
      const camZ = this.camZ;
      for (const v of this.views.values()) {
        const near = v.z < camZ + 12 && v.z > camZ - 110;
        v.holder.visible = near;
        if (v.label) v.label.visible = near;
      }
      for (const it of this.items) {
        const z = it.group.position.z;
        it.group.visible = z < camZ + 12 && z > camZ - 110;
      }
    }

    if (this.trail && me) {
      const meSpeed = positions.find((p) => p.name === focus)?.speed ?? 0;
      const slot = this.trailData.find((d) => d.life <= 0);
      if (slot && meSpeed > 0.05 && Math.random() < 0.6) {
        slot.x = me.x + (Math.random() - 0.5) * 0.5;
        slot.y = 0.4 + Math.random() * 0.6;
        slot.z = me.z + 0.4;
        slot.life = 1;
      }
      const attr = this.trail.geometry.getAttribute('position');
      this.trailData.forEach((d, i) => {
        if (d.life > 0) {
          d.life -= 0.025;
          d.y += 0.01;
        }
        attr.setXYZ(i, d.x, d.life > 0 ? d.y : -10, d.z);
      });
      attr.needsUpdate = true;
    }

    // Name tags and bubbles never grow bigger on screen than they look 9 units away.
    for (const v of this.views.values())
      if (v.label) this.capSize(v.label, 1.5, 0.38);
    for (const b of this.bubbles.values()) this.capSize(b.sprite, 2.4, 0.6);
    this.renderer.render(this.scene, this.camera);
    // Cheap stats on the canvas for profiling (read from devtools or the e2e test).
    if (++this.frames % 30 === 0) {
      const { calls, triangles } = this.renderer.info.render;
      this.opts.canvas.dataset.drawCalls = String(calls);
      this.opts.canvas.dataset.triangles = String(triangles);
    }
  }

  /**
   * Turns the preview runner towards the camera with a gentle sway; used by the locker and registration.
   * With `showBack`, the runner turns round every few seconds to show the bib.
   */
  sway(t: number, still: boolean, showBack = false) {
    let angle = -0.95 + (still ? 0 : Math.sin(t * 0.8) * 0.6);
    if (showBack && !still) {
      const phase = t % 9;
      const k =
        phase < 6
          ? 0
          : phase < 6.6
            ? (phase - 6) / 0.6
            : phase < 8.4
              ? 1
              : 1 - (phase - 8.4) / 0.6;
      angle += k * Math.PI;
    }
    for (const v of this.views.values()) {
      v.chibi.group.rotation.y = angle;
      if (v.pet) {
        v.pet.group.rotation.y = angle;
        v.pet.group.position.set(0.75, 0, 0.55);
      }
    }
  }

  dispose() {
    this.disposed = true;
    this.resizeObserver.disconnect();
    disposeTree(this.scene);
    this.renderer.dispose();
  }
}
