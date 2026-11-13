/**
 * Local harness: serves the built client and the real game API with an
 * in-memory Redis, so the whole game can be played and tested without Reddit.
 *
 *   npm run dev:local            then open http://localhost:5178/splash.html
 *
 * Query params pick who you are and when it is (they are kept as cookies):
 *   ?user=alice     play as u/alice (empty: logged-out guest)
 *   ?post=t3_dev2   open a specific day's post
 *   ?date=2026-11-12  pretend today is this UTC date
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { CITIES, addDays, dayInfo, toDateKey } from '../shared/content';
import { ITEMS, PETS } from '../shared/economy';
import { mulberry32 } from '../shared/rng';
import { PACES, type Plan } from '../shared/sim';
import type { Lane } from '../shared/course';
import { QUICK_CHAT, type Chat } from '../shared/chat';
import type { Move } from '../shared/race';
import { noTelemetry, type Deps, type NewPost } from '../server/core/deps';
import { ensureDailyPost, loadProfile, run } from '../server/core/game';
import { keys } from '../server/core/keys';
import { createMemoryStore } from '../server/core/store';
import { createApi } from '../server/routes/api';
import { createInternal } from '../server/routes/internal';

type RequestState = {
  user: string | undefined;
  post: string | undefined;
  date: string;
};

const PORT = Number(process.env.PORT ?? 5178);
const clientDir = fileURLToPath(
  new URL('../../dist-harness/client', import.meta.url)
);
const als = new AsyncLocalStorage<RequestState>();
const store = createMemoryStore();
const posts: (NewPost & { id: string })[] = [];
const comments: { postId: string; text: string; user: string | undefined }[] =
  [];
const flairs: Record<string, string> = {};
const journeyLog: string[] = [];

const state = (): RequestState =>
  als.getStore() ?? {
    user: undefined,
    post: undefined,
    date: toDateKey(new Date()),
  };

const deps: Deps = {
  store,
  now: () => new Date(`${state().date}T09:00:00Z`),
  username: async () => state().user,
  postId: () => state().post,
  createPost: async (post) => {
    const id = `t3_dev${posts.length + 1}`;
    posts.push({ ...post, id });
    return id;
  },
  comment: async (postId, text) => {
    comments.push({ postId, text, user: state().user });
    return true;
  },
  setFlair: async (username, text) => {
    flairs[username] = text;
  },
  telemetry: {
    ...noTelemetry,
    start: async () => {
      journeyLog.push('start');
      return `dev-journey-${journeyLog.length}`;
    },
    progress: async (id, p, action) => {
      journeyLog.push(`progress ${id} ${p} ${action}`);
    },
    interaction: async (id, action) => {
      journeyLog.push(`interaction ${id} ${action}`);
    },
    end: async (id, game) => {
      journeyLog.push(`end ${id} win=${game.win} score=${game.score}`);
    },
  },
};

const FAKE_RUNNERS = [
  'sakura_strider',
  'pace_pigeon',
  'hill_hater',
  'croissant_cadence',
  'pho_fast',
  'lantern_legs',
  'metro_miler',
  'sunday_shuffler',
  'corgi_coach',
  'banh_mi_bolt',
  'seine_sprinter',
  'ramen_runner',
  'tempo_turtle',
  'bridge_bounder',
  'neon_knees',
  'gelato_gait',
  'slow_and_steady',
  'kilometre_kat',
];

const asUser = <T>(
  user: string,
  date: string,
  post: string | undefined,
  fn: () => Promise<T>
) => als.run({ user, post, date }, fn);

/** Fills the last few days with runs from fake players so the leaderboard and the road are busy. */
const seed = async (today: string, days: number, perDay: number) => {
  const rand = mulberry32(42);
  for (let d = days; d >= 0; d--) {
    const date = addDays(today, -d);
    const postId = await asUser('mod', date, undefined, () =>
      ensureDailyPost(deps, date)
    );
    const info = dayInfo(date);
    const count = d === 0 ? Math.floor(perDay * 0.6) : perDay;
    for (let i = 0; i < count; i++) {
      const user =
        FAKE_RUNNERS[(i + d * 3) % FAKE_RUNNERS.length] ?? `runner${i}`;
      if (await store.get(keys.run(date, user))) continue;
      // Give fake players varied outfits so runners look different.
      const profile = await loadProfile(store, user);
      const tops = ITEMS.filter(
        (it) => it.slot === 'top' && it.unlock.kind === 'free'
      );
      const hats = ITEMS.filter((it) => it.slot === 'hat');
      profile.look = {
        ...profile.look,
        top: tops[Math.floor(rand() * tops.length)]?.id ?? profile.look.top,
        hat:
          rand() < 0.4
            ? (hats[Math.floor(rand() * hats.length)]?.id ?? 'no-hat')
            : 'no-hat',
        pet: PETS[Math.floor(rand() * PETS.length)]?.id ?? 'corgi',
      };
      await store.set(keys.user(user), JSON.stringify(profile));
      const plan: Plan = {
        paces: info.stage.grades.map(
          () => PACES[Math.floor(rand() * 3)] ?? 'steady'
        ),
        drinks: info.stage.waterAfterKm.filter(() => rand() < 0.8),
      };
      // Fake runners pick a lane and change it now and then, like real players.
      const moves: Move[] = [];
      let step = Math.floor(rand() * 20);
      let lane: Lane = 0;
      while (step < 4000) {
        const next: Lane = rand() < 0.34 ? -1 : rand() < 0.5 ? 0 : 1;
        if (next !== lane) {
          moves.push({ step, lane: next });
          lane = next;
        }
        step += 40 + Math.floor(rand() * 160);
      }
      // ...and say a few quick-chat lines on the way.
      const chat: Chat[] = [];
      for (
        let c = 0, at = 60 + Math.floor(rand() * 80);
        c < 3 && at < 3200;
        c++
      ) {
        chat.push({ step: at, line: Math.floor(rand() * QUICK_CHAT.length) });
        at += 240 + Math.floor(rand() * 600);
      }
      await asUser(user, date, postId, () =>
        run(deps, plan, null, moves, [], chat)
      );
    }
  }
};

const app = new Hono();

app.use('*', async (c, next) => {
  const q = (name: string) => c.req.query(name);
  for (const name of ['user', 'post', 'date'] as const) {
    const v = q(name);
    if (v !== undefined) setCookie(c, `dev_${name}`, v, { path: '/' });
  }
  const pick = (name: string) => q(name) ?? getCookie(c, `dev_${name}`);
  const date = pick('date');
  const user = pick('user');
  const post = pick('post');
  const today =
    date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : toDateKey(new Date());
  const todayPost = await store.get(keys.dayPost(today));
  await als.run(
    {
      user: user === '' ? undefined : (user ?? 'you'),
      post: post || todayPost || undefined,
      date: today,
    },
    next
  );
});

app.route('/api', createApi(deps));
app.route(
  '/internal',
  createInternal(deps, (id) => `/game.html?post=${id}`)
);

app.get('/__dev/state', (c) =>
  c.json({
    request: state(),
    posts,
    comments,
    flairs,
    journeyLog: journeyLog.slice(-30),
  })
);
app.post('/__dev/seed', async (c) => {
  await seed(
    state().date,
    Number(c.req.query('days') ?? 3),
    Number(c.req.query('runners') ?? 14)
  );
  return c.json({ ok: true, posts: posts.length });
});
app.post('/__dev/crew', async (c) => {
  const meters = Number(c.req.query('meters') ?? 40000);
  await store.hSet(keys.crew(dayInfo(state().date).season), {
    meters: String(meters),
  });
  return c.json({ ok: true, meters });
});
app.post('/__dev/badges', async (c) => {
  const user = state().user;
  if (!user) return c.json({ ok: false });
  const profile = await loadProfile(store, user);
  profile.badges += Number(c.req.query('n') ?? 1000);
  await store.set(keys.user(user), JSON.stringify(profile));
  return c.json({ ok: true, badges: profile.badges });
});

app.get('/', (c) => c.redirect('/splash.html'));
app.use(
  '/*',
  serveStatic({ root: clientDir.replace(process.cwd() + '/', '') })
);

const today = toDateKey(new Date());
if (process.env.SEED !== '0') {
  await seed(
    process.env.SEED_DATE ?? today,
    Number(process.env.SEED_DAYS ?? 3),
    14
  );
}

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`Running Man harness on http://localhost:${PORT}/splash.html`);
  console.log(
    `Cities: ${CITIES.map((c) => c.name).join(', ')}. Posts seeded: ${posts.length}.`
  );
});
