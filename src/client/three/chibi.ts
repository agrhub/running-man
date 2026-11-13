import * as THREE from 'three';
import {
  HAIR_TONES,
  SKIN_TONES,
  itemById,
  type Look,
  type PetId,
} from '../../shared/economy';

export type Painter = (
  color: string,
  extra?: { emissive?: string; opacity?: number }
) => THREE.Material;

/** `fadeable` materials can be faded when a runner stands between the camera and you. */
export const makePainter = (fadeable = false): Painter => {
  const cache = new Map<string, THREE.Material>();
  return (color, extra) => {
    const key = `${color}|${extra?.emissive ?? ''}|${extra?.opacity ?? 1}`;
    const hit = cache.get(key);
    if (hit) return hit;
    const opacity = extra?.opacity ?? 1;
    // Soft, rounded vinyl-toy shading that sits well in the lit city.
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.55,
      transparent: fadeable || opacity < 1,
      opacity,
      depthWrite: opacity >= 1,
      ...(extra?.emissive
        ? { emissive: new THREE.Color(extra.emissive), emissiveIntensity: 0.9 }
        : {}),
    });
    cache.set(key, mat);
    return mat;
  };
};

let blobTex: THREE.CanvasTexture | null = null;

/** A soft round shadow under a character: one quad instead of a shadow pass per body part. */
export const blobShadow = (size: number): THREE.Mesh => {
  if (!blobTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    if (g) {
      const r = g.createRadialGradient(32, 32, 1, 32, 32, 31);
      r.addColorStop(0, 'rgba(0,0,0,.42)');
      r.addColorStop(0.6, 'rgba(0,0,0,.18)');
      r.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = r;
      g.fillRect(0, 0, 64, 64);
    }
    blobTex = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({
      map: blobTex,
      transparent: true,
      depthWrite: false,
    })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.02;
  m.renderOrder = 1;
  return m;
};

const mesh = (
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  x = 0,
  y = 0,
  z = 0
): THREE.Mesh => {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
};

export type Animated = {
  group: THREE.Group;
  /** speed is roughly 0 (idle) .. 1 (full push); t is seconds of animation time. */
  update(t: number, speed: number): void;
};

/**
 * Builds a chibi runner facing +x. About 1.4 units tall: big head, tiny body.
 */
const bibTextures = new Map<number, THREE.CanvasTexture>();

/** The race bib pinned on the runner's back: a white square with the number. */
const bibTexture = (bib: number): THREE.CanvasTexture => {
  const hit = bibTextures.get(bib);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 96;
  const g = c.getContext('2d');
  if (g) {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 128, 96);
    g.fillStyle = '#ff5f4f';
    g.fillRect(0, 0, 128, 16);
    g.fillStyle = '#2a2340';
    g.font = '800 54px "Baloo 2", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(bib).padStart(4, '0'), 64, 60, 120);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  bibTextures.set(bib, t);
  return t;
};

export const buildChibi = (
  look: Look,
  paint: Painter,
  bib: number | null = null
): Animated => {
  const group = new THREE.Group();
  const skin = paint(SKIN_TONES[look.skin] ?? SKIN_TONES[0]!);
  const hairColor = HAIR_TONES[look.hair] ?? HAIR_TONES[0]!;
  const top = itemById(look.top);
  const hat = itemById(look.hat);
  const shoes = itemById(look.shoes);
  const extra = itemById(look.accessory);
  const ink = paint('#2a2340');

  const body = new THREE.Group();
  body.position.y = 0.42;
  group.add(body);

  // Torso
  const shirtColor = top?.color ?? '#ff7a6b';
  if (bib !== null) {
    // the bib on the back (the runner faces +x)
    const bibMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.3, 0.22),
      new THREE.MeshStandardMaterial({ map: bibTexture(bib), roughness: 0.8 })
    );
    bibMesh.position.set(-0.212, 0.2, 0);
    bibMesh.rotation.y = -Math.PI / 2;
    body.add(bibMesh);
  }
  const torso = mesh(
    new THREE.CapsuleGeometry(0.2, 0.16, 4, 12),
    paint(shirtColor),
    0,
    0.2,
    0
  );
  body.add(torso);
  if (top?.shape === 'finisherTee') {
    body.add(
      mesh(
        new THREE.TorusGeometry(0.205, 0.03, 6, 20),
        paint('#ffc23d'),
        0,
        0.2,
        0
      ).rotateX(Math.PI / 2)
    );
  }
  if (top?.shape === 'raincoat') {
    const coat = mesh(
      new THREE.CapsuleGeometry(0.25, 0.2, 4, 12),
      paint('#bfe9ff', { opacity: 0.55 }),
      0,
      0.2,
      0
    );
    body.add(coat);
  }

  // Head
  const head = new THREE.Group();
  head.position.y = 0.72;
  body.add(head);
  head.add(mesh(new THREE.SphereGeometry(0.34, 20, 16), skin));
  const hair = mesh(
    new THREE.SphereGeometry(0.355, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.52),
    paint(hairColor),
    -0.02,
    0.03,
    0
  );
  hair.rotation.z = 0.25;
  head.add(hair);
  const hairMat = paint(hairColor);
  switch (look.hairStyle ?? 0) {
    case 1: {
      // spiky: a crown of little cones
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const spike = mesh(
          new THREE.ConeGeometry(0.07, 0.2, 6),
          hairMat,
          Math.cos(a) * 0.17 - 0.04,
          0.33,
          Math.sin(a) * 0.17
        );
        spike.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
        head.add(spike);
      }
      break;
    }
    case 2: {
      // bob: hair down to the jaw at the sides and back
      const bob = mesh(
        new THREE.SphereGeometry(
          0.375,
          20,
          14,
          Math.PI * 0.6,
          Math.PI * 1.8,
          0,
          Math.PI * 0.78
        ),
        hairMat,
        -0.02,
        0.0,
        0
      );
      head.add(bob);
      break;
    }
    case 3: {
      // bun on top at the back
      head.add(
        mesh(new THREE.SphereGeometry(0.13, 12, 10), hairMat, -0.18, 0.3, 0)
      );
      break;
    }
    default:
      break;
  }
  const eyeGeo = new THREE.SphereGeometry(0.045, 10, 8);
  head.add(
    mesh(eyeGeo, ink, 0.3, 0.0, 0.12),
    mesh(eyeGeo, ink, 0.3, 0.0, -0.12)
  );
  const blushGeo = new THREE.SphereGeometry(0.05, 8, 6);
  const blush = paint('#ff9fb2');
  head.add(
    mesh(blushGeo, blush, 0.27, -0.09, 0.2),
    mesh(blushGeo, blush, 0.27, -0.09, -0.2)
  );

  // Hats
  switch (hat?.shape) {
    case 'crown': {
      const gold = paint(hat.color, { emissive: '#7a5600' });
      const ring = mesh(
        new THREE.CylinderGeometry(0.2, 0.22, 0.12, 16, 1, true),
        gold,
        0,
        0.38,
        0
      );
      head.add(ring);
      const spike = new THREE.ConeGeometry(0.045, 0.12, 6);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        head.add(
          mesh(spike, gold, Math.cos(a) * 0.19, 0.49, Math.sin(a) * 0.19)
        );
      }
      head.add(
        mesh(
          new THREE.SphereGeometry(0.035, 8, 6),
          paint('#ff4f81'),
          0.21,
          0.38,
          0
        )
      );
      break;
    }
    case 'ears': {
      const fur = paint(hat.color);
      const inner = paint('#ffb3c7');
      const earGeo = new THREE.CapsuleGeometry(0.06, 0.26, 4, 10);
      const innerGeo = new THREE.CapsuleGeometry(0.035, 0.2, 4, 8);
      for (const side of [1, -1]) {
        const ear = new THREE.Group();
        ear.position.set(-0.03, 0.42, side * 0.13);
        ear.rotation.x = side * -0.22;
        ear.add(mesh(earGeo, fur, 0, 0.15, 0));
        ear.add(mesh(innerGeo, inner, 0.03, 0.15, 0));
        head.add(ear);
      }
      head.add(
        mesh(
          new THREE.TorusGeometry(0.34, 0.025, 6, 24, Math.PI),
          fur,
          -0.02,
          0.12,
          0
        ).rotateY(Math.PI / 2)
      );
      break;
    }
    case 'cap': {
      const mat = paint(hat.color);
      head.add(
        mesh(
          new THREE.SphereGeometry(0.36, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
          mat,
          0,
          0.06,
          0
        )
      );
      const brim = mesh(
        new THREE.CylinderGeometry(0.22, 0.22, 0.04, 16),
        mat,
        0.3,
        0.1,
        0
      );
      brim.scale.set(1.2, 1, 1.4);
      head.add(brim);
      break;
    }
    case 'hachimaki': {
      head.add(
        mesh(
          new THREE.TorusGeometry(0.35, 0.05, 6, 24),
          paint('#ffffff'),
          0,
          0.12,
          0
        ).rotateX(Math.PI / 2)
      );
      head.add(
        mesh(
          new THREE.CircleGeometry(0.07, 16),
          paint('#e63946'),
          0.355,
          0.12,
          0
        ).rotateY(Math.PI / 2)
      );
      break;
    }
    case 'beret': {
      const beret = mesh(
        new THREE.SphereGeometry(0.33, 16, 10),
        paint(hat.color),
        -0.04,
        0.26,
        0.05
      );
      beret.scale.set(1.15, 0.38, 1.15);
      beret.rotation.z = 0.3;
      head.add(beret);
      break;
    }
    case 'conical': {
      head.add(
        mesh(
          new THREE.ConeGeometry(0.62, 0.34, 24),
          paint(hat.color),
          0,
          0.36,
          0
        )
      );
      break;
    }
    case 'visor': {
      // Open-top sun visor: a band, a wide brim and a gold sun on the front.
      const mat = paint(hat.color);
      head.add(
        mesh(
          new THREE.CylinderGeometry(0.355, 0.355, 0.1, 24, 1, true),
          mat,
          0,
          0.14,
          0
        )
      );
      const brim = mesh(
        new THREE.CylinderGeometry(0.24, 0.24, 0.035, 20),
        mat,
        0.36,
        0.1,
        0
      );
      brim.scale.set(1.25, 1, 1.5);
      head.add(brim);
      head.add(
        mesh(
          new THREE.CircleGeometry(0.06, 16),
          paint('#ffc93c'),
          0.358,
          0.15,
          0
        ).rotateY(Math.PI / 2)
      );
      break;
    }
    case 'tophat': {
      const mat = paint(hat.color);
      head.add(
        mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.36, 16), mat, 0, 0.45, 0)
      );
      head.add(
        mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.04, 20), mat, 0, 0.28, 0)
      );
      head.add(
        mesh(
          new THREE.CylinderGeometry(0.205, 0.205, 0.07, 16),
          paint('#ff5f4f'),
          0,
          0.33,
          0
        )
      );
      break;
    }
    default:
      break;
  }

  // Accessories
  switch (extra?.shape) {
    case 'headband': {
      head.add(
        mesh(
          new THREE.TorusGeometry(0.345, 0.045, 6, 24),
          paint(extra.color),
          0,
          0.14,
          0
        ).rotateX(Math.PI / 2)
      );
      break;
    }
    case 'shades': {
      const mat = paint(extra.color);
      const lens = new THREE.BoxGeometry(0.05, 0.09, 0.15);
      head.add(
        mesh(lens, mat, 0.33, 0.02, 0.11),
        mesh(lens, mat, 0.33, 0.02, -0.11)
      );
      head.add(
        mesh(new THREE.BoxGeometry(0.03, 0.02, 0.1), mat, 0.33, 0.04, 0)
      );
      break;
    }
    case 'scarf': {
      const mat = paint(extra.color);
      body.add(
        mesh(
          new THREE.TorusGeometry(0.17, 0.06, 6, 18),
          mat,
          0,
          0.42,
          0
        ).rotateX(Math.PI / 2)
      );
      const tail = mesh(
        new THREE.BoxGeometry(0.08, 0.26, 0.1),
        mat,
        -0.16,
        0.3,
        0.08
      );
      tail.rotation.z = -0.5;
      body.add(tail);
      break;
    }
    default:
      break;
  }

  // Arms
  const armGeo = new THREE.CapsuleGeometry(0.06, 0.14, 4, 8);
  const makeArm = (side: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(0, 0.34, side * 0.23);
    const arm = mesh(armGeo, skin, 0, -0.1, 0);
    pivot.add(arm);
    body.add(pivot);
    return pivot;
  };
  const armL = makeArm(1);
  const armR = makeArm(-1);

  // Legs and shoes
  const legGeo = new THREE.CapsuleGeometry(0.075, 0.14, 4, 8);
  const shoeMat = paint(
    shoes?.color ?? '#ffffff',
    shoes?.shape === 'glowRunners' ? { emissive: shoes.color } : undefined
  );
  const shoeGeo = new THREE.BoxGeometry(0.2, 0.09, 0.13);
  const pants = paint('#3d3a5c');
  const makeLeg = (side: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(0, 0.42, side * 0.1);
    pivot.add(mesh(legGeo, pants, 0, -0.17, 0));
    pivot.add(mesh(shoeGeo, shoeMat, 0.04, -0.34, 0));
    group.add(pivot);
    return pivot;
  };
  const legL = makeLeg(1);
  const legR = makeLeg(-1);

  group.add(blobShadow(1.1));
  group.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = false;
  });

  return {
    group,
    update: (t, speed) => {
      const cadence = 7 + speed * 7;
      const swing = Math.sin(t * cadence) * (0.25 + speed * 0.75);
      legL.rotation.z = swing;
      legR.rotation.z = -swing;
      armL.rotation.z = -swing * 1.1;
      armR.rotation.z = swing * 1.1;
      body.position.y =
        0.42 + Math.abs(Math.sin(t * cadence)) * (0.03 + speed * 0.06);
      body.rotation.z = -0.08 - speed * 0.12;
      head.rotation.z = Math.sin(t * cadence * 0.5) * 0.04;
    },
  };
};

const PET_COLORS: Record<
  PetId,
  { main: string; belly: string; accent: string }
> = {
  corgi: { main: '#e9a052', belly: '#fff4e2', accent: '#2a2340' },
  cat: { main: '#b9b2a8', belly: '#f4efe6', accent: '#e9a052' },
  shiba: { main: '#e07b39', belly: '#fff1dc', accent: '#2a2340' },
  penguin: { main: '#2f2f48', belly: '#ffffff', accent: '#ffa62b' },
  bunny: { main: '#f6f1fb', belly: '#ffffff', accent: '#ffb3c7' },
  fox: { main: '#f0843a', belly: '#fff6ec', accent: '#2a2340' },
  panda: { main: '#ffffff', belly: '#ffffff', accent: '#2a2340' },
};

/** Where gear sits on a pet: on top of the head, around the neck, and over the eyes (pet faces +x). */
type PetAnchors = {
  headTop: THREE.Vector3;
  neck: THREE.Vector3;
  eyes: THREE.Vector3;
  headR: number;
};

const addPetGear = (
  parent: THREE.Object3D,
  gearId: string | undefined,
  a: PetAnchors,
  paint: Painter
) => {
  const gear = gearId ? itemById(gearId) : undefined;
  if (!gear || gear.shape === 'none') return;
  const k = a.headR / 0.15;
  const at = (v: THREE.Vector3, o: THREE.Object3D) => {
    o.position.add(v);
    parent.add(o);
  };
  switch (gear.shape) {
    case 'petCollar': {
      const ring = mesh(
        new THREE.TorusGeometry(0.1 * k, 0.022, 6, 16),
        paint(gear.color),
        0,
        0,
        0
      ).rotateY(Math.PI / 2);
      ring.rotation.z = 0.5;
      at(a.neck, ring);
      at(
        a.neck.clone().add(new THREE.Vector3(0.09 * k, -0.06 * k, 0)),
        mesh(
          new THREE.SphereGeometry(0.03, 8, 6),
          paint('#ffc83d', { emissive: '#7a5600' })
        )
      );
      break;
    }
    case 'petBandana': {
      const cloth = paint(gear.color);
      const ring = mesh(
        new THREE.TorusGeometry(0.1 * k, 0.025, 6, 16),
        cloth
      ).rotateY(Math.PI / 2);
      ring.rotation.z = 0.5;
      at(a.neck, ring);
      const tri = mesh(new THREE.ConeGeometry(0.08 * k, 0.13 * k, 3), cloth);
      tri.rotation.z = Math.PI * 0.82;
      at(a.neck.clone().add(new THREE.Vector3(0.08 * k, -0.06 * k, 0)), tri);
      break;
    }
    case 'petBow': {
      const ribbon = paint(gear.color);
      const bow = new THREE.Group();
      const loop = new THREE.ConeGeometry(0.05 * k, 0.09 * k, 8);
      for (const side of [1, -1]) {
        const c = mesh(loop, ribbon, 0, 0, side * 0.05 * k);
        c.rotation.x = (side * Math.PI) / 2;
        bow.add(c);
      }
      bow.add(mesh(new THREE.SphereGeometry(0.025 * k, 8, 6), ribbon));
      bow.rotation.y = 0.5;
      at(a.headTop.clone().add(new THREE.Vector3(-0.02, -0.01, 0.07 * k)), bow);
      break;
    }
    case 'petCap': {
      const mat = paint(gear.color);
      const dome = mesh(
        new THREE.SphereGeometry(
          a.headR * 0.78,
          14,
          8,
          0,
          Math.PI * 2,
          0,
          Math.PI / 2
        ),
        mat
      );
      at(a.headTop.clone().add(new THREE.Vector3(0, -a.headR * 0.32, 0)), dome);
      const brim = mesh(
        new THREE.CylinderGeometry(0.09 * k, 0.09 * k, 0.02, 14),
        mat
      );
      brim.scale.set(1.3, 1, 1.1);
      at(
        a.headTop
          .clone()
          .add(new THREE.Vector3(a.headR * 0.62, -a.headR * 0.3, 0)),
        brim
      );
      break;
    }
    case 'petShades': {
      const dark = paint(gear.color);
      const lens = new THREE.BoxGeometry(0.03, 0.05 * k, 0.07 * k);
      for (const side of [1, -1])
        at(
          a.eyes.clone().add(new THREE.Vector3(0.015, 0, side * 0.07 * k)),
          mesh(lens, dark)
        );
      at(
        a.eyes.clone().add(new THREE.Vector3(0.015, 0.01, 0)),
        mesh(new THREE.BoxGeometry(0.02, 0.015, 0.06 * k), dark)
      );
      break;
    }
    case 'petCrown': {
      const gold = paint(gear.color, { emissive: '#7a5600' });
      const crown = new THREE.Group();
      crown.add(
        mesh(
          new THREE.CylinderGeometry(
            0.07 * k,
            0.075 * k,
            0.05 * k,
            12,
            1,
            true
          ),
          gold
        )
      );
      const spike = new THREE.ConeGeometry(0.018 * k, 0.05 * k, 5);
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI * 2;
        crown.add(
          mesh(
            spike,
            gold,
            Math.cos(ang) * 0.065 * k,
            0.045 * k,
            Math.sin(ang) * 0.065 * k
          )
        );
      }
      at(a.headTop.clone().add(new THREE.Vector3(0, 0.01, 0)), crown);
      break;
    }
  }
};

/** Pets run beside the chibi. They are decoration only and never change race time. */
export const buildPet = (
  id: PetId,
  paint: Painter,
  gearId?: string
): Animated => {
  const group = new THREE.Group();
  const c = PET_COLORS[id];
  const main = paint(c.main);
  const belly = paint(c.belly);
  const ink = paint('#2a2340');
  const eyeGeo = new THREE.SphereGeometry(0.03, 8, 6);
  const legs: THREE.Object3D[] = [];
  const bunnyEars: THREE.Object3D[] = [];
  const bodyPivot = new THREE.Group();
  group.add(bodyPivot);
  group.add(blobShadow(0.7));

  if (id === 'penguin') {
    const body = mesh(new THREE.SphereGeometry(0.22, 16, 12), main, 0, 0.3, 0);
    body.scale.set(0.9, 1.25, 0.9);
    bodyPivot.add(body);
    const front = mesh(
      new THREE.SphereGeometry(0.19, 16, 12),
      belly,
      0.07,
      0.28,
      0
    );
    front.scale.set(0.7, 1.15, 0.85);
    bodyPivot.add(front);
    bodyPivot.add(
      mesh(
        new THREE.ConeGeometry(0.05, 0.12, 8),
        paint(c.accent),
        0.23,
        0.46,
        0
      ).rotateZ(-Math.PI / 2)
    );
    bodyPivot.add(
      mesh(eyeGeo, ink, 0.17, 0.52, 0.07),
      mesh(eyeGeo, ink, 0.17, 0.52, -0.07)
    );
    addPetGear(
      bodyPivot,
      gearId,
      {
        headTop: new THREE.Vector3(0.06, 0.575, 0),
        neck: new THREE.Vector3(0.1, 0.42, 0),
        eyes: new THREE.Vector3(0.19, 0.52, 0),
        headR: 0.17,
      },
      paint
    );
    const footGeo = new THREE.BoxGeometry(0.12, 0.03, 0.08);
    for (const side of [1, -1]) {
      const foot = mesh(footGeo, paint(c.accent), 0.04, 0.02, side * 0.09);
      legs.push(foot);
      group.add(foot);
    }
  } else {
    const isCat = id === 'cat';
    const length =
      id === 'corgi'
        ? 0.3
        : id === 'panda'
          ? 0.28
          : id === 'bunny'
            ? 0.16
            : 0.22;
    const legLen =
      id === 'corgi' || id === 'bunny'
        ? 0.06
        : id === 'shiba'
          ? 0.14
          : id === 'panda'
            ? 0.08
            : 0.12;
    const accent = paint(c.accent);
    const body = mesh(
      new THREE.CapsuleGeometry(0.13, length, 4, 12),
      main,
      0,
      legLen + 0.16,
      0
    ).rotateZ(Math.PI / 2);
    bodyPivot.add(body);
    const under = mesh(
      new THREE.CapsuleGeometry(0.1, length * 0.8, 4, 10),
      belly,
      0,
      legLen + 0.1,
      0
    ).rotateZ(Math.PI / 2);
    bodyPivot.add(under);
    const head = new THREE.Group();
    head.position.set(length / 2 + 0.17, legLen + 0.3, 0);
    bodyPivot.add(head);
    head.add(mesh(new THREE.SphereGeometry(0.15, 16, 12), main));
    head.add(mesh(new THREE.SphereGeometry(0.08, 10, 8), belly, 0.1, -0.04, 0));
    head.add(mesh(new THREE.SphereGeometry(0.03, 8, 6), ink, 0.18, -0.02, 0));
    if (id === 'panda') {
      // Black eye patches, then the eyes on top.
      for (const side of [1, -1]) {
        const patch = mesh(
          new THREE.SphereGeometry(0.045, 10, 8),
          accent,
          0.11,
          0.04,
          side * 0.07
        );
        patch.scale.set(0.6, 1.2, 1);
        head.add(patch);
      }
      const shine = paint('#ffffff');
      head.add(
        mesh(new THREE.SphereGeometry(0.016, 6, 5), shine, 0.145, 0.05, 0.07),
        mesh(new THREE.SphereGeometry(0.016, 6, 5), shine, 0.145, 0.05, -0.07)
      );
    } else {
      head.add(
        mesh(eyeGeo, ink, 0.12, 0.05, 0.07),
        mesh(eyeGeo, ink, 0.12, 0.05, -0.07)
      );
    }
    if (id === 'bunny') {
      // Long ears that flop with every hop.
      const earGeo = new THREE.CapsuleGeometry(0.035, 0.2, 4, 8);
      const innerGeo = new THREE.CapsuleGeometry(0.018, 0.15, 4, 6);
      for (const side of [1, -1]) {
        const ear = new THREE.Group();
        ear.position.set(-0.03, 0.12, side * 0.05);
        ear.rotation.x = side * -0.18;
        ear.add(mesh(earGeo, main, 0, 0.13, 0));
        ear.add(mesh(innerGeo, accent, 0.02, 0.13, 0));
        head.add(ear);
        bunnyEars.push(ear);
      }
    } else if (id === 'panda') {
      const earGeo = new THREE.SphereGeometry(0.05, 10, 8);
      head.add(
        mesh(earGeo, accent, -0.03, 0.13, 0.1),
        mesh(earGeo, accent, -0.03, 0.13, -0.1)
      );
    } else {
      const big = id === 'fox';
      const earGeo = new THREE.ConeGeometry(
        isCat ? 0.05 : big ? 0.07 : 0.065,
        isCat ? 0.1 : big ? 0.18 : 0.15,
        4
      );
      head.add(
        mesh(earGeo, main, -0.02, 0.15, 0.08),
        mesh(earGeo, main, -0.02, 0.15, -0.08)
      );
    }
    addPetGear(
      bodyPivot,
      gearId,
      {
        headTop: head.position.clone().add(new THREE.Vector3(-0.01, 0.14, 0)),
        neck: head.position.clone().add(new THREE.Vector3(-0.08, -0.1, 0)),
        eyes: head.position.clone().add(new THREE.Vector3(0.13, 0.05, 0)),
        headR: 0.15,
      },
      paint
    );
    const legMat = id === 'panda' ? accent : main;
    const legGeo = new THREE.CylinderGeometry(0.035, 0.035, legLen + 0.06, 6);
    for (const [x, side] of [
      [length / 2, 1],
      [length / 2, -1],
      [-length / 2, 1],
      [-length / 2, -1],
    ] as const) {
      const leg = mesh(legGeo, legMat, x, (legLen + 0.06) / 2, side * 0.07);
      legs.push(leg);
      group.add(leg);
    }
    if (id === 'shiba') {
      bodyPivot.add(
        mesh(
          new THREE.TorusGeometry(0.07, 0.035, 6, 12),
          belly,
          -length / 2 - 0.06,
          legLen + 0.32,
          0
        )
      );
    } else if (id === 'fox') {
      const tail = mesh(
        new THREE.CapsuleGeometry(0.07, 0.18, 4, 10),
        main,
        -length / 2 - 0.15,
        legLen + 0.26,
        0
      );
      tail.rotation.z = Math.PI * 0.32;
      bodyPivot.add(tail);
      bodyPivot.add(
        mesh(
          new THREE.SphereGeometry(0.06, 10, 8),
          belly,
          -length / 2 - 0.25,
          legLen + 0.33,
          0
        )
      );
    } else if (id === 'bunny' || id === 'panda') {
      bodyPivot.add(
        mesh(
          new THREE.SphereGeometry(id === 'bunny' ? 0.06 : 0.045, 8, 6),
          id === 'bunny' ? belly : accent,
          -length / 2 - 0.12,
          legLen + 0.22,
          0
        )
      );
    } else if (isCat) {
      const tail = mesh(
        new THREE.TorusGeometry(0.16, 0.025, 6, 12, Math.PI * 0.9),
        main,
        -length / 2 - 0.12,
        legLen + 0.28,
        0
      );
      tail.rotation.z = Math.PI * 0.6;
      bodyPivot.add(tail);
    } else {
      bodyPivot.add(
        mesh(
          new THREE.SphereGeometry(0.05, 8, 6),
          main,
          -length / 2 - 0.12,
          legLen + 0.22,
          0
        )
      );
    }
  }

  return {
    group,
    update: (t, speed) => {
      const cadence = 10 + speed * 8;
      if (id === 'penguin') {
        bodyPivot.rotation.x = Math.sin(t * cadence * 0.6) * 0.18;
        legs.forEach(
          (l, i) =>
            (l.position.x =
              0.04 + Math.sin(t * cadence * 0.6 + i * Math.PI) * 0.05)
        );
        return;
      }
      if (id === 'bunny') {
        // Hops: up and down with the ears flopping behind.
        const hop = Math.abs(Math.sin(t * cadence * 0.5));
        bodyPivot.position.y = hop * (0.1 + speed * 0.06);
        legs.forEach((l) => (l.rotation.z = (hop - 0.5) * 0.8));
        bunnyEars.forEach((e) => (e.rotation.z = -0.2 - hop * 0.35));
        return;
      }
      // The cat sprints, pauses, sprints: a little personality.
      const pause = id === 'cat' ? Math.max(0, Math.sin(t * 0.9)) : 1;
      const stride =
        Math.sin(t * cadence) * 0.6 * Math.min(1, speed + 0.3) * pause;
      legs.forEach((l, i) => (l.rotation.z = i % 2 === 0 ? stride : -stride));
      bodyPivot.position.y =
        Math.abs(Math.sin(t * cadence)) *
        (id === 'corgi' ? 0.06 : id === 'panda' ? 0.02 : 0.035) *
        pause;
    },
  };
};

export const disposeTree = (root: THREE.Object3D) => {
  const mats = new Set<THREE.Material>();
  root.traverse((o) => {
    if (
      o instanceof THREE.Mesh ||
      o instanceof THREE.InstancedMesh ||
      o instanceof THREE.Points
    ) {
      o.geometry.dispose();
      const m = o.material;
      if (Array.isArray(m)) m.forEach((x) => mats.add(x));
      else mats.add(m);
    }
    if (o instanceof THREE.Sprite) mats.add(o.material);
  });
  mats.forEach((m) => {
    if ('map' in m && m.map instanceof THREE.Texture) m.map.dispose();
    m.dispose();
  });
};
