import {
  NEXT_CITIES,
  voteLeader,
  type CityVote,
  type NextCityId,
} from '../../shared/vote';
import { tr } from '../i18n';

type Props = {
  vote: CityVote;
  busy: boolean;
  onVote: (cityId: NextCityId) => void;
};

/** The crew picks the next city to build. Vote first, then see the counts. */
export const VoteCard = ({ vote, busy, onVote }: Props) => {
  const voted = vote.mine !== null;
  const leader = voteLeader(vote);
  const lead = NEXT_CITIES.find((c) => c.id === leader);
  return (
    <section
      className="rounded-2xl border-2 border-ink bg-white/80 px-3 py-2"
      aria-label={tr('Vote for the next city')}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-display text-[17px] font-extrabold leading-tight">
          {tr('Which city should we build next?')}
        </p>
        <p className="shrink-0 text-[12px] font-extrabold text-ink-soft tabular">
          {tr(vote.total === 1 ? '{n} vote' : '{n} votes', { n: vote.total })}
        </p>
      </div>
      <p className="text-[12px] text-ink-soft">
        {voted
          ? lead
            ? tr('{city} leads this week. Thanks for voting!', {
                city: tr(lead.name),
              })
            : tr('Neck and neck this week. Thanks for voting!')
          : tr('One vote a week for everyone who ran a stage.')}
      </p>
      <ul className="mt-1.5 grid grid-cols-2 gap-1.5">
        {NEXT_CITIES.map((c) => {
          const n = vote.counts[c.id];
          const pct = vote.total > 0 ? Math.round((n / vote.total) * 100) : 0;
          const mine = vote.mine === c.id;
          return (
            <li key={c.id}>
              {voted ? (
                <div
                  className={`relative overflow-hidden rounded-xl border-2 px-2 py-1 ${mine ? 'border-ink' : 'border-transparent bg-[var(--sky)]'}`}
                  aria-label={`${tr(c.name)}: ${tr(n === 1 ? '{n} vote' : '{n} votes', { n })}${mine ? tr(', your vote') : ''}`}
                >
                  <div
                    className="absolute inset-y-0 left-0 bg-[var(--accent)] opacity-25"
                    style={{ width: `${pct}%` }}
                    aria-hidden
                  />
                  <div className="relative flex items-baseline justify-between text-[13px] font-extrabold">
                    <span>
                      {c.flag} {c.name}
                      {mine ? ' ✓' : ''}
                    </span>
                    <span className="tabular">{pct}%</span>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onVote(c.id)}
                  className="w-full rounded-xl bg-[var(--sky)] px-2 py-1 text-left"
                >
                  <span className="block text-[13px] font-extrabold">
                    {c.flag} {c.name}
                  </span>
                  <span className="block text-[11px] leading-tight text-ink-soft">
                    {c.blurb}
                  </span>
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};
