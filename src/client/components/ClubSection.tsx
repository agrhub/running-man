import { useState, type FormEvent } from 'react';
import { Avatar } from './Avatar';
import type { ClubRow, ClubView, Profile, RelayRow } from '../../shared/api';
import { CLUB_ADJECTIVES, CLUB_NOUNS, clubName } from '../../shared/club';
import { KM_PER_STAGE } from '../../shared/content';
import { formatTime } from '../../shared/sim';

type Props = {
  profile: Profile;
  club: ClubView | null;
  top: ClubRow[];
  relays?: RelayRow[];
  busy: boolean;
  onCreate: (adjective: number, noun: number) => void;
  onJoin: (code: string) => void;
  onLeave: () => void;
};

const roll = (n: number) => Math.floor(Math.random() * n);

/** Running clubs: run together, share a road and a weekly total. */
export const ClubSection = (p: Props) => {
  const [adj, setAdj] = useState(() => roll(CLUB_ADJECTIVES.length));
  const [noun, setNoun] = useState(() => roll(CLUB_NOUNS.length));
  const [code, setCode] = useState('');
  const guest = p.profile.username === 'guest';
  const join = (e: FormEvent) => {
    e.preventDefault();
    if (code.trim()) p.onJoin(code.trim());
  };

  return (
    <>
      {p.club ? (
        <section
          className="rounded-2xl border-2 border-ink bg-white/85 px-3 py-2.5"
          aria-label="Your club"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[12px] font-extrabold text-ink-soft">
                Your running club
              </p>
              <h2 className="font-display text-[22px] font-extrabold leading-tight">
                {p.club.name}
              </h2>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-extrabold text-ink-soft">
                Join code
              </p>
              <p className="rounded-lg border-2 border-ink bg-gold px-2 font-display text-[18px] font-extrabold tracking-wider">
                {p.club.code}
              </p>
            </div>
          </div>
          <p className="mt-1 text-[13px] font-bold">
            {p.club.weekStages * KM_PER_STAGE} km this week together,{' '}
            {p.club.members.length}{' '}
            {p.club.members.length === 1 ? 'runner' : 'runners'}
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {p.club.members.map((m) => (
              <li
                key={m.username}
                className={`flex items-center gap-2 rounded-xl px-2 py-1 text-[13px] ${m.username === p.profile.username ? 'bg-[var(--sky)] font-extrabold' : ''}`}
              >
                <Avatar name={m.username} size={22} />
                <span className="flex-1 truncate">
                  u/{m.username}
                  {m.username === p.club?.owner ? ' 👑' : ''}
                </span>
                <span className="text-[11px] font-extrabold text-ink-soft tabular">
                  {m.weekStages} {m.weekStages === 1 ? 'stage' : 'stages'}
                </span>
                <span className="w-[54px] text-right font-display font-semibold tabular">
                  {m.seconds === null ? '—' : formatTime(m.seconds)}
                </span>
              </li>
            ))}
          </ul>
          <section
            className="mt-2 rounded-xl bg-[var(--sky)] px-2 py-1.5"
            aria-label="Today’s relay"
          >
            <p className="flex items-baseline justify-between text-[13px] font-extrabold">
              <span>🤝 Today’s relay</span>
              <span className="font-display tabular">
                {p.club.relay.total !== null
                  ? `${formatTime(p.club.relay.total)} · #${p.club.relay.rank}`
                  : `${p.club.relay.legs.length} of 3 legs`}
              </span>
            </p>
            <ol className="mt-1 grid grid-cols-3 gap-1">
              {[0, 1, 2].map((i) => {
                const leg = p.club?.relay.legs[i];
                return (
                  <li
                    key={i}
                    className={`flex flex-col items-center rounded-lg px-1 py-1 text-center ${leg ? 'bg-white' : 'border-2 border-dashed border-ink/25'}`}
                  >
                    <span className="text-[10px] font-extrabold text-ink-soft">
                      Leg {i + 1}
                    </span>
                    {leg ? (
                      <>
                        <Avatar name={leg.username} size={22} />
                        <span className="w-full truncate text-[11px] font-bold">
                          u/{leg.username}
                        </span>
                        <span className="font-display text-[13px] font-semibold tabular">
                          {formatTime(leg.seconds)}
                        </span>
                      </>
                    ) : (
                      <span className="py-2 text-[11px] text-ink-soft">
                        open
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
            <p className="mt-1 text-[11px] text-ink-soft">
              The first three clubmates to run each day are the relay. When the
              third leg finishes, all three get 25 coins.
            </p>
          </section>
          <p className="mt-1 text-[11px] text-ink-soft">
            Clubmates who ran today join your road with purple tags. Share the
            code in the comments to invite people.
          </p>
          <button
            type="button"
            disabled={p.busy}
            onClick={p.onLeave}
            className="mt-2 text-[12px] font-extrabold text-ink-soft underline"
          >
            Leave club
          </button>
        </section>
      ) : (
        <section
          className="rounded-2xl border-2 border-ink bg-white/85 px-3 py-2.5"
          aria-label="Running clubs"
        >
          <h2 className="font-display text-[20px] font-extrabold">
            Running clubs
          </h2>
          <p className="text-[12px] text-ink-soft">
            Run as a group: clubmates share your road and a weekly total.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <p className="flex-1 rounded-xl bg-[var(--sky)] px-3 py-2 font-display text-[18px] font-extrabold">
              {clubName(adj, noun)}
            </p>
            <button
              type="button"
              onClick={() => {
                setAdj(roll(CLUB_ADJECTIVES.length));
                setNoun(roll(CLUB_NOUNS.length));
              }}
              className="chunky h-10 w-10 rounded-xl bg-white text-[18px]"
              aria-label="Another name"
            >
              🎲
            </button>
          </div>
          <button
            type="button"
            disabled={p.busy || guest}
            onClick={() => p.onCreate(adj, noun)}
            className="chunky mt-2 w-full rounded-2xl bg-[var(--accent)] py-2 font-display text-[17px] font-extrabold text-white"
          >
            Start this club
          </button>
          <form className="mt-2 flex gap-2" onSubmit={join}>
            <label className="sr-only" htmlFor="club-code">
              Club code
            </label>
            <input
              id="club-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Have a code?"
              maxLength={6}
              autoComplete="off"
              disabled={guest}
              className="min-w-0 flex-1 rounded-xl border-2 border-ink bg-white px-3 py-1.5 font-display text-[16px] font-extrabold tracking-wider"
            />
            <button
              type="submit"
              disabled={p.busy || guest || code.trim().length !== 6}
              className="chunky rounded-xl bg-white px-4 font-display text-[16px] font-extrabold"
            >
              Join
            </button>
          </form>
        </section>
      )}

      {(p.relays ?? []).length > 0 && (
        <section
          className="rounded-2xl border-2 border-ink bg-white/80 px-2 py-2"
          aria-label="Fastest relays today"
        >
          <h2 className="px-2 font-display text-[17px] font-extrabold">
            Fastest relays today
          </h2>
          <ol className="mt-1 flex flex-col gap-1">
            {(p.relays ?? []).map((r) => (
              <li
                key={r.code}
                className={`flex items-center gap-2 rounded-xl px-2 py-1 text-[14px] ${r.code === p.club?.code ? 'bg-[var(--sky)] font-extrabold' : ''}`}
              >
                <span className="w-7 text-center font-display font-extrabold">
                  {r.rank}
                </span>
                <span className="flex-1 truncate">{r.name}</span>
                <span className="font-display font-semibold tabular">
                  {formatTime(r.total)}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {p.top.length > 0 && (
        <section
          className="rounded-2xl border-2 border-ink bg-white/80 px-2 py-2"
          aria-label="Top clubs this week"
        >
          <h2 className="px-2 font-display text-[17px] font-extrabold">
            Top clubs this week
          </h2>
          <ol className="mt-1 flex flex-col gap-1">
            {p.top.map((c) => (
              <li
                key={c.code}
                className={`flex items-center gap-2 rounded-xl px-2 py-1 text-[14px] ${c.code === p.club?.code ? 'bg-[var(--sky)] font-extrabold' : ''}`}
              >
                <span className="w-7 text-center font-display font-extrabold">
                  {c.rank === 1
                    ? '🥇'
                    : c.rank === 2
                      ? '🥈'
                      : c.rank === 3
                        ? '🥉'
                        : c.rank}
                </span>
                <span className="flex-1 truncate">{c.name}</span>
                <span className="font-display font-semibold tabular">
                  {c.weekStages * KM_PER_STAGE} km
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </>
  );
};
