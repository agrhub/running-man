import { navigateTo } from '@devvit/web/client';
import { PROP_CREDITS } from '../three/props/packed';
import { tr } from '../i18n';

/**
 * Credits for the roadside 3D models: each one is a free Polyfork model under
 * CC BY 4.0, converted to the game's format with its shapes and colours kept.
 */
export const ModelCredits = () => (
  <details className="rounded-2xl border-2 border-ink/20 bg-white/70 px-3 py-2">
    <summary className="cursor-pointer text-[13px] font-extrabold">
      {tr('3D model credits')}
    </summary>
    <p className="mt-1 text-[12px] leading-snug text-ink-soft">
      {tr(
        'Roadside models by Polyfork (polyfork.dev), CC BY 4.0, converted to this game’s format with their shapes and colours kept.'
      )}
    </p>
    <ul className="mt-1 columns-2 gap-3 text-[12px] leading-snug">
      {PROP_CREDITS.map((c) => (
        <li key={c.id} className="break-inside-avoid">
          <button
            type="button"
            className="text-left underline decoration-ink/30 underline-offset-2"
            onClick={() => navigateTo(c.page)}
          >
            {c.title}
          </button>
        </li>
      ))}
    </ul>
  </details>
);
