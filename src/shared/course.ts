import { KM_PER_STAGE, type Stage, type WeatherId } from './content';
import { hashString, mulberry32 } from './rng';

/** -1 left, 0 middle, 1 right. */
export type Lane = -1 | 0 | 1;

export const LANES: Lane[] = [-1, 0, 1];

export type ItemKind = 'cone' | 'puddle' | 'cups' | 'fan';

export type CourseItem = {
  kind: ItemKind;
  /** Distance from the start, in km. */
  km: number;
  lane: Lane;
};

/** Seconds each item costs (positive) or saves (negative) when the runner meets it. */
export const ITEM_SECONDS: Record<ItemKind, number> = {
  cone: 4,
  puddle: 3,
  cups: 2,
  fan: -2,
};

export const ITEM_LABEL: Record<ItemKind, string> = {
  cone: 'Cone',
  puddle: 'Puddle',
  cups: 'Dropped cups',
  fan: 'High five',
};

const LANE_PICK: Lane[] = [-1, 0, 1];

const round3 = (n: number): number => Math.round(n * 1000) / 1000;

/**
 * Obstacles and high-five fans along the avenue. Seeded by the date, so everyone running the same day meets the
 * same course. Never on a km gantry, and never blocking all three lanes.
 */
export const courseItems = (
  dateKey: string,
  stage: Stage,
  weather: WeatherId
): CourseItem[] => {
  const rand = mulberry32(hashString(`course:${dateKey}:${stage.name}`));
  const items: CourseItem[] = [];
  const pickLane = (): Lane => LANE_PICK[Math.floor(rand() * 3)] ?? 0;
  let km = 0.35;
  while (km < KM_PER_STAGE - 0.2) {
    const nearGantry = Math.abs(km - Math.round(km)) < 0.05;
    const nearWater = stage.waterAfterKm.some((w) => km > w && km - w < 0.15);
    if (!nearGantry) {
      const roll = rand();
      if (nearWater) {
        items.push({ kind: 'cups', km: round3(km), lane: pickLane() });
      } else if (roll < 0.22) {
        items.push({
          kind: 'fan',
          km: round3(km),
          lane: rand() < 0.5 ? -1 : 1,
        });
      } else if (weather === 'rain' && roll < 0.55) {
        items.push({ kind: 'puddle', km: round3(km), lane: pickLane() });
      } else {
        const lane = pickLane();
        items.push({ kind: 'cone', km: round3(km), lane });
        // sometimes a second cone closes a neighbouring lane, leaving one gap
        if (rand() < 0.3) {
          const other: Lane = lane === 0 ? (rand() < 0.5 ? -1 : 1) : 0;
          items.push({ kind: 'cone', km: round3(km), lane: other });
        }
      }
    }
    km += 0.17 + rand() * 0.14;
  }
  return items;
};
