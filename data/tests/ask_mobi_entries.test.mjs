// Ask Mobi's entry points (ASK-MOBI-1018, section 3): what each screen tells the panel, the one label for each entry, the
// panel's states (empty, thinking, answer, error, out of credits, offline), and the wiring of every entry. Pure logic is held
// by value; the screens are held by their source, since the repo's component tests read source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  ENTRY_LABELS, canAskAboutQuestion, fallbackHref, mockContext, mockEntryLabel, mockLabel, optionLabel, practiceContext, practicePreview,
  questionContext, questionEntryLabel, questionRefOf, todayContext,
} from '../../src/components/ai/askContexts.mjs';
import { normalizeContext } from '../../src/components/ai/askMobi.mjs';
import { clip, exchangesFrom, sourceOf } from '../../src/components/ai/mentorHistory.mjs';
import { inSentence, openingFor, suggestionsFor } from '../../src/components/ai/askSuggestions.mjs';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const BANNED = /[!→←↗»]|\b[A-Z]{4,}\b(?<!\bNTA\b)/;

const chapter = (name, o = {}) => ({ key: `accountancy::${name}`, subject: 'accountancy', subjectName: 'Accountancy', chapter: name, right: 23, wrong: 11, skip: 0, n: 34, sessions: 4, open: 55, ...o });
const INSIGHTS = {
  state: 'ready', sessions: 9, questions: 250,
  ledger: { gained: 710, penalty: 40, net: 670, openWrong: 200, openSkipped: 50, open: 250 },
  chapters: { ranked: [chapter('Partnership'), chapter('Goodwill', { wrong: 5, n: 20, open: 25, sessions: 3 })], thin: [] },
  pace: { usable: false }, week: { thisWeek: { sessions: 0 } },
};

test('one label for each entry, in sentence case, with no hype, arrows or caps', () => {
  assert.equal(questionEntryLabel(7), 'Ask Mobi about Q7');
  assert.equal(questionEntryLabel(null), 'Ask Mobi about this question');
  assert.equal(ENTRY_LABELS.mock, 'Ask Mobi about this mock');
  assert.equal(ENTRY_LABELS.practice, 'Ask Mobi what to practise');
  assert.equal(ENTRY_LABELS.today, 'Why this?');
  assert.equal(mockEntryLabel('full'), 'Ask Mobi about this mock');
  assert.equal(mockEntryLabel('nta'), 'Ask Mobi about this mock');
  assert.equal(mockEntryLabel('quick'), 'Ask Mobi about this session', 'a practice session is not called a mock');
  for (const line of [...Object.values(ENTRY_LABELS), questionEntryLabel(12)]) {
    assert.doesNotMatch(line, BANNED, line);
    assert.match(line, /^[A-Z]/);
  }
});

test('a question reference is built only from ids that can be sent safely', () => {
  assert.equal(questionRefOf('att_1', 'q-9'), 'att_1:q-9');
  for (const [a, q] of [['a:b', 'q'], ['a', 'q/1'], ['', 'q'], ['a', ''], [null, 'q'], ['a'.repeat(81), 'q']]) assert.equal(questionRefOf(a, q), null, `${a}|${q}`);
  assert.equal(questionContext({ attemptId: 'a b', questionId: 'q' }), null, 'no context without a valid reference');
});

test('a question context carries short pick and key labels only, and survives the open API unchanged', () => {
  assert.equal(optionLabel('9:6:5'), '9:6:5');
  assert.equal(optionLabel('₹4,000'), '₹4,000');
  assert.equal(optionLabel('Goodwill brought in by an incoming partner'), null, 'a sentence would not read inside another');
  assert.equal(optionLabel('  '), null);
  const ctx = questionContext({ attemptId: 'att_1', questionId: 'q-9', number: 7, chapter: 'Partnership', pickText: '9:6:5', keyText: '19:11:10' });
  assert.deepEqual(ctx, { kind: 'question', ref: 'att_1:q-9', number: 7, chapter: 'Partnership', pickLabel: '9:6:5', keyLabel: '19:11:10', blank: false });
  const norm = normalizeContext(ctx);
  assert.equal(norm.ref, 'att_1:q-9');
  assert.equal(norm.pickLabel, '9:6:5');
  assert.equal(norm.keyLabel, '19:11:10');
  assert.equal(norm.number, 7);
  const held = questionContext({ attemptId: 'att_1', questionId: 'q-9', number: 7, pickText: '9:6:5', keyText: '19:11:10', hasKey: false });
  assert.equal(held.keyLabel, null, 'a key under re-check sends no key label');
  const blank = normalizeContext(questionContext({ attemptId: 'att_1', questionId: 'q-9', number: 7, pickText: '9:6:5', blank: true }));
  assert.equal(blank.blank, true);
  assert.equal(blank.pickLabel, null, 'a blank has no pick');
  assert.equal(normalizeContext({ kind: 'question', ref: 'a:q', blank: 'yes' }).blank, undefined, 'only a real true is kept');
});

test('a blank question is offered its own asks, and a picked one the pick and key', () => {
  const asks = (c) => suggestionsFor({ context: normalizeContext(c), insights: INSIGHTS, status: 'ready', pro: false }).map((a) => a.label);
  assert.deepEqual(asks({ kind: 'question', ref: 'a:q', number: 7, chapter: 'Partnership', blank: true }).slice(0, 2), ['Why is the key right?', 'What should I look for first?']);
  assert.equal(asks({ kind: 'question', ref: 'a:q', number: 7, chapter: 'Partnership', pickLabel: '9:6:5', keyLabel: '19:11:10' })[0], 'Why is 19:11:10 right and 9:6:5 wrong?');
});

test('Ask Mobi about a question is for wrong answers and blanks whose key is not under re-check', () => {
  assert.equal(canAskAboutQuestion({ verdict: 'wrong' }), true);
  assert.equal(canAskAboutQuestion({ verdict: 'skipped' }), true);
  assert.equal(canAskAboutQuestion({ verdict: 'correct' }), false);
  assert.equal(canAskAboutQuestion({ verdict: 'wrong', held: true }), false, 'Mobi would not name a key that is being re-checked');
});

test('a mock opens with where the marks went, from the paper itself, and says nothing when nothing was missed', () => {
  const analysis = {
    marks: { gap: 78, max: 250 },
    chapters: [{ chapter: 'Partnership', gap: 36, wrong: 5, blank: 1 }, { chapter: 'Goodwill', gap: 18, wrong: 3, blank: 0 }, { chapter: 'Ratios', gap: 12, wrong: 0, blank: 2 }, { chapter: 'Fourth', gap: 6, wrong: 1, blank: 0 }],
  };
  const ctx = mockContext({ attemptId: 'att1', label: 'Mock 3', analysis });
  assert.deepEqual(ctx.lines, ['You missed 78 of 250 marks.', 'Partnership: 36 marks, from 5 wrong and 1 blank.', 'Goodwill: 18 marks, from 3 wrong.', 'Ratios: 12 marks, from 2 blank.']);
  assert.equal(ctx.ref, 'att1');
  assert.equal(normalizeContext(ctx).lines.length, 4, 'the open API keeps all four lines');
  const first = openingFor({ context: normalizeContext(ctx), insights: INSIGHTS, status: 'ready' });
  assert.equal(first.reply, ctx.lines.join('\n'), 'one chapter per line');
  assert.equal(first.source, 'From Mock 3');
  const generic = openingFor({ context: normalizeContext(mockContext({ attemptId: 'att1', label: 'This mock', analysis })), insights: INSIGHTS, status: 'ready' });
  assert.equal(generic.ask, 'Where did the marks go in this mock?', 'a generic label reads as a sentence');
  assert.equal(generic.source, 'From this mock');
  assert.equal(inSentence('This session', 'this mock'), 'this session');
  assert.equal(inSentence(null), 'this mock');
  assert.equal(inSentence('Mock 3'), 'Mock 3');
  assert.deepEqual(mockContext({ attemptId: 'att1', analysis: { marks: { gap: 0, max: 250 }, chapters: [] } }).lines, []);
  assert.deepEqual(mockContext({ attemptId: 'a b' }).lines, []);
  assert.equal(mockContext({ attemptId: 'a b' }).ref, null);
  assert.equal(mockLabel({ source: 'Mock 3', mode: 'full' }), 'Mock 3');
  assert.equal(mockLabel({ mode: 'full' }), 'This mock');
  assert.equal(mockLabel({ mode: 'quick' }), 'This session');
});

test('Why this? (release 9): the context carries the card’s reason and chapter, never the plan’s fact lines; the answer counts from the record', () => {
  const move = { id: 'check', why: 'Missed in 2 separate sessions. Start with a fresh check.' };
  const ctx = todayContext({ move });
  assert.deepEqual(ctx, { kind: 'today', label: 'Today', reason: move.why, chapter: null, lines: [] });
  assert.equal(todayContext({ move: { id: 'failed' } }), null, 'nothing to explain when Today did not load');
  assert.equal(todayContext({ move: null }), null);
  assert.deepEqual(todayContext({ move: { id: 'dayOne', why: 'Ten questions.' } }).lines, [], 'a new student has no record facts, and none are invented');
  const first = openingFor({ context: normalizeContext(ctx), insights: INSIGHTS, status: 'ready' });
  assert.ok(!first.reply.startsWith(move.why), 'the answer does not restate the card');
  assert.match(first.reply, /^Most of your open marks are in Partnership: 11 wrong, of 34 questions over 4 sessions\./, 'counted from the same read as the chip');
  assert.equal(first.source, 'From your record, 9 sessions and 250 questions');
  assert.equal(openingFor({ context: normalizeContext(todayContext({ move: { id: 'dayOne', why: 'Ten questions.' } })), insights: { state: 'empty' }, status: 'empty' }).source, 'From your plan', 'no record is claimed for a student who has none');
});

test('Practice previews the weakest chapter with its denominator, and nothing without a record', () => {
  assert.equal(practicePreview(INSIGHTS), 'Partnership: 11 wrong of 34 answered');
  assert.equal(practicePreview({ state: 'empty' }), null);
  assert.equal(practicePreview(null), null);
  assert.equal(practicePreview({ ...INSIGHTS, chapters: { ranked: [], thin: [] } }), null);
  assert.deepEqual(practiceContext(INSIGHTS), { kind: 'practice', chapter: 'Partnership' });
  assert.deepEqual(practiceContext(null), { kind: 'practice', chapter: null });
});

test('the link falls back to /mentor, and to the question hand-off for a question', () => {
  assert.equal(fallbackHref({ kind: 'question', ref: 'a1:q2' }), '/mentor?tab=ask&q=a1%3Aq2');
  assert.equal(fallbackHref({ kind: 'mock' }), '/mentor');
  assert.equal(fallbackHref(null), '/mentor');
});

test('every entry is wired once, with its one label, and none adds a card or an accent', () => {
  const result = read('src/app/(app)/result/[id]/ResultPageClient.jsx');
  assert.match(result, /\{mockEntryLabel\(mode\)\}<\/AskMobiLink>/, 'under the marks ledger');
  assert.match(result, /\{questionEntryLabel\(row\.number\)\}<\/AskMobiLink>/, 'inside an opened mistake, never on the collapsed row');
  assert.match(result, /askContext=\{askContextOf\(row\)\}/, 'the repair’s own ask opens on the same question');
  assert.match(result, /hasExplanation\(repairOutcomes\[row\.q\.id\]\) \? null : askContextOf\(row\)/, 'not drawn twice once the repair holds its own ask');
  const repairAsk = read('src/components/recovery/RepairAsk.jsx');
  assert.match(repairAsk, /openAskMobi\(\{ context, from: event\.currentTarget \}\)/);
  assert.match(read('src/components/today/TodayMove.jsx'), /ENTRY_LABELS\.today/);
  // Release 7: the 1018 lead card carries the entry; the context follows the lead (a swapped card asks about the swapped move).
  assert.match(read('src/app/(app)/today/page.jsx'), /todayContext\(\{ move: lead, revise: reviseData \}\)/);
  assert.match(read('src/app/(app)/today/page.jsx'), /askContext=\{askContext\}/);
  // Practice has one entry (release 6 merge): the Repairs and Ask Mobi line under the subject shelf (owner D5) carries "Ask Mobi what to practise".
  assert.match(read('src/app/(app)/dashboard/DashboardPageClient.jsx'), /<PracticeRepairs /);
  assert.doesNotMatch(read('src/app/(app)/dashboard/DashboardPageClient.jsx'), /PracticeAskRow/, 'one Ask Mobi entry on Practice, not two');
  assert.match(read('src/app/(app)/dashboard/PracticeRepairs.jsx'), /<AskMobiLink context=\{practiceContext\(insights\)\}[^>]*>[\s\S]*?\{ENTRY_LABELS\.practice\}/);
  const host = read('src/components/ai/AskMobiHost.jsx');
  assert.match(host, /isAskMobiNavHref/, 'the Planning row opens the panel in place');
  const css = read('src/components/ai/ask-entry.css');
  assert.doesNotMatch(css, /background(-color)?:|box-shadow|linear-gradient|radial-gradient|text-shadow|backdrop-filter|#d2f000|var\(--volt/, 'a text button or a hairline row: no fill, no card, no glow, no accent');
});

test('the Help door no longer carries Mobi, and nothing about Mobi sits under the theme switch', () => {
  const shell = read('src/app/(app)/AppLayoutClient.jsx');
  const foot = shell.slice(shell.indexOf('className="arena-sidebar__foot"'), shell.indexOf('</aside>')).replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
  assert.match(foot, /<AppearanceSwitch compact \/>/);
  assert.doesNotMatch(foot, /Orb|Ask Mobi|openAskMobi/);
  assert.match(shell, /item\('mentor', 'Ask Mobi'|arenaNavigation/);
  assert.match(read('src/lib/arenaNavigation.js'), /item\('mentor', 'Ask Mobi', 'prepos'\)/, 'Ask Mobi stays as the ordinary Planning row');
  assert.doesNotMatch(shell, /Open Help to ask Mobi/, 'the tour does not send a student to Help for Mobi');
});

test('the panel has a designed state for empty, thinking, answer, error, out of credits and offline', () => {
  const panel = read('src/components/ai/AskMobiPanel.jsx');
  assert.match(panel, /Mobi answers from your own practice\. After one session it can show where your marks went\./, 'empty');
  assert.match(panel, /Reading \$\{qName\}, your pick and the key/, 'thinking, with real words and no invented stages');
  assert.match(panel, /<MobiMark size=\{20\} blinking \/>/, 'thinking: Mobi’s eyes, not a spinner');
  assert.match(panel, /function Answer\(/, 'answer');
  assert.match(panel, /usedLine\(\{ cost: response\.charged, pool: 'ai', balance: wallet\?\.known \? wallet\.total : null \}\)/, 'the balance after the reply, in the one credit wording');
  assert.match(panel, /The reply could not be confirmed\./, 'error: not confirmed');
  assert.match(panel, /Retry sends the same request, so you will not be charged twice/);
  assert.match(panel, /Nothing is charged for a reply that fails\./, 'error: a failed reply');
  assert.match(panel, /paid\.why/, 'out of credits and paused: the plain notice');
  assert.match(panel, /disabled=\{off\}/, 'out of credits: paid rows are disabled, free rows still work');
  assert.match(panel, /navigator\.onLine !== false/, 'offline is read from the browser');
  assert.match(panel, /You are offline\./);
  assert.match(panel, /if \(ask\.price !== 'free' && offline\) return;/, 'offline: no paid ask is sent');
  assert.match(panel, /if \(!paid\.open \|\| offline\) return;/, 'offline: typed text that needs a written reply is not sent');
  assert.match(panel, /Record not loaded/, 'record could not be read');
  assert.match(panel, /That question could not be opened\./, 'the question could not be opened');
});

test('the cost shows before each call and the balance updates after it (W-060)', () => {
  const panel = read('src/components/ai/AskMobiPanel.jsx');
  assert.match(panel, /ask\.price === 'free' \? 'Free' : creditCount\(1\)/, 'every ask row names its price');
  assert.match(panel, /usesLine\(\{ what: 'This reply', cost: 1, pool: 'ai' \}\)/, 'the composer names the price of what is typed, in the one credit wording');
  assert.match(panel, /<Link href="\/wallet" className="amb-cost__wallet"/, 'the balance links to the wallet (D76)');
  assert.match(panel, /announceWallet\(userId, next\)/, 'the top bar takes the same number');
  assert.match(panel, /finally \{[^}]*readWallet\(\);/s, 'the balance is read again after every written reply, success or failure');
  const route = '/api/ai/mentor/chat';
  assert.ok(panel.includes(route), 'it uses the existing AI route and no other');
  assert.doesNotMatch(panel, /fetch\('\/api\/ai\/(?!credits'|mentor\/(chat|local))/, 'no other AI route is called from the panel');
  assert.doesNotMatch(panel, /gpt-|claude-|haiku|luna|openai|anthropic/i, 'the panel never names or picks a model');
});

test('earlier questions pair each question with its reply, newest first, with the reply cut and its source named', () => {
  const messages = [
    { id: 'u1', role: 'user', text: 'Where am I losing marks?' },
    { id: 'a1', role: 'assistant', text: 'Partnership.', response: { reply: 'Partnership costs the most marks.', origin: 'record' } },
    { id: 'u2', role: 'user', text: 'Explain goodwill' },
    { id: 'a2', role: 'assistant', response: { reply: 'word '.repeat(80), runtimeState: 'live', charge: { kind: 'prepos_credit', amount: 1 } } },
    { id: 'u3', role: 'user', text: 'Is anyone there?' },
    { id: 'u4', role: 'user', text: '   ' },
    { id: 'a4', role: 'assistant', response: { reply: 'Written replies are paused.', runtimeState: 'paused' } },
  ];
  const rows = exchangesFrom(messages);
  assert.deepEqual(rows.map((r) => r.id), ['u3', 'u2', 'u1'], 'newest first; an empty question is dropped');
  assert.equal(rows[2].source, 'From your record');
  assert.equal(rows[1].source, 'Written reply');
  assert.ok(rows[1].reply.endsWith('…') && rows[1].reply.length <= 262, 'a long reply is cut at a word');
  assert.deepEqual([rows[0].reply, rows[0].source], [null, null], 'a question with no saved reply shows none, and invents no source');
  assert.equal(sourceOf({ runtimeState: 'paused' }), null, 'a service status is not an answer');
  assert.equal(sourceOf({}), 'Earlier reply, source not recorded');
  assert.equal(exchangesFrom(messages, { limit: 1 }).length, 1);
  assert.deepEqual(exchangesFrom(null), []);
  assert.equal(clip('short'), 'short');
});

test('/mentor is "Your record" with no tabs, the old four-tab hub is gone, and the old deep links still land well', () => {
  const page = read('src/app/(app)/mentor/page.js');
  assert.match(page, /<MentorRecordPage \/>/);
  const view = read('src/components/ai/MentorRecordPage.jsx');
  assert.match(view, /if \(tab === 'plan'\) \{ router\.replace\('\/today'\)/, 'the next step lives on Today');
  assert.match(view, /if \(tab === 'tools'\) \{ router\.replace\('\/wallet'\)/, 'the old tools tab lands on the wallet (D76)');
  assert.match(view, /title="Your record"/);
  assert.match(view, /<AskMobiLink context=\{\{ kind: 'page' \}\}/, 'Mobi is one row away, and opens beside the record');
  assert.doesNotMatch(view, /role="tablist"|aria-pressed|SECTIONS/, 'no tabs');
  for (const gone of ['src/components/ai/MockMobAIHub.jsx', 'src/components/ai/AIMentorTerminal.jsx']) assert.equal(existsSync(new URL(`../../${gone}`, import.meta.url)), false, gone);
  const shell = read('src/app/(app)/AppLayoutClient.jsx');
  assert.match(shell, /<Link href=\{previewLinks\?\.wallet \|\| '\/wallet'\} className="arena-chip arena-chip--credits"/, 'the top bar balance opens the wallet (D76)');
  assert.equal((shell.match(/className="arena-chip arena-chip--(credits|prepos)"/g) || []).length, 1, 'one credits balance, one chip (D78)');
  assert.match(shell, /amount=\{wallet\.wallet\?\.known \? wallet\.wallet\.total : \(user\?\.creditBalance \?\? 0\)\}/, 'the chip shows the unified total');
});

test('touch targets in the panel are 44 px: close, chips and their x, the ask rows, the send key; the handle cannot start a text selection', () => {
  const css = read('src/components/ai/ask-mobi.css');
  assert.match(css, /\.amb-icon \{[^}]*width: 44px; height: 44px;/);
  assert.match(css, /\.amb \.amb-chip \{ min-height: 44px; \}/);
  assert.match(css, /\.amb \.amb-chip > button \{[^}]*width: 44px; height: 44px;/);
  assert.match(css, /\.amb-ask \{[^}]*min-height: 56px;/);
  assert.match(css, /\.amb-send \{[^}]*min-height: 44px;/);
  assert.match(css, /\.amb-grab \{[^}]*user-select: none;/, 'a second drag on the sheet must not be cancelled by a selection the first one made');
});
