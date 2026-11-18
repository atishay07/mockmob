// Search (lane palette, 18 Nov 2026): ranking, synonyms, typos, the open rules, the static index, and source pins for the
// ways in (the rail's Search key, the You page and the Start sheet) and the Practice link a chapter opens.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  GROUP_LIMIT, TOTAL_LIMIT, flatRows, fold, matchItem, moveActive, nothingLine, prepare, queryWords, searchBlockedOn,
  searchKeyAction, searchResults, titleParts, typesText, typoCovers,
} from './searchModel.mjs';
import {
  EMPTY_GOTO, PAGE_SYNONYMS, chapterItems, collegeItems, emptyStartIds, pageItems, previewHref, runMode, startItems,
} from './searchSources.mjs';
import { CHAPTERS } from '../../../data/cuet_syllabus.js';
import { buildSearchIndex, deckChapters, serialise, SEARCH_INDEX_FILE } from '../../../scripts/search/build-search-index.mjs';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { collegePath } from '../du/cutoffPages.mjs';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
const INDEX = JSON.parse(readFileSync(SEARCH_INDEX_FILE, 'utf8'));

// The shell's own lists, as arenaNavigation() draws them with the Mob and Learn on (labels, ids, icons and hrefs as there).
const T = (id, label, extra = {}) => ({ id, label, icon: id, href: `/${id}`, ...extra });
const NAV = [
  { label: 'Today', place: true, items: [T('today', 'Today', { place: true })] },
  { label: 'Practice', place: true, items: [T('dashboard', 'Practice', { place: true }), T('review', 'Your papers'), T('learn', 'Learn'), T('explore', 'Explore'), T('saved', 'Saved')] },
  { label: 'Mob', place: true, items: [T('mob', 'Mob', { place: true, title: 'Your Mob' }), T('leaderboard', 'Your standing')] },
  { label: 'You', place: true, items: [T('profile', 'You', { place: true, title: 'Your account' }), T('progress', 'Progress'), T('analytics', 'Marks trend'), T('admission-compass', 'Colleges'), T('wallet', 'Wallet'), T('help', 'Guide')] },
];
const SUBJECTS = ['accountancy', 'economics', 'business_studies', 'english'];
const sources = ({ subjects = SUBJECTS, learn2 = true } = {}) => ({
  goto: pageItems(NAV).map(prepare),
  start: startItems(subjects).map(prepare),
  chapters: chapterItems(CHAPTERS, { userSubjects: subjects, decks: new Set(INDEX.decks), learn2 }).map(prepare),
  colleges: collegeItems(INDEX).map(prepare),
});
const S = sources();
const run = (q, src = S) => searchResults(q, src, { empty: { goto: EMPTY_GOTO, start: emptyStartIds(SUBJECTS) } });
const titles = (results, group) => (results.find((g) => g.id === group)?.rows || []).map((r) => r.title);

test('fold: case and accent blind, "&" as "and", apostrophes and dots joined, a map back to the original', () => {
  assert.equal(fold('  Café & Crème  ').text, 'cafe and creme');
  assert.equal(fold("St. Stephen's College").text, 'st stephens college');
  assert.equal(fold('B.Com. (Hons.)').text, 'bcom hons');
  const f = fold('Goodwill: Nature');
  assert.equal(f.text, 'goodwill nature');
  assert.equal(f.map[f.text.indexOf('nature')], 'Goodwill: Nature'.indexOf('Nature'));
  assert.deepEqual(queryWords('  GOODWILL   nature '), ['goodwill', 'nature']);
  assert.deepEqual(queryWords('?!'), []);
});

test('a match at the title start beats a word start, which beats inside a word; ties keep the list order', () => {
  const items = ['Partnership fundamentals', 'Admission of a partner', 'Counterpartners'].map((title, i) => prepare({ id: String(i), title }));
  const start = matchItem(items[0], ['partn']);
  const word = matchItem(items[1], ['partn']);
  const inside = matchItem(items[2], ['partn']);
  assert.ok(start.score > word.score && word.score > inside.score);
  const r = searchResults('partn', { goto: [items[2], items[1], items[0]] });
  assert.deepEqual(r[0].rows.map((x) => x.title), ['Partnership fundamentals', 'Admission of a partner', 'Counterpartners']);
  const tie = searchResults('a', { goto: ['Alpha one', 'Alpha two', 'Alpha three'].map((title, i) => prepare({ id: String(i), title })) });
  assert.deepEqual(tie[0].rows.map((x) => x.title), ['Alpha one', 'Alpha two', 'Alpha three']);
});

test('every query word must match, in any order', () => {
  const item = prepare({ id: 'x', title: 'Goodwill: Nature and Valuation' });
  assert.ok(matchItem(item, ['valuation', 'goodwill']));
  assert.equal(matchItem(item, ['goodwill', 'partner']), null);
  assert.equal(matchItem(item, []), null);
});

test('matched letters come back as ranges in the original title, for bold drawing', () => {
  const item = prepare({ id: 'x', title: 'Goodwill: Nature and Valuation' });
  const m = matchItem(item, ['good', 'val']);
  assert.deepEqual(titleParts(item.title, m.ranges), [
    { text: 'Good', hit: true }, { text: 'will: Nature and ', hit: false }, { text: 'Val', hit: true }, { text: 'uation', hit: false },
  ]);
  const accents = prepare({ id: 'y', title: 'Café society' });
  assert.deepEqual(titleParts(accents.title, matchItem(accents, ['cafe']).ranges)[0], { text: 'Café', hit: true });
});

test('typos: one missing or one swapped letter, only for words of five letters or more', () => {
  assert.equal(typoCovers('godwill', 'goodwill'), 8);
  assert.equal(typoCovers('goodwlil', 'goodwill'), 8);
  assert.equal(typoCovers('parnter', 'partnership'), 7);
  assert.equal(typoCovers('godw', 'goodwill'), 0, 'four letters: no forgiveness');
  assert.equal(typoCovers('gdwll', 'goodwill'), 0, 'two letters missing is too far');
  assert.ok(titles(run('godwill'), 'chapters').some((t) => /Goodwill/.test(t)));
  assert.ok(titles(run('hidnu'), 'colleges').includes('Hindu College'));
  assert.deepEqual(run('hnd'), [], 'a short typo finds nothing rather than noise');
});

test('synonyms: plain words find the pages the brief names', () => {
  const pagesFor = (q) => titles(run(q), 'goto');
  assert.deepEqual(pagesFor('marks').slice(0, 2), ['Marks trend', 'Your papers']);
  assert.ok(pagesFor('score').includes('Your papers') && pagesFor('analysis').includes('Marks trend'));
  assert.ok(pagesFor('flashcards').includes('Key cards'));
  assert.ok(pagesFor('friends').includes('Mob') && pagesFor('group').includes('Mob'));
  for (const q of ['cutoff', 'du', 'college']) assert.ok(pagesFor(q).includes('Colleges'), q);
  for (const q of ['credits', 'pro', 'pay']) assert.ok(pagesFor(q).includes('Wallet'), q);
  for (const q of ['help', 'support']) assert.ok(pagesFor(q).includes('Guide'), q);
  for (const q of ['mistakes', 'repair']) assert.ok(pagesFor(q).includes('Your papers'), q);
  for (const q of ['rank', 'leaderboard']) assert.ok(pagesFor(q).includes('Your standing'), q);
  for (const q of ['ai', 'doubt', 'mobi']) assert.ok(titles(run(q), 'start').includes('Ask Mobi'), q);
  assert.ok(!pagesFor('progress').includes('Wallet'), '"pro" finds Wallet, but "progress" is Progress');
  assert.deepEqual(Object.keys(PAGE_SYNONYMS).sort(), ['admission-compass', 'analytics', 'cards', 'help', 'leaderboard', 'mob', 'profile', 'review', 'wallet']);
});

test('pages come from the shell lists by their sidebar names, in nav order, with the extra pages', () => {
  const pages = pageItems(NAV);
  assert.deepEqual(pages.map((p) => p.title), ['Today', 'Practice', 'Your papers', 'Learn', 'Explore', 'Saved', 'Mob', 'Your standing', 'Your account', 'Progress', 'Marks trend', 'Colleges', 'Wallet', 'Guide', 'Key cards', 'Revise']);
  assert.equal(pages.find((p) => p.id === 'review').hint, 'Practice');
  assert.equal(pages.find((p) => p.id === 'today').hint, '', 'a place names no group');
  assert.ok(!pageItems(NAV, { learn: false }).some((p) => p.id === 'learn'));
  assert.ok(!pages.some((p) => p.id === 'mentor'), 'Ask Mobi lives in Start, once');
});

test('the empty query: Go to shows the six most used pages, Start the actions', () => {
  const r = run('');
  assert.deepEqual(r.map((g) => g.label), ['Go to', 'Start']);
  assert.deepEqual(titles(r, 'goto'), ['Today', 'Practice', 'Your papers', 'Learn', 'Key cards', 'Marks trend']);
  assert.deepEqual(titles(r, 'start'), ['Start 10 questions in Accountancy', 'Start a full mock', 'Revise what is due', 'Play today’s five', 'Ask Mobi']);
});

test('Start: one 10-question start per subject of the student, then the existing routes', () => {
  const items = startItems(['economics', 'general_test']);
  assert.deepEqual(items.map((i) => i.title), ['Start 10 questions in Economics', 'Start 10 questions in General Test', 'Start a full mock', 'Revise what is due', 'Ask Mobi', 'Play today’s five']);
  assert.equal(items[0].href, '/dashboard?subject=economics&mode=quick&count=10');
  assert.equal(items.find((i) => i.id === 'full').href, '/dashboard?mode=full');
  assert.equal(items.find((i) => i.id === 'revise').href, '/review/revise');
  assert.equal(items.find((i) => i.id === 'daily').href, '/daily');
  assert.ok(existsRoute('src/app/(app)/review/revise/page.jsx') && existsRoute('src/app/daily/page.js') && existsRoute('src/app/(app)/mentor/page.js'));
});

function existsRoute(rel) { try { readFileSync(join(ROOT, rel)); return true; } catch { return false; } }

test('chapters: "good" finds Goodwill in Accountancy, Enter practises 10 on it through Practice\'s own link', () => {
  const r = run('good');
  const rows = r.find((g) => g.id === 'chapters').rows;
  assert.match(rows[0].title, /^Goodwill/);
  assert.equal(rows[0].hint, 'Accountancy');
  assert.equal(rows[0].enter, 'Practise 10');
  const chapter = CHAPTERS.find((c) => c.key === rows[0].key);
  const url = new URL(rows[0].href, 'http://x');
  assert.equal(url.pathname, '/dashboard');
  assert.equal(url.searchParams.get('subject'), 'accountancy');
  assert.equal(url.searchParams.get('chapter'), chapter.name);
  assert.equal(url.searchParams.get('mode'), 'quick');
  assert.equal(url.searchParams.get('count'), '10');
  // Practice reads exactly these (DashboardPageClient: ?subject= picks the subject, ?chapter= preselects the chapter in Quick practice).
  const practice = read('src/app/(app)/dashboard/DashboardPageClient.jsx');
  assert.match(practice, /searchParams\.get\('subject'\) === selSubj\s*\n?\s*\? \[\.\.\.\(searchParams\.get\('chapters'\) \|\| ''\)\.split\(','\), searchParams\.get\('chapter'\) \|\| ''\]/);
  assert.match(practice, /mySubs\.some\(subject => subject\.id === linkedSubject\) \? linkedSubject/);
});

test('chapters: the student\'s own subjects first, others after with their subject named; Key cards and Learn only with a deck', () => {
  const own = chapterItems(CHAPTERS, { userSubjects: ['economics'], decks: new Set(INDEX.decks), learn2: true });
  const firstOther = own.findIndex((c) => c.rank === 1);
  assert.ok(firstOther > 0 && own.slice(0, firstOther).every((c) => c.subject === 'economics'));
  const r = searchResults('partn', { chapters: own.map(prepare) });
  assert.ok(r[0].rows.some((row) => row.hint === 'Accountancy'), 'other subjects are found too');
  const withDeck = own.find((c) => INDEX.decks.includes(c.key));
  assert.equal(withDeck.cardsHref, `/learn/c/${withDeck.key}/cards`);
  assert.equal(withDeck.learnHref, `/learn/c/${withDeck.key}`);
  const noDeck = own.find((c) => !INDEX.decks.includes(c.key));
  if (noDeck) assert.equal(noDeck.cardsHref, null);
  const v1 = chapterItems(CHAPTERS, { userSubjects: ['economics'], decks: new Set(INDEX.decks), learn2: false }).find((c) => c.key === withDeck.key);
  assert.equal(v1.cardsHref, `/cards/${withDeck.key}`);
  assert.equal(v1.learnHref, null, 'with Learn v2 off there is no chapter page to open');
});

test('chapters: "Practise 10" only for the student\'s own subjects; another subject\'s chapter says Open (review, 18 Nov)', () => {
  const items = chapterItems(CHAPTERS, { userSubjects: ['economics'], decks: new Set(INDEX.decks), learn2: true });
  const mine = items.find((c) => c.subject === 'economics');
  const other = items.find((c) => c.subject === 'physics');
  assert.equal(mine.enter, 'Practise 10');
  assert.equal(other.enter, 'Open', 'Practice cannot set up a subject the student has not picked, so the row never promises a set');
  assert.equal(new URL(other.href, 'http://x').searchParams.get('subject'), 'physics', 'it still opens Practice, whose note names the way: Edit subjects');
  // Practice keeps a linked subject only when it is one of the student's (and otherwise says so): the reason for Open.
  const practice = read('src/app/(app)/dashboard/DashboardPageClient.jsx');
  assert.match(practice, /mySubs\.some\(subject => subject\.id === linkedSubject\) \? linkedSubject/);
  assert.match(practice, /linkedSubjectUnavailable=status==='ready' && linkedSubject && !mySubs\.some/);
});

test('running a row: this very address only closes; a course while Colleges is open loads it afresh; the rest navigate', () => {
  assert.equal(runMode({ kind: 'page', href: '/today', target: '/today', path: '/today', current: '/today' }), 'stay');
  assert.equal(runMode({ kind: 'page', href: '/wallet', target: '/wallet', path: '/today', current: '/today' }), 'push');
  assert.equal(runMode({ kind: 'course', href: '/admission-compass?course=b-com', target: '/admission-compass?course=b-com', path: '/admission-compass', current: '/admission-compass' }), 'reload');
  assert.equal(runMode({ kind: 'course', href: '/admission-compass?course=b-com', target: '/admission-compass?course=b-com', path: '/today', current: '/today' }), 'push');
  assert.equal(runMode({ kind: 'chapter', href: '/dashboard?subject=economics&chapter=Money', target: '/dashboard?subject=economics&chapter=Money', path: '/dashboard', current: '/dashboard' }), 'push', 'Practice reads its link whenever it changes');
  // The preview: the route is the shell's own (previewRoute), the address the preview's.
  assert.equal(runMode({ kind: 'course', href: '/admission-compass?course=b-com', target: '/preview/arena?view=compass&course=b-com', path: '/admission-compass', current: '/preview/arena?view=compass' }), 'reload');
  // Why: Colleges reads ?course= once, as it loads.
  assert.match(read('src/components/du/CutoffCalculator.jsx'), /\}, \[loadAttempt\]\);/);
  const palette = read('src/components/search/SearchPalette.jsx');
  assert.match(palette, /if \(mode === 'stay'\) \{ requestClose\(\); return; \}/, 'staying gives focus back to the opener');
  assert.match(palette, /if \(mode === 'reload'\) window\.location\.assign\(target\);/);
});

test('Key cards links follow the server\'s own deck rule: manifest sha256 and the card\'s own subject', () => {
  const dir = mkdtempSync(join(tmpdir(), 'srch-decks-'));
  try {
    mkdirSync(join(dir, 'decks'));
    const deck = (subject, cards) => JSON.stringify({ version: 1, cards });
    const good = deck('economics', [{ id: 'e1', subject: 'economics', chapterKey: 'economics.money-and-banking' }, { id: 'e2', subject: 'accountancy', chapterKey: 'economics.production-and-costs' }, { id: 'e3', subject: 'economics', chapterKey: 'economics.not-a-chapter' }]);
    const bad = deck('physics', [{ id: 'p1', subject: 'physics', chapterKey: 'physics.electric-charges-and-fields' }]);
    writeFileSync(join(dir, 'decks', 'economics.json'), good);
    writeFileSync(join(dir, 'decks', 'physics.json'), bad);
    const sha = (text) => createHash('sha256').update(text).digest('hex');
    writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ economics: { sha256: sha(good) }, physics: { sha256: sha('something else') }, history: { sha256: 'x' } }));
    const live = new Set(['economics.money-and-banking', 'economics.production-and-costs', 'physics.electric-charges-and-fields']);
    assert.deepEqual(deckChapters(dir, live), ['economics.money-and-banking'], 'a deck the manifest does not sign is off, as on the server; a card of another subject does not count');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('colleges and courses: "hindu" finds Hindu College with its course count; courses open Colleges on the course', () => {
  const r = run('hindu');
  const row = r.find((g) => g.id === 'colleges').rows[0];
  assert.equal(row.title, 'Hindu College');
  assert.match(row.hint, /^\d+ courses$/);
  assert.equal(row.href, collegePath('hindu-college'));
  assert.deepEqual(titles(run('bcom'), 'colleges').slice(0, 2), ['B.Com.', 'B.Com. (Hons.)']);
  assert.deepEqual(titles(run('b com'), 'colleges').slice(0, 2), ['B.Com.', 'B.Com. (Hons.)'], 'words typed apart still find B.Com. first');
  assert.deepEqual(titles(run('stephens'), 'colleges'), ['St. Stephen\'s College']);
  const course = collegeItems(INDEX).find((c) => c.kind === 'course');
  assert.match(course.href, /^\/admission-compass\?course=/);
  const calc = read('src/components/du/CutoffCalculator.jsx');
  assert.match(calc, /index\.groups\.find\(\(group\) => group\.id === params\.get\('course'\)\)/, 'Colleges opens the course in its link');
});

test('the best group for the query comes first; at most 5 a group and 14 in all', () => {
  assert.equal(run('marks')[0].id, 'goto');
  assert.equal(run('hindu')[0].id, 'colleges');
  assert.equal(run('partn')[0].id, 'chapters');
  const wide = run('a');
  assert.ok(wide.every((g) => g.rows.length <= GROUP_LIMIT));
  assert.ok(flatRows(wide).length <= TOTAL_LIMIT);
});

test('nothing matches: one line naming the query', () => {
  assert.deepEqual(run('zzqxj'), []);
  assert.equal(nothingLine(' zzqxj '), 'Nothing matches “zzqxj”. Try a chapter, a page or a college.');
});

test('arrow keys wrap', () => {
  assert.equal(moveActive(0, 1, 3), 1);
  assert.equal(moveActive(2, 1, 3), 0);
  assert.equal(moveActive(0, -1, 3), 2);
  assert.equal(moveActive(-1, 1, 3), 0);
  assert.equal(moveActive(-1, -1, 3), 2);
  assert.equal(moveActive(0, 1, 0), -1);
});

test('open rules: Ctrl+K or Cmd+K anywhere, "/" outside fields, never on the paper, onboarding or over another dialog', () => {
  const ctx = { path: '/today', dialogOpen: false, open: false, target: { tag: 'BODY' } };
  assert.equal(searchKeyAction({ key: 'k', ctrlKey: true }, ctx), 'open');
  assert.equal(searchKeyAction({ key: 'K', metaKey: true }, ctx), 'open');
  assert.equal(searchKeyAction({ key: 'k', ctrlKey: true }, { ...ctx, target: { tag: 'INPUT', type: 'text' } }), 'open');
  assert.equal(searchKeyAction({ key: '/' }, ctx), 'open');
  assert.equal(searchKeyAction({ key: '/' }, { ...ctx, target: { tag: 'INPUT', type: 'search' } }), null);
  assert.equal(searchKeyAction({ key: '/' }, { ...ctx, target: { tag: 'TEXTAREA' } }), null);
  assert.equal(searchKeyAction({ key: '/' }, { ...ctx, target: { tag: 'SELECT' } }), null);
  assert.equal(searchKeyAction({ key: '/' }, { ...ctx, target: { tag: 'DIV', editable: true } }), null);
  assert.equal(searchKeyAction({ key: '/' }, { ...ctx, target: { tag: 'INPUT', type: 'checkbox' } }), 'open');
  assert.equal(searchKeyAction({ key: 'k', ctrlKey: true }, { ...ctx, path: '/test' }), null);
  assert.equal(searchKeyAction({ key: '/' }, { ...ctx, path: '/test?subject=x' }), null);
  assert.equal(searchKeyAction({ key: 'k', ctrlKey: true }, { ...ctx, path: '/onboarding' }), null);
  assert.equal(searchKeyAction({ key: 'k', ctrlKey: true }, { ...ctx, path: '/mob/game/abc' }), null);
  assert.equal(searchKeyAction({ key: 'k', ctrlKey: true }, { ...ctx, dialogOpen: true }), null);
  assert.equal(searchKeyAction({ key: 'k', ctrlKey: true }, { ...ctx, open: true }), null);
  assert.equal(searchKeyAction({ key: 'k', ctrlKey: true, shiftKey: true }, ctx), null);
  assert.equal(searchKeyAction({ key: 'k', ctrlKey: true, altKey: true }, ctx), null);
  assert.equal(searchKeyAction({ key: '/', ctrlKey: true }, ctx), null);
  assert.equal(searchKeyAction({ key: 'k' }, ctx), null);
  assert.equal(searchKeyAction({ key: '/', repeat: true }, ctx), null);
  assert.equal(searchKeyAction({ key: '/', isComposing: true }, ctx), null);
  assert.equal(searchKeyAction({ key: '/', defaultPrevented: true }, ctx), null);
  assert.ok(searchBlockedOn('/test') && searchBlockedOn('/onboarding/step') && !searchBlockedOn('/testing-ground') && !searchBlockedOn('/today'));
  assert.ok(typesText({ tag: 'input' }) && !typesText({ tag: 'BUTTON' }));
});

test('preview links: pages, a chapter for Practice, Learn v2 views and a course stay inside the fixtures', () => {
  const links = { today: '/preview/arena?view=today&plan=free&data=ready', dashboard: '/preview/arena?view=dashboard&plan=free&data=ready', 'admission-compass': '/preview/arena?view=compass&plan=free&data=ready', 'review/revise': '/preview/arena?view=revise&plan=free&data=ready' };
  assert.equal(previewHref('/today', links), links.today);
  assert.equal(previewHref('/review/revise', links), links['review/revise']);
  assert.equal(previewHref('/dashboard?subject=accountancy&mode=quick&count=10&chapter=Goodwill', links), '/preview/arena?view=dashboard&plan=free&data=ready&subject=accountancy&mode=quick&count=10&chapter=Goodwill');
  assert.equal(previewHref('/admission-compass?course=b-com', links), '/preview/arena?view=compass&plan=free&data=ready&course=b-com');
  assert.equal(previewHref('/learn/c/accountancy.goodwill/cards', links), '/preview/arena?view=learn2-cards&plan=free&data=ready&chapter=accountancy.goodwill');
  assert.equal(previewHref('/learn/c/accountancy.goodwill', links), '/preview/arena?view=learn2-chapter&plan=free&data=ready&chapter=accountancy.goodwill');
  assert.equal(previewHref('/daily', links), '/daily', 'a page outside the preview keeps its address');
  assert.equal(previewHref('/today', null), '/today');
});

test('the static index is current with the DU files and the Key cards decks', () => {
  assert.equal(readFileSync(SEARCH_INDEX_FILE, 'utf8').replace(/\r\n/g, '\n'), serialise(buildSearchIndex()), 'run node scripts/search/build-search-index.mjs');
  assert.ok(INDEX.colleges.length > 50 && INDEX.courses.length > 50 && INDEX.decks.length > 100);
  assert.ok(Buffer.byteLength(JSON.stringify(INDEX)) < 30_000, 'small enough to load when the panel opens');
});

test('source pins: the rail draws the Search key above Today; phones get it on You and the Start sheet; data loads lazily', () => {
  const shell = read('src/app/(app)/AppLayoutClient.jsx');
  const key = shell.indexOf('<SearchKey');
  assert.ok(key > shell.indexOf('className="arena-mobi-door"') && key < shell.indexOf('arena-sidebar__places'), 'the rail key sits right above the places, whose first row is Today');
  assert.match(shell, /<SearchHost /);
  assert.match(shell, /\{!isTestRoute && <SearchHost /);
  const profile = read('src/app/(app)/profile/ProfilePageClient.jsx');
  assert.ok(profile.indexOf('<SearchField') > -1 && profile.indexOf('<SearchField') < profile.indexOf('<YourSheet'), 'the You page leads with Search, above the account card');
  assert.match(read('src/components/start/StartSheet.jsx'), /<SearchField /);
  const palette = read('src/components/search/SearchPalette.jsx');
  assert.match(palette, /import\('@\/lib\/search\/searchIndex\.json'\)/);
  assert.match(palette, /import\('@\/\.\.\/data\/cuet_syllabus\.js'\)/);
  assert.doesNotMatch(palette, /^import .*(searchIndex\.json|cuet_syllabus)/m, 'never in the shell\'s first load');
  assert.doesNotMatch(palette, /fetch\(/, 'no request per keystroke');
  // The motion, exactly as the brief gives it: 160 ms in with an 8 px rise, 120 ms fade out, one ease-out curve; reduced motion 1 ms.
  assert.match(palette, /export const OPEN_MS = 160;/);
  assert.match(palette, /export const CLOSE_MS = 120;/);
  assert.match(palette, /export const EASE = 'cubic-bezier\(0\.23, 1, 0\.32, 1\)';/);
  assert.match(palette, /const RISE_PX = 8;/);
  assert.match(palette, /reducedMotion\(\) \? 1 : CLOSE_MS/);
  assert.match(palette, /reduced \? 1 : OPEN_MS/);
  // Nothing in the stylesheet transitions or loops; the active row's background moves with no transition.
  const css = read('src/components/search/search.css');
  assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ''), /transition|animation|@keyframes|backdrop-filter/);
});

test('review pins (18 Nov): a long query wraps, the rail key keeps 44 px on touch, the open state dies with its host', () => {
  const css = read('src/components/search/search.css').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(css, /\.srch-none \{[^}]*overflow-wrap: anywhere;/, 'a pasted address never runs off the panel at 360 px');
  assert.match(css, /@media \(pointer: coarse\) \{\s*\.app-shell \.arena-sidebar \.srch-key \{ height: 44px; min-height: 44px; \}/);
  const host = read('src/components/search/SearchHost.jsx');
  assert.match(host, /useEffect\(\(\) => \(\) => closeSearch\(\), \[\]\);/, 'the shell setting Search aside closes it');
  assert.match(host, /window\.addEventListener\('popstate', onPop\);\s*return \(\) => window\.removeEventListener\('popstate', onPop\);/, 'Back closes it on any address');
  assert.match(host, /window\.addEventListener\('keydown', onKey\);\s*return \(\) => window\.removeEventListener\('keydown', onKey\);/);
});
