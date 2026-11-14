import { beforeEach, describe, expect, it } from 'vitest';
import { addDays, dayInfo } from '../../shared/content';
import {
  checkpoints,
  defaultPlan,
  simulate,
  type Plan,
} from '../../shared/sim';
import { courseItems, isRoadLife } from '../../shared/course';
import { replayRace, startLane, type Move } from '../../shared/race';
import type {
  InitResponse,
  ProfileResponse,
  RunResponse,
  ShareResponse,
  VoteResponse,
  QuestsResponse,
  DashResponse,
  FriendsResponse,
  ClubResponse,
  AvatarsResponse,
  MeResponse,
  ArcadeResponse,
  ArcadeBoardResponse,
} from '../../shared/api';
import {
  fetchCourse,
  hurdleCourse,
  rhythmCourse,
  scoreFetch,
} from '../../shared/arcade';
import { createApi } from '../routes/api';
import { createInternal } from '../routes/internal';
import { postTitle } from './game';
import { noTelemetry, type Deps, type NewPost } from './deps';
import { createMemoryStore } from './store';
import { keys } from './keys';
import { dashCourse, dashReward, replayDash } from '../../shared/dash';
import { botMoves } from '../../shared/dashBot';

type Harness = {
  deps: Deps;
  as(user: string | undefined): Harness;
  at(dateKey: string): Harness;
  on(postId: string | undefined): Harness;
  posts: NewPost[];
  texts: { title: string; text: string }[];
  edits: { postId: string; text: string }[];
  pins: { postId: string; slot: number }[];
  appComments: { postId: string; text: string }[];
  comments: { postId: string; text: string }[];
  flairs: { username: string; text: string }[];
  events: string[];
};

const makeHarness = (): Harness => {
  const store = createMemoryStore();
  let user: string | undefined = 'alice';
  let date = '2026-11-12';
  let post: string | undefined;
  const h: Harness = {
    posts: [],
    texts: [],
    edits: [],
    pins: [],
    appComments: [],
    comments: [],
    flairs: [],
    events: [],
    deps: {
      store,
      now: () => new Date(`${date}T08:00:00Z`),
      username: async () => user,
      postId: () => post,
      createPost: async (p) => {
        h.posts.push(p);
        return `t3_post${h.posts.length}`;
      },
      createTextPost: async (title, text) => {
        h.texts.push({ title, text });
        return `t3_text${h.texts.length}`;
      },
      editTextPost: async (postId, text) => {
        h.edits.push({ postId, text });
      },
      pin: async (postId, slot) => {
        h.pins.push({ postId, slot });
      },
      appComment: async (postId, text) => {
        h.appComments.push({ postId, text });
        return `t1_recap${h.appComments.length}`;
      },
      comment: async (postId, text) => {
        h.comments.push({ postId, text });
        return true;
      },
      setFlair: async (username, text) => {
        h.flairs.push({ username, text });
      },
      telemetry: {
        ...noTelemetry,
        start: async () => 'journey-1',
        end: async (id, game) => {
          h.events.push(`end:${id}:${game.win}`);
        },
        interaction: async (_id, action) => {
          h.events.push(action);
        },
      },
    },
    as: (u) => {
      user = u;
      return h;
    },
    at: (d) => {
      date = d;
      return h;
    },
    on: (p) => {
      post = p;
      return h;
    },
  };
  return h;
};

const call = async <T>(
  h: Harness,
  method: 'GET' | 'POST',
  path: string,
  body?: unknown
) => {
  const api = createApi(h.deps);
  const res = await api.request(path, {
    method,
    headers: { 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const json: unknown = await res.json();
  return { status: res.status, json: json as T };
};

const planFor = (dateKey: string, paces?: Plan['paces']): Plan => {
  const stage = dayInfo(dateKey).stage;
  return paces ? { paces, drinks: stage.waterAfterKm } : defaultPlan(stage);
};

describe('game API', () => {
  let h: Harness;
  beforeEach(() => {
    h = makeHarness();
  });

  it('serves a guest init without saving anything', async () => {
    h.as(undefined);
    const { status, json } = await call<InitResponse>(h, 'GET', '/init');
    expect(status).toBe(200);
    expect(json.profile.username).toBe('guest');
    expect(json.myRun).toBeNull();
    expect(json.journeyId).toBe('journey-1');
  });

  it('asks guests to log in before running', async () => {
    h.as(undefined);
    const { status } = await call(h, 'POST', '/run', {
      plan: planFor('2026-11-12'),
    });
    expect(status).toBe(401);
  });

  it('runs once per day and ranks runners by time', async () => {
    const date = '2026-11-12';
    const slow = await call<RunResponse>(h.as('slowpoke'), 'POST', '/run', {
      plan: planFor(date, ['easy', 'easy', 'easy', 'easy', 'easy', 'easy']),
    });
    const fast = await call<RunResponse>(h.as('alice'), 'POST', '/run', {
      plan: planFor(date),
      journeyId: 'j',
    });
    expect(slow.status).toBe(200);
    expect(fast.json.run.rank).toBe(1);
    expect(fast.json.leaderboard.map((r) => r.username)).toEqual([
      'alice',
      'slowpoke',
    ]);
    expect(fast.json.run.reward.finish).toBe(50);
    // Coins: the run's reward, plus the achievements a first win completes.
    expect(fast.json.run.achieved).toEqual(['first-steps', 'podium']);
    expect(fast.json.profile.badges).toBe(fast.json.run.reward.total + 100);
    expect(h.events).toContain('end:j:true');

    const again = await call(h.as('alice'), 'POST', '/run', {
      plan: planFor(date),
    });
    expect(again.status).toBe(409);
  });

  it('replays the race on the server, and a collision changes both runners’ times', async () => {
    const date = '2026-11-12';
    const info = dayInfo(date);
    const plan = planFor(date);
    // fast start, then easy: alice (steady) catches up in the middle lane
    const slowPlan = planFor(date, [
      'push',
      'push',
      'easy',
      'easy',
      'easy',
      'easy',
    ]);
    const middle: Move[] = [{ step: 0, lane: 0 }];
    const slow = await call<RunResponse>(h.as('slowpoke'), 'POST', '/run', {
      plan: slowPlan,
      moves: middle,
      rivals: [],
    });
    const before = slow.json.run.seconds;

    // alice stays in the middle lane and runs into slowpoke from behind
    const res = await call<RunResponse>(h.as('alice'), 'POST', '/run', {
      plan,
      moves: middle,
      rivals: ['slowpoke'],
    });
    const sim = simulate(info.stage, info.weather.id, plan, info.time);
    const race = replayRace(
      {
        base: checkpoints(sim.splits),
        items: courseItems(date, info.stage, info.weather.id, {
          city: info.city.id,
          time: info.time,
        }),
        rivals: [
          {
            username: 'slowpoke',
            moves: middle,
            marks: slow.json.run.splits.reduce(
              (m, s) => [
                ...m,
                Math.round(((m.at(-1) ?? 0) + s.seconds) * 10) / 10,
              ],
              [0]
            ),
          },
        ],
        startLane: startLane('alice'),
      },
      middle
    );
    expect(res.json.run.seconds).toBe(race.finalSeconds);
    expect(res.json.run.incidents[0]).toMatchObject({
      with: 'slowpoke',
      atFault: true,
    });
    const sum = res.json.run.splits.reduce((t, s) => t + s.seconds, 0);
    expect(sum).toBeCloseTo(res.json.run.seconds, 0);

    const victim = await call<InitResponse>(h.as('slowpoke'), 'GET', '/init');
    expect(victim.json.myRun?.incidents[0]).toMatchObject({
      with: 'alice',
      atFault: false,
    });
    const lost = (victim.json.myRun?.incidents ?? []).reduce(
      (t, i) => t + i.seconds,
      0
    );
    expect(victim.json.myRun?.incidents).toHaveLength(
      res.json.run.incidents.length
    );
    expect(victim.json.myRun?.seconds).toBeCloseTo(before + lost, 1);
    expect(
      victim.json.leaderboard.find((r) => r.username === 'slowpoke')?.seconds
    ).toBe(victim.json.myRun?.seconds);

    // The crash penalty counts in the weekly standings too.
    expect(
      victim.json.weekly.rows.find((r) => r.username === 'slowpoke')?.seconds
    ).toBe(victim.json.myRun?.seconds);

    const bad = await call(h.as('bob'), 'POST', '/run', {
      plan,
      moves: [{ step: 1, lane: 5 }],
      rivals: [],
    });
    expect(bad.status).toBe(400);
  });

  it('ranks the week by stages run, then total time', async () => {
    const day1 = '2026-11-12';
    const day2 = addDays(day1, 1);
    // bob is fast but runs once; alice runs twice
    const fast = planFor(day1, [
      'push',
      'steady',
      'steady',
      'push',
      'push',
      'steady',
    ]);
    const a1 = await call<RunResponse>(h.as('alice').at(day1), 'POST', '/run', {
      plan: planFor(day1),
    });
    await call(h.as('bob').at(day1), 'POST', '/run', { plan: fast });
    const a2 = await call<RunResponse>(h.as('alice').at(day2), 'POST', '/run', {
      plan: planFor(day2),
    });
    expect(a2.json.weekly.rows.map((r) => r.username)).toEqual([
      'alice',
      'bob',
    ]);
    expect(a2.json.weekly.rows[0]).toMatchObject({ rank: 1, stages: 2 });
    expect(a2.json.weekly.rows[0]?.seconds).toBeCloseTo(
      a1.json.run.seconds + a2.json.run.seconds,
      1
    );
    expect(a2.json.weekly.mine?.username).toBe('alice');
    const bob = await call<InitResponse>(h.as('bob').at(day2), 'GET', '/init');
    expect(bob.json.weekly.mine).toMatchObject({ rank: 2, stages: 1 });
    // A new city week starts a new board.
    const later = await call<InitResponse>(
      h.as('bob').at(addDays(day1, 7)),
      'GET',
      '/init'
    );
    expect(later.json.weekly.rows).toHaveLength(0);
    expect(later.json.weekly.mine).toBeNull();
  });

  it('registers a runner with a look and hands out bibs in order', async () => {
    const before = await call<InitResponse>(h.as('newbie'), 'GET', '/init');
    expect(before.json.profile.registered).toBe(false);
    expect(before.json.profile.bib).toBeNull();

    const bad = await call(h, 'POST', '/register', {
      skin: 9,
      hair: 0,
      hairStyle: 0,
      top: 'tee-mint',
    });
    expect(bad.status).toBe(400);
    const locked = await call(h, 'POST', '/register', {
      skin: 1,
      hair: 2,
      hairStyle: 3,
      top: 'finisher-tee',
    });
    expect(locked.status).toBe(400);

    const first = await call<ProfileResponse>(
      h.as('newbie'),
      'POST',
      '/register',
      { skin: 1, hair: 2, hairStyle: 3, top: 'tee-mint' }
    );
    expect(first.json.profile).toMatchObject({ registered: true, bib: 1 });
    expect(first.json.profile.look).toMatchObject({
      skin: 1,
      hair: 2,
      hairStyle: 3,
      top: 'tee-mint',
    });
    expect(first.json.message).toBe('Bib #0001 is yours!');

    const again = await call<ProfileResponse>(
      h.as('newbie'),
      'POST',
      '/register',
      { skin: 0, hair: 0, hairStyle: 0, top: 'tee-sky' }
    );
    expect(again.json.profile.bib).toBe(1);
    const second = await call<ProfileResponse>(
      h.as('other'),
      'POST',
      '/register',
      { skin: 0, hair: 0, hairStyle: 1, top: 'tee-sky' }
    );
    expect(second.json.profile.bib).toBe(2);
  });

  it('gives a bib to anyone who races, and shows it to other runners', async () => {
    const date = '2026-11-12';
    await call(h.as('quick'), 'POST', '/run', {
      plan: planFor(date),
      moves: [],
      rivals: [],
    });
    const me = await call<InitResponse>(h.as('watcher'), 'GET', '/init');
    const quick = me.json.runners.find((r) => r.username === 'quick');
    expect(quick?.bib).toBe(1);
  });

  it('records quick-chat lines with the run and shows them to later runners', async () => {
    const date = '2026-11-12';
    const chat = [
      { step: 40, line: 0 },
      { step: 120, line: 2 },
    ];
    const ok = await call<RunResponse>(h.as('talker'), 'POST', '/run', {
      plan: planFor(date),
      moves: [],
      rivals: [],
      chat,
    });
    expect(ok.status).toBe(200);
    const later = await call<InitResponse>(h.as('listener'), 'GET', '/init');
    expect(
      later.json.runners.find((r) => r.username === 'talker')?.chat
    ).toEqual(chat);

    const spam = Array.from({ length: 5 }, (_, i) => ({ step: i, line: 1 }));
    const bad = await call(h.as('spammer'), 'POST', '/run', {
      plan: planFor(date),
      moves: [],
      rivals: [],
      chat: spam,
    });
    expect(bad.status).toBe(400);
    const unknown = await call(h.as('rude'), 'POST', '/run', {
      plan: planFor(date),
      moves: [],
      rivals: [],
      chat: [{ step: 1, line: 99 }],
    });
    expect(unknown.status).toBe(400);
  });

  it('dresses December for the holidays and doubles coins on Christmas', async () => {
    const before = await call<RunResponse>(
      h.at('2026-11-30').as('noel'),
      'POST',
      '/run',
      {
        plan: planFor('2026-11-30'),
      }
    );
    expect(before.json.profile.owned).not.toContain('santa-hat');

    const dec = await call<RunResponse>(h.at('2026-12-08'), 'POST', '/run', {
      plan: planFor('2026-12-08'),
    });
    expect(dec.json.run.unlocked).toEqual(
      expect.arrayContaining(['santa-hat', 'pet-santa'])
    );
    expect(dec.json.run.reward.holiday).toBeUndefined();

    const xmas = await call<RunResponse>(h.at('2026-12-25'), 'POST', '/run', {
      plan: planFor('2026-12-25'),
    });
    const r = xmas.json.run.reward;
    expect(r.holiday).toBe(r.finish + r.rank + r.streak);
    expect(r.total).toBe(2 * (r.finish + r.rank + r.streak) + r.crew);
  });

  it('titles the Christmas Day post as the Christmas Run', () => {
    expect(postTitle(dayInfo('2026-12-25'))).toMatch(/^🎄 Christmas Run · Day/);
    expect(postTitle(dayInfo('2026-12-24'))).toMatch(/^Day/);
  });

  it('keeps a history and pays achievements once', async () => {
    const first = await call<RunResponse>(
      h.at('2026-11-12').as('ana'),
      'POST',
      '/run',
      {
        plan: planFor('2026-11-12'),
        chat: [{ step: 2, line: 1 }],
      }
    );
    expect(first.json.run.achieved).toEqual(
      expect.arrayContaining(['first-steps', 'podium'])
    );
    const coins = first.json.profile.badges;
    await call(h.at('2026-11-13'), 'POST', '/run', {
      plan: planFor('2026-11-13'),
    });
    const page = await call<MeResponse>(h, 'GET', '/me');
    expect(page.status).toBe(200);
    expect(page.json.history.map((r) => r.dateKey)).toEqual([
      '2026-11-12',
      '2026-11-13',
    ]);
    expect(page.json.history[0]).toMatchObject({ rank: 1, runners: 1 });
    expect(page.json.profile.stats.chats).toBe(1);
    expect(page.json.earned).toEqual([]);
    const marathon = page.json.achievements.find((x) => x.id === 'marathoner');
    expect(marathon).toMatchObject({ value: 12, target: 42, done: false });
    expect(page.json.profile.badges).toBeGreaterThan(coins);

    // Friends count once the profile page looks again.
    for (const f of ['bo', 'cy', 'di'])
      await call(h.as(f), 'POST', '/run', { plan: planFor('2026-11-13') });
    for (const f of ['bo', 'cy', 'di'])
      await call(h.as('ana'), 'POST', '/friends/add', { username: f });
    const again = await call<MeResponse>(h.as('ana'), 'GET', '/me');
    expect(again.json.earned).toEqual(['social-runner']);
    const third = await call<MeResponse>(h.as('ana'), 'GET', '/me');
    expect(third.json.earned).toEqual([]);
  });

  it('pays for calling your finish time, within limits', async () => {
    const date = '2026-11-12';
    const plan = planFor(date);
    const info = dayInfo(date);
    const projected = simulate(
      info.stage,
      info.weather.id,
      plan,
      info.time
    ).totalSeconds;
    // A first run to learn the real time on an empty road (no rivals, no steering).
    const probe = await call<RunResponse>(h.as('seer'), 'POST', '/run', {
      plan,
      guess: Math.round(projected),
    });
    const actual = probe.json.run.seconds;
    expect(probe.json.run.guess?.seconds).toBe(Math.round(projected));
    const off = Math.abs(actual - Math.round(projected));
    expect(probe.json.run.reward.guess ?? 0).toBe(
      off <= 3 ? 60 : off <= 10 ? 30 : 0
    );

    // Same plan, same empty road for the next runner: a perfect call.
    const next = await call<RunResponse>(h.as('oracle'), 'POST', '/run', {
      plan,
      rivals: [],
      guess: Math.round(actual),
    });
    if (Math.abs(next.json.run.seconds - Math.round(actual)) <= 3) {
      expect(next.json.run.reward.guess).toBe(60);
      expect(next.json.run.achieved).toContain('called-it');
    }
    // Guesses far from the plan are ignored.
    const wild = await call<RunResponse>(h.as('wild'), 'POST', '/run', {
      plan,
      guess: 99999,
    });
    expect(wild.json.run.guess).toBeNull();
    expect(wild.json.run.reward.guess).toBeUndefined();
  });

  it('rejects invalid plans', async () => {
    const { status } = await call(h, 'POST', '/run', {
      plan: { paces: ['push'], drinks: [] },
    });
    expect(status).toBe(400);
  });

  it('grows a streak on consecutive days and resets after a gap', async () => {
    for (const d of ['2026-11-10', '2026-11-11', '2026-11-12']) {
      await call(h.at(d), 'POST', '/run', { plan: planFor(d) });
    }
    const init = await call<InitResponse>(h.at('2026-11-12'), 'GET', '/init');
    expect(init.json.profile.streak).toBe(3);
    expect(init.json.profile.owned).toContain('headband');

    const later = await call<RunResponse>(h.at('2026-11-15'), 'POST', '/run', {
      plan: planFor('2026-11-15'),
    });
    expect(later.json.run.streak).toBe(1);
    expect(later.json.profile.bestStreak).toBe(3);
  });

  it('puts the other runners on the road, but not yourself', async () => {
    const date = '2026-11-12';
    for (const u of ['bob', 'cara', 'alice'])
      await call(h.as(u), 'POST', '/run', { plan: planFor(date) });
    const init = await call<InitResponse>(h.as('alice'), 'GET', '/init');
    expect(init.json.runners.map((g) => g.username).sort()).toEqual([
      'bob',
      'cara',
    ]);
    expect(init.json.runners[0]?.marks).toHaveLength(7);
    expect(init.json.myRun?.rank).toBeGreaterThan(0);
  });

  it('finishes the crew marathon and pays everyone who ran that season', async () => {
    const date = '2026-11-12';
    // 68 runs of 6 km are already logged this season (408 km); r3 crosses 421.95 km.
    await h.deps.store.hSet(keys.crew(0), { meters: String(68 * 6000) });
    const runners = ['r1', 'r2', 'r3'];
    let last: RunResponse | undefined;
    for (const u of runners) {
      last = (
        await call<RunResponse>(h.as(u), 'POST', '/run', {
          plan: planFor(date),
        })
      ).json;
    }
    expect(last?.run.crewFinishedNow).toBe(true);
    expect(last?.crew.finished).toBe(true);
    expect(last?.run.reward.crew).toBe(200);
    expect(last?.profile.finishedCities).toContain('tokyo');
    expect(last?.profile.owned).toContain('hachimaki');
    expect(last?.profile.ownedPets).toContain('shiba');
    // One celebration post for the city, from the app.
    expect(h.texts).toHaveLength(1);
    expect(h.texts[0]?.title).toBe('🎉 The crew finished Tokyo!');
    expect(h.texts[0]?.text).toMatch(
      /u\/r3 ran the stage that crossed the line/
    );
    expect(h.texts[0]?.text).toMatch(/Next week: .* Paris/);
    await call(h.as('r4'), 'POST', '/run', { plan: planFor(date) });
    expect(h.texts).toHaveLength(1);

    const early = await call<InitResponse>(h.as('r1'), 'GET', '/init');
    expect(early.json.profile.claimedSeasons).toEqual([0]);
    expect(early.json.profile.badges).toBeGreaterThanOrEqual(250);
    const again = await call<InitResponse>(h.as('r1'), 'GET', '/init');
    expect(again.json.profile.badges).toBe(early.json.profile.badges);
  });

  it('awards the Finisher flair after 5 stages in one city', async () => {
    for (let i = 0; i < 5; i++) {
      const d = addDays('2026-11-09', i);
      await call(h.at(d), 'POST', '/run', { plan: planFor(d) });
    }
    expect(h.flairs).toEqual([
      { username: 'alice', text: '🏅 Tokyo Finisher' },
    ]);
    const init = await call<InitResponse>(h.at('2026-11-13'), 'GET', '/init');
    expect(init.json.profile.finisher).toBe(true);
    expect(init.json.profile.owned).toContain('finisher-tee');
  });

  it('sells items for coins and equips them', async () => {
    const poor = await call(h, 'POST', '/shop/buy', { itemId: 'shades' });
    expect(poor.status).toBe(400);

    await h.deps.store.set(
      keys.user('alice'),
      JSON.stringify({ badges: 1000 })
    );
    const bought = await call<ProfileResponse>(h, 'POST', '/shop/buy', {
      itemId: 'shades',
    });
    expect(bought.status).toBe(200);
    expect(bought.json.profile.badges).toBe(700);
    expect(bought.json.profile.look.accessory).toBe('shades');

    const equip = await call<ProfileResponse>(h, 'POST', '/shop/equip', {
      itemId: 'no-extra',
    });
    expect(equip.json.profile.look.accessory).toBe('no-extra');

    const locked = await call(h, 'POST', '/shop/equip', { itemId: 'kumo' });
    expect(locked.status).toBe(400);
    const earned = await call(h, 'POST', '/shop/buy', { itemId: 'hachimaki' });
    expect(earned.status).toBe(400);
  });

  it('dresses the pet with gear, and gives older profiles a pet-gear slot', async () => {
    // A profile saved before pet gear existed: its look has no petGear.
    await h.deps.store.set(
      keys.user('alice'),
      JSON.stringify({
        badges: 2000,
        look: {
          top: 'tee-sky',
          hat: 'no-hat',
          shoes: 'runners-basic',
          accessory: 'no-extra',
          trail: 'no-trail',
          pet: 'corgi',
          skin: 1,
          hair: 1,
        },
      })
    );
    const init = await call<InitResponse>(h, 'GET', '/init');
    expect(init.json.profile.look.petGear).toBe('pet-none');
    expect(init.json.profile.look.top).toBe('tee-sky');
    const bow = await call<ProfileResponse>(h, 'POST', '/shop/buy', {
      itemId: 'pet-bow',
    });
    expect(bow.json.profile.look.petGear).toBe('pet-bow');
    expect(bow.json.profile.badges).toBe(1800);
    const bunny = await call<ProfileResponse>(h, 'POST', '/pet/choose', {
      petId: 'bunny',
    });
    expect(bunny.json.profile.look).toMatchObject({
      pet: 'bunny',
      petGear: 'pet-bow',
    });
    expect(bunny.json.profile.badges).toBe(1200);
    const off = await call<ProfileResponse>(h, 'POST', '/shop/equip', {
      itemId: 'pet-none',
    });
    expect(off.json.profile.look.petGear).toBe('pet-none');
  });

  it('buys and cares for pets once a day', async () => {
    await h.deps.store.set(keys.user('alice'), JSON.stringify({ badges: 900 }));
    const cat = await call<ProfileResponse>(h, 'POST', '/pet/choose', {
      petId: 'cat',
    });
    expect(cat.json.profile.look.pet).toBe('cat');
    expect(cat.json.profile.badges).toBe(100);
    const locked = await call(h, 'POST', '/pet/choose', { petId: 'penguin' });
    expect(locked.status).toBe(400);

    const first = await call<ProfileResponse>(h, 'POST', '/pet/care', {});
    const second = await call<ProfileResponse>(h, 'POST', '/pet/care', {});
    expect(first.json.profile.petAffinity).toBe(1);
    expect(second.json.profile.petAffinity).toBe(1);
    expect(second.json.message).toMatch(/already happy/);
  });

  it('lets each runner send one cheer a day to someone who ran', async () => {
    const date = '2026-11-12';
    await call(h.as('bob'), 'POST', '/run', { plan: planFor(date) });
    expect(
      (await call(h.as('alice'), 'POST', '/cheer', { username: 'nobody' }))
        .status
    ).toBe(404);
    expect(
      (await call(h.as('bob'), 'POST', '/cheer', { username: 'bob' })).status
    ).toBe(400);
    const ok = await call<ProfileResponse>(h.as('alice'), 'POST', '/cheer', {
      username: 'bob',
    });
    expect(ok.json.profile.badges).toBe(5);
    expect(
      (await call(h.as('alice'), 'POST', '/cheer', { username: 'bob' })).status
    ).toBe(409);
    const bob = await call<InitResponse>(h.as('bob'), 'GET', '/init');
    expect(bob.json.cheersReceived).toBe(1);
  });

  it('tracks quests on the server and pays each one once', async () => {
    const date = '2026-11-12';
    const before = await call<InitResponse>(
      h.as('alice').at(date),
      'GET',
      '/init'
    );
    const daily = before.json.quests.filter((q) => q.scope === 'daily');
    expect(daily).toHaveLength(3);
    expect(daily[0]).toMatchObject({ id: 'run', progress: 0, claimed: false });
    expect(
      before.json.quests.filter((q) => q.scope === 'weekly').map((q) => q.id)
    ).toEqual(['week3', 'week5', 'vote']);
    // Everyone gets the same daily quests.
    const bob = await call<InitResponse>(h.as('bob').at(date), 'GET', '/init');
    expect(bob.json.quests.map((q) => q.id)).toEqual(
      before.json.quests.map((q) => q.id)
    );

    expect(
      (await call(h.as('alice'), 'POST', '/quest/claim', { questId: 'run' }))
        .status
    ).toBe(409);
    expect(
      (await call(h.as('alice'), 'POST', '/quest/claim', { questId: 'nope' }))
        .status
    ).toBe(404);
    await call(h.as('alice'), 'POST', '/run', { plan: planFor(date) });
    const coins = (await call<InitResponse>(h.as('alice'), 'GET', '/init')).json
      .profile.badges;
    const claimed = await call<QuestsResponse>(
      h.as('alice'),
      'POST',
      '/quest/claim',
      { questId: 'run', journeyId: 'journey-1' }
    );
    expect(claimed.status).toBe(200);
    expect(claimed.json.profile.badges).toBe(coins + 40);
    expect(claimed.json.quests.find((q) => q.id === 'run')).toMatchObject({
      progress: 1,
      claimed: true,
    });
    expect(h.events).toContain('quest_claimed');
    expect(
      (await call(h.as('alice'), 'POST', '/quest/claim', { questId: 'run' }))
        .status
    ).toBe(409);
    const week = await call<QuestsResponse>(h.as('alice'), 'GET', '/quests');
    expect(week.json.quests.find((q) => q.id === 'week3')?.progress).toBe(1);
    await call(h.as('alice'), 'POST', '/vote', { cityId: 'rio' });
    const voted = await call<QuestsResponse>(
      h.as('alice'),
      'POST',
      '/quest/claim',
      { questId: 'vote' }
    );
    expect(voted.json.quests.find((q) => q.id === 'vote')?.claimed).toBe(true);
    // Tomorrow the daily quests reset, the weekly vote stays claimed.
    const next = await call<QuestsResponse>(
      h.as('alice').at(addDays(date, 1)),
      'GET',
      '/quests'
    );
    expect(next.json.quests.find((q) => q.id === 'run')).toMatchObject({
      progress: 0,
      claimed: false,
    });
    expect(next.json.quests.find((q) => q.id === 'vote')?.claimed).toBe(true);
    expect((await call(h.as(undefined), 'GET', '/quests')).status).toBe(401);
  });

  it('scores Snack Dash on the server, round by round', async () => {
    const date = '2026-11-12';
    h.as('alice').at(date);
    const moves = botMoves(date, 0);
    const expected = replayDash(dashCourse(date, 0), moves).score;
    expect(
      (await call(h.as(undefined), 'POST', '/dash', { round: 0, moves })).status
    ).toBe(401);
    expect(
      (await call(h.as('alice'), 'POST', '/dash', { round: 1, moves })).status
    ).toBe(409);
    expect(
      (await call(h, 'POST', '/dash', { round: 0, moves: 'x' })).status
    ).toBe(400);
    const first = await call<DashResponse>(h, 'POST', '/dash', {
      round: 0,
      moves,
      journeyId: 'journey-1',
    });
    expect(first.json.score).toBe(expected);
    expect(first.json.reward).toBe(dashReward(expected, 0));
    expect(first.json.profile.badges).toBe(first.json.reward);
    expect(first.json.profile.dash).toMatchObject({
      date,
      plays: 1,
      best: expected,
    });
    expect(first.json.board.rows[0]).toMatchObject({
      rank: 1,
      username: 'alice',
      score: expected,
    });
    expect(first.json.quests.find((q) => q.id === 'dash')?.progress ?? 1).toBe(
      1
    );
    expect(h.events).toContain('dash_played');
    // The same round cannot be played twice.
    expect((await call(h, 'POST', '/dash', { round: 0, moves })).status).toBe(
      409
    );
    // Rounds 2 and 3 pay, round 4 does not.
    for (let r = 1; r < 3; r++)
      expect(
        (
          await call<DashResponse>(h, 'POST', '/dash', {
            round: r,
            moves: botMoves(date, r),
          })
        ).json.reward
      ).toBeGreaterThan(0);
    const fourth = await call<DashResponse>(h, 'POST', '/dash', {
      round: 3,
      moves: botMoves(date, 3),
    });
    expect(fourth.json.reward).toBe(0);
    for (let r = 4; r < 10; r++)
      await call(h, 'POST', '/dash', { round: r, moves: [] });
    expect(
      (await call(h, 'POST', '/dash', { round: 10, moves: [] })).status
    ).toBe(409);
    // bob scores less and ranks second; his own row comes back as mine.
    const bob = await call<DashResponse>(h.as('bob'), 'POST', '/dash', {
      round: 0,
      moves: [],
    });
    expect(bob.json.board.mine).toMatchObject({ rank: 2, username: 'bob' });
    // A new day starts over.
    const next = await call<DashResponse>(
      h.as('alice').at(addDays(date, 1)),
      'POST',
      '/dash',
      { round: 0, moves: [] }
    );
    expect(next.status).toBe(200);
  });

  it('scores Hurdle Hop, Rhythm Steps and Pet Fetch on the server', async () => {
    const day = '2026-11-12';
    const jumps = hurdleCourse(day, 0).map((t) => t - 300);
    const hop = await call<ArcadeResponse>(h.as('ana'), 'POST', '/arcade', {
      game: 'hurdle',
      round: 0,
      taps: jumps,
    });
    expect(hop.status).toBe(200);
    expect(hop.json.score).toBeGreaterThan(200);
    expect(hop.json.reward).toBe(40);
    expect(hop.json.profile.arcade.hurdle).toMatchObject({ plays: 1 });
    expect(hop.json.board.rows[0]).toMatchObject({ username: 'ana' });

    const again = await call(h, 'POST', '/arcade', {
      game: 'hurdle',
      round: 0,
      taps: jumps,
    });
    expect(again.status).toBe(409);
    const beat = await call<ArcadeResponse>(h, 'POST', '/arcade', {
      game: 'rhythm',
      round: 0,
      taps: rhythmCourse(day, 0),
    });
    expect(beat.json.score).toBeGreaterThan(300);
    const fetch = await call<ArcadeResponse>(h, 'POST', '/arcade', {
      game: 'fetch',
      round: 0,
      taps: [700, 700, 700, 700, 700],
    });
    expect(fetch.status).toBe(200);
    expect(fetch.json.score).toBe(
      scoreFetch(fetchCourse(day, 0), [700, 700, 700, 700, 700]).score
    );
    expect(
      (await call(h, 'POST', '/arcade', { game: 'golf', round: 0, taps: [] }))
        .status
    ).toBe(404);
    expect(
      (
        await call(h, 'POST', '/arcade', {
          game: 'rhythm',
          round: 1,
          taps: [9, 1],
        })
      ).status
    ).toBe(400);
    const board = await call<ArcadeBoardResponse>(
      h,
      'GET',
      '/arcade?game=rhythm'
    );
    expect(board.json.board.mine?.username).toBe('ana');
  });

  it('adds friends, shows their day, and puts them first on the road', async () => {
    const date = '2026-11-12';
    h.at(date);
    await call(h.as('bob'), 'POST', '/run', { plan: planFor(date) });
    await call(h.as('newbie'), 'POST', '/register', {
      skin: 0,
      hair: 0,
      hairStyle: 0,
      top: 'tee-coral',
    });
    expect(
      (await call(h.as('alice'), 'POST', '/friends/add', { username: 'ghost' }))
        .status
    ).toBe(404);
    expect(
      (await call(h.as('alice'), 'POST', '/friends/add', { username: 'alice' }))
        .status
    ).toBe(400);
    const added = await call<FriendsResponse>(
      h.as('alice'),
      'POST',
      '/friends/add',
      { username: 'u/bob', journeyId: 'journey-1' }
    );
    expect(added.status).toBe(200);
    expect(added.json.profile.friends).toEqual(['bob']);
    expect(added.json.friends[0]).toMatchObject({ username: 'bob', rank: 1 });
    expect(added.json.friends[0]?.seconds).toBeGreaterThan(0);
    expect(h.events).toContain('friend_added');
    expect(
      (await call(h.as('alice'), 'POST', '/friends/add', { username: 'bob' }))
        .status
    ).toBe(409);
    // Registered but has not run yet: still a valid friend, with no time today.
    const both = await call<FriendsResponse>(
      h.as('alice'),
      'POST',
      '/friends/add',
      { username: 'newbie' }
    );
    expect(
      both.json.friends.find((f) => f.username === 'newbie')
    ).toMatchObject({ seconds: null, rank: null });
    expect(both.json.suggestions).not.toContain('bob');

    // Fill the road with fast strangers; bob is slower than all of them.
    for (let i = 0; i < 14; i++) {
      const name = `fast${i}`;
      await h.deps.store.zAdd(keys.leaderboard(date), {
        member: name,
        score: 600 + i,
      });
      await h.deps.store.hSet(keys.tracks(date), {
        [name]: JSON.stringify({
          username: name,
          look: {},
          marks: [0, 100, 200, 300, 400, 500, 600 + i],
          seconds: 600 + i,
        }),
      });
    }
    const road = await call<InitResponse>(h.as('alice'), 'GET', '/init');
    expect(road.json.runners[0]?.username).toBe('bob');
    const stranger = await call<InitResponse>(h.as('carol'), 'GET', '/init');
    expect(stranger.json.runners.map((r) => r.username)).not.toContain('bob');

    const removed = await call<FriendsResponse>(
      h.as('alice'),
      'POST',
      '/friends/remove',
      { username: 'bob' }
    );
    expect(removed.json.profile.friends).toEqual(['newbie']);
    expect((await call(h.as(undefined), 'GET', '/friends')).status).toBe(401);
  });

  it('runs a daily club relay with the first three clubmates', async () => {
    const date = '2026-11-12';
    h.at(date);
    const reg = (u: string) =>
      call(h.as(u), 'POST', '/register', {
        skin: 0,
        hair: 0,
        hairStyle: 0,
        top: 'tee-coral',
      });
    for (const u of ['ann', 'ben', 'cat', 'dan']) await reg(u);
    const made = await call<ClubResponse>(h.as('ann'), 'POST', '/club/create', {
      adjective: 0,
      noun: 0,
    });
    const code = made.json.club?.code ?? '';
    for (const u of ['ben', 'cat', 'dan'])
      await call(h.as(u), 'POST', '/club/join', { code });

    const runs: RunResponse[] = [];
    for (const u of ['ann', 'ben', 'cat', 'dan'])
      runs.push(
        (
          await call<RunResponse>(h.as(u), 'POST', '/run', {
            plan: planFor(date),
          })
        ).json
      );
    expect(runs.map((r) => r.run.relay)).toEqual([
      { leg: 1, done: false, coins: 0 },
      { leg: 2, done: false, coins: 0 },
      { leg: 3, done: true, coins: 25 },
      null,
    ]);
    expect(runs[2]?.run.reward.relay).toBe(25);

    const view = await call<ClubResponse>(h.as('ann'), 'GET', '/club');
    const relay = view.json.club?.relay;
    expect(relay?.legs.map((l) => l.username)).toEqual(['ann', 'ben', 'cat']);
    const sum =
      Math.round(runs.slice(0, 3).reduce((t, r) => t + r.run.seconds, 0) * 10) /
      10;
    expect(relay?.total).toBeCloseTo(sum, 0);
    expect(relay?.rank).toBe(1);
    expect(view.json.relays[0]).toMatchObject({ rank: 1, code });
    // ann's leg paid out when cat finished the relay.
    expect(view.json.profile.badges).toBeGreaterThanOrEqual(
      runs[0]!.profile.badges + 25
    );
  });

  it('runs clubs: create, join by code, weekly total, shared road, leave', async () => {
    const date = '2026-11-12';
    h.at(date);
    const reg = (u: string) =>
      call(h.as(u), 'POST', '/register', {
        skin: 0,
        hair: 0,
        hairStyle: 0,
        top: 'tee-coral',
      });
    await reg('alice');
    await reg('bob');
    expect(
      (
        await call(h.as('alice'), 'POST', '/club/create', {
          adjective: 99,
          noun: 0,
        })
      ).status
    ).toBe(400);
    const made = await call<ClubResponse>(
      h.as('alice'),
      'POST',
      '/club/create',
      { adjective: 0, noun: 0, journeyId: 'journey-1' }
    );
    expect(made.status).toBe(200);
    const code = made.json.club?.code ?? '';
    expect(made.json.club).toMatchObject({
      name: 'Speedy Pandas',
      owner: 'alice',
      weekStages: 0,
    });
    expect(code).toMatch(/^[A-Z2-9]{6}$/);
    expect(h.events).toContain('club_created');
    expect(
      (
        await call(h.as('alice'), 'POST', '/club/create', {
          adjective: 1,
          noun: 1,
        })
      ).status
    ).toBe(409);
    expect(
      (await call(h.as('bob'), 'POST', '/club/join', { code: 'nope' })).status
    ).toBe(400);
    expect(
      (await call(h.as('bob'), 'POST', '/club/join', { code: 'ZZZZZZ' })).status
    ).toBe(404);
    expect(
      (await call(h.as('ghost'), 'POST', '/club/join', { code })).status
    ).toBe(400);
    const joined = await call<ClubResponse>(h.as('bob'), 'POST', '/club/join', {
      code: code.toLowerCase(),
    });
    expect(joined.json.club?.members.map((m) => m.username).sort()).toEqual([
      'alice',
      'bob',
    ]);

    // bob runs: the club gets a stage, alice sees him on her road.
    await call(h.as('bob'), 'POST', '/run', { plan: planFor(date) });
    const view = await call<ClubResponse>(h.as('alice'), 'GET', '/club');
    expect(view.json.club?.weekStages).toBe(1);
    expect(view.json.club?.members[0]).toMatchObject({
      username: 'bob',
      weekStages: 1,
    });
    expect(view.json.top[0]).toMatchObject({
      rank: 1,
      code,
      name: 'Speedy Pandas',
      weekStages: 1,
    });
    const road = await call<InitResponse>(h.as('alice'), 'GET', '/init');
    expect(road.json.club?.code).toBe(code);
    expect(road.json.runners.map((r) => r.username)).toContain('bob');

    // The owner leaves: bob takes over.
    const left = await call<ClubResponse>(
      h.as('alice'),
      'POST',
      '/club/leave',
      {}
    );
    expect(left.json.club).toBeNull();
    expect(left.json.profile.club).toBeNull();
    const bobView = await call<ClubResponse>(h.as('bob'), 'GET', '/club');
    expect(bobView.json.club).toMatchObject({ owner: 'bob' });
    expect(bobView.json.club?.members).toHaveLength(1);
  });

  it('looks up Reddit avatars once a day and caches them', async () => {
    const asked: string[] = [];
    h.deps.avatarUrl = async (u) => {
      asked.push(u);
      return u === 'plain' ? null : `https://img.example/${u}.png`;
    };
    const first = await call<AvatarsResponse>(
      h.at('2026-11-12'),
      'GET',
      '/avatars?u=alice,plain,bad%20name,alice'
    );
    expect(first.json.avatars).toEqual({
      alice: 'https://img.example/alice.png',
      plain: null,
    });
    await call(h, 'GET', '/avatars?u=alice,plain');
    expect(asked).toEqual(['alice', 'plain']);
    await call(h.at('2026-11-13'), 'GET', '/avatars?u=alice');
    expect(asked).toEqual(['alice', 'plain', 'alice']);
  });

  it('checks in once a day and climbs a 7-day calendar', async () => {
    const d0 = '2026-11-12';
    expect((await call(h.as(undefined), 'POST', '/checkin', {})).status).toBe(
      401
    );
    const first = await call<ProfileResponse>(
      h.as('alice').at(d0),
      'POST',
      '/checkin',
      {}
    );
    expect(first.json.profile).toMatchObject({
      checkInDay: 1,
      badges: 20,
      checkInDate: d0,
    });
    expect((await call(h.at(d0), 'POST', '/checkin', {})).status).toBe(409);
    let badges = 20;
    for (let i = 1; i < 7; i++) {
      const r = await call<ProfileResponse>(
        h.at(addDays(d0, i)),
        'POST',
        '/checkin',
        {}
      );
      expect(r.json.profile.checkInDay).toBe(i + 1);
      badges = r.json.profile.badges;
    }
    expect(badges).toBe(20 + 30 + 40 + 50 + 60 + 80 + 150);
    // After day 7 the calendar starts over.
    const eighth = await call<ProfileResponse>(
      h.at(addDays(d0, 7)),
      'POST',
      '/checkin',
      {}
    );
    expect(eighth.json.profile.checkInDay).toBe(1);
    // Missing a day also starts over.
    await call(h.at(addDays(d0, 8)), 'POST', '/checkin', {});
    const gap = await call<ProfileResponse>(
      h.at(addDays(d0, 10)),
      'POST',
      '/checkin',
      {}
    );
    expect(gap.json.profile.checkInDay).toBe(1);
    expect(h.events).toContain('checked_in');
  });

  it('lets runners vote once a week on the next city', async () => {
    const date = '2026-11-12';
    expect(
      (await call(h.as(undefined), 'POST', '/vote', { cityId: 'seoul' })).status
    ).toBe(401);
    // Only runners who ran a stage this week can vote.
    expect(
      (await call(h.as('alice'), 'POST', '/vote', { cityId: 'seoul' })).status
    ).toBe(409);
    await call(h.as('alice'), 'POST', '/run', { plan: planFor(date) });
    await call(h.as('bob'), 'POST', '/run', { plan: planFor(date) });
    expect(
      (await call(h.as('alice'), 'POST', '/vote', { cityId: 'atlantis' }))
        .status
    ).toBe(400);
    const first = await call<VoteResponse>(h.as('alice'), 'POST', '/vote', {
      cityId: 'seoul',
      journeyId: 'journey-1',
    });
    expect(first.json.vote.counts.seoul).toBe(1);
    expect(first.json.vote.mine).toBe('seoul');
    expect(h.events).toContain('city_voted');
    expect(
      (await call(h.as('alice'), 'POST', '/vote', { cityId: 'rio' })).status
    ).toBe(409);
    await call(h.as('bob'), 'POST', '/vote', { cityId: 'seoul' });
    const bob = await call<InitResponse>(h.as('bob'), 'GET', '/init');
    expect(bob.json.vote).toMatchObject({ total: 2, mine: 'seoul' });
    const guest = await call<InitResponse>(h.as(undefined), 'GET', '/init');
    expect(guest.json.vote.mine).toBeNull();
    // A new week (a new city) starts a new vote, and last week's runners need a new run.
    const nextWeek = addDays(date, 7);
    const later = await call<InitResponse>(
      h.as('alice').at(nextWeek),
      'GET',
      '/init'
    );
    expect(later.json.vote.total).toBe(0);
    expect(
      (
        await call(h.as('alice').at(nextWeek), 'POST', '/vote', {
          cityId: 'rio',
        })
      ).status
    ).toBe(409);
  });

  it('shares the result to the comments once', async () => {
    h.on('t3_today');
    await call(h, 'POST', '/run', { plan: planFor('2026-11-12') });
    const first = await call<ShareResponse>(h, 'POST', '/share', {});
    const second = await call<ShareResponse>(h, 'POST', '/share', {});
    expect(first.json.commentPosted).toBe(true);
    expect(second.json.commentPosted).toBe(false);
    expect(h.comments).toHaveLength(1);
    expect(h.comments[0]?.text).toMatch(
      /Finished in \*\*\d+:\d\d\*\* · #1 of 1/
    );
  });
});

describe('daily posts', () => {
  it('creates one post per day and maps it back to its date', async () => {
    const h = makeHarness();
    const internal = createInternal(h.deps, (id) => `https://reddit.com/${id}`);
    const a = await internal.request('/scheduler/daily-stage', {
      method: 'POST',
    });
    const b = await internal.request('/menu/post-today', { method: 'POST' });
    expect(a.status).toBe(200);
    expect(await b.json()).toEqual({
      navigateTo: 'https://reddit.com/t3_post1',
    });
    expect(h.posts).toHaveLength(1);
    // The shared calendar is on Tokyo stage 4, but this subreddit's count starts at 1.
    expect(h.posts[0]?.title).toMatch(/^Day 1 · .* Tokyo 4\/7: Meiji Forest/);

    h.on('t3_post1').at('2026-11-13');
    await internal.request('/scheduler/daily-stage', { method: 'POST' });
    expect(h.posts[1]?.title).toMatch(/^Day 2 · .* Tokyo 5\/7/);
    const old = await call<InitResponse>(h, 'GET', '/init');
    expect(old.json.dateKey).toBe('2026-11-12');
    expect(old.json.todayPostId).toBe('t3_post2');
    const closed = await call(h, 'POST', '/run', {
      plan: planFor('2026-11-12'),
    });
    expect(closed.status).toBe(409);
  });

  it('posts a recap of the closed day under its post, once', async () => {
    const h = makeHarness();
    const internal = createInternal(h.deps, (id) => `https://reddit.com/${id}`);
    await internal.request('/scheduler/daily-stage', { method: 'POST' });
    const date = '2026-11-12';
    const middle: Move[] = [{ step: 0, lane: 0 }];
    await call(h.as('slowpoke').on('t3_post1'), 'POST', '/run', {
      plan: planFor(date, ['push', 'push', 'easy', 'easy', 'easy', 'easy']),
      moves: middle,
      rivals: [],
      chat: [{ step: 3, line: 2 }],
    });
    await call(h.as('alice'), 'POST', '/run', {
      plan: planFor(date),
      moves: middle,
      rivals: ['slowpoke'],
      chat: [
        { step: 3, line: 2 },
        { step: 20, line: 0 },
      ],
    });
    await call(h.as('bob'), 'POST', '/run', { plan: planFor(date) });

    // Nothing to recap while the stage is still open.
    await internal.request('/scheduler/daily-stage', { method: 'POST' });
    expect(h.appComments).toHaveLength(0);

    h.at('2026-11-13');
    await internal.request('/scheduler/daily-stage', { method: 'POST' });
    await internal.request('/scheduler/daily-stage', { method: 'POST' });
    expect(h.appComments).toHaveLength(1);
    const { postId, text } = h.appComments[0]!;
    expect(postId).toBe('t3_post1');
    expect(text).toMatch(/Race recap: .* Tokyo 4\/7, Meiji Forest/);
    expect(text).toMatch(/🥇 u\/\w+ \d+:\d\d/);
    expect(text).toMatch(/\*\*3\*\* runners covered \*\*18 km\*\*/);
    expect(text).toMatch(/💥 \d+ crash/);
    expect(text).toMatch(/Most shouted: "Let's go! 🔥" \(2 times\)/);
    expect(text).toMatch(/Next up: .* Tokyo 5\/7/);

    // A day nobody ran gets no recap.
    h.at('2026-11-15');
    await internal.request('/scheduler/daily-stage', { method: 'POST' });
    expect(h.appComments).toHaveLength(1);
  });

  it('follows the moderators’ settings', async () => {
    const h = makeHarness();
    h.deps.settings = async () => ({
      quickChat: false,
      roadLife: false,
      pinPosts: false,
      dailyRecap: false,
      appPosts: false,
    });
    const internal = createInternal(h.deps, (id) => `https://reddit.com/${id}`);
    await internal.request('/triggers/on-app-install', { method: 'POST' });
    expect(h.posts).toHaveLength(1);
    expect(h.pins).toEqual([]);
    expect(h.texts).toEqual([]);

    const date = '2026-11-12';
    const ran = await call<RunResponse>(h.on('t3_post1'), 'POST', '/run', {
      plan: planFor(date),
      chat: [{ step: 3, line: 2 }],
    });
    expect(ran.json.run.chat).toEqual([]);
    expect(ran.json.run.met.some((k) => isRoadLife(k))).toBe(false);
    const page = await call<InitResponse>(h, 'GET', '/init');
    expect(page.json.settings).toEqual({ quickChat: false, roadLife: false });

    h.at('2026-11-13');
    await internal.request('/scheduler/daily-stage', { method: 'POST' });
    expect(h.appComments).toEqual([]);
    expect(h.pins).toEqual([]);
  });

  it('pins each new stage at the top, once', async () => {
    const h = makeHarness();
    const internal = createInternal(h.deps, (id) => `https://reddit.com/${id}`);
    await internal.request('/scheduler/daily-stage', { method: 'POST' });
    await internal.request('/menu/post-today', { method: 'POST' });
    h.at('2026-11-13');
    await internal.request('/scheduler/daily-stage', { method: 'POST' });
    expect(h.pins).toEqual([
      { postId: 't3_post1', slot: 1 },
      { postId: 't3_post2', slot: 1 },
    ]);
  });

  it('posts and pins the how-to-play guide once on install', async () => {
    const h = makeHarness();
    const internal = createInternal(h.deps, (id) => `https://reddit.com/${id}`);
    const first = await internal.request('/triggers/on-app-install', {
      method: 'POST',
    });
    await internal.request('/triggers/on-app-install', { method: 'POST' });
    expect(first.status).toBe(200);
    expect(h.posts).toHaveLength(1);
    expect(h.texts).toHaveLength(1);
    expect(h.texts[0]?.title).toMatch(/How to play Running Man/);
    expect(h.texts[0]?.text).toMatch(/6 km stage/);
    expect(h.pins).toContainEqual({ postId: 't3_text1', slot: 2 });
    expect(await h.deps.store.get(keys.welcomePost())).toBe('t3_text1');
    expect(h.texts[0]?.text).toMatch(
      /^## ▶️ \[Play today’s stage\]\(https:\/\/reddit\.com\/post1\)/
    );
    expect(h.edits).toHaveLength(0);
  });

  it('counts days from a subreddit’s first stage, even one posted before the count existed', async () => {
    const h = makeHarness();
    // Stage posts from before the first-day key was stored.
    await h.deps.store.set(keys.dayPost('2026-11-13'), 't3_old13');
    await h.deps.store.set(keys.dayPost('2026-11-14'), 't3_old14');
    h.at('2026-11-15');
    const internal = createInternal(h.deps, (id) => `https://reddit.com/${id}`);
    await internal.request('/scheduler/daily-stage', { method: 'POST' });
    expect(h.posts[0]?.title).toMatch(/^.*Day 3 · .* Tokyo 7\/7/);
    expect(await h.deps.store.get(keys.firstDay())).toBe('2026-11-13');
  });

  it('sets up the stage and the guide link on upgrade', async () => {
    const h = makeHarness();
    const internal = createInternal(h.deps, (id) => `https://reddit.com/${id}`);
    await internal.request('/triggers/on-app-install', { method: 'POST' });
    h.at('2026-11-13');
    const res = await internal.request('/triggers/on-app-upgrade', {
      method: 'POST',
    });
    expect(res.status).toBe(200);
    expect(h.posts).toHaveLength(2);
    expect(h.texts).toHaveLength(1);
    expect(h.edits).toHaveLength(1);
    expect(h.edits[0]?.text).toMatch(/\(https:\/\/reddit\.com\/post2\)/);
  });

  it('points the guide at each new day’s stage, once per post', async () => {
    const h = makeHarness();
    const internal = createInternal(h.deps, (id) => `https://reddit.com/${id}`);
    await internal.request('/triggers/on-app-install', { method: 'POST' });
    h.at('2026-11-13');
    await internal.request('/scheduler/daily-stage', { method: 'POST' });
    await internal.request('/menu/post-today', { method: 'POST' });
    expect(h.edits).toHaveLength(1);
    expect(h.edits[0]?.postId).toBe('t3_text1');
    expect(h.edits[0]?.text).toMatch(/\(https:\/\/reddit\.com\/post2\)/);
    expect(h.edits[0]?.text).toMatch(/Day \d+ · /);
    expect(h.edits[0]?.text).toMatch(/Pet Fetch/);
  });

  it('still creates the stage when pinning fails', async () => {
    const h = makeHarness();
    h.deps.pin = async () => {
      throw new Error('no mod rights');
    };
    const internal = createInternal(h.deps, (id) => `https://reddit.com/${id}`);
    const res = await internal.request('/triggers/on-app-install', {
      method: 'POST',
    });
    expect(res.status).toBe(200);
    expect(h.posts).toHaveLength(1);
    expect(h.texts).toHaveLength(1);
  });
});
