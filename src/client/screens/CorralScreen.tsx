import { useState } from 'react';
import type { Profile, RunnerTrack } from '../../shared/api';
import { GUESS_WINDOW } from '../../shared/economy';
import { formatTime } from '../../shared/sim';
import { Avatar } from '../components/Avatar';
import type { DayInfo } from '../../shared/content';
import type { Lane } from '../../shared/course';
import { startLane } from '../../shared/race';
import { RunnerPreview } from '../components/RunnerPreview';

type Props = {
  day: DayInfo;
  profile: Profile;
  runners: RunnerTrack[];
  /** The plan's projected finish time, before steering and crashes. */
  projected: number;
  onGo: (guess: number) => void;
  onBack: () => void;
};

const LANE_NAME: Record<Lane, string> = {
  [-1]: 'left',
  0: 'middle',
  1: 'right',
};

const bibText = (bib: number | null | undefined) =>
  bib ? `#${String(bib).padStart(4, '0')}` : 'new';

/** The start corral: your bib, your start lane and who is on the road with you. */
export const CorralScreen = ({
  day,
  profile,
  runners,
  projected,
  onGo,
  onBack,
}: Props) => {
  const [guess, setGuess] = useState(Math.round(projected));
  const nudge = (d: number) =>
    setGuess((g) =>
      Math.max(
        Math.round(projected) - GUESS_WINDOW,
        Math.min(Math.round(projected) + GUESS_WINDOW, g + d)
      )
    );
  const lane = startLane(profile.username);
  const field = runners.length;
  return (
    <div className="flex h-full flex-col max-w-[440px] mx-auto">
      <header className="flex items-center justify-between px-4 pt-3">
        <button
          type="button"
          onClick={onBack}
          className="chunky rounded-full bg-white px-3 py-1 text-[13px] font-extrabold"
        >
          ← Plan
        </button>
        <p className="text-[13px] font-extrabold text-ink-soft">
          {day.city.flag} {day.stage.name}
        </p>
      </header>

      <div className="relative h-[34%] min-h-[180px]">
        <RunnerPreview
          day={day}
          look={profile.look}
          bib={profile.bib}
          showBack
        />
      </div>

      <div className="flex-1 overflow-y-auto px-4">
        <section className="bib bib-pins px-4 pt-6 pb-3 text-center">
          <p className="text-[13px] font-extrabold text-ink-soft">
            Start corral
          </p>
          <p className="font-display text-[44px] font-extrabold leading-none tabular text-[var(--accent)] [text-shadow:0_3px_0_#2a2340]">
            {bibText(profile.bib)}
          </p>
          <p className="mt-1 flex items-center justify-center gap-2 font-display text-[17px] font-extrabold">
            <Avatar name={profile.username} size={30} ring />
            u/{profile.username}
          </p>
          <p className="mt-2 text-[14px]">
            You start in the <strong>{LANE_NAME[lane]} lane</strong>
            {field > 0
              ? `, with ${field} ${field === 1 ? 'runner' : 'runners'} from today on the road.`
              : '. Nobody has run today yet: the road is yours.'}
          </p>
        </section>

        {field > 0 && (
          <section className="mt-3 rounded-2xl border-2 border-ink bg-white/80 px-3 py-2">
            <h2 className="text-[13px] font-extrabold">On the road with you</h2>
            <ul className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[13px]">
              {runners.slice(0, 12).map((r) => (
                <li
                  key={r.username}
                  className="flex justify-between gap-2 truncate"
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <Avatar name={r.username} size={18} />
                    <span className="truncate">u/{r.username}</span>
                  </span>
                  <span className="tabular text-ink-soft">
                    {bibText(r.bib)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section
          className="mt-3 rounded-2xl border-2 border-ink bg-white/85 px-3 py-2"
          aria-label="Call your time"
        >
          <h2 className="text-[13px] font-extrabold">🔮 Call your time</h2>
          <p className="text-[12px] leading-snug text-ink-soft">
            Your plan says {formatTime(projected)}. Snacks, cones and crashes
            will change it: guess your finish. Within 10 s pays {30} 🪙, within
            3 s pays {60} 🪙.
          </p>
          <div className="mt-1.5 flex items-center justify-center gap-1.5">
            {[-30, -5].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => nudge(d)}
                className="chunky rounded-xl bg-white px-2.5 py-1 text-[13px] font-extrabold"
                aria-label={`${-d} seconds faster`}
              >
                {d}s
              </button>
            ))}
            <output
              className="w-[92px] text-center font-display text-[28px] font-extrabold tabular"
              aria-live="polite"
              aria-label="Your guess"
            >
              {formatTime(guess)}
            </output>
            {[5, 30].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => nudge(d)}
                className="chunky rounded-xl bg-white px-2.5 py-1 text-[13px] font-extrabold"
                aria-label={`${d} seconds slower`}
              >
                +{d}s
              </button>
            ))}
          </div>
        </section>

        <ul className="mt-3 flex flex-col gap-1 text-[13px]">
          <li>◀ ▶ Swipe or tap to change lanes.</li>
          <li>
            🚧 Cones, puddles and cups cost seconds. 🍬 Snacks and 🙌 high fives
            speed you up.
          </li>
          <li>💥 Run into a runner and you both fall.</li>
        </ul>
      </div>

      <div className="px-4 pt-2 pb-4">
        <button
          type="button"
          onClick={() => onGo(guess)}
          className="chunky w-full rounded-2xl bg-[var(--accent)] py-3 font-display text-[22px] font-extrabold text-white"
        >
          Line up at the start
        </button>
      </div>
    </div>
  );
};
