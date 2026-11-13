import { describe, expect, it } from 'vitest';
import {
  coachSteered,
  startCoach,
  tickCoach,
  type CoachInput,
  type CoachState,
} from './coach';

const base: CoachInput = {
  t: 0,
  km: 0,
  lane: 0,
  items: [],
  rivals: [],
  grabbedSnack: false,
  crashed: false,
  chatOpened: false,
};

describe('first-run coach', () => {
  it('teaches lanes, then snacks, runners and chat, in order', () => {
    let s: CoachState = startCoach();
    let [next, view] = tickCoach(s, base);
    expect(view.step).toBe('lanes');
    expect(view.point).toBe('steer');

    s = coachSteered(coachSteered(next));
    [next, view] = tickCoach(s, { ...base, t: 3, km: 0.1 });
    // No snack nearby yet: the lesson waits quietly.
    expect(view.step).toBe('snack');
    expect(view.text).toBeNull();

    [next, view] = tickCoach(next, {
      ...base,
      t: 4,
      km: 0.2,
      items: [{ kind: 'cake', km: 0.3, lane: 1 }],
    });
    expect(view.text).toMatch(/right lane/);
    expect(view.point).toBe('steer');

    [next, view] = tickCoach(next, {
      ...base,
      t: 5,
      km: 0.32,
      grabbedSnack: true,
      rivals: [{ km: 0.36, lane: 0 }],
    });
    expect(view.step).toBe('runner');
    expect(view.text).toMatch(/real runner/);

    [next, view] = tickCoach(next, { ...base, t: 9, km: 0.5 });
    expect(view.text).toBeNull();
    [next, view] = tickCoach(next, { ...base, t: 10, km: 0.6, crashed: true });
    expect(view.step).toBe('chat');
    expect(view.point).toBe('chat');
    [next, view] = tickCoach(next, { ...base, t: 11, chatOpened: true });
    expect(view.step).toBe('done');
    expect(tickCoach(next, { ...base, t: 30 })[1].text).toBeNull();
  });

  it('moves on by itself when the player ignores a lesson', () => {
    let [s, view] = tickCoach(startCoach(), { ...base, t: 10 });
    expect(view.step).toBe('snack');
    [s, view] = tickCoach(s, { ...base, t: 25 });
    expect(view.step).toBe('runner');
    [s, view] = tickCoach(s, { ...base, t: 42 });
    expect(view.step).toBe('chat');
    [, view] = tickCoach(s, { ...base, t: 49 });
    expect(view.step).toBe('done');
  });
});
