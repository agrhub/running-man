import {
  CREW_TARGET_METERS,
  EPOCH,
  FINISHER_STAGES,
  TIMES,
  isTriathlon,
  KM_PER_STAGE,
  addDays,
  dayInfo,
  toDateKey,
  type DayInfo,
} from '../../shared/content';
import {
  NEXT_CITIES,
  emptyCounts,
  isNextCity,
  type CityVote,
} from '../../shared/vote';
import { isPickup } from '../../shared/course';
import {
  WEEKLY,
  dailyQuests,
  questPeriod,
  type QuestId,
  type QuestState,
} from '../../shared/quests';
import {
  DASH_MAX_ROUNDS,
  dashCourse,
  dashReward,
  isValidDashMoves,
  replayDash,
} from '../../shared/dash';
import {
  CLUB_CODE_CHARS,
  CLUB_MAX_MEMBERS,
  clubName,
  isClubCode,
} from '../../shared/club';
import {
  CHECKIN_REWARDS,
  nextCheckInDay,
  CHEER_REWARD,
  HAIR_STYLES,
  HAIR_TONES,
  SKIN_TONES,
  CREW_FINISH_REWARD,
  ITEMS,
  PETS,
  conditionMet,
  defaultLook,
  itemById,
  petById,
  runReward,
  type Item,
  type Pet,
  type PetId,
  type Progress,
} from '../../shared/economy';
import { hashString } from '../../shared/rng';
import {
  achievementById,
  achievementStates,
  newlyEarned,
  type RunnerSummary,
} from '../../shared/achievements';
import {
  holidayMultiplier,
  isHolidaySeason,
  isChristmasRun,
} from '../../shared/festive';
import { QUICK_CHAT, isValidChat } from '../../shared/chat';
import { courseItems } from '../../shared/course';
import {
  MAX_MOVES,
  MAX_RIVALS,
  RACE_DT,
  isValidMoves,
  replayRace,
  startLane,
  type RaceEvent,
} from '../../shared/race';
import {
  PACE_LABEL,
  checkpoints,
  formatTime,
  isValidPlan,
  simulate,
} from '../../shared/sim';
import type {
  CrewProgress,
  DayRecap,
  HistoryRow,
  MeResponse,
  RunnerTrack,
  Incident,
  InitResponse,
  LeaderRow,
  WeeklyBoard,
  WeeklyRow,
  DashBoard,
  FriendRow,
  ClubRow,
  ClubView,
  Profile,
  RunRecord,
  RunResponse,
  SplashResponse,
} from '../../shared/api';
import type { Deps } from './deps';
import { keys } from './keys';
import type { Store } from './store';

export class GameError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 401 | 404 | 409 = 400
  ) {
    super(message);
  }
}

const RUNNER_LIMIT = 12;
const LEADERBOARD_LIMIT = 10;

const parse = <T>(raw: string | undefined | null): T | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

export const freshProfile = (username: string): Profile => ({
  username,
  registered: false,
  bib: null,
  badges: 0,
  streak: 0,
  bestStreak: 0,
  lastRunDate: null,
  owned: ITEMS.filter((i) => i.unlock.kind === 'free').map((i) => i.id),
  ownedPets: PETS.filter((p) => p.unlock.kind === 'free').map((p) => p.id),
  look: defaultLook(hashString(username)),
  petAffinity: 0,
  petCaredOn: null,
  finishedCities: [],
  finisher: false,
  stagesBySeason: {},
  claimedSeasons: [],
  weathersRun: [],
  top10: false,
  holidayRun: false,
  cheeredOn: null,
  totalRuns: 0,
  checkInDate: null,
  checkInDay: 0,
  questClaims: {},
  dash: { date: null, plays: 0, best: 0 },
  friends: [],
  club: null,
  stats: {
    fives: 0,
    snacks: 0,
    crashes: 0,
    chats: 0,
    bestRank: null,
    dashBest: 0,
  },
  achievements: [],
});

export const loadProfile = async (
  store: Store,
  username: string
): Promise<Profile> => {
  const saved = parse<Partial<Profile>>(await store.get(keys.user(username)));
  const fresh = freshProfile(username);
  // Merge the look too, so slots added later (pet gear) get their default.
  return {
    ...fresh,
    ...saved,
    look: { ...fresh.look, ...saved?.look },
    stats: { ...fresh.stats, ...saved?.stats },
    username,
  };
};

const saveProfile = (store: Store, profile: Profile) =>
  store.set(keys.user(profile.username), JSON.stringify(profile));

const progressOf = (p: Profile): Progress => ({
  badges: p.badges,
  bestStreak: p.bestStreak,
  finishedCities: p.finishedCities,
  finisher: p.finisher,
  weathersRun: p.weathersRun,
  top10: p.top10,
  holidayRun: p.holidayRun,
});

/**
 * Grants every non-purchase item and pet whose condition is now met.
 * Returns the ids that were newly granted.
 */
export const grantEarnedUnlocks = (profile: Profile): string[] => {
  const progress = progressOf(profile);
  const granted: string[] = [];
  for (const item of ITEMS) {
    if (item.unlock.kind === 'badges' || profile.owned.includes(item.id))
      continue;
    if (conditionMet(item.unlock, progress)) {
      profile.owned.push(item.id);
      granted.push(item.id);
    }
  }
  for (const pet of PETS) {
    if (pet.unlock.kind === 'badges' || profile.ownedPets.includes(pet.id))
      continue;
    if (conditionMet(pet.unlock, progress)) {
      profile.ownedPets.push(pet.id);
      granted.push(pet.id);
    }
  }
  return granted;
};

/** Hands out the next bib number. Bibs are never reused. */
const ensureBib = async (store: Store, profile: Profile): Promise<boolean> => {
  if (profile.bib !== null) return false;
  profile.bib = await store.incrBy(keys.bibs(), 1);
  return true;
};

/** Creates (or updates) the player's runner and gives them a bib. */
export const register = async (
  deps: Deps,
  input: { skin?: unknown; hair?: unknown; hairStyle?: unknown; top?: unknown }
): Promise<Profile> => {
  const username = await requireUser(deps);
  const int = (v: unknown, max: number) =>
    typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < max
      ? v
      : null;
  const skin = int(input.skin, SKIN_TONES.length);
  const hair = int(input.hair, HAIR_TONES.length);
  const hairStyle = int(input.hairStyle, HAIR_STYLES.length);
  if (skin === null || hair === null || hairStyle === null)
    throw new GameError('Pick a skin tone, hair style and hair colour.');
  const profile = await loadProfile(deps.store, username);
  const top = typeof input.top === 'string' ? itemById(input.top) : undefined;
  if (!top || top.slot !== 'top' || !profile.owned.includes(top.id))
    throw new GameError('Pick one of your shirts.');
  profile.look = { ...profile.look, skin, hair, hairStyle, top: top.id };
  profile.registered = true;
  await ensureBib(deps.store, profile);
  await saveProfile(deps.store, profile);
  return profile;
};

export const crewProgress = async (
  store: Store,
  day: DayInfo
): Promise<CrewProgress> => {
  const raw = await store.hGetAll(keys.crew(day.season));
  const meters = Number(raw.meters ?? '0');
  return {
    season: day.season,
    cityId: day.city.id,
    meters,
    target: CREW_TARGET_METERS,
    finished: meters >= CREW_TARGET_METERS,
  };
};

/** Pays the crew-finish reward once per season to everyone who ran in it. */
const claimCrewRewards = async (
  store: Store,
  profile: Profile
): Promise<number> => {
  let paid = 0;
  for (const [seasonKey, stages] of Object.entries(profile.stagesBySeason)) {
    const season = Number(seasonKey);
    if (stages <= 0 || profile.claimedSeasons.includes(season)) continue;
    const meters = Number(
      (await store.hGet(keys.crew(season), 'meters')) ?? '0'
    );
    if (meters < CREW_TARGET_METERS) continue;
    profile.claimedSeasons.push(season);
    profile.badges += CREW_FINISH_REWARD;
    paid += CREW_FINISH_REWARD;
    const day = dayInfo(addDays(EPOCH, season * 7));
    if (!profile.finishedCities.includes(day.city.id))
      profile.finishedCities.push(day.city.id);
  }
  return paid;
};

export const leaderboard = async (
  store: Store,
  dateKey: string
): Promise<LeaderRow[]> => {
  const rows = await store.zRange(
    keys.leaderboard(dateKey),
    0,
    LEADERBOARD_LIMIT - 1,
    { by: 'rank' }
  );
  return rows.map((r, i) => ({
    rank: i + 1,
    username: r.member,
    seconds: r.score,
  }));
};

/** The runners on your road: your friends who ran today first, then the day's leaders. */
const runnersOnRoad = async (
  store: Store,
  dateKey: string,
  self: string | null,
  first: string[] = []
): Promise<RunnerTrack[]> => {
  const rows = await store.zRange(keys.leaderboard(dateKey), 0, RUNNER_LIMIT, {
    by: 'rank',
  });
  const ranFirst = (
    await Promise.all(
      first.map(async (n) =>
        (await store.zScore(keys.leaderboard(dateKey), n)) === undefined
          ? null
          : n
      )
    )
  ).filter((n): n is string => n !== null);
  const names = [...new Set([...ranFirst, ...rows.map((r) => r.member)])]
    .filter((m) => m !== self)
    .slice(0, RUNNER_LIMIT);
  if (names.length === 0) return [];
  const raw = await store.hMGet(keys.tracks(dateKey), names);
  return raw
    .map((r) => parse<RunnerTrack>(r))
    .filter((g): g is RunnerTrack => g !== null);
};

const myRank = async (
  store: Store,
  dateKey: string,
  username: string | null
) => {
  if (!username) return null;
  const rank = await store.zRank(keys.leaderboard(dateKey), username);
  return rank === undefined ? null : rank + 1;
};

export const postDateKey = async (deps: Deps): Promise<string> => {
  const today = toDateKey(deps.now());
  const postId = deps.postId();
  if (!postId) return today;
  return (await deps.store.get(keys.postDate(postId))) ?? today;
};

const requireUser = async (deps: Deps): Promise<string> => {
  const username = await deps.username();
  if (!username) throw new GameError('Log in to Reddit to run.', 401);
  return username;
};

export const init = async (deps: Deps): Promise<InitResponse> => {
  const { store } = deps;
  const today = toDateKey(deps.now());
  const dateKey = await postDateKey(deps);
  const day = dayInfo(dateKey);
  const username = (await deps.username()) ?? null;

  let profile = freshProfile(username ?? 'guest');
  if (username) {
    profile = await loadProfile(store, username);
    const paid = await claimCrewRewards(store, profile);
    const granted = grantEarnedUnlocks(profile);
    // Runners from before registration existed keep their look and get a bib.
    let migrated = false;
    if (!profile.registered && profile.totalRuns > 0) {
      profile.registered = true;
      migrated = await ensureBib(store, profile);
    }
    if (paid > 0 || granted.length > 0 || migrated)
      await saveProfile(store, profile);
  }

  const [
    myRun,
    board,
    rank,
    total,
    runnerTracks,
    crew,
    cheers,
    todayPostId,
    vote,
    weekly,
    quests,
    friends,
    club,
    journeyId,
  ] = await Promise.all([
    username
      ? store.get(keys.run(dateKey, username)).then((r) => parse<RunRecord>(r))
      : null,
    leaderboard(store, dateKey),
    myRank(store, dateKey, username),
    store.zCard(keys.leaderboard(dateKey)),
    runnersOnRoad(store, dateKey, username, [
      ...profile.friends,
      ...((await loadClub(store, profile.club))?.members ?? []),
    ]),
    crewProgress(store, day),
    username ? store.hGet(keys.cheers(dateKey), username) : undefined,
    dateKey === today
      ? null
      : store.get(keys.dayPost(today)).then((p) => p ?? null),
    cityVote(store, dayInfo(today).season, username),
    weeklyBoard(store, day.season, username),
    questStates(store, profile, today),
    friendRows(store, profile.friends, today),
    clubView(store, profile.club, today),
    deps.telemetry.start().catch(() => null),
  ]);
  const before = await dayRecap(store, addDays(dateKey, -1));

  return {
    type: 'init',
    dateKey,
    today,
    todayPostId,
    profile,
    myRun,
    leaderboard: board,
    myRank: rank,
    totalRunners: total,
    runners: runnerTracks,
    crew,
    cheersReceived: Number(cheers ?? '0'),
    vote,
    weekly,
    quests,
    friends,
    club,
    yesterday: before.runners > 0 ? before : null,
    journeyId,
  };
};

export const splash = async (deps: Deps): Promise<SplashResponse> => {
  const { store } = deps;
  const today = toDateKey(deps.now());
  const dateKey = await postDateKey(deps);
  const username = (await deps.username()) ?? null;
  const [crew, total, ran, profile] = await Promise.all([
    crewProgress(store, dayInfo(dateKey)),
    store.zCard(keys.leaderboard(dateKey)),
    username ? store.zScore(keys.leaderboard(dateKey), username) : undefined,
    username ? loadProfile(store, username) : null,
  ]);
  const streakAlive =
    profile?.lastRunDate === today ||
    profile?.lastRunDate === addDays(today, -1);
  return {
    type: 'splash',
    dateKey,
    today,
    crew,
    totalRunners: total,
    ran: ran !== undefined,
    streak: streakAlive ? (profile?.streak ?? 0) : 0,
    username: username ?? '',
  };
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Records a collision on a runner who already finished: their time, replay, splits and leaderboard place change,
 * and their result card lists the incident.
 */
type WeekEntry = { stages: number; seconds: number };

/** Lower is better: more stages first, then less total time. */
const weekScore = (e: WeekEntry) => (10 - e.stages) * 1_000_000 + e.seconds;

const addToWeek = async (
  store: Store,
  season: number,
  username: string,
  stages: number,
  seconds: number
) => {
  const prev = parse<WeekEntry>(
    await store.hGet(keys.week(season), username)
  ) ?? { stages: 0, seconds: 0 };
  const next = {
    stages: prev.stages + stages,
    seconds: round1(prev.seconds + seconds),
  };
  await Promise.all([
    store.hSet(keys.week(season), { [username]: JSON.stringify(next) }),
    store.zAdd(keys.weekBoard(season), {
      member: username,
      score: weekScore(next),
    }),
  ]);
};

export const weeklyBoard = async (
  store: Store,
  season: number,
  username: string | null
): Promise<WeeklyBoard> => {
  const top = await store.zRange(keys.weekBoard(season), 0, 9, {
    by: 'rank',
  });
  const names = top.map((t) => t.member);
  const myIndex =
    username && !names.includes(username)
      ? await store.zRank(keys.weekBoard(season), username)
      : undefined;
  const fields =
    myIndex !== undefined && username ? [...names, username] : names;
  const raw =
    fields.length > 0 ? await store.hMGet(keys.week(season), fields) : [];
  const row = (name: string, rank: number, i: number): WeeklyRow => {
    const e = parse<WeekEntry>(raw[i] ?? undefined) ?? {
      stages: 0,
      seconds: 0,
    };
    return { rank, username: name, stages: e.stages, seconds: e.seconds };
  };
  const rows = names.map((n, i) => row(n, i + 1, i));
  const mine =
    rows.find((r) => r.username === username) ??
    (myIndex !== undefined && username
      ? row(username, myIndex + 1, names.length)
      : null);
  return { season, rows, mine };
};

const applyIncident = async (
  store: Store,
  dateKey: string,
  username: string,
  incident: Incident & { at: number }
) => {
  const [trackRaw, recordRaw] = await Promise.all([
    store.hGet(keys.tracks(dateKey), username),
    store.get(keys.run(dateKey, username)),
  ]);
  const track = parse<RunnerTrack>(trackRaw);
  const record = parse<RunRecord>(recordRaw);
  if (!track || !record) return;
  const add = incident.seconds;
  track.marks = track.marks.map((m) => (m > incident.at ? round1(m + add) : m));
  track.seconds = round1(track.seconds + add);
  record.seconds = track.seconds;
  const kmIndex = Math.min(record.splits.length - 1, Math.floor(incident.km));
  record.splits = record.splits.map((sp, i) =>
    i === kmIndex ? { ...sp, seconds: round1(sp.seconds + add) } : sp
  );
  const { at: _at, ...rest } = incident;
  record.incidents = [...(record.incidents ?? []), rest];
  await Promise.all([
    store.hSet(keys.tracks(dateKey), { [username]: JSON.stringify(track) }),
    store.set(keys.run(dateKey, username), JSON.stringify(record)),
    store.zAdd(keys.leaderboard(dateKey), {
      member: username,
      score: track.seconds,
    }),
    addToWeek(store, dayInfo(dateKey).season, username, 0, add),
  ]);
  const past = parse<Omit<HistoryRow, 'dateKey'>>(
    await store.hGet(keys.history(username), dateKey)
  );
  if (past)
    await store.hSet(keys.history(username), {
      [dateKey]: JSON.stringify({ ...past, seconds: track.seconds }),
    });
  const victim = await loadProfile(store, username);
  victim.stats.crashes += 1;
  await saveProfile(store, victim);
};

const readHistory = async (
  store: Store,
  username: string
): Promise<HistoryRow[]> => {
  const raw = await store.hGetAll(keys.history(username));
  return Object.entries(raw)
    .map(([dateKey, v]) => {
      const row = parse<Omit<HistoryRow, 'dateKey'>>(v);
      return row ? { dateKey, ...row } : null;
    })
    .filter((r): r is HistoryRow => r !== null)
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
};

export const summaryOf = (
  profile: Profile,
  history: HistoryRow[]
): RunnerSummary => ({
  runs: history.length,
  km: history.length * KM_PER_STAGE,
  bestStreak: profile.bestStreak,
  cities: [...new Set(history.map((h) => dayInfo(h.dateKey).city.id))],
  fives: profile.stats.fives,
  snacks: profile.stats.snacks,
  crashes: profile.stats.crashes,
  chats: profile.stats.chats,
  bestRank: profile.stats.bestRank,
  finisher: profile.finisher,
  inClub: profile.club !== null,
  friends: profile.friends.length,
  holidayRun: profile.holidayRun,
  dashBest: profile.stats.dashBest,
});

/** Pays every newly completed achievement once. Returns the new ids. */
const grantAchievements = (
  profile: Profile,
  history: HistoryRow[]
): string[] => {
  const fresh = newlyEarned(summaryOf(profile, history), profile.achievements);
  for (const id of fresh) {
    profile.achievements.push(id);
    profile.badges += achievementById(id)?.reward ?? 0;
  }
  return fresh;
};

/** The profile page: history, achievements, and any achievement earned since last time. */
export const me = async (deps: Deps): Promise<MeResponse> => {
  const username = await requireUser(deps);
  const profile = await loadProfile(deps.store, username);
  const history = await readHistory(deps.store, username);
  const earned = grantAchievements(profile, history);
  if (earned.length) await saveProfile(deps.store, profile);
  return {
    type: 'me',
    profile,
    history,
    achievements: achievementStates(
      summaryOf(profile, history),
      profile.achievements
    ),
    earned,
  };
};

/** Counts what happened on the road today, for the recap posted after the stage closes. */
const recordDayStats = async (
  store: Store,
  dateKey: string,
  username: string,
  events: RaceEvent[],
  chat: { line: number }[]
) => {
  const key = keys.dayStats(dateKey);
  const add: Record<string, number> = {};
  const bump = (field: string) => (add[field] = (add[field] ?? 0) + 1);
  for (const e of events) {
    if (e.kind === 'bump') {
      bump('bumps');
      bump(`crash:${username}`);
      bump(`crash:${e.rival}`);
    } else if (e.kind === 'fan') bump('fives');
    else if (isPickup(e.kind)) bump('snacks');
    else bump('hits');
  }
  for (const c of chat) bump(`chat:${c.line}`);
  for (const [field, n] of Object.entries(add))
    await store.hIncrBy(key, field, n);
};

export const dayRecap = async (
  store: Store,
  dateKey: string
): Promise<DayRecap> => {
  const day = dayInfo(dateKey);
  const [runners, top, stats, crew] = await Promise.all([
    store.zCard(keys.leaderboard(dateKey)),
    store.zRange(keys.leaderboard(dateKey), 0, 2, { by: 'rank' }),
    store.hGetAll(keys.dayStats(dateKey)),
    crewProgress(store, day),
  ]);
  const best = (prefix: string) => {
    let found: [string, number] | null = null;
    for (const [field, raw] of Object.entries(stats)) {
      if (!field.startsWith(prefix)) continue;
      const n = Number(raw);
      const name = field.slice(prefix.length);
      if (!found || n > found[1] || (n === found[1] && name < found[0]))
        found = [name, n];
    }
    return found;
  };
  const crash = best('crash:');
  const line = best('chat:');
  const lineText = line ? QUICK_CHAT[Number(line[0])] : undefined;
  return {
    dateKey,
    runners,
    podium: top.map((r) => ({ username: r.member, seconds: r.score })),
    bumps: Number(stats.bumps ?? 0),
    snacks: Number(stats.snacks ?? 0),
    fives: Number(stats.fives ?? 0),
    crashKing: crash ? { username: crash[0], crashes: crash[1] } : null,
    topLine: line && lineText ? { line: lineText, times: line[1] } : null,
    crew,
  };
};

const MEDALS = ['🥇', '🥈', '🥉'];

export const recapText = (r: DayRecap): string => {
  const day = dayInfo(r.dateKey);
  const next = dayInfo(addDays(r.dateKey, 1));
  const lines = [
    `**Race recap: ${day.city.flag} ${day.city.name} ${day.stageIndex + 1}/7, ${day.stage.name}** 🏁`,
    '',
    r.podium
      .map(
        (p, i) => `${MEDALS[i] ?? ''} u/${p.username} ${formatTime(p.seconds)}`
      )
      .join(' · '),
    '',
    `**${r.runners}** ${r.runners === 1 ? 'runner' : 'runners'} covered **${r.runners * KM_PER_STAGE} km** together.`,
  ];
  const road = [
    r.snacks > 0 ? `🍰 ${r.snacks} snacks grabbed` : '',
    r.fives > 0 ? `🙌 ${r.fives} high fives` : '',
    r.bumps > 0 ? `💥 ${r.bumps} ${r.bumps === 1 ? 'crash' : 'crashes'}` : '',
  ].filter(Boolean);
  if (road.length) lines.push('', road.join(' · '));
  if (r.crashKing && r.crashKing.crashes > 1)
    lines.push(
      '',
      `Most crashes: u/${r.crashKing.username} (${r.crashKing.crashes}). Watch your elbows out there.`
    );
  if (r.topLine)
    lines.push(
      '',
      `Most shouted: "${r.topLine.line}" (${r.topLine.times} ${r.topLine.times === 1 ? 'time' : 'times'})`
    );
  const km = Math.floor(r.crew.meters / 1000);
  const target = Math.round(r.crew.target / 1000);
  lines.push(
    '',
    r.crew.finished
      ? `Crew goal: ${day.city.name} is finished! 🎉`
      : `Crew goal: ${km} / ${target} km in ${day.city.name}.`,
    '',
    `Next up: ${next.city.flag} ${next.city.name} ${next.stageIndex + 1}/7, ${next.stage.name}. The new post is pinned at the top. See you at the start line!`
  );
  return lines.join('\n');
};

/** Posts the recap of a closed day under that day's post, once. */
export const postRecap = async (
  deps: Deps,
  dateKey: string
): Promise<boolean> => {
  if (!deps.appComment) return false;
  if (await deps.store.get(keys.recap(dateKey))) return false;
  const postId = await deps.store.get(keys.dayPost(dateKey));
  if (!postId) return false;
  const recap = await dayRecap(deps.store, dateKey);
  if (recap.runners === 0) return false;
  const id = await deps.appComment(postId, recapText(recap));
  await deps.store.set(keys.recap(dateKey), id);
  return true;
};

export const run = async (
  deps: Deps,
  planInput: unknown,
  journeyId: string | null,
  movesInput: unknown = [],
  rivalsInput: unknown = [],
  chatInput: unknown = []
): Promise<RunResponse> => {
  const { store } = deps;
  const username = await requireUser(deps);
  const today = toDateKey(deps.now());
  const dateKey = await postDateKey(deps);
  if (dateKey !== today)
    throw new GameError(
      'This stage has closed. Today’s stage is waiting!',
      409
    );

  const day = dayInfo(dateKey);
  if (!isValidPlan(day.stage, planInput))
    throw new GameError('That race plan is not valid.');
  const plan = planInput;
  if (!isValidMoves(movesInput))
    throw new GameError('That run could not be checked.');
  const moves = movesInput;
  if (!isValidChat(chatInput))
    throw new GameError('That chat could not be saved.');
  const chat = chatInput;

  if (await store.get(keys.run(dateKey, username))) {
    throw new GameError(
      'You already ran today’s stage. Come back tomorrow!',
      409
    );
  }

  if (journeyId)
    await deps.telemetry
      .progress(journeyId, 0.5, 'plan_submitted')
      .catch(() => undefined);

  // The runners this player raced with: the same ones the client was shown, read back from Redis.
  const rivalNames = Array.isArray(rivalsInput)
    ? rivalsInput
        .filter((n): n is string => typeof n === 'string' && n !== username)
        .slice(0, MAX_RIVALS)
    : [];
  const rivalRuns = rivalNames.length
    ? (await store.hMGet(keys.tracks(dateKey), rivalNames))
        .map((r) => parse<RunnerTrack>(r))
        .filter((g): g is RunnerTrack => g !== null)
    : [];

  // The server replays the whole race: pace plan, lane changes, the day's course and every collision.
  // Nobody can post a time they did not run.
  const sim = simulate(
    day.stage,
    day.weather.id,
    plan,
    day.time,
    isTriathlon(day)
  );
  const race = replayRace(
    {
      base: checkpoints(sim.splits),
      items: courseItems(dateKey, day.stage, day.weather.id, {
        city: day.city.id,
        time: day.time,
        triathlon: isTriathlon(day),
      }),
      rivals: rivalRuns,
      startLane: startLane(username),
    },
    moves
  );
  const result = {
    totalSeconds: race.finalSeconds,
    splits: sim.splits.map((sp, i) => ({
      ...sp,
      seconds: round1((race.marks[i + 1] ?? 0) - (race.marks[i] ?? 0)),
    })),
  };
  const itemEvents = race.events.filter((e) => e.kind !== 'bump');
  const bumps: Incident[] = race.events.flatMap((e) =>
    e.kind === 'bump'
      ? [{ with: e.rival, km: e.km, seconds: e.seconds, atFault: e.atFault }]
      : []
  );
  const profile = await loadProfile(store, username);
  // Anyone who races without the registration screen still gets a bib.
  if (!profile.registered) profile.registered = true;
  await ensureBib(store, profile);

  // A collision is real: the other runner's official time changes too.
  for (const e of race.events) {
    if (e.kind !== 'bump') continue;
    await applyIncident(store, dateKey, e.rival, {
      with: username,
      km: e.km,
      seconds: e.rivalSeconds,
      atFault: !e.atFault,
      at: e.step * RACE_DT,
    });
  }

  await store.zAdd(keys.leaderboard(dateKey), {
    member: username,
    score: result.totalSeconds,
  });
  await recordDayStats(store, dateKey, username, race.events, chat);
  await addToWeek(store, day.season, username, 1, result.totalSeconds);
  const track: RunnerTrack = {
    username,
    look: profile.look,
    bib: profile.bib,
    marks: race.marks,
    seconds: result.totalSeconds,
    moves: moves.slice(0, MAX_MOVES),
    chat,
  };
  await store.hSet(keys.tracks(dateKey), { [username]: JSON.stringify(track) });

  const [rankIndex, total] = await Promise.all([
    store.zRank(keys.leaderboard(dateKey), username),
    store.zCard(keys.leaderboard(dateKey)),
  ]);
  const rank = (rankIndex ?? 0) + 1;
  const percentile = total > 0 ? (rank - 1) / total : 0;

  profile.streak =
    profile.lastRunDate === addDays(today, -1) ? profile.streak + 1 : 1;
  profile.bestStreak = Math.max(profile.bestStreak, profile.streak);
  profile.lastRunDate = today;
  profile.totalRuns += 1;
  if (!profile.weathersRun.includes(day.weather.id))
    profile.weathersRun.push(day.weather.id);
  if (percentile < 0.1) profile.top10 = true;
  for (const e of race.events) {
    if (e.kind === 'bump') profile.stats.crashes += 1;
    else if (e.kind === 'fan') profile.stats.fives += 1;
    else if (isPickup(e.kind)) profile.stats.snacks += 1;
  }
  profile.stats.chats += chat.length;
  profile.stats.bestRank =
    profile.stats.bestRank === null
      ? rank
      : Math.min(profile.stats.bestRank, rank);
  await store.hSet(keys.history(username), {
    [dateKey]: JSON.stringify({
      seconds: result.totalSeconds,
      rank,
      runners: total,
    }),
  });
  if (isHolidaySeason(today)) profile.holidayRun = true;

  const seasonKey = String(day.season);
  profile.stagesBySeason[seasonKey] =
    (profile.stagesBySeason[seasonKey] ?? 0) + 1;
  const finisherNow = profile.stagesBySeason[seasonKey] === FINISHER_STAGES;
  if (finisherNow) profile.finisher = true;

  const before = Number(
    (await store.hGet(keys.crew(day.season), 'meters')) ?? '0'
  );
  const after = await store.hIncrBy(
    keys.crew(day.season),
    'meters',
    KM_PER_STAGE * 1000
  );
  const crewFinishedNow =
    before < CREW_TARGET_METERS && after >= CREW_TARGET_METERS;
  if (crewFinishedNow) {
    await store.hSet(keys.crew(day.season), {
      finishedOn: today,
      finishedBy: username,
    });
  }

  const crewPaid = await claimCrewRewards(store, profile);
  const reward = runReward(percentile, profile.streak, false);
  const holiday = (holidayMultiplier(today) - 1) * reward.total;
  if (holiday > 0) {
    reward.holiday = holiday;
    reward.total += holiday;
  }
  reward.crew = crewPaid;
  reward.total += crewPaid;
  profile.badges += reward.total - crewPaid;

  const unlocked = grantEarnedUnlocks(profile);
  const achieved = grantAchievements(
    profile,
    await readHistory(store, username)
  );

  const record: RunRecord = {
    dateKey,
    seconds: result.totalSeconds,
    plan,
    splits: result.splits,
    moves,
    rivals: rivalRuns.map((r) => r.username),
    chat,
    course: round1(itemEvents.reduce((t, e) => t + e.seconds, 0)),
    met: itemEvents.map((e) => e.kind),
    incidents: bumps,
    rank,
    totalRunners: total,
    reward,
    streak: profile.streak,
    unlocked,
    crewFinishedNow,
    finisherNow,
    shared: false,
    ...(achieved.length ? { achieved } : {}),
  };

  await Promise.all([
    store.set(keys.run(dateKey, username), JSON.stringify(record)),
    saveProfile(store, profile),
  ]);
  // Your stage counts for your club's week too.
  const myClubNow = await loadClub(store, profile.club);
  if (myClubNow) await updateClubWeek(store, myClubNow, today);

  if (finisherNow) {
    await deps
      .setFlair(username, `🏅 ${day.city.name} Finisher`)
      .catch(() => undefined);
  }
  if (journeyId) {
    await deps.telemetry
      .end(journeyId, {
        win: percentile <= 0.5,
        score: Math.max(0, Math.round(3600 - result.totalSeconds)),
      })
      .catch(() => undefined);
  }

  const [board, crew] = await Promise.all([
    leaderboard(store, dateKey),
    crewProgress(store, day),
  ]);
  const weekly = await weeklyBoard(store, day.season, username);
  return {
    type: 'run',
    run: record,
    profile,
    leaderboard: board,
    weekly,
    crew,
  };
};

const findItem = (id: string): Item => {
  const item = itemById(id);
  if (!item) throw new GameError('That item does not exist.', 404);
  return item;
};

const findPet = (id: string): Pet => {
  const pet = petById(id);
  if (!pet) throw new GameError('That pet does not exist.', 404);
  return pet;
};

export const buyItem = async (deps: Deps, itemId: string): Promise<Profile> => {
  const username = await requireUser(deps);
  const item = findItem(itemId);
  const profile = await loadProfile(deps.store, username);
  if (profile.owned.includes(item.id))
    throw new GameError('You already own this.', 409);
  if (item.unlock.kind !== 'badges')
    throw new GameError('This one is earned, not bought.');
  if (profile.badges < item.unlock.cost)
    throw new GameError('Not enough coins yet. Keep running!');
  profile.badges -= item.unlock.cost;
  profile.owned.push(item.id);
  profile.look = { ...profile.look, [item.slot]: item.id };
  await saveProfile(deps.store, profile);
  return profile;
};

export const equipItem = async (
  deps: Deps,
  itemId: string
): Promise<Profile> => {
  const username = await requireUser(deps);
  const item = findItem(itemId);
  const profile = await loadProfile(deps.store, username);
  if (!profile.owned.includes(item.id))
    throw new GameError('Unlock this item first.');
  profile.look = { ...profile.look, [item.slot]: item.id };
  await saveProfile(deps.store, profile);
  return profile;
};

export const choosePet = async (deps: Deps, petId: PetId): Promise<Profile> => {
  const username = await requireUser(deps);
  const pet = findPet(petId);
  const profile = await loadProfile(deps.store, username);
  if (!profile.ownedPets.includes(pet.id)) {
    if (pet.unlock.kind !== 'badges')
      throw new GameError('Unlock this pet first.');
    if (profile.badges < pet.unlock.cost)
      throw new GameError('Not enough coins yet. Keep running!');
    profile.badges -= pet.unlock.cost;
    profile.ownedPets.push(pet.id);
  }
  profile.look = { ...profile.look, pet: pet.id };
  await saveProfile(deps.store, profile);
  return profile;
};

export const carePet = async (
  deps: Deps
): Promise<{ profile: Profile; message: string }> => {
  const username = await requireUser(deps);
  const today = toDateKey(deps.now());
  const profile = await loadProfile(deps.store, username);
  const name = petById(profile.look.pet)?.name ?? 'Your pet';
  if (profile.petCaredOn === today) {
    return { profile, message: `${name} is already happy today.` };
  }
  profile.petCaredOn = today;
  profile.petAffinity += 1;
  await saveProfile(deps.store, profile);
  return {
    profile,
    message: `${name} loved that! Friendship ${profile.petAffinity}.`,
  };
};

export const cheer = async (
  deps: Deps,
  target: string
): Promise<{ profile: Profile; message: string }> => {
  const username = await requireUser(deps);
  const today = toDateKey(deps.now());
  if (target === username) throw new GameError('Cheer for someone else!');
  const profile = await loadProfile(deps.store, username);
  if (profile.cheeredOn === today)
    throw new GameError('You already sent today’s cheer.', 409);
  const ranToday = await deps.store.zScore(keys.leaderboard(today), target);
  if (ranToday === undefined)
    throw new GameError('That runner has not run today’s stage.', 404);
  await deps.store.hIncrBy(keys.cheers(today), target, 1);
  profile.cheeredOn = today;
  profile.badges += CHEER_REWARD;
  await saveProfile(deps.store, profile);
  return {
    profile,
    message: `Cheer sent to u/${target}! +${CHEER_REWARD} coins`,
  };
};

export const cityVote = async (
  store: Deps['store'],
  season: number,
  username: string | null
): Promise<CityVote> => {
  const [raw, mine] = await Promise.all([
    store.hGetAll(keys.votes(season)),
    username ? store.hGet(keys.voters(season), username) : undefined,
  ]);
  const counts = emptyCounts();
  for (const c of NEXT_CITIES) counts[c.id] = Number(raw[c.id] ?? '0');
  return {
    season,
    counts,
    total: Object.values(counts).reduce((a, n) => a + n, 0),
    mine: isNextCity(mine) ? mine : null,
  };
};

/** One vote per runner per season, for runners who have run a stage that week. */
export const castVote = async (
  deps: Deps,
  cityId: string
): Promise<{ vote: CityVote; message: string }> => {
  const username = await requireUser(deps);
  if (!isNextCity(cityId)) throw new GameError('Pick one of the four cities.');
  const { season } = dayInfo(toDateKey(deps.now()));
  const profile = await loadProfile(deps.store, username);
  if ((profile.stagesBySeason[String(season)] ?? 0) === 0)
    throw new GameError('Run a stage this week to vote.', 409);
  const already = await deps.store.hGet(keys.voters(season), username);
  if (already) throw new GameError('You already voted this week.', 409);
  await deps.store.hSet(keys.voters(season), { [username]: cityId });
  await deps.store.hIncrBy(keys.votes(season), cityId, 1);
  const city = NEXT_CITIES.find((c) => c.id === cityId);
  return {
    vote: await cityVote(deps.store, season, username),
    message:
      `Vote counted for ${city?.name ?? cityId} ${city?.flag ?? ''}`.trim(),
  };
};

/** Quests the server can check today. Snack Dash joins the pool once it ships. */
const QUEST_POOL = [
  'snacks',
  'highfive',
  'clean',
  'noCones',
  'chat',
  'cheer',
  'share',
  'pet',
  'topHalf',
  'dash',
] as QuestId[];

export const questStates = async (
  store: Store,
  profile: Profile,
  today: string
): Promise<QuestState[]> => {
  if (profile.username === 'guest') return [];
  const { season } = dayInfo(today);
  const [record, voted] = await Promise.all([
    store
      .get(keys.run(today, profile.username))
      .then((r) => parse<RunRecord>(r)),
    store.hGet(keys.voters(season), profile.username),
  ]);
  const met = record?.met ?? [];
  const ran = record ? 1 : 0;
  const progress = (id: QuestId): number => {
    switch (id) {
      case 'run':
        return ran;
      case 'snacks':
        return met.filter(isPickup).length;
      case 'highfive':
        return met.filter((k) => k === 'fan').length;
      case 'clean':
        return record && (record.incidents ?? []).length === 0 ? 1 : 0;
      case 'noCones':
        return record && !met.includes('cone') ? 1 : 0;
      case 'chat':
        return record && (record.chat ?? []).length > 0 ? 1 : 0;
      case 'cheer':
        return profile.cheeredOn === today ? 1 : 0;
      case 'share':
        return record?.shared ? 1 : 0;
      case 'pet':
        return profile.petCaredOn === today ? 1 : 0;
      case 'topHalf':
        return record && record.rank <= Math.ceil(record.totalRunners / 2)
          ? 1
          : 0;
      case 'dash':
        return profile.dash.date === today ? profile.dash.plays : 0;
      case 'week3':
      case 'week5':
        return profile.stagesBySeason[String(season)] ?? 0;
      case 'vote':
        return voted ? 1 : 0;
    }
  };
  return [...dailyQuests(today, QUEST_POOL), ...WEEKLY].map((q) => {
    const claimed = (
      profile.questClaims[questPeriod(q.scope, today, season)] ?? []
    ).includes(q.id);
    return { ...q, progress: Math.min(q.goal, progress(q.id)), claimed };
  });
};

export const claimQuest = async (
  deps: Deps,
  questId: string
): Promise<{ profile: Profile; quests: QuestState[]; message: string }> => {
  const username = await requireUser(deps);
  const today = toDateKey(deps.now());
  const profile = await loadProfile(deps.store, username);
  const quest = (await questStates(deps.store, profile, today)).find(
    (q) => q.id === questId
  );
  if (!quest) throw new GameError('That quest is not on today’s list.', 404);
  if (quest.claimed) throw new GameError('Already claimed.', 409);
  if (quest.progress < quest.goal)
    throw new GameError('Finish the quest first.', 409);
  const { season } = dayInfo(today);
  const period = questPeriod(quest.scope, today, season);
  // Keep only today's and this week's claims.
  const keep = new Set([today, `w${season}`]);
  profile.questClaims = Object.fromEntries(
    Object.entries(profile.questClaims).filter(([k]) => keep.has(k))
  );
  profile.questClaims[period] = [
    ...(profile.questClaims[period] ?? []),
    quest.id,
  ];
  profile.badges += quest.reward;
  await saveProfile(deps.store, profile);
  return {
    profile,
    quests: await questStates(deps.store, profile, today),
    message: `Quest done: +${quest.reward} coins`,
  };
};

export const dashBoard = async (
  store: Store,
  dateKey: string,
  username: string | null
): Promise<DashBoard> => {
  const top = await store.zRange(keys.dashBoard(dateKey), 0, 4, { by: 'rank' });
  const rows = top.map((t, i) => ({
    rank: i + 1,
    username: t.member,
    score: -t.score,
  }));
  let mine = rows.find((r) => r.username === username) ?? null;
  if (!mine && username) {
    const [rank, score] = await Promise.all([
      store.zRank(keys.dashBoard(dateKey), username),
      store.zScore(keys.dashBoard(dateKey), username),
    ]);
    if (rank !== undefined && score !== undefined)
      mine = { rank: rank + 1, username, score: -score };
  }
  return { rows, mine };
};

/** Scores a Snack Dash round by replaying its lane changes on today's course. */
export const playDash = async (deps: Deps, round: unknown, moves: unknown) => {
  const username = await requireUser(deps);
  const today = toDateKey(deps.now());
  const profile = await loadProfile(deps.store, username);
  if (profile.dash.date !== today)
    profile.dash = { date: today, plays: 0, best: 0 };
  if (profile.dash.plays >= DASH_MAX_ROUNDS)
    throw new GameError(
      'That is all the Snack Dash for today. Back tomorrow!',
      409
    );
  // Rounds are played in order, so nobody can replay an easy course.
  if (round !== profile.dash.plays)
    throw new GameError('That round is over. Start a new one.', 409);
  if (!isValidDashMoves(moves)) throw new GameError('Those moves look wrong.');
  const result = replayDash(dashCourse(today, profile.dash.plays), moves);
  const reward = dashReward(result.score, profile.dash.plays);
  profile.dash.plays += 1;
  profile.dash.best = Math.max(profile.dash.best, result.score);
  profile.stats.dashBest = Math.max(profile.stats.dashBest, result.score);
  profile.badges += reward;
  await saveProfile(deps.store, profile);
  const prev = await deps.store.zScore(keys.dashBoard(today), username);
  if (prev === undefined || -prev < result.score)
    await deps.store.zAdd(keys.dashBoard(today), {
      member: username,
      score: -result.score,
    });
  return {
    score: result.score,
    reward,
    profile,
    board: await dashBoard(deps.store, today, username),
    quests: await questStates(deps.store, profile, today),
  };
};

export const MAX_FRIENDS = 50;

const cleanName = (raw: string) => raw.trim().replace(/^\/?u\//i, '');

export const friendRows = async (
  store: Store,
  names: string[],
  today: string
): Promise<FriendRow[]> =>
  Promise.all(
    names.map(async (username) => {
      const [p, score, rank] = await Promise.all([
        loadProfile(store, username),
        store.zScore(keys.leaderboard(today), username),
        store.zRank(keys.leaderboard(today), username),
      ]);
      const active =
        p.lastRunDate === today || p.lastRunDate === addDays(today, -1);
      return {
        username,
        bib: p.bib,
        streak: active ? p.streak : 0,
        seconds: score ?? null,
        rank: rank === undefined ? null : rank + 1,
      };
    })
  );

export const friendsOf = async (deps: Deps, message?: string) => {
  const username = await requireUser(deps);
  const today = toDateKey(deps.now());
  const profile = await loadProfile(deps.store, username);
  const top = await deps.store.zRange(keys.leaderboard(today), 0, 30, {
    by: 'rank',
  });
  const suggestions = top
    .map((t) => t.member)
    .filter((n) => n !== username && !profile.friends.includes(n))
    .slice(0, 6);
  return {
    friends: await friendRows(deps.store, profile.friends, today),
    suggestions,
    profile,
    ...(message ? { message } : {}),
  };
};

export const addFriend = async (deps: Deps, raw: string) => {
  const username = await requireUser(deps);
  const name = cleanName(raw);
  if (!name) throw new GameError('Type a Reddit username.');
  if (name.toLowerCase() === username.toLowerCase())
    throw new GameError('That is you!');
  const profile = await loadProfile(deps.store, username);
  if (profile.friends.includes(name))
    throw new GameError(`u/${name} is already your friend.`, 409);
  if (profile.friends.length >= MAX_FRIENDS)
    throw new GameError(`You can have up to ${MAX_FRIENDS} friends.`, 409);
  const saved = parse<Partial<Profile>>(await deps.store.get(keys.user(name)));
  if (!saved || !(saved.registered || (saved.totalRuns ?? 0) > 0))
    throw new GameError(`u/${name} has not joined the race yet.`, 404);
  profile.friends = [...profile.friends, name];
  await saveProfile(deps.store, profile);
  return friendsOf(deps, `u/${name} is now your friend`);
};

export const removeFriend = async (deps: Deps, raw: string) => {
  const username = await requireUser(deps);
  const name = cleanName(raw);
  const profile = await loadProfile(deps.store, username);
  profile.friends = profile.friends.filter((f) => f !== name);
  await saveProfile(deps.store, profile);
  return friendsOf(deps);
};

type Club = { code: string; name: string; owner: string; members: string[] };

const loadClub = async (store: Store, code: string | null) =>
  code ? parse<Club>(await store.get(keys.club(code))) : null;

const saveClub = (store: Store, club: Club) =>
  store.set(keys.club(club.code), JSON.stringify(club));

/** A club's week: the stages its members ran this week, ranked across clubs. */
const updateClubWeek = async (store: Store, club: Club, today: string) => {
  const { season } = dayInfo(today);
  const stages = await Promise.all(
    club.members.map(
      async (m) =>
        (await loadProfile(store, m)).stagesBySeason[String(season)] ?? 0
    )
  );
  await store.zAdd(keys.clubWeek(season), {
    member: club.code,
    score: -stages.reduce((a, n) => a + n, 0),
  });
};

export const clubView = async (
  store: Store,
  code: string | null,
  today: string
): Promise<ClubView | null> => {
  const club = await loadClub(store, code);
  if (!club) return null;
  const { season } = dayInfo(today);
  const rows = await friendRows(store, club.members, today);
  const weeks = await Promise.all(
    club.members.map(async (m) => {
      const p = await loadProfile(store, m);
      return p.stagesBySeason[String(season)] ?? 0;
    })
  );
  const total = await store.zScore(keys.clubWeek(season), club.code);
  const members = rows
    .map((r, i) => ({ ...r, weekStages: weeks[i] ?? 0 }))
    .sort(
      (a, b) =>
        b.weekStages - a.weekStages || (a.seconds ?? 1e9) - (b.seconds ?? 1e9)
    );
  return {
    code: club.code,
    name: club.name,
    owner: club.owner,
    members,
    weekStages: total === undefined ? 0 : -total,
  };
};

export const topClubs = async (
  store: Store,
  today: string
): Promise<ClubRow[]> => {
  const { season } = dayInfo(today);
  const top = await store.zRange(keys.clubWeek(season), 0, 4, { by: 'rank' });
  const clubs = await Promise.all(top.map((t) => loadClub(store, t.member)));
  return top.flatMap((t, i) => {
    const c = clubs[i];
    return c
      ? [{ rank: i + 1, code: c.code, name: c.name, weekStages: -t.score }]
      : [];
  });
};

const clubResponse = async (deps: Deps, profile: Profile, message?: string) => {
  const today = toDateKey(deps.now());
  return {
    club: await clubView(deps.store, profile.club, today),
    top: await topClubs(deps.store, today),
    profile,
    ...(message ? { message } : {}),
  };
};

export const myClub = async (deps: Deps) => {
  const username = await requireUser(deps);
  return clubResponse(deps, await loadProfile(deps.store, username));
};

const newClubCode = async (store: Store) => {
  for (let tries = 0; tries < 20; tries++) {
    let code = '';
    for (let i = 0; i < 6; i++)
      code +=
        CLUB_CODE_CHARS[Math.floor(Math.random() * CLUB_CODE_CHARS.length)];
    if (!(await store.get(keys.club(code)))) return code;
  }
  throw new GameError('Could not make a club code. Try again.', 409);
};

export const createClub = async (
  deps: Deps,
  adjective: unknown,
  noun: unknown
) => {
  const username = await requireUser(deps);
  const profile = await loadProfile(deps.store, username);
  if (!profile.registered) throw new GameError('Make your runner first.');
  if (profile.club)
    throw new GameError('Leave your club before starting a new one.', 409);
  const name =
    typeof adjective === 'number' && typeof noun === 'number'
      ? clubName(adjective, noun)
      : null;
  if (!name) throw new GameError('Pick a club name.');
  const code = await newClubCode(deps.store);
  const club = { code, name, owner: username, members: [username] };
  await saveClub(deps.store, club);
  await updateClubWeek(deps.store, club, toDateKey(deps.now()));
  profile.club = code;
  await saveProfile(deps.store, profile);
  return clubResponse(deps, profile, `${name} is open. Share code ${code}!`);
};

export const joinClub = async (deps: Deps, rawCode: unknown) => {
  const username = await requireUser(deps);
  const code = typeof rawCode === 'string' ? rawCode.trim().toUpperCase() : '';
  if (!isClubCode(code))
    throw new GameError('Club codes are 6 letters and numbers.');
  const profile = await loadProfile(deps.store, username);
  if (!profile.registered) throw new GameError('Make your runner first.');
  if (profile.club === code)
    throw new GameError('You are already in this club.', 409);
  if (profile.club)
    throw new GameError('Leave your club before joining another.', 409);
  const club = await loadClub(deps.store, code);
  if (!club) throw new GameError('No club has that code.', 404);
  if (club.members.length >= CLUB_MAX_MEMBERS)
    throw new GameError(
      `That club is full (${CLUB_MAX_MEMBERS} runners).`,
      409
    );
  club.members = [...club.members, username];
  await saveClub(deps.store, club);
  profile.club = code;
  await saveProfile(deps.store, profile);
  await updateClubWeek(deps.store, club, toDateKey(deps.now()));
  return clubResponse(deps, profile, `Welcome to ${club.name}!`);
};

export const leaveClub = async (deps: Deps) => {
  const username = await requireUser(deps);
  const profile = await loadProfile(deps.store, username);
  const club = await loadClub(deps.store, profile.club);
  if (club) {
    club.members = club.members.filter((m) => m !== username);
    // The club lives on with its next member; an empty club closes.
    if (club.owner === username && club.members[0])
      club.owner = club.members[0];
    await saveClub(deps.store, club);
    await updateClubWeek(deps.store, club, toDateKey(deps.now()));
  }
  profile.club = null;
  await saveProfile(deps.store, profile);
  return clubResponse(
    deps,
    profile,
    club ? `You left ${club.name}.` : undefined
  );
};

export const MAX_AVATAR_NAMES = 50;

/** Reddit avatar URLs for a set of players, looked up at most once a day each. */
export const avatarsFor = async (
  deps: Deps,
  names: string[]
): Promise<Record<string, string | null>> => {
  const unique = [...new Set(names)].slice(0, MAX_AVATAR_NAMES);
  if (unique.length === 0) return {};
  const today = toDateKey(deps.now());
  const cached = await deps.store.hMGet(keys.avatars(), unique);
  const out: Record<string, string | null> = {};
  const fresh: Record<string, string> = {};
  await Promise.all(
    unique.map(async (name, i) => {
      const hit = parse<{ url: string | null; day: string }>(
        cached[i] ?? undefined
      );
      if (hit && hit.day === today) {
        out[name] = hit.url;
        return;
      }
      const url = deps.avatarUrl
        ? await deps.avatarUrl(name).catch(() => null)
        : null;
      out[name] = url;
      fresh[name] = JSON.stringify({ url, day: today });
    })
  );
  if (Object.keys(fresh).length > 0)
    await deps.store.hSet(keys.avatars(), fresh);
  return out;
};

/** Once a UTC day; consecutive days climb the 7-day calendar. */
export const checkIn = async (
  deps: Deps
): Promise<{ profile: Profile; message: string }> => {
  const username = await requireUser(deps);
  const today = toDateKey(deps.now());
  const profile = await loadProfile(deps.store, username);
  if (profile.checkInDate === today)
    throw new GameError('You already checked in today.', 409);
  const day = nextCheckInDay(
    profile.checkInDate,
    profile.checkInDay,
    addDays(today, -1)
  );
  const reward = CHECKIN_REWARDS[day - 1] ?? CHECKIN_REWARDS[0];
  profile.checkInDate = today;
  profile.checkInDay = day;
  profile.badges += reward;
  await saveProfile(deps.store, profile);
  return { profile, message: `Day ${day} check-in: +${reward} coins` };
};

export const shareText = (day: DayInfo, record: RunRecord): string => {
  const paces = record.plan.paces.map((p) => PACE_LABEL[p][0]).join(' ');
  const drinks =
    record.plan.drinks.length > 0
      ? `💧 at km ${record.plan.drinks.join(', ')}`
      : '💧 no water stops';
  const streak = record.streak > 1 ? ` · 🔥 ${record.streak}-day streak` : '';
  return [
    `🏃 **${day.city.name} ${day.stageIndex + 1}/7 · ${day.stage.name}** · ${day.weather.icon} ${day.weather.label}`,
    '',
    `Finished in **${formatTime(record.seconds)}** · #${record.rank} of ${record.totalRunners}${streak}`,
    '',
    `Plan: \`${paces}\` · ${drinks}`,
  ].join('\n');
};

export const share = async (
  deps: Deps
): Promise<{ commentPosted: boolean; text: string }> => {
  const username = await requireUser(deps);
  const dateKey = await postDateKey(deps);
  const record = parse<RunRecord>(
    await deps.store.get(keys.run(dateKey, username))
  );
  if (!record) throw new GameError('Run the stage before sharing.', 404);
  const text = shareText(dayInfo(dateKey), record);
  if (record.shared) return { commentPosted: false, text };
  const postId = deps.postId();
  const posted = postId
    ? await deps.comment(postId, text).catch(() => false)
    : false;
  if (posted) {
    record.shared = true;
    await deps.store.set(keys.run(dateKey, username), JSON.stringify(record));
  }
  return { commentPosted: posted, text };
};

export const postTitle = (day: DayInfo): string =>
  `${isChristmasRun(day.dateKey) ? '🎄 Christmas Run · ' : ''}${isTriathlon(day) ? '🏊🚴🏃 Triathlon Finale · ' : ''}Day ${day.dayIndex + 1} · ${day.city.flag} ${day.city.name} ${day.stageIndex + 1}/7: ${day.stage.name} · ${day.weather.icon} ${day.weather.label} · ${TIMES[day.time].icon} ${TIMES[day.time].label}`;

/** Creates the post for a day once; later calls return the same post. */
export const ensureDailyPost = async (
  deps: Deps,
  dateKey = toDateKey(deps.now())
): Promise<string> => {
  const existing = await deps.store.get(keys.dayPost(dateKey));
  if (existing) return existing;
  const day = dayInfo(dateKey);
  const postId = await deps.createPost({
    title: postTitle(day),
    fallbackText: `Today's 6 km stage runs through ${day.city.name}: ${day.stage.name}. Weather: ${day.weather.label}. Plan your pace, then race the crew.`,
    pinnedComment: `**Strategy talk for ${day.stage.name}** ${day.weather.icon}\n\n${day.weather.hint} Where do you push, and where do you save your legs? Share your plan below.`,
  });
  await Promise.all([
    deps.store.set(keys.dayPost(dateKey), postId),
    deps.store.set(keys.postDate(postId), dateKey),
  ]);
  // Today's stage takes the top sticky slot, which unpins yesterday's.
  await deps.pin?.(postId, 1).catch((error: unknown) => {
    console.error('Could not pin today’s stage', error);
  });
  return postId;
};

export const WELCOME_TITLE = 'How to play Running Man 🏃';

export const welcomeText = (): string =>
  [
    'Every day at 00:00 UTC a new **6 km stage** of a city marathon opens in the post pinned at the top. Tokyo, Paris, Hanoi and Dubai take turns, one city a week.',
    '',
    '1. **Make your runner.** Your Reddit account is your login: pick a look and a running buddy, and get your own race bib.',
    '2. **Plan your pace.** Tap each kilometre for Easy, Steady or Push, and choose where to drink. Push too hard and you walk.',
    '3. **Run it.** Swipe or use ◀ ▶ to change lanes. Dodge cones and puddles, grab snacks, high-five the crowd. The other runners are today’s real players: run into one and you both fall.',
    '4. **Share your bib** in the comments, cheer someone on, and keep your streak.',
    '',
    'One counted run per person per day. Every finish adds 6 km to the crew’s goal of ten marathons per city.',
    '',
    'Between races: daily check-in and quests, the **Snack Dash** mini game, friends and running clubs, and a shop with outfits, pets and pet gear. Everything pays in coins, and nothing you buy changes race times.',
    '',
    'Talk strategy under each day’s post. See you at the start line!',
  ].join('\n');

/** Posts and pins the how-to-play guide once; later calls return the same post. */
export const ensureWelcomePost = async (deps: Deps): Promise<string | null> => {
  const existing = await deps.store.get(keys.welcomePost());
  if (existing) return existing;
  if (!deps.createTextPost) return null;
  const postId = await deps.createTextPost(WELCOME_TITLE, welcomeText());
  await deps.store.set(keys.welcomePost(), postId);
  await deps.pin?.(postId, 2).catch((error: unknown) => {
    console.error('Could not pin the how-to-play post', error);
  });
  return postId;
};
