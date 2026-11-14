import { ChallengedBy } from '../components/Challenges';
import { Chip, Sheet } from '../components/Sheet';
import { formatTime } from '../../shared/sim';
import type { Challenge } from '../../shared/challenge';
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
import { RouteMap } from '../components/RouteMap';
import { StageMaps } from '../components/StageMaps';
import { CrewBar } from '../components/CrewBar';
import { YesterdayCard } from '../components/YesterdayCard';
import { holidayBanner } from '../../shared/festive';
import { PACE_COLOR, PACE_HINT } from '../lib/theme';
import { tr } from '../i18n';

type Props = {
  day: DayInfo;
  profile: Profile;
  /** The daily crew goal; a World Tour run has none. */
  crew?: CrewProgress;
  totalRunners?: number;
  /** World Tour: the place's name replaces the daily stage line. */
  tour?: { label: string; stopId: string; onBack: () => void };
  yesterday?: DayRecap | null;
  /** Runners who challenged you today. */
  challenges?: Challenge[];
  /** Whether people, traffic and animals are on the road today. */
  roadLife: boolean;
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
  challenges = [],
  tour,
  roadLife,
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
  const [sheet, setSheet] = useState<
    null | 'today' | 'maps' | 'yesterday' | 'challenges' | 'pacing'
  >(null);
  const closeSheet = () => setSheet(null);
  const holiday = holidayBanner(day.dateKey);

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
    <div className="flex min-h-full flex-col justify-center gap-3 px-4 pt-3 pb-4 short:gap-2 short:pt-2 short:pb-2 max-w-[440px] mx-auto">
      <header className="flex items-start justify-between gap-2">
        <div>
          {tour ? (
            <button
              type="button"
              onClick={tour.onBack}
              className="text-[13px] font-extrabold text-ink-soft"
            >
              ← {tour.label} · {TERRAIN[stage.terrain].icon}{' '}
              {tr(TERRAIN[stage.terrain].label)}
            </button>
          ) : (
            <p className="text-[13px] font-extrabold text-ink-soft">
              {city.flag}{' '}
              {tr('{city}, stage {n} of 7', {
                city: tr(city.name),
                n: day.stageIndex + 1,
              })}{' '}
              · {TERRAIN[stage.terrain].icon} {tr(TERRAIN[stage.terrain].label)}
            </p>
          )}
          <h1 className="font-display text-[30px] leading-[1.05] font-extrabold">
            {tr(stage.name)}
          </h1>
        </div>
        <button
          type="button"
          onClick={onLocker}
          className="chunky shrink-0 rounded-2xl bg-white px-3 py-1.5 text-[13px] font-extrabold"
        >
          🪙 {profile.badges}
          <span className="block text-[11px] font-semibold text-ink-soft">
            {tr('Shop')}
          </span>
        </button>
      </header>

      <div className="flex flex-wrap gap-1.5" aria-label={tr('About today')}>
        <Chip
          icon={weather.icon}
          label={tr(weather.label)}
          onClick={() => setSheet('today')}
        />
        <Chip
          icon={TIMES[day.time].icon}
          label={TIMES[day.time].clock}
          onClick={() => setSheet('today')}
        />
        {tri && (
          <Chip
            icon="🏊"
            label={tr('Triathlon')}
            tone="blue"
            onClick={() => setSheet('today')}
          />
        )}
        {holiday && (
          <Chip
            icon="❄️"
            label={tr('Holiday')}
            tone="blue"
            onClick={() => setSheet('today')}
          />
        )}
        <Chip icon="🗺️" label={tr('Maps')} onClick={() => setSheet('maps')} />
        {yesterday && (
          <Chip
            icon="🥇"
            label={tr('Yesterday')}
            onClick={() => setSheet('yesterday')}
          />
        )}
      </div>

      {challenges.length > 0 && (
        <button
          type="button"
          onClick={() => setSheet('challenges')}
          className="chunky rounded-2xl bg-[#fff4cf] px-3 py-1.5 text-left text-[13px] font-extrabold"
        >
          🏁{' '}
          {challenges.length === 1
            ? tr('u/{name} challenged you: beat {time}!', {
                name: challenges[0]!.from,
                time: formatTime(challenges[0]!.seconds),
              })
            : tr('{n} runners challenged you. Fastest to beat: {time}', {
                n: challenges.length,
                time: formatTime(Math.min(...challenges.map((c) => c.seconds))),
              })}
        </button>
      )}

      <section
        className="bib bib-pins px-3 pt-5 pb-3"
        aria-label={tr('Race plan')}
      >
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
              aria-label={tr('Km {n}: {pace}. Tap to change.', {
                n: i + 1,
                pace: tr(PACE_LABEL[p]),
              })}
            >
              <span className="text-[10px] font-extrabold opacity-90">
                {tri ? `${LEG_LABEL[legAt(true, i)].icon} ` : ''}km {i + 1}
              </span>
              <span className="font-display text-[14px] font-extrabold leading-none">
                {tr(PACE_LABEL[p])}
              </span>
            </button>
          ))}
          {showTip && (
            <div className="pop-in absolute top-full z-10 mt-2 left-0 right-0 mx-auto w-[92%] rounded-xl bg-ink px-3 py-2 text-center text-[12px] font-bold text-white shadow-lg">
              {tr(
                'Tap a km to switch pace. Push is fast but drains stamina (the gold line).'
              )}
            </div>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px]">
          <span className="font-extrabold">{tr('Water:')}</span>
          {stage.waterAfterKm.map((km) => (
            <button
              key={km}
              type="button"
              aria-pressed={drinks.includes(km)}
              onClick={() => toggleDrink(km)}
              className={`rounded-full border-2 border-ink px-2 py-0.5 font-extrabold ${drinks.includes(km) ? 'bg-water text-white' : 'bg-white text-ink-soft line-through'}`}
            >
              {tr('💧 after km {n}', { n: km })}
            </button>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className={`text-[13px] font-bold ${verdict.tone}`}>
            {tr(verdict.text)}
          </p>
          <button
            type="button"
            onClick={() => setSheet('pacing')}
            aria-label={tr('How pacing works')}
            className="chunky grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-[13px] font-extrabold"
          >
            ?
          </button>
        </div>
      </section>

      <div className="flex flex-col gap-3">
        {crew && <CrewBar crew={crew} runners={totalRunners ?? 0} />}
        <button
          type="button"
          disabled={starting}
          onClick={() => onStart({ paces, drinks })}
          className="chunky w-full rounded-2xl bg-[var(--accent)] py-3 font-display text-[22px] font-extrabold text-white"
        >
          {starting ? tr('Lacing up…') : tr('Start the race')}
        </button>
      </div>

      <Sheet
        open={sheet === 'today'}
        title={tr('Today on the road')}
        onClose={closeSheet}
      >
        <p className="text-[14px] leading-snug">
          <span aria-hidden>{weather.icon}</span>{' '}
          <strong className="font-extrabold">{tr(weather.label)}.</strong>{' '}
          {tr(weather.hint)}
        </p>
        <p className="text-[14px] leading-snug">
          <strong className="font-extrabold">
            {TIMES[day.time].icon} {tr(TIMES[day.time].label)},{' '}
            {TIMES[day.time].clock}.
          </strong>{' '}
          {tr(TIMES[day.time].hint)}
        </p>
        {tri && (
          <section
            className="rounded-2xl border-2 border-ink bg-[#e3f6ff] px-3 py-2"
            aria-label={tr('Triathlon finale')}
          >
            <p className="font-display text-[17px] font-extrabold leading-tight">
              {tr('🏊 🚴 🏃 Triathlon Finale')}
            </p>
            <p className="text-[13px] leading-snug">
              {tr(
                'The last stage of the week: swim the first km, bike the next three, run the last two. Each change costs 30 seconds. Swimming drains stamina fast; your legs recover a little on the bike.'
              )}
            </p>
          </section>
        )}
        {holiday && (
          <p className="rounded-2xl border-2 border-ink bg-[#e9f6ff] px-3 py-2 text-[13px] font-bold">
            {tr(holiday)}
          </p>
        )}
      </Sheet>

      <Sheet
        open={sheet === 'maps'}
        title={tr('🗺️ Where you run')}
        onClose={closeSheet}
      >
        <section className="flex flex-col gap-2" aria-label={tr('Maps')}>
          <StageMaps
            day={day}
            tourId={tour?.stopId}
            stamps={profile.tourStamps}
          />
          <h3 className="font-display text-[15px] font-extrabold">
            {tr('Today’s 6 km')}
          </h3>
          <RouteMap day={day} drinks={drinks} life={roadLife} />
        </section>
      </Sheet>

      <Sheet
        open={sheet === 'yesterday'}
        title={tr('Yesterday’s stage')}
        onClose={closeSheet}
      >
        {yesterday && <YesterdayCard recap={yesterday} />}
      </Sheet>

      <Sheet
        open={sheet === 'challenges'}
        title={tr('Challenges for you')}
        onClose={closeSheet}
      >
        <ChallengedBy challenges={challenges} />
      </Sheet>

      <Sheet
        open={sheet === 'pacing'}
        title={tr('How pacing works')}
        onClose={closeSheet}
      >
        <p className="text-[14px] leading-snug">
          {tr(
            'Tap a km to switch pace. Push is fast but drains stamina (the gold line).'
          )}
        </p>
        <ul className="flex flex-col gap-1 text-[14px]">
          {PACES.map((p) => (
            <li key={p} className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ background: PACE_COLOR[p] }}
              />
              {tr(PACE_HINT[p])}
            </li>
          ))}
        </ul>
        <p className="text-[14px] leading-snug">
          {tr('Each stop costs a few seconds.')}
        </p>
      </Sheet>
    </div>
  );
};
