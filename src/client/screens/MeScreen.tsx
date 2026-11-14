import type { MeResponse } from '../../shared/api';
import { ACHIEVEMENTS } from '../../shared/achievements';
import { CITIES, KM_PER_STAGE, addDays, dayInfo } from '../../shared/content';
import { COIN } from '../../shared/economy';
import { formatTime } from '../../shared/sim';
import { Avatar } from '../components/Avatar';
import { ComfortOptions } from '../components/ComfortOptions';
import { currentLang, tr } from '../i18n';

type Props = {
  me: MeResponse | null;
  today: string;
};

const ordinal = (n: number) => {
  if (currentLang() !== 'en') return `#${n}`;
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
};

/** Your runner's page: stats, the last four weeks, bests per city and achievements. */
export const MeScreen = ({ me, today }: Props) => {
  if (!me)
    return (
      <p className="px-4 pt-10 text-center font-display text-[20px] font-extrabold text-ink-soft">
        {tr('Loading your profile…')}
      </p>
    );
  const { profile, history } = me;
  if (profile.username === 'guest')
    return (
      <div className="flex flex-col gap-3 px-4 pt-6 pb-6 max-w-[440px] mx-auto">
        <p className="text-center text-[15px] font-bold text-ink-soft">
          {tr('Log in to Reddit to keep a profile.')}
        </p>
        <ComfortOptions />
      </div>
    );
  const ran = new Set(history.map((h) => h.dateKey));
  // Four weeks, oldest first, ending today.
  const days = Array.from({ length: 28 }, (_, i) => addDays(today, i - 27));
  const best = history.reduce<number | null>(
    (b, h) => (b === null ? h.rank : Math.min(b, h.rank)),
    null
  );
  const perCity = CITIES.map((c) => {
    const runs = history.filter((h) => dayInfo(h.dateKey).city.id === c.id);
    return {
      city: c,
      stages: runs.length,
      best: runs.length ? Math.min(...runs.map((r) => r.seconds)) : null,
    };
  });
  const done = me.achievements.filter((a) => a.done).length;

  return (
    <div className="flex flex-col gap-3 px-4 pt-4 pb-6 max-w-[440px] mx-auto">
      <header className="flex items-center gap-3">
        <Avatar name={profile.username} size={56} ring />
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-[24px] font-extrabold leading-tight">
            u/{profile.username}
          </h1>
          <p className="text-[13px] font-extrabold text-ink-soft">
            {tr('Bib #{n}', {
              n:
                profile.bib === null
                  ? '----'
                  : String(profile.bib).padStart(4, '0'),
            })}{' '}
            · {COIN} {profile.badges}
          </p>
        </div>
      </header>

      <section
        className="grid grid-cols-4 gap-1.5 text-center"
        aria-label={tr('Your numbers')}
      >
        {[
          [
            String(history.length),
            tr(history.length === 1 ? 'stage' : 'stages'),
          ],
          [String(history.length * KM_PER_STAGE), tr('km run')],
          [`${profile.bestStreak}`, tr('best streak')],
          [best === null ? '—' : ordinal(best), tr('best place')],
        ].map(([n, label]) => (
          <div
            key={label}
            className="rounded-2xl border-2 border-ink bg-white/85 px-1 py-2"
          >
            <p className="font-display text-[22px] font-extrabold leading-none tabular">
              {n}
            </p>
            <p className="mt-0.5 text-[11px] font-bold text-ink-soft">
              {label}
            </p>
          </div>
        ))}
      </section>

      <section
        className="rounded-2xl border-2 border-ink bg-white/85 px-3 py-2.5"
        aria-label={tr('The last four weeks')}
      >
        <h2 className="font-display text-[17px] font-extrabold">
          {tr('The last four weeks')}
        </h2>
        <ol className="mt-1.5 grid grid-cols-7 gap-1">
          {days.map((d) => (
            <li
              key={d}
              title={d}
              aria-label={`${d}: ${ran.has(d) ? tr('ran') : tr('no run')}`}
              className={`aspect-square rounded-md border-2 ${
                ran.has(d)
                  ? 'border-ink bg-[var(--accent)]'
                  : 'border-ink/15 bg-white'
              } ${d === today ? 'outline outline-2 outline-offset-1 outline-gold' : ''}`}
            />
          ))}
        </ol>
        <p className="mt-1 text-[11px] text-ink-soft">
          {tr(
            'Every filled square is a stage you ran. Today has the gold ring.'
          )}
        </p>
      </section>

      <section
        className="rounded-2xl border-2 border-ink bg-white/85 px-3 py-2.5"
        aria-label={tr('Best time in each city')}
      >
        <h2 className="font-display text-[17px] font-extrabold">
          {tr('Best in each city')}
        </h2>
        <ul className="mt-1 flex flex-col gap-1">
          {perCity.map(({ city, stages, best: t }) => (
            <li key={city.id} className="flex items-center gap-2 text-[14px]">
              <span aria-hidden>{city.flag}</span>
              <span className="flex-1 font-bold">{tr(city.name)}</span>
              <span className="text-[12px] text-ink-soft">
                {tr(stages === 1 ? '{n} stage' : '{n} stages', { n: stages })}
              </span>
              <span className="w-[58px] text-right font-display font-semibold tabular">
                {t === null ? '—' : formatTime(t)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label={tr('Achievements')}>
        <h2 className="mb-1 flex items-baseline justify-between font-display text-[19px] font-extrabold">
          {tr('Achievements')}
          <span className="text-[13px] text-ink-soft">
            {tr('{n} of {total}', { n: done, total: ACHIEVEMENTS.length })}
          </span>
        </h2>
        <ul className="grid grid-cols-2 gap-1.5">
          {ACHIEVEMENTS.map((a) => {
            const st = me.achievements.find((s) => s.id === a.id);
            const got = st?.done ?? false;
            const value = st?.value ?? 0;
            return (
              <li
                key={a.id}
                className={`rounded-2xl border-2 px-2 py-1.5 ${got ? 'border-ink bg-[#fff6d6]' : 'border-ink/25 bg-white/70'}`}
              >
                <p className="flex items-center gap-1.5">
                  <span
                    className={`text-[22px] ${got ? '' : 'grayscale opacity-50'}`}
                    aria-hidden
                  >
                    {a.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-extrabold">
                      {tr(a.name)}
                    </span>
                    <span className="block text-[11px] leading-tight text-ink-soft">
                      {tr(a.goal)}
                    </span>
                  </span>
                </p>
                {got ? (
                  <p className="mt-1 text-[11px] font-extrabold text-[#1f8f7f]">
                    {tr('Earned · +{n}', { n: a.reward })} {COIN}
                  </p>
                ) : (
                  <div
                    className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink/10"
                    role="meter"
                    aria-label={tr('{name} progress', { name: tr(a.name) })}
                    aria-valuenow={value}
                    aria-valuemin={0}
                    aria-valuemax={a.target}
                  >
                    <div
                      className="h-full bg-gold"
                      style={{ width: `${(value / a.target) * 100}%` }}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
      <ComfortOptions />
    </div>
  );
};
