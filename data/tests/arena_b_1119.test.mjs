// Lane arena-b (19 Nov 2026): Practice, Learn's home and You read in one look. The pure models behind the new figures (each chapter's
// state and each part's "n of m chapters started" on Learn; the streak and the Colleges figure on You), and source pins for the three
// ideas: the ticket always in view on Practice, the roadmap showing where every chapter stands, and the account card first on You.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { partProgress, partsInOrder, rowStarted, rowState, startedLine } from '../../src/components/learn2/home/homeModel.mjs';
import { cardStreak, collegesFigure, glanceKeepsStreak, placeFigures } from '../../src/app/(app)/profile/youModel.mjs';
import { STATE_LABELS } from '../chapter_state.js';

const root = new URL('../../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

const row = (key, state, progress = null, label) => ({ key, title: key, cards: 10, state: state ? { key: state, label: label ?? undefined } : undefined, progress });

test('a roadmap row says the server\'s own state word and draws its own ring; unknown is never "Not started"', () => {
  assert.deepEqual(rowState(row('a', 'needs_work', null, 'Needs work')), { key: 'needs_work', shape: 'weak', word: 'Needs work' });
  assert.deepEqual(rowState(row('b', 'holding', null, 'Holding, fading')), { key: 'holding', shape: 'strong', word: 'Holding, fading' }, 'the label as sent');
  assert.deepEqual(rowState(row('c', 'getting_there')), { key: 'getting_there', shape: 'mid', word: 'Getting there' });
  assert.deepEqual(rowState(row('d', 'thin')), { key: 'thin', shape: 'thin', word: 'Too few answers' });
  assert.deepEqual(rowState(row('e', null)), { key: 'none', shape: 'none', word: 'Not started' }, 'an old body with no state');
  assert.deepEqual(rowState(row('f', 'unknown', null, 'Could not load')), { key: 'unknown', shape: 'unknown', word: 'Could not load' });
  assert.equal(rowState(row('g', 'something_new')).key, 'unknown', 'a key the page does not know is unknown, not zero');
  assert.notEqual(rowState(row('g', 'something_new')).word, 'Not started');
  // The words are chapter state's own (data/chapter_state.js), the ones Marks trend and Key cards print.
  for (const [key, server] of [['none', 'none'], ['thin', 'thin'], ['needs_work', 'weak'], ['getting_there', 'mid'], ['holding', 'strong']]) {
    assert.equal(rowState(row('x', key)).word, STATE_LABELS[server], key);
  }
});

test('a chapter is started once a card is seen, a question tried, or an answer counted', () => {
  assert.equal(rowStarted(row('a', 'none', { of: 10, seen: 0, tried: 0 })), false);
  assert.equal(rowStarted(row('a', 'none', { of: 10, seen: 1, tried: 0 })), true);
  assert.equal(rowStarted(row('a', 'none', { of: 10, seen: 0, tried: 2 })), true);
  assert.equal(rowStarted(row('a', 'thin', null)), true, 'too few answers is still answers');
  assert.equal(rowStarted(row('a', 'unknown', null)), false, 'unknown is not counted as started');
  assert.equal(rowStarted(null), false);
});

test('each part says "<n> of <m> chapters started" for the chapters it shows; the current part comes first', () => {
  const part = {
    id: 'p2', title: 'Part 2', option: { choices: [{ id: 'afs', label: 'A' }, { id: 'cas', label: 'B' }] },
    units: [
      { title: 'Common', chapters: [row('c1', 'holding'), row('c2', 'none', { seen: 0, tried: 0 })] },
      { title: 'AFS', optionId: 'afs', chapters: [row('a1', 'needs_work'), row('a2', 'none')] },
      { title: 'CAS', optionId: 'cas', chapters: [row('b1', 'none', { seen: 3 })] },
    ],
  };
  assert.deepEqual(partProgress(part, null), { started: 3, total: 5, unknown: 0 }, 'both options show until one is chosen');
  assert.deepEqual(partProgress(part, 'afs'), { started: 2, total: 4, unknown: 0 });
  assert.deepEqual(partProgress(part, 'cas'), { started: 2, total: 3, unknown: 0 });
  assert.equal(startedLine({ started: 6, total: 7 }), '6 of 7 chapters started');
  assert.equal(startedLine({ started: 0, total: 1 }), '0 of 1 chapter started', 'zero is said as zero');
  const p1 = { id: 'p1', units: [{ chapters: [row('x1', 'none')] }] };
  assert.deepEqual(partsInOrder([p1, part], 'a2').map((p) => p.id), ['p2', 'p1']);
  assert.deepEqual(partsInOrder([p1, part], 'x1').map((p) => p.id), ['p1', 'p2']);
  assert.deepEqual(partsInOrder([p1, part], null).map((p) => p.id), ['p1', 'p2'], 'no position: book order');
});

test('review: a row the heading counts as started never says "Not started"; a part with an unread state states no count', () => {
  // The server sends none for a chapter with no answers and no must-know card added, even when cards in it were seen.
  const seenOnly = row('s', 'none', { of: 45, seen: 5, tried: 0 }, 'Not started');
  assert.equal(rowStarted(seenOnly), true);
  assert.equal(rowState(seenOnly).word, '', 'no "Not started" beside "5 of 45 cards seen"');
  assert.equal(rowState(seenOnly).shape, 'none', 'the ring still says the server state');
  assert.equal(rowState(row('t', 'none', { of: 45, seen: 0, tried: 3 })).word, '');
  assert.equal(rowState(row('u', 'none', { of: 45, seen: 0, tried: 0 })).word, 'Not started', 'untouched: the server word');
  const part = { id: 'p', units: [{ chapters: [seenOnly, row('a', 'thin'), row('b', 'none', { seen: 0 }), row('c', 'none', { seen: 0 })] }] };
  const count = partProgress(part);
  assert.deepEqual(count, { started: 2, total: 4, unknown: 0 });
  // Every row counted as started shows a word other than "Not started" (or none); every "Not started" row is not counted.
  for (const r of part.units[0].chapters) assert.equal(rowStarted(r), rowState(r).word !== 'Not started', r.key);
  const unread = { id: 'q', units: [{ chapters: [row('x', 'unknown', null, 'Could not load'), row('y', 'unknown', { seen: 2 }, 'Could not load'), row('z', 'holding')] }] };
  assert.deepEqual(partProgress(unread), { started: 2, total: 3, unknown: 1 }, 'an unread row with nothing seen leaves the count unknown');
  const map = read('src/components/learn2/home/ChapterMap.jsx');
  assert.match(map, /\{count\.unknown \? null : <span className="lh-part__count">\{startedLine\(count\)\}<\/span>\}/);
  assert.match(map, /\{state\.word \? <span className="lh-row__state">\{state\.word\}<\/span> : null\}/);
});

test('review: You keeps the streak for a student who hid it, and draws no empty Mob card; Practice clears the bar for focus', () => {
  assert.equal(glanceKeepsStreak({ hidden: true, days: 9 }), true, 'Hide my streak: the card leaves it out, Your progress keeps it (W-063)');
  assert.equal(glanceKeepsStreak({ hidden: false, days: 9 }), false, 'said once: on the card');
  assert.equal(glanceKeepsStreak(null), false, 'no read yet: the card holds its place');
  assert.equal(cardStreak('ready', { hidden: true, days: 9 }), null);
  const page = read('src/app/(app)/profile/ProfilePageClient.jsx');
  assert.match(page, /const streakRead = useStreak\(user\?\.id\);/);
  assert.match(page, /<AccountGlance userId=\{user\?\.id\} withStreak=\{glanceKeepsStreak\(streakRead\.data\)\} \/>/);
  assert.match(read('src/app/(app)/profile/you-anchor.css'), /\.app-shell \.you-mob:empty \{ display: none; \}/, 'AccountMobIdentity draws nothing with the Mob off');
  const css = read('src/app/(app)/dashboard/practice.css');
  assert.match(css, /html:has\(\.app-shell \.pr \.pr-bar\) \{ scroll-padding-bottom: calc\(var\(--dock-h, 84px\) \+ 136px \+ env\(safe-area-inset-bottom\)\); \}/);
  assert.match(css, /html:has\(\.app-shell \.pr\[data-rule\] \.pr-bar\) \{ scroll-padding-bottom: calc\(var\(--dock-h, 84px\) \+ 190px/);
});

test('You: the card\'s streak is the shared read, hidden when hidden, never a zero lead; Colleges carries the Compass count', () => {
  assert.equal(cardStreak('loading', null), 'wait');
  assert.equal(cardStreak('error', null), null, 'a failed read draws nothing');
  assert.equal(cardStreak('ready', { hidden: true, days: 9 }), null, 'Hide my streak hides it here too');
  assert.deepEqual(cardStreak('ready', { days: 12, today: { done: false } }), { days: 12, lit: false, word: 'days', label: 'Daily streak, 12 days. Opens your streak.' });
  assert.equal(cardStreak('ready', { days: 1, today: { done: true } }).word, 'day');
  assert.equal(cardStreak('ready', { days: 1, today: { done: true } }).lit, true);
  const none = cardStreak('ready', { days: 0, today: { answered: 0, needed: 5 }, week: [] });
  assert.equal(none.days, 0);
  assert.equal(none.word, 'Daily streak', 'with no run yet: the streak\'s name, not "0 days"');
  assert.equal(collegesFigure({ status: 'ready', open: 35, total: 73 }), '35 of 73 open');
  assert.equal(collegesFigure({ status: 'ready', open: 0, total: 73 }), '0 of 73 open', 'zero is zero');
  assert.equal(collegesFigure({ status: 'no-subjects' }), null);
  assert.equal(collegesFigure(null), null, 'not loaded: no figure');
  assert.deepEqual(placeFigures({ compass: { status: 'ready', open: 35, total: 73 } }), { 'admission-compass': '35 of 73 open' });
  assert.deepEqual(placeFigures({}), {}, 'Wallet has no figure: the card already says the credits');
});

test('Practice pins: the strip is gone, the ticket leads with the subject\'s object, the bar is pinned for the whole page, the key names the set', () => {
  const page = read('src/app/(app)/dashboard/DashboardPageClient.jsx');
  assert.doesNotMatch(page, /pr-session-glance/, 'the top summary strip is removed');
  assert.match(page, /<span className="pr-ticket__desk" key=\{selSubj\} aria-hidden="true"><SubjectObject id=\{selectedSubject\?\.internalId \|\| selSubj\} size=\{176\} lit life=\{false\} \/><\/span>/);
  // Owner G26: the card's heading is the mode; the subject is the object above it and the first line under it.
  for (const label of ['Subject', 'Questions', 'Time', 'Marking', 'Cost']) assert.match(page, new RegExp(`<dt>${label}</dt>`), label);
  // Untouched: the start request, the quote, the credits and the gates.
  assert.match(page, /const address = quotePath\(\{ subject: selSubj, mode: effectiveModeId, count: quoteCount \}\);/);
  assert.match(page, /if \(isLaunching \|\| launchingKeyRef\.current \|\| !quoteLaunchable\) return;/);
  assert.match(page, /disabled=\{isLaunching \|\| !quoteLaunchable\}/);
  assert.match(page, /blocked && quote\.upgradeHref \? \(/);
  // The bar is the page's last child, so its sticky box is the whole page.
  const bar = page.indexOf('<div className="pr-bar" role="region"');
  assert.ok(bar > page.indexOf('<div className="pr-lower pr-lower--1020">'));
  assert.match(page, /startKey\('pr-bar__go', true, firstRun \? 'first-set' : null\)/);
  const css = read('src/app/(app)/dashboard/practice.css');
  assert.doesNotMatch(css, /scroll-state/, 'no joined-card trick: the bar rides above the dock everywhere on the page');
  assert.match(css, /\.pr-tile__mark \{/);
  assert.match(css, /\.pr-tile__act \{ display: none; \}/);
});

test('Learn pins: every row a shape and a word with its bar, each part a disclosure that says how far it is started, the object on Pick up', () => {
  const map = read('src/components/learn2/home/ChapterMap.jsx');
  assert.match(map, /<button type="button" className="lh-part__toggle" aria-expanded=\{!shut\} aria-controls=\{bodyId\}/);
  assert.match(map, /<span className="lh-part__count">\{startedLine\(count\)\}<\/span>/);
  assert.match(map, /hidden=\{shut\}/);
  assert.match(map, /partsInOrder\(parts, position\)/);
  assert.match(map, /\{road\.total > 0 \? <span className="lh-row__bar"/, 'the bar on every row with cards, empty until a card is seen');
  const hero = read('src/components/learn2/home/RoadmapHero.jsx');
  assert.match(hero, /<SubjectObject id=\{subjectId\} size=\{168\} lit life=\{false\} \/>/);
  assert.equal((hero.match(/data-page-primary=""/g) || []).length, 2, 'the one volt key (a link, or See Pro)');
});

test('You pins: no opening paragraph, the account card first with the streak, the places as one list with figures', () => {
  const page = read('src/app/(app)/profile/ProfilePageClient.jsx');
  assert.match(page, /<ArenaHead title="Your account\." \/>/, 'the opening paragraph goes');
  assert.match(page, /mobi=\{<YouStreak userId=\{user\?\.id\} fallback=\{sheetMobi\} \/>\}/);
  assert.match(page, /<AccountGlance userId=\{user\?\.id\} withStreak=\{glanceKeepsStreak\(streakRead\.data\)\} \/>/, 'the streak is said once on the page (twice never; kept below when hidden on the card)');
  assert.doesNotMatch(page, /<TodayCompass/, 'the Compass line is the Colleges row\'s figure now');
  assert.ok(page.indexOf('<SearchField') < page.indexOf('<YourSheet') && page.indexOf('<YourSheet') < page.indexOf('<YouPlaces figures={figures} />'));
  for (const piece of ['<AccountMobIdentity', '<AccountColleges', '<GoalControl />', '<StreakPauseOffer', '<PlanCredits', '<CreditsSection', '<SignOutControl />', '<DeleteAccountSection />']) assert.ok(page.includes(piece), piece);
  const places = read('src/components/nav/YouPlaces.jsx');
  assert.match(places, /\{figures\[tab\.id\] \? <span className="you-places__fig">\{figures\[tab\.id\]\}<\/span> : null\}/);
  assert.doesNotMatch(places, /you-places__label/, 'one list, not three small groups');
  assert.match(read('src/components/nav/you-places.css'), /\.you-places__row \{[^}]*min-height: 56px/);
  const sheet = read('src/components/profile/YourSheet.jsx');
  assert.doesNotMatch(sheet, /AccountMobIdentity/);
  assert.match(sheet, /<SubjectObject id=\{subject\.id\} size=\{72\} life=\{false\}/);
});

// 18 Nov 2026 (after the review): the Start key names the set again (owner G26; on a phone the dock's own "Start" sits right
// under it), and the bar beside it never repeats the count the key already says.
test('Practice: the Start key names the set, and the bar does not say the count twice', async () => {
  const { readFileSync } = await import('node:fs');
  const page = readFileSync(new URL('../../src/app/(app)/dashboard/DashboardPageClient.jsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../../src/app/(app)/dashboard/practice.css', import.meta.url), 'utf8');
  assert.match(page, /'Checking…' : barStartLabel\}<\/span>/, 'the bar key shows the set label');
  assert.match(page, /<span className="pr-summary__words">\{startLabel\}<\/span>/, 'the desktop key shows the whole session');
  assert.doesNotMatch(page, /'Checking…' : 'Start'\}/, 'no bare Start on the key');
  assert.match(page, /className="pr-bar__count" data-on-key=\{countOnKey \|\| undefined\}/);
  assert.match(css, /\.pr-bar__text:not\(\[data-blocked\]\) \.pr-bar__count\[data-on-key\] \{ display: none; \}/, 'a blocked key says something else, so the count stays');
});
