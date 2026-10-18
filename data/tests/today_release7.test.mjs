// Website release 7 (the 1018 Today merged onto release 6): the owner's D15, D29 and D36 on the new Today, and the wiring that
// keeps release 6's Ask Mobi entry on the new lead card.
// Run: node --test data/tests/today_release7.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { freshPaper, markReelSeen, reelActHref, reelFor, reelSeen, FRESH_MS, SEEN_KEY } from '../../src/lib/today/paperReel.mjs';
import { mistakeAction } from '../../src/lib/today/mistakeAction.mjs';
import { ACTION_LABELS } from '../repair_presentation.mjs';
import { analyseSession } from '../session_recovery.js';
import { greeting } from '../../src/lib/today/greeting.mjs';
import { buildReelScript, reelInputs } from '../../src/components/result/reelScript.mjs';
import { reelSeconds } from '../replay.js';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const NOW = Date.parse('2026-10-18T14:10:00Z');
const MIN = 60000;
const fixture = JSON.parse(readFileSync(new URL('./fixtures/mistake_lab/replay_full_input.json', import.meta.url), 'utf8'));
const memory = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, dump: () => m }; };

// ---- D29: Play your paper back, once, after a fresh submission -----------------------------------------------------------

test('reel card: only the newest paper, only for 3 hours after it was saved', () => {
  const at = (ago) => ({ id: 'a1', completedAt: NOW - ago });
  assert.equal(freshPaper([at(20 * MIN)], NOW).id, 'a1');
  assert.equal(freshPaper([at(FRESH_MS)], NOW).id, 'a1', 'the edge of the window is still fresh');
  assert.equal(freshPaper([at(FRESH_MS + MIN)], NOW), null, 'yesterday\'s paper is not a fresh submission');
  assert.equal(freshPaper([at(-2 * MIN)], NOW).id, 'a1', 'a few minutes of clock skew is allowed');
  assert.equal(freshPaper([at(-2 * 3600000)], NOW), null);
  assert.equal(freshPaper([{ id: 'old', completedAt: NOW - 5 * 3600000 }, at(MIN)], NOW), null, 'only the newest paper counts');
  assert.equal(freshPaper([], NOW), null);
  assert.equal(freshPaper(null, NOW), null);
  assert.equal(freshPaper([{ completedAt: NOW }], NOW), null, 'a paper without an id');
  assert.equal(freshPaper([{ id: 'a1', completedAt: 'soon' }], NOW), null);
});

test('reel card: seen once per attempt (localStorage), the last 20 kept, and a broken store never throws', () => {
  const store = memory();
  assert.equal(reelSeen(store, 'a1'), false);
  markReelSeen(store, 'a1');
  assert.equal(reelSeen(store, 'a1'), true);
  assert.equal(reelSeen(store, 'a2'), false, 'another attempt is a new card');
  markReelSeen(store, 'a1');
  assert.deepEqual(JSON.parse(store.getItem(SEEN_KEY)), ['a1'], 'marking twice keeps one entry');
  for (let i = 0; i < 25; i += 1) markReelSeen(store, `x${i}`);
  const kept = JSON.parse(store.getItem(SEEN_KEY));
  assert.equal(kept.length, 20);
  assert.equal(kept.at(-1), 'x24');
  assert.equal(reelSeen(store, 'a1'), false, 'the oldest fall off');
  // No storage, a throwing store and a corrupt value all read as "not seen" and never throw.
  assert.equal(reelSeen(null, 'a1'), false);
  assert.doesNotThrow(() => markReelSeen(null, 'a1'));
  const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(reelSeen(broken, 'a1'), false);
  assert.doesNotThrow(() => markReelSeen(broken, 'a1'));
  const corrupt = memory(); corrupt.setItem(SEEN_KEY, '{not json');
  assert.equal(reelSeen(corrupt, 'a1'), false);
  markReelSeen(corrupt, 'a1');
  assert.equal(reelSeen(corrupt, 'a1'), true);
  assert.doesNotThrow(() => markReelSeen(store, ''));
});

test('reel card: the reel is built from the saved paper with the result\'s own engine, and is honest about "nothing to play"', () => {
  const attempt = fixture.attempt;
  const got = reelFor(attempt, { hour: 14, aiCredits: 38, practiceCredits: 120, isPremium: false, subjectName: () => 'Accountancy' });
  assert.ok(got, 'a 50-question paper has a reel');
  const analysis = analyseSession(attempt);
  assert.equal(got.script.total, 50);
  assert.equal(got.script.score, analysis.marks.scored);
  assert.equal(got.script.max, 250);
  assert.equal(got.seconds, reelSeconds(got.script));
  assert.equal(got.seconds % 5, 0, 'the title says 5, 10, 15, 20 ... seconds');
  assert.ok(got.script.next && got.script.next.label === got.move.label, 'it ends on the same one next move the result shows');
  // The same script, built through the result page's path (reelInputs then buildReelScript), is identical.
  const again = buildReelScript(reelInputs({ analysis, attempt, timeRead: null, finding: null, move: null }));
  assert.equal(again.total, got.script.total, 'one engine for the result and Today');
  // A paper with nothing answered, a missing paper and a broken record have no reel, and never throw.
  const blank = { ...attempt, details: [] };
  assert.equal(reelFor(blank), null);
  assert.equal(reelFor(null), null);
  assert.equal(reelFor({}), null);
  assert.equal(reelFor({ questionsSnapshot: 'nope', details: 7 }), null);
});

test('reel card: the reel\'s last key opens that question\'s result, or the paper\'s result', () => {
  assert.equal(reelActHref('a1', { kind: 'repair', target: { number: 42 } }), '/result/a1?q=42');
  assert.equal(reelActHref('a1', { kind: 'check', target: { number: 7 } }), '/result/a1?q=7');
  assert.equal(reelActHref('a1', { kind: 'paper', target: null }), '/result/a1');
  assert.equal(reelActHref('a b', { kind: 'repair', target: {} }), '/result/a%20b');
});

test('reel card: wired once on Today, in the lead\'s place, with a one-tap Not now and a preview state', () => {
  const page = read('src/app/(app)/today/page.jsx');
  assert.match(page, /import TodayReel from '@\/components\/today\/TodayReel'/);
  assert.match(page, /freshPaper\(papersData, nowMs\)/);
  assert.match(page, /reelSeen\(readStorage\(\), freshId\)/);
  assert.match(page, /\{reelPaper \? \(\s*<TodayReel paper=\{reelPaper\}[^>]*loadAttempt=\{data\.loadAttempt\}/, 'the card takes the lead\'s place');
  assert.match(page, /onDone=\{\(\) => setReelOver\(true\)\}/, 'Up next returns when the card is done');
  const card = read('src/components/today/TodayReel.jsx');
  assert.match(card, /from '@\/components\/result\/PaperReel'/, 'the result\'s own reel');
  assert.match(card, /fill\(W\.open, \{ s: reel\.seconds \}\)/, '"Play your paper back, 20 s", from the engine');
  assert.match(card, /onClick=\{\(\) => onDone\?\.\('later'\)\}>Not now</, 'one tap');
  assert.match(card, /data-page-primary/, 'the one volt key');
  assert.match(card, /markReelSeen\(storage\(\), paper\.id\)/);
  const preview = read('src/app/preview/arena/ArenaPreviewClient.jsx');
  assert.match(preview, /fixture\.get\('reel'\)/);
  assert.match(preview, /reel === 'stable' \? 'fxreel-stable'/);
  // The result page and Today share one script builder.
  assert.match(read('src/components/result/PaperReel.jsx'), /buildReelScript\(\{ rows, replay, paceMs, rec, kind, label, target, line, detail, chapter \}\)/);
});

// ---- D15: the release 6 action words on Today ---------------------------------------------------------------------------

test('weak chapters: one action label per state, the same four words as the result', () => {
  const wrong = { qid: 'q1', outcome: 'wrong' };
  const blank = { qid: 'q2', outcome: 'skip' };
  assert.deepEqual(mistakeAction(wrong, {}, null), { label: ACTION_LABELS.repair, state: null });
  assert.equal(ACTION_LABELS.repair, 'Repair');
  assert.deepEqual(mistakeAction(blank, {}, null), { label: 'Try it again', state: null });
  // Repaired, the check on a new question not taken yet.
  assert.deepEqual(mistakeAction(wrong, {}, { checkedState: 'pending' }), { label: 'Check it held', state: 'Repaired' });
  // Repaired and checked: See repair, with what the check found.
  assert.deepEqual(mistakeAction(wrong, {}, { checkedState: 'passed' }), { label: 'See repair', state: 'Held' });
  assert.deepEqual(mistakeAction(wrong, {}, { checkedState: 'not_passed' }), { label: 'See repair', state: 'Slipped' });
  // A repair the paper holds with no row (or no check offered): See repair, which always opens free.
  assert.deepEqual(mistakeAction(wrong, { savedRepairs: { q1: { repairedAt: 'x' } } }, null), { label: 'See repair', state: 'Repaired' });
  assert.deepEqual(mistakeAction(wrong, {}, { checkedState: 'not_available' }), { label: 'See repair', state: 'Repaired' });
  // Nothing on Today says "repair first": priority is order, never a label (the result's banned words).
  const todayText = [read('src/lib/today/move.mjs'), read('src/lib/today/lead.mjs'), read('src/components/today/TodayWeak.jsx'), read('src/components/today/TodayMove.jsx')].join('\n');
  assert.doesNotMatch(todayText, /repair first|Repair in \d|check it here/i);
  assert.match(read('src/components/today/TodayWeak.jsx'), /mistakeAction\(m, attempt, rowOf\(m\)\)/);
});

// ---- D36: Ask Mobi's "Why this?" on the new lead card ----------------------------------------------------------------------

test('lead card: "Why this?" sits beside the reason line, a real link with a 44 px target, following the lead', () => {
  const move = read('src/components/today/TodayMove.jsx');
  assert.match(move, /import AskMobiLink from '@\/components\/ai\/AskMobiLink'/);
  assert.match(move, /<p className="tm__why">\{keepTogether\(m\.why\)\}[\s\S]*?<AskMobiLink context=\{askContext\} variant="inline" className="tm__inline">\{ENTRY_LABELS\.today\}<\/AskMobiLink><\/> : null\}<\/p>/, 'inside the reason paragraph');
  assert.match(move, /m\.link && !\(askContext && m\.link\.href\.startsWith\('\/mentor'\)\)/, 'it takes the place of a link to the record page');
  assert.match(move, /askContext = null/);
  const page = read('src/app/(app)/today/page.jsx');
  assert.match(page, /todayContext\(\{ move: lead, plan: data\.plan\.data \}\)/, 'the context follows the lead, swapped or recommended');
  assert.match(page, /askContext=\{askContext\}/);
  // 44 px: the inline entry pads 12 px above and below its line (24 + the 21 px line); the sentence link rule does the same.
  assert.match(read('src/components/ai/ask-entry.css'), /\.ame\.ame--inline \{[^}]*padding: 12px 0/);
  assert.match(read('src/components/today/today.css'), /a\.tm__inline \{ padding-block: 12px; \}/);
});

// ---- D28: the greeting by the local hour survives the merge --------------------------------------------------------------------

test('greeting: Hello from midnight to 5 AM survives the merge', () => {
  assert.equal(greeting({ hour: 0, name: 'Asha' }), 'Hello, Asha');
  assert.equal(greeting({ hour: 4, name: 'Asha' }), 'Hello, Asha');
  assert.equal(greeting({ hour: 5, name: 'Asha' }), 'Good morning, Asha');
  assert.equal(greeting({ hour: 23, name: 'Asha' }), 'Good evening, Asha');
  assert.equal(greeting({ hour: 2, name: 'Asha', returning: true }), 'Welcome back, Asha');
  assert.match(read('src/app/(app)/today/page.jsx'), /greeting\(\{ hour, name: user\?\.name, email: user\?\.email, returning:/);
});

// ---- The release 5 and 6 pieces the merge keeps ------------------------------------------------------------------------------

test('the merge keeps the release 6 shell: Ask Mobi panel and Help door, and the 1018 Today files are in', () => {
  for (const file of ['src/components/today/TodayWeak.jsx', 'src/components/today/TodayPaper.jsx', 'src/components/today/TodayQueue.jsx', 'src/components/today/TodayColleges.jsx', 'src/components/today/TodayPlanFlow.jsx', 'src/lib/today/lead.mjs']) {
    assert.ok(read(file).length > 200, `${file} exists`);
  }
  assert.throws(() => read('src/components/today/TodayRows.jsx'), 'TodayRows was split in 1018');
  assert.doesNotMatch(read('src/app/(app)/today/page.jsx'), /TodayRows/);
  const shell = read('src/app/(app)/AppLayoutClient.jsx');
  assert.match(shell, /AskMobi/, 'the Ask Mobi panel and nav row');
});
