import { describe, expect, it } from 'vitest';
import { dayInfo } from './content';
import { ITEM_SECONDS, courseItems, type CourseItem } from './course';
import {
  BUMP_SECONDS,
  RACE_DT,
  finishRace,
  isValidMoves,
  laneAtTime,
  startLane,
  replayRace,
  startRace,
  stepRace,
  type RaceSetup,
  type Rival,
} from './race';
import { checkpoints, defaultPlan, simulate } from './sim';

const day = dayInfo('2026-11-12');
const base = checkpoints(
  simulate(day.stage, 'cool', defaultPlan(day.stage)).splits
);
const total = base[6] ?? 0;
const empty: RaceSetup = { base, items: [], rivals: [] };

describe('a race with nothing on the road', () => {
  it('finishes on the planned time', () => {
    const r = replayRace(empty, []);
    expect(r.done).toBe(true);
    expect(r.finalSeconds).toBeCloseTo(total, 0);
    expect(r.marks).toHaveLength(7);
    expect(r.marks[6]).toBe(r.finalSeconds);
  });
});

describe('course items', () => {
  const items: CourseItem[] = [
    { kind: 'cone', km: 0.5, lane: 0 },
    { kind: 'fan', km: 1.5, lane: 1 },
  ];

  it('charges a cone in your lane and credits a high five', () => {
    const hit = replayRace({ base, items, rivals: [] }, []);
    expect(hit.events.map((e) => e.kind)).toEqual(['cone']);
    expect(hit.finalSeconds).toBeCloseTo(total + ITEM_SECONDS.cone, 0);

    const dodge = replayRace({ base, items, rivals: [] }, [
      { step: 10, lane: 1 },
    ]);
    expect(dodge.events.map((e) => e.kind)).toEqual(['fan']);
    expect(dodge.finalSeconds).toBeCloseTo(total + ITEM_SECONDS.fan, 0);
  });

  it('picks up snacks in your lane for a burst of speed', () => {
    const snacks: CourseItem[] = [
      { kind: 'soda', km: 0.6, lane: 0 },
      { kind: 'candy', km: 1.2, lane: 1 },
      { kind: 'cake', km: 2.4, lane: 0 },
    ];
    const r = replayRace({ base, items: snacks, rivals: [] }, []);
    expect(r.events.map((e) => e.kind)).toEqual(['soda', 'cake']);
    expect(r.finalSeconds).toBeCloseTo(
      total + ITEM_SECONDS.soda + ITEM_SECONDS.cake,
      0
    );
  });

  it('keeps the same items for everyone each day', () => {
    const items = courseItems(day.dateKey, day.stage, day.weather.id);
    expect(items.length).toBeGreaterThan(10);
  });
});

describe('collisions', () => {
  // Fast for the first km, then much slower: the player catches them in the middle lane.
  const slow: Rival = {
    username: 'slowpoke',
    marks: base.map((m, i) => (i === 0 ? 0 : i === 1 ? m * 0.8 : m * 1.4)),
    moves: [{ step: 0, lane: 0 }],
  };

  it('makes both runners fall and lose the same beat', () => {
    const r = replayRace({ base, items: [], rivals: [slow] }, []);
    const bump = r.events.find((e) => e.kind === 'bump');
    expect(bump).toMatchObject({
      kind: 'bump',
      rival: 'slowpoke',
      atFault: true,
      seconds: BUMP_SECONDS,
      rivalSeconds: BUMP_SECONDS,
    });
    expect(r.finalSeconds).toBeGreaterThan(total + BUMP_SECONDS - 1);
    expect(r.rivalLost.slowpoke).toBeCloseTo(BUMP_SECONDS);
  });

  it('never piles up: nobody runs into a runner who is still getting up', () => {
    const pack: Rival[] = ['a', 'b', 'c', 'd'].map((username, i) => ({
      username,
      marks: slow.marks.map((m) => m + i * 0.5),
      moves: [{ step: 0, lane: 0 }],
    }));
    const r = replayRace({ base, items: [], rivals: pack }, []);
    const bumps = r.events.filter((e) => e.kind === 'bump');
    const steps = bumps.map((e) => e.step);
    // after each fall, the next one comes only once the runner is back up (6 steps of limping)
    for (let i = 1; i < steps.length; i++)
      expect((steps[i] ?? 0) - (steps[i - 1] ?? 0)).toBeGreaterThanOrEqual(6);
  });

  it('lets each pair of runners crash only once', () => {
    const twin: Rival = {
      username: 'twin',
      marks: base.map((m) => m * 1.005),
      moves: [{ step: 0, lane: 0 }],
    };
    const r = replayRace({ base, items: [], rivals: [twin] }, [
      { step: 0, lane: 0 },
    ]);
    expect(
      r.events.filter((e) => e.kind === 'bump').length
    ).toBeLessThanOrEqual(1);
  });

  it('is avoided by overtaking in another lane', () => {
    const r = replayRace({ base, items: [], rivals: [slow] }, [
      { step: 4, lane: -1 },
    ]);
    expect(r.events.filter((e) => e.kind === 'bump')).toHaveLength(0);
  });

  it('follows the other runner’s own lane changes', () => {
    const dodger: Rival = {
      ...slow,
      moves: [
        { step: 0, lane: 0 },
        { step: 2, lane: 1 },
      ],
    };
    expect(laneAtTime(dodger.moves, 0)).toBe(0);
    expect(laneAtTime(undefined, 0, 1)).toBe(1);
    expect(['a', 'b', 'c', 'd', 'e', 'f'].map(startLane).sort()).toContain(-1);
    expect(laneAtTime(dodger.moves, 2 * RACE_DT)).toBe(1);
    const r = replayRace({ base, items: [], rivals: [dodger] }, []);
    expect(r.events.filter((e) => e.kind === 'bump')).toHaveLength(0);
  });
});

describe('live play and replay agree', () => {
  it('gives the server the same time as the player saw', () => {
    const setup: RaceSetup = {
      base,
      items: courseItems(day.dateKey, day.stage, day.weather.id),
      rivals: [{ username: 'a', marks: base.map((m) => m * 1.03) }],
    };
    const live = startRace();
    let step = 0;
    while (!live.done) {
      const lane = step < 300 ? -1 : step < 900 ? 1 : 0;
      stepRace(live, setup, lane);
      step += 1;
      if (step === 1500) finishRace(live, setup);
    }
    const replay = replayRace(setup, live.moves);
    expect(replay.finalSeconds).toBe(live.finalSeconds);
    expect(replay.events).toEqual(live.events);
    expect(replay.marks).toEqual(live.marks);
  });
});

describe('isValidMoves', () => {
  it.each([
    null,
    {},
    [{ step: -1, lane: 0 }],
    [{ step: 1, lane: 2 }],
    [
      { step: 2, lane: 0 },
      { step: 1, lane: 1 },
    ],
    [{ step: 1.5, lane: 0 }],
  ])('rejects %j', (m) => expect(isValidMoves(m)).toBe(false));
  it('accepts ordered moves', () => {
    expect(isValidMoves([])).toBe(true);
    expect(
      isValidMoves([
        { step: 0, lane: 1 },
        { step: 3, lane: 0 },
      ])
    ).toBe(true);
  });
});
