// Learn v2 pages (BUILD-1101 packet P): the production routes exist and answer 404 while NEXT_PUBLIC_LEARN2 is off, the lessons keep
// their routes, the two players are focus routes (no shell, no page transition), and every Learn link gives the right href on the
// real site and in the development preview. Static checks over the sources, plus the pure helpers imported as they are.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const read = (rel) => readFileSync(path.join(root, rel), 'utf8');
const APP = 'src/app/(app)';

const PAGES = Object.freeze({
  '/learn': `${APP}/learn/page.jsx`,
  '/learn/find': `${APP}/learn/find/page.jsx`,
  '/learn/c/[chapterKey]': `${APP}/learn/c/[chapterKey]/page.jsx`,
  '/learn/c/[chapterKey]/cards': `${APP}/learn/c/[chapterKey]/cards/page.jsx`,
  '/learn/run': `${APP}/learn/run/page.jsx`,
  '/explore/run': `${APP}/explore/run/page.jsx`,
});
const NEW_PAGES = Object.entries(PAGES).filter(([route]) => route !== '/learn');

test('every Learn v2 route has a page, and the lessons and the summary keep theirs', () => {
  for (const [route, file] of Object.entries(PAGES)) assert.ok(existsSync(path.join(root, file)), `${route} -> ${file}`);
  assert.ok(existsSync(path.join(root, `${APP}/learn/[id]/page.jsx`)), 'a lesson stays at /learn/[id]');
  assert.ok(existsSync(path.join(root, `${APP}/learn/summary/page.jsx`)), '/learn/summary stays');
  assert.ok(existsSync(path.join(root, `${APP}/explore/page.js`)), '/explore stays');
  assert.match(read(`${APP}/learn/[id]/page.jsx`), /StudyWorkspace unitId=/);
});

test('the new routes are thin server pages: params and searchParams awaited, the flag checked, notFound while it is off', () => {
  for (const [route, file] of NEW_PAGES) {
    const src = read(file);
    assert.doesNotMatch(src, /^['"]use client['"]/m, `${route} is a server page`);
    assert.match(src, /export default async function/, `${route} reads its Promises`);
    assert.match(src, /await (searchParams|params)|await Promise\.all\(\[params, searchParams\]\)/, `${route} awaits params or searchParams`);
    assert.match(src, /from 'next\/navigation'/, `${route} imports notFound`);
    assert.match(src, /learn2On\(\)/, `${route} reads the flag`);
    assert.match(src, /notFound\(\)/, `${route} answers 404`);
    assert.match(src, /if \(!learn2On\(\)(?: \|\| [^)]+)?\) notFound\(\)/, `${route} stops before it renders when the flag is off`);
  }
});

test('the flag is NEXT_PUBLIC_LEARN2 exactly "on", read in one place', () => {
  const src = read(`${APP}/learn/params.js`);
  assert.match(src, /process\.env\.NEXT_PUBLIC_LEARN2 === 'on'/);
  for (const [, file] of Object.entries(PAGES)) assert.doesNotMatch(read(file), /process\.env/, `${file} uses the helper`);
});

test('/learn: Learn v2 on draws LearnHome (subject, Find first with ?find=1); off it is the old page with its recall redirect', () => {
  const src = read(PAGES['/learn']);
  assert.match(src, /import LearnHome from '@\/components\/learn2\/home\/LearnHome'/);
  assert.match(src, /import StudyWorkspace from '@\/components\/study\/StudyWorkspace'/);
  assert.match(src, /params\.recall === 'due'\) redirect\('\/review\/revise\?source=cards'\)/);
  assert.match(src, /if \(learn2On\(\)\) \{[\s\S]*?<LearnHome[\s\S]*?initialView=\{find \? 'find' : 'chapters'\}[\s\S]*?\}\s*return <Suspense fallback=\{<p>Loading Concepts…<\/p>\}><StudyWorkspace subject=/);
  assert.match(src, /one\(params\.find\) === '1'/);
});

test('each page renders the existing learn2 component with the props the spec lists, runId and end included', () => {
  const chapter = read(PAGES['/learn/c/[chapterKey]']);
  assert.match(chapter, /import LearnChapterPage from '@\/components\/learn2\/chapter\/ChapterPage'/);
  assert.match(chapter, /chapterKey=\{chapterKey\} minutes=\{minutesOf\(query\.min\)\}/);
  const cards = read(PAGES['/learn/c/[chapterKey]/cards']);
  assert.match(cards, /import LearnCardsView from '@\/components\/learn2\/cards\/CardsView'/);
  assert.match(cards, /filter=\{one\(query\.f\) \|\| 'all'\}/);
  const run = read(PAGES['/learn/run']);
  assert.match(run, /import LearnRunPlayer from '@\/components\/learn2\/run\/RunPlayer'/);
  for (const prop of ['chapterKey=', 'minutes=', 'kind=', 'leaveOut=', 'cardIds=', 'runId=', 'end=']) assert.ok(run.includes(prop), `run passes ${prop}`);
  for (const param of ['q.chapter', 'q.min', 'q.kind', 'q.out', 'q.cards', 'q.run', 'q.end']) assert.ok(run.includes(param), `run reads ${param}`);
  const feed = read(PAGES['/explore/run']);
  assert.match(feed, /import LearnChapterFeed from '@\/components\/learn2\/feed\/ChapterFeed'/);
  for (const prop of ['chapterKey=', 'minutes=', 'runId=', 'end=']) assert.ok(feed.includes(prop), `feed passes ${prop}`);
});

test('the static segments (c, run, find, summary) shadow no lesson id', async () => {
  // Read as text: the English module needs a WordNet dictionary that is not in a checkout, and only the ids matter here.
  const dir = path.join(root, 'data/study/authored');
  const ids = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.mjs'))) {
    for (const m of readFileSync(path.join(dir, file), 'utf8').matchAll(/conceptId: '[^']+', id: '([^']+)'/g)) ids.push(m[1]);
  }
  assert.ok(ids.length >= 4, `read the lesson ids (${ids.length})`);
  for (const id of ids) assert.ok(!['c', 'run', 'find', 'summary'].includes(id), `lesson id ${id}`);
  assert.ok(ids.every((id) => /^[a-z]+(-[a-z0-9]+)+$/.test(id)), 'every lesson id is subject-word-word, never one short word');
});

test('the helpers: chapter keys, run ids, minutes and lists', async () => {
  const h = await import(pathToFileURL(path.join(root, `${APP}/learn/params.js`)).href);
  assert.equal(h.chapterKeyOf('accountancy.partnership-fundamentals'), 'accountancy.partnership-fundamentals');
  assert.equal(h.chapterKeyOf('business_studies.nature-and-significance-of-management'), 'business_studies.nature-and-significance-of-management');
  assert.equal(h.chapterKeyOf('economics.chapter%2D1'), 'economics.chapter-1', 'a still-encoded key is read once');
  for (const bad of ['', 'accountancy', 'a b.c', '<script>.x', undefined, null]) assert.equal(h.chapterKeyOf(bad), '', String(bad));
  assert.equal(h.chapterKeyOf('../etc/passwd'), '');
  assert.equal(h.chapterKeyOf('accountancy.%E0%A4%A'), '');
  assert.equal(h.runIdOf('lr_0123456789abcdef01234567'), 'lr_0123456789abcdef01234567');
  assert.equal(h.runIdOf('x'), '');
  assert.equal(h.runIdOf('a/b'), '');
  assert.equal(h.minutesOf('10'), 10);
  assert.equal(h.minutesOf('0', 7), 7);
  assert.equal(h.minutesOf('1.5', 7), 7);
  assert.equal(h.minutesOf('999', 7), 7);
  assert.equal(h.minutesOf(['20', '5']), 20, 'the first value of a repeated param');
  assert.deepEqual(h.list('a, b,,c'), ['a', 'b', 'c']);
  assert.deepEqual(h.list(undefined), []);
  assert.equal(h.list(Array.from({ length: 500 }, (_, i) => i).join(',')).length, 200, 'capped');
  const saved = process.env.NEXT_PUBLIC_LEARN2;
  try {
    delete process.env.NEXT_PUBLIC_LEARN2; assert.equal(h.learn2On(), false);
    process.env.NEXT_PUBLIC_LEARN2 = 'off'; assert.equal(h.learn2On(), false);
    process.env.NEXT_PUBLIC_LEARN2 = 'true'; assert.equal(h.learn2On(), false, 'only "on"');
    process.env.NEXT_PUBLIC_LEARN2 = 'on'; assert.equal(h.learn2On(), true);
  } finally { if (saved === undefined) delete process.env.NEXT_PUBLIC_LEARN2; else process.env.NEXT_PUBLIC_LEARN2 = saved; }
});

test('focus routes: /learn/run and /explore/run are listed, draw no shell, and never get a page transition', async () => {
  const pt = await import(pathToFileURL(path.join(root, 'src/lib/motion/placeTransition.js')).href);
  assert.deepEqual([...pt.FOCUS_PATHS], ['/learn/run', '/explore/run']);
  assert.equal(pt.isFocusPath('/learn/run?run=lr_1&end=1'), true);
  assert.equal(pt.isFocusPath('https://mockmob.in/explore/run/'), true);
  assert.equal(pt.isFocusPath('/learn/c/accountancy.x'), false);
  assert.equal(pt.isFocusPath('/explore'), false);
  for (const [a, b] of [['/explore', '/explore/run'], ['/explore/run', '/explore'], ['/learn/c/x.y', '/learn/run'], ['/learn/run', '/learn/c/x.y'], ['/learn/run', '/learn/run?run=lr_1&end=1'], ['/today', '/explore/run'], ['/explore/run', '/result/abc']]) {
    assert.deepEqual(pt.transitionTypesFor(a, b), [], `${a} to ${b}`);
  }
  assert.deepEqual(pt.transitionTypesFor('/today', '/dashboard'), [pt.VT.placeFwd], 'ordinary pages keep their transition');
  assert.notDeepEqual(pt.transitionTypesFor('/learn', '/learn/c/x.y'), [], 'a chapter still pushes');
  // The preview draws the same: its views map to the routes they stand for.
  assert.equal(pt.logicalPath('/preview/arena?view=learn2-run&chapter=a.b'), '/learn/run');
  assert.equal(pt.logicalPath('/preview/arena?view=learn2-feed&chapter=a.b'), '/explore/run');
  assert.deepEqual(pt.navigationTypesFor('/preview/arena?view=explore', '/preview/arena?view=learn2-feed&chapter=a.b&min=10'), []);
  assert.deepEqual(pt.navigationTypesFor('/preview/arena?view=learn2-feed&chapter=a.b', '/preview/arena?view=explore'), []);
  assert.deepEqual(pt.navigationTypesFor('/preview/arena?view=learn2-chapter&chapter=a.b', '/preview/arena?view=learn2-run&chapter=a.b'), []);
  // The shell: the focus branch returns the page alone, before any navigation is built.
  const shell = read(`${APP}/AppLayoutClient.jsx`);
  assert.match(shell, /import \{ VIEW_TRANSITION_PROPS, isFocusPath \} from '@\/lib\/motion\/placeTransition'/);
  assert.match(shell, /const isFocusRoute = isFocusPath\(activePath\)/);
  const focus = shell.indexOf('if (isFocusRoute) {');
  assert.ok(focus > 0, 'a focus branch');
  assert.ok(focus < shell.indexOf('const navGroups = arenaNavigation('), 'it returns before the navigation is built');
  const branch = shell.slice(focus, shell.indexOf('const showStudy=', focus));
  assert.doesNotMatch(branch, /arena-sidebar|arena-topbar|arena-dock|StartKey|AskMobiHost|PageTransition/);
  assert.match(branch, /\{children\}/);
  // The Learn row and the navigation are untouched: Learn stays a row under Practice.
  const nav = read('src/lib/arenaNavigation.js');
  assert.match(nav, /const LEARN = item\('learn', 'Learn', 'learn', '\/learn', 'Key cards'\)/);
  assert.match(nav, /\[PRACTICE, LEARN, PAPERS, EXPLORE, SAVED\]/);
});

// links.js is a client module that imports next/navigation; run it with those two hooks stubbed.
async function loadLinks() {
  const src = read('src/components/learn2/links.js')
    .replace(/^"use client";?$/m, '')
    .replace(/^import \{ useCallback \} from 'react';$/m, 'const useCallback = (fn) => fn;')
    .replace(/^import \{ usePathname, useSearchParams \} from 'next\/navigation';$/m, 'const usePathname = () => globalThis.__learnPath; const useSearchParams = () => new URLSearchParams(globalThis.__learnSearch || "");');
  assert.doesNotMatch(src, /^import /m, 'every import is stubbed');
  const mod = await import(`data:text/javascript;base64,${Buffer.from(src).toString('base64')}`);
  return (pathname, search = '') => { globalThis.__learnPath = pathname; globalThis.__learnSearch = search; return mod.useLearnLinks(); };
}

test('links on the real site: every Learn and feed link is a production href', async () => {
  const use = await loadLinks();
  const l = use('/learn');
  assert.equal(l.preview, false);
  assert.equal(l.home(), '/learn');
  assert.equal(l.home('economics'), '/learn?subject=economics');
  assert.equal(l.find(), '/learn/find');
  assert.equal(l.find('accountancy', 'goodwill'), '/learn/find?subject=accountancy&q=goodwill');
  assert.equal(l.chapter('accountancy.admission-of-partner'), '/learn/c/accountancy.admission-of-partner');
  assert.equal(l.chapter('accountancy.admission-of-partner', 20), '/learn/c/accountancy.admission-of-partner?min=20');
  assert.equal(l.cards('accountancy.admission-of-partner'), '/learn/c/accountancy.admission-of-partner/cards');
  assert.equal(l.cards('accountancy.admission-of-partner', 'due'), '/learn/c/accountancy.admission-of-partner/cards?f=due');
  assert.equal(l.run({ chapterKey: 'accountancy.admission-of-partner' }), '/learn/run?chapter=accountancy.admission-of-partner&min=10&kind=mix');
  assert.equal(l.run({ chapterKey: 'a.b', minutes: 5, kind: 'recap', leaveOut: ['lesson', 'mistakes'] }), '/learn/run?chapter=a.b&min=5&kind=recap&out=lesson%2Cmistakes');
  assert.equal(l.run({ chapterKey: 'a.b', kind: 'cards', cardIds: ['c1', 'c2'] }), '/learn/run?chapter=a.b&min=10&kind=cards&cards=c1%2Cc2');
  assert.equal(l.run({ runId: 'lr_abc123', end: true }), '/learn/run?min=10&kind=mix&run=lr_abc123&end=1');
  assert.equal(l.feed('accountancy.admission-of-partner', 10), '/explore/run?chapter=accountancy.admission-of-partner&min=10', 'Play on a cover');
  assert.equal(l.feed('a.b'), '/explore/run?chapter=a.b&min=10');
  assert.equal(l.feed('a.b', 5, { runId: 'lr_abc123' }), '/explore/run?chapter=a.b&min=5&run=lr_abc123');
  assert.equal(l.explore(), '/explore');
  assert.equal(l.lesson('accountancy-revaluation'), '/learn/accountancy-revaluation');
  assert.equal(l.revise(), '/review/revise');
  // A href the service wrote stays as it is on the real site.
  assert.equal(l.resolve('/learn/run?run=lr_1&end=1'), '/learn/run?run=lr_1&end=1');
  assert.equal(l.resolve('/explore/run?run=lr_1&end=1'), '/explore/run?run=lr_1&end=1');
});

test('links in the preview: the same links stay in the preview with their fixture flags', async () => {
  const use = await loadLinks();
  const l = use('/preview/arena', 'view=learn2&plan=pro&data=ready&nav=n1&junk=1');
  assert.equal(l.preview, true);
  const parse = (href) => { const u = new URL(href, 'http://x'); assert.equal(u.pathname, '/preview/arena', href); return u.searchParams; };
  for (const href of [l.home(), l.find('economics'), l.chapter('a.b'), l.cards('a.b'), l.run({ chapterKey: 'a.b' }), l.feed('a.b'), l.explore(), l.lesson('x-y'), l.revise()]) {
    const p = parse(href);
    assert.equal(p.get('plan'), 'pro', href);
    assert.equal(p.get('nav'), 'n1', href);
    assert.equal(p.get('junk'), null, `${href} keeps only the fixture flags`);
  }
  assert.equal(parse(l.home('economics')).get('view'), 'learn2');
  assert.equal(parse(l.home('economics')).get('subject'), 'economics');
  assert.equal(parse(l.find('economics', 'ioc')).get('lv'), 'find');
  assert.equal(parse(l.chapter('a.b', 20)).get('view'), 'learn2-chapter');
  assert.equal(parse(l.chapter('a.b', 20)).get('min'), '20');
  assert.equal(parse(l.cards('a.b', 'due')).get('view'), 'learn2-cards');
  const run = parse(l.run({ chapterKey: 'a.b', minutes: 5, kind: 'recap', leaveOut: ['lesson'] }));
  assert.deepEqual([run.get('view'), run.get('chapter'), run.get('min'), run.get('kind'), run.get('out')], ['learn2-run', 'a.b', '5', 'recap', 'lesson']);
  const ended = parse(l.run({ runId: 'lr_1', end: true }));
  assert.deepEqual([ended.get('view'), ended.get('run'), ended.get('end')], ['learn2-run', 'lr_1', '1']);
  const feed = parse(l.feed('a.b', 10));
  assert.deepEqual([feed.get('view'), feed.get('chapter'), feed.get('min'), feed.get('run'), feed.get('end')], ['learn2-feed', 'a.b', '10', null, null]);
  const feedEnd = parse(l.feed('a.b', 10, { runId: 'lr_2', end: true }));
  assert.deepEqual([feedEnd.get('run'), feedEnd.get('end')], ['lr_2', '1']);
  assert.equal(parse(l.explore()).get('view'), 'explore');
  assert.equal(parse(l.revise()).get('view'), 'revise');
  // The service's endHref is drawn as the preview's own view.
  const r1 = parse(l.resolve('/learn/run?run=lr_9&end=1'));
  assert.deepEqual([r1.get('view'), r1.get('run'), r1.get('end')], ['learn2-run', 'lr_9', '1']);
  const r2 = parse(l.resolve('/explore/run?run=lr_9&end=1'));
  assert.deepEqual([r2.get('view'), r2.get('run'), r2.get('end')], ['learn2-feed', 'lr_9', '1']);
  assert.equal(parse(l.resolve('/learn/c/a.b/cards?f=due')).get('view'), 'learn2-cards');
  assert.equal(parse(l.resolve('/learn/c/a.b?min=20')).get('view'), 'learn2-chapter');
  assert.equal(parse(l.resolve('/learn/find?subject=economics&q=ioc')).get('lv'), 'find');
  assert.equal(l.resolve('/preview/arena?view=today'), '/preview/arena?view=today');
});

test('the service writes end hrefs that these routes answer, and every production href has a page', () => {
  const service = read('src/lib/server/learn.js');
  assert.match(service, /row\.kind === 'feed' \? '\/explore\/run' : '\/learn\/run'/);
  assert.match(service, /new URLSearchParams\(\{ run: row\.id, end: '1' \}\)/);
  assert.match(read(PAGES['/learn/run']), /q\.run/);
  assert.match(read(PAGES['/learn/run']), /one\(q\.end\) === '1'/);
  assert.match(read(PAGES['/explore/run']), /one\(q\.end\) === '1'/);
  // Every path links.js builds names a page.
  const links = read('src/components/learn2/links.js');
  for (const route of ['/learn/run', '/explore/run', '/learn/find']) assert.ok(links.includes(`'${route}'`), `links.js builds ${route}`);
  assert.ok(links.includes('/learn/c/${enc(key)}/cards') && links.includes('/learn/c/${enc(key)}'), 'chapter and cards paths');
  for (const route of ['/learn/run', '/explore/run', '/learn/find', '/learn/c/[chapterKey]', '/learn/c/[chapterKey]/cards']) assert.ok(PAGES[route], route);
});

test('the preview: learn2-run and learn2-feed take run and end, every view stays listed, and Learn and Explore link to their own pages', () => {
  const src = read('src/app/preview/arena/ArenaPreviewClient.jsx');
  for (const view of ['summary', 'dashboard', 'test', 'explore', 'learn2', 'learn2-chapter', 'learn2-run', 'learn2-cards', 'learn2-feed', 'cards', 'deck', 'revise']) assert.ok(src.includes(`'${view}'`), `view ${view} stays`);
  const run = src.slice(src.indexOf("view === 'learn2-run' ?"), src.indexOf("view === 'learn2-cards' ?"));
  assert.match(run, /runId=\{params\.get\('run'\) \|\| null\}/);
  assert.match(run, /end=\{params\.get\('end'\) === '1'\}/);
  const feed = src.slice(src.indexOf("view === 'learn2-feed' ?"), src.indexOf("view === 'cards' ?"));
  assert.match(feed, /runId=\{params\.get\('run'\) \|\| null\}/);
  assert.match(feed, /end=\{params\.get\('end'\) === '1'\}/);
  assert.match(src, /'learn2-run': 'learn\/run'/);
  assert.match(src, /'learn2-feed': 'explore\/run'/);
  assert.match(src, /learn: previewHref\('learn2'\), explore: previewHref\('explore'\)/);
});
