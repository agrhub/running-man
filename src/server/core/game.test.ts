import { beforeEach, describe, expect, it } from 'vitest';
import { addDays, dayInfo } from '../../shared/content';
import { defaultPlan, type Plan } from '../../shared/sim';
import type {
  InitResponse,
  ProfileResponse,
  RunResponse,
  ShareResponse,
} from '../../shared/api';
import { createApi } from '../routes/api';
import { createInternal } from '../routes/internal';
import { noTelemetry, type Deps, type NewPost } from './deps';
import { createMemoryStore } from './store';
import { keys } from './keys';

type Harness = {
  deps: Deps;
  as(user: string | undefined): Harness;
  at(dateKey: string): Harness;
  on(postId: string | undefined): Harness;
  posts: NewPost[];
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
    expect(fast.json.profile.badges).toBe(fast.json.run.reward.total);
    expect(h.events).toContain('end:j:true');

    const again = await call(h.as('alice'), 'POST', '/run', {
      plan: planFor(date),
    });
    expect(again.status).toBe(409);
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

  it('shows ghosts of other runners but not yourself', async () => {
    const date = '2026-11-12';
    for (const u of ['bob', 'cara', 'alice'])
      await call(h.as(u), 'POST', '/run', { plan: planFor(date) });
    const init = await call<InitResponse>(h.as('alice'), 'GET', '/init');
    expect(init.json.ghosts.map((g) => g.username).sort()).toEqual([
      'bob',
      'cara',
    ]);
    expect(init.json.ghosts[0]?.marks).toHaveLength(7);
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

  it('sells items for badges and equips them', async () => {
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
    expect(h.posts[0]?.title).toMatch(/^Day 4 · .* Tokyo 4\/7: Meiji Forest/);

    h.on('t3_post1').at('2026-11-13');
    await internal.request('/scheduler/daily-stage', { method: 'POST' });
    const old = await call<InitResponse>(h, 'GET', '/init');
    expect(old.json.dateKey).toBe('2026-11-12');
    expect(old.json.todayPostId).toBe('t3_post2');
    const closed = await call(h, 'POST', '/run', {
      plan: planFor('2026-11-12'),
    });
    expect(closed.status).toBe(409);
  });
});
