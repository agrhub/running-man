import type { Profile, TourRow, TourRunResponse } from '../../shared/api';
import { TERRAIN, TIMES } from '../../shared/content';
import { COIN } from '../../shared/economy';
import { formatTime } from '../../shared/sim';
import { TOUR, TOUR_KIND, TOUR_STAMP_REWARD } from '../../shared/tour';
import { WEATHER } from '../../shared/content';
import { WorldMap } from '../components/PlaceMap';

type Props = {
  profile: Profile;
  stops: TourRow[] | null;
  busy: boolean;
  /** The run you just finished, shown on top. */
  result: TourRunResponse | null;
  onUnlock: (id: string) => void;
  onRun: (id: string) => void;
  onBack: () => void;
};

/** World Tour: famous places to unlock with coins and run any time. */
export const TourScreen = ({
  profile,
  stops,
  busy,
  result,
  onUnlock,
  onRun,
  onBack,
}: Props) => {
  const stamps = profile.tourStamps.length;
  const done = result ? TOUR.find((s) => s.id === result.id) : undefined;
  return (
    <div className="flex flex-col gap-3 px-4 pt-3 pb-6 max-w-[440px] mx-auto">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="chunky rounded-full bg-white px-3 py-1 text-[13px] font-extrabold"
        >
          ← Play
        </button>
        <p className="font-display text-[18px] font-extrabold">
          {COIN} {profile.badges}
        </p>
      </div>
      <header>
        <h1 className="font-display text-[26px] font-extrabold leading-tight">
          🌍 World Tour
        </h1>
        <p className="text-[13px] leading-snug text-ink-soft">
          Famous places to run any time, as often as you like. Unlock a place
          with coins; your first finish there stamps your passport (+
          {TOUR_STAMP_REWARD} {COIN}). Tour runs never count for the daily
          stage.
        </p>
        <p
          className="mt-1 text-[13px] font-extrabold"
          aria-label={`${stamps} of ${TOUR.length} passport stamps`}
        >
          🛂 Passport: {stamps} / {TOUR.length}{' '}
          <span aria-hidden>
            {TOUR.map((s) =>
              profile.tourStamps.includes(s.id) ? s.flag : '·'
            )}
          </span>
        </p>
      </header>

      <WorldMap
        label={`World map of the ${TOUR.length} World Tour places; ${stamps} stamped.`}
        pins={TOUR.flatMap((s) =>
          s.stage.landmark.at
            ? [
                {
                  at: s.stage.landmark.at,
                  tone: profile.tourStamps.includes(s.id)
                    ? ('done' as const)
                    : profile.tourUnlocked.includes(s.id)
                      ? ('now' as const)
                      : ('other' as const),
                  title: `${s.stage.landmark.name}, ${s.country}`,
                },
              ]
            : []
        )}
      />
      <p className="-mt-1 text-[11px] font-bold text-ink-soft">
        <span style={{ color: '#3fae6a' }}>●</span> stamped{' '}
        <span style={{ color: '#ff5d8f' }}>●</span> unlocked ○ locked
      </p>

      {result && done && (
        <section
          className="bib bib-pins px-3 pt-5 pb-3"
          aria-label="Your World Tour run"
        >
          <p className="text-[13px] font-extrabold text-ink-soft">
            {done.flag} {done.stage.landmark.name}
          </p>
          <p className="font-display text-[34px] font-extrabold leading-none">
            {formatTime(result.seconds)}
          </p>
          <p className="mt-1 text-[13px] font-bold">
            {result.improved
              ? `New best! #${result.rank} of ${result.total} here.`
              : `Your best stays ${formatTime(result.best)} (#${result.rank} of ${result.total}).`}
          </p>
          {result.stamped && (
            <p className="mt-1 text-[13px] font-extrabold text-easy">
              🛂 Passport stamped: +{result.reward} {COIN}
            </p>
          )}
        </section>
      )}

      <ul className="flex flex-col gap-2" aria-label="World Tour places">
        {TOUR.map((stop) => {
          const row = stops?.find((r) => r.id === stop.id);
          const unlocked =
            row?.unlocked ?? profile.tourUnlocked.includes(stop.id);
          const stamped = profile.tourStamps.includes(stop.id);
          const kind = TOUR_KIND[stop.kind];
          const canBuy = profile.badges >= stop.cost;
          return (
            <li
              key={stop.id}
              className={`rounded-2xl border-2 px-3 py-2 ${unlocked ? 'border-ink bg-white' : 'border-ink/25 bg-white/70'}`}
            >
              <div className="flex items-start gap-2">
                <span className="text-[26px] leading-none" aria-hidden>
                  {stop.flag}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-[17px] font-extrabold leading-tight">
                    {stop.stage.landmark.name}
                    {stamped && (
                      <span className="ml-1 text-[13px]" title="Stamped">
                        🛂
                      </span>
                    )}
                  </p>
                  <p className="text-[12px] font-bold text-ink-soft">
                    {kind.icon} {kind.label} · {stop.place}, {stop.country}
                  </p>
                  <p className="text-[12px] leading-snug">
                    {stop.stage.landmark.blurb}
                  </p>
                  <p className="mt-0.5 text-[11px] font-bold text-ink-soft">
                    {TERRAIN[stop.stage.terrain].icon}{' '}
                    {TERRAIN[stop.stage.terrain].label} ·{' '}
                    {WEATHER[stop.weather].icon} {WEATHER[stop.weather].label} ·{' '}
                    {TIMES[stop.time].icon} {TIMES[stop.time].label}
                  </p>
                  {row && (row.best !== null || row.top) && (
                    <p className="mt-0.5 text-[11px] font-bold">
                      {row.best !== null &&
                        `Your best ${formatTime(row.best)} (#${row.rank} of ${row.runners})`}
                      {row.best !== null && row.top && ' · '}
                      {row.top &&
                        `Record ${formatTime(row.top.seconds)} by u/${row.top.username}`}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-1.5 flex justify-end">
                {unlocked ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onRun(stop.id)}
                    className="chunky rounded-full bg-[var(--accent)] px-4 py-1 text-[14px] font-extrabold text-white"
                  >
                    Run here
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy || !canBuy}
                    onClick={() => onUnlock(stop.id)}
                    className="chunky rounded-full bg-gold px-4 py-1 text-[14px] font-extrabold"
                  >
                    Unlock {stop.cost} {COIN}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
