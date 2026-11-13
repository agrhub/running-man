export type Tab = 'race' | 'quests' | 'play' | 'friends' | 'shop' | 'me';

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'race', icon: '🏃', label: 'Race' },
  { id: 'quests', icon: '🎯', label: 'Quests' },
  { id: 'play', icon: '🎮', label: 'Play' },
  { id: 'friends', icon: '👥', label: 'Friends' },
  { id: 'shop', icon: '🛍️', label: 'Shop' },
  { id: 'me', icon: '🏅', label: 'Me' },
];

type Props = {
  active: Tab;
  /** Tabs with something waiting: a check-in, a quest to claim, a game to play. */
  dots: Partial<Record<Tab, boolean>>;
  /** Tabs shipped so far; the rest stay hidden. */
  tabs: Tab[];
  onTab: (tab: Tab) => void;
};

export const TabBar = ({ active, dots, tabs, onTab }: Props) => (
  <nav
    className="shrink-0 border-t-2 border-ink bg-white/95 px-2 pb-[max(6px,env(safe-area-inset-bottom))] pt-1"
    aria-label="Main"
  >
    <ul className="mx-auto flex max-w-[440px] justify-around">
      {TABS.filter((t) => tabs.includes(t.id)).map((t) => {
        const on = t.id === active;
        return (
          <li key={t.id} className="flex-1">
            <button
              type="button"
              onClick={() => onTab(t.id)}
              aria-current={on ? 'page' : undefined}
              className={`relative flex w-full flex-col items-center rounded-xl py-1 text-[11px] font-extrabold ${on ? 'text-[var(--accent)]' : 'text-ink-soft'}`}
            >
              <span
                className={`text-[20px] leading-none transition-transform ${on ? 'scale-110' : ''}`}
                aria-hidden
              >
                {t.icon}
              </span>
              {t.label}
              {dots[t.id] && !on && (
                <span
                  className="absolute right-[calc(50%-18px)] top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[var(--color-push)]"
                  aria-label="Something new"
                />
              )}
            </button>
          </li>
        );
      })}
    </ul>
  </nav>
);
