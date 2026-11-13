import {
  KM_PER_STAGE,
  type CityId,
  type Stage,
  type TimeOfDay,
  type WeatherId,
} from './content';
import { hashString, mulberry32 } from './rng';

/** -1 left, 0 middle, 1 right. */
export type Lane = -1 | 0 | 1;

export const LANES: Lane[] = [-1, 0, 1];

export type ItemKind =
  | 'cone'
  | 'puddle'
  | 'cups'
  | 'fan'
  | 'bottle'
  | 'soda'
  | 'cake'
  | 'candy'
  // Life on the road: people, traffic and animals in your lane.
  | 'walker'
  | 'cyclist'
  | 'scooter'
  | 'cyclo'
  | 'taxi'
  | 'ambulance'
  | 'firetruck'
  | 'dog'
  | 'cat'
  | 'chicken'
  | 'pig';

/** People, vehicles and animals: they cost more than a cone, so steer round them. */
export const ROAD_LIFE: ItemKind[] = [
  'walker',
  'cyclist',
  'scooter',
  'cyclo',
  'taxi',
  'ambulance',
  'firetruck',
  'dog',
  'cat',
  'chicken',
  'pig',
];

export const isRoadLife = (kind: ItemKind): boolean => ROAD_LIFE.includes(kind);

export const isVehicle = (kind: ItemKind): boolean =>
  kind === 'scooter' ||
  kind === 'cyclo' ||
  kind === 'taxi' ||
  kind === 'ambulance' ||
  kind === 'firetruck';

/** Snacks on the road: run through one to pick it up and get a burst of speed. */
export const PICKUPS: ItemKind[] = ['bottle', 'soda', 'cake', 'candy'];

export const isPickup = (kind: ItemKind): boolean => PICKUPS.includes(kind);

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
  bottle: -2,
  soda: -3,
  cake: -2,
  candy: -1,
  walker: 3,
  cyclist: 4,
  scooter: 4,
  cyclo: 4,
  taxi: 5,
  ambulance: 6,
  firetruck: 6,
  dog: 3,
  cat: 2,
  chicken: 2,
  pig: 4,
};

export const ITEM_LABEL: Record<ItemKind, string> = {
  cone: 'Cone',
  puddle: 'Puddle',
  cups: 'Dropped cups',
  fan: 'High five',
  bottle: 'Water bottle',
  soda: 'Soda',
  cake: 'Cake',
  candy: 'Candy',
  walker: 'Someone crossing',
  cyclist: 'Cyclist',
  scooter: 'Motorbike',
  cyclo: 'Cyclo',
  taxi: 'Taxi',
  ambulance: 'Ambulance',
  firetruck: 'Fire engine',
  dog: 'Dog',
  cat: 'Cat',
  chicken: 'Chicken',
  pig: 'Pig',
};

/** Who is out on the road depends on the place and the hour. */
const roadLifeBag = (
  city: CityId | undefined,
  terrain: Stage['terrain'],
  time: TimeOfDay
): ItemKind[] => {
  const bag: ItemKind[] = [];
  if (terrain === 'city') {
    bag.push('walker', 'walker', 'cyclist', 'taxi', 'scooter', 'dog');
    if (city === 'hanoi')
      bag.push('scooter', 'scooter', 'cyclo', 'cyclo', 'chicken');
    if (city === 'paris') bag.push('cyclist', 'cat');
    if (city === 'tokyo') bag.push('cyclist', 'taxi');
    if (city === 'dubai') bag.push('taxi', 'taxi');
    if (time === 'afternoon') bag.push('taxi', 'scooter');
    if (time === 'evening') bag.push('walker', 'walker');
    bag.push('ambulance', 'firetruck');
  } else if (terrain === 'park' || terrain === 'zoo') {
    bag.push('walker', 'dog', 'dog', 'cat', 'cyclist');
    if (terrain === 'zoo') bag.push('chicken', 'pig');
  } else if (terrain === 'hills') {
    bag.push('chicken', 'pig', 'pig', 'dog', 'cyclist');
  } else if (terrain === 'forest') {
    bag.push('walker', 'dog', 'cyclist');
  } else if (terrain === 'beach') {
    bag.push('walker', 'walker', 'dog', 'cyclist');
  } else {
    bag.push('walker', 'dog');
  }
  return bag;
};

/** Which snack shows up, weighted: candy and water are common, soda is rare. */
const PICKUP_BAG: ItemKind[] = [
  'candy',
  'candy',
  'bottle',
  'bottle',
  'cake',
  'soda',
];

const LANE_PICK: Lane[] = [-1, 0, 1];

const round3 = (n: number): number => Math.round(n * 1000) / 1000;

/**
 * Obstacles and high-five fans along the avenue. Seeded by the date, so everyone running the same day meets the
 * same course. Never on a km gantry, and never blocking all three lanes.
 */
export const courseItems = (
  dateKey: string,
  stage: Stage,
  weather: WeatherId,
  where: { city?: CityId; time?: TimeOfDay } = {}
): CourseItem[] => {
  const life = roadLifeBag(where.city, stage.terrain, where.time ?? 'morning');
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
      } else if (roll < 0.2) {
        items.push({
          kind: 'fan',
          km: round3(km),
          lane: rand() < 0.5 ? -1 : 1,
        });
      } else if (roll < 0.42) {
        const kind =
          PICKUP_BAG[Math.floor(rand() * PICKUP_BAG.length)] ?? 'candy';
        items.push({ kind, km: round3(km), lane: pickLane() });
      } else if (
        (weather === 'rain' && roll < 0.55) ||
        (weather === 'storm' && roll < 0.62)
      ) {
        items.push({ kind: 'puddle', km: round3(km), lane: pickLane() });
      } else if (roll < 0.74) {
        // Someone or something in your lane: never on more than one lane at once.
        const kind = life[Math.floor(rand() * life.length)] ?? 'walker';
        items.push({ kind, km: round3(km), lane: pickLane() });
      } else {
        const lane = pickLane();
        items.push({ kind: 'cone', km: round3(km), lane });
        // sometimes a second cone closes a neighbouring lane, leaving one gap;
        // otherwise a snack may tempt you into the lane beside the cone
        if (rand() < 0.3) {
          const other: Lane = lane === 0 ? (rand() < 0.5 ? -1 : 1) : 0;
          items.push({ kind: 'cone', km: round3(km), lane: other });
        } else if (rand() < 0.25) {
          const other: Lane = lane === 0 ? 1 : 0;
          items.push({ kind: 'candy', km: round3(km), lane: other });
        }
      }
    }
    km += 0.17 + rand() * 0.14;
  }
  return items;
};
