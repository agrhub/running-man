import { useEffect, useState } from 'react';
import { setPrefs, usePrefs, type Hand } from '../lib/prefs';
import { onSoundChange, setSound, soundOn } from '../lib/sound';
import { LANGS, langChoice, setLang, tr, useLang } from '../i18n';

const Toggle = ({
  label,
  hint,
  on,
  onChange,
}: {
  label: string;
  hint: string;
  on: boolean;
  onChange: (on: boolean) => void;
}) => (
  <li className="flex items-center gap-3 py-1.5">
    <div className="min-w-0 flex-1">
      <p className="text-[14px] font-extrabold">{label}</p>
      <p className="text-[11px] leading-snug text-ink-soft">{hint}</p>
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-7 w-12 shrink-0 rounded-full border-2 border-ink transition-colors ${on ? 'bg-[var(--accent)]' : 'bg-white'}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full border-2 border-ink bg-white transition-[left] ${on ? 'left-[22px]' : 'left-0.5'}`}
      />
    </button>
  </li>
);

const HANDS: { id: Hand; label: string }[] = [
  { id: 'left', label: 'Left' },
  { id: 'both', label: 'Both sides' },
  { id: 'right', label: 'Right' },
];

/** Sound and comfort options; they stay in this browser. */
export const ComfortOptions = ({ heading = true }: { heading?: boolean }) => {
  const p = usePrefs();
  useLang();
  const [sound, setSoundState] = useState(soundOn);
  useEffect(() => onSoundChange(setSoundState), []);
  return (
    <section
      className="rounded-2xl border-2 border-ink bg-white/85 px-3 py-2"
      aria-label={tr('Options')}
    >
      {heading && (
        <h2 className="font-display text-[17px] font-extrabold">
          {tr('Options')}
        </h2>
      )}
      <ul className="divide-y-2 divide-ink/10">
        <Toggle
          label={tr('Sound')}
          hint={tr('Footsteps, crowds, weather and the finish fanfare.')}
          on={sound}
          onChange={setSound}
        />
        <Toggle
          label={tr('Calm motion')}
          hint={tr(
            'No lightning flashes, less rain and snow, a steady camera.'
          )}
          on={p.calm}
          onChange={(calm) => setPrefs({ calm })}
        />
        <Toggle
          label={tr('Bigger steering buttons')}
          hint={tr('Larger ◀ ▶ buttons in the race.')}
          on={p.bigControls}
          onChange={(bigControls) => setPrefs({ bigControls })}
        />
        <Toggle
          label={tr('Vibration')}
          hint={tr('A buzz on crashes and boosters, on phones that allow it.')}
          on={p.vibration}
          onChange={(vibration) => setPrefs({ vibration })}
        />
        <li className="py-1.5">
          <p className="text-[14px] font-extrabold">{tr('Steering buttons')}</p>
          <p className="text-[11px] text-ink-soft">
            {tr('Put both arrows on one side to steer with one thumb.')}
          </p>
          <div
            className="mt-1 grid grid-cols-3 gap-1"
            role="radiogroup"
            aria-label={tr('Steering buttons')}
          >
            {HANDS.map((h) => (
              <button
                key={h.id}
                type="button"
                role="radio"
                aria-checked={p.hand === h.id}
                onClick={() => setPrefs({ hand: h.id })}
                className={`rounded-xl border-2 border-ink py-1 text-[13px] font-extrabold ${p.hand === h.id ? 'bg-ink text-white' : 'bg-white'}`}
              >
                {tr(h.label)}
              </button>
            ))}
          </div>
        </li>
        <li className="py-1.5">
          <p className="text-[14px] font-extrabold">{tr('Language')}</p>
          <p className="text-[11px] text-ink-soft">
            {tr('Automatic follows your device.')}
          </p>
          <div
            className="mt-1 grid grid-cols-3 gap-1"
            role="radiogroup"
            aria-label={tr('Language')}
          >
            {LANGS.map((l) => (
              <button
                key={l.id}
                type="button"
                role="radio"
                aria-checked={langChoice() === l.id}
                onClick={() => void setLang(l.id)}
                className={`rounded-xl border-2 border-ink py-1 text-[13px] font-extrabold ${langChoice() === l.id ? 'bg-ink text-white' : 'bg-white'}`}
              >
                {l.id === 'auto' ? tr(l.label) : l.label}
              </button>
            ))}
          </div>
        </li>
      </ul>
    </section>
  );
};
