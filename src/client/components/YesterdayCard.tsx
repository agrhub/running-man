import type { DayRecap } from '../../shared/api';
import { dayInfo } from '../../shared/content';
import { formatTime } from '../../shared/sim';
import { Avatar } from './Avatar';
import { tr } from '../i18n';

const MEDALS = ['🥇', '🥈', '🥉'];

/** Yesterday's podium and a fun fact, the same recap the app posts in the comments. */
export const YesterdayCard = ({ recap }: { recap: DayRecap }) => {
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
    </section>
  );
};
