import type {
  ArchiveResponse,
  ArchiveRow,
  ArchiveRunResponse,
  ArchiveStageResponse,
  RunnerTrack,
} from '../../shared/api';
import {
  addDays,
  dayIndexOf,
  dayInfo,
  isTriathlon,
  toDateKey,
} from '../../shared/content';
import { courseItems } from '../../shared/course';
import {
  MAX_RIVALS,
  isValidMoves,
  replayRace,
  startLane,
} from '../../shared/race';
import { checkpoints, isValidPlan, simulate } from '../../shared/sim';
import type { Deps } from './deps';
import {
  GameError,
  ensureBib,
  firstDay,
  gameSettings,
  loadProfile,
  parse,
  requireUser,
  saveProfile,
} from './game';
import { keys } from './keys';

/** Coins for the first archive finish of each past stage. */
export const ARCHIVE_REWARD = 10;
/** How far back the archive list reaches. */
export const ARCHIVE_DAYS = 42;

/**
 * Past stages stay playable: anyone, a new player above all, can race any
 * earlier day of this subreddit against that day's fastest runners as
 * ghosts. Replays have their own board and never touch the day's
 * leaderboard, streaks, quests or the crew goal, so the daily race stays fair.
 */
const checkDate = async (deps: Deps, raw: unknown): Promise<string> => {
  const today = toDateKey(deps.now());
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw))
    throw new GameError('That is not a stage date.');
  const first = await firstDay(deps, today);
  if (raw >= today) throw new GameError('That stage is still open today.');
  if (raw < first || !(await deps.store.get(keys.dayPost(raw))))
    throw new GameError('That stage is not in this subreddit’s archive.', 404);
  return raw;
};

export const archiveList = async (deps: Deps): Promise<ArchiveResponse> => {
  const username = await requireUser(deps);
  const { store } = deps;
  const today = toDateKey(deps.now());
  const first = await firstDay(deps, today);
  const profile = await loadProfile(store, username);
  const dates: string[] = [];
  for (let i = 1; i <= ARCHIVE_DAYS; i++) {
    const d = addDays(today, -i);
    if (d < first) break;
    if (await store.get(keys.dayPost(d))) dates.push(d);
  }
  const days: ArchiveRow[] = await Promise.all(
    dates.map(async (dateKey) => {
      const lb = keys.leaderboard(dateKey);
      const [runners, top, onTheDay, best] = await Promise.all([
        store.zCard(lb),
        store.zRange(lb, 0, 0, { by: 'rank' }),
        store.zScore(lb, username),
        store.zScore(keys.archiveBoard(dateKey), username),
      ]);
      const t = top[0];
      return {
        dateKey,
        number: dayIndexOf(dateKey) - dayIndexOf(first) + 1,
        runners,
        top: t ? { username: t.member, seconds: t.score } : null,
        onTheDay: onTheDay ?? null,
        best: best ?? null,
        done: profile.archiveDone.includes(dateKey),
      };
    })
  );
  return { type: 'archive', days, profile };
};

/** The day's fastest runs (not yours), to race again as ghosts. */
export const archiveStage = async (
  deps: Deps,
  raw: unknown
): Promise<ArchiveStageResponse> => {
  const username = await requireUser(deps);
  const dateKey = await checkDate(deps, raw);
  const { store } = deps;
  const top = await store.zRange(keys.leaderboard(dateKey), 0, MAX_RIVALS, {
    by: 'rank',
  });
  const names = top.map((t) => t.member).filter((n) => n !== username);
  const runners = names.length
    ? (await store.hMGet(keys.tracks(dateKey), names))
        .map((r) => parse<RunnerTrack>(r))
        .filter((t): t is RunnerTrack => t !== null)
        .slice(0, MAX_RIVALS)
    : [];
  const best = await store.zScore(keys.archiveBoard(dateKey), username);
  return { type: 'archiveStage', dateKey, runners, best: best ?? null };
};

/** Replays a past stage exactly as the day's race was checked. */
export const archiveRun = async (
  deps: Deps,
  raw: unknown,
  planInput: unknown,
  movesInput: unknown,
  rivalsInput: unknown
): Promise<ArchiveRunResponse> => {
  const { store } = deps;
  const username = await requireUser(deps);
  const dateKey = await checkDate(deps, raw);
  const day = dayInfo(dateKey);
  if (!isValidPlan(day.stage, planInput))
    throw new GameError('That race plan is not valid.');
  if (!isValidMoves(movesInput))
    throw new GameError('That run could not be checked.');
  const rivalNames = Array.isArray(rivalsInput)
    ? rivalsInput
        .filter((n): n is string => typeof n === 'string' && n !== username)
        .slice(0, MAX_RIVALS)
    : [];
  const rivals = rivalNames.length
    ? (await store.hMGet(keys.tracks(dateKey), rivalNames))
        .map((r) => parse<RunnerTrack>(r))
        .filter((t): t is RunnerTrack => t !== null)
    : [];
  const options = await gameSettings(deps);
  const tri = isTriathlon(day);
  const sim = simulate(day.stage, day.weather.id, planInput, day.time, tri);
  const race = replayRace(
    {
      base: checkpoints(sim.splits),
      items: courseItems(dateKey, day.stage, day.weather.id, {
        city: day.city.id,
        time: day.time,
        triathlon: tri,
        life: options.roadLife,
      }),
      rivals,
      startLane: startLane(username),
    },
    movesInput
  );
  const seconds = race.finalSeconds;

  const profile = await loadProfile(store, username);
  if (!profile.registered) profile.registered = true;
  await ensureBib(store, profile);

  const board = keys.archiveBoard(dateKey);
  const previous = await store.zScore(board, username);
  const improved = previous === undefined || seconds < previous;
  if (improved) await store.zAdd(board, { member: username, score: seconds });

  const first = !profile.archiveDone.includes(dateKey);
  if (first) {
    profile.archiveDone.push(dateKey);
    profile.badges += ARCHIVE_REWARD;
  }
  await saveProfile(store, profile);

  // Where this time would have finished among the day's runners.
  const lb = keys.leaderboard(dateKey);
  const dayRunners = await store.zCard(lb);
  const faster = dayRunners
    ? await store.zRange(lb, 0, dayRunners - 1, { by: 'rank' })
    : [];
  const dayRank =
    faster.filter((r) => r.member !== username && r.score < seconds).length + 1;
  return {
    type: 'archiveRun',
    dateKey,
    profile,
    seconds,
    best: improved ? seconds : (previous ?? seconds),
    improved,
    dayRank,
    dayRunners,
    reward: first ? ARCHIVE_REWARD : 0,
  };
};
