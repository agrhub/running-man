import { useState, type ReactNode } from 'react';
import type { Profile } from '../../shared/api';
import type { DayInfo } from '../../shared/content';
import {
  ITEMS,
  PETS,
  SLOTS,
  SLOT_LABEL,
  COIN,
  unlockLabel,
  type Item,
  type Pet,
  type Slot,
} from '../../shared/economy';
import { RunnerPreview } from '../components/RunnerPreview';

type Props = {
  day: DayInfo;
  today: string;
  profile: Profile;
  busy: boolean;
  onBack: () => void;
  onEquip: (itemId: string) => void;
  onBuy: (itemId: string) => void;
  onPet: (petId: Pet['id'] | 'none') => void;
  onCare: () => void;
};

const ItemCard = ({
  item,
  profile,
  busy,
  onEquip,
  onBuy,
}: {
  item: Item;
  profile: Profile;
  busy: boolean;
  onEquip: () => void;
  onBuy: () => void;
}) => {
  const owned = profile.owned.includes(item.id);
  const equipped = profile.look[item.slot] === item.id;
  const buyable = !owned && item.unlock.kind === 'badges';
  const affordable =
    buyable &&
    item.unlock.kind === 'badges' &&
    profile.badges >= item.unlock.cost;
  let action: ReactNode;
  if (equipped)
    action = (
      <span className="text-[12px] font-extrabold text-easy">Wearing</span>
    );
  else if (owned)
    action = (
      <button
        type="button"
        disabled={busy}
        onClick={onEquip}
        className="chunky rounded-full bg-white px-3 text-[12px] font-extrabold"
      >
        Wear
      </button>
    );
  else if (buyable)
    action = (
      <button
        type="button"
        disabled={busy || !affordable}
        onClick={onBuy}
        className="chunky rounded-full bg-gold px-3 text-[12px] font-extrabold"
      >
        Buy {unlockLabel(item.unlock)}
      </button>
    );
  else
    action = (
      <span className="text-[11px] font-bold leading-tight text-ink-soft">
        🔒 {unlockLabel(item.unlock)}
      </span>
    );

  return (
    <li
      className={`flex items-center gap-2 rounded-xl border-2 px-2 py-1.5 ${equipped ? 'border-ink bg-[var(--sky)]' : 'border-ink/20 bg-white'}`}
    >
      <span
        className="h-7 w-7 shrink-0 rounded-full border-2 border-ink"
        style={{
          background:
            item.shape === 'none'
              ? 'repeating-linear-gradient(45deg,#fff 0 4px,#ddd 4px 8px)'
              : item.color,
        }}
        aria-hidden
      />
      <span className="flex-1 text-[13px] font-extrabold leading-tight">
        {item.name}
      </span>
      {action}
    </li>
  );
};

export const LockerScreen = (p: Props) => {
  const [tab, setTab] = useState<Slot | 'pet'>('top');
  const { profile } = p;
  const caredToday = profile.petCaredOn === p.today;
  const pet = PETS.find((x) => x.id === profile.look.pet);

  return (
    <div className="flex h-full flex-col max-w-[440px] mx-auto">
      <div className="flex items-center justify-between px-4 pt-3">
        <button
          type="button"
          onClick={p.onBack}
          className="chunky rounded-full bg-white px-3 py-1 text-[13px] font-extrabold"
        >
          ← Back
        </button>
        <p className="font-display text-[20px] font-extrabold">
          {COIN} {profile.badges} coins
        </p>
      </div>
      <div className="h-[34%] min-h-[170px]">
        <RunnerPreview
          day={p.day}
          look={profile.look}
          bib={profile.bib}
          showBack
        />
      </div>
      <nav
        className="flex gap-1 overflow-x-auto px-4 pb-2"
        aria-label="Locker sections"
      >
        {[...SLOTS, 'pet' as const].map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={tab === s}
            onClick={() => setTab(s)}
            className={`shrink-0 rounded-full border-2 border-ink px-3 py-1 text-[13px] font-extrabold ${tab === s ? 'bg-ink text-white' : 'bg-white'}`}
          >
            {s === 'pet' ? 'Pet' : SLOT_LABEL[s]}
          </button>
        ))}
      </nav>
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {tab === 'pet' ? (
          <>
            <div className="mb-2 flex items-center gap-2 rounded-xl border-2 border-ink bg-white px-3 py-2">
              <div className="flex-1">
                <p className="text-[14px] font-extrabold">
                  {pet
                    ? `${pet.name} runs with you`
                    : 'No pet yet: adopt one below'}
                </p>
                <p className="text-[12px] text-ink-soft">
                  Friendship {'❤️'.repeat(Math.min(5, profile.petAffinity))}
                  {'🤍'.repeat(Math.max(0, 5 - profile.petAffinity))}{' '}
                  {profile.petAffinity > 5 ? `+${profile.petAffinity - 5}` : ''}
                </p>
              </div>
              <button
                type="button"
                disabled={p.busy || caredToday || !pet}
                onClick={p.onCare}
                className="chunky rounded-full bg-gold px-3 py-1 text-[13px] font-extrabold"
              >
                {caredToday ? 'Happy today' : 'Give a treat'}
              </button>
            </div>
            <ul className="flex flex-col gap-1.5">
              {profile.ownedPets.length > 0 && (
                <li
                  className={`flex items-center gap-2 rounded-xl border-2 px-2 py-1.5 ${!pet ? 'border-ink bg-[var(--sky)]' : 'border-ink/20 bg-white'}`}
                >
                  <div className="flex-1">
                    <p className="text-[13px] font-extrabold">No pet</p>
                    <p className="text-[11px] text-ink-soft">
                      Run on your own today.
                    </p>
                  </div>
                  {!pet ? (
                    <span className="text-[12px] font-extrabold text-easy">
                      Chosen
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={p.busy}
                      onClick={() => p.onPet('none')}
                      className="chunky rounded-full bg-white px-3 text-[12px] font-extrabold"
                    >
                      Leave at home
                    </button>
                  )}
                </li>
              )}
              {PETS.map((x) => {
                const owned = profile.ownedPets.includes(x.id);
                const active = profile.look.pet === x.id;
                const canBuy =
                  !owned &&
                  x.unlock.kind === 'badges' &&
                  profile.badges >= x.unlock.cost;
                return (
                  <li
                    key={x.id}
                    className={`flex items-center gap-2 rounded-xl border-2 px-2 py-1.5 ${active ? 'border-ink bg-[var(--sky)]' : 'border-ink/20 bg-white'}`}
                  >
                    <div className="flex-1">
                      <p className="text-[13px] font-extrabold">{x.name}</p>
                      <p className="text-[11px] text-ink-soft">{x.quirk}</p>
                    </div>
                    {active ? (
                      <span className="text-[12px] font-extrabold text-easy">
                        Running
                      </span>
                    ) : owned || x.unlock.kind === 'badges' ? (
                      <button
                        type="button"
                        disabled={p.busy || (!owned && !canBuy)}
                        onClick={() => p.onPet(x.id)}
                        className={`chunky rounded-full px-3 text-[12px] font-extrabold ${owned ? 'bg-white' : 'bg-gold'}`}
                      >
                        {owned ? 'Choose' : `Adopt ${unlockLabel(x.unlock)}`}
                      </button>
                    ) : (
                      <span className="text-[11px] font-bold text-ink-soft">
                        🔒 {unlockLabel(x.unlock)}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
            <h3 className="mt-3 mb-1 font-display text-[16px] font-extrabold">
              Pet gear
            </h3>
            <ul className="flex flex-col gap-1.5" aria-label="Pet gear">
              {ITEMS.filter((i) => i.slot === 'petGear').map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  profile={profile}
                  busy={p.busy}
                  onEquip={() => p.onEquip(item.id)}
                  onBuy={() => p.onBuy(item.id)}
                />
              ))}
            </ul>
            <p className="mt-2 text-[12px] text-ink-soft">
              Pets and their gear are just for fun. They never change your race
              time.
            </p>
          </>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {ITEMS.filter((i) => i.slot === tab).map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                profile={profile}
                busy={p.busy}
                onEquip={() => p.onEquip(item.id)}
                onBuy={() => p.onBuy(item.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
