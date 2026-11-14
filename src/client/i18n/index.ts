import { useEffect, useState } from 'react';
import { VI } from './vi';

/**
 * Translations, gettext style: the English text is the key, so English needs no
 * table and anything not yet translated shows in English. `{name}` marks a value
 * filled in at run time.
 *
 * The language follows the device unless the player picks one in Me → Options.
 * Public Reddit posts and comments stay in English, since everyone reads them.
 */
export type Lang = 'en' | 'vi';
export type LangChoice = Lang | 'auto';

export const LANGS: { id: LangChoice; label: string }[] = [
  { id: 'auto', label: 'Automatic' },
  { id: 'en', label: 'English' },
  { id: 'vi', label: 'Tiếng Việt' },
];

const DICTS: Record<Lang, Record<string, string>> = { en: {}, vi: VI };
const KEY = 'rm-lang';

const fromDevice = (): Lang => {
  try {
    const list = navigator.languages?.length
      ? navigator.languages
      : [navigator.language];
    for (const l of list) if (l?.toLowerCase().startsWith('vi')) return 'vi';
  } catch {
    // no navigator: English
  }
  return 'en';
};

const readChoice = (): LangChoice => {
  try {
    const v = window.localStorage.getItem(KEY);
    if (v === 'en' || v === 'vi') return v;
  } catch {
    // storage blocked: automatic
  }
  return 'auto';
};

let choice: LangChoice = typeof window === 'undefined' ? 'auto' : readChoice();
let lang: Lang = choice === 'auto' ? fromDevice() : choice;
const listeners = new Set<() => void>();

const applyDoc = () => {
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
};
applyDoc();

export const currentLang = () => lang;
export const langChoice = () => choice;

export const setLang = (next: LangChoice) => {
  choice = next;
  lang = next === 'auto' ? fromDevice() : next;
  try {
    if (next === 'auto') window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, next);
  } catch {
    // kept for this visit only
  }
  applyDoc();
  listeners.forEach((l) => l());
};

/** Translate `text`, then fill in `{name}` values. */
export const tr = (
  text: string,
  vars?: Record<string, string | number>
): string => {
  const out = DICTS[lang][text] ?? text;
  if (!vars) return out;
  return out.replace(/\{(\w+)\}/g, (m, k: string) =>
    k in vars ? String(vars[k]) : m
  );
};

/**
 * Messages the server writes with values inside: matched here so they read in
 * the player's language too. Anything else goes through tr() as is.
 */
const SERVER: [RegExp, string, string[]][] = [
  [
    /^(.+) is already happy today\.$/,
    '{name} is already happy today.',
    ['name'],
  ],
  [
    /^(.+) loved that! Friendship (\d+)\.$/,
    '{name} loved that! Friendship {n}.',
    ['name', 'n'],
  ],
  [
    /^Cheer sent to u\/(.+)! \+(\d+) coins$/,
    'Cheer sent to u/{name}! +{n} coins',
    ['name', 'n'],
  ],
  [/^Quest done: \+(\d+) coins$/, 'Quest done: +{n} coins', ['n']],
  [
    /^Day (\d+) check-in: \+(\d+) coins$/,
    'Day {day} check-in: +{n} coins',
    ['day', 'n'],
  ],
  [/^Bib #(\d+) is yours!$/, 'Bib #{n} is yours!', ['n']],
  [
    /^Vote counted for (.+?)( \S+)?$/,
    'Vote counted for {city}',
    ['city', 'flag'],
  ],
];

/** A message from the server, in the player's language. */
export const trServer = (text: string): string => {
  if (DICTS[lang][text]) return tr(text);
  for (const [re, key, names] of SERVER) {
    const m = re.exec(text);
    if (!m) continue;
    const vars: Record<string, string> = {};
    names.forEach((n, i) => (vars[n] = m[i + 1] ?? ''));
    if ('name' in vars && key.startsWith('{name}')) vars.name = tr(vars.name!);
    if ('city' in vars) vars.city = tr(vars.city!);
    const out = tr(key, vars);
    return vars.flag ? `${out}${vars.flag}` : out;
  }
  return tr(text);
};

/** Re-renders the caller when the language changes. */
export const useLang = (): Lang => {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return lang;
};
