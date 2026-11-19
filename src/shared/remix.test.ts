import { describe, expect, it } from 'vitest';
import {
  CITIES,
  EPOCH,
  STAGES_PER_CITY,
  addDays,
  dayInfo,
  hillFactor,
  remixOf,
} from './content';

const LAP = CITIES.length * STAGES_PER_CITY;

describe('stage remixes', () => {
  it('leaves the first lap of the calendar exactly as built', () => {
    for (let i = 0; i < LAP; i++) {
      const day = dayInfo(addDays(EPOCH, i));
      expect(day.remix.lap).toBe(0);
      expect(day.stage).toBe(day.city.stages[day.stageIndex]);
    }
  });

  it('runs the course backwards on the second lap', () => {
    const first = dayInfo(addDays(EPOCH, 3));
    const second = dayInfo(addDays(EPOCH, 3 + LAP));
    expect(second.city.id).toBe(first.city.id);
    expect(second.remix).toEqual({ lap: 1, reverse: true, steeper: false });
    expect(second.stage.grades).toEqual(
      [...first.stage.grades].reverse().map((g) => (g === 0 ? 0 : -g))
    );
    expect(second.stage.landmark.km).toBeCloseTo(6 - first.stage.landmark.km);
    expect(second.stage.waterAfterKm).toEqual(
      first.stage.waterAfterKm.map((w) => 6 - w).sort((a, b) => a - b)
    );
  });

  it('makes the hills steeper from the third lap, up to 1.6 times', () => {
    expect(hillFactor(remixOf(2 * CITIES.length))).toBeCloseTo(1.2);
    expect(remixOf(3 * CITIES.length)).toMatchObject({
      reverse: true,
      steeper: true,
    });
    expect(hillFactor(remixOf(40 * CITIES.length))).toBe(1.6);
  });

  it('keeps every remixed stage valid', () => {
    for (let i = LAP; i < LAP * 4; i++) {
      const { stage } = dayInfo(addDays(EPOCH, i));
      expect(stage.grades).toHaveLength(6);
      for (const w of stage.waterAfterKm) expect(w >= 1 && w <= 5).toBe(true);
      expect(stage.landmark.km).toBeGreaterThan(0);
      expect(stage.landmark.km).toBeLessThan(6);
    }
  });
});
