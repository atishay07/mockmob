// Release 11 fixes, part A (19 Oct 2026): numbers, money and wording. The verifier's findings (M1, M2, L3, L6, L7, L8, L10)
// and the acceptance walk's (tmp/walk-1019/WEB-ACCEPTANCE-R11.md section 3, items 6, 7, 12 and 15), each locked here.
// The money items (L1, the free first mock taken elsewhere; L4, the kill switch) are in first_full_mock_1019.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dueBadge, dueLabel, dueWords } from '../../src/lib/nav/dueCount.mjs';
import { paperCountsOf, scopeOf, statsOf, subjectsOf } from '../../src/components/review/reviewScope.mjs';
import { ATTEMPT_WINDOW, buildReviewRecord, paperCounts } from '../../src/lib/server/review.js';
import { reviewBody } from '../review_input.mjs';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// ---- 1. (verifier M1) the Revise count reads as a Revise count ---------------------------------------------------------------
test('M1: the count beside Your papers and on the dock\'s Practice says "8 to revise", and a screen reader hears "8 questions to revise today"', () => {
  assert.equal(dueBadge(8), '8 to revise');
  assert.equal(dueBadge(1), '1 to revise');
  assert.equal(dueBadge(140), '99+ to revise');
  assert.equal(dueWords(8), '8 questions to revise today');
  assert.equal(dueLabel('Your papers', 8), 'Your papers, 8 questions to revise today');
  assert.equal(dueLabel('Practice', 1), 'Practice, 1 question to revise today');
  const layout = code(read('src/app/(app)/AppLayoutClient.jsx'));
  const tabs = code(read('src/components/nav/PlaceTabs.jsx'));
  // Every place the count is drawn: the sidebar's Your papers, the dock's Practice and Practice's row of tabs.
  assert.match(layout, /<i className="arena-nav-link__count" aria-hidden="true">\{dueBadge\(reviseBadge\)\}<\/i>/);
  assert.match(layout, /<i className="arena-badge" aria-hidden="true">\{dueBadge\(reviseBadge\)\}<\/i>/);
  assert.match(tabs, /<i className="arena-tab__count" aria-hidden="true">\{dueBadge\(badge\)\}<\/i>/);
  assert.match(layout, /const countLabel = \(tab\) => \(reviseBadge && \(tab\.id === 'review' \|\| tab\.id === 'dashboard'\) \? dueLabel\(tab\.label, reviseBadge\) : undefined\);/);
  for (const src of [layout, tabs]) {
    assert.doesNotMatch(src, /> 99 \? '99\+' : (reviseBadge|badge)\}/, 'no bare number is drawn');
    assert.doesNotMatch(src, /due back today/, 'the old words are gone from the navigation');
  }
  // The dock's disc grows into a pill that holds the word and stays inside Practice's slot.
  const css = read('src/app/(app)/nav-badge.css');
  assert.match(css, /i\.arena-badge \{[^}]*left: calc\(50% \+ 14px\); translate: -50% 0;[^}]*white-space: nowrap;/);
});

// ---- 2. (verifier M2) "Your first practice set" only when it is ----------------------------------------------------------
const paper = (id, subject, kind, questions, score, at) => ({ id, name: kind === 'full mock' ? 'Mock 1' : 'Quick practice', subject, subjectName: subject[0].toUpperCase() + subject.slice(1), kind, at, questions, score, of: questions * 5 });
const lose = { rows: [], saved: [], savedLine: '', line: { text: '' } };

test('M2: "Your first practice set in English" only when no earlier English practice set exists; another length names the length', () => {
  const ten = paper('p2', 'english', 'practice', 10, 30, '2026-10-19T08:00:00Z');
  const five = paper('p1', 'english', 'practice', 5, 15, '2026-10-18T08:00:00Z');
  // An earlier five-question set: the ten-question one is not the first practice set, so the line names its length.
  let stats = statsOf(scopeOf({ papers: [ten, five], lose }, 'english', 'English'), 'English');
  assert.deepEqual(stats.trend, { dir: 'first', text: 'Your first 10-question practice set in English' });
  stats = statsOf(scopeOf({ papers: [ten, five], lose }, 'all'));
  assert.deepEqual(stats.trend, { dir: 'first', text: 'Your first 10-question practice set in English' });
  // Truly the first: the line as before.
  stats = statsOf(scopeOf({ papers: [ten], lose }, 'all'));
  assert.deepEqual(stats.trend, { dir: 'first', text: 'Your first practice set in English' });
  // A full mock before a practice set does not stop it being the first practice set (kind, not length, decides "first").
  const mock = paper('m1', 'english', 'full mock', 50, 120, '2026-10-17T08:00:00Z');
  stats = statsOf(scopeOf({ papers: [ten, mock], lose }, 'all'));
  assert.deepEqual(stats.trend, { dir: 'first', text: 'Your first practice set in English' });
  // The same length before: the change, never "first".
  const tenBefore = paper('p0', 'english', 'practice', 10, 20, '2026-10-16T08:00:00Z');
  stats = statsOf(scopeOf({ papers: [ten, five, tenBefore], lose }, 'all'));
  assert.deepEqual(stats.trend, { dir: 'up', text: 'Up 10 marks on your previous practice set' });
});

test('M2: past the listed window the server\'s count decides; unknown says nothing rather than a false "first"', () => {
  const ten = paper('p2', 'english', 'practice', 10, 30, '2026-10-19T08:00:00Z');
  // 40 newer papers in other subjects would push older English sets out of the list: the server still counts them.
  const partial = { papers: [ten], lose, partial: true, papersTotal: 50, papersBySubject: { english: { total: 4, kinds: { practice: 3, 'full mock': 1 } }, accountancy: { total: 46, kinds: { practice: 46 } } } };
  assert.equal(statsOf(scopeOf(partial, 'all')).trend, null, 'English practice sets exist, at unknown lengths: no line');
  assert.equal(statsOf(scopeOf(partial, 'english', 'English'), 'English').trend, null);
  const counted = { ...partial, papersBySubject: { english: { total: 2, kinds: { practice: 1, 'full mock': 1 } }, accountancy: { total: 48, kinds: { practice: 48 } } } };
  assert.deepEqual(statsOf(scopeOf(counted, 'all')).trend, { dir: 'first', text: 'Your first practice set in English' }, 'counted: it is the only one');
  // A partial list without the server's count (an older server): never "first".
  assert.equal(statsOf(scopeOf({ papers: [ten], lose, partial: true }, 'all')).trend, null);
  // The rule's source: the old same-kind-and-length-only test is gone.
  const scope = read('src/components/review/reviewScope.mjs');
  assert.match(scope, /const firstOfKind = Number\.isInteger\(counted\) \? counted <= 1 : complete && !papers\.slice\(1\)\.some\(sameKind\);/);
});

// ---- 7. (verifier L3) Papers sat is every paper, not the 40 listed --------------------------------------------------------
test('L3: "Papers sat" for All subjects is the true total (papersTotal), with the kinds counted over the whole history', () => {
  const slim = [];
  const at = (n) => new Date(Date.UTC(2026, 9, 19, 12) - n * 3_600_000).toISOString();
  for (let n = 0; n < 47; n += 1) slim.push({ id: `a${n}`, subject: n % 2 ? 'accountancy' : 'english', correct: 8, wrong: 1, unattempted: 1, total: 10, completed_at: at(n), mode: 'quick' });
  slim.push({ id: 'mock-old', subject: 'english', correct: 40, wrong: 5, unattempted: 5, total: 50, completed_at: at(60), mode: 'full' });
  const record = buildReviewRecord({ userId: 'u1', slim, now: Date.parse('2026-10-19T13:00:00Z') });
  assert.equal(record.papers.length, ATTEMPT_WINDOW);
  assert.equal(record.papersTotal, 48);
  assert.deepEqual(record.papersBySubject, paperCounts(slim));
  assert.deepEqual(record.papersBySubject.english, { total: 25, kinds: { practice: 24, 'full mock': 1 } });
  const body = { ...reviewBody(record), partial: record.partial, papersTotal: record.papersTotal, papersBySubject: record.papersBySubject };
  const all = statsOf(scopeOf(body, 'all'));
  assert.equal(all.papers, 48, 'never capped at 40');
  assert.equal(all.listed, 40);
  assert.equal(all.papersNote, '47 practice sets, 1 full mock');
  const english = statsOf(scopeOf(body, 'english', 'English'), 'English');
  assert.equal(english.papers, 25, 'a subject counts its old papers too');
  assert.equal(english.papersNote, '24 practice sets, 1 full mock');
  // The chips agree with the strip.
  const chips = subjectsOf(body.papers, [], paperCountsOf(body));
  assert.deepEqual(chips.map((c) => [c.id, c.n]), [['english', 25], ['accountancy', 23]]);
  // The route sends the counts, and the page passes the true total to the All chip and the papers list.
  assert.match(read('src/lib/server/review.js'), /papersTotal: record\.papersTotal, papersBySubject: record\.papersBySubject \}/);
  const page = read('src/components/review/ReviewChapters.jsx');
  assert.match(page, /total=\{scopeOf\(body, 'all'\)\.total \?\? \(body\.papers \|\| \[\]\)\.length\}/);
  assert.match(page, /`Show the newest \$\{papers\.length\} papers`/);
  // A body without the counts (an older server, a preview fixture) reads as before.
  const plain = statsOf(scopeOf({ papers: body.papers, lose: body.lose }, 'all'));
  assert.equal(plain.papers, 40);
});

// ---- 3. (walk, section 3 item 7) Practice and Your papers say one "to repair" number -------------------------------------
test('walk 7: Practice\'s "to repair" and Your papers\' "To repair" are one number, counted one way (wrong answers; blanks apart)', async () => {
  const { repairsFor, REVIEW_WINDOW } = await import('../../src/app/(app)/dashboard/repairsLine.mjs');
  assert.equal(REVIEW_WINDOW, ATTEMPT_WINDOW, 'Practice counts the same newest papers as Your papers');
  // The walk's student: a 10-question Accountancy quick, a 5-question English quick and a 50-question Accountancy full mock.
  const spec = [
    { id: 'acc-q', subject: 'accountancy', mode: 'quick', at: '2026-10-19T03:00:00Z', marks: 'rrwrbrwrrw' },
    { id: 'eng-q', subject: 'english', mode: 'quick', at: '2026-10-19T03:30:00Z', marks: 'rwwbr' },
    { id: 'acc-f', subject: 'accountancy', mode: 'full', at: '2026-10-19T04:30:00Z', marks: 'rwrbrwwrbrrwrrwbrrwrwrrbwrrrwbrwrrwrbrrwwrbrrrwrbw' },
  ];
  const details = (marks) => [...marks].map((c, i) => ({ qid: `q${i + 1}`, isCorrect: c === 'r' ? true : c === 'w' ? false : null, ...(c === 'w' ? { givenIndex: 2 } : {}) }));
  const n = (marks, c) => [...marks].filter((x) => x === c).length;
  const attempts = spec.map((p) => ({ id: p.id, subject: p.subject, correct: n(p.marks, 'r'), wrong: n(p.marks, 'w'), unattempted: n(p.marks, 'b'), total: p.marks.length, completedAt: p.at, details: details(p.marks) }));
  const slim = [...spec].reverse().map((p) => ({ id: p.id, subject: p.subject, correct: n(p.marks, 'r'), wrong: n(p.marks, 'w'), unattempted: n(p.marks, 'b'), total: p.marks.length, completed_at: p.at, mode: p.mode }));
  const heavy = new Map(spec.map((p) => [p.id, { details: details(p.marks), questions_snapshot: [...p.marks].map((_, i) => ({ id: `q${i + 1}`, chapter: `Chapter ${1 + (i % 4)}` })) }]));
  const keyRows = new Map(spec.flatMap((p) => [...p.marks].map((_, i) => [`q${i + 1}`, { status: 'published', is_deleted: false }])));
  const record = buildReviewRecord({ userId: 'walk', slim, heavy, cards: [], keyRows, now: Date.parse('2026-10-19T05:00:00Z') });
  const body = { ...reviewBody(record), partial: record.partial, papersTotal: record.papersTotal, papersBySubject: record.papersBySubject };
  const papersAll = statsOf(scopeOf(body, 'all')).toRepair;
  const wrongs = spec.reduce((t, p) => t + n(p.marks, 'w'), 0);
  assert.equal(papersAll, wrongs, 'Your papers: the wrong answers, never the blanks');
  for (const subject of ['english', 'accountancy']) {
    const practice = repairsFor({ attempts, repairs: [], subjectId: subject });
    assert.equal(practice.open + practice.openElsewhere, papersAll, `${subject}: Practice's subject plus "more in other subjects" is Your papers' total`);
    assert.equal(practice.open, statsOf(scopeOf(body, subject, subject)).toRepair, `${subject}: the same number as Your papers in that subject`);
    assert.equal(practice.blanks, spec.filter((p) => p.subject === subject).reduce((t, p) => t + n(p.marks, 'b'), 0), 'blanks are counted apart');
  }
  // The line's words: "to repair" is the wrong answers; a subject with only blanks left never says "every answer was right".
  const line = read('src/app/(app)/dashboard/PracticeRepairs.jsx');
  assert.match(line, /title = `\$\{plural\(facts\.open, 'question'\)\} to repair in \$\{name\}`;/);
  assert.match(line, /left blank: try \$\{facts\.blanks === 1 \? 'it' : 'them'\} again in Your papers, free\./);
  const blanksOnly = repairsFor({ attempts: [{ id: 'b1', subject: 'english', correct: 3, wrong: 0, unattempted: 2, total: 5, completedAt: '2026-10-19T03:00:00Z', details: details('rrbbr') }], repairs: [], subjectId: 'english' });
  assert.deepEqual([blanksOnly.open, blanksOnly.blanks], [0, 2]);
});

// ---- 4. (walk, section 3 item 6) the place is "Your papers" everywhere a sentence names it ---------------------------------
test('walk 6: no screen names the old place "Review" ("in Review", "Open Review", "Back to Review", a "Review" back link)', async () => {
  const { readdirSync, statSync } = await import('node:fs');
  const root = new URL('../../', import.meta.url);
  const files = [];
  const walk = (rel) => {
    for (const name of readdirSync(new URL(rel, root))) {
      const path = `${rel}${name}`;
      if (statSync(new URL(path, root)).isDirectory()) { if (!['preview', 'landing', '__tests__', 'tests', 'admin'].includes(name)) walk(`${path}/`); continue; }
      if (/\.(js|jsx|mjs)$/.test(name)) files.push(path);
    }
  };
  walk('src/');
  for (const name of readdirSync(new URL('data/', root))) if (/\.(js|mjs|json)$/.test(name)) files.push(`data/${name}`);
  const stale = /\b(in|Open|Back to|Also in|stay in|safe in|still in|lands in|waits in) Review\b|\/>Review<\/Link>|Review still (opens|has|works)/;
  const found = [];
  for (const path of files) {
    const text = path.endsWith('.json') ? read(path) : code(read(path));
    text.split('\n').forEach((line, i) => { if (stale.test(line)) found.push(`${path}:${i + 1}: ${line.trim().slice(0, 120)}`); });
  }
  assert.deepEqual(found, [], 'every sentence names Your papers');
  // A few of the lines the walk named, as they read now.
  assert.match(read('data/mistake_lab.copy.json'), /"back": "Back to Your papers",/);
  assert.match(read('src/components/RecoveryOverview.jsx'), /to look at in Your papers/);
  assert.match(read('src/components/ai/RecordView.jsx'), /<b>Your weak chapters are in Your papers<\/b>/);
  assert.match(read('src/components/today/TodayWeak.jsx'), /These questions are in Your papers\./);
  assert.match(read('src/app/features/page.js'), /lands in Your papers with its explanation/);
  assert.match(read('data/prepos_insights.js'), /See your replay in Your papers/);
  // "Review" that means reviewing answers stays ("Review your mistakes", "Review and repair", NTA's "Mark for Review").
  assert.match(read('src/app/(app)/dashboard/PracticeRepairs.jsx'), /label: 'Review and repair'/);
});

// ---- 9. (verifier L10) Today never waits for the second quote read ---------------------------------------------------------
test('L10: Today paints without waiting for the free-first-mock read; a mock\'s price line keeps its space and fills in place', async () => {
  const { priceLineOf, pricePending, priceSlotOf } = await import('../../src/lib/today/priceLine.mjs');
  const mock = { id: 'firstMock', kind: 'mock', number: 50, subject: 'economics', key: { href: '/dashboard?subject=economics&mode=full' } };
  const waiting = { subject: 'economics', state: 'unknown', settled: false };
  const landed = { subject: 'economics', state: 'available', settled: true };
  assert.equal(pricePending(mock, { firstFull: waiting }), true, 'on its way: the line is held empty');
  assert.equal(pricePending(mock, { firstFull: landed }), false);
  assert.equal(pricePending(mock, { firstFull: { ...waiting, subject: 'english' } }), false, 'another subject was not read');
  assert.equal(pricePending(mock, { premium: true, firstFull: waiting }), false, 'Pro prints no price');
  assert.equal(pricePending({ id: 'practice', number: 10, subject: 'economics' }, { firstFull: waiting }), false, 'a practice set never waits for it');
  // The room is the longest line the move can show, so the free line, "Practice shows the price" or the price all fit it.
  const room = priceSlotOf(mock, { balance: 1234, firstFull: waiting });
  for (const state of ['available', 'unknown', 'used']) {
    const line = priceLineOf(mock, { balance: 1234, firstFull: { subject: 'economics', state, settled: true } });
    assert.ok(line.length <= room.length, `${state}: "${line}" fits "${room}"`);
  }
  assert.equal(priceSlotOf(mock, { premium: true, firstFull: waiting }), null);
  assert.equal(priceSlotOf(mock, { firstFull: null }), null, 'the rule switched off: a plain line, as before');
  const page = read('src/app/(app)/today/page.jsx');
  assert.doesNotMatch(code(page), /firstFullState === 'unknown'|mockLeads/, 'the page hold no longer waits for the read');
  assert.match(page, /const holdForPage = !waitedOut && \(\[data\.rhythm, data\.road, data\.goal, insights\]\.some\(\(r\) => r\.status === 'loading'\) \|\| Boolean\(userId && !premium && dailySet === 'unknown'\)\);/);
  assert.match(page, /priceLine: pending \? '' : priceLineOf\(m, \{ premium, balance, dailySet, firstFull \}\), priceSlot: priceSlotOf\(m, \{ premium, balance, firstFull \}\)/);
  const card = read('src/components/today/TodayMove.jsx');
  assert.match(card, /m\.priceSlot \? <p className="tm__price tm__price--slot"><span className="tm__price-room" aria-hidden="true">\{m\.priceSlot\}<\/span><span>\{m\.priceLine\}<\/span><\/p>/);
  const css = read('src/components/today/today.css');
  assert.match(css, /\.app-shell \.tm__price--slot \{ display: grid; \}/);
  assert.match(css, /\.app-shell \.tm__price--slot > span \{ grid-area: 1 \/ 1; \}/);
  assert.match(css, /\.app-shell \.tm__price-room \{ visibility: hidden; \}/);
});

// ---- 8. (verifier L6, L7, L8) the price names its unit, the pricing rows end, the tour says where Ask Mobi is -------------
test('L6, L7, L8: "50 credits", full stops on the pricing rows, and the tour points at Ask Mobi where the You sheet draws it', async () => {
  const { ONE_CREDIT_LINE } = await import('../../src/lib/creditCopy.mjs');
  assert.match(ONE_CREDIT_LINE, /A full mock costs 50 credits[,.]/, 'L6: never a bare "costs 50"');
  assert.match(ONE_CREDIT_LINE, /Deeper analysis costs 3 credits\./);
  const pricing = read('src/app/pricing/page.js');
  assert.match(pricing, /3 a deeper analysis\.\$\{FIRST_FULL_MOCK_ON \? ' Your first Full mock in each subject is free\.' : ''\}`\]/, 'L7: the Free Credits row ends with a full stop either way');
  assert.match(pricing, /'Practice needs none: every mode is included\. 50 free a month for Ask Mobi\.'\]/, 'and so does the Pro row beside it');
  // L8: the You sheet draws the account card (name, Sign out, Show me around, Guide), then Ask Mobi. The tour says so.
  const { TOUR_STEPS_ALL } = await import('../../src/lib/appTour.mjs');
  const { HELP_DOOR, TOUR_LABEL } = await import('../../src/lib/helpDoor.mjs');
  const ask = TOUR_STEPS_ALL.find((s) => s.title === 'Ask Mobi').bodies['nav-more'];
  assert.match(ask, new RegExp(`^Ask Mobi is in the You sheet, right under ${TOUR_LABEL} and ${HELP_DOOR.label}\. `));
  assert.doesNotMatch(ask, /below your name/);
  const sheet = read('src/app/(app)/AppLayoutClient.jsx').split('id="arena-sheet"')[1];
  const at = (needle) => sheet.indexOf(needle);
  assert.ok(at('arena-sheet__who') < at('arena-sheet__tour') && at('arena-sheet__tour') < at('{HELP_DOOR.label}') && at('{HELP_DOOR.label}') < at('arena-sheet__lead--ask'), 'name, Show me around, Guide, then Ask Mobi');
});

// ---- 10. (walk item 15) a handle or the email's prefix is not a name ------------------------------------------------------
test('walk 15: the new student is greeted without a name until a real first name is set (the app\'s shownFirstName rule)', async () => {
  const { shownFirstName, shownName } = await import('../../src/lib/displayName.mjs');
  const { greetName, greeting } = await import('../../src/lib/today/greeting.mjs');
  const email = 'walk-r11-web-1019a@example.com';
  // The app's cases (flutter_app lib/core/auth/display_name.dart), one for one.
  for (const handle of ['walk-r11-web-1019a', 'app-e2e-student', 'asha_v', 'asha.v', 'asha07', 'Asha 07', 'a@b']) {
    assert.equal(shownName(handle, email), null, handle);
    assert.equal(shownFirstName(handle, email), null, handle);
    assert.equal(greetName(handle, email), '', handle);
  }
  assert.equal(shownName('Walk', 'walk@example.com'), null, 'the email\'s own local part is not a name');
  assert.equal(shownName('  ', email), null);
  assert.equal(shownName('Asha Rao', email), 'Asha Rao');
  assert.equal(shownFirstName('Asha Rao', email), 'Asha');
  assert.equal(greeting({ hour: 9, name: 'walk-r11-web-1019a', email }), 'Good morning');
  assert.equal(greeting({ hour: 9, name: 'Asha Rao', email }), 'Good morning, Asha');
  // Every screen that greets or labels the account reads the rule: Practice's heading, Account's "Hi", the shell's account labels.
  const practice = read('src/app/(app)/dashboard/DashboardPageClient.jsx');
  assert.match(practice, /const greetFirst = shownFirstName\(user\?\.name, user\?\.email\);/);
  assert.match(practice, /\{greetFirst \? `\$\{greetFirst\}, what are we practising\?` : 'What are we practising\?'\}/);
  assert.doesNotMatch(practice, /user\.name\.split/);
  const profile = read('src/app/(app)/profile/ProfilePageClient.jsx');
  assert.match(profile, /const hi = shownFirstName\(user\?\.name, user\?\.email\);/);
  const shell = read('src/app/(app)/AppLayoutClient.jsx');
  assert.match(shell, /const accountName = shownName\(user\?\.name, user\?\.email\);/);
  assert.doesNotMatch(shell, /user\?\.name \?\? /, 'no label prints the raw name');
  assert.equal((shell.match(/\{accountName \?\? 'Account'\}/g) || []).length, 2, 'the top bar and the You sheet');
});

// ---- 11. (walk item 12) one line under Ask Mobi -----------------------------------------------------------------------------
test('walk 12: the Ask Mobi door has one line, "He explains any answer.", on the sidebar and on the phone\'s You sheet', () => {
  const shell = read('src/app/(app)/AppLayoutClient.jsx');
  assert.match(shell, /const ASK_MOBI_NOTE = 'He explains any answer\.';/);
  assert.equal((shell.match(/<span className="arena-sheet__lead-note">\{ASK_MOBI_NOTE\}<\/span>/g) || []).length, 2, 'the rail door and the sheet row');
  for (const old of ['He explains questions, results and your plan.', 'He knows your record.', 'Ask about a question, a result or your plan.']) {
    assert.doesNotMatch(shell, new RegExp(old.replace(/[.?]/g, '\$&')), old);
  }
});
