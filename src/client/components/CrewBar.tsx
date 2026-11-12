import type { CrewProgress } from '../../shared/api';
import { CREW_MARATHONS, cityById } from '../../shared/content';

type Props = { crew: CrewProgress; runners?: number; gained?: number };

/** The whole subreddit's shared marathon for this city. */
export const CrewBar = ({ crew, runners, gained }: Props) => {
  const city = cityById(crew.cityId);
  const km = Math.min(crew.meters, crew.target) / 1000;
  const pct = Math.min(100, (crew.meters / crew.target) * 100);
  const gainedPct = gained ? Math.min(pct, (gained / crew.target) * 100) : 0;
  return (
    <div className="w-full">
      <div className="flex items-baseline justify-between text-[13px] font-extrabold">
        <span>
          {crew.finished
            ? `The crew ran ${CREW_MARATHONS} marathons in ${city?.name}! 🎉`
            : `Crew goal: ${CREW_MARATHONS} marathons in ${city?.name}`}
        </span>
        <span className="tabular text-ink-soft">
          {Math.round(km)} / {Math.round(crew.target / 1000)} km
        </span>
      </div>
      <div className="mt-1 h-3.5 rounded-full border-2 border-ink bg-white overflow-hidden relative">
        <div
          className="h-full bg-[var(--accent)]"
          style={{ width: `${pct - gainedPct}%` }}
        />
        {gainedPct > 0 && (
          <div
            className="h-full bg-gold absolute top-0"
            style={{ left: `${pct - gainedPct}%`, width: `${gainedPct}%` }}
          />
        )}
      </div>
      {runners !== undefined && (
        <p className="mt-1 text-[12px] text-ink-soft">
          {runners === 0
            ? 'Be the first runner today.'
            : `${runners} ${runners === 1 ? 'runner has' : 'runners have'} run today’s stage.`}
        </p>
      )}
    </div>
  );
};
