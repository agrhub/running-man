import { describe, expect, it } from 'vitest';
import {
  ACHIEVEMENTS,
  achievementStates,
  newlyEarned,
  type RunnerSummary,
} from './achievements';

const empty: RunnerSummary = {
  runs: 0,
  km: 0,
  bestStreak: 0,
  cities: [],
  fives: 0,
  snacks: 0,
  crashes: 0,
  chats: 0,
  bestRank: null,
  finisher: false,
  inClub: false,
  friends: 0,
  holidayRun: false,
  dashBest: 0,
  calledIt: 0,
};

describe('achievements', () => {
  it('have unique ids and reachable targets', () => {
    const ids = new Set(ACHIEVEMENTS.map((x) => x.id));
    expect(ids.size).toBe(ACHIEVEMENTS.length);
    for (const x of ACHIEVEMENTS) expect(x.target).toBeGreaterThan(0);
  });

  it('are earned once, and show progress until then', () => {
    expect(newlyEarned(empty, [])).toEqual([]);
    const s = { ...empty, runs: 1, km: 6, bestRank: 2, fives: 30 };
    const fresh = newlyEarned(s, []);
    expect(fresh).toEqual(['first-steps', 'podium', 'high-five-hero']);
    expect(newlyEarned(s, fresh)).toEqual([]);
    const states = achievementStates(s, fresh);
    expect(states.find((x) => x.id === 'marathoner')).toEqual({
      id: 'marathoner',
      value: 6,
      target: 42,
      done: false,
    });
    expect(states.find((x) => x.id === 'high-five-hero')?.value).toBe(25);
  });
});
