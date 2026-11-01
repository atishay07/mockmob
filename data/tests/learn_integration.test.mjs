// Learn v2 and the rest of the app (BUILD-1101 packet F1, critic LK23): with NEXT_PUBLIC_LEARN2 on, a student meets one Key cards world,
// not two. Every entry point that led to the v1 Key cards pages (/cards, /cards/<chapter>) is listed here with the target it has with the
// flag off (the v1 one, unchanged) and with the flag on (Learn v2's). Static checks over the sources, plus the pure helpers run as they are.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const read = (rel) => readFileSync(path.join(root, rel), 'utf8');
const APP = 'src/app/(app)';
const KEY = 'accountancy.accounting-for-partnership-basic-concepts';

// A client module with its imports stubbed (next/navigation, react), loaded from a data: URL; `tag` makes each load a fresh module so a
// module-level flag constant can be read with the env on and off.
async function load(rel, { env = {}, tag = '' } = {}) {
  const saved = process.env.NEXT_PUBLIC_LEARN2;
  if ('NEXT_PUBLIC_LEARN2' in env) { if (env.NEXT_PUBLIC_LEARN2 === undefined) delete process.env.NEXT_PUBLIC_LEARN2; else process.env.NEXT_PUBLIC_LEARN2 = env.NEXT_PUBLIC_LEARN2; }
  try {
    const src = read(rel)
      .replace(/^"use client";?$/m, '')
      .replace(/^import \{ useCallback \} from 'react';$/m, 'const useCallback = (fn) => fn;')
      // R3 X7: flag.js reads the address through useSyncExternalStore (server snapshot: not off), so its stubs differ from links.js's.
      .replace(/^import \{ useSyncExternalStore \} from 'react';$/m, 'const useSyncExternalStore = (subscribe, get) => get();')
      .replace(/^import \{ usePathname \} from 'next\/navigation';$/m, 'const usePathname = () => globalThis.__learnPath;')
      .replace('window.location.search', '(globalThis.__learnSearch || "")')
      .replace(/^import \{ usePathname, useSearchParams \} from 'next\/navigation';$/m, 'const usePathname = () => globalThis.__learnPath; const useSearchParams = () => new URLSearchParams(globalThis.__learnSearch || "");');
    assert.doesNotMatch(src, /^import /m, `every import of ${rel} is stubbed`);
    return await import(`data:text/javascript;base64,${Buffer.from(`${src}\n// ${tag}`).toString('base64')}`);
  } finally { if (saved === undefined) delete process.env.NEXT_PUBLIC_LEARN2; else process.env.NEXT_PUBLIC_LEARN2 = saved; }
}
const at = (pathname, search = '') => { globalThis.__learnPath = pathname; globalThis.__learnSearch = search; };

test('the flag helper: on only when NEXT_PUBLIC_LEARN2 is exactly on; the preview is v2 unless &l2=off', async () => {
  const off = await load('src/components/learn2/flag.js', { env: { NEXT_PUBLIC_LEARN2: undefined }, tag: 'off' });
  const on = await load('src/components/learn2/flag.js', { env: { NEXT_PUBLIC_LEARN2: 'on' }, tag: 'on' });
  const word = await load('src/components/learn2/flag.js', { env: { NEXT_PUBLIC_LEARN2: 'true' }, tag: 'true' });
  at('/review');
  assert.equal(off.useLearn2On(), false, 'real site, flag unset');
  assert.equal(word.useLearn2On(), false, 'only "on"');
  assert.equal(on.useLearn2On(), true, 'real site, flag on');
  at('/preview/arena', 'view=review');
  assert.equal(off.useLearn2On(), true, 'the preview draws v2 by default');
  at('/preview/arena', 'view=review&l2=off');
  assert.equal(off.useLearn2On(), false, '&l2=off shows the live site as it is with the flag off');
  assert.equal(on.useLearn2On(), true, 'the flag on wins');
});

test('the /cards redirects: every v1 route has its v2 target', async () => {
  const r = await import(pathToFileURL(path.join(root, `${APP}/cards/redirects.js`)).href);
  assert.equal(r.cardsHomeTarget({}), '/learn');
  assert.equal(r.cardsHomeTarget(undefined), '/learn');
  assert.equal(r.cardsHomeTarget({ subject: 'economics' }), '/learn?subject=economics', 'the subject param is kept');
  assert.equal(r.cardsHomeTarget({ subject: ['economics', 'x'] }), '/learn?subject=economics', 'a repeated param: the first');
  assert.equal(r.cardsHomeTarget({ subject: 'a/../b' }), '/learn', 'a malformed subject is dropped');
  assert.equal(r.cardsDeckTarget(KEY, {}), `/learn/c/${KEY}/cards`, '/cards/<chapter> to the Cards view');
  assert.equal(r.cardsDeckTarget(KEY, { mode: 'read' }), `/learn/c/${KEY}/cards`, 'read is the Cards view');
  assert.equal(r.cardsDeckTarget(KEY, { mode: 'study' }), `/learn/c/${KEY}`, '?mode=study to the chapter page');
  assert.equal(r.cardsDeckTarget(KEY, { mode: 'last-look' }), `/learn/c/${KEY}/cards?f=must`, '?mode=last-look to Must-know');
  assert.equal(r.cardsDeckTarget(KEY, { mode: 'last' }), `/learn/c/${KEY}/cards?f=must`, 'the v1 page wrote ?mode=last; it goes to Must-know too');
  assert.equal(r.cardsDeckTarget('business_studies.planning', undefined), '/learn/c/business_studies.planning/cards');
  assert.equal(r.cardsDeckTarget('not a chapter', {}), '/learn', 'an unknown key never reaches a chapter page that cannot exist');
  assert.equal(r.cardsDeckTarget('', {}), '/learn');
});

test('the /cards pages: with the flag off they are exactly what they were; with it on they redirect', () => {
  const home = read(`${APP}/cards/page.jsx`);
  const deck = read(`${APP}/cards/[chapter]/page.jsx`);
  assert.match(home, /if \(learn2On\(\)\) redirect\(cardsHomeTarget\(await searchParams\)\);/, 'the home redirects behind the flag, and reads searchParams only then');
  assert.match(deck, /if \(learn2On\(\)\) redirect\(cardsDeckTarget\(key, await searchParams\)\);/, 'the deck redirects behind the flag');
  assert.match(home, /<KeycardsHome \/>/, 'the v1 home is still the page');
  assert.match(deck, /<ChapterDeck key=\{key\} chapterKey=\{key\} \/>/, 'the v1 deck is still the page');
  assert.match(home, /from 'next\/navigation'/);
  assert.doesNotMatch(home, /^['"]use client['"]/m);
  assert.doesNotMatch(deck, /^['"]use client['"]/m);
});

test('every entry point into Key cards, with the flag off (v1) and on (v2)', async () => {
  const v1 = await load('src/components/keycards/links.js');
  const v2 = await load('src/components/learn2/links.js');
  const links = read('src/components/keycards/KeycardsLinks.jsx');
  at('/review');
  const old = v1.useCardsLinks();
  const next = v2.useLearnLinks();
  // Each row: where it lives, the expression it draws, the v1 href (flag off) and the v2 href (flag on). The expression is checked in the source
  // and then evaluated both ways with the real helpers, so the test cannot pass for a link the component does not draw.
  const entries = [
    { name: "Review's chapter rows: Key cards for this chapter", expr: /href=\{v2 \? learn\.cards\(row\.key\) : links\.deck\(row\.key\)\}/, off: old.deck(KEY), on: next.cards(KEY),
      v1: `/cards/${KEY}`, v2: `/learn/c/${KEY}/cards` },
    { name: "the Learn hub row (v1 Learn's Key cards row)", expr: /href=\{v2 \? learn\.home\(\) : links\.home\(\)\}/, off: old.home(), on: next.home(), v1: '/cards', v2: '/learn' },
  ];
  for (const e of entries) {
    assert.match(links, e.expr, `${e.name}: the source draws the flag-gated link`);
    assert.equal(e.off, e.v1, `${e.name}: flag off leads to the v1 page`);
    assert.equal(e.on, e.v2, `${e.name}: flag on leads to Learn v2`);
  }
  assert.match(links, /const v2 = useLearn2On\(\);/, 'both entry points read the flag through the one helper');
  assert.equal((links.match(/useLearn2On\(\)/g) || []).length, 2);
  // In the development preview the same links stay in the preview.
  at('/preview/arena', 'view=review&plan=pro');
  const inPreview = v2.useLearnLinks();
  const parsed = new URL(inPreview.cards(KEY), 'http://x');
  assert.equal(parsed.pathname, '/preview/arena');
  assert.equal(parsed.searchParams.get('view'), 'learn2-cards');
  assert.equal(parsed.searchParams.get('chapter'), KEY);
  assert.equal(parsed.searchParams.get('plan'), 'pro');
});

test('entry points that never linked to /cards still reach Learn v2 on their own, and nothing else in src links to /cards', () => {
  // Start sheet: "Learn a chapter" opens /learn (v2 when the flag is on, the v1 hub when off); Progress and the old recall link open /learn,
  // which redirects ?recall=due to Revise; Today's Revise tile and its alternatives open /review/revise; the Result's "The line you needed"
  // shows the NCERT line and Add to Revise, with no link into either world.
  assert.match(read('src/components/start/startModel.mjs'), /href: chosen \? `\$\{LEARN_HREF\}\?subject=\$\{chosen\}` : LEARN_HREF/);
  assert.match(read('src/components/study/StudyProgress.jsx'), /'\/learn\?recall=due'/);
  assert.match(read(`${APP}/learn/page.jsx`), /redirect\('\/review\/revise\?source=cards'\)/);
  assert.doesNotMatch(read('src/components/keycards/LineYouNeeded.jsx'), /href=|<Link|router\./, 'the line you needed links nowhere');
  const sources = ['src/components/today/TodayQueue.jsx', 'src/components/today/useToday.js', 'src/components/revise/ReviseRun.jsx', 'src/components/revise/reviseQueue.js',
    'src/components/start/startModel.mjs', 'src/components/study/StudyProgress.jsx', 'src/components/study/StudyLibrary.jsx', `${APP}/result/[id]/ResultPageClient.jsx`, 'src/lib/arenaNavigation.js'];
  for (const rel of sources) assert.doesNotMatch(read(rel), /['"`]\/cards[/?'"`]/, `${rel} has no /cards link`);
});

test('R9: the Explore question meta says the chapter title with the flag on, the syllabus name otherwise', () => {
  const card = read('src/components/feed/QuestionCard.jsx');
  assert.match(card, /actions = null, chapterTitle = null(, closed = false)? \}\)/, 'an optional prop, null by default');
  assert.match(card, /<span>\{chapterTitle \|\| q\.chapter \|\| 'Practice question'\}<\/span>/, "falls back to the row's own chapter, then the old words");
  const feed = read('src/components/feed/DiscoveryFeed.jsx');
  assert.match(feed, /if \(!v2 \|\| !question\?\.chapter\) return null;/, 'no title unless v2');
  assert.equal((feed.match(/chapterTitle=\{titleOf\(question\)\}/g) || []).length, 1, 'only the v2 list passes it');
  assert.equal((feed.match(/<QuestionCard /g) || []).length, 2, 'the v1 list is untouched');
  assert.doesNotMatch(feed.split('\n').filter((l) => /<QuestionCard /.test(l) && !/chapterTitle/.test(l)).join('\n'), /chapterTitle/);
});

test('R9 titles: the syllabus table gives the chapter title the covers print', async () => {
  const s = await import(pathToFileURL(path.join(root, 'data/cuet_syllabus.js')).href);
  const hit = s.resolveChapter('accountancy', 'Partnership Fundamentals');
  assert.equal(hit.retired, false);
  assert.equal(hit.title, 'Accounting for Partnership: Basic Concepts');
});

test("E6: the preview's first-time student (student=new) has nothing to revise", () => {
  const concepts = read('src/app/preview/arena/previewConcepts.js');
  assert.match(concepts, /: fixture\.get\('student'\) === 'new' \? 'empty' : 'student';/, 'the Review badge reads the empty record');
  const arena = read('src/app/preview/arena/ArenaPreviewClient.jsx');
  assert.match(arena, /fixture\.get\('revise'\) \|\| \(fixture\.get\('student'\) === 'new' \? 'empty' : 'ready'\)/, 'the dock and Today read an empty Revise');
  assert.match(read('src/app/preview/arena/previewReview.js'), /q\.get\('student'\) === 'new' \? 'empty' : 'student1018'/, 'Review itself reads no papers');
});
