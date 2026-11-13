import { useState, type FormEvent, type ReactNode } from 'react';
import type { FriendRow, Profile } from '../../shared/api';
import { formatTime } from '../../shared/sim';

type Props = {
  profile: Profile;
  friends: FriendRow[];
  suggestions: string[];
  busy: boolean;
  onAdd: (username: string) => void;
  onRemove: (username: string) => void;
  /** The running club section, below the friends. */
  children?: ReactNode;
};

export const FriendsScreen = (p: Props) => {
  const [name, setName] = useState('');
  const guest = p.profile.username === 'guest';
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    p.onAdd(n);
    setName('');
  };
  const ran = p.friends.filter((f) => f.seconds !== null).length;
  return (
    <div className="flex flex-col gap-3 px-4 pt-4 pb-6 max-w-[440px] mx-auto">
      <header className="flex items-baseline justify-between">
        <h1 className="font-display text-[26px] font-extrabold">Friends</h1>
        <p className="text-[13px] font-extrabold text-ink-soft">
          {p.friends.length > 0
            ? `${ran} of ${p.friends.length} ran today`
            : 'Run together'}
        </p>
      </header>

      <section
        className="rounded-2xl border-2 border-ink bg-white/85 px-3 py-2.5"
        aria-label="Your friends"
      >
        <form className="flex gap-2" onSubmit={submit}>
          <label className="sr-only" htmlFor="friend-name">
            Reddit username
          </label>
          <input
            id="friend-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="u/username"
            autoComplete="off"
            disabled={guest}
            className="min-w-0 flex-1 rounded-xl border-2 border-ink bg-white px-3 py-1.5 text-[14px] font-bold"
          />
          <button
            type="submit"
            disabled={p.busy || guest || !name.trim()}
            className="chunky rounded-xl bg-[var(--accent)] px-4 font-display text-[16px] font-extrabold text-white"
          >
            Add
          </button>
        </form>
        <p className="mt-1 text-[11px] text-ink-soft">
          Friends run on your road first, get their own tag colour and a Friends
          tab on the leaderboard.
        </p>
        {p.friends.length === 0 ? (
          <p className="mt-2 text-[13px] text-ink-soft">
            {guest
              ? 'Log in to Reddit to add friends.'
              : 'No friends yet. Add someone from today’s runners below.'}
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1.5">
            {p.friends.map((f) => (
              <li
                key={f.username}
                className="flex items-center gap-2 rounded-xl border-2 border-ink/20 bg-white px-2 py-1.5"
              >
                <span className="rounded-md border-2 border-ink bg-white px-1 font-display text-[11px] font-extrabold tabular">
                  {f.bib === null ? '----' : String(f.bib).padStart(4, '0')}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-extrabold">
                    u/{f.username}
                  </p>
                  <p className="text-[11px] text-ink-soft">
                    {f.seconds !== null
                      ? `Ran today: ${formatTime(f.seconds)}, #${f.rank}`
                      : 'Has not run today yet'}
                    {f.streak > 1 ? ` · 🔥 ${f.streak}-day streak` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={p.busy}
                  onClick={() => p.onRemove(f.username)}
                  className="rounded-full px-2 text-[14px] font-extrabold text-ink-soft"
                  aria-label={`Remove u/${f.username} from friends`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {p.suggestions.length > 0 && (
        <section aria-label="Runners from today">
          <h2 className="mb-1 font-display text-[17px] font-extrabold">
            Runners from today
          </h2>
          <ul className="flex flex-wrap gap-1.5">
            {p.suggestions.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  disabled={p.busy || guest}
                  onClick={() => p.onAdd(s)}
                  className="chunky rounded-full bg-white px-3 py-1 text-[13px] font-extrabold"
                  aria-label={`Add u/${s} as a friend`}
                >
                  + u/{s}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {p.children}
    </div>
  );
};
