import { useMemo, useState } from 'react';
import type { Profile } from '../../shared/api';
import type { DayInfo } from '../../shared/content';
import {
  HAIR_STYLES,
  HAIR_TONES,
  ITEMS,
  PETS,
  SKIN_TONES,
  type Look,
  type PetChoice,
} from '../../shared/economy';
import { RunnerPreview } from '../components/RunnerPreview';
import { tr } from '../i18n';

type Props = {
  day: DayInfo;
  profile: Profile;
  busy: boolean;
  onRegister: (choice: {
    skin: number;
    hair: number;
    hairStyle: number;
    top: string;
    pet: PetChoice;
  }) => void;
};

const Swatch = ({
  color,
  selected,
  label,
  onClick,
}: {
  color: string;
  selected: boolean;
  label: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    aria-label={label}
    aria-pressed={selected}
    onClick={onClick}
    className={`h-9 w-9 shrink-0 rounded-full border-[3px] ${selected ? 'border-ink scale-110' : 'border-white'} shadow-[0_0_0_1.5px_#2a2340] transition-transform`}
    style={{ background: color }}
  />
);

/** First visit: create your runner and collect a race bib. */
export const RegisterScreen = ({ day, profile, busy, onRegister }: Props) => {
  const tops = ITEMS.filter(
    (i) => i.slot === 'top' && profile.owned.includes(i.id)
  );
  const pets = PETS.filter((p) => profile.ownedPets.includes(p.id));
  const [skin, setSkin] = useState(profile.look.skin);
  const [hair, setHair] = useState(profile.look.hair);
  const [hairStyle, setHairStyle] = useState(profile.look.hairStyle ?? 0);
  const [top, setTop] = useState(profile.look.top);
  const [pet, setPet] = useState<PetChoice>(profile.look.pet);

  const look: Look = useMemo(
    () => ({ ...profile.look, skin, hair, hairStyle, top, pet }),
    [profile.look, skin, hair, hairStyle, top, pet]
  );

  return (
    <div className="flex h-full flex-col max-w-[440px] mx-auto">
      <header className="px-4 pt-3">
        <p className="text-[13px] font-extrabold text-ink-soft">
          {day.city.flag} {tr('Running Man')}
        </p>
        <h1 className="font-display text-[28px] font-extrabold leading-tight">
          {tr('Make your runner')}
        </h1>
        <p className="text-[13px] text-ink-soft">
          {tr('Everyone on the road will see this runner as u/{name}.', {
            name: profile.username,
          })}
        </p>
      </header>

      <div className="h-[30%] min-h-[170px]">
        <RunnerPreview day={day} look={look} bib={null} />
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-3">
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="mb-1.5 text-[13px] font-extrabold">{tr('Skin')}</h2>
            <div className="flex flex-wrap gap-2">
              {SKIN_TONES.map((c, i) => (
                <Swatch
                  key={c}
                  color={c}
                  label={tr('Skin tone {n}', { n: i + 1 })}
                  selected={skin === i}
                  onClick={() => setSkin(i)}
                />
              ))}
            </div>
          </div>
          <div>
            <h2 className="mb-1.5 text-[13px] font-extrabold">{tr('Hair')}</h2>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {HAIR_STYLES.map((name, i) => (
                <button
                  key={name}
                  type="button"
                  aria-pressed={hairStyle === i}
                  onClick={() => setHairStyle(i)}
                  className={`rounded-full border-2 border-ink px-3 py-1 text-[13px] font-extrabold ${hairStyle === i ? 'bg-ink text-white' : 'bg-white'}`}
                >
                  {tr(name)}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {HAIR_TONES.map((c, i) => (
                <Swatch
                  key={c}
                  color={c}
                  label={tr('Hair colour {n}', { n: i + 1 })}
                  selected={hair === i}
                  onClick={() => setHair(i)}
                />
              ))}
            </div>
          </div>
          <div>
            <h2 className="mb-1.5 text-[13px] font-extrabold">{tr('Shirt')}</h2>
            <div className="flex flex-wrap gap-2">
              {tops.map((t) => (
                <Swatch
                  key={t.id}
                  color={t.color}
                  label={t.name}
                  selected={top === t.id}
                  onClick={() => setTop(t.id)}
                />
              ))}
            </div>
          </div>
          <div>
            <h2 className="mb-1.5 text-[13px] font-extrabold">
              {tr('Running buddy')}
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {pets.length > 0 && (
                <button
                  type="button"
                  aria-pressed={pet === 'none'}
                  onClick={() => setPet('none')}
                  className={`rounded-full border-2 border-ink px-3 py-1 text-[13px] font-extrabold ${pet === 'none' ? 'bg-ink text-white' : 'bg-white'}`}
                >
                  {tr('No pet')}
                </button>
              )}
              {pets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={pet === p.id}
                  onClick={() => setPet(p.id)}
                  className={`rounded-full border-2 border-ink px-3 py-1 text-[13px] font-extrabold ${pet === p.id ? 'bg-ink text-white' : 'bg-white'}`}
                >
                  {p.name}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[12px] text-ink-soft">
              {pets.length === 0
                ? tr(
                    'No pet yet: adopt one in the Shop with the coins you earn.'
                  )
                : tr('More pets and outfits wait in the Shop.')}
            </p>
          </div>
        </section>
      </div>

      <div className="px-4 pb-4">
        <button
          type="button"
          disabled={busy}
          onClick={() => onRegister({ skin, hair, hairStyle, top, pet })}
          className="chunky w-full rounded-2xl bg-[var(--accent)] py-3 font-display text-[21px] font-extrabold text-white"
        >
          {busy ? tr('Printing your bib…') : tr('Get my race bib')}
        </button>
      </div>
    </div>
  );
};
