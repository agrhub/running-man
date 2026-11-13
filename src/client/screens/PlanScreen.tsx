import { useMemo, useState } from 'react';
import type { CrewProgress, DayRecap, Profile } from '../../shared/api';
import {
  LEG_LABEL,
  TERRAIN,
  TIMES,
  isTriathlon,
  legAt,
  type DayInfo,
} from '../../shared/content';
import {
  PACES,
  PACE_LABEL,
  simulate,
  type Pace,
  type Plan,
} from '../../shared/sim';
import { CourseProfile } from '../components/CourseProfile';
import { CrewBar } from '../components/CrewBar';
import { YesterdayCard } from '../components/YesterdayCard';
import { holidayBanner } from '../../shared/festive';
import { PACE_COLOR, PACE_HINT } from '../lib/theme';

type Props = {
  day: DayInfo;
  profile: Profile;
  crew: CrewProgress;
  totalRunners: number;
  yesterday?: DayRecap | null;
  starting: boolean;
  onStart: (plan: Plan) => void;
  onLocker: () => void;
};

const nextPace = (p: Pace): Pace =>
  PACES[(PACES.indexOf(p) + 1) % PACES.length] ?? 'steady';

const legsVerdict = (
  finalStamina: number,
  walked: number
): { text: string; tone: string } => {
  if (walked > 0)
    return {
      text: 'You run out of stamina and walk. Ease off somewhere.',
      tone: 'text-push',
    };
  if (finalStamina < 10)
    return { text: 'Legs empty at the line. Bold!', tone: 'text-ink' };
  if (finalStamina < 35)
    return { text: 'Tired legs at the finish.', tone: 'text-ink' };
  return {
    text: 'Lots left in the tank. Could you push more?',
    tone: 'text-ink-soft',
  };
};

export const PlanScreen = ({
  day,
  profile,
  crew,
  totalRunners,
  yesterday,
  starting,
  onStart,
  onLocker,
}: Props) => {
  const { stage, weather, city } = day;
  const tri = isTriathlon(day);
  const [paces, setPaces] = useState<Pace[]>(() =>
    stage.grades.map(() => 'steady')
  );
  const [drinks, setDrinks] = useState<number[]>(() => [...stage.waterAfterKm]);
  const [showTip, setShowTip] = useState(profile.totalRuns === 0);

  const projection = useMemo(
    () =>
      simulate(
        stage,
        weather.id,
        { paces, drinks },
        day.time,
        isTriathlon(day)
      ),
    [stage, weather.id, paces, drinks, day]
  );
  const last = projection.splits.at(-1);
  const verdict = legsVerdict(last?.stamina ?? 0, projection.walkedKm);

  const toggleDrink = (km: number) =>
    setDrinks((d) =>
      d.includes(km)
        ? d.filter((x) => x !== km)
        : [...d, km].sort((a, b) => a - b)
    );

  return (
    <div className="flex min-h-full flex-col justify-center gap-3 px-4 pt-3 pb-4 max-w-[440px] mx-auto">
      <header className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[13px] font-extrabold text-ink-soft">
            {city.flag} {city.name}, stage {day.stageIndex + 1} of 7 ·{' '}
            {TERRAIN[stage.terrain].icon} {TERRAIN[stage.terrain].label}
          </p>
          <h1 className="font-display text-[30px] leading-[1.05] font-extrabold">
            {stage.name}
          </h1>
        </div>
        <button
          type="button"
          onClick={onLocker}
          className="chunky shrink-0 rounded-2xl bg-white px-3 py-1.5 text-[13px] font-extrabold"
        >
          🪙 {profile.badges}
          <span className="block text-[11px] font-semibold text-ink-soft">
            Shop
          </span>
        </button>
      </header>

      <div className="flex items-center gap-2 rounded-2xl border-2 border-ink bg-white/70 px-3 py-2">
        <span className="text-2xl" aria-hidden>
          {weather.icon}
        </span>
        <p className="text-[13px] leading-tight">
          <strong className="font-extrabold">{weather.label}.</strong>{' '}
          {weather.hint}
          <span className="mt-0.5 block">
            <strong className="font-extrabold">
              {TIMES[day.time].icon} {TIMES[day.time].label},{' '}
              {TIMES[day.time].clock}.
            </strong>{' '}
            {TIMES[day.time].hint}
          </span>
        </p>
      </div>

      {tri && (
        <section
          className="rounded-2xl border-2 border-ink bg-[#e3f6ff] px-3 py-2"
          aria-label="Triathlon finale"
        >
          <p className="font-display text-[18px] font-extrabold leading-tight">
            🏊 🚴 🏃 Triathlon Finale
          </p>
          <p className="text-[13px] leading-snug">
            The last stage of the week: swim the first km, bike the next three,
            run the last two. Each change costs 30 seconds. Swimming drains
            stamina fast; your legs recover a little on the bike.
          </p>
        </section>
      )}

      {holidayBanner(day.dateKey) && (
        <p className="rounded-2xl border-2 border-ink bg-[#e9f6ff] px-3 py-2 text-[13px] font-bold">
          {holidayBanner(day.dateKey)}
        </p>
      )}

      <section className="bib bib-pins px-3 pt-5 pb-3" aria-label="Race plan">
        <CourseProfile
          stage={stage}
          splits={projection.splits}
          drinks={drinks}
        />
        <div className="relative mt-2 grid grid-cols-6 gap-1.5">
          {paces.map((p, i) => (
            <button
              key={i}
              type="button"
              className="chunky flex flex-col items-center rounded-xl py-1.5 text-white"
              style={{ background: PACE_COLOR[p] }}
              onClick={() => {
                setShowTip(false);
                setPaces((ps) => ps.map((x, j) => (j === i ? nextPace(x) : x)));
              }}
              aria-label={`Km ${i + 1}: ${PACE_LABEL[p]}. Tap to change.`}
            >
              <span className="text-[10px] font-extrabold opacity-90">
                {tri ? `${LEG_LABEL[legAt(true, i)].icon} ` : ''}km {i + 1}
              </span>
              <span className="font-display text-[14px] font-extrabold leading-none">
                {PACE_LABEL[p]}
              </span>
            </button>
          ))}
          {showTip && (
            <div className="pop-in absolute top-full z-10 mt-2 left-0 right-0 mx-auto w-[92%] rounded-xl bg-ink px-3 py-2 text-center text-[12px] font-bold text-white shadow-lg">
              Tap a km to switch pace. Push is fast but drains stamina (the gold
              line).
            </div>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px]">
          <span className="font-extrabold">Water:</span>
          {stage.waterAfterKm.map((km) => (
            <button
              key={km}
              type="button"
              aria-pressed={drinks.includes(km)}
              onClick={() => toggleDrink(km)}
              className={`rounded-full border-2 border-ink px-2 py-0.5 font-extrabold ${drinks.includes(km) ? 'bg-water text-white' : 'bg-white text-ink-soft line-through'}`}
            >
              💧 after km {km}
            </button>
          ))}
          <span className="text-ink-soft">Each stop costs a few seconds.</span>
        </div>
        <p className={`mt-2 text-[13px] font-bold ${verdict.tone}`}>
          {verdict.text}
        </p>
        <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-ink-soft">
          {PACES.map((p) => (
            <li key={p} className="flex items-center gap-1 whitespace-nowrap">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: PACE_COLOR[p] }}
              />
              {PACE_HINT[p]}
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-col gap-3">
        <CrewBar crew={crew} runners={totalRunners} />
        <button
          type="button"
          disabled={starting}
          onClick={() => onStart({ paces, drinks })}
          className="chunky w-full rounded-2xl bg-[var(--accent)] py-3 font-display text-[22px] font-extrabold text-white"
        >
          {starting ? 'Lacing up…' : 'Start the race'}
        </button>
        {yesterday && <YesterdayCard recap={yesterday} />}
      </div>
    </div>
  );
};
