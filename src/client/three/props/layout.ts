import type { CityId, Terrain } from '../../../shared/content';
import { hashString, mulberry32 } from '../../../shared/rng';
import { PROPS, STREET, WILD, WILD_ACCENT, type PropId } from './catalog';

/** Where one prop stands: x across the road, z along it, turned `turn` radians. */
export type Placement = {
  id: PropId;
  x: number;
  z: number;
  turn: number;
  scale: number;
};

export type LayoutInput = {
  cityId: CityId;
  stageName: string;
  terrain: Terrain;
  /** Half the road, and where the sidewalk meets the buildings (or the open ground). */
  roadHalf: number;
  frontX: number;
  zStart: number;
  zEnd: number;
  /** Street trees stand at these z, on both sides, at `treeX`. */
  treeZs: number[];
  inCross: (z0: number, z1: number) => boolean;
  inPlaza: (side: number, z0: number, z1: number) => boolean;
  /** Thick crowds (start, finish, landmark): left to the spectators. */
  crowded: (z: number) => boolean;
  /** Water stations, on the right sidewalk. */
  waterZs: number[];
  /** Nothing before this z (the swim of a triathlon). */
  dryFrom?: number;
};

/** Trees and towers stand further back, behind the low plants. */
const TALL = new Set<string>([
  'broadleaf-oak-997c22',
  'maple-tree-65fa12',
  'palm-tree-a307da',
  'tall-pine-tree-ab4108',
  'young-pine-0d7695',
  'banana-plant-978d7f',
  'bamboo-grove-clump-7c747d',
  'lifeguard-tower-183c37',
  'torii-gate-402f30',
]);

const FACING = new Set<string>(
  PROPS.filter((p) => 'facing' in p && p.facing).map((p) => p.id)
);

/** The same stage always gets the same props, for everyone. */
export const layoutProps = (input: LayoutInput): Placement[] => {
  const rand = mulberry32(
    hashString(`props:${input.cityId}:${input.stageName}`)
  );
  const pick = <T>(arr: readonly T[]): T =>
    arr[Math.floor(rand() * arr.length)] ?? arr[0]!;
  const out: Placement[] = [];
  const dry = (z: number) => input.dryFrom === undefined || z < input.dryFrom;
  // Street furniture looks at the road; plants and rocks turn any way.
  const face = (id: PropId, side: number, quarter = 0) =>
    FACING.has(id)
      ? -side * (Math.PI / 2) + quarter * (Math.PI / 2)
      : rand() * Math.PI * 2;
  const clear = (side: number, z0: number, z1: number) =>
    !input.inCross(z0 - 0.5, z1 + 0.5) &&
    !input.inPlaza(side, z0, z1) &&
    !input.crowded(z0) &&
    !input.crowded(z1) &&
    dry(z1) &&
    !(side > 0 && input.waterZs.some((w) => z1 > w - 5 && z0 < w + 5));

  // Water stations get crates of bottles behind the tables.
  for (const w of input.waterZs) {
    if (!dry(w)) continue;
    for (const dz of [-1.1, 0, 1.1])
      out.push({
        id: 'water-bottle-crate-78c8db',
        x: input.roadHalf + 2.1,
        z: w + dz,
        turn: -Math.PI / 2,
        scale: 1,
      });
  }

  if (input.terrain === 'city') {
    const street = STREET[input.cityId];
    const baseX = input.frontX - 0.75;
    // Between two street trees there are about seven units of free sidewalk.
    const gaps = input.treeZs.slice(0, -1).map((z, i) => ({
      z0: input.treeZs[i + 1]! + 1.3,
      z1: z - 1.3,
    }));
    for (const side of [-1, 1]) {
      for (const gap of gaps) {
        const mid = (gap.z0 + gap.z1) / 2;
        const room = gap.z1 - gap.z0;
        const roll = rand();
        const vignette = pick(street.vignettes);
        if (roll < 0.4 && vignette.length <= room) {
          const z0 = mid - vignette.length / 2;
          if (!clear(side, z0, z0 + vignette.length)) continue;
          for (const part of vignette.parts)
            out.push({
              id: part.id,
              x: side * (baseX + part.x * 0.6),
              z: mid + part.z,
              turn: face(part.id, side, part.turn ?? 0),
              scale: 1,
            });
        } else if (roll < 0.75) {
          const id = pick(street.singles);
          const z = mid + (rand() - 0.5) * (room - 2);
          if (!clear(side, z - 1, z + 1)) continue;
          out.push({
            id,
            x: side * baseX,
            z,
            turn: face(id, side),
            scale: FACING.has(id) ? 1 : 0.9 + rand() * 0.2,
          });
        }
      }
    }
    return out;
  }

  // Outside the streets: props scattered on the ground beside the path.
  const wild = WILD[input.terrain];
  if (!wild) return out;
  const accent = WILD_ACCENT[input.cityId] ?? [];
  for (let z = input.zStart - 4; z > input.zEnd + 8; z -= 6.5) {
    for (const side of [-1, 1]) {
      if (rand() > 0.5) continue;
      const id = accent.length && rand() < 0.15 ? pick(accent) : pick(wild);
      const tall = TALL.has(id);
      const x =
        side * (input.frontX + (tall ? 3 + rand() * 6 : 0.9 + rand() * 3));
      const zz = z + (rand() - 0.5) * 3;
      if (!clear(side, zz - 1.5, zz + 1.5)) continue;
      out.push({
        id,
        x,
        z: zz,
        turn: face(id, side),
        scale: FACING.has(id) ? 1 : 0.85 + rand() * 0.3,
      });
    }
  }
  return out;
};
