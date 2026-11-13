import { describe, expect, it } from 'vitest';
import { addDays, dayInfo } from './content';
import {
  BOOSTERS,
  ITEM_SECONDS,
  PICKUPS,
  ROAD_LIFE,
  courseItems,
  isBooster,
  isPickup,
  isRoadLife,
  isVehicle,
} from './course';

const day = dayInfo('2026-11-12');
const items = courseItems(day.dateKey, day.stage, day.weather.id);

describe('courseItems', () => {
  it('is the same for everyone on the same day', () => {
    expect(courseItems(day.dateKey, day.stage, day.weather.id)).toEqual(items);
    expect(courseItems('2026-11-13', day.stage, day.weather.id)).not.toEqual(
      items
    );
  });

  it('spreads 15 to 30 items over the stage and never blocks all lanes', () => {
    expect(items.length).toBeGreaterThanOrEqual(15);
    expect(items.length).toBeLessThanOrEqual(30);
    const byKm = new Map<number, Set<number>>();
    for (const it of items) {
      expect(it.km).toBeGreaterThan(0.3);
      expect(it.km).toBeLessThan(6);
      if (it.kind !== 'fan' && !isPickup(it.kind))
        byKm.set(it.km, (byKm.get(it.km) ?? new Set()).add(it.lane));
    }
    for (const lanes of byKm.values()) expect(lanes.size).toBeLessThan(3);
  });

  it('puts fans only on the outer lanes and puddles only in the rain', () => {
    expect(
      items.filter((i) => i.kind === 'fan').every((i) => i.lane !== 0)
    ).toBe(true);
    const rainDay = [
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
    ]
      .map((d) => ({ d, info: dayInfo(d) }))
      .find(
        ({ info }) => info.weather.id !== 'rain' && info.weather.id !== 'storm'
      );
    if (rainDay) {
      const dry = courseItems(
        rainDay.d,
        rainDay.info.stage,
        rainDay.info.weather.id
      );
      expect(dry.some((i) => i.kind === 'puddle')).toBe(false);
    }
    const wet = courseItems('x', day.stage, 'rain');
    expect(wet.some((i) => i.kind === 'puddle')).toBe(true);
  });
});

describe('pickups', () => {
  it('puts a few snacks on every stage, and they all speed you up', () => {
    const snacks = items.filter((i) => isPickup(i.kind));
    expect(snacks.length).toBeGreaterThanOrEqual(3);
    for (const k of PICKUPS) expect(ITEM_SECONDS[k]).toBeLessThan(0);
  });
});

describe('road life', () => {
  it('puts people, traffic and animals on the road, fitting the place', () => {
    const hanoi = dayInfo('2026-11-24');
    const city = courseItems(hanoi.dateKey, hanoi.stage, 'cool', {
      city: 'hanoi',
      time: 'afternoon',
    });
    const life = city.filter((i) => isRoadLife(i.kind));
    expect(life.length).toBeGreaterThanOrEqual(3);
    for (const k of ROAD_LIFE) expect(ITEM_SECONDS[k]).toBeGreaterThan(0);
    const farm = dayInfo('2026-11-18');
    const hills = courseItems(farm.dateKey, farm.stage, 'cool', {
      city: 'paris',
    })
      .filter((i) => isRoadLife(i.kind))
      .map((i) => i.kind);
    expect(hills.some((k) => isVehicle(k))).toBe(false);
  });
});

describe('boosters', () => {
  it('turn up on some stages and are the biggest bursts of speed', () => {
    let found = 0;
    for (let i = 0; i < 20; i++) {
      const d = dayInfo(addDays('2026-11-09', i));
      found += courseItems(d.dateKey, d.stage, d.weather.id).filter((it) =>
        isBooster(it.kind)
      ).length;
    }
    expect(found).toBeGreaterThan(3);
    for (const k of BOOSTERS)
      for (const p of PICKUPS)
        expect(ITEM_SECONDS[k]).toBeLessThan(ITEM_SECONDS[p]);
  });
});
