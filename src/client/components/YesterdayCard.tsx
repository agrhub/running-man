import type { DayRecap } from '../../shared/api';
import { dayInfo } from '../../shared/content';
import { formatTime } from '../../shared/sim';
import { COIN } from '../../shared/economy';
import { Avatar } from './Avatar';
import { tr } from '../i18n';

const MEDALS = ['🥇', '🥈', '🥉'];

/** Yesterday's podium and a fun fact, the same recap the app posts in the comments. */
export const YesterdayCard = ({
  recap,
  me,
}: {
  recap: DayRecap;
  me?: string;
}) => {
  const day = dayInfo(recap.dateKey);
  const fact = recap.topLine
    ? tr('Most shouted: “{line}”', { line: tr(recap.topLine.line) })
    : recap.bumps > 0
      ? tr(
          recap.bumps === 1
            ? '💥 {n} crash on the road'
            : '💥 {n} crashes on the road',
          { n: recap.bumps }
        )
      : null;
  return (
    <section
      className="rounded-2xl border-2 border-ink bg-white/80 px-3 py-2"
      aria-label={tr('Yesterday’s stage')}
    >
      <p className="text-[12px] font-extrabold text-ink-soft">
        {tr(
          recap.runners === 1
            ? 'Yesterday · {stage} · {n} runner'
            : 'Yesterday · {stage} · {n} runners',
          { stage: tr(day.stage.name), n: recap.runners }
        )}
      </p>
      <ol className="mt-1 flex flex-col gap-0.5">
        {recap.podium.map((p, i) => (
          <li key={p.username} className="flex items-center gap-2 text-[13px]">
            <span aria-hidden>{MEDALS[i]}</span>
            <Avatar name={p.username} size={20} />
            <span className="min-w-0 flex-1 truncate font-bold">
              u/{p.username}
            </span>
            <span className="font-display font-semibold tabular">
              {formatTime(p.seconds)}
            </span>
          </li>
        ))}
      </ol>
      {fact && <p className="mt-1 text-[12px] text-ink-soft">{fact}</p>}
      {recap.week && recap.week.podium.length > 0 && (
        <div className="mt-2 border-t-2 border-dashed border-ink/20 pt-2">
          <h3 className="font-display text-[15px] font-extrabold">
            {tr('🏆 {city} week champions', { city: tr(day.city.name) })}
          </h3>
          <ol className="mt-1 flex flex-col gap-0.5">
            {recap.week.podium.map((p, i) => (
              <li
                key={p.username}
                className={`-mx-1 flex items-center gap-2 rounded-lg px-1 text-[13px] ${p.username === me ? 'bg-[var(--sky)] font-extrabold' : ''}`}
              >
                <span aria-hidden>{MEDALS[i]}</span>
                <Avatar name={p.username} size={20} />
                <span className="min-w-0 flex-1 truncate font-bold">
                  u/{p.username}
                </span>
                <span className="text-[12px] text-ink-soft tabular">
                  {tr(p.stages === 1 ? '{n} stage' : '{n} stages', {
                    n: p.stages,
                  })}
                </span>
                <span className="font-display font-semibold text-easy-ink tabular">
                  +{p.prize} {COIN}
                </span>
              </li>
            ))}
          </ol>
          {recap.week.podium.some((p) => p.username === me) && (
            <p className="mt-1 text-[12px] font-extrabold">
              {tr('Your prize is already in your coins.')}
            </p>
          )}
        </div>
      )}
    </section>
  );
};
