// The Mob row's story for the home page's one-place frame (owner LK365, 21 Nov 2026; tmp/1121-stories/COMMON.md).
// Holds: every hook the script aims at is in the component; the say lines' rules and pace; the script's length; and every
// rule, word and number the screen shows against the file it comes from.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MOB_CHIP, MOB_DEN, MOB_KEYS, MOB_MEMBERS, MOB_RULES, MOB_SAMPLE, MOB_STORY, MOB_TIMING, MOB_TITLE, MOB_TRAP, MOB_WORDS, marksOf, mobBoard } from '../../src/components/landing/stories/mobStory.mjs';
import { scriptHooks, scriptMs, CURSOR_PRESS_MS, ROW_MAX_MS, ROW_MIN_MS } from '../../src/components/landing/onePlaceModel.mjs';
import { buildFaqs, buildTour } from '../../src/components/landing/homeCopy.mjs';
import { publicSample } from '../../src/components/landing/sampleFive.mjs';
import { COUNTS, MARK_RIGHT, MARK_WRONG, gameTrap, marksFor } from '../../src/lib/mob/games.mjs';
import { CODE_RE, MAX_MEMBERS, TRAP_MIN_SITTERS } from '../../src/lib/mob/model.mjs';
import { MOB_NAMES } from '../../src/lib/mob/names.mjs';
import { STARTERS } from '../../src/lib/mob/folds.mjs';
import { DenCopy } from '../../src/lib/mob/v3/denCopy.mjs';
import { COPY } from '../../src/components/mob/v3/play/playModel.mjs';

const SRC = readFileSync(new URL('../../src/components/landing/stories/MobStory.jsx', import.meta.url), 'utf8');
const CSS = readFileSync(new URL('../../src/components/landing/stories/mob-story.css', import.meta.url), 'utf8');
const steps = MOB_STORY.steps;
const stepMs = (s) => (s.wait ? s.wait : (s.move ?? 0) + (s.click ? CURSOR_PRESS_MS : 0) + (s.dwell ?? 0));

test('every hook the script aims at is a control in MobStory.jsx', () => {
  const hooks = scriptHooks(steps);
  assert.deepEqual(hooks.sort(), ['mob-choice', 'mob-fix', 'mob-podium', 'mob-share', 'mob-start']);
  for (const hook of hooks) assert.match(SRC, new RegExp(`<button[^>]*data-demo="${hook}"`), hook);
  // Every click lands on a button, never a link (the page would leave).
  assert.doesNotMatch(SRC, /<a[\s>]/);
  assert.doesNotMatch(SRC, /<Link[\s>]/);
});

test('the say lines: 3 to 5 beats, one plain sentence each, at most 58 characters', () => {
  const says = steps.filter((s) => typeof s.say === 'string').map((s) => s.say);
  assert.ok(says.length >= 3 && says.length <= 5, `${says.length} beats`);
  for (const line of says) {
    assert.ok(line.length <= 58, line);
    // Sentence case: a capital opens it, and only the feature's own name (the Mob) keeps one inside it.
    assert.match(line.replace(/\bMob\b/g, 'mob'), /^[A-Z][^A-Z.]*\.$/, `sentence case, one sentence: ${line}`);
    assert.doesNotMatch(line, /[—–!]|\p{Extended_Pictographic}/u, line);
  }
});

test('the pace: each line stays 2.2 s or more, the reader reads before the cursor moves, the script runs 11 to 16 s', () => {
  const sayAt = steps.map((s, i) => (typeof s.say === 'string' ? i : -1)).filter((i) => i >= 0);
  for (let k = 0; k < sayAt.length; k += 1) {
    const from = sayAt[k];
    const to = k + 1 < sayAt.length ? sayAt[k + 1] : steps.length;
    const held = steps.slice(from, to).reduce((ms, s) => ms + stepMs(s), 0);
    assert.ok(held >= 2200, `beat ${k + 1} holds ${held} ms`);
    // A say sits on a wait of 500 ms or more, so the first move after it waits that long.
    assert.ok(steps[from].wait >= 500 && !steps[from].target, `beat ${k + 1} reads first`);
  }
  const total = scriptMs(steps);
  assert.ok(total >= ROW_MIN_MS && total <= ROW_MAX_MS, `${total} ms`);
  // Every beat names its subject.
  for (const i of sayAt) assert.ok('focus' in steps[i], `beat at step ${i} has a focus`);
});

test('each click waits for what it starts to land', () => {
  const after = (hook) => steps.find((s) => s.target?.includes(`"${hook}"`));
  assert.ok(after('mob-share').dwell >= MOB_TIMING.arrive.at(-1) + 400, 'friends seated before the next beat');
  const lastPip = MOB_TIMING.runs.at(-1) + (MOB_RULES.count - 1) * MOB_TIMING.pip + 300;
  assert.ok(MOB_TIMING.closed >= lastPip, 'the game closes after the last run has landed');
  assert.ok(after('mob-start').dwell + steps[steps.indexOf(after('mob-start')) + 1].wait > MOB_TIMING.closed + 200, 'See the podium is there before the cursor goes to it');
  assert.equal(MOB_TIMING.runs.length, MOB_MEMBERS.length);
  assert.equal(MOB_TIMING.arrive.length, MOB_MEMBERS.length - 1);
  assert.ok(MOB_WORDS.hoursLeft.length <= MOB_TIMING.runs.length, 'one clock step per run that lands');
});

test('the title and the chip are the tour slide’s own', () => {
  const slide = buildTour({ mobLive: true }).find((s) => s.id === 'mob');
  assert.equal(MOB_STORY.id, 'mob');
  assert.equal(MOB_TITLE, slide.title);
  assert.equal(MOB_STORY.title, slide.title);
  assert.equal(MOB_CHIP, slide.chip);
  assert.equal(MOB_STORY.chip, slide.chip);
});

test('the rules the screen shows are the Mob’s own', () => {
  assert.equal(MOB_RULES.markRight, MARK_RIGHT);
  assert.equal(MOB_RULES.markWrong, MARK_WRONG);
  assert.equal(MOB_RULES.count, COUNTS.sprint[0]);
  assert.equal(MOB_RULES.seats, MAX_MEMBERS);
  assert.match(DenCopy.asyncLineStart, new RegExp(`for ${MOB_RULES.hours} hours`));
  const faq = buildFaqs({ offer: { purchasable: 'monthly', monthly: { rupees: 1 }, oneTime: {} }, mobLive: true }).find((f) => f.question === 'What is the Mob?');
  assert.match(faq.answer, /same five questions for 24 hours/);
  assert.ok(MOB_NAMES.includes(MOB_DEN.name));
  assert.match(MOB_DEN.code, CODE_RE);
  assert.equal(MOB_DEN.code.length, 8);
  for (const m of MOB_MEMBERS) {
    assert.ok(STARTERS.includes(m.fold), `${m.fold} is a starter Fold`);
    assert.equal(m.picks.length, MOB_RULES.count);
  }
  assert.ok(MOB_MEMBERS.length <= MAX_MEMBERS && MOB_MEMBERS.length >= TRAP_MIN_SITTERS);
});

test('marks, order and the trap follow the real marking and trap rule', () => {
  for (const m of MOB_MEMBERS) {
    const right = m.picks.filter((p, q) => p >= 0 && p === MOB_KEYS[q]).length;
    const wrong = m.picks.filter((p, q) => p >= 0 && p !== MOB_KEYS[q]).length;
    assert.equal(marksOf(m.picks), marksFor(right, wrong), m.name);
  }
  const board = mobBoard();
  assert.deepEqual(board.map((r) => [r.name, r.marks]), [['You', 19], ['Riya', 14], ['Aman', 20], ['Zoya', 8]]);
  assert.deepEqual([...board].sort((a, b) => a.rank - b.rank).map((r) => r.name), ['Aman', 'You', 'Riya', 'Zoya']);
  assert.equal(new Set(board.map((r) => r.marks)).size, board.length, 'no shared places in the sample');
  const trap = gameTrap(MOB_MEMBERS.map((m) => m.picks), MOB_KEYS);
  assert.equal(trap.number, MOB_TRAP);
  assert.equal(MOB_TRAP, 3);
  // It caught you: Fix it together is yours to take.
  assert.notEqual(MOB_MEMBERS[0].picks[MOB_TRAP - 1], MOB_KEYS[MOB_TRAP - 1]);
});

test('every word on the screen is the real screen’s', () => {
  assert.equal(MOB_WORDS.you, DenCopy.you);
  assert.equal(MOB_WORDS.openSeat, DenCopy.openSeat);
  assert.equal(MOB_WORDS.copyCode, DenCopy.copyCode);
  assert.equal(MOB_WORDS.codeCopied, DenCopy.codeCopied);
  for (const n of [1, 2, 4]) assert.equal(MOB_WORDS.subtitle(n), DenCopy.denSubtitle(MOB_DEN.subject, n));
  assert.equal(MOB_WORDS.gameTitle, DenCopy.gameTitle({ format: 'sprint', host: { you: true } }));
  const game = { count: MOB_RULES.count, subjectName: MOB_DEN.subject, chapter: null, closesAt: null };
  assert.equal(MOB_WORDS.openLine, DenCopy.openLine({ ...game, runs: [] }, Date.now()));
  assert.equal(MOB_WORDS.openLineRuns, DenCopy.openLine({ ...game, runs: [{ name: 'You' }] }, Date.now()));
  assert.equal(MOB_WORDS.startKey, DenCopy.startTheSprint);
  assert.ok(DenCopy.runsSoFar([{ name: 'You' }], Date.now()).startsWith(MOB_WORDS.runsSoFar));
  assert.equal(MOB_WORDS.seePodium, COPY.seePodium);
  assert.equal(MOB_WORDS.trapCaught(3), COPY.trapCaught(3));
  assert.equal(MOB_WORDS.fixKey(3), COPY.fixTogether(3));
  assert.equal(MOB_WORDS.fixTitle, COPY.fixTitle);
  assert.equal(MOB_WORDS.fixSub, COPY.fixSub(MOB_DEN.name));
  assert.equal(MOB_WORDS.freshTitle, COPY.freshTitle);
  assert.equal(MOB_WORDS.fixRight, COPY.fixRight);
  assert.equal(MOB_WORDS.fixWrong, COPY.fixWrong);
  assert.equal(MOB_WORDS.backToDen, COPY.backToDen);
  assert.match(MOB_WORDS.hoursLeft[0], new RegExp(`^${MOB_RULES.hours} h left$`));
  const hours = MOB_WORDS.hoursLeft.map((t) => Number.parseInt(t, 10));
  assert.deepEqual([...hours].sort((a, b) => b - a), hours, 'the clock only runs down');
});

test('the fresh question is the home page’s public Economics sample, and the cursor answers it right', () => {
  const sample = publicSample('Economics');
  assert.deepEqual(MOB_SAMPLE, sample);
  const choice = steps.find((s) => s.target?.includes('"mob-choice"'));
  assert.equal(choice.target, `[data-demo="mob-choice"]:nth-child(${sample.correct + 1})`);
  // The options are the only children of their group, so nth-child counts options.
  assert.match(SRC, /<div className="stm-opts"[^>]*>\s*\{sample\.options\.map/);
});

test('the screen keeps to the contract: scoped CSS, motion by transform and opacity, reduced motion honoured', () => {
  const selectors = CSS.replace(/\/\*[\s\S]*?\*\//g, '').match(/(^|})\s*([^{}@]+)\{/g).map((m) => m.replace(/^}?\s*/, '').replace(/\{$/, '').trim());
  for (const sel of selectors) {
    if (/^(from|to|\d+%)$/.test(sel)) continue;
    for (const one of sel.split(/,(?![^(]*\))/)) assert.match(one.trim(), /(^|\s)\.st-mob\b|^\.st-mob/, `scoped: ${one.trim()}`);
  }
  for (const m of CSS.matchAll(/transition:\s*([^;]+);/g)) {
    for (const part of m[1].split(/,(?![^(]*\))/)) {
      const prop = part.trim().split(/\s+/)[0];
      assert.ok(['opacity', 'transform', 'visibility', 'none'].includes(prop), `transition on ${prop}`);
    }
  }
  assert.match(CSS, /prefers-reduced-motion: reduce/);
  assert.match(CSS, /html\[data-motion='reduced'\] \.st-mob/);
  assert.match(SRC, /dataset\.motion === 'reduced'/);
  assert.match(CSS, /html\[data-theme='dark'\] \.st-mob/);
  assert.match(SRC, /className="st st-mob" data-phase=\{phase\}/);
  // No text under 14 px: every font size is 0.875rem or more.
  for (const m of CSS.matchAll(/font(?:-size)?:\s*(?:\d{3}\s+)?([\d.]+)rem/g)) assert.ok(Number(m[1]) >= 0.875, `font ${m[1]}rem`);
});
