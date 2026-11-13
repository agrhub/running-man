import { describe, expect, it } from 'vitest';
import {
  FETCH_THROWS,
  JUMP_MS,
  arcadeReward,
  fetchCourse,
  fetchDistance,
  fetchPower,
  hurdleCourse,
  jumpsFrom,
  rhythmCourse,
  scoreArcade,
  scoreFetch,
  scoreHurdles,
  scoreRhythm,
} from './arcade';

const D = '2026-11-28';

describe('Hurdle Hop', () => {
  const course = hurdleCourse(D, 0);
  it('is the same for everyone and speeds up', () => {
    expect(hurdleCourse(D, 0)).toEqual(course);
    expect(hurdleCourse(D, 1)).not.toEqual(course);
    expect(course.length).toBeGreaterThan(12);
    const gaps = course.slice(1).map((t, i) => t - (course[i] ?? 0));
    expect(gaps.at(-1)!).toBeLessThan(gaps[0]!);
  });
  it('scores perfect jumps with a combo and trips on bad ones', () => {
    const perfect = course.map((h) => h - 300);
    const all = scoreHurdles(course, perfect);
    expect(all.misses).toBe(0);
    expect(all.score).toBeGreaterThan(course.length * 10);
    const late = scoreHurdles(
      course,
      course.map((h) => h - 20)
    );
    expect(late.hits).toBe(0);
    expect(scoreHurdles(course, []).score).toBe(0);
  });
  it('ignores taps while already in the air', () => {
    expect(jumpsFrom([100, 200, 100 + JUMP_MS])).toEqual([100, 100 + JUMP_MS]);
  });
});

describe('Rhythm Steps', () => {
  const notes = rhythmCourse(D, 0);
  it('judges perfect, good and stray taps', () => {
    const perfect = scoreRhythm(notes, notes);
    expect(perfect.misses).toBe(0);
    expect(perfect.judged.every((j) => j === 'perfect')).toBe(true);
    const good = scoreRhythm(
      notes,
      notes.map((n) => n + 100)
    );
    expect(good.judged.every((j) => j === 'good')).toBe(true);
    expect(good.score).toBeLessThan(perfect.score);
    const spam = scoreRhythm(notes, [5, 6, 7]);
    expect(spam.score).toBe(0);
    expect(spam.stray).toBe(3);
  });
});

describe('Pet Fetch', () => {
  const course = fetchCourse(D, 0);
  it('sweeps power up and down and scores by distance from the ring', () => {
    expect(fetchPower(0, 1000)).toBe(0);
    expect(fetchPower(500, 1000)).toBe(1);
    expect(fetchPower(750, 1000)).toBeCloseTo(0.5);
    // Find each throw's best stop time by search: the best possible round.
    const best = course.map((th) => {
      let bestMs = 0;
      for (let ms = 0; ms <= 4000; ms++)
        if (
          Math.abs(fetchDistance(ms, th) - th.target) <
          Math.abs(fetchDistance(bestMs, th) - th.target)
        )
          bestMs = ms;
      return bestMs;
    });
    const top = scoreFetch(course, best);
    expect(top.hits).toBe(FETCH_THROWS);
    expect(top.score).toBeGreaterThan(450);
    expect(scoreFetch(course, [0, 0, 0, 0, 0]).score).toBeLessThan(top.score);
  });
});

describe('arcade scoring', () => {
  it('rejects bad input and pays the first rounds only', () => {
    expect(scoreArcade('hurdle', D, 0, [5, 2])).toBeNull();
    expect(scoreArcade('rhythm', D, 0, 'x')).toBeNull();
    expect(scoreArcade('fetch', D, 0, [1, 2])).toBeNull();
    expect(scoreArcade('fetch', D, 0, [1, 2, 3, 4, 9999])).toBeNull();
    expect(scoreArcade('hurdle', D, 0, [])?.score).toBe(0);
    expect(arcadeReward(800, 0)).toBe(40);
    expect(arcadeReward(800, 3)).toBe(0);
  });
});
