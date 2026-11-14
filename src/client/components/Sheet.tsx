import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { tr } from '../i18n';

/**
 * A bottom sheet for secondary information, so the screens behind it fit on
 * one phone screen without scrolling. Tap outside, the ✕ or Escape to close.
 */
export const Sheet = ({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) => {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const back = document.activeElement as HTMLElement | null;
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      back?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#2a2340]/45"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="sheet-in flex max-h-[88%] w-full max-w-[440px] flex-col rounded-t-3xl border-2 border-b-0 border-ink bg-[#fff8fb] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-1">
          <h2 className="font-display text-[19px] font-extrabold leading-tight">
            {title}
          </h2>
          <button
            ref={close}
            type="button"
            onClick={onClose}
            aria-label={tr('Close')}
            className="chunky grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-[15px] font-extrabold"
          >
            ✕
          </button>
        </div>
        <div className="flex flex-col gap-2 overflow-y-auto px-4 pt-1 pb-5">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

/** A small pill that opens a sheet. */
export const Chip = ({
  icon,
  label,
  onClick,
  tone = 'white',
}: {
  icon: string;
  label: string;
  onClick: () => void;
  tone?: 'white' | 'gold' | 'blue';
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`chunky flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-extrabold ${
      tone === 'gold'
        ? 'bg-[#fff4cf]'
        : tone === 'blue'
          ? 'bg-[#e3f6ff]'
          : 'bg-white'
    }`}
  >
    <span aria-hidden>{icon}</span>
    {label}
  </button>
);

/** A square tile in a row of menu buttons. */
export const Tile = ({
  icon,
  label,
  note,
  onClick,
}: {
  icon: string;
  label: string;
  note?: string | undefined;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="chunky flex min-w-0 flex-1 flex-col items-center rounded-2xl bg-white px-1 py-1.5"
  >
    <span className="text-[20px] leading-none" aria-hidden>
      {icon}
    </span>
    <span className="mt-0.5 w-full truncate text-center text-[11px] font-extrabold leading-tight">
      {label}
    </span>
    {note && (
      <span className="w-full truncate text-center text-[10px] font-bold leading-tight text-ink-soft">
        {note}
      </span>
    )}
  </button>
);
