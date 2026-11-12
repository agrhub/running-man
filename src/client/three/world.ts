import * as THREE from 'three';
import type { City, Stage } from '../../shared/content';
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

export { UNITS_PER_KM };

/** Distance between lane centres, in world units. */
export const LANE_WIDTH = 2.3;

export type Runner = {
  name: string;
  look: Look;
  /** False for the player. */
  other: boolean;
  /** Small sideways offset so runners in one lane do not overlap exactly. */
  offset?: number;
  labelled?: boolean;
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

export type WorldOptions = {
  canvas: HTMLCanvasElement;
  city: City;
  stage: Stage;
  runners: Runner[];
  items?: CourseItem[];
  /** A single runner on a plain backdrop, used for the locker preview. */
  preview?: boolean;
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
    this.scene.add(
      new THREE.HemisphereLight(
        '#ffffff',
        palette.ground,
        opts.preview ? 2.2 : 1.5
      )
    );
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
      for (const item of opts.items ?? []) {
        const view = buildItem(item, LANE_WIDTH);
        this.scene.add(view.group);
        this.items.push(view);
      }
    }

    const paint = makePainter();
    for (const runner of opts.runners) {
      const holder = new THREE.Group();
      const chibi = buildChibi(runner.look, makePainter());
      chibi.group.rotation.y = opts.preview ? 0 : FORWARD;
      holder.add(chibi.group);
      this.scene.add(holder);
      let pet: Animated | null = null;
      if (!runner.other) {
        pet = buildPet(runner.look.pet, paint);
        pet.group.rotation.y = opts.preview ? 0 : FORWARD;
        this.scene.add(pet.group);
      }
      let label: THREE.Sprite | null = null;
      if (!opts.preview && runner.labelled !== false) {
        label = makeLabel(
          runner.other ? runner.name : 'You',
          runner.other ? '#2a2340' : palette.accent
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
        size: trailItem.shape === 'sparkle' ? 0.16 : 0.22,
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
      if (view.label) view.label.position.set(view.x, 2.05 - drop, z);
    }

    for (const it of this.items) it.update(t);

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
      this.sun.position.set(10, 22, this.camZ + 8);
      this.sun.target.position.set(0, 0, this.camZ - 6);
      this.city?.update(t, dt, this.camZ, finished);
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

    this.renderer.render(this.scene, this.camera);
  }

  /** Turns the preview runner towards the camera with a gentle sway; used by the locker. */
  sway(t: number, still: boolean) {
    const angle = -0.95 + (still ? 0 : Math.sin(t * 0.8) * 0.6);
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
