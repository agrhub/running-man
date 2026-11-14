import { achievementById } from '../../shared/achievements';
import { Avatar } from '../components/Avatar';
import type {
  CrewProgress,
  LeaderRow,
  Profile,
  RunRecord,
  WeeklyBoard,
  FriendRow,
} from '../../shared/api';
import type { DayInfo } from '../../shared/content';
import { itemById, petById } from '../../shared/economy';
import { PACE_LABEL, formatTime } from '../../shared/sim';
import { CrewBar } from '../components/CrewBar';
import { VoteCard } from '../components/VoteCard';
import type { CityVote, NextCityId } from '../../shared/vote';
import { Leaderboard, WeeklyStandings } from '../components/Leaderboard';
import { useState } from 'react';
import { PACE_COLOR } from '../lib/theme';
import { tr } from '../i18n';

type Props = {
  day: DayInfo;
  today: string;
  profile: Profile;
  run: RunRecord;
  leaderboard: LeaderRow[];
  myRank: number | null;
  crew: CrewProgress;
  cheersReceived: number;
  justFinished: boolean;
  sharing: boolean;
  onShare: () => void;
  onLocker: () => void;
  onReplay: () => void;
  onCheer: (username: string) => void;
  weekly: WeeklyBoard;
  friends: FriendRow[];
  vote: CityVote;
  voting: boolean;
  onVote: (cityId: NextCityId) => void;
};

const KIND_WORD: Record<string, [string, string]> = {
  cone: ['cone', 'cones'],
  puddle: ['puddle', 'puddles'],
  cups: ['cup spill', 'cup spills'],
  fan: ['high five', 'high fives'],
  bottle: ['water bottle', 'water bottles'],
  soda: ['soda', 'sodas'],
  cake: ['cake', 'cakes'],
  candy: ['candy', 'candies'],
  walker: ['stop for someone crossing', 'stops for people crossing'],
  cyclist: ['cyclist', 'cyclists'],
  scooter: ['motorbike', 'motorbikes'],
  cyclo: ['cyclo', 'cyclos'],
  taxi: ['taxi', 'taxis'],
  ambulance: ['ambulance', 'ambulances'],
  firetruck: ['fire engine', 'fire engines'],
  dog: ['dog', 'dogs'],
  cat: ['cat', 'cats'],
  chicken: ['chicken', 'chickens'],
  pig: ['pig', 'pigs'],
  capybara: ['capybara', 'capybaras'],
  monkey: ['monkey', 'monkeys'],
  skates: ['pair of skates', 'pairs of skates'],
  skateboard: ['skateboard', 'skateboards'],
  bike: ['bike ride', 'bike rides'],
  buoy: ['buoy', 'buoys'],
};

const countKinds = (kinds: string[]) => {
  const counts = new Map<string, number>();
  for (const k of kinds) counts.set(k, (counts.get(k) ?? 0) + 1);
  return [...counts]
    .map(([k, n]) => `${n} ${tr((KIND_WORD[k] ?? [k, k])[n === 1 ? 0 : 1])}`)
    .join(', ');
};

const unlockedName = (id: string) =>
  tr(itemById(id)?.name ?? petById(id)?.name ?? id);

export const ResultScreen = (p: Props) => {
  const { day, profile, run } = p;
  const canCheer = profile.cheeredOn !== p.today;
  // Friends who ran today and you, ranked by time.
  const friendBoard = [
    ...p.friends.flatMap((f) =>
      f.seconds === null ? [] : [{ username: f.username, seconds: f.seconds }]
    ),
    { username: profile.username, seconds: run.seconds },
  ]
    .sort((a, b) => a.seconds - b.seconds)
    .map((r, i) => ({ ...r, rank: i + 1 }));
  const [board, setBoard] = useState<'today' | 'week' | 'friends'>('today');
  const rank = p.myRank ?? run.rank;
  const rewards: [string, number][] = [
    [tr('Finished the stage'), run.reward.finish],
    [tr(run.reward.rank >= 50 ? 'Top 10%' : 'Top half'), run.reward.rank],
    [tr('{n}-day streak', { n: run.streak }), run.reward.streak],
    [tr('Crew finished the city'), run.reward.crew],
    [tr('🎄 Christmas Run bonus'), run.reward.holiday ?? 0],
    [tr('🤝 Club relay complete'), run.reward.relay ?? 0],
    [
      tr('🔮 Called your time ({n}s off)', { n: run.guess?.off ?? 0 }),
      run.reward.guess ?? 0,
    ],
    ...(run.achieved ?? []).map((id): [string, number] => {
      const a = achievementById(id);
      return [`🏆 ${tr(a?.name ?? id)}`, a?.reward ?? 0];
    }),
  ];

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto px-4 pt-4 pb-6 max-w-[440px] mx-auto">
      <section
        className="bib bib-pins pop-in px-4 pt-6 pb-4 text-center"
        aria-label={tr('Your race bib')}
      >
        <p className="text-[13px] font-extrabold text-ink-soft">
          {day.city.flag}{' '}
          {tr('{city}, stage {n}: {stage}', {
            city: tr(day.city.name),
            n: day.stageIndex + 1,
            stage: tr(day.stage.name),
          })}
        </p>
        <p className="font-display text-[92px] font-extrabold leading-[0.9] tabular text-[var(--accent)] [text-shadow:0_4px_0_#2a2340]">
          #{rank}
        </p>
        <p className="flex flex-wrap items-center justify-center gap-x-2 font-display text-[18px] font-extrabold">
          <Avatar name={profile.username} size={32} ring />
          u/{profile.username}
          {profile.bib ? (
            <span className="text-ink-soft">
              {' '}
              · {tr('bib #{n}', { n: String(profile.bib).padStart(4, '0') })}
            </span>
          ) : null}
        </p>
        <div className="mt-2 flex items-center justify-center gap-4">
          <div>
            <p className="font-display text-[28px] font-extrabold leading-none tabular">
              {formatTime(run.seconds)}
            </p>
            <p className="text-[12px] text-ink-soft">{tr('finish time')}</p>
          </div>
          <div>
            <p className="font-display text-[28px] font-extrabold leading-none tabular">
              {run.totalRunners}
            </p>
            <p className="text-[12px] text-ink-soft">{tr('runners today')}</p>
          </div>
          <div>
            <p className="font-display text-[28px] font-extrabold leading-none tabular">
              🔥{run.streak}
            </p>
            <p className="text-[12px] text-ink-soft">{tr('day streak')}</p>
          </div>
        </div>
        <div className="mt-3 flex gap-1" aria-label={tr('Splits per km')}>
          {run.splits.map((s) => (
            <div key={s.km} className="flex-1">
              <div
                className="h-2 rounded-full"
                style={{ background: PACE_COLOR[s.pace] }}
                title={tr(PACE_LABEL[s.pace])}
              />
              <p className="mt-0.5 text-[10px] font-bold tabular text-ink-soft">
                {formatTime(s.seconds)}
                {s.drank ? ' 💧' : ''}
              </p>
            </div>
          ))}
        </div>
        {(run.finisherNow || run.crewFinishedNow) && (
          <p className="stamp absolute -right-2 top-10 rounded-lg border-[3px] border-push px-2 font-display text-[18px] font-extrabold text-push bg-white">
            {run.finisherNow
              ? tr('{city} Finisher', { city: tr(day.city.name) })
              : tr('Crew finished!')}
          </p>
        )}
      </section>

      {p.justFinished && (
        <section className="rounded-2xl border-2 border-ink bg-white/80 px-3 py-2">
          <ul className="flex flex-col gap-0.5 text-[14px]">
            {rewards
              .filter(([, n]) => n > 0)
              .map(([label, n]) => (
                <li key={label} className="flex justify-between">
                  <span>{label}</span>
                  <span className="font-extrabold tabular">+{n} 🪙</span>
                </li>
              ))}
          </ul>
          {run.relay && !run.relay.done && (
            <p className="mt-1 text-[13px] font-bold">
              {tr(
                '🤝 You ran leg {n} of your club’s relay. {left} more to go today.',
                { n: run.relay.leg, left: 3 - run.relay.leg }
              )}
            </p>
          )}
          {run.guess && !run.reward.guess && (
            <p className="mt-1 text-[13px] text-ink-soft">
              {tr(
                '🔮 You guessed {time}: {n}s off. Within 10 s pays next time!',
                { time: formatTime(run.guess.seconds), n: run.guess.off }
              )}
            </p>
          )}
          {run.unlocked.length > 0 && (
            <p className="mt-1 text-[13px] font-bold">
              {tr('New in the shop for you:')}{' '}
              {run.unlocked.map(unlockedName).join(', ')}
            </p>
          )}
        </section>
      )}

      {((run.incidents ?? []).length > 0 || (run.met ?? []).length > 0) && (
        <section
          className="rounded-2xl border-2 border-ink bg-white/80 px-3 py-2"
          aria-label={tr('Race report')}
        >
          <h2 className="font-display text-[17px] font-extrabold">
            {tr('Race report')}
          </h2>
          <ul className="flex flex-col gap-0.5 text-[13px]">
            {(run.met ?? []).length > 0 && (
              <li className="flex justify-between gap-2">
                <span>{countKinds(run.met ?? [])}</span>
                <span className="font-extrabold tabular">
                  {run.course > 0 ? '+' : ''}
                  {run.course}s
                </span>
              </li>
            )}
            {(run.incidents ?? []).map((inc, i) => (
              <li
                key={`${inc.with}-${i}`}
                className="flex justify-between gap-2"
              >
                <span>
                  {tr(
                    inc.atFault
                      ? '💥 You ran into u/{name} at km {km}'
                      : '💥 u/{name} ran into you at km {km}',
                    { name: inc.with, km: inc.km.toFixed(1) }
                  )}
                </span>
                <span className="font-extrabold tabular text-push">
                  +{inc.seconds}s
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <CrewBar crew={p.crew} {...(p.justFinished ? { gained: 6000 } : {})} />

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={p.onShare}
          disabled={p.sharing || run.shared}
          className="chunky rounded-2xl bg-[var(--accent)] py-2.5 font-display text-[17px] font-extrabold text-white"
        >
          {run.shared
            ? tr('Shared in comments')
            : p.sharing
              ? tr('Posting…')
              : tr('Share to comments')}
        </button>
        <button
          type="button"
          onClick={p.onLocker}
          className="chunky rounded-2xl bg-white py-2.5 font-display text-[17px] font-extrabold"
        >
          {tr('Shop')} 🪙 {profile.badges}
        </button>
      </div>

      <section className="rounded-2xl border-2 border-ink bg-white/80 px-2 py-2">
        <div className="flex items-center justify-between gap-2 px-2">
          <h2 className="font-display text-[19px] font-extrabold">
            {board === 'today'
              ? tr('Today’s top 10')
              : board === 'week'
                ? tr('This week in {city}', { city: tr(day.city.name) })
                : tr('You and your friends')}
          </h2>
          <div
            className="flex shrink-0 rounded-full border-2 border-ink p-0.5 text-[12px] font-extrabold"
            role="group"
            aria-label={tr('Leaderboard')}
          >
            {(['today', 'week', 'friends'] as const).map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setBoard(b)}
                aria-pressed={board === b}
                className={`rounded-full px-2.5 py-0.5 ${board === b ? 'bg-ink text-white' : ''}`}
              >
                {tr(
                  b === 'today' ? 'Today' : b === 'week' ? 'Week' : 'Friends'
                )}
              </button>
            ))}
          </div>
        </div>
        {board === 'today' ? (
          <>
            <p className="px-2 text-[12px] text-ink-soft">
              {canCheer
                ? tr('Send one cheer a day to another runner for +5 coins.')
                : tr('Cheer sent today. Thanks for being a good sport!')}
              {p.cheersReceived > 0 &&
                ` ${tr(
                  p.cheersReceived === 1
                    ? '👏 {n} cheer for you.'
                    : '👏 {n} cheers for you.',
                  { n: p.cheersReceived }
                )}`}
            </p>
            <div className="mt-1">
              <Leaderboard
                rows={p.leaderboard}
                me={profile.username}
                myRank={p.myRank}
                canCheer={canCheer}
                onCheer={p.onCheer}
              />
            </div>
          </>
        ) : board === 'friends' ? (
          <div className="mt-1">
            {p.friends.length === 0 ? (
              <p className="px-2 text-[13px] text-ink-soft">
                {tr('Add friends in the Friends tab to race them here.')}
              </p>
            ) : (
              <Leaderboard
                rows={friendBoard}
                me={profile.username}
                myRank={null}
                canCheer={canCheer}
                onCheer={p.onCheer}
              />
            )}
          </div>
        ) : (
          <>
            <p className="px-2 text-[12px] text-ink-soft">
              {tr('Most stages this week first, then the lowest total time.')}
            </p>
            <div className="mt-1">
              <WeeklyStandings board={p.weekly} me={profile.username} />
            </div>
          </>
        )}
      </section>

      <VoteCard vote={p.vote} busy={p.voting} onVote={p.onVote} />

      <button
        type="button"
        onClick={p.onReplay}
        className="text-[13px] font-extrabold text-ink-soft underline"
      >
        {tr('Watch my run again')}
      </button>
      <p className="text-center text-[12px] text-ink-soft">
        {tr('A new stage opens every day at 00:00 UTC.')}
      </p>
    </div>
  );
};
