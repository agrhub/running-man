import { useState } from 'react';
import type { ArchiveRow, ArchiveRunResponse, Profile } from '../../shared/api';
import {
  TERRAIN,
  TIMES,
  dayInfo,
  isTriathlon,
  remixLabel,
} from '../../shared/content';
import { COIN } from '../../shared/economy';
import { formatTime } from '../../shared/sim';
import { Chip, Sheet } from '../components/Sheet';
import { tr } from '../i18n';

type Props = {
  profile: Profile;
  days: ArchiveRow[] | null;
  busy: boolean;
  /** The replay you just finished, shown on top. */
  result: ArchiveRunResponse | null;
  onRun: (dateKey: string) => void;
  onBack: () => void;
};

/** Every earlier stage of this subreddit, to race again against that day's ghosts. */
export const ArchiveScreen = ({
  profile,
  days,
  busy,
  result,
  onRun,
  onBack,
}: Props) => {
  const [open, setOpen] = useState<ArchiveRow | null>(null);
  const [about, setAbout] = useState(false);
  const done = result ? dayInfo(result.dateKey) : null;

  return (
    <div className="flex h-full flex-col gap-2.5 px-4 pt-3 pb-3 short:gap-2 max-w-[440px] mx-auto">
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
            {tr('🗂️ Past stages')}
          </h1>
          <p className="text-[12px] font-bold text-ink-soft">
            {tr('Race any earlier day against its fastest runners.')}
          </p>
        </div>
        <Chip
          icon="❔"
          label={tr('How it works')}
          onClick={() => setAbout(true)}
        />
      </header>

      {result && done && (
        <section
          className="bib bib-pins px-3 pt-4 pb-2"
          aria-label={tr('Your replay')}
        >
          <p className="text-[13px] font-extrabold text-ink-soft">
            {done.city.flag} {tr(done.stage.name)}
          </p>
          <p className="font-display text-[30px] font-extrabold leading-none">
            {formatTime(result.seconds)}
          </p>
          <p className="mt-1 text-[13px] font-bold">
            {tr('On the day that was #{rank} of {total}.', {
              rank: result.dayRank,
              total: Math.max(result.dayRunners, result.dayRank),
            })}{' '}
            {result.improved
              ? tr('New best replay!')
              : tr('Your best replay stays {time}.', {
                  time: formatTime(result.best),
                })}
            {result.reward > 0 && (
              <span className="ml-1 font-extrabold text-easy-ink">
                +{result.reward} {COIN}
              </span>
            )}
          </p>
        </section>
      )}

      {days === null ? (
        <p className="text-[14px] font-bold">{tr('Loading…')}</p>
      ) : days.length === 0 ? (
        <p className="rounded-2xl border-2 border-ink bg-white/80 px-3 py-3 text-[14px] font-bold">
          {tr(
            'No past stages yet. Today is this subreddit’s first stage: come back tomorrow.'
          )}
        </p>
      ) : (
        <ul
          className="min-h-0 shrink overflow-y-auto rounded-2xl border-2 border-ink bg-white/70 p-1.5"
          aria-label={tr('Past stages')}
        >
          {days.map((row) => {
            const day = dayInfo(row.dateKey);
            const mine = row.best ?? row.onTheDay;
            return (
              <li key={row.dateKey}>
                <button
                  type="button"
                  onClick={() => setOpen(row)}
                  className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left hover:bg-white"
                >
                  <span className="w-[44px] shrink-0 text-center font-display text-[13px] font-extrabold leading-tight">
                    {tr('Day {n}', { n: row.number })}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-extrabold">
                      {day.city.flag} {tr(day.stage.name)}
                      {isTriathlon(day) ? ' 🏊' : ''}
                    </span>
                    <span className="block truncate text-[11px] font-bold text-ink-soft">
                      {day.weather.icon} {TIMES[day.time].icon} ·{' '}
                      {row.top
                        ? tr('Record {time} by u/{name}', {
                            time: formatTime(row.top.seconds),
                            name: row.top.username,
                          })
                        : tr('Nobody ran it on the day')}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-[12px] font-extrabold">
                    {mine !== null ? formatTime(mine) : ''}
                    {row.done ? ' ✓' : ''}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Sheet
        open={about}
        title={tr('🗂️ Past stages')}
        onClose={() => setAbout(false)}
      >
        <p className="text-[14px] leading-snug">
          {tr(
            'Every earlier stage of this subreddit stays open here. Race it against that day’s fastest runners, who run again as ghosts.'
          )}
        </p>
        <p className="text-[14px] leading-snug">
          {tr(
            'Replays have their own board: they never change the day’s leaderboard, your streak, quests or the crew goal. Your first finish of each past stage pays {n} {coin}.',
            { n: 10, coin: COIN }
          )}
        </p>
      </Sheet>

      <Sheet
        open={open !== null}
        title={
          open
            ? `${tr('Day {n}', { n: open.number })} · ${dayInfo(open.dateKey).city.flag} ${tr(dayInfo(open.dateKey).stage.name)}`
            : ''
        }
        onClose={() => setOpen(null)}
      >
        {open &&
          (() => {
            const day = dayInfo(open.dateKey);
            const remix = remixLabel(day.remix);
            return (
              <>
                <p className="text-[12px] font-bold text-ink-soft">
                  {tr('{city}, stage {n} of 7', {
                    city: tr(day.city.name),
                    n: day.stageIndex + 1,
                  })}{' '}
                  · {TERRAIN[day.stage.terrain].icon}{' '}
                  {tr(TERRAIN[day.stage.terrain].label)} · {day.weather.icon}{' '}
                  {tr(day.weather.label)} · {TIMES[day.time].icon}{' '}
                  {tr(TIMES[day.time].label)}
                  {remix ? ` · ${tr(remix)}` : ''}
                </p>
                <p className="text-[14px] leading-snug">
                  {tr(day.stage.landmark.blurb)}
                </p>
                <ul className="text-[13px] font-bold">
                  <li>
                    {open.runners === 1
                      ? tr('{n} runner on the day', { n: open.runners })
                      : tr('{n} runners on the day', { n: open.runners })}
                    {open.top &&
                      ` · ${tr('Record {time} by u/{name}', {
                        time: formatTime(open.top.seconds),
                        name: open.top.username,
                      })}`}
                  </li>
                  {open.onTheDay !== null && (
                    <li>
                      {tr('You ran {time} on the day', {
                        time: formatTime(open.onTheDay),
                      })}
                    </li>
                  )}
                  {open.best !== null && (
                    <li>
                      {tr('Your best replay {time}', {
                        time: formatTime(open.best),
                      })}
                    </li>
                  )}
                </ul>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setOpen(null);
                    onRun(open.dateKey);
                  }}
                  className="chunky mt-1 rounded-2xl bg-[var(--accent)] py-2.5 font-display text-[19px] font-extrabold text-white"
                >
                  {tr('Race it again')}
                </button>
              </>
            );
          })()}
      </Sheet>
    </div>
  );
};
