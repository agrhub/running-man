import type {
  CrewProgress,
  LeaderRow,
  Profile,
  RunRecord,
} from '../../shared/api';
import type { DayInfo } from '../../shared/content';
import { itemById, petById } from '../../shared/economy';
import { PACE_LABEL, formatTime } from '../../shared/sim';
import { CrewBar } from '../components/CrewBar';
import { Leaderboard } from '../components/Leaderboard';
import { PACE_COLOR } from '../lib/theme';

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
};

const KIND_WORD: Record<string, [string, string]> = {
  cone: ['cone', 'cones'],
  puddle: ['puddle', 'puddles'],
  cups: ['cup spill', 'cup spills'],
  fan: ['high five', 'high fives'],
};

const countKinds = (kinds: string[]) => {
  const counts = new Map<string, number>();
  for (const k of kinds) counts.set(k, (counts.get(k) ?? 0) + 1);
  return [...counts]
    .map(([k, n]) => `${n} ${(KIND_WORD[k] ?? [k, k])[n === 1 ? 0 : 1]}`)
    .join(', ');
};

const unlockedName = (id: string) =>
  itemById(id)?.name ?? petById(id)?.name ?? id;

export const ResultScreen = (p: Props) => {
  const { day, profile, run } = p;
  const canCheer = profile.cheeredOn !== p.today;
  const rank = p.myRank ?? run.rank;
  const rewards: [string, number][] = [
    ['Finished the stage', run.reward.finish],
    [run.reward.rank >= 50 ? 'Top 10%' : 'Top half', run.reward.rank],
    [`${run.streak}-day streak`, run.reward.streak],
    ['Crew finished the city', run.reward.crew],
  ];

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto px-4 pt-4 pb-6 max-w-[440px] mx-auto">
      <section
        className="bib bib-pins pop-in px-4 pt-6 pb-4 text-center"
        aria-label="Your race bib"
      >
        <p className="text-[13px] font-extrabold text-ink-soft">
          {day.city.flag} {day.city.name}, stage {day.stageIndex + 1}:{' '}
          {day.stage.name}
        </p>
        <p className="font-display text-[92px] font-extrabold leading-[0.9] tabular text-[var(--accent)] [text-shadow:0_4px_0_#2a2340]">
          #{rank}
        </p>
        <p className="font-display text-[18px] font-extrabold">
          u/{profile.username}
          {profile.bib ? (
            <span className="text-ink-soft">
              {' '}
              · bib #{String(profile.bib).padStart(4, '0')}
            </span>
          ) : null}
        </p>
        <div className="mt-2 flex items-center justify-center gap-4">
          <div>
            <p className="font-display text-[28px] font-extrabold leading-none tabular">
              {formatTime(run.seconds)}
            </p>
            <p className="text-[12px] text-ink-soft">finish time</p>
          </div>
          <div>
            <p className="font-display text-[28px] font-extrabold leading-none tabular">
              {run.totalRunners}
            </p>
            <p className="text-[12px] text-ink-soft">runners today</p>
          </div>
          <div>
            <p className="font-display text-[28px] font-extrabold leading-none tabular">
              🔥{run.streak}
            </p>
            <p className="text-[12px] text-ink-soft">day streak</p>
          </div>
        </div>
        <div className="mt-3 flex gap-1" aria-label="Splits per km">
          {run.splits.map((s) => (
            <div key={s.km} className="flex-1">
              <div
                className="h-2 rounded-full"
                style={{ background: PACE_COLOR[s.pace] }}
                title={PACE_LABEL[s.pace]}
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
            {run.finisherNow ? `${day.city.name} Finisher` : 'Crew finished!'}
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
                  <span className="font-extrabold tabular">+{n} 🏅</span>
                </li>
              ))}
          </ul>
          {run.unlocked.length > 0 && (
            <p className="mt-1 text-[13px] font-bold">
              New in your locker: {run.unlocked.map(unlockedName).join(', ')}
            </p>
          )}
        </section>
      )}

      {((run.incidents ?? []).length > 0 || (run.met ?? []).length > 0) && (
        <section
          className="rounded-2xl border-2 border-ink bg-white/80 px-3 py-2"
          aria-label="Race report"
        >
          <h2 className="font-display text-[17px] font-extrabold">
            Race report
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
                  {inc.atFault
                    ? `💥 You ran into u/${inc.with}`
                    : `💥 u/${inc.with} ran into you`}{' '}
                  at km {inc.km.toFixed(1)}
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
            ? 'Shared in comments'
            : p.sharing
              ? 'Posting…'
              : 'Share to comments'}
        </button>
        <button
          type="button"
          onClick={p.onLocker}
          className="chunky rounded-2xl bg-white py-2.5 font-display text-[17px] font-extrabold"
        >
          Locker 🏅 {profile.badges}
        </button>
      </div>

      <section className="rounded-2xl border-2 border-ink bg-white/80 px-2 py-2">
        <div className="flex items-baseline justify-between px-2">
          <h2 className="font-display text-[19px] font-extrabold">
            Today’s top 10
          </h2>
          {p.cheersReceived > 0 && (
            <span className="text-[12px] font-extrabold">
              👏 {p.cheersReceived} cheers for you
            </span>
          )}
        </div>
        <p className="px-2 text-[12px] text-ink-soft">
          {canCheer
            ? 'Send one cheer a day to another runner for +5 badges.'
            : 'Cheer sent today. Thanks for being a good sport!'}
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
      </section>

      <button
        type="button"
        onClick={p.onReplay}
        className="text-[13px] font-extrabold text-ink-soft underline"
      >
        Watch my run again
      </button>
      <p className="text-center text-[12px] text-ink-soft">
        A new stage opens every day at 00:00 UTC.
      </p>
    </div>
  );
};
