import {
  CREW_TARGET_METERS,
  EPOCH,
  FINISHER_STAGES,
  KM_PER_STAGE,
  addDays,
  dayInfo,
  toDateKey,
  type DayInfo,
} from '../../shared/content';
import {
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
import { courseItems } from '../../shared/course';
import {
  MAX_MOVES,
  MAX_RIVALS,
  RACE_DT,
  isValidMoves,
  replayRace,
  startLane,
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
  RunnerTrack,
  Incident,
  InitResponse,
  LeaderRow,
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
  cheeredOn: null,
  totalRuns: 0,
});

export const loadProfile = async (
  store: Store,
  username: string
): Promise<Profile> => {
  const saved = parse<Partial<Profile>>(await store.get(keys.user(username)));
  return { ...freshProfile(username), ...saved, username };
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

const runnersOnRoad = async (
  store: Store,
  dateKey: string,
  self: string | null
): Promise<RunnerTrack[]> => {
  const rows = await store.zRange(keys.leaderboard(dateKey), 0, RUNNER_LIMIT, {
    by: 'rank',
  });
  const names = rows
    .map((r) => r.member)
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
    journeyId,
  ] = await Promise.all([
    username
      ? store.get(keys.run(dateKey, username)).then((r) => parse<RunRecord>(r))
      : null,
    leaderboard(store, dateKey),
    myRank(store, dateKey, username),
    store.zCard(keys.leaderboard(dateKey)),
    runnersOnRoad(store, dateKey, username),
    crewProgress(store, day),
    username ? store.hGet(keys.cheers(dateKey), username) : undefined,
    dateKey === today
      ? null
      : store.get(keys.dayPost(today)).then((p) => p ?? null),
    deps.telemetry.start().catch(() => null),
  ]);

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
  ]);
};

export const run = async (
  deps: Deps,
  planInput: unknown,
  journeyId: string | null,
  movesInput: unknown = [],
  rivalsInput: unknown = []
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
  const sim = simulate(day.stage, day.weather.id, plan);
  const race = replayRace(
    {
      base: checkpoints(sim.splits),
      items: courseItems(dateKey, day.stage, day.weather.id),
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
  const track: RunnerTrack = {
    username,
    look: profile.look,
    bib: profile.bib,
    marks: race.marks,
    seconds: result.totalSeconds,
    moves: moves.slice(0, MAX_MOVES),
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
  reward.crew = crewPaid;
  reward.total += crewPaid;
  profile.badges += reward.total - crewPaid;

  const unlocked = grantEarnedUnlocks(profile);

  const record: RunRecord = {
    dateKey,
    seconds: result.totalSeconds,
    plan,
    splits: result.splits,
    moves,
    rivals: rivalRuns.map((r) => r.username),
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
  };

  await Promise.all([
    store.set(keys.run(dateKey, username), JSON.stringify(record)),
    saveProfile(store, profile),
  ]);

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
  return { type: 'run', run: record, profile, leaderboard: board, crew };
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
    throw new GameError('Not enough badges yet. Keep running!');
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
      throw new GameError('Not enough badges yet. Keep running!');
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
    message: `Cheer sent to u/${target}! +${CHEER_REWARD} badges`,
  };
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
  `Day ${day.dayIndex + 1} · ${day.city.flag} ${day.city.name} ${day.stageIndex + 1}/7: ${day.stage.name} · ${day.weather.icon} ${day.weather.label}`;

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
  return postId;
};
