/**
 * Lists every English text the game can show, so translation tables can be
 * checked for gaps:
 *
 *   npm run i18n:check     # prints missing Vietnamese keys, fails if any
 *
 * Texts come from tr('...') calls in the client, the game data that screens
 * pass through tr() (stages, landmarks, weather, items, pets, quests…), and the
 * messages the server can send back.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import {
  CITIES,
  TERRAIN,
  TIMES,
  WEATHER,
  LEG_LABEL,
} from '../src/shared/content';
import { HAIR_STYLES, ITEMS, PETS, SLOT_LABEL } from '../src/shared/economy';
import { ACHIEVEMENTS } from '../src/shared/achievements';
import { DAILY, WEEKLY, RUN_QUEST } from '../src/shared/quests';
import { ARCADE_INFO } from '../src/shared/arcade';
import { QUICK_CHAT } from '../src/shared/chat';
import { ITEM_LABEL } from '../src/shared/course';
import { TOUR, TOUR_KIND } from '../src/shared/tour';
import { PACE_LABEL } from '../src/shared/sim';
import { NEXT_CITIES } from '../src/shared/vote';
import { holidayBanner, holidayShort } from '../src/shared/festive';
import { VI } from '../src/client/i18n/vi';

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory()
      ? files(p)
      : /\.(ts|tsx)$/.test(f) && !/\.test\./.test(f)
        ? [p]
        : [];
  });

const keys = new Set<string>();
const literals = (n: ts.Node) => {
  if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n))
    keys.add(n.text);
  else if (ts.isConditionalExpression(n)) {
    literals(n.whenTrue);
    literals(n.whenFalse);
  } else if (ts.isParenthesizedExpression(n)) literals(n.expression);
};
for (const f of files('src/client')) {
  const sf = ts.createSourceFile(
    f,
    readFileSync(f, 'utf8'),
    ts.ScriptTarget.Latest,
    true
  );
  const visit = (n: ts.Node) => {
    if (
      ts.isCallExpression(n) &&
      n.expression.getText() === 'tr' &&
      n.arguments[0]
    )
      literals(n.arguments[0]);
    ts.forEachChild(n, visit);
  };
  visit(sf);
}
// Server messages that reach the player.
for (const f of files('src/server')) {
  const sf = ts.createSourceFile(
    f,
    readFileSync(f, 'utf8'),
    ts.ScriptTarget.Latest,
    true
  );
  const visit = (n: ts.Node) => {
    if (
      ts.isNewExpression(n) &&
      n.expression.getText() === 'GameError' &&
      n.arguments?.[0]
    )
      literals(n.arguments[0]);
    ts.forEachChild(n, visit);
  };
  visit(sf);
}

const add = (...xs: (string | undefined | null)[]) =>
  xs.forEach((x) => x && keys.add(x));
for (const c of CITIES) {
  add(c.name, c.country);
  for (const s of c.stages) add(s.name, s.landmark.name, s.landmark.blurb);
}
Object.values(TERRAIN).forEach((t) => add(t.label));
Object.values(TIMES).forEach((t) => add(t.label, t.hint));
Object.values(WEATHER).forEach((w) => add(w.label, w.hint, w.id));
Object.values(LEG_LABEL).forEach((l) => add(l.label));
Object.values(PACE_LABEL).forEach((l) => add(l));
Object.values(SLOT_LABEL).forEach((l) => add(l));
ITEMS.forEach((i) => add(i.name));
PETS.forEach((p) => add(p.name, p.quirk));
ACHIEVEMENTS.forEach((a) => add(a.name, a.goal));
[...DAILY, ...WEEKLY, RUN_QUEST].forEach((q) => add(q.label));
Object.values(ARCADE_INFO).forEach((a) => add(a.name, a.rules));
QUICK_CHAT.forEach((l) => add(l));
Object.values(ITEM_LABEL).forEach((l) => add(l));
NEXT_CITIES.forEach((c) => add(c.name));
for (const s of TOUR)
  add(
    s.place,
    s.country,
    s.stage.name,
    s.stage.landmark.name,
    s.stage.landmark.blurb
  );
Object.values(TOUR_KIND).forEach((k) => add(k.label));
add(
  holidayBanner('2026-12-25'),
  holidayBanner('2026-12-01'),
  holidayShort('2026-12-25'),
  holidayShort('2026-12-01')
);

// Labels kept in tables inside client files and passed to tr() as variables.
const quoted = (file: string, from?: string, to?: string) => {
  let src = readFileSync(file, 'utf8');
  if (from)
    src = src.slice(
      src.indexOf(from),
      to ? src.indexOf(to, src.indexOf(from)) : undefined
    );
  for (const m of src.matchAll(/'((?:[^'\\]|\\.)*)'/g)) {
    const v = m[1]!.replace(/\\'/g, "'");
    if (v.startsWith('.') || v.includes('/')) continue;
    if (
      (/[A-Za-z]/.test(v) && !/^[a-z-]+$/.test(v)) ||
      /^(left|middle|right)$/.test(v)
    )
      add(v);
  }
};
quoted(
  'src/client/screens/ResultScreen.tsx',
  'const KIND_WORD',
  'const countKinds'
);
quoted('src/client/components/TabBar.tsx', 'const TABS', '];');
quoted('src/client/components/ComfortOptions.tsx', 'const HANDS', '];');
quoted('src/client/lib/coach.ts', 'const LANE_NAME');
quoted('src/client/screens/CorralScreen.tsx', 'const LANE_NAME', '};');
quoted(
  'src/client/screens/RunScreen.tsx',
  'const eventToast',
  'export const RunScreen'
);
quoted(
  'src/client/screens/PlanScreen.tsx',
  'const legsVerdict',
  'export const PlanScreen'
);
quoted('src/client/lib/theme.ts', 'PACE_HINT');
quoted('src/client/lib/games.ts');
// Single words in the race report, and the hair style names.
for (const m of readFileSync(
  'src/client/screens/ResultScreen.tsx',
  'utf8'
).matchAll(/\[\s*'([a-z ]+)',\s*'([a-z ]+)'\s*\]/g))
  add(m[1], m[2]);
HAIR_STYLES.forEach((h) => add(h));
add('Automatic');
// Server messages with values, matched by trServer().
add(
  '{name} is already happy today.',
  '{name} loved that! Friendship {n}.',
  'Cheer sent to u/{name}! +{n} coins',
  'Quest done: +{n} coins',
  'Day {day} check-in: +{n} coins',
  'Bib #{n} is yours!',
  'Vote counted for {city}',
  'Unlocked!'
);
// The coach's snack tip, one text per lane.
for (const lane of ['left', 'middle', 'right'])
  add(
    `🍰 Snack ahead, in the ${lane} lane. Steer into it for a burst of speed!`
  );
add('🍰 Snack ahead, right in your lane. Run through it for a burst of speed!');

const all = [...keys].filter((k) => /[A-Za-z]/.test(k)).sort();
const missing = all.filter((k) => !(k in VI));
if (process.argv.includes('--all')) console.log(JSON.stringify(all, null, 1));
else console.log(JSON.stringify(missing, null, 1));
console.error(`${all.length} texts, ${missing.length} missing in Vietnamese`);
if (missing.length > 0) process.exitCode = 1;
