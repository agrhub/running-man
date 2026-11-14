import type { ReactNode } from 'react';
import type { Profile } from '../../shared/api';
import { COIN, CHECKIN_REWARDS, nextCheckInDay } from '../../shared/economy';
import { addDays } from '../../shared/content';
import type { QuestState } from '../../shared/quests';
import { tr } from '../i18n';

type Props = {
  today: string;
  profile: Profile;
  busy: boolean;
  onCheckIn: () => void;
  /** Quests, added below the check-in. */
  children?: ReactNode;
};

/** Daily check-in calendar: seven days, the reward grows, the seventh day is big. */
export const CheckInCard = ({
  today,
  profile,
  busy,
  onCheckIn,
}: Omit<Props, 'children'>) => {
  const done = profile.checkInDate === today;
  const guest = profile.username === 'guest';
  // The day that is (or would be) today's check-in.
  const current = done
    ? profile.checkInDay
    : nextCheckInDay(
        profile.checkInDate,
        profile.checkInDay,
        addDays(today, -1)
      );
  return (
    <section
      className="rounded-2xl border-2 border-ink bg-white/85 px-3 py-2.5"
      aria-label={tr('Daily check-in')}
    >
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-[19px] font-extrabold">
          {tr('Daily check-in')}
        </h2>
        <span className="text-[12px] font-extrabold text-ink-soft">
          {tr('Day {n} of 7', { n: current })}
        </span>
      </div>
      <ol className="mt-2 grid grid-cols-7 gap-1">
        {CHECKIN_REWARDS.map((coins, i) => {
          const day = i + 1;
          const claimed = day < current || (done && day === current);
          const isToday = day === current && !done;
          return (
            <li
              key={day}
              className={`flex flex-col items-center rounded-xl border-2 py-1 text-center ${claimed ? 'border-transparent bg-[var(--sky)] text-ink-soft' : isToday ? 'border-ink bg-gold' : 'border-ink/20 bg-white'} ${day === 7 ? 'font-extrabold' : ''}`}
              aria-label={`${tr('Day {n}: {coins} coins', { n: day, coins })}${claimed ? tr(', claimed') : isToday ? tr(', today') : ''}`}
            >
              <span className="text-[10px] font-extrabold">D{day}</span>
              <span className="text-[15px] leading-none" aria-hidden>
                {claimed ? '✓' : day === 7 ? '🎁' : COIN}
              </span>
              <span className="text-[11px] font-extrabold tabular">
                {coins}
              </span>
            </li>
          );
        })}
      </ol>
      <button
        type="button"
        disabled={busy || done || guest}
        onClick={onCheckIn}
        className="chunky mt-2 w-full rounded-2xl bg-[var(--accent)] py-2 font-display text-[17px] font-extrabold text-white"
      >
        {guest
          ? tr('Log in to check in')
          : done
            ? tr('Checked in. Come back tomorrow!')
            : tr('Check in for {n} {coin}', {
                n: CHECKIN_REWARDS[current - 1] ?? CHECKIN_REWARDS[0] ?? 0,
                coin: COIN,
              })}
      </button>
      <p className="mt-1 text-[11px] text-ink-soft">
        {tr(
          'Check in on days in a row to climb the calendar. Miss a day and it starts again from day 1.'
        )}
      </p>
    </section>
  );
};

export const QuestsScreen = (p: Props) => (
  <div className="flex flex-col gap-3 px-4 pt-4 pb-6 max-w-[440px] mx-auto">
    <header className="flex items-baseline justify-between">
      <h1 className="font-display text-[26px] font-extrabold">
        {tr('Quests')}
      </h1>
      <p className="font-display text-[18px] font-extrabold">
        {COIN} {p.profile.badges}
      </p>
    </header>
    <CheckInCard {...p} />
    {p.children}
  </div>
);

const QuestRow = ({
  q,
  busy,
  onClaim,
}: {
  q: QuestState;
  busy: boolean;
  onClaim: () => void;
}) => {
  const done = q.progress >= q.goal;
  return (
    <li
      className={`flex items-center gap-2 rounded-xl border-2 px-2.5 py-2 ${q.claimed ? 'border-transparent bg-[var(--sky)]' : done ? 'border-ink bg-white' : 'border-ink/20 bg-white'}`}
    >
      <div className="min-w-0 flex-1">
        <p
          className={`text-[13px] font-extrabold leading-tight ${q.claimed ? 'text-ink-soft line-through' : ''}`}
        >
          {tr(q.label)}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <div
            className="h-2 flex-1 overflow-hidden rounded-full border-2 border-ink bg-white"
            role="progressbar"
            aria-valuenow={q.progress}
            aria-valuemin={0}
            aria-valuemax={q.goal}
            aria-label={tr(q.label)}
          >
            <div
              className="h-full bg-[var(--accent)]"
              style={{ width: `${(q.progress / q.goal) * 100}%` }}
            />
          </div>
          <span className="text-[11px] font-extrabold tabular text-ink-soft">
            {q.progress}/{q.goal}
          </span>
        </div>
      </div>
      {q.claimed ? (
        <span className="w-[74px] text-center text-[12px] font-extrabold text-easy">
          {tr('Claimed ✓')}
        </span>
      ) : (
        <button
          type="button"
          disabled={busy || !done}
          onClick={onClaim}
          className={`chunky w-[74px] rounded-full py-1 text-[12px] font-extrabold ${done ? 'bg-gold' : 'bg-white text-ink-soft'}`}
          aria-label={tr('Claim {n} coins for {quest}', {
            n: q.reward,
            quest: tr(q.label),
          })}
        >
          +{q.reward} {COIN}
        </button>
      )}
    </li>
  );
};

/** Daily quests (same for everyone, reset at 00:00 UTC) and this week's quests. */
export const QuestList = ({
  quests,
  busy,
  onClaim,
}: {
  quests: QuestState[];
  busy: boolean;
  onClaim: (id: QuestState['id']) => void;
}) => {
  if (quests.length === 0)
    return (
      <p className="text-[13px] text-ink-soft">
        {tr('Log in to Reddit to get daily quests.')}
      </p>
    );
  return (
    <>
      {(['daily', 'weekly'] as const).map((scope) => (
        <section
          key={scope}
          aria-label={
            scope === 'daily' ? tr('Today’s quests') : tr('This week’s quests')
          }
        >
          <div className="mb-1 flex items-baseline justify-between">
            <h2 className="font-display text-[19px] font-extrabold">
              {scope === 'daily' ? tr('Today’s quests') : tr('This week')}
            </h2>
            <span className="text-[11px] font-bold text-ink-soft">
              {scope === 'daily'
                ? tr('New quests at 00:00 UTC')
                : tr('Resets with the new city')}
            </span>
          </div>
          <ul className="flex flex-col gap-1.5">
            {quests
              .filter((q) => q.scope === scope)
              .map((q) => (
                <QuestRow
                  key={q.id}
                  q={q}
                  busy={busy}
                  onClaim={() => onClaim(q.id)}
                />
              ))}
          </ul>
        </section>
      ))}
    </>
  );
};
