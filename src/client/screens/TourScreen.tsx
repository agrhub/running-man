import type { Profile, TourRow, TourRunResponse } from '../../shared/api';
import { TERRAIN, TIMES } from '../../shared/content';
import { COIN } from '../../shared/economy';
import { formatTime } from '../../shared/sim';
import {
  TOUR,
  TOUR_KIND,
  TOUR_STAMP_REWARD,
  TOUR_WEEK_PRIZES,
  featuredDaysLeft,
  featuredStop,
} from '../../shared/tour';
import { WEATHER } from '../../shared/content';
import { WorldMap } from '../components/PlaceMap';
import { tr } from '../i18n';
import { useState } from 'react';
import { Chip, Sheet } from '../components/Sheet';
import type { TourStop } from '../../shared/tour';

type Props = {
  profile: Profile;
  stops: TourRow[] | null;
  /** Today (UTC date key): picks the free stop of the week. */
  today: string;
  /** The fastest runners at the free stop this week. */
  week: { username: string; seconds: number }[];
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
  today,
  week,
  busy,
  result,
  onUnlock,
  onRun,
  onBack,
}: Props) => {
  const stamps = profile.tourStamps.length;
  const done = result ? TOUR.find((s) => s.id === result.id) : undefined;
  const free = featuredStop(today);
  const daysLeft = featuredDaysLeft(today);
  const freeOwned = profile.tourUnlocked.includes(free.id);
  const [sheet, setSheet] = useState<null | 'map' | 'about' | 'free'>(null);
  const [open, setOpen] = useState<TourStop | null>(null);
  const closeSheet = () => setSheet(null);
  const rowOf = (id: string) => stops?.find((r) => r.id === id);
  const isUnlocked = (id: string) =>
    rowOf(id)?.unlocked ??
    (profile.tourUnlocked.includes(id) || id === free.id);

  return (
    <div className="flex min-h-full flex-col justify-center gap-2.5 px-4 pt-3 pb-4 short:gap-2 short:pt-2 short:pb-2 max-w-[440px] mx-auto">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="chunky rounded-full bg-white px-3 py-1 text-[13px] font-extrabold"
        >
          {tr('← Play')}
        </button>
        <p className="font-display text-[18px] font-extrabold">
          {COIN} {profile.badges}
        </p>
      </div>
      <header className="flex items-end justify-between gap-2">
        <div>
          <h1 className="font-display text-[24px] font-extrabold leading-tight">
            {tr('🌍 World Tour')}
          </h1>
          <p
            className="text-[13px] font-extrabold"
            aria-label={tr('{n} of {total} passport stamps', {
              n: stamps,
              total: TOUR.length,
            })}
          >
            🛂 {tr('Passport:')} {stamps} / {TOUR.length}
          </p>
        </div>
        <div className="flex gap-1.5">
          <Chip icon="🗺️" label={tr('Map')} onClick={() => setSheet('map')} />
          <Chip
            icon="❔"
            label={tr('How it works')}
            onClick={() => setSheet('about')}
          />
        </div>
      </header>

      {result && done ? (
        <section
          className="bib bib-pins px-3 pt-4 pb-2"
          aria-label={tr('Your World Tour run')}
        >
          <p className="text-[13px] font-extrabold text-ink-soft">
            {done.flag} {tr(done.stage.landmark.name)}
          </p>
          <p className="font-display text-[30px] font-extrabold leading-none">
            {formatTime(result.seconds)}
          </p>
          <p className="mt-1 text-[13px] font-bold">
            {result.improved
              ? tr('New best! #{rank} of {total} here.', {
                  rank: result.rank,
                  total: result.total,
                })
              : tr('Your best stays {time} (#{rank} of {total}).', {
                  time: formatTime(result.best),
                  rank: result.rank,
                  total: result.total,
                })}
            {result.stamped && (
              <span className="ml-1 font-extrabold text-easy">
                🛂 {tr('Passport stamped: +{n}', { n: result.reward })} {COIN}
              </span>
            )}
          </p>
        </section>
      ) : (
        <section
          className="chunky rounded-2xl bg-[#fff4cf] px-3 py-2"
          aria-label={tr('Free this week')}
        >
          <p className="text-[12px] font-extrabold text-ink-soft">
            ⭐ {tr('Free this week')} ·{' '}
            {daysLeft === 1
              ? tr('last day')
              : tr('{n} days left', { n: daysLeft })}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-[28px] leading-none" aria-hidden>
              {free.flag}
            </span>
            <button
              type="button"
              onClick={() => setSheet('free')}
              className="min-w-0 flex-1 text-left"
            >
              <span className="block font-display text-[18px] font-extrabold leading-tight">
                {tr(free.stage.landmark.name)}
              </span>
              <span className="block text-[12px] font-bold text-ink-soft underline">
                {week.length > 0
                  ? tr('This week’s leaders')
                  : tr(
                      'The fastest three this week win {a}, {b} and {c} {coin} on Monday.',
                      {
                        a: TOUR_WEEK_PRIZES[0]!,
                        b: TOUR_WEEK_PRIZES[1]!,
                        c: TOUR_WEEK_PRIZES[2]!,
                        coin: COIN,
                      }
                    )}
              </span>
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onRun(free.id)}
              className="chunky shrink-0 rounded-full bg-[var(--accent)] px-4 py-1 text-[14px] font-extrabold text-white"
            >
              {tr('Run here')}
            </button>
          </div>
        </section>
      )}

      <ul
        className="grid grid-cols-4 gap-1.5"
        aria-label={tr('World Tour places')}
      >
        {TOUR.map((stop) => {
          const stamped = profile.tourStamps.includes(stop.id);
          const unlocked = isUnlocked(stop.id);
          return (
            <li key={stop.id}>
              <button
                type="button"
                onClick={() => setOpen(stop)}
                aria-label={`${tr(stop.stage.landmark.name)}: ${
                  stamped
                    ? tr('Stamped')
                    : unlocked
                      ? tr('Run here')
                      : tr('Unlock {n}', { n: stop.cost })
                }`}
                className={`flex h-[58px] short:h-[52px] w-full flex-col items-center justify-center rounded-xl border-2 px-0.5 ${
                  stop.id === free.id
                    ? 'border-ink bg-[#fff4cf]'
                    : unlocked
                      ? 'border-ink bg-white'
                      : 'border-ink/25 bg-white/60'
                }`}
              >
                <span className="text-[18px] leading-none" aria-hidden>
                  {stop.flag}
                  {stamped ? '🛂' : ''}
                </span>
                <span className="mt-0.5 w-full truncate text-center text-[10px] font-extrabold leading-tight">
                  {tr(stop.stage.landmark.name)}
                </span>
                <span className="text-[10px] font-bold leading-tight text-ink-soft">
                  {stop.id === free.id
                    ? `⭐ ${tr('Free')}`
                    : unlocked
                      ? tr('Run here')
                      : `${COIN} ${stop.cost}`}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <Sheet
        open={sheet === 'map'}
        title={tr('🌍 World Tour')}
        onClose={closeSheet}
      >
        <WorldMap
          label={`World map of the ${TOUR.length} World Tour places; ${stamps} stamped.`}
          pins={TOUR.flatMap((s) =>
            s.stage.landmark.at
              ? [
                  {
                    at: s.stage.landmark.at,
                    tone: profile.tourStamps.includes(s.id)
                      ? ('done' as const)
                      : isUnlocked(s.id)
                        ? ('now' as const)
                        : ('other' as const),
                    title: `${tr(s.stage.landmark.name)}, ${s.country}`,
                  },
                ]
              : []
          )}
        />
        <p className="text-[11px] font-bold text-ink-soft">
          <span style={{ color: '#3fae6a' }}>●</span> {tr('stamped')}{' '}
          <span style={{ color: '#ff5d8f' }}>●</span> {tr('unlocked ○ locked')}
        </p>
        <p className="text-[13px] font-extrabold" aria-hidden>
          {TOUR.map((s) => (profile.tourStamps.includes(s.id) ? s.flag : '·'))}
        </p>
      </Sheet>

      <Sheet
        open={sheet === 'about'}
        title={tr('🌍 World Tour')}
        onClose={closeSheet}
      >
        <p className="text-[14px] leading-snug">
          {tr(
            'Famous places to run any time, as often as you like. Unlock a place with coins; your first finish there stamps your passport (+{n} {coin}). Tour runs never count for the daily stage.',
            { n: TOUR_STAMP_REWARD, coin: COIN }
          )}
        </p>
        <p className="text-[14px] leading-snug">
          {tr(
            'Everyone can run it this week without unlocking. Race the crew on one board.'
          )}{' '}
          {tr(
            'The fastest three this week win {a}, {b} and {c} {coin} on Monday.',
            {
              a: TOUR_WEEK_PRIZES[0]!,
              b: TOUR_WEEK_PRIZES[1]!,
              c: TOUR_WEEK_PRIZES[2]!,
              coin: COIN,
            }
          )}
        </p>
      </Sheet>

      <Sheet
        open={sheet === 'free'}
        title={tr('Free this week')}
        onClose={closeSheet}
      >
        <p className="font-display text-[18px] font-extrabold">
          {free.flag} {tr(free.stage.landmark.name)}
        </p>
        <p className="text-[13px] leading-snug">
          {freeOwned
            ? tr('Yours to keep. The whole crew races here this week.')
            : tr(
                'Everyone can run it this week without unlocking. Race the crew on one board.'
              )}
        </p>
        <p className="text-[12px] font-bold text-ink-soft">
          {tr(
            'The fastest three this week win {a}, {b} and {c} {coin} on Monday.',
            {
              a: TOUR_WEEK_PRIZES[0]!,
              b: TOUR_WEEK_PRIZES[1]!,
              c: TOUR_WEEK_PRIZES[2]!,
              coin: COIN,
            }
          )}
        </p>
        {week.length > 0 && (
          <ol
            className="flex flex-col gap-0.5 text-[14px] font-extrabold"
            aria-label={tr('This week’s leaders')}
          >
            {week.map((r, i) => (
              <li key={r.username}>
                {['🥇', '🥈', '🥉'][i]} u/{r.username} {formatTime(r.seconds)}
              </li>
            ))}
          </ol>
        )}
      </Sheet>

      <Sheet
        open={open !== null}
        title={open ? `${open.flag} ${tr(open.stage.landmark.name)}` : ''}
        onClose={() => setOpen(null)}
      >
        {open &&
          (() => {
            const stop = open;
            const row = rowOf(stop.id);
            const unlocked = isUnlocked(stop.id);
            const owned = profile.tourUnlocked.includes(stop.id);
            const isFree = stop.id === free.id;
            const kind = TOUR_KIND[stop.kind];
            const canBuy = profile.badges >= stop.cost;
            return (
              <>
                <p className="text-[12px] font-bold text-ink-soft">
                  {kind.icon} {tr(kind.label)} · {tr(stop.place)},{' '}
                  {tr(stop.country)}
                  {profile.tourStamps.includes(stop.id) &&
                    ` · 🛂 ${tr('Stamped')}`}
                </p>
                <p className="text-[14px] leading-snug">
                  {tr(stop.stage.landmark.blurb)}
                </p>
                <p className="text-[12px] font-bold text-ink-soft">
                  {TERRAIN[stop.stage.terrain].icon}{' '}
                  {tr(TERRAIN[stop.stage.terrain].label)} ·{' '}
                  {WEATHER[stop.weather].icon} {tr(WEATHER[stop.weather].label)}{' '}
                  · {TIMES[stop.time].icon} {tr(TIMES[stop.time].label)}
                </p>
                {row && (row.best !== null || row.top) && (
                  <p className="text-[12px] font-bold">
                    {row.best !== null &&
                      tr('Your best {time} (#{rank} of {total})', {
                        time: formatTime(row.best),
                        rank: row.rank ?? '',
                        total: row.runners,
                      })}
                    {row.best !== null && row.top && ' · '}
                    {row.top &&
                      tr('Record {time} by u/{name}', {
                        time: formatTime(row.top.seconds),
                        name: row.top.username,
                      })}
                  </p>
                )}
                <div className="mt-1 flex justify-end gap-2">
                  {isFree && !owned && (
                    <button
                      type="button"
                      disabled={busy || !canBuy}
                      onClick={() => onUnlock(stop.id)}
                      className="chunky rounded-full bg-white px-3 py-1.5 text-[13px] font-extrabold"
                    >
                      {tr('Keep it {n}', { n: stop.cost })} {COIN}
                    </button>
                  )}
                  {unlocked ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setOpen(null);
                        onRun(stop.id);
                      }}
                      className="chunky rounded-full bg-[var(--accent)] px-5 py-1.5 text-[15px] font-extrabold text-white"
                    >
                      {tr('Run here')}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busy || !canBuy}
                      onClick={() => onUnlock(stop.id)}
                      className="chunky rounded-full bg-gold px-5 py-1.5 text-[15px] font-extrabold"
                    >
                      {tr('Unlock {n}', { n: stop.cost })} {COIN}
                    </button>
                  )}
                </div>
              </>
            );
          })()}
      </Sheet>
    </div>
  );
};
