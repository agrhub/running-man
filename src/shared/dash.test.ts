import { describe, expect, it } from 'vitest';
import { botMoves } from './dashBot';
import {
  DASH_STEPS,
  dashCourse,
  dashReward,
  isValidDashMoves,
  replayDash,
  startDash,
  stepDash,
  type DashLane,
} from './dash';

describe('Snack Dash', () => {
  it('gives everyone the same course, a new one each round', () => {
    expect(dashCourse('2026-11-12', 0)).toEqual(dashCourse('2026-11-12', 0));
    expect(dashCourse('2026-11-12', 1)).not.toEqual(
      dashCourse('2026-11-12', 0)
    );
    const course = dashCourse('2026-11-12', 0);
    expect(course.length).toBeGreaterThan(25);
    expect(course.every((i) => i.hitStep < DASH_STEPS)).toBe(true);
  });

  it('scores the same live and in the server replay', () => {
    const course = dashCourse('2026-11-12', 0);
    const moves = botMoves('2026-11-12', 0);
    const live = startDash();
    let i = 0;
    while (!live.done) {
      let lane: DashLane | undefined;
      while (i < moves.length && moves[i]!.step <= live.step)
        lane = moves[i++]!.lane;
      stepDash(live, course, lane);
    }
    const replay = replayDash(course, moves);
    expect(replay.score).toBe(live.score);
    expect(replay.moves).toEqual(moves);
    expect(replay.hits).toBe(0);
    expect(replay.best).toBeGreaterThanOrEqual(10);
    // Standing still catches less than steering.
    expect(replayDash(course, []).score).toBeLessThan(replay.score);
  });

  it('pays coins for the first three rounds only, capped', () => {
    expect(dashReward(120, 0)).toBe(20);
    expect(dashReward(9999, 2)).toBe(50);
    expect(dashReward(9999, 3)).toBe(0);
  });

  it('rejects bad move lists', () => {
    expect(isValidDashMoves([{ step: 5, lane: 1 }])).toBe(true);
    expect(isValidDashMoves([{ step: 5, lane: 2 }])).toBe(false);
    expect(
      isValidDashMoves([
        { step: 9, lane: 1 },
        { step: 3, lane: 0 },
      ])
    ).toBe(false);
    expect(isValidDashMoves([{ step: DASH_STEPS, lane: 0 }])).toBe(false);
    expect(isValidDashMoves('nope')).toBe(false);
  });
});
