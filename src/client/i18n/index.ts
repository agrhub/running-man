import { useEffect, useState } from 'react';

/**
 * Translations, gettext style: the English text is the key, so English needs no
 * table and anything not yet translated shows in English. `{name}` marks a value
 * filled in at run time.
 *
 * The language follows the device unless the player picks one in Me → Options.
 * Public Reddit posts and comments stay in English, since everyone reads them.
 */
export type Lang = 'en' | 'vi' | 'es' | 'pt';
export type LangChoice = Lang | 'auto';

export const LANGS: { id: LangChoice; label: string }[] = [
  { id: 'auto', label: 'Automatic' },
  { id: 'en', label: 'English' },
  { id: 'es', label: 'Español' },
  { id: 'pt', label: 'Português (Brasil)' },
  { id: 'vi', label: 'Tiếng Việt' },
];

/**
 * English needs no table. Other tables are loaded only on devices that use
 * them, so English players never download them (the feed card stays light).
 */
const DICTS: Record<Lang, Record<string, string>> = {
  en: {},
  vi: {},
  es: {},
  pt: {},
};
const loaded = new Set<Lang>(['en']);
const loadDict = async (l: Lang): Promise<void> => {
  if (loaded.has(l)) return;
  if (l === 'vi') DICTS.vi = (await import('./vi')).VI;
  if (l === 'es') DICTS.es = (await import('./es')).ES;
  if (l === 'pt') DICTS.pt = (await import('./pt')).PT;
  loaded.add(l);
};
const KEY = 'rm-lang';

const fromDevice = (): Lang => {
  try {
    const list = navigator.languages?.length
      ? navigator.languages
      : [navigator.language];
    for (const l of list) {
      const code = l?.toLowerCase() ?? '';
      if (code.startsWith('vi')) return 'vi';
      if (code.startsWith('es')) return 'es';
      if (code.startsWith('pt')) return 'pt';
      if (code.startsWith('en')) return 'en';
    }
  } catch {
    // no navigator: English
  }
  return 'en';
};

const readChoice = (): LangChoice => {
  try {
    const v = window.localStorage.getItem(KEY);
    if (v === 'en' || v === 'vi' || v === 'es' || v === 'pt') return v;
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

/** Loads the table for the current language. Render the app after it resolves. */
export const i18nReady = (): Promise<void> =>
  loadDict(lang).catch(() => {
    // Offline or blocked: show English rather than nothing.
    lang = 'en';
    applyDoc();
  });

/** Switches language; the table loads first, then everything re-renders. */
export const setLang = async (next: LangChoice): Promise<void> => {
  choice = next;
  const want: Lang = next === 'auto' ? fromDevice() : next;
  await loadDict(want).catch(() => undefined);
  lang = loaded.has(want) ? want : 'en';
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
