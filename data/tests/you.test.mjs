// IA7: You (src/app/(app)/you, profile, upload, leaderboard, admission-compass, src/components/profile).
// The rules that decide what a student reads live in youModel.mjs: the goal save, Start on, Personal bests,
// the Leaderboard, Contribute questions and the rows of the hub. A goal says "saved" only after the server
// confirmed it; a retake never counts as a best; a simulated rival never ranks above a student.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BULK_FIELDS, CONTRIBUTE_COPY, GOAL_DAYS, GROUP_ORDER, START_ON_COOKIE, UPLOAD_TABS,
  activePause, bestBody, bestDatesLine, bestsFromServer, boardTag, bulkPayload, bulkSentLine, cleanStartOn, filterSubmissions, formatTime12,
  goalErrorLine, goalFromServer, goalLine, goalPauseLine, goalSaveBody, goalSavedLine, goalSplitLine, goalUncertainLine, marksText,
  planSummary, readStartOn, sheetSubjects, splitLeaderboard, startOnCookie, statusLabel, submissionCounts, submissionDate,
  submissionsFromServer, uploadTab, validateBulk, writeStartOn, yourPlaceLine, youGroups,
} from '../../src/components/profile/youModel.mjs';
import { DEFAULT_START_ON, START_ON_KEY, START_ON_OPTIONS, placeContents } from '../../src/lib/navigation.js';
import { postSignInPath } from '../../src/lib/auth-redirect.js';
import { CAVEAT_PATTERNS, UPLOAD_STATUS, retiredHits, studentStrings } from '../glossary.mjs';
import { appPageRoutes, resolvesHref } from './ia_helpers.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const read = (path) => readFileSync(join(ROOT, path), 'utf8');
const memory = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }; };

// ---------------------------------------------------------------------------------------------
// 1. Weekly goal

test('the goal picker offers 1 to 7 days and the split line counts study and rest days', () => {
  assert.deepEqual(GOAL_DAYS, [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(goalLine(1), '1 day a week');
  assert.equal(goalLine(4), '4 days a week');
  assert.equal(goalSplitLine(4), '4 study days and 3 rest days.');
  assert.equal(goalSplitLine(6), '6 study days and 1 rest day.');
  assert.equal(goalSplitLine(1), '1 study day and 6 rest days.');
  assert.match(goalSplitLine(7), /no rest days/);
});

test('a goal is read only when the server sent a whole number of days from 1 to 7', () => {
  assert.deepEqual(goalFromServer({ daysPerWeek: 5, set: true, pausedUntil: '2026-11-02' }), { days: 5, set: true, pausedUntil: '2026-11-02' });
  assert.equal(goalFromServer({ daysPerWeek: 4, set: false }).set, false, 'an explicit "not chosen yet" is kept');
  assert.equal(goalFromServer({ daysPerWeek: 4 }).set, true, 'an older server that sends no set: the days in force are the goal');
  for (const bad of [null, {}, { daysPerWeek: 0 }, { daysPerWeek: 8 }, { daysPerWeek: 3.5 }, { daysPerWeek: '4' }, { error: 'unavailable' }]) assert.equal(goalFromServer(bad), null);
});

test('a save sends the days and keeps a pause made in the app; a pause already over is not sent back', () => {
  const now = Date.parse('2026-10-15T10:00:00+05:30');
  assert.deepEqual(goalSaveBody(5, '2026-10-20', now), { daysPerWeek: 5, pausedUntil: '2026-10-20' });
  assert.deepEqual(goalSaveBody(5, '2026-10-15', now), { daysPerWeek: 5, pausedUntil: '2026-10-15' }, 'today still counts');
  assert.deepEqual(goalSaveBody(5, '2026-10-01', now), { daysPerWeek: 5, pausedUntil: null });
  assert.deepEqual(goalSaveBody(5, null, now), { daysPerWeek: 5, pausedUntil: null });
  assert.equal(activePause('not a date', now), null);
  assert.match(goalPauseLine('2026-11-02', now), /^Rhythm is paused until 2 Nov\. Changing the goal keeps the pause\.$/);
  assert.equal(goalPauseLine(null, now), null);
});

test('every goal outcome has its own plain words, and "saved" is never one of the failures', () => {
  assert.match(goalErrorLine({ kind: 'network' }), /could not reach MockMob/);
  assert.match(goalErrorLine({ kind: 'network' }), /was not changed/);
  assert.match(goalErrorLine({ status: 422 }), /1 to 7/);
  assert.match(goalErrorLine({ status: 401 }), /Sign in again/);
  assert.match(goalErrorLine({ status: 503 }), /Nothing was changed/);
  assert.match(goalUncertainLine(), /could not confirm/);
  for (const line of [goalErrorLine({ kind: 'network' }), goalErrorLine({ status: 422 }), goalErrorLine({ status: 401 }), goalErrorLine({ status: 503 }), goalUncertainLine()]) {
    assert.doesNotMatch(line, /^Goal saved/, 'a failure never opens with the success line');
  }
  assert.match(goalSavedLine(new Date(2026, 9, 15, 16, 30)), /^Goal saved at 4:30 PM\.$/);
  assert.match(formatTime12(new Date(2026, 9, 15, 16, 5)), /^4:05 PM$/);
  assert.match(formatTime12(new Date(2026, 9, 15, 0, 7)), /^12:07 AM$/);
});

test('the goal control says "saved" only after the answer, and keeps the choice when a save fails', () => {
  const source = read('src/components/profile/GoalControl.jsx');
  const save = source.slice(source.indexOf('async function submit'), source.indexOf('const onKeyDown'));
  // The saved line is built from the server's answer, after the await, never before it.
  assert.ok(save.indexOf('await api(') < save.indexOf('goalSavedLine'));
  assert.match(save, /goalFromServer\(body\)/);
  assert.match(save, /if \(!confirmedGoal\)[^]*goalUncertainLine/, 'an answer with no readable goal is "could not confirm", never "saved"');
  assert.match(save, /catch \(error\)[^]*goalErrorLine\(error\)/);
  assert.doesNotMatch(save.slice(0, save.indexOf('await api(')), /goalSavedLine|phase: 'saved'/);
  assert.match(source, /goalSaveBody\(picked, goal\.pausedUntil\)/, 'the pause is sent back with the days');
  assert.match(source, /onSaved\?\.\(confirmedGoal\)/, 'the hub re-reads the week card after a confirmed save');
});

// ---------------------------------------------------------------------------------------------
// 2. Start on

test('Start on is Today unless the student chose Practice, and anything unreadable is Today', () => {
  assert.equal(DEFAULT_START_ON, 'today');
  assert.equal(cleanStartOn('practice'), 'practice');
  assert.equal(cleanStartOn('"practice"'), 'practice');
  assert.equal(cleanStartOn('{"id":"practice"}'), 'practice');
  for (const bad of [null, '', 'dashboard', '{"id":"nope"}', '[1]', 'undefined', 42]) assert.equal(cleanStartOn(bad), 'today');
});

test('the choice is written to this device and mirrored in a first-party cookie', () => {
  const store = memory();
  const cookies = [];
  assert.equal(writeStartOn('practice', { store, setCookie: (c) => cookies.push(c) }), true);
  assert.equal(store.m.get(START_ON_KEY), 'practice');
  assert.equal(readStartOn(store), 'practice');
  assert.equal(cookies[0], startOnCookie('practice'));
  assert.match(startOnCookie('practice'), new RegExp(`^${START_ON_COOKIE}=practice; Path=/; Max-Age=31536000; SameSite=Lax$`));
  assert.match(startOnCookie('nonsense'), /=today;/, 'a bad id is never written');
});

test('a blocked store or cookie is reported, not hidden, and reading never throws', () => {
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(writeStartOn('practice', { store: blocked, setCookie: () => { throw new Error('blocked'); } }), false);
  assert.equal(writeStartOn('practice', { store: blocked, setCookie: () => {} }), true, 'the cookie alone is enough for the home page');
  assert.equal(readStartOn(blocked), 'today');
  assert.equal(readStartOn(null), 'today');
});

test('what the You page writes is where sign-in lands', () => {
  for (const option of START_ON_OPTIONS) {
    const store = memory();
    writeStartOn(option.id, { store });
    assert.equal(postSignInPath({ needsOnboarding: false, store }), option.href, `Start on ${option.label}`);
  }
  assert.equal(postSignInPath({ needsOnboarding: false, store: memory() }), '/today');
});

// ---------------------------------------------------------------------------------------------
// 3. Personal bests

const mark = (marks, max = 250, extra = {}) => ({ marks, max, attemptId: 'a', completedAt: Date.parse('2026-10-09T10:00:00Z'), ...extra });
const best = (extra) => ({ formatId: 'f1', subject: 'economics', mode: 'full', attempts: 2, best: mark(171), latest: mark(164, 250, { completedAt: Date.parse('2026-10-14T10:00:00Z') }), ...extra });

test('Personal bests are mocks only, with marks and their denominators, strongest share first', () => {
  const rows = bestsFromServer({ bests: [
    best({ formatId: 'q', mode: 'quick', subject: 'english' }),
    best({ formatId: 'low', subject: 'business_studies', best: mark(96), latest: mark(96) }),
    best({ formatId: 'high', subject: 'economics' }),
    best({ formatId: 'nta', mode: 'nta', subject: 'accountancy', best: mark(149), latest: mark(149) }),
  ] });
  assert.deepEqual(rows.map((r) => r.key), ['high', 'nta', 'low'], 'a quick practice is not a mock; the strongest share leads');
  assert.equal(rows[0].title, 'Full mock, Economics, 50 questions');
  assert.equal(rows[1].title, 'NTA mode, Accountancy, 50 questions');
  assert.equal(marksText(rows[0].best), '171 of 250 marks');
});

test('negative marks are shown plainly and rows with no usable marks are dropped, never shown as zero', () => {
  assert.equal(marksText(mark(-3)), '-3 of 250 marks');
  assert.equal(bestsFromServer({ bests: [best({ best: mark('x') }), best({ latest: null }), best({ best: mark(10, 0) }), null] }).length, 0);
  assert.deepEqual(bestsFromServer(null), []);
  assert.deepEqual(bestsFromServer({ bests: 'no' }), []);
});

test('one sitting says first saved; two or more say best and latest; dates are India time', () => {
  const [two] = bestsFromServer({ bests: [best()] });
  assert.equal(bestBody(two), 'Best on this mock type: 171 of 250 marks. Latest: 164 of 250 marks.');
  assert.equal(bestDatesLine(two), 'Best on 9 Oct. Latest on 14 Oct.');
  const [one] = bestsFromServer({ bests: [best({ attempts: 1 })] });
  assert.equal(bestBody(one), 'First full mock saved. A second one will show your change.');
  assert.equal(bestDatesLine(one), 'Saved on 14 Oct.');
  const [noDate] = bestsFromServer({ bests: [best({ attempts: 1, latest: mark(164, 250, { completedAt: null }) })] });
  assert.equal(bestDatesLine(noDate), null, 'no date from the server means no date line, not a guessed one');
  // 9 Oct 22:00 UTC is already 10 Oct in India.
  const [late] = bestsFromServer({ bests: [best({ attempts: 1, latest: mark(164, 250, { completedAt: Date.parse('2026-10-09T22:00:00Z') }) })] });
  assert.equal(bestDatesLine(late), 'Saved on 10 Oct.');
});

test('Personal bests carry no rank and no comparison with other students', () => {
  const source = read('src/components/profile/PersonalBests.jsx') + read('src/components/profile/youModel.mjs').slice(0, read('src/components/profile/youModel.mjs').indexOf('// Leaderboard'));
  for (const text of studentStrings(source)) assert.doesNotMatch(text, /percentile|rank|top \d|other students|than \d+% of/i, text);
});

// ---------------------------------------------------------------------------------------------
// 4. Leaderboard

const row = (userId, name, totalScore, extra = {}) => ({ userId, name, tests: 3, totalScore, ...extra });

test('real students are ranked among themselves and a simulated rival never takes a place above one', () => {
  const entries = [row('r1', 'Rival', 2800, { isSynthetic: true }), row('s1', 'Asha', 410), row('r2', 'Rival two', 900, { isSynthetic: true }), row('me', 'Me', 940), row('s2', 'Dev', 120)];
  const board = splitLeaderboard(entries, 'me');
  assert.deepEqual(board.students.map((e) => e.userId), ['me', 's1', 's2']);
  assert.deepEqual(board.rivals.map((e) => e.userId), ['r1', 'r2']);
  assert.equal(board.yourPlace, 1, 'the student is first of the real students although two rivals scored more');
  assert.equal(yourPlaceLine(board), 'You are 1 of 3 on this board.');
});

test('a student who is not on the board gets no place, and bad input never throws', () => {
  const board = splitLeaderboard([row('s1', 'Asha', 410)], 'me');
  assert.equal(board.yourPlace, null);
  assert.equal(yourPlaceLine(board), null);
  assert.deepEqual(splitLeaderboard(null), { students: [], rivals: [], yourPlace: null });
  assert.deepEqual(splitLeaderboard([null, 3, 'x']).students, []);
  assert.equal(splitLeaderboard([row('s1', 'Asha', 410)], null).yourPlace, null);
});

test('the label under a name says what the row is', () => {
  assert.equal(boardTag(row('r1', 'Rival', 1, { isSynthetic: true }), 'me'), 'Simulated rival');
  assert.equal(boardTag(row('me', 'Me', 1), 'me'), 'You');
  assert.equal(boardTag(row('s1', 'Asha', 1), 'me'), 'Student');
  assert.equal(boardTag(row(undefined, 'No id', 1), undefined), 'Student');
});

test('the Leaderboard page ranks through splitLeaderboard and keeps the rivals under the students', () => {
  const page = read('src/app/(app)/leaderboard/LeaderboardPageClient.jsx');
  assert.match(page, /splitLeaderboard\(entries, user\?\.id\)/);
  assert.ok(page.indexOf('board.students') < page.indexOf('board.rivals'), 'students first in the markup');
  assert.match(page, /<details className="you-rivals">/, 'rivals sit in a labelled disclosure, closed by default');
  assert.doesNotMatch(page, /entries\.map|entries\.slice/, 'no table is built from the unsplit list');
});

// ---------------------------------------------------------------------------------------------
// 5. Contribute questions and Your submissions

test('Contribute has two tabs, Submit and Your submissions, and /upload?tab=mine is the old My uploads', () => {
  assert.deepEqual(UPLOAD_TABS.map((t) => t.id), ['submit', 'mine']);
  assert.deepEqual(UPLOAD_TABS.map((t) => t.label), ['Submit', 'Your submissions']);
  assert.equal(uploadTab('mine'), 'mine');
  for (const other of [null, undefined, '', 'submit', 'bulk', 'MINE', 'mine ']) assert.equal(uploadTab(other), 'submit');
});

test('the reward line says what production does, and no more', () => {
  assert.match(CONTRIBUTE_COPY.rewardLine, /No credit reward is promised/);
  assert.doesNotMatch(CONTRIBUTE_COPY.rewardLine, /earn|bonus|free credits|you will get/i);
});

test('one set of status words, and an unknown status is never shown as live', () => {
  assert.equal(statusLabel('live'), UPLOAD_STATUS.live);
  assert.equal(statusLabel('approved'), UPLOAD_STATUS.live);
  assert.equal(statusLabel('pending_moderation'), UPLOAD_STATUS.pending);
  assert.equal(statusLabel('some_future_state'), UPLOAD_STATUS.pending);
  for (const held of ['rejected', 'quarantined', 'blocked', 'failed']) assert.equal(statusLabel(held), UPLOAD_STATUS.held);
  assert.deepEqual(Object.values(UPLOAD_STATUS), ['In review', 'Live', 'Not published']);
});

test('submissions are read from the list, counted per group, and a failed load is not an empty list', () => {
  assert.equal(submissionsFromServer(undefined), null);
  assert.equal(submissionsFromServer({ error: 'Failed' }), null);
  assert.deepEqual(submissionsFromServer([]), []);
  const rows = submissionsFromServer([
    { id: 'q1', question: 'What is goodwill?', subject: 'accountancy', chapter: 'Partnership', status: 'live', createdAt: '2026-10-09T10:00:00Z' },
    { id: 'q2', question: '—', subject: 'cuet_gt', chapter: null, status: 'pending_moderation', createdAt: 'never' },
    { id: 'q3', body: 'Old body field', subject: 'economics', chapter: 'Money', status: 'quarantined', createdAt: '2026-10-10T10:00:00Z' },
    null,
  ]);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((r) => r.state), ['live', 'pending', 'held']);
  assert.equal(rows[0].meta, 'Accountancy, Partnership');
  assert.equal(rows[0].submitted, '9 Oct 2026');
  assert.equal(rows[1].text, 'The question text did not load', 'a placeholder dash is never shown as the question');
  assert.equal(rows[1].submitted, null);
  assert.equal(rows[1].meta, 'Cuet gt', 'an unknown subject id keeps a tidy name, never the raw id');
  assert.equal(rows[2].text, 'Old body field');
  assert.deepEqual(submissionCounts(rows), { all: 3, pending: 1, live: 1, held: 1 });
  assert.deepEqual(filterSubmissions(rows, 'held').map((r) => r.id), ['q3']);
  assert.equal(filterSubmissions(rows, 'all').length, 3);
  assert.equal(submissionDate('garbage'), null);
});

test('a long question is shown whole, never shortened', () => {
  const long = 'A very long question. '.repeat(40).trim();
  assert.equal(submissionsFromServer([{ id: 'x', question: long, status: 'live' }])[0].text, long);
});

test('the many-at-once import checks every question before anything is sent', () => {
  assert.deepEqual(validateBulk({}).ok, []);
  assert.match(validateBulk({}).errors[0], /list of questions/);
  const good = { subject: 'accountancy', chapter: 'Partnership', body: 'What is goodwill worth here?', options: [{ key: 'A', text: 'x' }, { key: 'B', text: 'y' }], correct_answer: 'A' };
  const { ok, errors } = validateBulk([good, { subject: 'accountancy' }, null, { ...good, options: [{ key: 'A', text: 'x' }] }, { ...good, correct_answer: undefined, correctIndex: 1 }]);
  assert.equal(ok.length, 2);
  assert.equal(errors.length, 3);
  assert.match(errors[0], /^Question 2 is missing chapter, body, at least 2 options, correct_answer\.$/);
  assert.match(errors[1], /^Question 3 is missing /);
  assert.match(errors[2], /^Question 4 is missing at least 2 options\.$/);
  assert.equal(bulkPayload(good).correct_answer, 'A');
  assert.equal(bulkPayload(ok[1]).correct_answer, 'B', 'correctIndex becomes the option key');
  assert.deepEqual(bulkPayload({ ...good, question: 'unused' }).tags, []);
  assert.deepEqual(BULK_FIELDS, ['subject', 'chapter', 'body', 'options', 'correct_answer']);
  assert.equal(bulkSentLine(1), '1 question was sent for checks. It is not live in practice yet.');
  assert.equal(bulkSentLine(3), '3 questions were sent for checks. They are not live in practice yet.');
});

test('the form says a question is saved only after the server accepted it', () => {
  const form = read('src/components/feed/UploadForm.jsx');
  const submit = form.slice(form.indexOf('async function submit'), form.indexOf('const props'));
  assert.ok(submit.indexOf('await uploadQuestion') < submit.indexOf("setState('success')"));
  assert.ok(submit.indexOf('await uploadQuestion') < submit.indexOf('Saved for checks'));
});

// ---------------------------------------------------------------------------------------------
// 6. The hub: every row is read from the navigation, and every setting is still reachable

test('the hub groups are the plan 2.2 groups in order, and Moderation is for moderators only', () => {
  const groups = youGroups({ moderator: false });
  assert.deepEqual(groups.map((g) => g.label), GROUP_ORDER);
  assert.deepEqual(GROUP_ORDER, ['CUET tools', 'Settings', 'Community', 'Help']);
  assert.equal(groups.some((g) => g.id === 'moderation'), false);
  const mod = youGroups({ moderator: true });
  assert.equal(mod.at(-1).id, 'moderation');
  assert.deepEqual(mod.at(-1).rows.map((r) => r.href), ['/moderation']);
});

test('every You row comes from the navigation, in its order, with a link or an action', () => {
  const nav = placeContents('you', { moderator: false }).filter((i) => i.group);
  const hub = youGroups().flatMap((g) => g.rows);
  assert.deepEqual(hub.map((r) => r.id), nav.map((i) => i.id));
  for (const r of hub) assert.ok(r.href || r.action, `${r.id} has somewhere to go`);
  assert.deepEqual(hub.filter((r) => r.action).map((r) => [r.id, r.action]), [['sign-out', 'sign-out'], ['guide', 'guide']]);
});

test('every hub link lands on a page that exists or a planned move', () => {
  const pages = appPageRoutes();
  for (const r of youGroups({ moderator: true }).flatMap((g) => g.rows)) if (r.href) assert.ok(resolvesHref(r.href, pages), `${r.id}: ${r.href}`);
  for (const path of ['/you', '/profile', '/upload', '/leaderboard', '/admission-compass', '/moderation']) assert.ok(pages.includes(path), path);
});

test('Delete account goes straight to its section on Account', () => {
  assert.equal(youGroups().flatMap((g) => g.rows).find((r) => r.id === 'delete').href, '/profile#delete');
});

test('every setting the old Account page held is still on Account, and each hub anchor lands on a section', () => {
  const account = read('src/app/(app)/profile/ProfilePageClient.jsx');
  const hubAnchors = youGroups().flatMap((g) => g.rows).map((r) => r.href).filter((h) => h && h.startsWith('/profile#')).map((h) => h.slice('/profile#'.length));
  assert.deepEqual([...new Set(hubAnchors)].sort(), ['appearance', 'delete', 'privacy', 'start-on']);
  const ids = { appearance: /id="appearance"/, delete: /id="delete"/, privacy: /id="privacy"/, plan: /id="plan"/, 'sign-in': /id="sign-in"/, account: /id="account"/ };
  for (const [name, pattern] of Object.entries(ids)) assert.match(account, pattern, `#${name}`);
  assert.match(read('src/components/profile/StartOnSetting.jsx'), /id="start-on"/);
  // The settings that were on the page before are all mounted: name, plan card, look and feel, usage data,
  // sign out of other devices, delete account. Start on, sign out and the plan anchor are new homes.
  for (const piece of ['Display name', 'Save name', '<PlanCard />', '<LookAndFeelCard />', '<UsageDataSection />', '<SignOutOtherDevicesSection />', '<DeleteAccountSection />', '<StartOnSetting />', '<SignOutControl layout="card" />', 'SUBJECTS_EDIT_HREF']) {
    assert.ok(account.includes(piece), piece);
  }
});

test('the plan row says the plan and one labelled line per wallet, from real numbers only', () => {
  assert.deepEqual(planSummary({ pro: false, practiceBalance: 40, aiRemaining: 9 }), { plan: 'Free', lines: ['40 practice credits', '9 AI credits'] });
  assert.deepEqual(planSummary({ pro: true, practiceBalance: 0, aiRemaining: 48 }), { plan: 'Pro', lines: ['Practice without credits', '48 AI credits'] });
  assert.deepEqual(planSummary({ pro: false, practiceBalance: 1, aiRemaining: 1 }).lines, ['1 practice credit', '1 AI credit']);
  assert.deepEqual(planSummary({ pro: false, practiceBalance: null, aiRemaining: undefined }), { plan: 'Free', lines: [] }, 'an unknown balance is left out, never shown as 0');
  assert.deepEqual(planSummary({ pro: false, practiceBalance: 0, aiRemaining: 0 }).lines, ['0 practice credits', '0 AI credits'], 'zero is a real number');
  assert.deepEqual(planSummary({ practiceBalance: '', aiRemaining: 'x' }).lines, []);
});

test('the sheet lists the student subjects in order, once each, with tidy names', () => {
  assert.deepEqual(sheetSubjects(['accountancy', 'economics', 'accountancy', '', 7, null]).map((s) => s.id), ['accountancy', 'economics']);
  assert.equal(sheetSubjects(['business_studies'])[0].name, 'Business Studies');
  assert.deepEqual(sheetSubjects(undefined), []);
});

// ---------------------------------------------------------------------------------------------
// 7. Moved pages and the source: words and structure

test('/progress and /my-uploads still answer, and go where the plan says', () => {
  assert.match(read('src/app/(app)/progress/page.jsx'), /permanentRedirect\('\/you#progress'\)/);
  assert.match(read('src/app/(app)/my-uploads/page.js'), /permanentRedirect\('\/upload\?tab=mine'\)/);
  assert.ok(existsSync(join(ROOT, 'src/app/(app)/you/page.js')));
});

function walk(dir, out = []) {
  for (const name of readdirSync(join(ROOT, dir))) {
    const p = `${dir}/${name}`;
    if (statSync(join(ROOT, p)).isDirectory()) walk(p, out); else if (/\.(js|jsx|mjs)$/.test(name)) out.push(p);
  }
  return out;
}
const OWNED = [
  ...walk('src/app/(app)/you'), ...walk('src/app/(app)/profile'), ...walk('src/app/(app)/progress'), ...walk('src/app/(app)/upload'),
  ...walk('src/app/(app)/my-uploads'), ...walk('src/app/(app)/leaderboard'), ...walk('src/app/(app)/admission-compass'),
  ...walk('src/components/profile'), 'src/components/feed/UploadForm.jsx',
];

test('no retired name or caveat line in the You sources', () => {
  const found = [];
  for (const path of OWNED) {
    const source = read(path);
    for (const hit of retiredHits(source, relative(ROOT, join(ROOT, path)).split(sep).join('/'))) found.push(`${path}: ${hit.id} | ${hit.text}`);
    for (const text of studentStrings(source)) if (CAVEAT_PATTERNS.some((p) => p.test(text))) found.push(`${path}: caveat | ${text.slice(0, 80)}`);
  }
  assert.deepEqual(found, []);
});

test('student-facing strings use no exclamation mark, no em dash, no middle dot and no ellipsis character', () => {
  const found = [];
  for (const path of OWNED) {
    for (const text of studentStrings(read(path))) {
      if (/—/.test(text)) found.push(`${path}: em dash | ${text.slice(0, 80)}`);
      if (/[A-Za-z]!(\s|$)/.test(text) && !/!==|!=|!\./.test(text)) found.push(`${path}: ! | ${text.slice(0, 80)}`);
      if (/ · /.test(text)) found.push(`${path}: middle dot | ${text.slice(0, 80)}`);
      if (/…/.test(text)) found.push(`${path}: ellipsis | ${text.slice(0, 80)}`);
    }
  }
  assert.deepEqual(found, []);
});

test('no page here carries an eyebrow, a numbered badge or a mono label, and each has one h1', () => {
  const pages = ['src/app/(app)/you/YouPageClient.jsx', 'src/app/(app)/profile/ProfilePageClient.jsx', 'src/app/(app)/upload/UploadPageClient.jsx',
    'src/app/(app)/leaderboard/LeaderboardPageClient.jsx', 'src/app/(app)/admission-compass/AdmissionCompassPageClient.jsx'];
  for (const path of pages) {
    const source = read(path);
    assert.doesNotMatch(source, /ArenaHead|mono-label|className="eyebrow"|glass p-/, path);
    assert.equal((source.match(/<h1[ >]/g) || []).length, 1, `${path} has one h1`);
  }
  assert.doesNotMatch(read('src/components/profile/you.css'), /gradient|text-transform:\s*uppercase|transition:\s*all/);
});

test('Account follows Night and Daylight: its styles use the app tokens, not fixed dark colours', () => {
  const privacy = read('src/app/(app)/profile/profile-privacy.css');
  const look = read('src/app/(app)/profile/look-and-feel.css');
  assert.doesNotMatch(privacy, /#a1a1aa|#fca5a5|rgba\(255, 255, 255|rgba\(248, 113, 113/, 'fixed dark-mode colours would vanish on Daylight paper');
  assert.doesNotMatch(read('src/app/(app)/profile/ProfilePageClient.jsx'), /text-zinc-\d+/);
  assert.doesNotMatch(look, /text-transform:\s*uppercase/, 'sentence-case group labels');
  assert.doesNotMatch(read('src/app/(app)/profile/LookAndFeelCard.jsx'), /mono-label|glass p-/);
});

test('motion in the You styles is covered by reduced motion, and no loop runs anywhere', () => {
  const css = read('src/components/profile/you.css');
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /data-motion='reduced'/);
  assert.doesNotMatch(css, /infinite|@keyframes/);
  for (const selector of ['.you-day', '.you-key', '.you-row', '.you-tab', '.you-filter', '.you-seg button', '.you-sub__end svg']) {
    assert.ok(css.split("data-motion='reduced'").slice(1).join('').includes(selector), `${selector} stops moving under Reduce motion`);
  }
});

test('the preview registry has the You views and every fixture answer is illustrative', () => {
  const views = read('src/app/preview/arena/views/you.jsx');
  for (const name of ['you', 'progress', 'profile', 'upload', "'my-uploads'", 'ranks', 'compass']) assert.ok(views.includes(`  ${name}:`), name);
  assert.match(views, /export const handlers/);
  assert.doesNotMatch(views, /supabase|razorpay|process\.env/i);
});
