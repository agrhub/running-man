import { describe, expect, it } from 'vitest';
import { CITIES, dayInfo, addDays } from './content';
import {
  checkpoints,
  defaultPlan,
  distanceAt,
  formatTime,
  isValidPlan,
  simulate,
  type Plan,
} from './sim';
import {
  conditionMet,
  runReward,
  ITEMS,
  PETS,
  itemById,
  petById,
} from './economy';

const tokyo = CITIES[0]!;
const flat = tokyo.stages[0]!;
const climb = CITIES[1]!.stages[2]!;

describe('simulate', () => {
  it('is deterministic', () => {
    const plan = defaultPlan(flat);
    expect(simulate(flat, 'hot', plan)).toEqual(simulate(flat, 'hot', plan));
  });

  it('adds the six splits up to the total', () => {
    const r = simulate(climb, 'rain', defaultPlan(climb));
    const sum = r.splits.reduce((s, k) => s + k.seconds, 0);
    expect(r.splits).toHaveLength(6);
    expect(Math.abs(sum - r.totalSeconds)).toBeLessThan(0.5);
  });

  it('punishes an all-out plan in the heat', () => {
    const allPush: Plan = {
      paces: Array(6).fill('push'),
      drinks: flat.waterAfterKm,
    };
    const balanced: Plan = {
      paces: ['steady', 'steady', 'steady', 'push', 'push', 'steady'],
      drinks: flat.waterAfterKm,
    };
    const push = simulate(flat, 'hot', allPush);
    expect(push.walkedKm).toBeGreaterThan(0);
    expect(simulate(flat, 'hot', balanced).totalSeconds).toBeLessThan(
      push.totalSeconds
    );
  });

  it('makes drinking worth it when stamina is short', () => {
    const paces: Plan['paces'] = [
      'push',
      'push',
      'push',
      'steady',
      'push',
      'push',
    ];
    const dry = simulate(flat, 'cool', { paces, drinks: [] });
    const wet = simulate(flat, 'cool', { paces, drinks: flat.waterAfterKm });
    expect(wet.totalSeconds).toBeLessThan(dry.totalSeconds);
  });

  it('penalises pushing downhill in the rain', () => {
    const plan: Plan = {
      paces: ['steady', 'steady', 'steady', 'steady', 'push', 'push'],
      drinks: [],
    };
    const dry = simulate(climb, 'cool', plan).splits[4]!.seconds;
    const wet = simulate(climb, 'rain', plan).splits[4]!.seconds;
    expect(wet - dry).toBeGreaterThan(25);
  });
});

describe('isValidPlan', () => {
  it('accepts the default plan', () => {
    expect(isValidPlan(flat, defaultPlan(flat))).toBe(true);
  });

  it.each([
    null,
    {},
    { paces: ['push'], drinks: [] },
    { paces: Array(6).fill('sprint'), drinks: [] },
    { paces: Array(6).fill('push'), drinks: [1] },
    { paces: Array(6).fill('push'), drinks: [2, 2] },
  ])('rejects %j', (plan) => {
    expect(isValidPlan(flat, plan)).toBe(false);
  });
});

describe('timeline helpers', () => {
  it('interpolates distance from checkpoints', () => {
    const marks = checkpoints([{ seconds: 300 }, { seconds: 300 }]);
    expect(marks).toEqual([0, 300, 600]);
    expect(distanceAt(marks, 150)).toBeCloseTo(0.5);
    expect(distanceAt(marks, 450)).toBeCloseTo(1.5);
    expect(distanceAt(marks, 999)).toBe(2);
  });

  it('formats times as m:ss', () => {
    expect(formatTime(1805.4)).toBe('30:05');
  });
});

describe('daily schedule', () => {
  it('walks through 7 stages per city, then moves on', () => {
    const start = dayInfo('2026-11-09');
    expect(start.city.id).toBe('tokyo');
    expect(start.stageIndex).toBe(0);
    expect(dayInfo(addDays('2026-11-09', 6)).stageIndex).toBe(6);
    const next = dayInfo(addDays('2026-11-09', 7));
    expect(next.city.id).toBe('paris');
    expect(next.season).toBe(1);
    expect(dayInfo(addDays('2026-11-09', 21)).city.id).toBe('tokyo');
  });

  it('gives everyone the same weather on the same day', () => {
    expect(dayInfo('2026-11-12').weather.id).toBe(
      dayInfo('2026-11-12').weather.id
    );
  });
});

describe('economy', () => {
  it('rewards finishing, rank, streak and crew', () => {
    expect(runReward(0.05, 3, false)).toEqual({
      finish: 50,
      rank: 50,
      streak: 30,
      crew: 0,
      total: 130,
    });
    expect(runReward(0.9, 20, true).total).toBe(50 + 0 + 70 + 200);
  });

  it('has unique ids and resolvable lookups', () => {
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length);
    expect(itemById('kumo')?.slot).toBe('shoes');
    expect(petById('shiba')?.name).toBe('Shiba');
    expect(PETS).toHaveLength(4);
  });

  it('checks unlock conditions against progress', () => {
    const p = {
      badges: 0,
      bestStreak: 3,
      finishedCities: [],
      finisher: false,
      weathersRun: [],
      top10: false,
    };
    expect(conditionMet({ kind: 'streak', days: 3 }, p)).toBe(true);
    expect(conditionMet({ kind: 'streak', days: 7 }, p)).toBe(false);
    expect(conditionMet({ kind: 'cityFinish', city: 'tokyo' }, p)).toBe(false);
  });
});
