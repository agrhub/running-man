import type { ReactNode } from 'react';
import type { Profile } from '../../shared/api';
import { COIN, CHECKIN_REWARDS, nextCheckInDay } from '../../shared/economy';
import { addDays } from '../../shared/content';

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
      aria-label="Daily check-in"
    >
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-[19px] font-extrabold">
          Daily check-in
        </h2>
        <span className="text-[12px] font-extrabold text-ink-soft">
          Day {current} of 7
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
              aria-label={`Day ${day}: ${coins} coins${claimed ? ', claimed' : isToday ? ', today' : ''}`}
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
          ? 'Log in to check in'
          : done
            ? 'Checked in. Come back tomorrow!'
            : `Check in for ${CHECKIN_REWARDS[current - 1] ?? CHECKIN_REWARDS[0]} ${COIN}`}
      </button>
      <p className="mt-1 text-[11px] text-ink-soft">
        Check in on days in a row to climb the calendar. Miss a day and it
        starts again from day 1.
      </p>
    </section>
  );
};

export const QuestsScreen = (p: Props) => (
  <div className="flex flex-col gap-3 px-4 pt-4 pb-6 max-w-[440px] mx-auto">
    <header className="flex items-baseline justify-between">
      <h1 className="font-display text-[26px] font-extrabold">Quests</h1>
      <p className="font-display text-[18px] font-extrabold">
        {COIN} {p.profile.badges}
      </p>
    </header>
    <CheckInCard {...p} />
    {p.children}
  </div>
);
