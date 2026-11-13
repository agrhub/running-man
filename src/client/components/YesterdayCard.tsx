import type { DayRecap } from '../../shared/api';
import { dayInfo } from '../../shared/content';
import { formatTime } from '../../shared/sim';
import { Avatar } from './Avatar';

const MEDALS = ['🥇', '🥈', '🥉'];

/** Yesterday's podium and a fun fact, the same recap the app posts in the comments. */
export const YesterdayCard = ({ recap }: { recap: DayRecap }) => {
  const day = dayInfo(recap.dateKey);
  const fact = recap.topLine
    ? `Most shouted: “${recap.topLine.line}”`
    : recap.bumps > 0
      ? `💥 ${recap.bumps} ${recap.bumps === 1 ? 'crash' : 'crashes'} on the road`
      : null;
  return (
    <section
      className="rounded-2xl border-2 border-ink bg-white/80 px-3 py-2"
      aria-label="Yesterday’s stage"
    >
      <p className="text-[12px] font-extrabold text-ink-soft">
        Yesterday · {day.stage.name} · {recap.runners}{' '}
        {recap.runners === 1 ? 'runner' : 'runners'}
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
