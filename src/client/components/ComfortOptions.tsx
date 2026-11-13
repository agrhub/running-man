import { useEffect, useState } from 'react';
import { setPrefs, usePrefs, type Hand } from '../lib/prefs';
import { onSoundChange, setSound, soundOn } from '../lib/sound';

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
export const ComfortOptions = () => {
  const p = usePrefs();
  const [sound, setSoundState] = useState(soundOn);
  useEffect(() => onSoundChange(setSoundState), []);
  return (
    <section
      className="rounded-2xl border-2 border-ink bg-white/85 px-3 py-2"
      aria-label="Options"
    >
      <h2 className="font-display text-[17px] font-extrabold">Options</h2>
      <ul className="divide-y-2 divide-ink/10">
        <Toggle
          label="Sound"
          hint="Footsteps, crowds, weather and the finish fanfare."
          on={sound}
          onChange={setSound}
        />
        <Toggle
          label="Calm motion"
          hint="No lightning flashes, less rain and snow, a steady camera."
          on={p.calm}
          onChange={(calm) => setPrefs({ calm })}
        />
        <Toggle
          label="Bigger steering buttons"
          hint="Larger ◀ ▶ buttons in the race."
          on={p.bigControls}
          onChange={(bigControls) => setPrefs({ bigControls })}
        />
        <Toggle
          label="Vibration"
          hint="A buzz on crashes and boosters, on phones that allow it."
          on={p.vibration}
          onChange={(vibration) => setPrefs({ vibration })}
        />
        <li className="py-1.5">
          <p className="text-[14px] font-extrabold">Steering buttons</p>
          <p className="text-[11px] text-ink-soft">
            Put both arrows on one side to steer with one thumb.
          </p>
          <div
            className="mt-1 grid grid-cols-3 gap-1"
            role="radiogroup"
            aria-label="Steering buttons"
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
                {h.label}
              </button>
            ))}
          </div>
        </li>
      </ul>
    </section>
  );
};
